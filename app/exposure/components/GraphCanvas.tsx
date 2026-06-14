"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EDGE_KIND_LABELS } from "../lib/data";
import { CLUSTER_ANCHORS } from "../lib/graph-layout";
import { ICON_PATHS, riskToSeverity, SEVERITY_COLORS, STATUS_COLORS } from "../lib/style";
import type { AttackPath, ClusterId, Edge, GraphData, NodePosition } from "../lib/types";

export interface Transform {
  x: number;
  y: number;
  k: number;
}

export interface BlastInfo {
  sourceId: string;
  hops: Map<string, number>; // hop depth per reachable node
  step: number; // hops revealed so far (flood-fill animation)
}

export interface ReplayInfo {
  revealedNodes: Set<string>;
  revealedEdges: Set<string>;
  allNodes: Set<string>;
  allEdges: Set<string>;
}

interface Props {
  graph: GraphData;
  positions: Map<string, NodePosition>;
  transform: Transform;
  onTransformChange: (t: Transform) => void;
  onSizeChange: (w: number, h: number) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onFocusCluster: (id: ClusterId) => void;
  visibleIds: Set<string>;
  neighborMap: Map<string, Set<string>>;
  attackMode: boolean;
  focusedPath: AttackPath | null;
  chokeMode: boolean;
  chokeCounts: Map<string, number>;
  blastInfo: BlastInfo | null;
  focusedComboId: string | null;
  onSelectCombo: (id: string | null) => void;
  playbackStep: number | null; // hop index revealed during playback
  replayInfo: ReplayInfo | null;
}

const MIN_ZOOM = 0.12;
const MAX_ZOOM = 6;
// Below this zoom level clusters render as super-nodes; above it,
// individual entities take over (semantic zoom).
const EXPAND_ZOOM = 0.85;
const LABEL_ZOOM = 1.35;
const NODE_R = 13;

const EDGE_STYLE = {
  normal: { stroke: "#334155", width: 1.2, dash: undefined as string | undefined },
  risky: { stroke: "#d97706", width: 1.6, dash: "7 5" },
  attack: { stroke: "#ef4444", width: 2.2, dash: "9 6" },
};

// Blast flood-fill ring colors by hop depth (source is cyan, then heat).
const BLAST_COLORS = ["#22d3ee", "#fb923c", "#f87171", "#ef4444", "#dc2626"];

