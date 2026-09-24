"use client";

import { Eye, Layers, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SettingsDialog } from "@/components/settings-dialog";
import { useVision } from "@/components/vision-provider";
import { cn } from "@/lib/utils";

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border bg-card px-2 text-xs font-medium tabular-nums",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBar() {
  const { isStreaming, fps, inferenceMs, detections, isBackendHealthy, health } = useVision();
  const count = detections.length;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Eye className="size-[18px]" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 leading-tight">
          <p className="text-[15px] font-semibold tracking-tight">Vision AI</p>
          <p className="hidden truncate text-[11px] text-muted-foreground sm:block">MediaPipe + LLM Intelligence</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {isStreaming && (
          <Pill className="font-mono text-success">
            {fps.toFixed(1)} fps
            <span className="hidden text-muted-foreground sm:inline">· {inferenceMs.toFixed(1)} ms</span>
          </Pill>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Pill className={count > 0 ? "text-foreground" : "text-muted-foreground"}>
                <Layers className={cn("size-3.5", count > 0 ? "text-primary" : "text-muted-foreground")} />
                {count}
              </Pill>
            </span>
          </TooltipTrigger>
          <TooltipContent>Objects in the current frame</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Pill
                className={cn(
                  isBackendHealthy
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-destructive/40 bg-destructive/10 text-destructive",
                )}
              >
                <span className={cn("size-1.5 rounded-full", isBackendHealthy ? "bg-success" : "bg-destructive")} />
                <span className="hidden sm:inline">{isBackendHealthy ? "Connected" : "Offline"}</span>
              </Pill>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {isBackendHealthy
              ? `Backend v${health?.version} · default LLM: ${health?.llm_provider}`
              : "Backend unreachable — detection may still run in the browser"}
          </TooltipContent>
        </Tooltip>

        <SettingsDialog>
          <Button variant="ghost" size="icon" aria-label="Settings" className="text-muted-foreground">
            <Settings2 className="size-[18px]" />
          </Button>
        </SettingsDialog>
      </div>
    </header>
  );
}
