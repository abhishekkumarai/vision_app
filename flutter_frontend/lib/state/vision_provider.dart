// Traceability: KAN-61, KAN-69, KAN-70, KAN-73, KAN-77, KAN-91, KAN-92
import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:camera/camera.dart';
import '../models/detection.dart';
import '../models/identification.dart';
import '../models/chat.dart';
import '../models/app_settings.dart';
import '../services/api_service.dart';
import '../services/frame_cropper.dart';
import '../services/appearance_tracker.dart';
import '../services/platform_services.dart';

class VisionProvider extends ChangeNotifier {
  final ApiService _apiService;
  AppSettings _settings;

  // Camera fields
  CameraController? _cameraController;
  List<CameraDescription> _cameras = [];
  int _selectedCameraIndex = 0;
  bool _isCameraInitialized = false;
  bool _isCameraStreaming = false;
  String? _cameraError;
  bool _isDemoMode = false;

  // Detection loop fields
  Timer? _detectionTimer;
  bool _isDetecting = false;
  List<DetectedObject> _currentDetections = [];
  DetectedObject? _selectedObject;
  double _currentFps = 0.0;
  double _inferenceTimeMs = 0.0;
  int _frameCount = 0;
  DateTime _lastFpsTimestamp = DateTime.now();
  Uint8List? _lastFrameBytes;

  // On-device detection (web: MediaPipe in the browser) with server fallback (KAN-92)
  final OnDeviceDetector _onDevice = createOnDeviceDetector();
  bool _onDeviceReady = false;

  // Workflow events (KAN-91)
  final AppearanceTracker _tracker = AppearanceTracker();
  final String _clientId = loadClientId();

  // Intelligence / Identification
  IdentifyResponse? _activeIdentification;
  Uint8List? _selectedSnapshot;
  bool _isIdentifying = false;
  String? _identificationError;

  // Chat
  final List<ChatMessage> _chatMessages = [];
  // Index of the first message about the current object; only these are sent as history.
  int _chatContextStart = 0;
  bool _isChatSending = false;

  // Health & Providers
  Map<String, dynamic>? _backendHealth;
  List<LLMProviderInfo> _availableProviders = [];
  bool _isBackendHealthy = false;

  VisionProvider({
    ApiService? apiService,
    AppSettings? settings,
  })  : _settings = settings ?? AppSettings(),
        _apiService = apiService ?? ApiService(baseUrl: (settings ?? AppSettings()).backendUrl) {
    _chatMessages.add(
      ChatMessage(
        role: ChatRole.assistant,
        content: 'Hello! I am your AI Vision Assistant. Point your camera at any object or tap a detected box to inspect it.',
      ),
    );
  }

  // Getters
  AppSettings get settings => _settings;
  CameraController? get cameraController => _cameraController;
  List<CameraDescription> get cameras => _cameras;
  int get selectedCameraIndex => _selectedCameraIndex;
  bool get isCameraInitialized => _isCameraInitialized;
  bool get isCameraStreaming => _isCameraStreaming;
  String? get cameraError => _cameraError;
  bool get isDemoMode => _isDemoMode;

  String get friendlyCameraError {
    if (_cameraError == null) return '';
    final err = _cameraError!.toLowerCase();
    if (err.contains('cameranotreadable') || err.contains('notreadableerror') || err.contains('hardware error')) {
      return 'The physical camera is currently busy or inaccessible.\n\n'
          'Why this happens:\n'
          '• Another app (e.g. Teams, Zoom, another browser tab) is holding the exclusive camera lock on Windows.\n'
          '• You are testing in a headless or automated browser (e.g. Chrome DevTools / Docker container).\n\n'
          'Click "Retry Camera" after closing other camera apps, or click "Start Virtual Demo Feed" below to test full object detection & LLM intelligence.';
    }
    if (err.contains('permission') || err.contains('notallowederror')) {
      return 'Camera permission was not granted.\n\n'
          'Please allow camera permissions in your browser address bar and click "Retry Camera".';
    }
    if (err.contains('notfound') || err.contains('nodevices')) {
      return 'No physical camera detected on this system.\n\n'
          'You can connect a webcam or click "Start Virtual Demo Feed" below.';
    }
    return _cameraError!;
  }

