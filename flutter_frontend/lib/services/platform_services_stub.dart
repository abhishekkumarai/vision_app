// Traceability: KAN-92 — native / test fallback (no on-device detector yet; see KAN-93).
import 'dart:math';
import '../models/detection.dart';
import 'platform_services.dart';

class _UnavailableDetector implements OnDeviceDetector {
  @override
  String get name => 'unavailable';

  @override
  Future<bool> init() async => false;

  @override
  DetectionResponse? detect(double threshold) => null;

  @override
  String? crop(Box2D box, {double padding = 0.15}) => null;
}

OnDeviceDetector createOnDeviceDetector() => _UnavailableDetector();

final String _sessionId =
    'native-${DateTime.now().millisecondsSinceEpoch}-${Random().nextInt(1 << 32)}';

String loadClientId() => _sessionId;
