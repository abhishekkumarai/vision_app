// Traceability: KAN-60
import 'package:flutter/material.dart';
import '../models/detection.dart';

class BoundingBoxPainter extends CustomPainter {
  final List<DetectedObject> detections;
  final DetectedObject? selectedObject;
  final double videoAspectRatio;
  final BoxFit fit;

  BoundingBoxPainter({
    required this.detections,
    this.selectedObject,
    this.videoAspectRatio = 16 / 9,
    this.fit = BoxFit.contain,
  });

  static Rect calculateRenderedRect(Size containerSize, double videoAspectRatio, BoxFit fit) {
    final containerRatio = containerSize.width / containerSize.height;
    if (fit == BoxFit.cover) {
      if (containerRatio > videoAspectRatio) {
        final h = containerSize.width / videoAspectRatio;
        final top = (containerSize.height - h) / 2;
        return Rect.fromLTWH(0, top, containerSize.width, h);
      } else {
        final w = containerSize.height * videoAspectRatio;
        final left = (containerSize.width - w) / 2;
        return Rect.fromLTWH(left, 0, w, containerSize.height);
      }
    } else {
      // BoxFit.contain
      if (containerRatio > videoAspectRatio) {
        final w = containerSize.height * videoAspectRatio;
        final left = (containerSize.width - w) / 2;
        return Rect.fromLTWH(left, 0, w, containerSize.height);
      } else {
        final h = containerSize.width / videoAspectRatio;
        final top = (containerSize.height - h) / 2;
        return Rect.fromLTWH(0, top, containerSize.width, h);
      }
    }
  }

  static Rect mapBoxToContainer(Box2D box, Rect videoRect) {
    return Rect.fromLTRB(
      videoRect.left + (box.xmin * videoRect.width),
      videoRect.top + (box.ymin * videoRect.height),
      videoRect.left + (box.xmax * videoRect.width),
      videoRect.top + (box.ymax * videoRect.height),
    );
  }

  static DetectedObject? findTappedObject({
    required Offset tapOffset,
    required Size containerSize,
    required List<DetectedObject> detections,
    double videoAspectRatio = 16 / 9,
    BoxFit fit = BoxFit.contain,
  }) {
    final videoRect = calculateRenderedRect(containerSize, videoAspectRatio, fit);
    // Iterate in reverse so top-most visually drawn box is selected first
    for (int i = detections.length - 1; i >= 0; i--) {
      final detection = detections[i];
      final boxRect = mapBoxToContainer(detection.box2d, videoRect);
      // Add slight padding for easier mobile touch targets
      if (boxRect.inflate(12.0).contains(tapOffset)) {
        return detection;
      }
    }
    return null;
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (detections.isEmpty) return;

    final videoRect = calculateRenderedRect(size, videoAspectRatio, fit);

    for (final detection in detections) {
      final isSelected = selectedObject != null &&
          selectedObject!.label == detection.label &&
          (selectedObject!.box2d.xmin - detection.box2d.xmin).abs() < 0.05;

      final rect = mapBoxToContainer(detection.box2d, videoRect);

      // Colors
      final Color primaryColor = isSelected ? const Color(0xFF10B981) : const Color(0xFF06B6D4);
      final Color glowColor = isSelected
          ? const Color(0xFF10B981).withOpacity(0.3)
          : const Color(0xFF06B6D4).withOpacity(0.15);

      // 1. Semi-transparent background fill
      final fillPaint = Paint()
        ..color = glowColor
        ..style = PaintingStyle.fill;
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect, const Radius.circular(8)),
        fillPaint,
      );

      // 2. Neon stroke border
      final strokePaint = Paint()
        ..color = primaryColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = isSelected ? 3.0 : 2.0;
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect, const Radius.circular(8)),
        strokePaint,
      );

      // 3. Corner bracket accents for futuristic HUD look
      final bracketPaint = Paint()
        ..color = isSelected ? const Color(0xFF34D399) : Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.5
        ..strokeCap = StrokeCap.round;

      const bracketLen = 14.0;
      // Top-left
      canvas.drawLine(Offset(rect.left, rect.top + bracketLen), Offset(rect.left, rect.top), bracketPaint);
      canvas.drawLine(Offset(rect.left, rect.top), Offset(rect.left + bracketLen, rect.top), bracketPaint);
      // Top-right
      canvas.drawLine(Offset(rect.right - bracketLen, rect.top), Offset(rect.right, rect.top), bracketPaint);
      canvas.drawLine(Offset(rect.right, rect.top), Offset(rect.right, rect.top + bracketLen), bracketPaint);
      // Bottom-left
      canvas.drawLine(Offset(rect.left, rect.bottom - bracketLen), Offset(rect.left, rect.bottom), bracketPaint);
      canvas.drawLine(Offset(rect.left, rect.bottom), Offset(rect.left + bracketLen, rect.bottom), bracketPaint);
      // Bottom-right
      canvas.drawLine(Offset(rect.right - bracketLen, rect.bottom), Offset(rect.right, rect.bottom), bracketPaint);
      canvas.drawLine(Offset(rect.right, rect.bottom), Offset(rect.right, rect.bottom - bracketLen), bracketPaint);

      // 4. Label badge above the box
      final labelText = '${detection.label.toUpperCase()} ${(detection.confidence * 100).toInt()}%';
      final textSpan = TextSpan(
        text: labelText,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      );
      final textPainter = TextPainter(
        text: textSpan,
        textDirection: TextDirection.ltr,
      )..layout();

      const paddingH = 8.0;
      const paddingV = 4.0;
      final badgeWidth = textPainter.width + (paddingH * 2);
      final badgeHeight = textPainter.height + (paddingV * 2);

      // Position badge: prefer above rect, if no room place inside top
      double badgeY = rect.top - badgeHeight - 4;
      if (badgeY < videoRect.top) {
        badgeY = rect.top + 4;
      }
      final badgeX = rect.left.clamp(videoRect.left, (videoRect.right - badgeWidth).clamp(videoRect.left, double.infinity));

      final badgeRect = Rect.fromLTWH(badgeX, badgeY, badgeWidth, badgeHeight);
      final badgeBgPaint = Paint()
        ..color = isSelected ? const Color(0xFF047857) : const Color(0xFF0E7490)
        ..style = PaintingStyle.fill;

      canvas.drawRRect(
        RRect.fromRectAndRadius(badgeRect, const Radius.circular(5)),
        badgeBgPaint,
      );

      textPainter.paint(
        canvas,
        Offset(badgeRect.left + paddingH, badgeRect.top + paddingV),
      );
    }
  }

  @override
  bool shouldRepaint(covariant BoundingBoxPainter oldDelegate) {
    return oldDelegate.detections != detections ||
        oldDelegate.selectedObject != selectedObject ||
        oldDelegate.videoAspectRatio != videoAspectRatio ||
        oldDelegate.fit != fit;
  }
}
