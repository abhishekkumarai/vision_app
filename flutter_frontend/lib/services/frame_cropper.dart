// Traceability: KAN-77
import 'dart:typed_data';
import 'package:image/image.dart' as img;
import '../models/detection.dart';

/// Crops [box] (normalized 0..1) out of an encoded camera frame, padded by
/// [padding] of the box size on each side, and re-encodes it as JPEG — the
/// same snapshot the Next.js client sends to `/api/identify` as `image_b64`.
/// Returns null if the frame can't be decoded or the crop is empty.
Uint8List? cropDetection(Uint8List frameBytes, Box2D box, {double padding = 0.15}) {
  final frame = img.decodeImage(frameBytes);
  if (frame == null) return null;

  final padX = box.width * padding;
  final padY = box.height * padding;
  final left = ((box.xmin - padX).clamp(0.0, 1.0) * frame.width).round();
  final top = ((box.ymin - padY).clamp(0.0, 1.0) * frame.height).round();
  final right = ((box.xmax + padX).clamp(0.0, 1.0) * frame.width).round();
  final bottom = ((box.ymax + padY).clamp(0.0, 1.0) * frame.height).round();
  if (right - left < 2 || bottom - top < 2) return null;

  final crop = img.copyCrop(frame, x: left, y: top, width: right - left, height: bottom - top);
  return img.encodeJpg(crop, quality: 85);
}
