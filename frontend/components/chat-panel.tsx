"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVision } from "@/components/vision-provider";
import { cn } from "@/lib/utils";

const QUICK_SUGGESTIONS = [
  "What are the main components of this?",
  "How does this work?",
  "What is the typical lifespan?",
  "How do I recycle or dispose of this?",
];

/** Renders **bold** spans; everything else is plain text. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function ChatPanel() {
  const { messages, isChatSending, sendMessage, selected } = useVision();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, isChatSending]);

  const submit = (text: string) => {
    if (!text.trim() || isChatSending) return;
    setDraft("");
    sendMessage(text);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <ol className="space-y-3">
          {messages.map((m) => {
            const mine = m.role === "user";
            return (
              <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                    mine
                      ? "rounded-br-sm bg-blue-600 text-white"
                      : "rounded-bl-sm border bg-card text-card-foreground",
                  )}
                >
                  {!mine && m.provider && (
                    <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-wide text-primary">
                      {m.provider}
                    </p>
                  )}
                  <RichText text={m.content} />
                </div>
              </li>
            );
          })}
          {isChatSending && (
            <li className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-primary" /> Assistant is thinking…
            </li>
          )}
        </ol>
        <div ref={endRef} />
      </div>

      {selected && !isChatSending && (
        <div className="flex gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
          {QUICK_SUGGESTIONS.map((q) => (
            <Button
              key={q}
              variant="outline"
              size="sm"
              className="h-7 shrink-0 rounded-full text-xs font-normal text-muted-foreground"
              onClick={() => submit(q)}
            >
              {q}
            </Button>
          ))}
        </div>
      )}

      <form
        className="flex items-center gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={selected ? `Ask about ${selected.label}…` : "Ask the vision assistant anything…"}
          className="h-10 rounded-full bg-card px-4"
          aria-label="Message"
        />
        <Button
          type="submit"
          size="icon"
          className="size-10 shrink-0 rounded-full bg-blue-600 text-white hover:bg-blue-500"
          disabled={isChatSending || !draft.trim()}
          aria-label="Send"
        >
          <ArrowUp className="size-[18px]" />
        </Button>
      </form>
    </div>
  );
}
