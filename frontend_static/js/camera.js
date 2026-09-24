/**
 * Camera Stream & MediaPipe Vision Manager
 * Traceability: Epic KAN-49, Task KAN-53
 */

class CameraManager {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.stream = null;
    this.isRunning = false;
    this.objectDetector = null;
    this.detections = [];
    this.lastVideoTime = -1;
    this.useClientMediaPipe = false;
    this.serverFallbackActive = false;
    this.fallbackInterval = null;
  }

  async initMediaPipe() {
    try {
      // Attempt loading @mediapipe/tasks-vision from CDN
      const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm");
      const { FilesetResolver, ObjectDetector } = vision;

      const wasmFileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );

      this.objectDetector = await ObjectDetector.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite",
          delegate: "GPU"
        },
        scoreThreshold: 0.45,
        runningMode: "VIDEO",
        maxResults: 6
      });

      this.useClientMediaPipe = true;
      console.log("[CameraManager] Client-side MediaPipe Tasks Vision initialized with GPU delegate!");
      return true;
    } catch (e) {
      console.warn("[CameraManager] Client-side MediaPipe initialization failed, switching to Server-side Detection:", e);
      this.useClientMediaPipe = false;
      return false;
    }
  }

  async startCamera() {
    if (this.isRunning) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "environment"
        },
        audio: false
      });

      this.video.srcObject = this.stream;
      await new Promise(resolve => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          resolve();
        };
      });

      this.isRunning = true;
      this.updateCanvasDimensions();

      // If client-side MediaPipe not available, activate periodic server-side detection fallback
      if (!this.useClientMediaPipe) {
        this.startServerFallback();
      }

      return true;
    } catch (err) {
      console.error("[CameraManager] Camera access error:", err);
      throw err;
    }
  }

  stopCamera() {
    this.isRunning = false;
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
  }

  updateCanvasDimensions() {
    if (this.video.videoWidth && this.video.videoHeight) {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
    }
  }

  processFrame(timestamp) {
    if (!this.isRunning || !this.useClientMediaPipe || !this.objectDetector) {
      return this.detections;
    }

    if (this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      try {
        const detectionResult = this.objectDetector.detectForVideo(this.video, timestamp);
        if (detectionResult && detectionResult.detections) {
          this.detections = detectionResult.detections.map(d => {
            const cat = d.categories[0] || {};
            const box = d.boundingBox || {};
            return {
              label: cat.categoryName || "object",
              score: cat.score || 0.0,
              bounding_box: {
                origin_x: box.originX || 0,
                origin_y: box.originY || 0,
                width: box.width || 0,
                height: box.height || 0
              }
            };
          });
        }
      } catch (err) {
        console.warn("[CameraManager] detectForVideo frame drop:", err);
      }
    }
    return this.detections;
  }

  startServerFallback() {
    if (this.fallbackInterval) return;
    this.fallbackInterval = setInterval(async () => {
      if (!this.isRunning || this.video.readyState < 2) return;
      try {
        const snapshotB64 = this.captureFullFrameBase64(0.6);
        const res = await fetch("/api/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_b64: snapshotB64 })
        });
        if (res.ok) {
          const data = await res.json();
          this.detections = data.detections || [];
        }
      } catch (e) {
        // Silently retry next interval
      }
    }, 350); // ~3 FPS server-side detection fallback
  }

  captureFullFrameBase64(quality = 0.8) {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = this.video.videoWidth || 640;
    tempCanvas.height = this.video.videoHeight || 480;
    const ctx = tempCanvas.getContext("2d");
    ctx.drawImage(this.video, 0, 0, tempCanvas.width, tempCanvas.height);
    return tempCanvas.toDataURL("image/jpeg", quality);
  }

  cropBoundingBox(box, paddingPercent = 0.15) {
    if (!box || !this.video.videoWidth) return null;
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;

    const padX = box.width * paddingPercent;
    const padY = box.height * paddingPercent;

    const x = Math.max(0, box.origin_x - padX);
    const y = Math.max(0, box.origin_y - padY);
    const w = Math.min(vw - x, box.width + padX * 2);
    const h = Math.min(vh - y, box.height + padY * 2);

    if (w <= 0 || h <= 0) return null;

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = w;
    cropCanvas.height = h;
    const ctx = cropCanvas.getContext("2d");
    ctx.drawImage(this.video, x, y, w, h, 0, 0, w, h);
    return cropCanvas.toDataURL("image/jpeg", 0.85);
  }
}

window.CameraManager = CameraManager;
