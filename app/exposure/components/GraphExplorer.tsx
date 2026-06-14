"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  blastRadius,
  chokePointCounts,
  orgRiskScore,
  pathsThroughNode,
  rankFixes,
} from "../lib/analytics";
import { buildGraphData } from "../lib/data";
import { computeLayout, CLUSTER_ANCHORS } from "../lib/graph-layout";
import { riskToSeverity, SEVERITY_COLORS, SEVERITY_ORDER } from "../lib/style";
import type { AttackPath, ClusterId, Entity, Fix, Severity } from "../lib/types";
import ExecOverlay from "./ExecOverlay";
import GraphCanvas, { type BlastInfo, type ReplayInfo, type Transform } from "./GraphCanvas";
import RemediationQueue from "./RemediationQueue";
import SidePanel from "./SidePanel";
import Sparkline from "./Sparkline";
import Toolbar from "./Toolbar";

const MIN_ZOOM = 0.12;
const MAX_ZOOM = 6;
const BLAST_HOP_MS = 320;
const PLAYBACK_HOP_MS = 2200;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Animates a displayed number towards its target (for the org risk score).
function useAnimatedNumber(target: number, duration = 700) {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(display);
  displayRef.current = display;
  useEffect(() => {
    const from = displayRef.current;
    if (from === target) return;
    const start = performance.now();
    let raf: number;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(from + (target - from) * easeInOutCubic(t)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return display;
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

  // ---- Core view state ----
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

  // ---- Lens / mode state ----
  const [chokeMode, setChokeMode] = useState(false);
  const [blastSourceId, setBlastSourceId] = useState<string | null>(null);
  const [blastStep, setBlastStep] = useState(0);
  const [appliedFixIds, setAppliedFixIds] = useState<Set<string>>(() => new Set());
  const [focusedComboId, setFocusedComboId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<{ step: number; playing: boolean } | null>(null);
  const [replayStep, setReplayStep] = useState<number | null>(null); // null = replay off
  const [execMode, setExecMode] = useState(false);

  // ---- Fix simulation: effective graph after applied fixes ----
  const severedEdgeIds = useMemo(() => {
    const s = new Set<string>();
    for (const f of graph.fixes) {
      if (appliedFixIds.has(f.id)) for (const id of f.severedEdgeIds) s.add(id);
    }
    return s;
  }, [graph.fixes, appliedFixIds]);

  const severedPathIds = useMemo(() => {
    const s = new Set<string>();
    for (const f of graph.fixes) {
      if (appliedFixIds.has(f.id)) for (const id of f.severedPathIds) s.add(id);
    }
    return s;
  }, [graph.fixes, appliedFixIds]);

  const effectiveGraph = useMemo(
    () => ({
      ...graph,
      edges: graph.edges.filter((e) => !severedEdgeIds.has(e.id)),
      attackPaths: graph.attackPaths.filter((p) => !severedPathIds.has(p.id)),
    }),
    [graph, severedEdgeIds, severedPathIds]
  );

  const appliedFixes = useMemo(
    () => graph.fixes.filter((f) => appliedFixIds.has(f.id)),
    [graph.fixes, appliedFixIds]
  );

  const neighborMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of effectiveGraph.edges) {
      if (!m.has(e.source)) m.set(e.source, new Set());
      if (!m.has(e.target)) m.set(e.target, new Set());
      m.get(e.source)!.add(e.target);
      m.get(e.target)!.add(e.source);
    }
    return m;
  }, [effectiveGraph.edges]);

  // ---- Analytics ----
  const chokeCounts = useMemo(
    () => chokePointCounts(effectiveGraph.attackPaths),
    [effectiveGraph.attackPaths]
  );

  const orgRisk = useMemo(
    () => orgRiskScore(graph.entities, effectiveGraph.attackPaths, appliedFixes),
    [graph.entities, effectiveGraph.attackPaths, appliedFixes]
  );
  const displayedRisk = useAnimatedNumber(orgRisk);

  const riskTrend = useMemo(() => [...graph.riskTrend, orgRisk], [graph.riskTrend, orgRisk]);
  const riskDelta = orgRisk - riskTrend[riskTrend.length - 8];

  const rankedFixes = useMemo(
    () => rankFixes(graph.fixes, appliedFixIds, effectiveGraph.attackPaths),
    [graph.fixes, appliedFixIds, effectiveGraph.attackPaths]
  );

  const blastHops = useMemo(
    () => (blastSourceId ? blastRadius(blastSourceId, effectiveGraph.edges) : null),
    [blastSourceId, effectiveGraph.edges]
  );
  const blastMaxHop = useMemo(
    () => (blastHops ? Math.max(...blastHops.values()) : 0),
    [blastHops]
  );

  // Advance the blast flood-fill one hop at a time.
  useEffect(() => {
    if (!blastSourceId) return;
    setBlastStep(0);
    const iv = setInterval(() => {
      setBlastStep((s) => {
        if (s >= blastMaxHop) {
          clearInterval(iv);
          return s;
        }
        return s + 1;
      });
    }, BLAST_HOP_MS);
    return () => clearInterval(iv);
  }, [blastSourceId, blastMaxHop]);

  const blastInfo: BlastInfo | null =
    blastSourceId && blastHops
      ? { sourceId: blastSourceId, hops: blastHops, step: blastStep }
      : null;

  const blastSummary = useMemo(() => {
    if (!blastSourceId || !blastHops) return null;
    const reached = [...blastHops.keys()].filter((id) => id !== blastSourceId);
    const critical = reached
      .map((id) => entityById.get(id))
      .filter((e): e is Entity => Boolean(e && e.criticalAsset));
    return { sourceId: blastSourceId, reachedCount: reached.length, critical };
  }, [blastSourceId, blastHops, entityById]);

  // ---- Camera ----
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

  const fitTransform = useCallback((w: number, h: number): Transform => {
    const k = Math.max(MIN_ZOOM, Math.min(w, h) / 1900);
    return { x: w / 2, y: h / 2, k };
  }, []);

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

  const focusNodes = useCallback(
    (nodeIds: string[], pad = 220, minK = MIN_ZOOM) => {
      const pts = nodeIds
        .map((id) => positions.get(id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p));
      if (pts.length === 0) return;
      const minX = Math.min(...pts.map((p) => p.x));
      const maxX = Math.max(...pts.map((p) => p.x));
      const minY = Math.min(...pts.map((p) => p.y));
      const maxY = Math.max(...pts.map((p) => p.y));
      const k = Math.min(
        MAX_ZOOM,
        Math.max(
          minK,
          Math.min(size.w / (maxX - minX + pad * 2), size.h / (maxY - minY + pad * 2))
        )
      );
      centerOn((minX + maxX) / 2, (minY + maxY) / 2, k);
    },
    [positions, size, centerOn]
  );

  // ---- Mode transitions (special lenses are mutually exclusive) ----
  const exitBlast = useCallback(() => {
    setBlastSourceId(null);
    setBlastStep(0);
  }, []);

  const clearLenses = useCallback(() => {
    exitBlast();
    setFocusedComboId(null);
    setReplayStep(null);
    setPlayback(null);
  }, [exitBlast]);

  const selectEntity = useCallback(
    (id: string | null, pan = false) => {
      setSelectedId(id);
      if (blastSourceId && id !== blastSourceId) exitBlast();
      if (id === null) setFocusedComboId(null);
      if (id && pan) {
        const p = positions.get(id);
        if (p) {
          const k = Math.max(transformRef.current.k, 1.7);
          // Shift left so the node isn't hidden behind the side panel.
          centerOn(p.x, p.y, k, 170);
        }
      }
    },
    [positions, centerOn, blastSourceId, exitBlast]
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
      setPlayback(null);
      if (!path) return;
      setAttackMode(true);
      clearLenses();
      setFocusedPathId(path.id);
      focusNodes(path.nodeIds);
    },
    [focusNodes, clearLenses]
  );

  const startBlast = useCallback(
    (id: string) => {
      setAttackMode(false);
      setFocusedPathId(null);
      setFocusedComboId(null);
      setReplayStep(null);
      setPlayback(null);
      setSelectedId(id);
      setBlastSourceId(id);
    },
    []
  );

  const selectCombo = useCallback(
    (comboId: string | null) => {
      setFocusedComboId(comboId);
      if (!comboId) return;
      setAttackMode(false);
      setFocusedPathId(null);
      exitBlast();
      setReplayStep(null);
      const combo = graph.toxicCombos.find((c) => c.id === comboId);
      if (combo) focusNodes(combo.nodeIds);
    },
    [graph.toxicCombos, focusNodes, exitBlast]
  );

  const toggleAttackMode = useCallback(() => {
    setAttackMode((on) => {
      if (on) {
        setFocusedPathId(null);
        setPlayback(null);
      } else {
        clearLenses();
        setChokeMode(false);
      }
      return !on;
    });
  }, [clearLenses]);

  const toggleChokeMode = useCallback(() => {
    setChokeMode((on) => {
      if (!on) {
        setAttackMode(false);
        setFocusedPathId(null);
        clearLenses();
      }
      return !on;
    });
  }, [clearLenses]);

  const toggleReplay = useCallback(() => {
    setReplayStep((s) => {
      if (s !== null) return null;
      setAttackMode(false);
      setFocusedPathId(null);
      setChokeMode(false);
      setFocusedComboId(null);
      exitBlast();
      setPlayback(null);
      setSelectedId(null);
      // Frame the incident subgraph — keep zoom above the semantic-zoom
      // threshold so individual entities (not cluster bubbles) are shown.
      const ids = graph.incident.steps.flatMap((st) => st.revealNodeIds);
      focusNodes(ids, 160, 0.95);
      return 1;
    });
  }, [graph.incident.steps, focusNodes, exitBlast]);

  const resetView = useCallback(() => {
    setSelectedId(null);
    setFocusedPathId(null);
    clearLenses();
    if (size.w > 0) animateTo(fitTransform(size.w, size.h));
  }, [animateTo, fitTransform, size, clearLenses]);

  // ---- Fix simulation actions ----
  const toggleFix = useCallback((fix: Fix) => {
    setAppliedFixIds((prev) => {
      const next = new Set(prev);
      if (next.has(fix.id)) next.delete(fix.id);
      else next.add(fix.id);
      return next;
    });
  }, []);

  const focusFix = useCallback(
    (fix: Fix) => {
      const edgeById = new Map(graph.edges.map((e) => [e.id, e]));
      const ids = new Set<string>([fix.targetEntityId]);
      for (const eid of fix.severedEdgeIds) {
        const e = edgeById.get(eid);
        if (e) {
          ids.add(e.source);
          ids.add(e.target);
        }
      }
      setSelectedId(fix.targetEntityId);
      focusNodes([...ids], 260);
    },
    [graph.edges, focusNodes]
  );

  // ---- Attack-path playback ----
  const focusedPath = focusedPathId
    ? effectiveGraph.attackPaths.find((p) => p.id === focusedPathId) ?? null
    : null;

  useEffect(() => {
    if (!playback?.playing || !focusedPath) return;
    const iv = setInterval(() => {
      setPlayback((pb) => {
        if (!pb) return pb;
        if (pb.step >= focusedPath.nodeIds.length - 1) return { ...pb, playing: false };
        return { ...pb, step: pb.step + 1 };
      });
    }, PLAYBACK_HOP_MS);
    return () => clearInterval(iv);
  }, [playback?.playing, focusedPath]);

  // Camera follows the current playback hop.
  useEffect(() => {
    if (!playback || !focusedPath) return;
    const p = positions.get(focusedPath.nodeIds[playback.step]);
    if (p) centerOn(p.x, p.y, Math.max(transformRef.current.k, 1.9));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback?.step]);

  // ---- Incident replay reveal sets ----
  const replayInfo: ReplayInfo | null = useMemo(() => {
    if (replayStep === null) return null;
    const revealedNodes = new Set<string>();
    const revealedEdges = new Set<string>();
    const allNodes = new Set<string>();
    const allEdges = new Set<string>();
    graph.incident.steps.forEach((st, i) => {
      st.revealNodeIds.forEach((id) => {
        allNodes.add(id);
        if (i < replayStep) revealedNodes.add(id);
      });
      st.revealEdgeIds.forEach((id) => {
        allEdges.add(id);
        if (i < replayStep) revealedEdges.add(id);
      });
    });
    return { revealedNodes, revealedEdges, allNodes, allEdges };
  }, [replayStep, graph.incident.steps]);

  // ---- Keyboard: Esc exits lenses/exec, E toggles exec view ----
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        if (execMode) setExecMode(false);
        else {
          clearLenses();
          setSelectedId(null);
        }
      } else if ((ev.key === "e" || ev.key === "E") && !(ev.target instanceof HTMLInputElement)) {
        setExecMode((m) => !m);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [execMode, clearLenses]);

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
  const focusedCombo = focusedComboId
    ? graph.toxicCombos.find((c) => c.id === focusedComboId) ?? null
    : null;

  const chokeInfo = useMemo(() => {
    if (!selected) return null;
    const count = chokeCounts.get(selected.id) ?? 0;
    if (count === 0) return null;
    return {
      count,
      total: effectiveGraph.attackPaths.length,
      paths: pathsThroughNode(selected.id, effectiveGraph.attackPaths),
    };
  }, [selected, chokeCounts, effectiveGraph.attackPaths]);

  const stats = useMemo(() => {
    const assets = graph.entities.filter((e) => e.type !== "alert");
    return {
      assets: assets.length,
      critical: graph.entities.filter((e) => e.riskScore >= 80).length,
      compromised: graph.entities.filter((e) => e.status === "compromised").length,
      paths: effectiveGraph.attackPaths.length,
    };
  }, [graph, effectiveGraph.attackPaths]);

  const riskColor = SEVERITY_COLORS[riskToSeverity(orgRisk)];
  const incidentSteps = graph.incident.steps;

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
            <h1 className="text-sm font-bold tracking-wide text-slate-100">ExposureGraph</h1>
            <p className="text-[11px] text-slate-400">Organization Exposure Management</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3 text-[11px]">
          {/* Org risk posture + trend */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1.5">
            <div className="text-center">
              <div className="text-base font-bold leading-tight" style={{ color: riskColor }}>
                {displayedRisk}
              </div>
              <div className="text-[10px] text-slate-500">Org risk</div>
            </div>
            <Sparkline data={riskTrend} width={84} height={26} color={riskColor} />
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                riskDelta <= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
              }`}
            >
              {riskDelta <= 0 ? "▼" : "▲"} {Math.abs(riskDelta)} / 7d
            </span>
          </div>
          <StatCard label="Monitored assets" value={stats.assets} accent="text-cyan-300" />
          <StatCard label="Critical exposures" value={stats.critical} accent="text-orange-300" />
          <StatCard label="Compromised" value={stats.compromised} accent="text-red-400" />
          <StatCard label="Attack paths" value={stats.paths} accent="text-fuchsia-300" />
          <button
            onClick={() => setExecMode(true)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-semibold text-slate-300 transition hover:border-cyan-500/50 hover:text-cyan-300"
            title="Board-ready posture view (E)"
          >
            Exec view
          </button>
        </div>
      </header>

      {/* Canvas + overlays */}
      <div className="relative flex-1">
        <GraphCanvas
          graph={effectiveGraph}
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
          chokeMode={chokeMode}
          chokeCounts={chokeCounts}
          blastInfo={blastInfo}
          focusedComboId={focusedComboId}
          onSelectCombo={selectCombo}
          playbackStep={playback?.step ?? null}
          replayInfo={replayInfo}
        />

        <Toolbar
          graph={effectiveGraph}
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
          chokeMode={chokeMode}
          onToggleChokeMode={toggleChokeMode}
          replayActive={replayStep !== null}
          onToggleReplay={toggleReplay}
          focusedPathId={focusedPathId}
          onFocusPath={focusPath}
          onSearchSelect={(id) => selectEntity(id, true)}
          onZoomIn={() => zoomBy(1.45)}
          onZoomOut={() => zoomBy(1 / 1.45)}
          onResetView={resetView}
          zoom={transform.k}
        />

        <RemediationQueue
          ranked={rankedFixes}
          onToggleFix={toggleFix}
          onFocusFix={focusFix}
        />

        <SidePanel
          entity={selected}
          graph={effectiveGraph}
          entityById={entityById}
          onClose={() => selectEntity(null)}
          onNavigate={(id) => selectEntity(id, true)}
          chokeInfo={chokeInfo}
          onFocusPath={focusPath}
          blastActive={blastSourceId === selected?.id}
          blastSummary={blastSummary?.sourceId === selected?.id ? blastSummary : null}
          onStartBlast={startBlast}
          onExitBlast={exitBlast}
        />

        {/* Attack-path playback bar */}
        {attackMode && focusedPath && (
          <PlaybackBar
            path={focusedPath}
            playback={playback}
            onStart={() => setPlayback({ step: 0, playing: true })}
            onPlayPause={() => setPlayback((pb) => (pb ? { ...pb, playing: !pb.playing } : { step: 0, playing: true }))}
            onStep={(d) =>
              setPlayback((pb) => {
                const max = focusedPath.nodeIds.length - 1;
                const cur = pb?.step ?? 0;
                return { step: Math.max(0, Math.min(max, cur + d)), playing: false };
              })
            }
            onStop={() => setPlayback(null)}
          />
        )}

        {/* Toxic-combo explanation card */}
        {focusedCombo && (
          <div className="absolute bottom-5 left-1/2 z-10 w-[480px] -translate-x-1/2 rounded-xl border border-amber-500/40 bg-slate-950/95 p-4 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                  ⚠ Toxic combination
                </div>
                <h3 className="mt-0.5 text-sm font-bold text-slate-100">{focusedCombo.name}</h3>
              </div>
              <button
                onClick={() => selectCombo(null)}
                className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                aria-label="Close combo"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-slate-400">{focusedCombo.explanation}</p>
            <ul className="mt-2 space-y-1">
              {focusedCombo.ingredients.map((ing, i) => (
                <li key={i} className="flex items-center gap-2 text-[11px] text-slate-300">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[9px] font-bold text-amber-300">
                    {i + 1}
                  </span>
                  {ing}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Incident replay scrubber */}
        {replayStep !== null && (
          <div className="absolute bottom-5 left-1/2 z-10 w-[560px] -translate-x-1/2 rounded-xl border border-red-500/40 bg-slate-950/95 p-4 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
                  Incident replay — {graph.incident.name}
                </div>
                <h3 className="mt-0.5 text-sm font-bold text-slate-100">
                  {incidentSteps[replayStep - 1].time} · {incidentSteps[replayStep - 1].title}
                </h3>
                <p className="mt-1 text-[12px] leading-snug text-slate-400">
                  {incidentSteps[replayStep - 1].description}
                </p>
              </div>
              <button
                onClick={toggleReplay}
                className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                aria-label="Close replay"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={incidentSteps.length}
                step={1}
                value={replayStep}
                onChange={(e) => setReplayStep(Number(e.target.value))}
                className="flex-1 accent-red-500"
              />
              <span className="text-[11px] tabular-nums text-slate-400">
                {replayStep} / {incidentSteps.length}
              </span>
            </div>
            <div className="mt-1 flex justify-between text-[9px] text-slate-600">
              {incidentSteps.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setReplayStep(i + 1)}
                  className={`${i + 1 <= replayStep ? "text-red-400" : ""} hover:text-slate-300`}
                >
                  {s.time}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Exec mode overlay */}
        {execMode && (
          <ExecOverlay
            score={orgRisk}
            scoreColor={riskColor}
            delta={riskDelta}
            trend={riskTrend}
            ranked={rankedFixes}
            entities={graph.entities}
            activePathCount={effectiveGraph.attackPaths.length}
            onClose={() => setExecMode(false)}
          />
        )}
      </div>
    </div>
  );
}

function PlaybackBar({
  path,
  playback,
  onStart,
  onPlayPause,
  onStep,
  onStop,
}: {
  path: AttackPath;
  playback: { step: number; playing: boolean } | null;
  onStart: () => void;
  onPlayPause: () => void;
  onStep: (d: number) => void;
  onStop: () => void;
}) {
  const step = playback?.step ?? -1;
  const caption = step >= 0 ? path.hopCaptions[step] : null;
  return (
    <div className="absolute bottom-5 left-1/2 z-10 w-[520px] -translate-x-1/2 rounded-xl border border-red-500/40 bg-slate-950/95 p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
            Attack-path playback
          </div>
          <h3 className="truncate text-sm font-bold text-slate-100">{path.name}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {playback === null ? (
            <button
              onClick={onStart}
              className="rounded-md bg-red-500/20 px-3 py-1.5 text-[11px] font-semibold text-red-300 transition hover:bg-red-500/30"
            >
              ▶ Play breach
            </button>
          ) : (
            <>
              <TransportButton onClick={() => onStep(-1)} label="Step back">⏮</TransportButton>
              <TransportButton onClick={onPlayPause} label={playback.playing ? "Pause" : "Play"}>
                {playback.playing ? "⏸" : "▶"}
              </TransportButton>
              <TransportButton onClick={() => onStep(1)} label="Step forward">⏭</TransportButton>
              <TransportButton onClick={onStop} label="Stop">✕</TransportButton>
            </>
          )}
        </div>
      </div>
      {caption && (
        <div className="mt-2.5 flex items-start gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {step + 1}
          </span>
          <p className="text-[12px] leading-snug text-slate-300">{caption}</p>
        </div>
      )}
      {playback && (
        <div className="mt-2 flex gap-1">
          {path.nodeIds.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? "bg-red-500" : "bg-slate-800"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TransportButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-300 transition hover:border-red-500/50 hover:text-red-300"
    >
      {children}
    </button>
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
