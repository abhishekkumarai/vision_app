// Traceability: KAN-79 — request bodies ApiService sends must match backend/schemas.py.
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:flutter_frontend/models/chat.dart';
import 'package:flutter_frontend/models/detection.dart';
import 'package:flutter_frontend/services/api_service.dart';

void main() {
  late Map<String, dynamic> sentBody;
  late String sentPath;

  ApiService serviceReturning(Map<String, dynamic> reply) {
    final client = MockClient((request) async {
      sentPath = request.url.path;
      sentBody = jsonDecode(request.body) as Map<String, dynamic>;
      return http.Response(jsonEncode(reply), 200, headers: {'content-type': 'application/json'});
    });
    return ApiService(baseUrl: 'http://backend.test/', client: client);
  }

  test('detectObjects sends DetectionRequest {image_b64, threshold}', () async {
    final api = serviceReturning({
      'detections': [],
      'count': 0,
      'processing_time_ms': 3.0,
      'image_width': 640,
      'image_height': 480,
    });
    final result = await api.detectObjects(base64Image: 'AAAA', threshold: 0.5);
    expect(sentPath, '/api/detect');
    expect(sentBody, {'image_b64': 'AAAA', 'threshold': 0.5});
    expect(result.inferenceTimeMs, 3.0);
  });

  test('identifyObject sends IdentifyRequest {label, score, image_b64, provider}', () async {
    final api = serviceReturning({'name': 'Mug', 'category': 'Kitchen', 'summary': 'A mug.', 'model_used': 'mock'});
    final result = await api.identifyObject(label: 'cup', confidence: 0.8, imageB64: 'BBBB', provider: 'gemini');
    expect(sentPath, '/api/identify');
    expect(sentBody, {'label': 'cup', 'score': 0.8, 'image_b64': 'BBBB', 'provider': 'gemini'});
    expect(result!.name, 'Mug');
    expect(result.label, 'cup');
  });

  test('sendChatMessage sends ChatRequest and reads {answer, model_used}', () async {
    final api = serviceReturning({'answer': 'Yes.', 'model_used': 'Offline Smart Assistant'});
    final reply = await api.sendChatMessage(
      question: 'Is it dishwasher safe?',
      objectContext: {'name': 'Mug'},
      history: [ChatMessage(role: ChatRole.user, content: 'What is it made of?')],
      provider: 'ollama',
    );
    expect(sentPath, '/api/chat');
    expect(sentBody, {
      'object_context': {'name': 'Mug'},
      'question': 'Is it dishwasher safe?',
      'history': [
        {'role': 'user', 'content': 'What is it made of?'},
      ],
      'provider': 'ollama',
    });
    expect(reply!.answer, 'Yes.');
    expect(reply.modelUsed, 'Offline Smart Assistant');
  });

  test('postEvent sends DetectionEvent to /api/events (KAN-91)', () async {
    final api = serviceReturning({'id': 7, 'status': 'queued', 'detail': 'workflows: identify_object'});
    final res = await api.postEvent(
      detection: DetectedObject(
        label: 'cup',
        confidence: 0.87,
        box2d: const Box2D(ymin: -0.01, xmin: 0.1, ymax: 0.6, xmax: 1.02),
      ),
      source: 'flutter-web',
      clientId: 'device-1',
      imageB64: 'CCCC',
      provider: 'mock',
    );
    expect(sentPath, '/api/events');
    expect(sentBody, {
      'type': 'object_appeared',
      'label': 'cup',
      'confidence': 0.87,
      'box': {'xmin': 0.1, 'ymin': 0.0, 'xmax': 1.0, 'ymax': 0.6}, // clamped to the schema's 0..1
      'image_b64': 'CCCC',
      'source': 'flutter-web',
      'client_id': 'device-1',
      'provider': 'mock',
    });
    expect(res!['status'], 'queued');
  });

  test('getProviders parses {available: [...]}', () async {
    final client = MockClient((_) async => http.Response(
        jsonEncode({'current': 'ollama', 'available': ['ollama', 'gemini', 'mock'], 'has_gemini_key': false}), 200));
    final providers = await ApiService(baseUrl: 'http://backend.test', client: client).getProviders();
    expect(providers.map((p) => p.id), ['ollama', 'gemini', 'mock']);
    expect(providers.firstWhere((p) => p.id == 'gemini').available, isFalse);
  });
}
