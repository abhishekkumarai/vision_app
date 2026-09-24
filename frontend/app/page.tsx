"use client";

import dynamic from "next/dynamic";
import { VisionProvider } from "@/components/vision-provider";

// Camera, MediaPipe and matchMedia are browser-only: skip SSR for the app shell.
const AppShell = dynamic(() => import("@/components/app-shell").then((m) => m.AppShell), { ssr: false });

export default function Home() {
  return (
    <VisionProvider>
      <AppShell />
    </VisionProvider>
  );
}
