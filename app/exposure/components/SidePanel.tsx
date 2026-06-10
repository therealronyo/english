"use client";

import { EDGE_KIND_LABELS } from "../lib/data";
import {
  ICON_PATHS,
  riskToSeverity,
  SEVERITY_COLORS,
  STATUS_COLORS,
  TYPE_LABELS,
} from "../lib/style";
import type { Entity, GraphData } from "../lib/types";

interface Props {
  entity: Entity | null;
  graph: GraphData;
  entityById: Map<string, Entity>;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

const STATUS_LABELS = {
  healthy: "Healthy",
  vulnerable: "Vulnerable",
  compromised: "Compromised",
} as const;

export default function SidePanel({ entity, graph, entityById, onClose, onNavigate }: Props) {
  const open = entity !== null;

  const connections = entity
    ? graph.edges
        .filter((e) => e.source === entity.id || e.target === entity.id)
        .map((e) => {
          const otherId = e.source === entity.id ? e.target : e.source;
          return { edge: e, other: entityById.get(otherId), outgoing: e.source === entity.id };
        })
        .filter((c) => c.other)
    : [];

  return (
    <aside
      className={`absolute right-0 top-0 z-10 flex h-full w-[340px] transform flex-col border-l border-slate-800 bg-slate-950/95 backdrop-blur transition-transform duration-300 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {entity && (
        <>
          <div className="flex items-start gap-3 border-b border-slate-800 p-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1"
              style={{
                backgroundColor: `${STATUS_COLORS[entity.status]}1a`,
                // ring via boxShadow to use the dynamic color
                boxShadow: `inset 0 0 0 1px ${STATUS_COLORS[entity.status]}66`,
              }}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill={STATUS_COLORS[entity.status]}>
                <path d={ICON_PATHS[entity.type]} />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-bold text-slate-100">{entity.name}</h2>
              <p className="text-[11px] text-slate-400">{TYPE_LABELS[entity.type]}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    color: STATUS_COLORS[entity.status],
                    backgroundColor: `${STATUS_COLORS[entity.status]}1f`,
                  }}
                >
                  {STATUS_LABELS[entity.status]}
                </span>
                {entity.criticalAsset && (
                  <span className="rounded-full bg-purple-400/15 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                    Critical asset
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
              aria-label="Close panel"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4 text-[12px]">
            {/* Risk score gauge */}
            <section>
              <div className="mb-1 flex items-baseline justify-between">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Risk score
                </h3>
                <span
                  className="text-lg font-bold"
                  style={{ color: SEVERITY_COLORS[riskToSeverity(entity.riskScore)] }}
                >
                  {entity.riskScore}
                  <span className="text-[10px] font-normal text-slate-500"> /100</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${entity.riskScore}%`,
                    background: `linear-gradient(90deg, #34d399, #fbbf24 55%, #f87171)`,
                  }}
                />
              </div>
            </section>

            <p className="text-slate-400">{entity.description}</p>

            {/* Alerts */}
            {entity.alerts.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Open alerts
                </h3>
                <ul className="space-y-1.5">
                  {entity.alerts.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-1.5"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: SEVERITY_COLORS[a.severity] }}
                      />
                      <span className="min-w-0 flex-1 truncate text-slate-300">{a.title}</span>
                      <span className="text-[10px] text-slate-500">{a.id}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Vulnerabilities */}
            {entity.vulnerabilities.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Vulnerabilities
                </h3>
                <ul className="space-y-1.5">
                  {entity.vulnerabilities.map((v) => (
                    <li
                      key={v.cve}
                      className="rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] text-cyan-300">{v.cve}</span>
                        <span
                          className="rounded px-1.5 py-px text-[10px] font-bold uppercase"
                          style={{
                            color: SEVERITY_COLORS[v.severity],
                            backgroundColor: `${SEVERITY_COLORS[v.severity]}1f`,
                          }}
                        >
                          {v.severity} · {v.cvss.toFixed(1)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-slate-400">{v.title}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Recent activity */}
            <section>
              <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Recent activity
              </h3>
              <ul className="space-y-2 border-l border-slate-800 pl-3">
                {entity.activity.map((ev, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full bg-slate-600" />
                    <p className="text-slate-300">{ev.description}</p>
                    <p className="text-[10px] text-slate-500">{ev.time}</p>
                  </li>
                ))}
              </ul>
            </section>

            {/* Connections */}
            <section>
              <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Connections ({connections.length})
              </h3>
              <ul className="space-y-1">
                {connections.map(({ edge, other, outgoing }) => (
                  <li key={edge.id}>
                    <button
                      onClick={() => onNavigate(other!.id)}
                      className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left hover:border-slate-700 hover:bg-slate-900"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill={STATUS_COLORS[other!.status]}>
                        <path d={ICON_PATHS[other!.type]} />
                      </svg>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-slate-200">{other!.name}</span>
                        <span className="block text-[10px] text-slate-500">
                          {outgoing ? EDGE_KIND_LABELS[edge.kind] : `← ${EDGE_KIND_LABELS[edge.kind]}`}
                          {edge.criticality !== "normal" && (
                            <span
                              className="ml-1.5 font-semibold"
                              style={{ color: edge.criticality === "attack" ? "#f87171" : "#fbbf24" }}
                            >
                              {edge.criticality === "attack" ? "active attack" : "risky"}
                            </span>
                          )}
                        </span>
                      </span>
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </aside>
  );
}