export default function GraphCanvas({
  graph,
  positions,
  transform,
  onTransformChange,
  onSizeChange,
  selectedId,
  onSelect,
  onFocusCluster,
  visibleIds,
  neighborMap,
  attackMode,
  focusedPath,
  chokeMode,
  chokeCounts,
  blastInfo,
  focusedComboId,
  onSelectCombo,
  playbackStep,
  replayInfo,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredCombo, setHoveredCombo] = useState<string | null>(null);

  const transformRef = useRef(transform);
  transformRef.current = transform;

  // Observe container size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const report = () => onSizeChange(el.clientWidth, el.clientHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onSizeChange]);

  // Wheel zoom — native listener so preventDefault works (React's is passive).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const t = transformRef.current;
      const rect = el.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      const factor = Math.exp(-ev.deltaY * 0.0016);
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.k * factor));
      const f = k / t.k;
      onTransformChange({ x: mx - (mx - t.x) * f, y: my - (my - t.y) * f, k });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onTransformChange]);

  // Drag to pan; a press that barely moves counts as a background click.
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const onPointerDown = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (ev.button !== 0) return;
    dragRef.current = { x: ev.clientX, y: ev.clientY, moved: false };
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
  };
  const onPointerMove = (ev: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = ev.clientX - drag.x;
    const dy = ev.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    drag.moved = true;
    drag.x = ev.clientX;
    drag.y = ev.clientY;
    const t = transformRef.current;
    onTransformChange({ x: t.x + dx, y: t.y + dy, k: t.k });
  };
  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && !drag.moved) {
      onSelect(null);
      onSelectCombo(null);
    }
  };

  const k = transform.k;
  // Cross-fade between the clustered bird's-eye layer and the entity layer.
  const clusterLayerOpacity = Math.max(0, Math.min(1, (EXPAND_ZOOM - k) / 0.22));
  const nodeLayerOpacity = 1 - clusterLayerOpacity;
  const labelOpacity = Math.max(0, Math.min(1, (k - LABEL_ZOOM) / 0.4));

  // ---- Cluster aggregates for the bird's-eye layer ----
  const clusterStats = useMemo(() => {
    const stats = new Map<ClusterId, { count: number; maxRisk: number; compromised: number }>();
    for (const c of graph.clusters) stats.set(c.id, { count: 0, maxRisk: 0, compromised: 0 });
    for (const e of graph.entities) {
      const s = stats.get(e.cluster)!;
      s.count++;
      s.maxRisk = Math.max(s.maxRisk, e.riskScore);
      if (e.status === "compromised") s.compromised++;
    }
    return stats;
  }, [graph]);

  const clusterEdges = useMemo(() => {
    const clusterOf = new Map<string, ClusterId>();
    for (const e of graph.entities) clusterOf.set(e.id, e.cluster);
    const agg = new Map<string, { a: ClusterId; b: ClusterId; count: number; worst: Edge["criticality"] }>();
    const rank = { normal: 0, risky: 1, attack: 2 };
    for (const e of graph.edges) {
      const ca = clusterOf.get(e.source)!;
      const cb = clusterOf.get(e.target)!;
      if (ca === cb) continue;
      const key = [ca, cb].sort().join("|");
      const cur = agg.get(key) ?? { a: ca, b: cb, count: 0, worst: "normal" as const };
      cur.count++;
      if (rank[e.criticality] > rank[cur.worst]) cur.worst = e.criticality;
      agg.set(key, cur);
    }
    return [...agg.values()];
  }, [graph]);

  // ---- Attack path helpers ----
  const pathInfo = useMemo(() => {
    const nodeIds = new Set<string>();
    const edgeKeys = new Set<string>();
    const paths = focusedPath ? [focusedPath] : graph.attackPaths;
    if (attackMode) {
      for (const p of paths) {
        p.nodeIds.forEach((id) => nodeIds.add(id));
        for (let i = 0; i < p.nodeIds.length - 1; i++) {
          edgeKeys.add(`${p.nodeIds[i]}|${p.nodeIds[i + 1]}`);
          edgeKeys.add(`${p.nodeIds[i + 1]}|${p.nodeIds[i]}`);
        }
      }
    }
    return { nodeIds, edgeKeys };
  }, [attackMode, focusedPath, graph.attackPaths]);

  // During playback only the hops revealed so far light up.
  const playbackInfo = useMemo(() => {
    if (playbackStep === null || !focusedPath) return null;
    const revealed = new Set(focusedPath.nodeIds.slice(0, playbackStep + 1));
    const edgeKeys = new Set<string>();
    for (let i = 0; i < playbackStep; i++) {
      edgeKeys.add(`${focusedPath.nodeIds[i]}|${focusedPath.nodeIds[i + 1]}`);
      edgeKeys.add(`${focusedPath.nodeIds[i + 1]}|${focusedPath.nodeIds[i]}`);
    }
    return { revealed, edgeKeys, currentId: focusedPath.nodeIds[playbackStep] };
  }, [playbackStep, focusedPath]);

  // ---- Toxic combo helpers ----
  const focusedCombo = focusedComboId
    ? graph.toxicCombos.find((c) => c.id === focusedComboId) ?? null
    : null;
  const comboInfo = useMemo(() => {
    if (!focusedCombo) return null;
    const nodes = new Set(focusedCombo.nodeIds);
    const edgeKeys = new Set<string>();
    // Any edge between two combo members participates in the chain.
    for (const e of graph.edges) {
      if (nodes.has(e.source) && nodes.has(e.target)) {
        edgeKeys.add(`${e.source}|${e.target}`);
        edgeKeys.add(`${e.target}|${e.source}`);
      }
    }
    return { nodes, edgeKeys };
  }, [focusedCombo, graph.edges]);

  const neighborsOfSelected = selectedId ? neighborMap.get(selectedId) : undefined;

  // Opacity pipeline — the active lens wins; everything else dims.
  function nodeOpacity(id: string): number {
    if (!visibleIds.has(id)) return 0.05;
    if (replayInfo) {
      if (replayInfo.revealedNodes.has(id)) return 1;
      if (replayInfo.allNodes.has(id)) return 0.06;
      return 0.14;
    }
    if (blastInfo) {
      const hop = blastInfo.hops.get(id);
      return hop !== undefined && hop <= blastInfo.step ? 1 : 0.08;
    }
    if (comboInfo) return comboInfo.nodes.has(id) ? 1 : 0.12;
    if (attackMode) {
      if (playbackInfo) return playbackInfo.revealed.has(id) ? 1 : pathInfo.nodeIds.has(id) ? 0.25 : 0.08;
      return pathInfo.nodeIds.has(id) ? 1 : 0.12;
    }
    if (chokeMode) return (chokeCounts.get(id) ?? 0) > 0 ? 1 : 0.15;
    if (selectedId) {
      if (id === selectedId || neighborsOfSelected?.has(id)) return 1;
      return 0.18;
    }
    return 1;
  }

  function edgeOpacity(e: Edge): number {
    if (!visibleIds.has(e.source) || !visibleIds.has(e.target)) return 0.03;
    if (replayInfo) {
      if (replayInfo.revealedEdges.has(e.id)) return 1;
      if (replayInfo.allEdges.has(e.id)) return 0.02;
      return 0.06;
    }
    if (blastInfo) {
      const a = blastInfo.hops.get(e.source);
      const b = blastInfo.hops.get(e.target);
      return a !== undefined && b !== undefined && a <= blastInfo.step && b <= blastInfo.step
        ? 0.85
        : 0.04;
    }
    if (comboInfo) return comboInfo.edgeKeys.has(`${e.source}|${e.target}`) ? 1 : 0.05;
    if (attackMode) {
      if (playbackInfo) return playbackInfo.edgeKeys.has(`${e.source}|${e.target}`) ? 1 : 0.04;
      return pathInfo.edgeKeys.has(`${e.source}|${e.target}`) ? 1 : 0.06;
    }
    if (chokeMode)
      return (chokeCounts.get(e.source) ?? 0) > 0 && (chokeCounts.get(e.target) ?? 0) > 0 ? 0.7 : 0.05;
    if (selectedId) return e.source === selectedId || e.target === selectedId ? 1 : 0.08;
    return 0.75;
  }

  // Step badges along the focused (or all) attack paths.
  const stepBadges = useMemo(() => {
    if (!attackMode) return [];
    const paths = focusedPath ? [focusedPath] : graph.attackPaths;
    const badges: Array<{ x: number; y: number; n: number; key: string; revealed: boolean }> = [];
    for (const p of paths) {
      p.nodeIds.forEach((id, i) => {
        const pos = positions.get(id);
        if (pos)
          badges.push({
            x: pos.x,
            y: pos.y,
            n: i + 1,
            key: `${p.id}-${i}`,
            revealed: playbackInfo ? i <= (playbackStep ?? -1) : true,
          });
      });
    }
    return badges;
  }, [attackMode, focusedPath, graph.attackPaths, positions, playbackInfo, playbackStep]);

  const maxChoke = useMemo(
    () => Math.max(1, ...chokeCounts.values()),
    [chokeCounts]
  );

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 30%, rgba(34,211,238,0.05), transparent 60%), linear-gradient(rgba(51,65,85,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(51,65,85,0.18) 1px, transparent 1px)",
          backgroundSize: "auto, 48px 48px, 48px 48px",
        }}
      />
      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <defs>
          <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <style>{`
          @keyframes dashFlow { to { stroke-dashoffset: -30; } }
          .attack-edge { animation: dashFlow 0.9s linear infinite; }
          @keyframes ringPulse { 0%, 100% { opacity: 0.9; } 50% { opacity: 0.15; } }
          .pulse-ring { animation: ringPulse 1.1s ease-in-out infinite; }
        `}</style>

        <g transform={`translate(${transform.x} ${transform.y}) scale(${k})`}>
          {/* ===== Bird's-eye cluster layer ===== */}
          {clusterLayerOpacity > 0.01 && (
            <g
              opacity={clusterLayerOpacity}
              style={{ pointerEvents: clusterLayerOpacity > 0.5 ? "auto" : "none" }}
            >
              {clusterEdges.map((ce) => {
                const a = CLUSTER_ANCHORS[ce.a];
                const b = CLUSTER_ANCHORS[ce.b];
                const style = EDGE_STYLE[ce.worst];
                return (
                  <line
                    key={`${ce.a}-${ce.b}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={style.stroke}
                    strokeWidth={Math.min(14, 2 + ce.count * 0.45)}
                    strokeOpacity={0.45}
                    strokeLinecap="round"
                  />
                );
              })}
              {graph.clusters.map((c) => {
                const anchor = CLUSTER_ANCHORS[c.id];
                const s = clusterStats.get(c.id)!;
                const r = 95 + Math.sqrt(s.count) * 16;
                const sev = riskToSeverity(s.maxRisk);
                return (
                  <g
                    key={c.id}
                    transform={`translate(${anchor.x} ${anchor.y})`}
                    className="cursor-pointer"
                    onPointerDown={(ev) => ev.stopPropagation()}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onFocusCluster(c.id);
                    }}
                  >
                    <circle r={r} fill={c.color} fillOpacity={0.07} stroke={c.color} strokeOpacity={0.5} strokeWidth={2.5} strokeDasharray="2 7" strokeLinecap="round" />
                    <circle r={r * 0.62} fill={c.color} fillOpacity={0.1} />
                    <text textAnchor="middle" y={-8} fontSize={32} fontWeight={700} fill="#e2e8f0">
                      {c.label}
                    </text>
                    <text textAnchor="middle" y={28} fontSize={22} fill="#94a3b8">
                      {s.count} entities
                    </text>
                    {/* Severity badge */}
                    <g transform={`translate(${r * 0.62} ${-r * 0.62})`}>
                      <circle r={26} fill="#0f172a" stroke={SEVERITY_COLORS[sev]} strokeWidth={3} />
                      <text textAnchor="middle" y={8} fontSize={20} fontWeight={700} fill={SEVERITY_COLORS[sev]}>
                        {s.maxRisk}
                      </text>
                    </g>
                    {s.compromised > 0 && (
                      <text textAnchor="middle" y={58} fontSize={18} fontWeight={600} fill="#f87171">
                        ⚠ {s.compromised} compromised
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* ===== Entity layer ===== */}
          {nodeLayerOpacity > 0.02 && (
            <g
              opacity={nodeLayerOpacity}
              style={{ pointerEvents: nodeLayerOpacity > 0.5 ? "auto" : "none" }}
            >
              {/* Edges */}
              {graph.edges.map((e) => {
                const a = positions.get(e.source);
                const b = positions.get(e.target);
                if (!a || !b) return null;
                const onPath =
                  (attackMode && pathInfo.edgeKeys.has(`${e.source}|${e.target}`)) ||
                  (replayInfo?.revealedEdges.has(e.id) ?? false);
                const style = onPath ? EDGE_STYLE.attack : EDGE_STYLE[e.criticality];
                const hovered = hoveredEdge === e.id;
                return (
                  <g key={e.id}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={style.stroke}
                      strokeWidth={(hovered ? style.width + 1.2 : style.width) + (onPath ? 1.4 : 0)}
                      strokeDasharray={style.dash}
                      strokeOpacity={edgeOpacity(e)}
                      className={e.criticality === "attack" || onPath ? "attack-edge" : undefined}
                    />
                    {/* invisible fat line for easier hovering */}
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="transparent"
                      strokeWidth={12}
                      onMouseEnter={() => setHoveredEdge(e.id)}
                      onMouseLeave={() => setHoveredEdge(null)}
                    />
                    {hovered && (
                      <g transform={`translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2})`} pointerEvents="none">
                        <rect x={-62} y={-13} width={124} height={24} rx={6} fill="#0f172a" stroke="#475569" strokeWidth={0.8} />
                        <text textAnchor="middle" y={4} fontSize={11} fill="#cbd5e1">
                          {EDGE_KIND_LABELS[e.kind]}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Nodes */}
              {graph.entities.map((ent) => {
                const p = positions.get(ent.id);
                if (!p) return null;
                const opacity = nodeOpacity(ent.id);
                const color = STATUS_COLORS[ent.status];
                const isSelected = ent.id === selectedId;
                const isHovered = ent.id === hoveredNode;
                const risky = ent.status !== "healthy";
                const chokeN = chokeCounts.get(ent.id) ?? 0;
                const chokeR = chokeMode && chokeN > 0 ? NODE_R + 4 + (chokeN / maxChoke) * 14 : NODE_R;
                const blastHop = blastInfo?.hops.get(ent.id);
                const blastReached = blastHop !== undefined && blastHop <= (blastInfo?.step ?? -1);
                const isPlaybackCurrent = playbackInfo?.currentId === ent.id;
                return (
                  <g
                    key={ent.id}
                    transform={`translate(${p.x} ${p.y})`}
                    opacity={opacity}
                    className="cursor-pointer"
                    style={{ pointerEvents: opacity < 0.1 ? "none" : "auto", transition: "opacity 0.25s" }}
                    onPointerDown={(ev) => ev.stopPropagation()}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onSelect(ent.id);
                    }}
                    onMouseEnter={() => setHoveredNode(ent.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    {ent.criticalAsset && (
                      <circle r={chokeR + 6} fill="none" stroke="#c084fc" strokeWidth={2} strokeDasharray="4 4" />
                    )}
                    {isSelected && (
                      <circle r={chokeR + 10} fill="none" stroke="#22d3ee" strokeWidth={2.5} />
                    )}
                    {/* Choke-point halo */}
                    {chokeMode && chokeN > 0 && (
                      <circle r={chokeR + 3} fill="#e879f9" fillOpacity={0.12} stroke="#e879f9" strokeWidth={2} strokeOpacity={0.8} filter="url(#glow)" />
                    )}
                    {/* Blast flood-fill ring */}
                    {blastReached && (
                      <circle
                        r={NODE_R + 7}
                        fill={BLAST_COLORS[Math.min(blastHop!, BLAST_COLORS.length - 1)]}
                        fillOpacity={0.16}
                        stroke={BLAST_COLORS[Math.min(blastHop!, BLAST_COLORS.length - 1)]}
                        strokeWidth={2.2}
                        filter="url(#glow)"
                      />
                    )}
                    {/* Playback current-hop pulse */}
                    {isPlaybackCurrent && (
                      <circle r={NODE_R + 12} fill="none" stroke="#ef4444" strokeWidth={3} className="pulse-ring" />
                    )}
                    <circle
                      r={isHovered ? chokeR + 2 : chokeR}
                      fill="#0f172a"
                      stroke={chokeMode && chokeN > 0 ? "#e879f9" : color}
                      strokeWidth={2.2}
                      filter={risky ? "url(#glow)" : undefined}
                    />
                    <path
                      d={ICON_PATHS[ent.type]}
                      fill={color}
                      transform={`translate(${-NODE_R * 0.62} ${-NODE_R * 0.62}) scale(${(NODE_R * 1.24) / 24})`}
                    />
                    {/* Choke-point path count */}
                    {chokeMode && chokeN > 0 && (
                      <text textAnchor="middle" y={-chokeR - 8} fontSize={12} fontWeight={700} fill="#e879f9" pointerEvents="none">
                        {chokeN} path{chokeN === 1 ? "" : "s"}
                      </text>
                    )}
                    {(labelOpacity > 0.02 || isHovered || isSelected) && (
                      <text
                        textAnchor="middle"
                        y={chokeR + 16}
                        fontSize={10.5}
                        fill="#cbd5e1"
                        opacity={isHovered || isSelected ? 1 : labelOpacity}
                        pointerEvents="none"
                      >
                        {ent.name}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Toxic-combo badges (hidden while another lens is active) */}
              {!attackMode && !blastInfo && !replayInfo &&
                graph.toxicCombos.map((tc) => {
                  const p = positions.get(tc.anchorId);
                  if (!p || !visibleIds.has(tc.anchorId)) return null;
                  const hovered = hoveredCombo === tc.id;
                  const focused = focusedComboId === tc.id;
                  return (
                    <g
                      key={tc.id}
                      transform={`translate(${p.x + NODE_R + 6} ${p.y - NODE_R - 6})`}
                      className="cursor-pointer"
                      opacity={focusedComboId && !focused ? 0.25 : 1}
                      onPointerDown={(ev) => ev.stopPropagation()}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onSelectCombo(focused ? null : tc.id);
                      }}
                      onMouseEnter={() => setHoveredCombo(tc.id)}
                      onMouseLeave={() => setHoveredCombo(null)}
                    >
                      <circle r={10} fill="#451a03" stroke="#f59e0b" strokeWidth={2} filter={focused ? "url(#glow)" : undefined} />
                      <text textAnchor="middle" y={4.5} fontSize={12} fontWeight={700} fill="#fbbf24" pointerEvents="none">
                        ⚠
                      </text>
                      {hovered && !focused && (
                        <g transform="translate(14 -6)" pointerEvents="none">
                          <rect x={0} y={-14} width={Math.max(150, tc.name.length * 7 + 20)} height={26} rx={6} fill="#0f172a" stroke="#f59e0b" strokeOpacity={0.5} strokeWidth={0.8} />
                          <text x={10} y={3} fontSize={11} fill="#fcd34d">
                            Toxic combo: {tc.name}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

              {/* Attack-path step badges */}
              {stepBadges.map((b) =>
                b.revealed ? (
                  <g key={b.key} transform={`translate(${b.x + NODE_R + 4} ${b.y - NODE_R - 4})`} pointerEvents="none">
                    <circle r={9} fill="#ef4444" />
                    <text textAnchor="middle" y={3.5} fontSize={11} fontWeight={700} fill="#fff">
                      {b.n}
                    </text>
                  </g>
                ) : null
              )}
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
