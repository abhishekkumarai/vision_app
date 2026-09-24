// Traceability: KAN-63
import 'dart:ui';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_frontend/models/detection.dart';
import 'package:flutter_frontend/models/identification.dart';
import 'package:flutter_frontend/models/chat.dart';
import 'package:flutter_frontend/models/app_settings.dart';

void main() {
  group('Box2D and Detection Models', () {
    test('Box2D parsed from JSON and calculates rect', () {
      final box = Box2D.fromJson([0.1, 0.2, 0.5, 0.8]);
      expect(box.ymin, 0.1);
      expect(box.xmin, 0.2);
      expect(box.ymax, 0.5);
      expect(box.xmax, 0.8);
      expect(box.width, closeTo(0.6, 0.001));
      expect(box.height, closeTo(0.4, 0.001));

      final rect = box.toRect(const Size(1000, 500));
      expect(rect.left, 200.0);
      expect(rect.top, 50.0);
      expect(rect.right, 800.0);
      expect(rect.bottom, 250.0);
    });

    test('DetectionResponse parses backend pixel boxes into normalized Box2D', () {
      // Shape of backend DetectionResponse (backend/schemas.py).
      final json = {
        'detections': [
          {
            'label': 'cell phone',
            'score': 0.94,
            'bounding_box': {'origin_x': 64, 'origin_y': 48, 'width': 320, 'height': 240},
          },
        ],
        'count': 1,
        'processing_time_ms': 18.5,
        'image_width': 640,
        'image_height': 480,
      };

      final response = DetectionResponse.fromJson(json);
      expect(response.count, 1);
      expect(response.inferenceTimeMs, 18.5);
      final d = response.detections.single;
      expect(d.label, 'cell phone');
      expect(d.confidence, 0.94);
      expect(d.box2d.xmin, closeTo(0.1, 1e-9));
      expect(d.box2d.ymin, closeTo(0.1, 1e-9));
      expect(d.box2d.xmax, closeTo(0.6, 1e-9));
      expect(d.box2d.ymax, closeTo(0.6, 1e-9));
    });
  });

  group('Identification and Chat Models', () {
    test('IdentifyResponse parses backend ObjectInsights', () {
      final json = {
        'name': 'Portable Laptop Computer',
        'category': 'Electronics',
        'summary': 'Portable personal computer.',
        'primary_uses': ['Work', 'Study'],
        'materials_and_specs': ['Aluminium chassis'],
        'safety_and_maintenance': ['Clean dust filters every 6 months'],
        'fun_facts': ['Laptops outsold desktops first in 2005'],
        'suggested_questions': ['How long does the battery last?'],
        'model_used': 'Ollama (gemma2:2b)',
      };

      final info = IdentifyResponse.fromJson(json, label: 'laptop', confidence: 0.92);
      expect(info.label, 'laptop');
      expect(info.confidence, 0.92);
      expect(info.name, 'Portable Laptop Computer');
      expect(info.primaryUses, ['Work', 'Study']);
      expect(info.safetyAndMaintenance.length, 1);
      expect(info.suggestedQuestions.single, 'How long does the battery last?');
      expect(info.modelUsed, 'Ollama (gemma2:2b)');
      // Round-trips to the ObjectInsights shape used as chat object_context.
      expect(info.toJson()['materials_and_specs'], ['Aluminium chassis']);
    });

    test('ChatMessage handles roles and serialization', () {
      final msg = ChatMessage(
        role: ChatRole.assistant,
        content: 'I see a laptop.',
        provider: 'ollama',
      );
      expect(msg.role, ChatRole.assistant);
      expect(msg.content, 'I see a laptop.');

      final json = msg.toJson();
      expect(json['role'], 'assistant');
      expect(json['content'], 'I see a laptop.');
    });

    test('AppSettings defaults and copyWith', () {
      final settings = AppSettings();
      expect(settings.confidenceThreshold, 0.45);
      expect(settings.detectIntervalMs, 350);

      final modified = settings.copyWith(confidenceThreshold: 0.60, detectIntervalMs: 500);
      expect(modified.confidenceThreshold, 0.60);
      expect(modified.detectIntervalMs, 500);
    });
  });
}
