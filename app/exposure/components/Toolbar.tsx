"use client";

import { useMemo, useState } from "react";
import { ICON_PATHS, SEVERITY_COLORS, STATUS_COLORS, TYPE_LABELS } from "../lib/style";
import type { AttackPath, ClusterId, GraphData, Severity } from "../lib/types";

interface Props {
  graph: GraphData;
  activeClusters: Set<ClusterId>;
  onToggleCluster: (id: ClusterId) => void;
  minSeverity: Severity;
  onMinSeverity: (s: Severity) => void;
  attackMode: boolean;
  onToggleAttackMode: () => void;
  chokeMode: boolean;
  onToggleChokeMode: () => void;
  replayActive: boolean;
  onToggleReplay: () => void;
  focusedPathId: string | null;
  onFocusPath: (path: AttackPath | null) => void;
  onSearchSelect: (id: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  zoom: number;
}

const SEVERITY_OPTIONS: Array<{ value: Severity; label: string }> = [
  { value: "low", label: "All" },
  { value: "medium", label: "Med+" },
  { value: "high", label: "High+" },
  { value: "critical", label: "Critical" },
];

export default function Toolbar({
  graph,
  activeClusters,
  onToggleCluster,
  minSeverity,
  onMinSeverity,
  attackMode,
  onToggleAttackMode,
  chokeMode,
  onToggleChokeMode,
  replayActive,
  onToggleReplay,
  focusedPathId,
  onFocusPath,
  onSearchSelect,
  onZoomIn,
  onZoomOut,
  onResetView,
  zoom,
}: Props) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return graph.entities
      .filter((e) => e.name.toLowerCase().includes(q) || TYPE_LABELS[e.type].toLowerCase().includes(q))
      .slice(0, 7);
  }, [query, graph]);

  return (
    <>
      {/* Left control stack */}
      <div className="absolute left-4 top-4 z-10 flex w-[260px] flex-col gap-3">
        {/* Search */}
        <div className="relative">
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-2 backdrop-blur">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search entities…"
              className="w-full bg-transparent text-[12px] text-slate-200 placeholder-slate-500 outline-none"
            />
          </div>
          {results.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/95 backdrop-blur">
              {results.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => {
                      onSearchSelect(e.id);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-slate-800/70"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill={STATUS_COLORS[e.status]}>
                      <path d={ICON_PATHS[e.type]} />
                    </svg>
                    <span className="min-w-0 flex-1 truncate text-slate-200">{e.name}</span>
                    <span className="text-[10px] text-slate-500">{TYPE_LABELS[e.type]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Filters */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-3 backdrop-blur">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Filter by category
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {graph.clusters.map((c) => {
              const active = activeClusters.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => onToggleCluster(c.id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                    active
                      ? "border-transparent text-slate-950"
                      : "border-slate-700 text-slate-500 hover:text-slate-300"
                  }`}
                  style={active ? { backgroundColor: c.color } : undefined}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          <h3 className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Minimum severity
          </h3>
          <div className="flex overflow-hidden rounded-md border border-slate-700">
            {SEVERITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onMinSeverity(opt.value)}
                className={`flex-1 py-1 text-[11px] transition ${
                  minSeverity === opt.value
                    ? "bg-cyan-500/20 font-semibold text-cyan-300"
                    : "text-slate-400 hover:bg-slate-800/60"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Attack paths */}
        <div
          className={`rounded-lg border p-3 backdrop-blur transition ${
            attackMode ? "border-red-500/50 bg-red-950/30" : "border-slate-800 bg-slate-950/90"
          }`}
        >
          <button onClick={onToggleAttackMode} className="flex w-full items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] font-semibold text-slate-200">
              <svg viewBox="0 0 24 24" className={`h-4 w-4 ${attackMode ? "text-red-400" : "text-slate-500"}`} fill="currentColor">
                <path d="M13 2 4 14h6l-1 8 9-12h-6Z" />
              </svg>
              Attack paths
            </span>
            <span
              className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${
                attackMode ? "bg-red-500" : "bg-slate-700"
              }`}
            >
              <span
                className={`h-4 w-4 rounded-full bg-white transition-transform ${
                  attackMode ? "translate-x-4" : ""
                }`}
              />
            </span>
          </button>
          {attackMode && (
            <ul className="mt-2.5 space-y-1.5">
              {graph.attackPaths.map((p) => {
                const focused = p.id === focusedPathId;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => onFocusPath(focused ? null : p)}
                      className={`w-full rounded-md border px-2.5 py-2 text-left transition ${
                        focused
                          ? "border-red-500/60 bg-red-500/15"
                          : "border-slate-800 bg-slate-900/60 hover:border-slate-600"
                      }`}
                    >
                      <span className="block text-[11px] font-semibold text-slate-200">
                        {p.name}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-slate-400">
                        {p.nodeIds.length} hops
                        {focused ? ` — ${p.description}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
              {graph.attackPaths.length === 0 && (
                <li className="rounded-md border border-emerald-500/40 bg-emerald-950/30 px-2.5 py-2 text-[11px] text-emerald-300">
                  No live attack paths — simulated fixes severed them all.
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Choke points */}
        <div
          className={`rounded-lg border p-3 backdrop-blur transition ${
            chokeMode ? "border-fuchsia-500/50 bg-fuchsia-950/30" : "border-slate-800 bg-slate-950/90"
          }`}
        >
          <button onClick={onToggleChokeMode} className="flex w-full items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] font-semibold text-slate-200">
              <svg viewBox="0 0 24 24" className={`h-4 w-4 ${chokeMode ? "text-fuchsia-400" : "text-slate-500"}`} fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3.2" />
                <path d="M4 4l5.2 5.2M20 4l-5.2 5.2M4 20l5.2-5.2M20 20l-5.2-5.2" />
              </svg>
              Choke points
            </span>
            <span
              className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${
                chokeMode ? "bg-fuchsia-500" : "bg-slate-700"
              }`}
            >
              <span
                className={`h-4 w-4 rounded-full bg-white transition-transform ${
                  chokeMode ? "translate-x-4" : ""
                }`}
              />
            </span>
          </button>
          {chokeMode && (
            <p className="mt-2 text-[10px] leading-snug text-slate-400">
              Node size = number of attack paths passing through it. Fixing the
              biggest node severs the most paths — click one for details.
            </p>
          )}
        </div>

        {/* Incident replay */}
        <div
          className={`rounded-lg border p-3 backdrop-blur transition ${
            replayActive ? "border-red-500/50 bg-red-950/30" : "border-slate-800 bg-slate-950/90"
          }`}
        >
          <button onClick={onToggleReplay} className="flex w-full items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] font-semibold text-slate-200">
              <svg viewBox="0 0 24 24" className={`h-4 w-4 ${replayActive ? "text-red-400" : "text-slate-500"}`} fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3.5 2" />
              </svg>
              Incident replay
            </span>
            <span
              className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${
                replayActive ? "bg-red-500" : "bg-slate-700"
              }`}
            >
              <span
                className={`h-4 w-4 rounded-full bg-white transition-transform ${
                  replayActive ? "translate-x-4" : ""
                }`}
              />
            </span>
          </button>
          {replayActive && (
            <p className="mt-2 text-[10px] leading-snug text-slate-400">
              Drag the timeline scrubber below the graph to watch the breach unfold.
            </p>
          )}
        </div>

        {/* Legend */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-3 text-[11px] backdrop-blur">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Legend
          </h3>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-slate-400">
            <LegendDot color={STATUS_COLORS.healthy} label="Healthy" />
            <LegendDot color={STATUS_COLORS.vulnerable} label="Vulnerable" />
            <LegendDot color={STATUS_COLORS.compromised} label="Compromised" />
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 shrink-0 rounded-full border-2 border-dashed border-purple-400" />
              Critical asset
            </span>
            <span className="col-span-2 mt-1 flex items-center gap-1.5">
              <svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke="#d97706" strokeWidth="2" strokeDasharray="5 3" /></svg>
              Risky relationship
            </span>
            <span className="col-span-2 flex items-center gap-1.5">
              <svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="6 4" /></svg>
              Active attack edge
            </span>
            <span className="col-span-2 flex items-center gap-1.5">
              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[8px] font-bold text-amber-400">⚠</span>
              Toxic combination
            </span>
            <span className="col-span-2 flex items-center gap-1.5">
              <span className="h-3 w-3 shrink-0 rounded-full border-2 border-fuchsia-400 bg-fuchsia-400/20" />
              Choke point
            </span>
          </div>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-5 left-4 z-10 flex flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-950/90 backdrop-blur">
        <button onClick={onZoomIn} className="px-3 py-2 text-slate-300 hover:bg-slate-800" aria-label="Zoom in">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <button onClick={onZoomOut} className="border-t border-slate-800 px-3 py-2 text-slate-300 hover:bg-slate-800" aria-label="Zoom out">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14" /></svg>
        </button>
        <button onClick={onResetView} className="border-t border-slate-800 px-3 py-2 text-slate-300 hover:bg-slate-800" aria-label="Reset view" title="Fit to view">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </button>
      </div>

      {/* Zoom hint */}
      <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 text-[10px] text-slate-500 backdrop-blur">
        {zoom < 0.85
          ? "Bird's-eye view — scroll to zoom in, click a cluster to expand it"
          : "Entity view — click a node for details, drag to pan"}
      </div>
    </>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-3 shrink-0 rounded-full border-2" style={{ borderColor: color }} />
      {label}
    </span>
  );
}
