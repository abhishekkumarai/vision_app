"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Camera, CameraOff, Sparkles, Target } from "lucide-react";
import { DetectionItem } from "@/lib/types";
import { HUDDrawer } from "@/lib/hud";

interface CameraViewfinderProps {
  onDetectionsUpdate: (detections: DetectionItem[]) => void;
  onLockedTargetChange: (target: DetectionItem | null) => void;
  onEngineReady: (modeText: string) => void;
  onInspect: (target: DetectionItem, cropB64: string | null) => void;
  isIdentifying: boolean;
}

export const CameraViewfinder: React.FC<CameraViewfinderProps> = ({
  onDetectionsUpdate,
  onLockedTargetChange,
  onEngineReady,
  onInspect,
  isIdentifying,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [autoLock, setAutoLock] = useState(true);
  const [lockedTarget, setLockedTarget] = useState<DetectionItem | null>(null);

  const detectorRef = useRef<any>(null);
  const hudDrawerRef = useRef<HUDDrawer | null>(null);
  const lastTimeRef = useRef<number>(-1);
  const detectionsRef = useRef<DetectionItem[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize MediaPipe Object Detector
  useEffect(() => {
    let active = true;

    async function initDetector() {
      try {
        const { FilesetResolver, ObjectDetector } = await import(
          "@mediapipe/tasks-vision"
        );
        const wasmFileset = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );

        if (!active) return;

        const detector = await ObjectDetector.createFromOptions(wasmFileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite",
            delegate: "GPU",
          },
          scoreThreshold: 0.45,
          runningMode: "VIDEO",
          maxResults: 6,
        });

        if (!active) return;
        detectorRef.current = detector;
        onEngineReady("MediaPipe: WebAssembly/GPU");
      } catch (err) {
        console.warn("Client MediaPipe initialization error:", err);
        onEngineReady("MediaPipe: FastAPI PyTask");
      }
    }

    initDetector();
    return () => {
      active = false;
    };
  }, [onEngineReady]);

  // Canvas HUD setup
  useEffect(() => {
    if (canvasRef.current) {
      hudDrawerRef.current = new HUDDrawer(canvasRef.current);
    }
  }, []);

  // Update locked target parent notifier
  useEffect(() => {
    onLockedTargetChange(lockedTarget);
  }, [lockedTarget, onLockedTargetChange]);

  // Crop bounding box helper
  const cropBoundingBox = useCallback(
    (box: DetectionItem["bounding_box"], paddingPercent: number = 0.15): string | null => {
      const video = videoRef.current;
      if (!box || !video || !video.videoWidth) return null;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
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
      if (!ctx) return null;

      ctx.drawImage(video, x, y, w, h, 0, 0, w, h);
      return cropCanvas.toDataURL("image/jpeg", 0.85);
    },
    []
  );

  // Animation render loop
  useEffect(() => {
    let animId: number;

    const render = (timestamp: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const drawer = hudDrawerRef.current;
      const detector = detectorRef.current;

      if (isRunning && video && canvas && drawer) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }

        drawer.clear();
        drawer.drawGrid();

        if (detector && video.currentTime !== lastTimeRef.current) {
          lastTimeRef.current = video.currentTime;
          try {
            const results = detector.detectForVideo(video, timestamp);
            if (results && results.detections) {
              const parsed: DetectionItem[] = results.detections.map((d: any) => {
                const cat = d.categories[0] || {};
                const b = d.boundingBox || {};
                return {
                  label: cat.categoryName || "object",
                  score: cat.score || 0,
                  bounding_box: {
                    origin_x: b.originX || 0,
                    origin_y: b.originY || 0,
                    width: b.width || 0,
                    height: b.height || 0,
                  },
                };
              });

              detectionsRef.current = parsed;
              onDetectionsUpdate(parsed);

              // Auto-lock highest scoring object
              if (autoLock && parsed.length > 0) {
                let best = parsed[0];
                for (const item of parsed) {
                  if (item.score > best.score) best = item;
                }
                setLockedTarget(best);
              } else if (autoLock && parsed.length === 0) {
                setLockedTarget(null);
              }
            }
          } catch (e) {
            // Drop frame gracefully
          }
        }

        // Draw bounding boxes
        detectionsRef.current.forEach((det) => {
          const isLocked = lockedTarget ? lockedTarget.label === det.label : false;
          drawer.drawDetection(det.bounding_box, det.label, det.score, isLocked);
        });
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, autoLock, lockedTarget, onDetectionsUpdate]);

  // Start Camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "environment",
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
              resolve();
            };
          }
        });
      }

      streamRef.current = stream;
      setIsRunning(true);
    } catch (err: any) {
      alert("Camera error: " + err.message + "\nPlease allow camera permissions.");
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (hudDrawerRef.current) {
      hudDrawerRef.current.clear();
    }
    setIsRunning(false);
    setLockedTarget(null);
    detectionsRef.current = [];
    onDetectionsUpdate([]);
  };

  // Canvas click to lock specific detection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    for (const det of detectionsRef.current) {
      const b = det.bounding_box;
      if (
        clickX >= b.origin_x &&
        clickX <= b.origin_x + b.width &&
        clickY >= b.origin_y &&
        clickY <= b.origin_y + b.height
      ) {
        setAutoLock(false);
        setLockedTarget(det);
        return;
      }
    }
  };

  const handleInspectClick = () => {
    if (!lockedTarget) return;
    const cropB64 = cropBoundingBox(lockedTarget.bounding_box);
    onInspect(lockedTarget, cropB64);
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* Video Viewfinder Container */}
      <div className="relative bg-slate-950 border border-cyan-900/40 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center min-h-[440px] aspect-video">
        <div className="hud-scanline" />

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform scale-x-[-1]"
        />

        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="absolute inset-0 w-full h-full pointer-events-auto cursor-crosshair transform scale-x-[-1]"
        />

        {/* HUD Metadata Overlay */}
        <div className="absolute top-4 left-4 pointer-events-none flex flex-col space-y-1">
          <div className="text-[11px] font-mono text-cyan-400 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded border border-cyan-800/40">
            OPTICAL FEED: 1280x720 60FPS
          </div>
          <div className="text-[9px] font-mono text-slate-400 bg-black/40 px-2 py-0.5 rounded">
            CLICK ON ANY BOUNDING BOX TO LOCK
          </div>
        </div>

        <div className="absolute top-4 right-4 pointer-events-none">
          <div className="w-8 h-8 rounded-full border border-cyan-500/30 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          </div>
        </div>
      </div>

      {/* Control Action Bar */}
      <div className="bg-slate-950/90 border border-slate-800/80 backdrop-blur-md p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center space-x-2.5">
          {isRunning ? (
            <button
              onClick={stopCamera}
              className="px-4 py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-600/70 text-rose-200 text-sm font-semibold rounded-lg shadow-lg flex items-center transition-all"
            >
              <CameraOff className="w-4 h-4 mr-2 text-rose-400" />
              Stop Camera
            </button>
          ) : (
            <button
              onClick={startCamera}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-sm rounded-lg shadow-lg shadow-cyan-500/20 flex items-center transition-all"
            >
              <Camera className="w-4 h-4 mr-2" />
              Start Camera
            </button>
          )}

          <button
            onClick={() => setAutoLock((prev) => !prev)}
            className={`px-3 py-2 text-xs font-mono rounded-lg transition-all flex items-center space-x-1.5 ${
              autoLock
                ? "bg-emerald-950/80 border border-emerald-600 text-emerald-300"
                : "bg-slate-800 border border-slate-700 text-slate-400"
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>AUTO-LOCK: {autoLock ? "ON" : "OFF"}</span>
          </button>
        </div>

        <button
          onClick={handleInspectClick}
          disabled={!lockedTarget || isIdentifying}
          className={`px-5 py-2.5 text-slate-950 font-extrabold text-sm rounded-lg shadow-lg flex items-center transition-all ${
            lockedTarget && !isIdentifying
              ? "bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 shadow-cyan-500/30 cursor-pointer"
              : "opacity-50 cursor-not-allowed bg-slate-700 text-slate-400"
          }`}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          INSPECT WITH LLM
        </button>
      </div>
    </div>
  );
};