  List<DetectedObject> get currentDetections => _currentDetections;
  DetectedObject? get selectedObject => _selectedObject;
  double get currentFps => _currentFps;
  double get inferenceTimeMs => _inferenceTimeMs;
  String get detectionEngine => _onDeviceReady ? _onDevice.name : 'Server (FastAPI /api/detect)';

  IdentifyResponse? get activeIdentification => _activeIdentification;
  Uint8List? get selectedSnapshot => _selectedSnapshot;
  bool get isIdentifying => _isIdentifying;
  String? get identificationError => _identificationError;

  List<ChatMessage> get chatMessages => List.unmodifiable(_chatMessages);
  bool get isChatSending => _isChatSending;

  Map<String, dynamic>? get backendHealth => _backendHealth;
  List<LLMProviderInfo> get availableProviders => _availableProviders;
  bool get isBackendHealthy => _isBackendHealthy;

  Future<void> initialize() async {
    await checkBackendHealth();
    await fetchProviders();
    unawaited(_initOnDeviceDetector());
    // NOTE: We do NOT eagerly call initializeCameras() on page load.
    // Modern browsers require a user gesture (clicking "Start Camera")
    // to prompt for media permissions without triggering cameraNotReadable/autoplay blocks.
  }

  Future<void> _initOnDeviceDetector() async {
    _onDeviceReady = await _onDevice.init();
    debugPrint('[VisionProvider] detection engine: $detectionEngine');
    if (_onDeviceReady && _isCameraStreaming && !_isDemoMode) _startDetectionLoop();
    notifyListeners();
  }

  Future<void> checkBackendHealth() async {
    final health = await _apiService.checkHealth();
    _backendHealth = health;
    _isBackendHealthy = health['status'] == 'healthy';
    notifyListeners();
  }

  Future<void> fetchProviders() async {
    _availableProviders = await _apiService.getProviders();
    notifyListeners();
  }

  Future<void> initializeCameras() async {
    try {
      _cameras = await availableCameras();
      if (_cameras.isNotEmpty) {
        await _setupCamera(_selectedCameraIndex);
      } else {
        _cameraError = 'No camera devices detected on this device.';
        notifyListeners();
      }
    } catch (e) {
      _cameraError = 'Error discovering cameras: $e';
      notifyListeners();
    }
  }

  Future<void> _setupCamera(int index) async {
    if (_cameras.isEmpty) return;
    _isCameraInitialized = false;
    // Release the previous stream (retry / camera switch) before opening a new one.
    final previous = _cameraController;
    _cameraController = null;
    notifyListeners();
    await previous?.dispose();

    try {
      final camera = _cameras[index];
      final controller = CameraController(
        camera,
        ResolutionPreset.medium,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.jpeg,
      );

      await controller.initialize();
      _cameraController = controller;
      _isCameraInitialized = true;
      _cameraError = null;
      notifyListeners();

      if (_isCameraStreaming) {
        _startDetectionLoop();
      }
    } catch (e) {
      _cameraError = 'Camera initialization failed: $e';
      _isCameraInitialized = false;
      notifyListeners();
    }
  }

  Future<void> toggleStreaming() async {
    if (_isDemoMode) {
      stopDemoMode();
    } else if (_isCameraStreaming) {
      await stopStreaming();
    } else {
      await startStreaming();
    }
  }

  void startDemoMode() {
    _isDemoMode = true;
    _cameraError = null;
    _isCameraStreaming = true;
    _startDemoDetectionLoop();
    notifyListeners();
  }

  void stopDemoMode() {
    _tracker.reset();
    _isDemoMode = false;
    _isCameraStreaming = false;
    _detectionTimer?.cancel();
    _detectionTimer = null;
    _currentDetections = [];
    _currentFps = 0.0;
    notifyListeners();
  }

