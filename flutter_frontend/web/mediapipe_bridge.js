// On-device object detection for Flutter web (KAN-92).
// Runs the same MediaPipe EfficientDet-Lite0 detector as the Next.js client on the
// live camera <video> published by the patched camera_web plugin
// (window.__flutterCameraVideo). Called from Dart via
// lib/services/platform_services_web.dart. Results use the backend's
// /api/detect response shape so the Dart side reuses DetectionResponse.fromJson.
import {
  FilesetResolver,
  ObjectDetector,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite";

let detector = null;
let initPromise = null;
let lastTimestamp = -1;

async function create(delegate) {
  const files = await FilesetResolver.forVisionTasks(WASM);
  return ObjectDetector.createFromOptions(files, {
    baseOptions: { modelAssetPath: MODEL, delegate },
    scoreThreshold: 0.3,
    maxResults: 6,
    runningMode: "VIDEO",
  });
}

function video() {
  const v = window.__flutterCameraVideo;
  return v && v.readyState >= 2 && v.videoWidth > 0 ? v : null;
}

window.visionBridge = {
  /** Resolves true once the detector is ready (GPU, falling back to CPU), false on failure. */
  init() {
    initPromise ??= create("GPU")
      .catch(() => create("CPU"))
      .then((d) => {
        detector = d;
        return true;
      })
      .catch((err) => {
        console.warn("[visionBridge] MediaPipe unavailable:", err);
        return false;
      });
    return initPromise;
  },

  /** JSON string in /api/detect shape, or null if no frame is ready. */
  detect(threshold) {
    const v = video();
    if (!detector || !v) return null;
    let ts = performance.now();
    if (ts <= lastTimestamp) ts = lastTimestamp + 1; // detectForVideo needs increasing timestamps
    lastTimestamp = ts;
    const t0 = performance.now();
    const res = detector.detectForVideo(v, ts);
    const detections = (res.detections || [])
      .map((d) => ({
        label: d.categories?.[0]?.categoryName || "object",
        score: d.categories?.[0]?.score || 0,
        bounding_box: {
          origin_x: d.boundingBox?.originX || 0,
          origin_y: d.boundingBox?.originY || 0,
          width: d.boundingBox?.width || 0,
          height: d.boundingBox?.height || 0,
        },
      }))
      .filter((d) => d.score >= threshold);
    return JSON.stringify({
      detections,
      count: detections.length,
      processing_time_ms: performance.now() - t0,
      image_width: v.videoWidth,
      image_height: v.videoHeight,
    });
  },

  /** JPEG data URL of a normalized box (+padding) cut from the current frame, or null. */
  crop(xmin, ymin, xmax, ymax, padding) {
    const v = video();
    if (!v) return null;
    const bw = xmax - xmin;
    const bh = ymax - ymin;
    const x0 = Math.max(0, xmin - bw * padding) * v.videoWidth;
    const y0 = Math.max(0, ymin - bh * padding) * v.videoHeight;
    const x1 = Math.min(1, xmax + bw * padding) * v.videoWidth;
    const y1 = Math.min(1, ymax + bh * padding) * v.videoHeight;
    if (x1 - x0 < 2 || y1 - y0 < 2) return null;
    const c = document.createElement("canvas");
    c.width = Math.round(x1 - x0);
    c.height = Math.round(y1 - y0);
    c.getContext("2d").drawImage(v, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  },
};
