// Traceability: KAN-91, KAN-92 — web implementation via web/mediapipe_bridge.js.
import 'dart:convert';
import 'dart:js_interop';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:web/web.dart' as web;
import '../models/detection.dart';
import 'platform_services.dart';

@JS('visionBridge')
external _VisionBridge? get _bridge;

extension type _VisionBridge(JSObject _) implements JSObject {
  external JSPromise<JSBoolean> init();
  external JSString? detect(JSNumber threshold);
  external JSString? crop(JSNumber xmin, JSNumber ymin, JSNumber xmax, JSNumber ymax, JSNumber padding);
}

class _WebMediaPipeDetector implements OnDeviceDetector {
  bool _ready = false;

  @override
  String get name => 'MediaPipe (in-browser)';

  @override
  Future<bool> init() async {
    // The bridge is an ES module and may still be loading when Flutter starts.
    for (var i = 0; i < 50 && _bridge == null; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    final bridge = _bridge;
    if (bridge == null) {
      debugPrint('[OnDeviceDetector] visionBridge not found; using server detection');
      return false;
    }
    try {
      _ready = (await bridge.init().toDart).toDart;
    } catch (e) {
      debugPrint('[OnDeviceDetector] init failed: $e');
      _ready = false;
    }
    return _ready;
  }

  @override
  DetectionResponse? detect(double threshold) {
    if (!_ready) return null;
    final raw = _bridge?.detect(threshold.toJS)?.toDart;
    if (raw == null) return null;
    return DetectionResponse.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  @override
  String? crop(Box2D box, {double padding = 0.15}) {
    return _bridge
        ?.crop(box.xmin.toJS, box.ymin.toJS, box.xmax.toJS, box.ymax.toJS, padding.toJS)
        ?.toDart;
  }
}

OnDeviceDetector createOnDeviceDetector() => _WebMediaPipeDetector();

String loadClientId() {
  const key = 'vision-ai-client-id';
  try {
    final storage = web.window.localStorage;
    final existing = storage.getItem(key);
    if (existing != null && existing.isNotEmpty) return existing;
    final id = 'web-${DateTime.now().millisecondsSinceEpoch}-${Random.secure().nextInt(1 << 32)}';
    storage.setItem(key, id);
    return id;
  } catch (_) {
    return 'web-anonymous';
  }
}
