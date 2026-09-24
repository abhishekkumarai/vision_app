"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useVision } from "@/components/vision-provider";
import type { LlmProvider, Settings } from "@/lib/types";

const ENGINE_LABEL = {
  loading: "Loading MediaPipe…",
  browser: "In-browser MediaPipe (WebAssembly)",
  server: "Server-side MediaPipe (FastAPI)",
} as const;

export function SettingsDialog({ children }: { children: React.ReactNode }) {
  const { settings, updateSettings, providers, engine } = useVision();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Settings>(settings);

  const providerLabel: Record<LlmProvider, string> = {
    ollama: `Ollama — local${providers?.ollama_model ? ` (${providers.ollama_model})` : ""}`,
    gemini: `Google Gemini — cloud${providers && !providers.has_gemini_key ? " (no API key)" : ""}`,
    mock: "Curated offline knowledge",
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setDraft(settings);
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Stored in this browser only.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-2">
          <div className="grid gap-2">
            <Label htmlFor="provider">LLM provider</Label>
            <Select value={draft.provider} onValueChange={(v) => setDraft({ ...draft, provider: v as LlmProvider })}>
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(providerLabel) as LlmProvider[]).map((p) => (
                  <SelectItem key={p} value={p} disabled={p === "gemini" && providers?.has_gemini_key === false}>
                    {providerLabel[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Falls back to offline knowledge if the provider is unreachable.</p>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label>Confidence threshold</Label>
              <span className="font-mono text-sm tabular-nums text-success">{Math.round(draft.threshold * 100)}%</span>
            </div>
            <Slider
              min={0.1}
              max={0.9}
              step={0.05}
              value={[draft.threshold]}
              onValueChange={([v]) => setDraft({ ...draft, threshold: v })}
              aria-label="Confidence threshold"
            />
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label>Server detection interval</Label>
              <span className="font-mono text-sm tabular-nums text-primary">{draft.detectIntervalMs} ms</span>
            </div>
            <Slider
              min={150}
              max={1000}
              step={50}
              value={[draft.detectIntervalMs]}
              onValueChange={([v]) => setDraft({ ...draft, detectIntervalMs: v })}
              aria-label="Server detection interval"
              disabled={engine === "browser"}
            />
            <p className="text-xs text-muted-foreground">
              Only used when detection runs on the server. In-browser detection runs every frame.
            </p>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <Label htmlFor="send-events">Send workflow events</Label>
              <p className="text-xs text-muted-foreground">
                When a new object stays in view, send it to the server to run workflows (identify, and later
                notifications). One event per object every 30 s.
              </p>
            </div>
            <Switch
              id="send-events"
              checked={draft.sendEvents}
              onCheckedChange={(v) => setDraft({ ...draft, sendEvents: v })}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Detection engine</span>
            <span className="font-medium">{ENGINE_LABEL[engine]}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              updateSettings(draft);
              setOpen(false);
            }}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
