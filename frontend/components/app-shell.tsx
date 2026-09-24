"use client";

import { useSyncExternalStore } from "react";
import { Camera, ChevronRight, MessageSquare, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CameraView } from "@/components/camera-view";
import { ChatPanel } from "@/components/chat-panel";
import { ObjectCard } from "@/components/object-card";
import { StatusBar } from "@/components/status-bar";
import { useVision, type View } from "@/components/vision-provider";
import { cn } from "@/lib/utils";

/** Same 850px breakpoint as flutter_frontend/lib/views/home_view.dart. */
const DESKTOP_QUERY = "(min-width: 850px)";

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

function DesktopView() {
  const { view, setView } = useVision();
  const tab = view === "chat" ? "chat" : "intelligence";

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <CameraView />
      <Tabs value={tab} onValueChange={(v) => setView(v as View)} className="flex min-h-0 flex-col border-l">
        <TabsList className="h-auto w-full shrink-0 rounded-none border-b bg-card p-0">
          {[
            { value: "intelligence", label: "Intelligence", icon: Sparkles },
            { value: "chat", label: "Assistant Chat", icon: MessageSquare },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                "flex-1 gap-2 rounded-none border-b-2 border-transparent py-3 text-muted-foreground",
                "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none",
              )}
            >
              <Icon className="size-4" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="intelligence" className="mt-0 min-h-0 flex-1">
          <ObjectCard />
        </TabsContent>
        <TabsContent value="chat" className="mt-0 min-h-0 flex-1">
          <ChatPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IdentifiedBanner() {
  const { identification, setView } = useVision();
  if (!identification) return null;
  return (
    <button
      type="button"
      onClick={() => setView("intelligence")}
      className="absolute inset-x-4 top-4 flex items-center gap-3 rounded-xl border-[1.5px] border-success bg-background/95 px-3.5 py-2.5 text-left shadow-lg"
    >
      <Sparkles className="size-5 shrink-0 text-success" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold">{identification.name}</span>
        <span className="block text-[11px] text-muted-foreground">
          {Math.round(identification.confidence * 100)}% · Tap to view uses, specs & safety
        </span>
      </span>
      <ChevronRight className="size-4 text-success" />
    </button>
  );
}

function MobileView() {
  const { view, setView, selected } = useVision();
  const items: { value: View; label: string; icon: React.ElementType; dot?: boolean }[] = [
    { value: "camera", label: "Camera", icon: Camera },
    { value: "intelligence", label: "Intelligence", icon: Sparkles, dot: !!selected },
    { value: "chat", label: "AI Chat", icon: MessageSquare },
  ];

  return (
    <>
      {/* Screens stay mounted (like Flutter's IndexedStack) so the camera keeps streaming. */}
      <main className="relative min-h-0 flex-1">
        <div className={cn("absolute inset-0", view !== "camera" && "invisible")}>
          <CameraView />
          <IdentifiedBanner />
        </div>
        <div className={cn("absolute inset-0 bg-background", view !== "intelligence" && "hidden")}>
          <ObjectCard />
        </div>
        <div className={cn("absolute inset-0 bg-background", view !== "chat" && "hidden")}>
          <ChatPanel />
        </div>
      </main>
      <nav className="grid shrink-0 grid-cols-3 border-t bg-card pb-[env(safe-area-inset-bottom)]">
        {items.map(({ value, label, icon: Icon, dot }) => {
          const active = view === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="relative">
                <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                {dot && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-success" />}
              </span>
              {label}
            </button>
          );
        })}
      </nav>
    </>
  );
}

export function AppShell() {
  const isDesktop = useIsDesktop();
  return (
    <div className="flex h-dvh flex-col">
      <StatusBar />
      {isDesktop ? <DesktopView /> : <MobileView />}
    </div>
  );
}
