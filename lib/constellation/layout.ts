/**
 * 6-arm radial layout inspired by the Cardano logo topology.
 * Outputs 3D positions for React Three Fiber rendering.
 * Each arm = one alignment dimension with angular fanning.
 */

import type { ConstellationNode3D, ConstellationEdge3D, LayoutResult } from './types';
import type { AlignmentDimension } from '@/lib/drepIdentity';
import { getDimensionOrder } from '@/lib/drepIdentity';

const ARM_ANGLES: Record<AlignmentDimension, number> = (() => {
  const dims = getDimensionOrder();
  const map: Record<string, number> = {};
  dims.forEach((dim, i) => {
    map[dim] = (i / dims.length) * Math.PI * 2 - Math.PI / 2;
  });
  return map as Record<AlignmentDimension, number>;
})();

const ARM_FAN_ARC = Math.PI / 4; // 45 degrees of spread within each arm
const MAX_RADIUS = 12;
const MIN_VISIBLE_SCALE = 0.06;
const MAX_VISIBLE_SCALE = 0.25;

interface LayoutInput {
  id: string;
  name: string | null;
  power: number;
  score: number;
  dominant: AlignmentDimension;
  alignments: number[];
}

export function computeLayout(
  inputs: LayoutInput[],
  nodeLimit: number
): LayoutResult {
  const sorted = [...inputs].sort((a, b) => b.power - a.power);
  const active = sorted.slice(0, nodeLimit);

  const nodes: ConstellationNode3D[] = [];
  const nodeMap = new Map<string, ConstellationNode3D>();

  for (const input of active) {
    const pos = computeNodePosition(input);
    const scale = MIN_VISIBLE_SCALE + input.power * (MAX_VISIBLE_SCALE - MIN_VISIBLE_SCALE);
    const node: ConstellationNode3D = {
      ...input,
      position: pos,
      scale,
    };
    nodes.push(node);
    nodeMap.set(node.id, node);
  }

  const edges = computeEdges(nodes);
  return { nodes, edges, nodeMap };
}

function computeNodePosition(input: LayoutInput): [number, number, number] {
  const dims = getDimensionOrder();
  const scores = input.alignments;

  let wx = 0, wy = 0, totalWeight = 0;
  for (let i = 0; i < dims.length; i++) {
    const score = scores[i] ?? 50;
    const weight = Math.abs(score - 50);
    const angle = ARM_ANGLES[dims[i]];
    wx += Math.cos(angle) * weight;
    wy += Math.sin(angle) * weight;
    totalWeight += weight;
  }

  const hash = simpleHash(input.id);
  const hashNorm = (hash % 10000) / 10000;

  if (totalWeight < 1) {
    const r = 0.5 + hashNorm * 1.5;
    const a = hashNorm * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r, (hashNorm - 0.5) * 2];
  }

  const dirAngle = Math.atan2(wy, wx);
  const specialization = Math.min(1, totalWeight / (dims.length * 30));
  const dist = MAX_RADIUS * (0.1 + specialization * 0.85);

  // Fan within the arm: offset angle based on hash for spread
  const fanOffset = (hashNorm - 0.5) * ARM_FAN_ARC;
  const finalAngle = dirAngle + fanOffset;

  // Radial jitter for natural feel
  const radialJitter = (((hash >> 8) % 1000) / 1000 - 0.5) * MAX_RADIUS * 0.15;

  const x = Math.cos(finalAngle) * (dist + radialJitter);
  const y = Math.sin(finalAngle) * (dist + radialJitter);
  const z = (input.score / 100 - 0.5) * 3 + (hashNorm - 0.5) * 1.5;

  return [x, y, z];
}

function computeEdges(nodes: ConstellationNode3D[]): ConstellationEdge3D[] {
  const edges: ConstellationEdge3D[] = [];
  const maxEdges = 200;

  for (let i = 0; i < nodes.length && edges.length < maxEdges; i++) {
    for (let j = i + 1; j < nodes.length && edges.length < maxEdges; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (a.dominant !== b.dominant) continue;

      const dx = a.position[0] - b.position[0];
      const dy = a.position[1] - b.position[1];
      const dz = a.position[2] - b.position[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > 4) continue;

      edges.push({ from: a.position, to: b.position });
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
