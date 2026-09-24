// Traceability: KAN-63
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_frontend/models/detection.dart';
import 'package:flutter_frontend/widgets/bounding_box_painter.dart';

void main() {
  group('BoundingBoxPainter Geometry & Hit Testing', () {
    test('calculateRenderedRect contain mode', () {
      // 1000x500 container (ratio 2.0), video 16:9 (~1.777)
      // container is wider than video, so video fills height (500), width = 500 * (16/9)
      final rect = BoundingBoxPainter.calculateRenderedRect(
        const Size(1000, 500),
        16 / 9,
        BoxFit.contain,
      );
      expect(rect.height, 500.0);
      expect(rect.width, closeTo(500 * (16 / 9), 0.1));
      expect(rect.top, 0.0);
      expect(rect.left, greaterThan(0.0));
    });

    test('findTappedObject selects hit object', () {
      final obj1 = DetectedObject(
        label: 'cup',
        confidence: 0.90,
        box2d: const Box2D(ymin: 0.1, xmin: 0.1, ymax: 0.3, xmax: 0.3),
      );
      final obj2 = DetectedObject(
        label: 'bottle',
        confidence: 0.85,
        box2d: const Box2D(ymin: 0.6, xmin: 0.6, ymax: 0.9, xmax: 0.9),
      );

      final containerSize = const Size(800, 800);
      final videoAspectRatio = 1.0; // Square for simple mapping

      // Tap inside obj1
      final tapped1 = BoundingBoxPainter.findTappedObject(
        tapOffset: const Offset(160, 160), // 0.2, 0.2
        containerSize: containerSize,
        detections: [obj1, obj2],
        videoAspectRatio: videoAspectRatio,
      );
      expect(tapped1, isNotNull);
      expect(tapped1!.label, 'cup');

      // Tap inside obj2
      final tapped2 = BoundingBoxPainter.findTappedObject(
        tapOffset: const Offset(600, 600), // 0.75, 0.75
        containerSize: containerSize,
        detections: [obj1, obj2],
        videoAspectRatio: videoAspectRatio,
      );
      expect(tapped2, isNotNull);
      expect(tapped2!.label, 'bottle');

      // Tap empty space
      final tappedNone = BoundingBoxPainter.findTappedObject(
        tapOffset: const Offset(10, 700),
        containerSize: containerSize,
        detections: [obj1, obj2],
        videoAspectRatio: videoAspectRatio,
      );
      expect(tappedNone, isNull);
    });
  });
}
