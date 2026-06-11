"use client";

import { useState } from "react";
import type { Fix } from "../lib/types";

interface Props {
  ranked: Array<{ fix: Fix; pathsSevered: number; applied: boolean }>;
  onToggleFix: (fix: Fix) => void;
  onFocusFix: (fix: Fix) => void;
}

export default function RemediationQueue({ ranked, onToggleFix, onFocusFix }: Props) {
  const [open, setOpen] = useState(true);
  const appliedCount = ranked.filter((r) => r.applied).length;

  return (
    <div className="absolute bottom-5 left-16 z-10 ml-2 w-[320px]">
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/95 backdrop-blur">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between px-3.5 py-2.5"
        >
          <span className="flex items-center gap-2 text-[12px] font-semibold text-slate-200">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18v3h3l5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3Z" />
            </svg>
            Remediation queue
            {appliedCount > 0 && (
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                {appliedCount} simulated
              </span>
            )}
          </span>
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 text-slate-500 transition-transform ${open ? "" : "rotate-180"}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m6 15 6-6 6 6" />
          </svg>
        </button>

        {open && (
          <ul className="max-h-[300px] space-y-1.5 overflow-y-auto border-t border-slate-800 p-2.5">
            {ranked.map(({ fix, pathsSevered, applied }, i) => (
              <li
                key={fix.id}
                className={`rounded-lg border p-2.5 transition ${
                  applied
                    ? "border-emerald-500/40 bg-emerald-950/20"
                    : "border-slate-800 bg-slate-900/60"
                }`}
              >
                <button onClick={() => onFocusFix(fix)} className="block w-full text-left">
                  <span className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        applied ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {applied ? "✓" : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[11.5px] font-semibold leading-snug ${applied ? "text-emerald-200 line-through decoration-emerald-500/50" : "text-slate-200"}`}>
                        {fix.title}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-slate-500">
                        {applied ? (
                          <>Applied in simulation · org risk −{fix.riskDelta}</>
                        ) : (
                          <>
                            severs{" "}
                            <span className="font-semibold text-fuchsia-300">
                              {pathsSevered} attack path{pathsSevered === 1 ? "" : "s"}
                            </span>{" "}
                            · org risk <span className="font-semibold text-emerald-300">−{fix.riskDelta}</span>
                          </>
                        )}
                      </span>
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => onToggleFix(fix)}
                  className={`mt-2 w-full rounded-md px-2 py-1 text-[10.5px] font-semibold transition ${
                    applied
                      ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      : "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                  }`}
                >
                  {applied ? "Undo simulation" : "Simulate fix"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
