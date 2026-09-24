/**
 * Backend client. All calls go through the same-origin `/api/*` proxy
 * (app/api/[...path]/route.ts → FastAPI). Request/response shapes follow
 * backend/schemas.py and are pinned by tests/test_contract.py.
 */
import type { BoundingBox, ChatMessage, Detection, HealthData, ObjectInsights, ProvidersData } from "./types";

export interface EventAccepted {
  id: number | null;
  status: "queued" | "deduplicated" | string;
  detail?: string | null;
}

async function postJson<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchHealth(): Promise<HealthData | null> {
  try {
    const res = await fetch("/api/health", { signal: AbortSignal.timeout(4000) });
    return res.ok ? ((await res.json()) as HealthData) : null;
  } catch {
    return null;
  }
}

export async function fetchProviders(): Promise<ProvidersData | null> {
  try {
    const res = await fetch("/api/providers", { signal: AbortSignal.timeout(4000) });
    return res.ok ? ((await res.json()) as ProvidersData) : null;
  } catch {
    return null;
  }
}

interface DetectResponse {
  detections: { label: string; score: number; bounding_box: BoundingBox }[];
  count: number;
  processing_time_ms: number;
  image_width: number;
  image_height: number;
}

/** Server-side MediaPipe; used only when in-browser MediaPipe can't load. */
export async function detectOnServer(
  imageB64: string,
  threshold: number,
): Promise<{ detections: Detection[]; inferenceMs: number }> {
  const data = await postJson<DetectResponse>("/api/detect", { image_b64: imageB64, threshold }, 6000);
  const w = data.image_width || 1;
  const h = data.image_height || 1;
  return {
    inferenceMs: data.processing_time_ms,
    detections: data.detections.map((d) => ({
      label: d.label,
      confidence: d.score,
      box: {
        xmin: d.bounding_box.origin_x / w,
        ymin: d.bounding_box.origin_y / h,
        xmax: (d.bounding_box.origin_x + d.bounding_box.width) / w,
        ymax: (d.bounding_box.origin_y + d.bounding_box.height) / h,
      },
    })),
  };
}

export function identifyObject(args: {
  label: string;
  score: number;
  imageB64: string | null;
  provider: string;
}): Promise<ObjectInsights> {
  return postJson<ObjectInsights>(
    "/api/identify",
    { label: args.label, score: args.score, image_b64: args.imageB64, provider: args.provider },
    30000,
  );
}

export function sendChat(args: {
  question: string;
  objectContext: Record<string, unknown>;
  history: ChatMessage[];
  provider: string;
}): Promise<{ answer: string; model_used: string }> {
  return postJson(
    "/api/chat",
    {
      object_context: args.objectContext,
      question: args.question,
      history: args.history.map(({ role, content }) => ({ role, content })),
      provider: args.provider,
    },
    30000,
  );
}

/** Fire a detection event into the server workflow engine (KAN-89/91). */
export function postEvent(args: {
  detection: Detection;
  imageB64: string | null;
  source: string;
  clientId: string;
  provider: string;
}): Promise<EventAccepted> {
  const { detection: d } = args;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return postJson<EventAccepted>(
    "/api/events",
    {
      type: "object_appeared",
      label: d.label,
      confidence: clamp(d.confidence),
      box: { xmin: clamp(d.box.xmin), ymin: clamp(d.box.ymin), xmax: clamp(d.box.xmax), ymax: clamp(d.box.ymax) },
      image_b64: args.imageB64,
      source: args.source,
      client_id: args.clientId,
      provider: args.provider,
    },
    8000,
  );
}
