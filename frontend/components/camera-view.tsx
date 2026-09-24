"use client";

import { Camera, Loader2, RefreshCw, Square, SwitchCamera, VideoOff, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContainedFrame, DetectionOverlay } from "@/components/detection-overlay";
import { friendlyCameraError, useVision } from "@/components/vision-provider";

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-lg">{children}</div>
    </div>
  );
}

function IdleCard() {
  const { startCamera, startDemo, engine } = useVision();
  return (
    <CenterCard>
      <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
        <Camera className="size-7" />
      </div>
      <h2 className="text-lg font-semibold">Ready to Detect Objects</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Start the camera to stream your webcam, or try the virtual demo feed.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={startCamera}>
          <Camera /> Start Camera
        </Button>
        <Button variant="outline" className="border-success/60 text-success hover:bg-success/10 hover:text-success" onClick={startDemo}>
          <Bot /> Virtual Demo Stream
        </Button>
      </div>
      {engine === "server" && (
        <p className="mt-4 text-xs text-muted-foreground">
          In-browser MediaPipe couldn&apos;t load — detection will run on the server.
        </p>
      )}
    </CenterCard>
  );
}

function ErrorCard() {
  const { cameraError, startCamera, startDemo } = useVision();
  return (
    <CenterCard>
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-amber-500/10 text-amber-400">
        <VideoOff className="size-6" />
      </div>
      <h2 className="text-base font-semibold">Camera unavailable</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{friendlyCameraError(cameraError)}</p>
      <p className="mt-3 break-words rounded-md bg-background px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
        {cameraError}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Button variant="outline" onClick={startCamera}>
          <RefreshCw /> Retry Camera
        </Button>
        <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={startDemo}>
          <Bot /> Start Virtual Demo Feed
        </Button>
      </div>
    </CenterCard>
  );
}

function DemoScene() {
  return (
    <div className="viewfinder-grid absolute inset-0 border border-primary/30 bg-gradient-to-b from-card to-background">
      <div className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-primary/40" />
      <div className="absolute left-1/2 top-1/2 h-px w-[72px] -translate-x-1/2 bg-primary/40" />
      <div className="absolute left-1/2 top-1/2 h-[72px] w-px -translate-y-1/2 bg-primary/40" />
      <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md border border-primary bg-primary/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
        <span className="size-1.5 rounded-full bg-primary" /> Virtual demo stream · desk scene
      </span>
    </div>
  );
}

export function CameraView({ showControls = true }: { showControls?: boolean }) {
  const {
    cameraStatus,
    isDemoMode,
    detections,
    selected,
    selectObject,
    attachVideo,
    videoAspect,
    stopCamera,
    switchCamera,
    deviceCount,
    stopDemo,
    startCamera,
  } = useVision();

  const live = cameraStatus === "live";

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* The video element stays mounted so the stream survives state changes. */}
      <ContainedFrame aspect={isDemoMode ? 16 / 9 : videoAspect}>
        <video
          ref={attachVideo}
          autoPlay
          playsInline
          muted
          className={live && !isDemoMode ? "h-full w-full" : "hidden"}
        />
        {isDemoMode && <DemoScene />}
        {(live || isDemoMode) && (
          <DetectionOverlay detections={detections} selected={selected} onSelect={selectObject} />
        )}
      </ContainedFrame>

      {!live && !isDemoMode && cameraStatus === "idle" && <IdleCard />}
      {!isDemoMode && cameraStatus === "error" && <ErrorCard />}
      {cameraStatus === "starting" && (
        <div className="absolute inset-0 grid place-items-center">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Requesting camera…
          </p>
        </div>
      )}

      {showControls && (live || isDemoMode) && (
        <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3">
          {isDemoMode ? (
            <>
              <Button variant="destructive" className="rounded-full shadow-lg" onClick={stopDemo}>
                <Square className="fill-current" /> Stop Demo
              </Button>
              <Button variant="secondary" className="rounded-full border shadow-lg" onClick={startCamera}>
                <Camera /> Use Physical Camera
              </Button>
            </>
          ) : (
            <>
              <Button variant="destructive" className="rounded-full shadow-lg" onClick={stopCamera}>
                <Square className="fill-current" /> Stop Stream
              </Button>
              {deviceCount > 1 && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full border shadow-lg"
                  onClick={switchCamera}
                  aria-label="Switch camera"
                >
                  <SwitchCamera />
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
