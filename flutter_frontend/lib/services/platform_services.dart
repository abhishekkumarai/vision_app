// Traceability: KAN-91, KAN-92
// Platform seam for things that differ between web and native builds.
import '../models/detection.dart';
import 'platform_services_stub.dart' if (dart.library.js_interop) 'platform_services_web.dart' as impl;

/// Runs object detection on the device instead of uploading frames to /api/detect.
/// Web: MediaPipe tasks-vision via web/mediapipe_bridge.js. Native: not yet (KAN-93),
/// so [init] returns false and the app keeps using server detection.
abstract class OnDeviceDetector {
  /// Engine name for UI/diagnostics.
  String get name;

  /// Loads the model. Returns false if on-device detection is unavailable.
  Future<bool> init();

  /// Detects on the current camera frame. Returns null when no frame is ready.
  DetectionResponse? detect(double threshold);

  /// JPEG data URL of [box] (+[padding]) from the current frame, or null.
  String? crop(Box2D box, {double padding = 0.15});
}

OnDeviceDetector createOnDeviceDetector() => impl.createOnDeviceDetector();

/// Stable per-install id used for server-side event dedupe.
String loadClientId() => impl.loadClientId();
