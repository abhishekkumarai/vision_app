// Traceability: KAN-61
import 'dart:ui';

class Box2D {
  final double ymin;
  final double xmin;
  final double ymax;
  final double xmax;

  const Box2D({
    required this.ymin,
    required this.xmin,
    required this.ymax,
    required this.xmax,
  });

  factory Box2D.fromJson(List<dynamic> json) {
    if (json.length >= 4) {
      return Box2D(
        ymin: (json[0] as num).toDouble(),
        xmin: (json[1] as num).toDouble(),
        ymax: (json[2] as num).toDouble(),
        xmax: (json[3] as num).toDouble(),
      );
    }
    return const Box2D(ymin: 0, xmin: 0, ymax: 0, xmax: 0);
  }

  List<double> toJson() => [ymin, xmin, ymax, xmax];

  double get width => (xmax - xmin).abs();
  double get height => (ymax - ymin).abs();

  Rect toRect(Size containerSize) {
    return Rect.fromLTRB(
      xmin * containerSize.width,
      ymin * containerSize.height,
      xmax * containerSize.width,
      ymax * containerSize.height,
    );
  }
}

class DetectedObject {
  final String label;
  final double confidence;
  final Box2D box2d;

  DetectedObject({
    required this.label,
    required this.confidence,
    required this.box2d,
  });

  /// Parses a backend `DetectionItem` (`backend/schemas.py`): `score` plus a
  /// pixel-space `bounding_box`, normalized here against the analysed frame size.
  factory DetectedObject.fromJson(
    Map<String, dynamic> json, {
    required double imageWidth,
    required double imageHeight,
  }) {
    final b = json['bounding_box'] as Map<String, dynamic>? ?? const {};
    double px(String key) => (b[key] as num?)?.toDouble() ?? 0.0;
    final w = imageWidth > 0 ? imageWidth : 1.0;
    final h = imageHeight > 0 ? imageHeight : 1.0;
    final x = px('origin_x'), y = px('origin_y');
    return DetectedObject(
      label: json['label'] as String? ?? 'object',
      confidence: (json['score'] as num?)?.toDouble() ?? 0.0,
      box2d: Box2D(
        ymin: (y / h).clamp(0.0, 1.0),
        xmin: (x / w).clamp(0.0, 1.0),
        ymax: ((y + px('height')) / h).clamp(0.0, 1.0),
        xmax: ((x + px('width')) / w).clamp(0.0, 1.0),
      ),
    );
  }

  Map<String, dynamic> toJson() => {
        'label': label,
        'confidence': confidence,
        'box_2d': box2d.toJson(),
      };
}

class DetectionResponse {
  final List<DetectedObject> detections;
  final int count;
  final double inferenceTimeMs;

  DetectionResponse({
    required this.detections,
    required this.count,
    required this.inferenceTimeMs,
  });

  /// Parses the backend `DetectionResponse`
  /// (`{detections, count, processing_time_ms, image_width, image_height}`).
  factory DetectionResponse.fromJson(Map<String, dynamic> json) {
    final imageWidth = (json['image_width'] as num?)?.toDouble() ?? 0.0;
    final imageHeight = (json['image_height'] as num?)?.toDouble() ?? 0.0;
    final rawList = json['detections'] as List<dynamic>? ?? [];
    final detections = rawList
        .map((e) => DetectedObject.fromJson(
              e as Map<String, dynamic>,
              imageWidth: imageWidth,
              imageHeight: imageHeight,
            ))
        .toList();
    return DetectionResponse(
      detections: detections,
      count: json['count'] as int? ?? detections.length,
      inferenceTimeMs: (json['processing_time_ms'] as num?)?.toDouble() ?? 0.0,
    );
  }
}
