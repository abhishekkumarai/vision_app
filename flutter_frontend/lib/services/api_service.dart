// Traceability: KAN-61, KAN-69, KAN-70, KAN-71, KAN-73
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/detection.dart';
import '../models/identification.dart';
import '../models/chat.dart';
import '../models/app_settings.dart';

class ApiService {
  String baseUrl;
  final http.Client _client;

  ApiService({
    String? baseUrl,
    http.Client? client,
  })  : baseUrl = (baseUrl ?? AppSettings.defaultBackendUrl()).replaceAll(RegExp(r'/+$'), ''),
        _client = client ?? http.Client();

  Uri _uri(String path) => Uri.parse('$baseUrl$path');

  Future<Map<String, dynamic>> checkHealth() async {
    try {
      final response = await _client
          .get(_uri('/api/health'))
          .timeout(const Duration(seconds: 4));
      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }
      return {'status': 'unhealthy', 'error': 'Status ${response.statusCode}'};
    } catch (e) {
      return {'status': 'disconnected', 'error': e.toString()};
    }
  }

  /// `/api/providers` returns `{current, available: ["ollama", ...], ...}`.
  Future<List<LLMProviderInfo>> getProviders() async {
    try {
      final response = await _client
          .get(_uri('/api/providers'))
          .timeout(const Duration(seconds: 4));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final ids = (data['available'] as List<dynamic>? ?? []).map((e) => e.toString());
        return ids
            .map((id) => LLMProviderInfo(
                  id: id,
                  name: id,
                  available: id != 'gemini' || data['has_gemini_key'] == true,
                  details: id == data['current'] ? 'Server default' : '',
                ))
            .toList();
      }
    } catch (e) {
      debugPrint('Error getting providers: $e');
    }
    return [
      LLMProviderInfo(id: 'offline', name: 'Curated Offline Knowledge', available: true, details: 'Built-in'),
    ];
  }

  Future<DetectionResponse> detectObjects({
    required String base64Image,
    double threshold = 0.45,
  }) async {
    try {
      final response = await _client.post(
        _uri('/api/detect'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'image_b64': base64Image,
          'threshold': threshold,
        }),
      ).timeout(const Duration(seconds: 6));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        return DetectionResponse.fromJson(data);
      }
      debugPrint('Detect API returned ${response.statusCode}: ${response.body}');
    } catch (e) {
      debugPrint('Detect API error: $e');
    }
    return DetectionResponse(detections: [], count: 0, inferenceTimeMs: 0);
  }

  Future<IdentifyResponse?> identifyObject({
    required String label,
    required double confidence,
    String? imageB64,
    String? provider,
  }) async {
    try {
      final response = await _client.post(
        _uri('/api/identify'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'label': label,
          'score': confidence,
          if (imageB64 != null) 'image_b64': imageB64,
          if (provider != null) 'provider': provider,
        }),
      ).timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        return IdentifyResponse.fromJson(data, label: label, confidence: confidence);
      }
      debugPrint('Identify API returned ${response.statusCode}: ${response.body}');
    } catch (e) {
      debugPrint('Identify API error: $e');
    }
    return null;
  }

  /// `/api/chat` takes `{object_context, question, history, provider}` and
  /// returns `{answer, model_used}`.
  Future<({String answer, String modelUsed})?> sendChatMessage({
    required String question,
    Map<String, dynamic> objectContext = const {},
    List<ChatMessage> history = const [],
    String? provider,
  }) async {
    try {
      final response = await _client.post(
        _uri('/api/chat'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'object_context': objectContext,
          'question': question,
          'history': history.map((m) => m.toJson()).toList(),
          if (provider != null) 'provider': provider,
        }),
      ).timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final answer = data['answer'] as String?;
        if (answer == null) return null;
        return (answer: answer, modelUsed: data['model_used'] as String? ?? 'unknown');
      }
      debugPrint('Chat API returned ${response.statusCode}: ${response.body}');
    } catch (e) {
      debugPrint('Chat API error: $e');
    }
    return null;
  }

  /// `/api/events` (KAN-89/91): report a newly appeared object so the server can run
  /// workflows on it. Returns `{id, status, detail}` or null if it couldn't be sent.
  Future<Map<String, dynamic>?> postEvent({
    required DetectedObject detection,
    required String source,
    required String clientId,
    String? imageB64,
    String? provider,
  }) async {
    double clamp(double v) => v.clamp(0.0, 1.0);
    final b = detection.box2d;
    try {
      final response = await _client.post(
        _uri('/api/events'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'type': 'object_appeared',
          'label': detection.label,
          'confidence': clamp(detection.confidence),
          'box': {'xmin': clamp(b.xmin), 'ymin': clamp(b.ymin), 'xmax': clamp(b.xmax), 'ymax': clamp(b.ymax)},
          if (imageB64 != null) 'image_b64': imageB64,
          'source': source,
          'client_id': clientId,
          if (provider != null) 'provider': provider,
        }),
      ).timeout(const Duration(seconds: 8));
      if (response.statusCode == 202 || response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }
      debugPrint('Event API returned ${response.statusCode}: ${response.body}');
    } catch (e) {
      debugPrint('Event API error: $e');
    }
    return null;
  }
}
