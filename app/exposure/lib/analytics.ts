import type { AttackPath, Edge, Entity, Fix } from "./types";

// Pure, deterministic graph analytics computed client-side over the mock data.

// Number of attack paths traversing each node (choke-point weight).
export function chokePointCounts(paths: AttackPath[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of paths) {
    for (const id of p.nodeIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export function pathsThroughNode(nodeId: string, paths: AttackPath[]): AttackPath[] {
  return paths.filter((p) => p.nodeIds.includes(nodeId));
}

// BFS reachability from a node, following the direction an attacker could
// move: outgoing edges always, plus communicates_with in both directions.
// Detection edges (affected_by) are not traversable.
// Returns hop depth per reachable node (source itself is hop 0).
export function blastRadius(sourceId: string, edges: Edge[]): Map<string, number> {
  const out = new Map<string, Array<string>>();
  const link = (a: string, b: string) => {
    if (!out.has(a)) out.set(a, []);
    out.get(a)!.push(b);
  };
  for (const e of edges) {
    if (e.kind === "affected_by") continue;
    link(e.source, e.target);
    if (e.kind === "communicates_with") link(e.target, e.source);
  }
  const hops = new Map<string, number>([[sourceId, 0]]);
  let frontier = [sourceId];
  let depth = 0;
  while (frontier.length > 0) {
    depth++;
    const next: string[] = [];
    for (const id of frontier) {
      for (const n of out.get(id) ?? []) {
        if (!hops.has(n)) {
          hops.set(n, depth);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return hops;
}

// Org-wide risk posture score (0-100): mean of the riskiest entities plus a
// penalty per live attack path. Applied fixes subtract their riskDelta.
export function orgRiskScore(
  entities: Entity[],
  activePaths: AttackPath[],
  appliedFixes: Fix[]
): number {
  const top = entities
    .map((e) => e.riskScore)
    .sort((a, b) => b - a)
    .slice(0, 12);
  const base = top.reduce((s, r) => s + r, 0) / Math.max(1, top.length);
  const pathPenalty = activePaths.length * 4;
  const fixCredit = appliedFixes.reduce((s, f) => s + f.riskDelta, 0);
  return Math.max(5, Math.min(100, Math.round(base * 0.72 + pathPenalty - fixCredit)));
}

// Rank fixes by live impact: paths they would still sever (given fixes already
// applied), then by risk reduction.
export function rankFixes(
  fixes: Fix[],
  appliedFixIds: Set<string>,
  activePaths: AttackPath[]
): Array<{ fix: Fix; pathsSevered: number; applied: boolean }> {
  const activePathIds = new Set(activePaths.map((p) => p.id));
  return fixes
    .map((fix) => ({
      fix,
      applied: appliedFixIds.has(fix.id),
      pathsSevered: fix.severedPathIds.filter((id) => activePathIds.has(id)).length,
    }))
    .sort((a, b) => {
      if (a.applied !== b.applied) return a.applied ? 1 : -1;
      if (b.pathsSevered !== a.pathsSevered) return b.pathsSevered - a.pathsSevered;
      return b.fix.riskDelta - a.fix.riskDelta;
    });
}
