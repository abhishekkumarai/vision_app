/**
 * Turns a per-frame detection stream into discrete "object_appeared" events (KAN-91).
 * Time-based so it behaves the same at 30 fps (in-browser) and 3 fps (server fallback);
 * flutter_frontend/lib/services/appearance_tracker.dart implements the same rules.
 */
import type { Detection } from "./types";

export interface TrackerOptions {
  /** Label must be continuously present this long before it counts. */
  stableMs: number;
  /** A gap longer than this resets the "continuously present" timer. */
  gapMs: number;
  /** Minimum time between two events for the same label. */
  cooldownMs: number;
}

export const DEFAULT_TRACKER: TrackerOptions = { stableMs: 700, gapMs: 500, cooldownMs: 30_000 };

export class AppearanceTracker {
  private firstSeen = new Map<string, number>();
  private lastSeen = new Map<string, number>();
  private lastEmitted = new Map<string, number>();

  constructor(private opts: TrackerOptions = DEFAULT_TRACKER) {}

  /** Returns the detections that just became "appeared" events (best-scoring one per label). */
  update(detections: Detection[], now: number): Detection[] {
    const best = new Map<string, Detection>();
    for (const d of detections) {
      const cur = best.get(d.label);
      if (!cur || d.confidence > cur.confidence) best.set(d.label, d);
    }

    for (const label of Array.from(this.lastSeen.keys())) {
      if (!best.has(label) && now - (this.lastSeen.get(label) ?? 0) > this.opts.gapMs) {
        this.firstSeen.delete(label);
        this.lastSeen.delete(label);
      }
    }

    const emitted: Detection[] = [];
    best.forEach((d, label) => {
      if (!this.firstSeen.has(label)) this.firstSeen.set(label, now);
      this.lastSeen.set(label, now);
      const stable = now - (this.firstSeen.get(label) ?? now) >= this.opts.stableMs;
      const cooled = now - (this.lastEmitted.get(label) ?? -Infinity) >= this.opts.cooldownMs;
      if (stable && cooled) {
        this.lastEmitted.set(label, now);
        emitted.push(d);
      }
    });
    return emitted;
  }

  reset(): void {
    this.firstSeen.clear();
    this.lastSeen.clear();
  }
}

export function getClientId(): string {
  const KEY = "vision-ai-client-id";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "anonymous-browser";
  }
}
