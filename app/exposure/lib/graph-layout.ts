import type { ClusterId, Edge, Entity, NodePosition } from "./types";

export const WORLD_SIZE = 2000; // logical coordinate space, centered at 0,0

// Fixed anchor centers per cluster, arranged on a ring so the bird's-eye
// view is stable and readable.
export const CLUSTER_ANCHORS: Record<ClusterId, NodePosition> = (() => {
  const order: ClusterId[] = ["identities", "endpoints", "servers", "cloud", "data", "alerts"];
  const radius = 620;
  const anchors = {} as Record<ClusterId, NodePosition>;
  order.forEach((id, i) => {
    const angle = (i / order.length) * Math.PI * 2 - Math.PI / 2;
    anchors[id] = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
  return anchors;
})();

/**
 * Small force simulation: node-node repulsion within each cluster, spring
 * attraction along edges, and gravity toward the cluster anchor. Runs
 * synchronously once at load; positions are deterministic (seeded jitter).
 */
export function computeLayout(entities: Entity[], edges: Edge[]): Map<string, NodePosition> {
  // Deterministic initial placement: spiral around the cluster anchor.
  const perClusterCount = new Map<ClusterId, number>();
  const pos = new Map<string, { x: number; y: number }>();
  const vel = new Map<string, { x: number; y: number }>();

  for (const ent of entities) {
    const i = perClusterCount.get(ent.cluster) ?? 0;
    perClusterCount.set(ent.cluster, i + 1);
    const anchor = CLUSTER_ANCHORS[ent.cluster];
    const angle = i * 2.39996; // golden angle
    const r = 14 * Math.sqrt(i + 1);
    pos.set(ent.id, { x: anchor.x + Math.cos(angle) * r, y: anchor.y + Math.sin(angle) * r });
    vel.set(ent.id, { x: 0, y: 0 });
  }

  const byCluster = new Map<ClusterId, Entity[]>();
  const clusterOf = new Map<string, ClusterId>();
  for (const ent of entities) {
    const list = byCluster.get(ent.cluster) ?? [];
    list.push(ent);
    byCluster.set(ent.cluster, list);
    clusterOf.set(ent.id, ent.cluster);
  }

  const ITERATIONS = 150;
  const REPULSION = 1500;
  const SPRING = 0.012;
  const SPRING_LENGTH = 140;
  const GRAVITY = 0.045;
  const DAMPING = 0.82;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    // Repulsion only within the same cluster — keeps clusters compact
    // and avoids O(n^2) over the whole graph.
    for (const list of byCluster.values()) {
      for (let i = 0; i < list.length; i++) {
        const a = pos.get(list[i].id)!;
        const va = vel.get(list[i].id)!;
        for (let j = i + 1; j < list.length; j++) {
          const b = pos.get(list[j].id)!;
          const vb = vel.get(list[j].id)!;
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) {
            dx = ((i * 7 + j) % 13) - 6;
            dy = ((i * 11 + j) % 17) - 8;
            d2 = dx * dx + dy * dy;
          }
          const f = REPULSION / d2;
          const d = Math.sqrt(d2);
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          va.x += fx;
          va.y += fy;
          vb.x -= fx;
          vb.y -= fy;
        }
      }
    }

    // Spring forces along edges (weak across clusters so anchors dominate).
    for (const edge of edges) {
      const a = pos.get(edge.source);
      const b = pos.get(edge.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const sameCluster = clusterOf.get(edge.source) === clusterOf.get(edge.target);
      const k = sameCluster ? SPRING : SPRING * 0.08;
      const f = k * (d - SPRING_LENGTH);
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      const va = vel.get(edge.source)!;
      const vb = vel.get(edge.target)!;
      va.x += fx;
      va.y += fy;
      vb.x -= fx;
      vb.y -= fy;
    }

    // Gravity toward cluster anchor + integrate.
    for (const ent of entities) {
      const p = pos.get(ent.id)!;
      const v = vel.get(ent.id)!;
      const anchor = CLUSTER_ANCHORS[ent.cluster];
      v.x += (anchor.x - p.x) * GRAVITY;
      v.y += (anchor.y - p.y) * GRAVITY;
      v.x *= DAMPING;
      v.y *= DAMPING;
      p.x += v.x;
      p.y += v.y;
    }
  }

  return pos;
}