  void _startDemoDetectionLoop() {
    _detectionTimer?.cancel();
    final sampleObjects = [
      DetectedObject(
        label: 'laptop',
        confidence: 0.94,
        box2d: const Box2D(ymin: 0.35, xmin: 0.25, ymax: 0.85, xmax: 0.75),
      ),
      DetectedObject(
        label: 'cell phone',
        confidence: 0.89,
        box2d: const Box2D(ymin: 0.45, xmin: 0.08, ymax: 0.78, xmax: 0.22),
      ),
      DetectedObject(
        label: 'cup',
        confidence: 0.82,
        box2d: const Box2D(ymin: 0.28, xmin: 0.78, ymax: 0.58, xmax: 0.92),
      ),
    ];

    _currentDetections = sampleObjects;
    _inferenceTimeMs = 14.8;
    _currentFps = 28.5;

    int tick = 0;
    _detectionTimer = Timer.periodic(const Duration(milliseconds: 350), (_) {
      tick++;
      final jitterX = (tick % 4 - 2) * 0.002;
      final jitterY = ((tick + 1) % 4 - 2) * 0.002;
      _currentDetections = [
        DetectedObject(
          label: 'laptop',
          confidence: 0.93 + (tick % 3) * 0.01,
          box2d: Box2D(
            ymin: 0.35 + jitterY,
            xmin: 0.25 + jitterX,
            ymax: 0.85 + jitterY,
            xmax: 0.75 + jitterX,
          ),
        ),
        DetectedObject(
          label: 'cell phone',
          confidence: 0.88 + ((tick + 1) % 3) * 0.01,
          box2d: Box2D(
            ymin: 0.45 - jitterY,
            xmin: 0.08 + jitterX,
            ymax: 0.78 - jitterY,
            xmax: 0.22 + jitterX,
          ),
        ),
        DetectedObject(
          label: 'cup',
          confidence: 0.82 + ((tick + 2) % 3) * 0.01,
          box2d: Box2D(
            ymin: 0.28 + jitterY,
            xmin: 0.78 - jitterX,
            ymax: 0.58 + jitterY,
            xmax: 0.92 - jitterX,
          ),
        ),
      ];
      _currentFps = 27.0 + (tick % 4);
      _emitAppearanceEvents();
      notifyListeners();
    });
  }

  Future<void> startStreaming() async {
    if (_isDemoMode) {
      stopDemoMode();
    }
    if (_cameras.isEmpty) {
      await initializeCameras();
    } else if (!_isCameraInitialized) {
      await _setupCamera(_selectedCameraIndex);
    }
    if (_isCameraInitialized) {
      _isCameraStreaming = true;
      _startDetectionLoop();
      notifyListeners();
    }
  }

  Future<void> stopStreaming() async {
    _tracker.reset();
    _isCameraStreaming = false;
    _isDemoMode = false;
    _detectionTimer?.cancel();
    _detectionTimer = null;
    _currentDetections = [];
    _currentFps = 0.0;
    notifyListeners();
  }

  Future<void> switchCamera() async {
    if (_cameras.length < 2) return;
    final nextIndex = (_selectedCameraIndex + 1) % _cameras.length;
    _selectedCameraIndex = nextIndex;
    await _setupCamera(nextIndex);
  }

  void _startDetectionLoop() {
    _detectionTimer?.cancel();
    _detectionTimer = _onDeviceReady
        // On-device: ~30 checks/s on the live <video>; nothing is uploaded.
        ? Timer.periodic(const Duration(milliseconds: 33), (_) => _detectOnDevice())
        : Timer.periodic(Duration(milliseconds: _settings.detectIntervalMs), (_) => _captureAndDetect());
  }

  void _detectOnDevice() {
    if (!_isCameraStreaming || _isDemoMode) return;
    final DetectionResponse? result;
    try {
      result = _onDevice.detect(_settings.confidenceThreshold);
    } catch (e) {
      debugPrint('On-device detection failed: $e');
      return;
    }
    if (result == null) return; // no new frame yet
    _applyDetections(result);
  }

  void _applyDetections(DetectionResponse result) {
    _currentDetections = result.detections;
    _inferenceTimeMs = result.inferenceTimeMs;
    _frameCount++;
    final now = DateTime.now();
    final elapsed = now.difference(_lastFpsTimestamp).inMilliseconds;
    if (elapsed >= 1000) {
      _currentFps = (_frameCount * 1000.0) / elapsed;
      _frameCount = 0;
      _lastFpsTimestamp = now;
    }
    _emitAppearanceEvents();
    notifyListeners();
  }

  /// JPEG crop of [box] from the current frame as base64 (no data-URL prefix), or null.
  String? _cropBase64(Box2D box) {
    if (_isDemoMode) return null;
    if (_onDeviceReady) {
      final dataUrl = _onDevice.crop(box);
      return dataUrl?.substring(dataUrl.indexOf(',') + 1);
    }
    final frame = _lastFrameBytes;
    final bytes = frame == null ? null : cropDetection(frame, box);
    return bytes == null ? null : base64Encode(bytes);
  }

