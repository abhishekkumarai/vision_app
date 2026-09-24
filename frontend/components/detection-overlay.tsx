"use client";

import { useEffect, useRef, useState } from "react";
import type { Detection } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Same heuristic as BoundingBoxPainter in the Flutter client. */
export function isSameDetection(a: Detection | null, b: Detection): boolean {
  return !!a && a.label === b.label && Math.abs(a.box.xmin - b.box.xmin) < 0.05;
}

/**
 * Lays out `aspect` content "object-contain" inside the parent and renders
 * children in that rect, so normalized boxes line up with the letterboxed video.
 */
export function ContainedFrame({
  aspect,
  className,
  children,
}: {
  aspect: number;
  className?: string;
  children: React.ReactNode;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width / height > aspect) setRect({ w: height * aspect, h: height });
      else setRect({ w: width, h: width / aspect });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  return (
    <div ref={outer} className="absolute inset-0 grid place-items-center">
      <div className={cn("relative", className)} style={{ width: rect.w, height: rect.h }}>
        {children}
      </div>
    </div>
  );
}

const CORNERS = [
  "left-[-2px] top-[-2px] border-l-[3px] border-t-[3px] rounded-tl-lg",
  "right-[-2px] top-[-2px] border-r-[3px] border-t-[3px] rounded-tr-lg",
  "left-[-2px] bottom-[-2px] border-l-[3px] border-b-[3px] rounded-bl-lg",
  "right-[-2px] bottom-[-2px] border-r-[3px] border-b-[3px] rounded-br-lg",
];

export function DetectionOverlay({
  detections,
  selected,
  onSelect,
}: {
  detections: Detection[];
  selected: Detection | null;
  onSelect: (d: Detection) => void;
}) {
  return (
    <div className="absolute inset-0">
      {detections.map((d, i) => {
        const active = isSameDetection(selected, d);
        const pct = Math.round(d.confidence * 100);
        const labelAbove = d.box.ymin > 0.06;
        return (
          <button
            key={`${d.label}-${i}`}
            type="button"
            onClick={() => onSelect(d)}
            aria-label={`Inspect ${d.label}, ${pct}% confidence`}
            className={cn(
              "group absolute rounded-lg border-2 outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-black",
              active
                ? "border-success bg-success/20"
                : "border-primary bg-primary/10 hover:bg-primary/20",
            )}
            style={{
              left: `${d.box.xmin * 100}%`,
              top: `${d.box.ymin * 100}%`,
              width: `${(d.box.xmax - d.box.xmin) * 100}%`,
              height: `${(d.box.ymax - d.box.ymin) * 100}%`,
            }}
          >
            {CORNERS.map((c) => (
              <span
                key={c}
                aria-hidden
                className={cn("pointer-events-none absolute size-3.5", c, active ? "border-emerald-300" : "border-white")}
              />
            ))}
            <span
              className={cn(
                "pointer-events-none absolute left-0 whitespace-nowrap rounded-[5px] px-2 py-1 text-[11px] font-semibold uppercase leading-none tracking-wide text-white",
                active ? "bg-emerald-700" : "bg-cyan-700",
                labelAbove ? "bottom-full mb-1" : "top-1 ml-1",
              )}
            >
              {d.label} <span className="tabular-nums">{pct}%</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
