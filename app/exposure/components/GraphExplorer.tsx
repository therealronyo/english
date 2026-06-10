"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { buildGraphData } from "../lib/data";
import { computeLayout, CLUSTER_ANCHORS } from "../lib/graph-layout";
import { riskToSeverity, SEVERITY_ORDER } from "../lib/style";
import type { AttackPath, ClusterId, Entity, Severity } from "../lib/types";
import GraphCanvas, { type Transform } from "./GraphCanvas";
import SidePanel from "./SidePanel";
import Toolbar from "./Toolbar";

const MIN_ZOOM = 0.12;
const MAX_ZOOM = 6;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function GraphExplorer() {
  const { graph, positions } = useMemo(() => {
    const g = buildGraphData();
    return { graph: g, positions: computeLayout(g.entities, g.edges) };
  }, []);

  const entityById = useMemo(() => {
    const m = new Map<string, Entity>();
    for (const e of graph.entities) m.set(e.id, e);
    return m;
  }, [graph]);

  const neighborMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of graph.edges) {
      if (!m.has(e.source)) m.set(e.source, new Set());
      if (!m.has(e.target)) m.set(e.target, new Set());
      m.get(e.source)!.add(e.target);
      m.get(e.target)!.add(e.source);
    }
    return m;
  }, [graph]);

  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 0.2 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [initialized, setInitialized] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeClusters, setActiveClusters] = useState<Set<ClusterId>>(
    () => new Set(graph.clusters.map((c) => c.id))
  );
  const [minSeverity, setMinSeverity] = useState<Severity>("low");
  const [attackMode, setAttackMode] = useState(false);
  const [focusedPathId, setFocusedPathId] = useState<string | null>(null);

  const animRef = useRef<number | null>(null);
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const animateTo = useCallback((target: Transform, duration = 650) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const from = { ...transformRef.current };
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const p = easeInOutCubic(t);
      setTransform({
        x: from.x + (target.x - from.x) * p,
        y: from.y + (target.y - from.y) * p,
        k: from.k + (target.k - from.k) * p,
      });
      if (t < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, []);

  const stopAnimation = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
  }, []);

  const fitTransform = useCallback(
    (w: number, h: number): Transform => {
      const k = Math.max(MIN_ZOOM, Math.min(w, h) / 1900);
      return { x: w / 2, y: h / 2, k };
    },
    []
  );

  const handleSizeChange = useCallback(
    (w: number, h: number) => {
      setSize({ w, h });
      // First measurement: fit the whole org into view.
      if (!initialized && w > 0 && h > 0) {
        setTransform(fitTransform(w, h));
        setInitialized(true);
      }
    },
    [fitTransform, initialized]
  );

  const centerOn = useCallback(
    (x: number, y: number, k: number, panelOffset = 0) => {
      animateTo({ x: size.w / 2 - panelOffset - x * k, y: size.h / 2 - y * k, k });
    },
    [animateTo, size]
  );

  const selectEntity = useCallback(
    (id: string | null, pan = false) => {
      setSelectedId(id);
      if (id && pan) {
        const p = positions.get(id);
        if (p) {
          const k = Math.max(transformRef.current.k, 1.7);
          // Shift left so the node isn't hidden behind the side panel.
          centerOn(p.x, p.y, k, 170);
        }
      }
    },
    [positions, centerOn]
  );

  const focusCluster = useCallback(
    (clusterId: ClusterId) => {
      const anchor = CLUSTER_ANCHORS[clusterId];
      centerOn(anchor.x, anchor.y, 1.35);
    },
    [centerOn]
  );

  const focusPath = useCallback(
    (path: AttackPath | null) => {
      setFocusedPathId(path?.id ?? null);
      if (!path) return;
      const pts = path.nodeIds
        .map((id) => positions.get(id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p));
      if (pts.length === 0) return;
      const minX = Math.min(...pts.map((p) => p.x));
      const maxX = Math.max(...pts.map((p) => p.x));
      const minY = Math.min(...pts.map((p) => p.y));
      const maxY = Math.max(...pts.map((p) => p.y));
      const pad = 220;
      const k = Math.min(
        MAX_ZOOM,
        Math.max(
          MIN_ZOOM,
          Math.min(size.w / (maxX - minX + pad * 2), size.h / (maxY - minY + pad * 2))
        )
      );
      centerOn((minX + maxX) / 2, (minY + maxY) / 2, k);
    },
    [positions, size, centerOn]
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const t = transformRef.current;
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.k * factor));
      const f = k / t.k;
      const cx = size.w / 2;
      const cy = size.h / 2;
      animateTo({ x: cx - (cx - t.x) * f, y: cy - (cy - t.y) * f, k }, 280);
    },
    [animateTo, size]
  );

  const resetView = useCallback(() => {
    setSelectedId(null);
    setFocusedPathId(null);
    if (size.w > 0) animateTo(fitTransform(size.w, size.h));
  }, [animateTo, fitTransform, size]);

  const toggleAttackMode = useCallback(() => {
    setAttackMode((on) => {
      if (on) setFocusedPathId(null);
      return !on;
    });
  }, []);

  // Filtered (visible) entities.
  const visibleIds = useMemo(() => {
    const minIdx = SEVERITY_ORDER.indexOf(minSeverity);
    const ids = new Set<string>();
    for (const e of graph.entities) {
      if (!activeClusters.has(e.cluster)) continue;
      if (SEVERITY_ORDER.indexOf(riskToSeverity(e.riskScore)) < minIdx) continue;
      ids.add(e.id);
    }
    return ids;
  }, [graph, activeClusters, minSeverity]);

  const selected = selectedId ? entityById.get(selectedId) ?? null : null;
  const focusedPath = focusedPathId
    ? graph.attackPaths.find((p) => p.id === focusedPathId) ?? null
    : null;

  const stats = useMemo(() => {
    const assets = graph.entities.filter((e) => e.type !== "alert");
    return {
      assets: assets.length,
      critical: graph.entities.filter((e) => e.riskScore >= 80).length,
      compromised: graph.entities.filter((e) => e.status === "compromised").length,
      paths: graph.attackPaths.length,
    };
  }, [graph]);

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950 text-slate-200 font-[Inter,sans-serif] overflow-hidden">
      {/* Header */}
      <header className="relative z-20 flex items-center gap-6 border-b border-slate-800 bg-slate-950/90 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 ring-1 ring-cyan-400/40">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-cyan-400">
              <path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5Zm0 4.5a2 2 0 1 1-2 2 2 2 0 0 1 2-2Zm-5 8 3.6-2.1m2.8 0L17 14.5" />
              <circle cx="6" cy="15.5" r="1.6" />
              <circle cx="18" cy="15.5" r="1.6" />
              <path d="M7.4 14.7 10 13m4 0 2.6 1.7" stroke="#22d3ee" strokeWidth="1.2" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide text-slate-100">
              ExposureGraph
            </h1>
            <p className="text-[11px] text-slate-400">
              Organization Exposure Management
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3 text-[11px]">
          <StatCard label="Monitored assets" value={stats.assets} accent="text-cyan-300" />
          <StatCard label="Critical exposures" value={stats.critical} accent="text-orange-300" />
          <StatCard label="Compromised" value={stats.compromised} accent="text-red-400" />
          <StatCard label="Attack paths" value={stats.paths} accent="text-fuchsia-300" />
        </div>
      </header>

      {/* Canvas + overlays */}
      <div className="relative flex-1">
        <GraphCanvas
          graph={graph}
          positions={positions}
          transform={transform}
          onTransformChange={(t) => {
            stopAnimation();
            setTransform(t);
          }}
          onSizeChange={handleSizeChange}
          selectedId={selectedId}
          onSelect={(id) => selectEntity(id, false)}
          onFocusCluster={focusCluster}
          visibleIds={visibleIds}
          neighborMap={neighborMap}
          attackMode={attackMode}
          focusedPath={focusedPath}
        />

        <Toolbar
          graph={graph}
          activeClusters={activeClusters}
          onToggleCluster={(id) =>
            setActiveClusters((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          minSeverity={minSeverity}
          onMinSeverity={setMinSeverity}
          attackMode={attackMode}
          onToggleAttackMode={toggleAttackMode}
          focusedPathId={focusedPathId}
          onFocusPath={focusPath}
          onSearchSelect={(id) => selectEntity(id, true)}
          onZoomIn={() => zoomBy(1.45)}
          onZoomOut={() => zoomBy(1 / 1.45)}
          onResetView={resetView}
          zoom={transform.k}
        />

        <SidePanel
          entity={selected}
          graph={graph}
          entityById={entityById}
          onClose={() => setSelectedId(null)}
          onNavigate={(id) => selectEntity(id, true)}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-center">
      <div className={`text-base font-bold leading-tight ${accent}`}>{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}
