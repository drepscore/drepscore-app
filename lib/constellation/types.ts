import type { AlignmentDimension } from '@/lib/drepIdentity';

export interface ConstellationNode {
  id: string;
  name: string | null;
  power: number;        // 0-1 normalized voting power
  score: number;        // 0-100
  dominant: AlignmentDimension;
  alignments: number[]; // 6 values in dimension order
  x: number;
  y: number;
  radius: number;
  layer: 'visible' | 'ambient';
  highlighted: boolean;
  opacity: number;
}

export interface ConstellationEdge {
  from: string;
  to: string;
  opacity: number;
}

export interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
  color: string;
  size: number;
}

export interface VotePulse {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  opacity: number;
  speed: number;
}

export interface FindMeTarget {
  type: 'delegated' | 'undelegated' | 'drep';
  drepId?: string;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
}

export interface ConstellationState {
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
  particles: Particle[];
  pulses: VotePulse[];
  camera: CameraState;
  mouseX: number;
  mouseY: number;
  width: number;
  height: number;
  dpr: number;
  theme: 'dark' | 'light';
  animating: boolean;
  contracted: boolean;
  reducedMotion: boolean;
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
  }>;
  recentEvents: ConstellationEvent[];
  stats: {
    totalAdaGoverned: string;
    activeProposals: number;
    votesThisWeek: number;
    activeDReps: number;
  };
}
