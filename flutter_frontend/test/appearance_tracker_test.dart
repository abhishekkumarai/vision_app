// Traceability: KAN-91
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_frontend/models/detection.dart';
import 'package:flutter_frontend/services/appearance_tracker.dart';

DetectedObject det(String label, [double c = 0.8]) =>
    DetectedObject(label: label, confidence: c, box2d: const Box2D(ymin: 0.1, xmin: 0.1, ymax: 0.5, xmax: 0.5));

void main() {
  final t0 = DateTime(2026, 9, 24, 12);
  DateTime at(int ms) => t0.add(Duration(milliseconds: ms));

  test('emits once a label has been stable for 700ms', () {
    final tracker = AppearanceTracker();
    expect(tracker.update([det('cup')], at(0)), isEmpty);
    expect(tracker.update([det('cup')], at(400)), isEmpty);
    expect(tracker.update([det('cup')], at(700)).map((d) => d.label), ['cup']);
    // Still in view: no repeat within the cooldown.
    expect(tracker.update([det('cup')], at(1000)), isEmpty);
  });

  test('flicker resets the stability timer', () {
    final tracker = AppearanceTracker();
    tracker.update([det('cup')], at(0));
    tracker.update([], at(100));
    tracker.update([], at(700)); // gone > 500ms -> reset
    expect(tracker.update([det('cup')], at(800)), isEmpty);
    expect(tracker.update([det('cup')], at(1500)).length, 1);
  });

  test('short gaps do not reset the timer', () {
    final tracker = AppearanceTracker();
    tracker.update([det('cup')], at(0));
    tracker.update([], at(300));
    expect(tracker.update([det('cup')], at(700)).length, 1);
  });

  test('cooldown allows a new event after 30s and picks the best duplicate', () {
    final tracker = AppearanceTracker();
    tracker.update([det('cup')], at(0));
    expect(tracker.update([det('cup')], at(700)).length, 1);
    tracker.update([det('cup')], at(20000));
    final again = tracker.update([det('cup', 0.6), det('cup', 0.9)], at(31000));
    expect(again.single.confidence, 0.9);
  });

  test('labels are tracked independently', () {
    final tracker = AppearanceTracker();
    tracker.update([det('cup')], at(0));
    tracker.update([det('cup'), det('laptop')], at(500));
    expect(tracker.update([det('cup'), det('laptop')], at(700)).map((d) => d.label), ['cup']);
    expect(tracker.update([det('cup'), det('laptop')], at(1200)).map((d) => d.label), ['laptop']);
  });
}
