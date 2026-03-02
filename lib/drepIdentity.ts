/**
 * DRep Identity System — dominant alignment dimension + identity color palette.
 * Shared foundation used by Session 12 constellation and Session 13 visual identity.
 */

export type AlignmentDimension =
  | 'treasuryConservative'
  | 'treasuryGrowth'
  | 'decentralization'
  | 'security'
  | 'innovation'
  | 'transparency';

export interface IdentityColor {
  hex: string;
  rgb: [number, number, number];
  label: string;
}

const IDENTITY_COLORS: Record<AlignmentDimension, IdentityColor> = {
  treasuryConservative: { hex: '#dc2626', rgb: [220, 38, 38], label: 'Deep Red' },
  treasuryGrowth:       { hex: '#10b981', rgb: [16, 185, 129], label: 'Emerald' },
  decentralization:     { hex: '#a855f7', rgb: [168, 85, 247], label: 'Purple' },
  security:             { hex: '#f59e0b', rgb: [245, 158, 11], label: 'Amber' },
  innovation:           { hex: '#06b6d4', rgb: [6, 182, 212], label: 'Cyan' },
  transparency:         { hex: '#3b82f6', rgb: [59, 130, 246], label: 'Blue' },
};

const DIMENSION_LABELS: Record<AlignmentDimension, string> = {
  treasuryConservative: 'Treasury Conservative',
  treasuryGrowth: 'Treasury Growth',
  decentralization: 'Decentralization',
  security: 'Security',
  innovation: 'Innovation',
  transparency: 'Transparency',
};

const DIMENSION_ORDER: AlignmentDimension[] = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
];

export interface AlignmentScores {
  treasuryConservative: number | null;
  treasuryGrowth: number | null;
  decentralization: number | null;
  security: number | null;
  innovation: number | null;
  transparency: number | null;
}

/**
 * Extract the 6 alignment scores from a DRep row (DB column names → typed object).
 */
export function extractAlignments(row: {
  alignment_treasury_conservative?: number | null;
  alignment_treasury_growth?: number | null;
  alignment_decentralization?: number | null;
  alignment_security?: number | null;
  alignment_innovation?: number | null;
  alignment_transparency?: number | null;
  alignmentTreasuryConservative?: number | null;
  alignmentTreasuryGrowth?: number | null;
  alignmentDecentralization?: number | null;
  alignmentSecurity?: number | null;
  alignmentInnovation?: number | null;
  alignmentTransparency?: number | null;
}): AlignmentScores {
  return {
    treasuryConservative: row.alignment_treasury_conservative ?? row.alignmentTreasuryConservative ?? null,
    treasuryGrowth: row.alignment_treasury_growth ?? row.alignmentTreasuryGrowth ?? null,
    decentralization: row.alignment_decentralization ?? row.alignmentDecentralization ?? null,
    security: row.alignment_security ?? row.alignmentSecurity ?? null,
    innovation: row.alignment_innovation ?? row.alignmentInnovation ?? null,
    transparency: row.alignment_transparency ?? row.alignmentTransparency ?? null,
  };
}

/**
 * Get the 6 alignment scores as an ordered array [0-100 each].
 * Null scores default to 50.
 */
export function alignmentsToArray(scores: AlignmentScores): number[] {
  return DIMENSION_ORDER.map(dim => scores[dim] ?? 50);
}

/**
 * Determine a DRep's dominant alignment dimension — the one furthest from 50.
 * Ties broken by order in DIMENSION_ORDER.
 */
export function getDominantDimension(scores: AlignmentScores): AlignmentDimension {
  let best: AlignmentDimension = 'transparency';
  let bestDistance = -1;

  for (const dim of DIMENSION_ORDER) {
    const val = scores[dim] ?? 50;
    const distance = Math.abs(val - 50);
    if (distance > bestDistance) {
      bestDistance = distance;
      best = dim;
    }
  }

  return best;
}

export function getIdentityColor(dimension: AlignmentDimension): IdentityColor {
  return IDENTITY_COLORS[dimension];
}

export function getDimensionLabel(dimension: AlignmentDimension): string {
  return DIMENSION_LABELS[dimension];
}

export function getDimensionOrder(): AlignmentDimension[] {
  return [...DIMENSION_ORDER];
}

export function getAllIdentityColors(): Record<AlignmentDimension, IdentityColor> {
  return { ...IDENTITY_COLORS };
}
