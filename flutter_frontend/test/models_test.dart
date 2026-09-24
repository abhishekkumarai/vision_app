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

    test('DetectionResponse parsed from JSON', () {
      final json = {
        'detections': [
          {
            'label': 'cell phone',
            'confidence': 0.94,
            'box_2d': [0.1, 0.2, 0.6, 0.7],
          },
          {
            'label': 'laptop',
            'confidence': 0.88,
            'box_2d': [0.3, 0.4, 0.9, 0.95],
          }
        ],
        'count': 2,
        'inference_time_ms': 18.5,
      };

      final response = DetectionResponse.fromJson(json);
      expect(response.count, 2);
      expect(response.inferenceTimeMs, 18.5);
      expect(response.detections.length, 2);
      expect(response.detections.first.label, 'cell phone');
      expect(response.detections.first.confidence, 0.94);
    });
  });

  group('Identification and Chat Models', () {
    test('IdentifyResponse parses encyclopedic intelligence fields', () {
      final json = {
        'label': 'laptop',
        'identified_name': 'Portable Laptop Computer',
        'confidence': 0.92,
        'description': 'Portable personal computer.',
        'category': 'Electronics',
        'history': 'First modern laptop was Grid Compass.',
        'technical_specs': {'display': '15.6 inch', 'battery': '70Wh'},
        'fun_facts': ['Laptops outsold desktops first in 2005'],
        'maintenance_tips': ['Clean dust filters every 6 months'],
        'provider_used': 'ollama',
      };

      final info = IdentifyResponse.fromJson(json);
      expect(info.label, 'laptop');
      expect(info.identifiedName, 'Portable Laptop Computer');
      expect(info.category, 'Electronics');
      expect(info.technicalSpecs['display'], '15.6 inch');
      expect(info.funFacts.length, 1);
      expect(info.maintenanceTips.length, 1);
      expect(info.providerUsed, 'ollama');
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
