"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  HandHelping,
  Lightbulb,
  MessageSquare,
  MousePointerClick,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useVision } from "@/components/vision-provider";
import { speechAssistant } from "@/lib/speech";

function Section({ icon: Icon, title, items }: { icon: React.ElementType; title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <section className="space-y-2.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-primary" /> {title}
      </h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-muted-foreground">
            <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyState() {
  const { detections, selectObject } = useVision();
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <MousePointerClick className="mb-3 size-10 text-muted-foreground/40" />
      <h2 className="text-base font-semibold">No Object Selected</h2>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
        Tap any detected box in the camera feed, or pick one below, to inspect it.
      </p>
      {detections.length > 0 && (
        <div className="mt-6 space-y-2.5">
          <p className="text-xs text-muted-foreground">Detected in current frame</p>
          <div className="flex flex-wrap justify-center gap-2">
            {detections.map((d, i) => (
              <Button key={`${d.label}-${i}`} variant="outline" size="sm" className="rounded-full" onClick={() => selectObject(d)}>
                <ScanSearch className="text-primary" />
                {d.label}
                <span className="tabular-nums text-muted-foreground">{Math.round(d.confidence * 100)}%</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  const { selected, settings } = useVision();
  return (
    <div className="space-y-5 p-5" aria-busy>
      <div className="flex items-center gap-3">
        <Skeleton className="size-14 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-24 w-full" />
      <p className="text-center text-xs text-muted-foreground">
        Analyzing <span className="text-foreground">{selected?.label}</span> with {settings.provider}…
      </p>
    </div>
  );
}

export function ObjectCard() {
  const { identification: data, isIdentifying, identificationError, snapshot, selected, selectObject, sendMessage, setView, isChatSending } =
    useVision();
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => speechAssistant.stop(), []);
  useEffect(() => {
    speechAssistant.stop();
    setSpeaking(false);
  }, [data]);

  if (isIdentifying) return <LoadingState />;

  if (identificationError && selected) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertTriangle className="size-8 text-amber-400" />
        <p className="max-w-xs text-sm text-muted-foreground">{identificationError}</p>
        <Button variant="outline" size="sm" onClick={() => selectObject(selected)}>
          Try again
        </Button>
      </div>
    );
  }

  if (!data) return <EmptyState />;

  const toggleSpeak = () => {
    if (speaking) {
      speechAssistant.stop();
      setSpeaking(false);
    } else {
      setSpeaking(true);
      speechAssistant.speak(`${data.name}. ${data.summary}`, () => setSpeaking(false));
    }
  };

  const ask = (q: string) => {
    setView("chat");
    sendMessage(q);
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-5">
        <header className="flex items-start gap-3">
          {snapshot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={snapshot} alt={`Snapshot of ${data.label}`} className="size-14 shrink-0 rounded-lg border object-cover" />
          ) : (
            <div className="grid size-14 shrink-0 place-items-center rounded-lg border border-success/50 bg-success/10 text-success">
              <Sparkles className="size-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-snug">{data.name}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary" className="border-primary/30 bg-primary/10 font-medium text-primary hover:bg-primary/10">
                {data.category}
              </Badge>
              <span className="text-muted-foreground">
                {data.label} · <span className="tabular-nums">{Math.round(data.confidence * 100)}%</span> detection
              </span>
              <Badge variant="outline" className="font-mono font-normal text-muted-foreground">
                {data.model_used}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleSpeak} aria-label={speaking ? "Stop reading" : "Read summary aloud"}>
            {speaking ? <VolumeX /> : <Volume2 />}
          </Button>
        </header>

        <p className="text-sm leading-relaxed text-foreground/85">{data.summary}</p>

        <Separator />

        <Section icon={HandHelping} title="Primary Uses" items={data.primary_uses} />
        <Section icon={SlidersHorizontal} title="Materials & Specifications" items={data.materials_and_specs} />
        <Section icon={ShieldCheck} title="Safety & Maintenance" items={data.safety_and_maintenance} />
        <Section icon={Lightbulb} title="Fun Facts" items={data.fun_facts} />

        {data.suggested_questions?.length > 0 && (
          <section className="space-y-2.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="size-4 text-primary" /> Ask the Assistant
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.suggested_questions.map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  disabled={isChatSending}
                  className="h-auto whitespace-normal rounded-full py-1.5 text-left text-xs font-normal"
                  onClick={() => ask(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </section>
        )}
      </div>
    </ScrollArea>
  );
}