  /// Sends one object_appeared event per newly stable object; the server runs workflows (KAN-91).
  void _emitAppearanceEvents() {
    if (!_settings.sendEvents) return;
    final appeared = _tracker.update(_currentDetections, DateTime.now());
    for (final d in appeared) {
      final source = '${kIsWeb ? 'flutter-web' : 'flutter-${defaultTargetPlatform.name}'}${_isDemoMode ? '-demo' : ''}';
      unawaited(_apiService.postEvent(
        detection: d,
        source: source,
        clientId: _clientId,
        imageB64: _cropBase64(d.box2d),
        provider: _settings.selectedProvider,
      ).then((res) {
        if (res != null) debugPrint('[VisionProvider] event ${res['id']} ${res['status']} for ${d.label}');
      }));
    }
  }

  Future<void> _captureAndDetect() async {
    if (!_isCameraStreaming || _cameraController == null || !_cameraController!.value.isInitialized) {
      return;
    }
    if (_isDetecting) return; // Prevent frame pileup

    _isDetecting = true;
    try {
      final file = await _cameraController!.takePicture();
      final bytes = await file.readAsBytes();
      _lastFrameBytes = bytes;
      final base64Image = base64Encode(bytes);

      final result = await _apiService.detectObjects(
        base64Image: base64Image,
        threshold: _settings.confidenceThreshold,
      );

      _applyDetections(result);
    } catch (e) {
      debugPrint('Detection frame processing failed: $e');
    } finally {
      _isDetecting = false;
    }
  }

  Future<void> selectObject(DetectedObject object) async {
    _selectedObject = object;
    _isIdentifying = true;
    _identificationError = null;
    // Snapshot of the object for multimodal LLMs (none in demo mode: no real frame).
    final cropB64 = _cropBase64(object.box2d);
    _selectedSnapshot = cropB64 == null ? null : base64Decode(cropB64);
    notifyListeners();

    try {
      final idResult = await _apiService.identifyObject(
        label: object.label,
        confidence: object.confidence,
        imageB64: cropB64,
        provider: _settings.selectedProvider,
      );

      if (idResult != null) {
        _activeIdentification = idResult;
        _chatContextStart = _chatMessages.length;
        _chatMessages.add(
          ChatMessage(
            role: ChatRole.assistant,
            content: 'I identified a **${idResult.name}** (${(idResult.confidence * 100).toInt()}% confidence). Ask me anything about its uses, specs, safety, or history!',
            provider: idResult.modelUsed,
          ),
        );
      } else {
        _identificationError = 'Could not retrieve encyclopedic data for ${object.label}.';
      }
    } catch (e) {
      _identificationError = e.toString();
    } finally {
      _isIdentifying = false;
      notifyListeners();
    }
  }

  Future<void> sendUserChatMessage(String text) async {
    if (text.trim().isEmpty || _isChatSending) return;

    final history = _chatMessages.sublist(_chatContextStart);
    final userMsg = ChatMessage(role: ChatRole.user, content: text.trim());
    _chatMessages.add(userMsg);
    _isChatSending = true;
    notifyListeners();

    try {
      final reply = await _apiService.sendChatMessage(
        question: text.trim(),
        objectContext: _activeIdentification?.toJson() ??
            (_selectedObject != null ? {'name': _selectedObject!.label} : const {}),
        history: history,
        provider: _settings.selectedProvider,
      );

      if (reply != null && reply.answer.isNotEmpty) {
        _chatMessages.add(
          ChatMessage(
            role: ChatRole.assistant,
            content: reply.answer,
            provider: reply.modelUsed,
          ),
        );
      } else {
        _chatMessages.add(
          ChatMessage(
            role: ChatRole.assistant,
            content: 'Sorry, I could not generate a response at this time. Please check your backend connection.',
          ),
        );
      }
    } catch (e) {
      _chatMessages.add(
        ChatMessage(
          role: ChatRole.assistant,
          content: 'Error communicating with intelligence server: $e',
        ),
      );
    } finally {
      _isChatSending = false;
      notifyListeners();
    }
  }

  void updateSettings(AppSettings newSettings) {
    _settings = newSettings;
    _apiService.baseUrl = newSettings.backendUrl;
    if (_isCameraStreaming) {
      _startDetectionLoop();
    }
    checkBackendHealth();
    notifyListeners();
  }

  @override
  void dispose() {
    _detectionTimer?.cancel();
    _cameraController?.dispose();
    super.dispose();
  }
}
