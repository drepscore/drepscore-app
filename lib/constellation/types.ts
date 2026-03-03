import type { AlignmentDimension } from '@/lib/drepIdentity';

export type GovernanceNodeType = 'drep' | 'spo' | 'cc';

export interface ConstellationNode3D {
  id: string;
  name: string | null;
  power: number;
  score: number;
  dominant: AlignmentDimension;
  alignments: number[];
  position: [number, number, number];
  scale: number;
  isAnchor?: boolean;
  nodeType: GovernanceNodeType;
}

export interface ConstellationEdge3D {
  from: [number, number, number];
  to: [number, number, number];
}

export interface FindMeTarget {
  type: 'delegated' | 'undelegated' | 'drep' | 'spo';
  drepId?: string;
  poolId?: string;
}

export interface ConstellationEvent {
  type: 'vote' | 'delegation' | 'rationale' | 'proposal';
  drepId: string;
  detail?: string;
  vote?: 'Yes' | 'No' | 'Abstain';
  timestamp: number;
}

export interface ConstellationApiData {
  nodes: Array<{
    id: string;
    name: string | null;
    power: number;
    score: number;
    dominant: AlignmentDimension;
    alignments: number[];
    nodeType: GovernanceNodeType;
  }>;
  recentEvents: ConstellationEvent[];
  stats: {
    totalAdaGoverned: string;
    activeProposals: number;
    votesThisWeek: number;
    activeDReps: number;
    activeSpOs: number;
    ccMembers: number;
  };
}

export interface LayoutResult {
  nodes: ConstellationNode3D[];
  edges: ConstellationEdge3D[];
  nodeMap: Map<string, ConstellationNode3D>;
}
