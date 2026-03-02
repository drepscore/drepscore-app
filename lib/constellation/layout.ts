/**
 * 6-arm radial force-directed layout inspired by the Cardano logo topology.
 * Each arm = one alignment dimension. DReps gravitate toward their dominant arm.
 * Well-rounded DReps sit near center; specialists drift outward.
 */

import type { ConstellationNode, ConstellationEdge } from './types';
import type { AlignmentDimension } from '@/lib/drepIdentity';
import { getDimensionOrder, getIdentityColor } from '@/lib/drepIdentity';

const ARM_ANGLES: Record<AlignmentDimension, number> = (() => {
  const dims = getDimensionOrder();
  const map: Record<string, number> = {};
  dims.forEach((dim, i) => {
    map[dim] = (i / dims.length) * Math.PI * 2 - Math.PI / 2; // start from top
  });
  return map as Record<AlignmentDimension, number>;
})();

const VISIBLE_NODE_COUNT = 200;
const MIN_VISIBLE_RADIUS = 4;
const MAX_VISIBLE_RADIUS = 18;
const AMBIENT_RADIUS = 1.2;

interface LayoutInput {
  id: string;
  name: string | null;
  power: number;
  score: number;
  dominant: AlignmentDimension;
  alignments: number[];
}

/**
 * Compute positions for all nodes in the constellation.
 * Returns positioned nodes and inferred edges.
 */
export function computeLayout(
  inputs: LayoutInput[],
  width: number,
  height: number,
  isMobile: boolean
): { nodes: ConstellationNode[]; edges: ConstellationEdge[] } {
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.min(width, height) * 0.42;
  const nodeCount = isMobile ? Math.min(100, inputs.length) : inputs.length;

  const sorted = [...inputs].sort((a, b) => b.power - a.power);
  const visible = sorted.slice(0, Math.min(VISIBLE_NODE_COUNT, nodeCount));
  const ambient = sorted.slice(VISIBLE_NODE_COUNT, nodeCount);

  const nodes: ConstellationNode[] = [];

  for (const input of visible) {
    const pos = computeNodePosition(input, cx, cy, maxRadius);
    const r = MIN_VISIBLE_RADIUS + input.power * (MAX_VISIBLE_RADIUS - MIN_VISIBLE_RADIUS);
    nodes.push({
      ...input,
      x: pos.x,
      y: pos.y,
      radius: r,
      layer: 'visible',
      highlighted: false,
      opacity: 0.7 + input.power * 0.3,
    });
  }

  for (const input of ambient) {
    const pos = computeNodePosition(input, cx, cy, maxRadius);
    nodes.push({
      ...input,
      x: pos.x,
      y: pos.y,
      radius: AMBIENT_RADIUS,
      layer: 'ambient',
      highlighted: false,
      opacity: 0.2 + Math.random() * 0.15,
    });
  }

  // Jitter to avoid overlap: simple hash-based deterministic scatter
  for (const node of nodes) {
    const hash = simpleHash(node.id);
    const jitterRadius = node.layer === 'visible' ? 12 + hash % 20 : 6 + hash % 12;
    const jitterAngle = (hash * 2.39996) % (Math.PI * 2); // golden angle
    node.x += Math.cos(jitterAngle) * jitterRadius;
    node.y += Math.sin(jitterAngle) * jitterRadius;
  }

  const edges = computeEdges(nodes.filter(n => n.layer === 'visible'));

  return { nodes, edges };
}

function computeNodePosition(
  input: LayoutInput,
  cx: number,
  cy: number,
  maxRadius: number
): { x: number; y: number } {
  const dims = getDimensionOrder();
  const scores = input.alignments;

  // Weighted centroid across all 6 arms
  let wx = 0, wy = 0, totalWeight = 0;
  for (let i = 0; i < dims.length; i++) {
    const score = scores[i] ?? 50;
    const weight = Math.abs(score - 50); // distance from neutral = strength of pull
    const angle = ARM_ANGLES[dims[i]];
    wx += Math.cos(angle) * weight;
    wy += Math.sin(angle) * weight;
    totalWeight += weight;
  }

  if (totalWeight < 1) {
    // Very neutral DRep — place near center with slight random offset
    return { x: cx, y: cy };
  }

  // Direction from weighted centroid
  const dirAngle = Math.atan2(wy, wx);
  // Distance: specialists go further out, generalists stay central
  const specialization = totalWeight / (dims.length * 50); // 0-1 roughly
  const dist = maxRadius * (0.15 + specialization * 0.75);

  return {
    x: cx + Math.cos(dirAngle) * dist,
    y: cy + Math.sin(dirAngle) * dist,
  };
}

/**
 * Create edges between nodes that share alignment traits.
 * Keep edge count low for performance — only connect nearby similar nodes.
 */
function computeEdges(visibleNodes: ConstellationNode[]): ConstellationEdge[] {
  const edges: ConstellationEdge[] = [];
  const maxEdges = 150;

  for (let i = 0; i < visibleNodes.length && edges.length < maxEdges; i++) {
    for (let j = i + 1; j < visibleNodes.length && edges.length < maxEdges; j++) {
      const a = visibleNodes[i];
      const b = visibleNodes[j];
      if (a.dominant !== b.dominant) continue;

      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 200) continue;

      edges.push({
        from: a.id,
        to: b.id,
        opacity: Math.max(0.03, 0.08 * (1 - dist / 200)),
      });
    }
  }

  return edges;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export { ARM_ANGLES, getIdentityColor };
