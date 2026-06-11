"use client";

import { STATUS_COLORS } from "../lib/style";
import type { Entity, Fix } from "../lib/types";
import Sparkline from "./Sparkline";

interface Props {
  score: number;
  scoreColor: string;
  delta: number;
  trend: number[];
  ranked: Array<{ fix: Fix; pathsSevered: number; applied: boolean }>;
  entities: Entity[];
  activePathCount: number;
  onClose: () => void;
}

export default function ExecOverlay({
  score,
  scoreColor,
  delta,
  trend,
  ranked,
  entities,
  activePathCount,
  onClose,
}: Props) {
  const criticalAssets = entities.filter((e) => e.criticalAsset);
  const topFixes = ranked.filter((r) => !r.applied).slice(0, 5);
  const improving = delta <= 0;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/88 backdrop-blur-md">
      <div className="w-[760px] max-w-[92vw]">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Security posture</h2>
            <p className="text-[12px] text-slate-400">Board summary · live from the exposure graph</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
          >
            Back to graph · Esc
          </button>
        </div>

        {/* The three numbers that matter */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Org risk score
            </div>
            <div className="mt-1 text-5xl font-bold" style={{ color: scoreColor }}>
              {score}
              <span className="text-base font-normal text-slate-600">/100</span>
            </div>
            <div
              className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                improving ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
              }`}
            >
              {improving ? "▼ improving" : "▲ worsening"} · {Math.abs(delta)} pts / 7 days
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              90-day trend
            </div>
            <div className="mt-3">
              <Sparkline data={trend} width={190} height={64} color={scoreColor} filled />
            </div>
            <div className="mt-1.5 text-[11px] text-slate-500">
              {trend[0]} → {trend[trend.length - 1]}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Live attack paths
            </div>
            <div className="mt-1 text-5xl font-bold text-fuchsia-300">{activePathCount}</div>
            <div className="mt-2 text-[11px] text-slate-500">
              to critical assets · validated on the graph
            </div>
          </div>
        </div>

        {/* Remediation queue */}
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            The plan — next {topFixes.length} fixes by impact
          </div>
          <ol className="mt-2.5 space-y-1.5">
            {topFixes.map(({ fix, pathsSevered }, i) => (
              <li key={fix.id} className="flex items-center gap-3 text-[12.5px]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-200">{fix.title}</span>
                <span className="shrink-0 text-[11px] text-fuchsia-300">
                  −{pathsSevered} path{pathsSevered === 1 ? "" : "s"}
                </span>
                <span className="shrink-0 text-[11px] text-emerald-300">−{fix.riskDelta} risk</span>
              </li>
            ))}
            {topFixes.length === 0 && (
              <li className="text-[12px] text-emerald-300">
                All planned fixes simulated — no live attack paths remain.
              </li>
            )}
          </ol>
        </div>

        {/* Critical asset status */}
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Crown jewels
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {criticalAssets.map((e) => (
              <span
                key={e.id}
                className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-300"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[e.status] }}
                />
                {e.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
