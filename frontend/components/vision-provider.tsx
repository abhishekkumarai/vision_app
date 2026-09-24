"use client";

/**
 * App state — the React counterpart of flutter_frontend/lib/state/vision_provider.dart.
 * Camera lifecycle, detection loop (in-browser MediaPipe, server fallback),
 * virtual demo feed, identification and chat all live here so the desktop and
 * mobile layouts are thin views over the same state.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { detectOnServer, fetchHealth, fetchProviders, identifyObject, postEvent, sendChat } from "@/lib/api";
import { AppearanceTracker, getClientId } from "@/lib/events";
import type {
  ChatMessage,
  Detection,
  DetectionEngine,
  HealthData,
  ObjectInsights,
  ProvidersData,
  Settings,
} from "@/lib/types";

export type CameraStatus = "idle" | "starting" | "live" | "error";
export type View = "camera" | "intelligence" | "chat";

export interface Identification extends ObjectInsights {
  label: string;
  confidence: number;
}

interface VisionState {
  // backend
  health: HealthData | null;
  providers: ProvidersData | null;
  isBackendHealthy: boolean;
  // settings
  settings: Settings;
  updateSettings: (s: Settings) => void;
  // camera
  engine: DetectionEngine;
  cameraStatus: CameraStatus;
  cameraError: string | null;
  isDemoMode: boolean;
  isStreaming: boolean;
  deviceCount: number;
  attachVideo: (el: HTMLVideoElement | null) => void;
  videoAspect: number;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  switchCamera: () => Promise<void>;
  startDemo: () => void;
  stopDemo: () => void;
  // detection
  detections: Detection[];
  fps: number;
  inferenceMs: number;
  // selection / intelligence
  selected: Detection | null;
  snapshot: string | null;
  identification: Identification | null;
  isIdentifying: boolean;
  identificationError: string | null;
  selectObject: (d: Detection) => Promise<void>;
  // chat
  messages: ChatMessage[];
  isChatSending: boolean;
  sendMessage: (text: string) => Promise<void>;
  // navigation shared by desktop tabs and mobile bottom nav
  view: View;
  setView: (v: View) => void;
}

const VisionContext = createContext<VisionState | null>(null);

export function useVision(): VisionState {
  const ctx = useContext(VisionContext);
  if (!ctx) throw new Error("useVision must be used inside <VisionProvider>");
  return ctx;
}

const DEFAULT_SETTINGS: Settings = { provider: "ollama", threshold: 0.45, detectIntervalMs: 350, sendEvents: true };
const SETTINGS_KEY = "vision-ai-settings";

const WELCOME: ChatMessage = {
  id: 0,
  role: "assistant",
  content: "Hello! I am your AI Vision Assistant. Point your camera at any object or tap a detected box to inspect it.",
};

const DEMO_OBJECTS: Detection[] = [
  { label: "laptop", confidence: 0.94, box: { ymin: 0.35, xmin: 0.25, ymax: 0.85, xmax: 0.75 } },
  { label: "cell phone", confidence: 0.89, box: { ymin: 0.45, xmin: 0.08, ymax: 0.78, xmax: 0.22 } },
  { label: "cup", confidence: 0.82, box: { ymin: 0.28, xmin: 0.78, ymax: 0.58, xmax: 0.92 } },
];

export function friendlyCameraError(raw: string | null): string {
  if (!raw) return "";
  const err = raw.toLowerCase();
  if (err.includes("notreadable") || err.includes("could not start video source")) {
    return "The camera is busy or couldn't start. Another app (Teams, Zoom, another tab) may be holding it, or a virtual camera such as OBS isn't running. Close other camera apps and retry, or use the virtual demo feed.";
  }
  if (err.includes("notallowed") || err.includes("permission")) {
    return "Camera permission was not granted. Allow camera access from the address bar, then retry.";
  }
  if (err.includes("notfound") || err.includes("no camera")) {
    return "No camera was found on this device. Connect a webcam or use the virtual demo feed.";
  }
  if (err.includes("secure") || err.includes("mediadevices")) {
    return "Camera access needs a secure page (https:// or localhost).";
  }
  return raw;
}

function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Crops a normalized box (+15% padding) out of the current video frame as a JPEG data URL. */
function cropFromVideo(video: HTMLVideoElement, d: Detection, padding = 0.15): string | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const bw = d.box.xmax - d.box.xmin;
  const bh = d.box.ymax - d.box.ymin;
  const x0 = Math.max(0, d.box.xmin - bw * padding) * vw;
  const y0 = Math.max(0, d.box.ymin - bh * padding) * vh;
  const x1 = Math.min(1, d.box.xmax + bw * padding) * vw;
  const y1 = Math.min(1, d.box.ymax + bh * padding) * vh;
  if (x1 - x0 < 2 || y1 - y0 < 2) return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(x1 - x0);
  canvas.height = Math.round(y1 - y0);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, x0, y0, x1 - x0, y1 - y0, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function VisionProvider({ children }: { children: React.ReactNode }) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [providers, setProviders] = useState<ProvidersData | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const [engine, setEngine] = useState<DetectionEngine>("loading");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const [videoAspect, setVideoAspect] = useState(16 / 9);

  const [detections, setDetections] = useState<Detection[]>([]);
  const [fps, setFps] = useState(0);
  const [inferenceMs, setInferenceMs] = useState(0);

  const [selected, setSelected] = useState<Detection | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [identification, setIdentification] = useState<Identification | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identificationError, setIdentificationError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [isChatSending, setIsChatSending] = useState(false);
  const [view, setView] = useState<View>("camera");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const devicesRef = useRef<MediaDeviceInfo[]>([]);
  const deviceIndexRef = useRef(-1);
  const settingsRef = useRef(settings);
  const messagesRef = useRef(messages);
  const chatContextStartRef = useRef(0);
  const nextMsgId = useRef(1);
  const trackerRef = useRef(new AppearanceTracker());

  settingsRef.current = settings;
  messagesRef.current = messages;

  // ---- settings & backend -------------------------------------------------
  useEffect(() => setSettings(loadSettings()), []);

  const updateSettings = useCallback((s: Settings) => {
    setSettings(s);
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {
      /* private mode etc. — settings just won't persist */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      const h = await fetchHealth();
      if (alive) setHealth(h);
    };
    poll();
    fetchProviders().then((p) => alive && setProviders(p));
    const id = window.setInterval(poll, 15000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  // ---- in-browser MediaPipe (falls back to server-side detection) -------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { FilesetResolver, ObjectDetector } = await import("@mediapipe/tasks-vision");
        const files = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
        );
        const make = (delegate: "GPU" | "CPU") =>
          ObjectDetector.createFromOptions(files, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite",
              delegate,
            },
            scoreThreshold: 0.3,
            maxResults: 6,
            runningMode: "VIDEO",
          });
        const detector = await make("GPU").catch(() => make("CPU"));
        if (!alive) return;
        detectorRef.current = detector;
        setEngine("browser");
      } catch (err) {
        console.warn("[vision] in-browser MediaPipe unavailable, using server detection:", err);
        if (alive) setEngine("server");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ---- camera -------------------------------------------------------------
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => undefined);
    }
  }, []);

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  /** Opens a stream; on NotReadableError tries the other cameras (e.g. skips an idle OBS virtual camera). */
  const openStream = useCallback(async (preferredIndex: number): Promise<MediaStream> => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("SecureContextError: navigator.mediaDevices unavailable");
    const constraints = (deviceId?: string): MediaStreamConstraints => ({
      audio: false,
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
    });
    const devices = devicesRef.current;
    const order =
      preferredIndex >= 0 && devices.length
        ? devices.map((_, i) => (preferredIndex + i) % devices.length)
        : [-1, ...devices.map((_, i) => i)];
    let lastErr: unknown = null;
    for (const i of order) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints(i >= 0 ? devices[i].deviceId : undefined));
        if (i >= 0) deviceIndexRef.current = i;
        return stream;
      } catch (err) {
        lastErr = err;
        if (!(err instanceof DOMException && err.name === "NotReadableError")) break;
      }
    }
    throw lastErr;
  }, []);

  const goLive = useCallback(async (preferredIndex: number) => {
    setCameraStatus("starting");
    setCameraError(null);
    try {
      const stream = await openStream(preferredIndex);
      releaseStream();
      streamRef.current = stream;
      const all = await navigator.mediaDevices.enumerateDevices();
      devicesRef.current = all.filter((d) => d.kind === "videoinput" && d.deviceId);
      setDeviceCount(devicesRef.current.length);
      const trackId = stream.getVideoTracks()[0]?.getSettings().deviceId;
      const idx = devicesRef.current.findIndex((d) => d.deviceId === trackId);
      if (idx >= 0) deviceIndexRef.current = idx;
      const s = stream.getVideoTracks()[0]?.getSettings();
      if (s?.width && s?.height) setVideoAspect(s.width / s.height);
      attachVideo(videoRef.current);
      setCameraStatus("live");
    } catch (err) {
      const e = err as { name?: string; message?: string };
      setCameraError(`${e?.name ?? "Error"}: ${e?.message ?? String(err)}`);
      setCameraStatus("error");
    }
  }, [attachVideo, openStream]);

  const stopDemo = useCallback(() => {
    setIsDemoMode(false);
    setDetections([]);
    setFps(0);
  }, []);

  const startCamera = useCallback(async () => {
    setIsDemoMode(false);
    await goLive(deviceIndexRef.current);
  }, [goLive]);

  const stopCamera = useCallback(() => {
    releaseStream();
    setCameraStatus("idle");
    setDetections([]);
    setFps(0);
    setInferenceMs(0);
  }, []);

  const switchCamera = useCallback(async () => {
    if (devicesRef.current.length < 2) return;
    await goLive((deviceIndexRef.current + 1) % devicesRef.current.length);
  }, [goLive]);

  const startDemo = useCallback(() => {
    releaseStream();
    setCameraStatus("idle");
    setCameraError(null);
    setIsDemoMode(true);
  }, []);

  useEffect(() => () => releaseStream(), []);

  // ---- detection loops ----------------------------------------------------
  const isLive = cameraStatus === "live";

  // In-browser: run on every new video frame.
  useEffect(() => {
    if (!isLive || engine !== "browser") return;
    let raf = 0;
    let lastTime = -1;
    let frames = 0;
    let windowStart = performance.now();
    const tick = () => {
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (video && detector && video.readyState >= 2 && video.currentTime !== lastTime) {
        lastTime = video.currentTime;
        const t0 = performance.now();
        try {
          const res = detector.detectForVideo(video, t0);
          const vw = video.videoWidth || 1;
          const vh = video.videoHeight || 1;
          const threshold = settingsRef.current.threshold;
          const next: Detection[] = (res?.detections ?? [])
            .map((d: any) => {
              const b = d.boundingBox ?? {};
              const c = d.categories?.[0] ?? {};
              return {
                label: c.categoryName || "object",
                confidence: c.score ?? 0,
                box: {
                  xmin: (b.originX ?? 0) / vw,
                  ymin: (b.originY ?? 0) / vh,
                  xmax: ((b.originX ?? 0) + (b.width ?? 0)) / vw,
                  ymax: ((b.originY ?? 0) + (b.height ?? 0)) / vh,
                },
              };
            })
            .filter((d: Detection) => d.confidence >= threshold);
          setDetections(next);
          setInferenceMs(performance.now() - t0);
          frames++;
        } catch {
          /* drop frame */
        }
        const now = performance.now();
        if (now - windowStart >= 1000) {
          setFps((frames * 1000) / (now - windowStart));
          frames = 0;
          windowStart = now;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isLive, engine]);

  // Server fallback: sample a JPEG frame every detectIntervalMs.
  useEffect(() => {
    if (!isLive || engine !== "server") return;
    let busy = false;
    let frames = 0;
    let windowStart = performance.now();
    const canvas = document.createElement("canvas");
    const id = window.setInterval(async () => {
      const video = videoRef.current;
      if (busy || !video || !video.videoWidth) return;
      busy = true;
      try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0);
        const b64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
        const res = await detectOnServer(b64, settingsRef.current.threshold);
        setDetections(res.detections);
        setInferenceMs(res.inferenceMs);
        frames++;
        const now = performance.now();
        if (now - windowStart >= 1000) {
          setFps((frames * 1000) / (now - windowStart));
          frames = 0;
          windowStart = now;
        }
      } catch (err) {
        console.debug("[vision] server detect failed:", err);
      } finally {
        busy = false;
      }
    }, settings.detectIntervalMs);
    return () => window.clearInterval(id);
  }, [isLive, engine, settings.detectIntervalMs]);

  // Virtual demo feed: same scene and jitter as the Flutter client.
  useEffect(() => {
    if (!isDemoMode) return;
    let tick = 0;
    setDetections(DEMO_OBJECTS);
    setInferenceMs(14.8);
    setFps(28.5);
    const id = window.setInterval(() => {
      tick++;
      const jx = ((tick % 4) - 2) * 0.002;
      const jy = (((tick + 1) % 4) - 2) * 0.002;
      setDetections([
        { label: "laptop", confidence: 0.93 + (tick % 3) * 0.01, box: { ymin: 0.35 + jy, xmin: 0.25 + jx, ymax: 0.85 + jy, xmax: 0.75 + jx } },
        { label: "cell phone", confidence: 0.88 + ((tick + 1) % 3) * 0.01, box: { ymin: 0.45 - jy, xmin: 0.08 + jx, ymax: 0.78 - jy, xmax: 0.22 + jx } },
        { label: "cup", confidence: 0.82 + ((tick + 2) % 3) * 0.01, box: { ymin: 0.28 + jy, xmin: 0.78 - jx, ymax: 0.58 + jy, xmax: 0.92 - jx } },
      ]);
      setFps(27 + (tick % 4));
    }, 350);
    return () => window.clearInterval(id);
  }, [isDemoMode]);

  // ---- workflow events (KAN-91) -------------------------------------------
  // Each stable new object becomes one object_appeared event; the server runs workflows on it.
  useEffect(() => {
    if (!settings.sendEvents || !(isLive || isDemoMode)) return;
    const appeared = trackerRef.current.update(detections, performance.now());
    for (const d of appeared) {
      const crop = !isDemoMode && videoRef.current ? cropFromVideo(videoRef.current, d) : null;
      postEvent({
        detection: d,
        imageB64: crop,
        source: isDemoMode ? "nextjs-demo" : "nextjs",
        clientId: getClientId(),
        provider: settingsRef.current.provider,
      })
        .then((res) => {
          if (res.status === "queued") toast(`${d.label} detected`, { description: `Workflow queued · event #${res.id}` });
        })
        .catch((err) => console.debug("[vision] event not sent:", err));
    }
  }, [detections, settings.sendEvents, isLive, isDemoMode]);

  useEffect(() => {
    if (!isLive && !isDemoMode) trackerRef.current.reset();
  }, [isLive, isDemoMode]);

  // ---- intelligence & chat ---------------------------------------------
  const pushMessage = (m: Omit<ChatMessage, "id">) =>
    setMessages((prev) => [...prev, { ...m, id: nextMsgId.current++ }]);

  const selectObject = useCallback(async (d: Detection) => {
    setSelected(d);
    setIsIdentifying(true);
    setIdentificationError(null);
    const crop = !isDemoMode && videoRef.current ? cropFromVideo(videoRef.current, d) : null;
    setSnapshot(crop);
    try {
      const insights = await identifyObject({
        label: d.label,
        score: d.confidence,
        imageB64: crop,
        provider: settingsRef.current.provider,
      });
      setIdentification({ ...insights, label: d.label, confidence: d.confidence });
      chatContextStartRef.current = messagesRef.current.length;
      pushMessage({
        role: "assistant",
        content: `I identified a **${insights.name}** (${Math.round(d.confidence * 100)}% confidence). Ask me anything about its uses, specs, safety, or history!`,
        provider: insights.model_used,
      });
    } catch (err) {
      setIdentificationError(`Could not retrieve intelligence for ${d.label}. ${(err as Error).message}`);
    } finally {
      setIsIdentifying(false);
    }
  }, [isDemoMode]);

  const sendMessage = useCallback(async (text: string) => {
    const question = text.trim();
    if (!question || isChatSending) return;
    const history = messagesRef.current.slice(chatContextStartRef.current);
    pushMessage({ role: "user", content: question });
    setIsChatSending(true);
    try {
      const { label, confidence, ...insights } = identification ?? ({} as Identification);
      void label;
      void confidence;
      const reply = await sendChat({
        question,
        objectContext: identification ? insights : selected ? { name: selected.label } : {},
        history,
        provider: settingsRef.current.provider,
      });
      pushMessage({ role: "assistant", content: reply.answer, provider: reply.model_used });
    } catch (err) {
      pushMessage({ role: "assistant", content: `Couldn't reach the intelligence server. ${(err as Error).message}` });
    } finally {
      setIsChatSending(false);
    }
  }, [identification, isChatSending, selected]);

  const value = useMemo<VisionState>(() => ({
    health,
    providers,
    isBackendHealthy: health?.status === "healthy",
    settings,
    updateSettings,
    engine,
    cameraStatus,
    cameraError,
    isDemoMode,
    isStreaming: isLive || isDemoMode,
    deviceCount,
    attachVideo,
    videoAspect,
    startCamera,
    stopCamera,
    switchCamera,
    startDemo,
    stopDemo,
    detections,
    fps,
    inferenceMs,
    selected,
    snapshot,
    identification,
    isIdentifying,
    identificationError,
    selectObject,
    messages,
    isChatSending,
    sendMessage,
    view,
    setView,
  }), [
    health, providers, settings, updateSettings, engine, cameraStatus, cameraError, isDemoMode, isLive,
    deviceCount, attachVideo, videoAspect, startCamera, stopCamera, switchCamera, startDemo, stopDemo,
    detections, fps, inferenceMs, selected, snapshot, identification, isIdentifying, identificationError,
    selectObject, messages, isChatSending, sendMessage, view,
  ]);

  return <VisionContext.Provider value={value}>{children}</VisionContext.Provider>;
}
