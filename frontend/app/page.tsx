"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { CameraViewfinder } from "@/components/CameraViewfinder";
import { InsightsPanel } from "@/components/InsightsPanel";
import { DetectionItem, ObjectInsights, HealthData } from "@/lib/types";
import { speechAssistant } from "@/lib/speech";

export default function Home() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [engineMode, setEngineMode] = useState<string>("MediaPipe: Initializing...");
  const [selectedProvider, setSelectedProvider] = useState<string>("ollama");

  const [detections, setDetections] = useState<DetectionItem[]>([]);
  const [lockedTarget, setLockedTarget] = useState<DetectionItem | null>(null);
  const [currentCrop, setCurrentCrop] = useState<string | null>(null);

  const [insights, setInsights] = useState<ObjectInsights | null>(null);
  const [isIdentifying, setIsIdentifying] = useState<boolean>(false);

  // Poll health on mount
  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          const data: HealthData = await res.json();
          setHealth(data);
          if (data.llm_provider) {
            setSelectedProvider(data.llm_provider);
          }
        }
      } catch (e) {
        console.warn("Health check error:", e);
      }
    }
    fetchHealth();
  }, []);

  // Handle Inspect action
  const handleInspect = async (target: DetectionItem, cropB64: string | null) => {
    setIsIdentifying(true);
    setCurrentCrop(cropB64);

    try {
      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: target.label,
          score: target.score,
          image_b64: cropB64,
          provider: selectedProvider,
        }),
      });

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data: ObjectInsights = await res.json();
      setInsights(data);

      // Auto-narrate overview
      speechAssistant.speak(`${data.name}. ${data.summary}`);
    } catch (err: any) {
      alert("Failed to analyze object: " + err.message);
    } finally {
      setIsIdentifying(false);
    }
  };

  // Handle follow-up chat
  const handleSendChat = async (question: string): Promise<string | null> => {
    if (!insights) return null;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object_context: insights,
          question: question,
          provider: selectedProvider,
        }),
      });

      if (!res.ok) throw new Error(`Chat error ${res.status}`);
      const data = await res.json();
      return data.answer || "No response received.";
    } catch (err: any) {
      console.error("Chat error:", err);
      return "Sorry, I could not answer that question at this time.";
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        health={health}
        targetCount={detections.length}
        engineMode={engineMode}
        selectedProvider={selectedProvider}
        onProviderChange={setSelectedProvider}
      />

      <main className="flex-1 p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1720px] mx-auto w-full">
        {/* Left Column: Viewfinder & HUD */}
        <div className="lg:col-span-7">
          <CameraViewfinder
            onDetectionsUpdate={setDetections}
            onLockedTargetChange={setLockedTarget}
            onEngineReady={setEngineMode}
            onInspect={handleInspect}
            isIdentifying={isIdentifying}
          />
        </div>

        {/* Right Column: Insights & Interactive Assistant */}
        <div className="lg:col-span-5 flex flex-col">
          <InsightsPanel
            insights={insights}
            isIdentifying={isIdentifying}
            cropThumbnail={currentCrop}
            targetConfidence={lockedTarget?.score}
            onSendChat={handleSendChat}
          />
        </div>
      </main>
    </div>
  );
}
