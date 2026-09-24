// Traceability: KAN-61
import 'package:flutter/foundation.dart';

class LLMProviderInfo {
  final String id;
  final String name;
  final bool available;
  final String details;

  LLMProviderInfo({
    required this.id,
    required this.name,
    required this.available,
    required this.details,
  });

  factory LLMProviderInfo.fromJson(Map<String, dynamic> json) {
    return LLMProviderInfo(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      available: json['available'] as bool? ?? false,
      details: json['details'] as String? ?? '',
    );
  }
}

class AppSettings {
  String backendUrl;
  double confidenceThreshold;
  int detectIntervalMs;
  String selectedProvider;
  /// Send debounced object_appeared events to /api/events (KAN-91).
  bool sendEvents;

  AppSettings({
    String? backendUrl,
    this.confidenceThreshold = 0.45,
    this.detectIntervalMs = 350,
    this.selectedProvider = 'ollama',
    this.sendEvents = true,
  }) : backendUrl = backendUrl ?? defaultBackendUrl();

  /// Compile-time override: `--dart-define=BACKEND_URL=http://host:8000`.
  static const String _backendUrlOverride = String.fromEnvironment('BACKEND_URL');

  static String defaultBackendUrl() {
    if (_backendUrlOverride.isNotEmpty) return _backendUrlOverride;
    if (kIsWeb) {
      // Served by nginx, which reverse-proxies /api/ to the backend: use the
      // page's own origin so the app also works from other hosts (LAN, deploys).
      // For `flutter run -d chrome`, pass --dart-define=BACKEND_URL=http://localhost:8000.
      return Uri.base.origin;
    } else if (defaultTargetPlatform == TargetPlatform.android) {
      // Android emulator uses 10.0.2.2 for host localhost, or host IP on real device
      return 'http://10.0.2.2:8000';
    }
    return 'http://localhost:8000';
  }

  AppSettings copyWith({
    String? backendUrl,
    double? confidenceThreshold,
    int? detectIntervalMs,
    String? selectedProvider,
    bool? sendEvents,
  }) {
    return AppSettings(
      backendUrl: backendUrl ?? this.backendUrl,
      confidenceThreshold: confidenceThreshold ?? this.confidenceThreshold,
      detectIntervalMs: detectIntervalMs ?? this.detectIntervalMs,
      selectedProvider: selectedProvider ?? this.selectedProvider,
      sendEvents: sendEvents ?? this.sendEvents,
    );
  }
}
