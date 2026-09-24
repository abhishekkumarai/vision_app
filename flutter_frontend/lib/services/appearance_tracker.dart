// Traceability: KAN-91
// Turns a per-frame detection stream into discrete "object_appeared" events.
// Time-based, so it behaves the same at 30 fps (on-device) and ~3 fps (server).
// Same rules as frontend/lib/events.ts.
import '../models/detection.dart';

class AppearanceTracker {
  /// Label must be continuously present this long before it counts.
  final Duration stable;

  /// A gap longer than this resets the "continuously present" timer.
  final Duration gap;

  /// Minimum time between two events for the same label.
  final Duration cooldown;

  final Map<String, DateTime> _firstSeen = {};
  final Map<String, DateTime> _lastSeen = {};
  final Map<String, DateTime> _lastEmitted = {};

  AppearanceTracker({
    this.stable = const Duration(milliseconds: 700),
    this.gap = const Duration(milliseconds: 500),
    this.cooldown = const Duration(seconds: 30),
  });

  /// Returns the detections that just became events (best-scoring one per label).
  List<DetectedObject> update(List<DetectedObject> detections, DateTime now) {
    final best = <String, DetectedObject>{};
    for (final d in detections) {
      final cur = best[d.label];
      if (cur == null || d.confidence > cur.confidence) best[d.label] = d;
    }

    for (final label in _lastSeen.keys.toList()) {
      if (!best.containsKey(label) && now.difference(_lastSeen[label]!) > gap) {
        _firstSeen.remove(label);
        _lastSeen.remove(label);
      }
    }

    final emitted = <DetectedObject>[];
    best.forEach((label, d) {
      final first = _firstSeen.putIfAbsent(label, () => now);
      _lastSeen[label] = now;
      final isStable = now.difference(first) >= stable;
      final last = _lastEmitted[label];
      final cooled = last == null || now.difference(last) >= cooldown;
      if (isStable && cooled) {
        _lastEmitted[label] = now;
        emitted.add(d);
      }
    });
    return emitted;
  }

  void reset() {
    _firstSeen.clear();
    _lastSeen.clear();
  }
}
