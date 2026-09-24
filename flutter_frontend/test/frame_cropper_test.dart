// Traceability: KAN-77
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:flutter_frontend/models/detection.dart';
import 'package:flutter_frontend/services/frame_cropper.dart';

void main() {
  final frame = img.encodeJpg(img.Image(width: 200, height: 100));

  test('crops the padded box region out of the frame', () {
    const box = Box2D(ymin: 0.2, xmin: 0.25, ymax: 0.6, xmax: 0.75);
    final crop = img.decodeJpg(cropDetection(frame, box, padding: 0)!)!;
    expect(crop.width, 100);
    expect(crop.height, 40);
  });

  test('padding is clamped to the frame edges', () {
    const box = Box2D(ymin: 0.0, xmin: 0.0, ymax: 1.0, xmax: 1.0);
    final crop = img.decodeJpg(cropDetection(frame, box)!)!;
    expect(crop.width, 200);
    expect(crop.height, 100);
  });

  test('returns null for an empty box', () {
    expect(cropDetection(frame, const Box2D(ymin: 0.5, xmin: 0.5, ymax: 0.5, xmax: 0.5), padding: 0), isNull);
  });
}
