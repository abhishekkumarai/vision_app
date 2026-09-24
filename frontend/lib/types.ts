/** Mirrors backend/schemas.py. */
export interface BoundingBox {
  origin_x: number;
  origin_y: number;
  width: number;
  height: number;
}

export interface ObjectInsights {
  name: string;
  category: string;
  summary: string;
  primary_uses: string[];
  materials_and_specs: string[];
  safety_and_maintenance: string[];
  fun_facts: string[];
  suggested_questions: string[];
  model_used: string;
}

export interface HealthData {
  status: string;
  version: string;
  llm_provider: string;
  mediapipe_ready: boolean;
  gpu_available: boolean;
  gpu_name?: string | null;
}

export interface ProvidersData {
  current: string;
  available: string[];
  ollama_model: string;
  gemini_model: string;
  has_gemini_key: boolean;
}

/** Normalized (0..1) box, same convention as the Flutter client's Box2D. */
export interface Box2D {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface Detection {
  label: string;
  confidence: number;
  box: Box2D;
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: number;
  role: ChatRole;
  content: string;
  /** model_used for assistant replies */
  provider?: string;
}

export type LlmProvider = "ollama" | "gemini" | "mock";

export interface Settings {
  provider: LlmProvider;
  /** Minimum detection confidence shown (0..1). */
  threshold: number;
  /** Interval for the server-side detection fallback, in ms. */
  detectIntervalMs: number;
  /** Send debounced object_appeared events to /api/events (KAN-91). */
  sendEvents: boolean;
}

export type DetectionEngine = "loading" | "browser" | "server";
