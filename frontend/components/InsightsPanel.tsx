"use client";

import React, { useState } from "react";
import { Volume2, VolumeX, Send, Sparkles, HelpCircle, Layers, ShieldCheck, Wrench, BookOpen } from "lucide-react";
import { ObjectInsights, ChatMessage } from "@/lib/types";
import { speechAssistant } from "@/lib/speech";

interface InsightsPanelProps {
  insights: ObjectInsights | null;
  isIdentifying: boolean;
  cropThumbnail: string | null;
  targetConfidence?: number;
  onSendChat: (question: string) => Promise<string | null>;
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({
  insights,
  isIdentifying,
  cropThumbnail,
  targetConfidence,
  onSendChat,
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatSending, setIsChatSending] = useState(false);

  // Toggle speech narration
  const handleToggleSpeak = () => {
    if (!insights) return;
    if (speechAssistant.isSpeaking()) {
      speechAssistant.stop();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      speechAssistant.speak(`${insights.name}. ${insights.summary}`, () => {
        setIsSpeaking(false);
      });
    }
  };

  // Submit chat message
  const handleSendChat = async (questionText?: string) => {
    const q = (questionText || chatInput).trim();
    if (!q || !insights || isChatSending) return;

    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: q }]);
    setIsChatSending(true);

    try {
      const answer = await onSendChat(q);
      if (answer) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: answer }]);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error: Unable to process your question at this moment." },
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  return (
    <div className="bg-slate-950/80 border border-cyan-900/40 rounded-2xl p-5 shadow-2xl flex-1 flex flex-col backdrop-blur-md overflow-hidden min-h-[580px]">
      {/* 1. Loading State */}
      {isIdentifying && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
          <div className="relative w-16 h-16">
            <div className="w-16 h-16 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-cyan-400 text-[10px] font-mono">
              AI
            </div>
          </div>
          <p className="text-xs font-mono text-cyan-400 animate-pulse tracking-wide">
            GENERATING MULTIMODAL INTELLIGENCE...
          </p>
        </div>
      )}

      {/* 2. Empty / Idle State */}
      {!isIdentifying && !insights && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-center text-cyan-400 mb-2">
            <Sparkles className="w-8 h-8 opacity-70" />
          </div>
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
            Awaiting Target Acquisition
          </h3>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
            Start the camera and position an object in frame. Click{" "}
            <span className="text-cyan-400 font-semibold">INSPECT WITH LLM</span> to identify it and query deep knowledge.
          </p>
        </div>
      )}

      {/* 3. Active Insights State */}
      {!isIdentifying && insights && (
        <div className="flex-1 flex flex-col space-y-4 overflow-y-auto pr-1">
          {/* Target Profile Header */}
          <div className="flex items-start justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-3">
              {cropThumbnail && (
                <img
                  src={cropThumbnail}
                  alt={insights.name}
                  className="w-14 h-14 rounded-lg object-cover border border-cyan-500/50 shadow-md bg-slate-900"
                />
              )}
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-extrabold text-white tracking-tight">
                    {insights.name}
                  </h2>
                  <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded-full">
                    {insights.category}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-[11px] font-mono mt-0.5">
                  {targetConfidence !== undefined && (
                    <span className="text-emerald-400 font-semibold">
                      {Math.round(targetConfidence * 100)}% CONFIDENCE
                    </span>
                  )}
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">{insights.model_used}</span>
                </div>
              </div>
            </div>

            {/* Read Aloud Button */}
            <button
              onClick={handleToggleSpeak}
              title="Read summary aloud"
              className={`p-2 rounded-lg border transition-colors ${
                isSpeaking
                  ? "bg-cyan-950 border-cyan-500 text-cyan-400"
                  : "bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-cyan-400"
              }`}
            >
              {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Executive Summary */}
          <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
            <h4 className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1 flex items-center">
              <BookOpen className="w-3 h-3 mr-1.5" />
              Executive Summary
            </h4>
            <p className="text-xs text-slate-200 leading-relaxed">{insights.summary}</p>
          </div>

          {/* 4-Box Grid of Detailed Specs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Primary Uses */}
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl flex flex-col">
              <h4 className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-2 flex items-center">
                <Layers className="w-3 h-3 mr-1.5" />
                Primary Uses
              </h4>
              <ul className="space-y-1.5 flex-1">
                {(insights.primary_uses || []).map((use, i) => (
                  <li key={i} className="flex items-start text-xs text-slate-300">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 mr-2 flex-shrink-0" />
                    <span>{use}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Technical Specs */}
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl flex flex-col">
              <h4 className="text-[10px] font-mono text-purple-400 uppercase tracking-wider mb-2 flex items-center">
                <Wrench className="w-3 h-3 mr-1.5" />
                Specs & Materials
              </h4>
              <ul className="space-y-1.5 flex-1">
                {(insights.materials_and_specs || []).map((spec, i) => (
                  <li key={i} className="flex items-start text-xs text-slate-300">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 mr-2 flex-shrink-0" />
                    <span>{spec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Safety & Maintenance */}
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl flex flex-col">
              <h4 className="text-[10px] font-mono text-amber-400 uppercase tracking-wider mb-2 flex items-center">
                <ShieldCheck className="w-3 h-3 mr-1.5" />
                Care & Handling
              </h4>
              <ul className="space-y-1.5 flex-1">
                {(insights.safety_and_maintenance || []).map((tip, i) => (
                  <li key={i} className="flex items-start text-xs text-slate-300">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 mr-2 flex-shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Trivia & History */}
            <div className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl flex flex-col">
              <h4 className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider mb-2 flex items-center">
                <HelpCircle className="w-3 h-3 mr-1.5" />
                Trivia & History
              </h4>
              <ul className="space-y-1.5 flex-1">
                {(insights.fun_facts || []).map((fact, i) => (
                  <li key={i} className="flex items-start text-xs text-slate-300">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 mr-2 flex-shrink-0" />
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Quick Inquiry Chips */}
          <div>
            <h4 className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2">
              Quick Inquiries
            </h4>
            <div className="flex flex-col space-y-1.5">
              {(insights.suggested_questions || []).map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSendChat(q)}
                  className="text-left text-xs bg-slate-800/90 hover:bg-slate-700/90 text-cyan-300 hover:text-cyan-200 border border-slate-700/80 hover:border-cyan-500/50 px-2.5 py-1.5 rounded-lg transition-all"
                >
                  💡 &quot;{q}&quot;
                </button>
              ))}
            </div>
          </div>

          {/* Follow-up Interactive Q&A Chat */}
          <div className="border-t border-slate-800 pt-3 flex flex-col space-y-2.5">
            <h4 className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
              Interactive Q&A
            </h4>
            <div className="max-h-44 overflow-y-auto space-y-2 p-1">
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
                <span className="font-bold text-cyan-400">Assistant:</span> Visual lock acquired on{" "}
                <span className="text-white font-semibold">{insights.name}</span>. Feel free to ask any question!
              </div>

              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg text-xs ${
                    msg.role === "user"
                      ? "bg-cyan-950/50 border border-cyan-800/60 text-cyan-100 ml-4 self-end"
                      : "bg-slate-900/80 border border-slate-800 text-slate-300 mr-4"
                  }`}
                >
                  <span className="font-bold text-cyan-400">
                    {msg.role === "user" ? "You: " : "Assistant: "}
                  </span>
                  {msg.content}
                </div>
              ))}

              {isChatSending && (
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 mr-4">
                  <span className="font-bold text-cyan-400">Assistant:</span>{" "}
                  <span className="animate-pulse">Analyzing...</span>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                placeholder="Ask anything about this item..."
                className="flex-1 bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
              />
              <button
                onClick={() => handleSendChat()}
                disabled={isChatSending || !chatInput.trim()}
                className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
