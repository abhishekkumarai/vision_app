"use client";

import React from "react";
import { Eye, Cpu, Zap, Activity } from "lucide-react";
import { HealthData } from "@/lib/types";

interface HeaderProps {
  health: HealthData | null;
  targetCount: number;
  engineMode: string;
  selectedProvider: string;
  onProviderChange: (provider: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  targetCount,
  engineMode,
  selectedProvider,
  onProviderChange,
}) => {
  return (
    <header className="border-b border-cyan-950/80 bg-[#060b19]/90 backdrop-blur-md px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50">
      <div className="flex items-center space-x-3">
        <div className="relative w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-emerald-400 p-[1px] flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <div className="w-full h-full bg-slate-950 rounded-lg flex items-center justify-center">
            <Eye className="w-4 h-4 text-cyan-400 animate-pulse" />
          </div>
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-wider text-slate-100 flex items-center space-x-2">
            <span>MEDIAPIPE VISION LENS</span>
            <span className="text-cyan-400 font-mono text-xs">// NEXT.JS & LLM</span>
          </h1>
          <p className="text-[10px] text-slate-400 font-mono">
            Traceability: Epic KAN-49 • Next.js App Router • 60FPS Tracking
          </p>
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-2.5">
        {/* MediaPipe Engine Status */}
        <div className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/80 px-2.5 py-1 rounded-full flex items-center">
          <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 mr-1.5 animate-ping" />
          {engineMode}
        </div>

        {/* GPU Status */}
        {health?.gpu_available ? (
          <div className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-full flex items-center">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
            GPU: {health.gpu_name || "Active"}
          </div>
        ) : (
          <div className="text-xs font-mono text-slate-400 bg-slate-800/60 border border-slate-700 px-2.5 py-1 rounded-full flex items-center">
            <span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1.5" />
            CPU Mode
          </div>
        )}

        {/* Target Counter */}
        <div className="text-xs font-mono text-slate-300 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-full flex items-center">
          <Activity className="w-3.5 h-3.5 text-cyan-400 mr-1.5" />
          TARGETS: {targetCount}
        </div>

        {/* LLM Provider Picker */}
        <div className="flex items-center space-x-1.5 bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-lg">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-mono text-slate-400">LLM:</span>
          <select
            value={selectedProvider}
            onChange={(e) => onProviderChange(e.target.value)}
            className="bg-transparent text-xs font-semibold text-cyan-400 focus:outline-none cursor-pointer"
          >
            <option value="ollama" className="bg-slate-900 text-slate-200">
              Ollama (Gemma 2 / Vision)
            </option>
            <option value="gemini" className="bg-slate-900 text-slate-200">
              Google Gemini (Cloud)
            </option>
            <option value="mock" className="bg-slate-900 text-slate-200">
              Offline Fast Engine
            </option>
          </select>
        </div>
      </div>
    </header>
  );
};
