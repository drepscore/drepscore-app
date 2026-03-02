'use client';

import { useRef, useMemo } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  type AlignmentScores,
  type AlignmentDimension,
  getDominantDimension,
  getIdentityColor,
  getDimensionLabel,
  getDimensionOrder,
  alignmentsToArray,
} from '@/lib/drepIdentity';
import { spring } from '@/lib/animations';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────
   GovernanceRadar — THE signature visual.
   Custom SVG radar showing 6 alignment dimensions.
   Three sizes: full (200px), medium (80px), mini (32px).
   Compare mode overlays two DRep polygons.
   ────────────────────────────────────────────── */

type RadarSize = 'full' | 'medium' | 'mini';

interface GovernanceRadarProps {
  alignments: AlignmentScores;
  compareAlignments?: AlignmentScores;
  size?: RadarSize;
  className?: string;
  animate?: boolean;
}

const SIZE_MAP: Record<RadarSize, number> = {
  full: 200,
  medium: 80,
  mini: 32,
};

const PADDING_MAP: Record<RadarSize, number> = {
  full: 40,
  medium: 8,
  mini: 2,
};

function getPolygonPoints(
  scores: number[],
  centerX: number,
  centerY: number,
  maxRadius: number,
): [number, number][] {
  return scores.map((score, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const r = maxRadius * (score / 100);
    return [centerX + r * Math.cos(angle), centerY + r * Math.sin(angle)];
  });
}

function pointsToSvgPath(pts: [number, number][]): string {
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

function getAxisEndpoints(
  centerX: number,
  centerY: number,
  radius: number,
): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    return [
      centerX + radius * Math.cos(angle),
      centerY + radius * Math.sin(angle),
    ] as [number, number];
  });
}

/** Rings for the grid background (25%, 50%, 75%, 100%) */
function GridRings({
  cx,
  cy,
  maxR,
}: {
  cx: number;
  cy: number;
  maxR: number;
}) {
  return (
    <>
      {[0.25, 0.5, 0.75, 1].map((pct) => (
        <polygon
          key={pct}
          points={pointsToSvgPath(
            Array.from({ length: 6 }, (_, i) => {
              const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
              const r = maxR * pct;
              return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as [number, number];
            })
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth={pct === 1 ? 0.8 : 0.4}
          className="text-border"
          strokeDasharray={pct === 1 ? 'none' : '2 3'}
        />
      ))}
    </>
  );
}

/** The main data polygon with identity-colored glow */
function DataPolygon({
  points,
  color,
  filterId,
  opacity = 0.2,
  shouldAnimate,
}: {
  points: string;
  color: { hex: string; rgb: [number, number, number] };
  filterId: string;
  opacity?: number;
  shouldAnimate: boolean;
}) {
  const polygonVariants = {
    hidden: {
      scale: 0,
      opacity: 0,
    },
    visible: {
      scale: 1,
      opacity: 1,
      transition: spring.smooth,
    },
  };

  return (
    <motion.g
      variants={shouldAnimate ? polygonVariants : undefined}
      initial={shouldAnimate ? 'hidden' : undefined}
      animate={shouldAnimate ? 'visible' : undefined}
      style={{ transformOrigin: 'center' }}
    >
      {/* Glow layer */}
      <polygon
        points={points}
        fill={`rgba(${color.rgb.join(',')}, ${opacity * 0.6})`}
        stroke={color.hex}
        strokeWidth={1.5}
        filter={`url(#${filterId})`}
      />
      {/* Crisp layer on top */}
      <polygon
        points={points}
        fill={`rgba(${color.rgb.join(',')}, ${opacity})`}
        stroke={color.hex}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Vertex dots */}
      {points.split(' ').map((pt, i) => {
        const [x, y] = pt.split(',').map(Number);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={2.5}
            fill={color.hex}
          />
        );
      })}
    </motion.g>
  );
}

export function GovernanceRadar({
  alignments,
  compareAlignments,
  size = 'full',
  className,
  animate = true,
}: GovernanceRadarProps) {
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const shouldAnimate = animate && isInView;

  const svgSize = SIZE_MAP[size];
  const padding = PADDING_MAP[size];
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const maxR = (svgSize - padding * 2) / 2;

  const dimensions = getDimensionOrder();
  const scores = alignmentsToArray(alignments);
  const dominant = getDominantDimension(alignments);
  const identityColor = getIdentityColor(dominant);

  const mainPoints = useMemo(
    () => pointsToSvgPath(getPolygonPoints(scores, cx, cy, maxR)),
    [scores, cx, cy, maxR],
  );

  const axisEndpoints = useMemo(
    () => getAxisEndpoints(cx, cy, maxR),
    [cx, cy, maxR],
  );

  const compareData = useMemo(() => {
    if (!compareAlignments) return null;
    const cScores = alignmentsToArray(compareAlignments);
    const cDominant = getDominantDimension(compareAlignments);
    const cColor = getIdentityColor(cDominant);
    const cPoints = pointsToSvgPath(getPolygonPoints(cScores, cx, cy, maxR));
    return { points: cPoints, color: cColor };
  }, [compareAlignments, cx, cy, maxR]);

  const filterId = `radar-glow-${size}`;
  const compareFilterId = `radar-glow-compare-${size}`;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${svgSize} ${svgSize}`}
      width={svgSize}
      height={svgSize}
      className={cn('shrink-0', className)}
      role="img"
      aria-label={`Governance radar: ${dimensions
        .map((d, i) => `${getDimensionLabel(d)} ${scores[i]}`)
        .join(', ')}`}
    >
      <defs>
        {/* Identity-colored glow filter */}
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={size === 'full' ? 6 : size === 'medium' ? 3 : 1} />
          <feComposite in2="SourceGraphic" operator="over" />
        </filter>
        {compareData && (
          <filter id={compareFilterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={size === 'full' ? 6 : 3} />
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
        )}
        {/* Radial gradient for the fill */}
        <radialGradient id={`radar-fill-${size}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={identityColor.hex} stopOpacity={0.3} />
          <stop offset="100%" stopColor={identityColor.hex} stopOpacity={0.05} />
        </radialGradient>
      </defs>

      {/* Grid rings + axis lines */}
      <GridRings cx={cx} cy={cy} maxR={maxR} />

      {axisEndpoints.map(([ex, ey], i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={ex}
          y2={ey}
          stroke="currentColor"
          strokeWidth={0.5}
          className="text-border"
        />
      ))}

      {/* Compare polygon (behind main) */}
      {compareData && (
        <DataPolygon
          points={compareData.points}
          color={compareData.color}
          filterId={compareFilterId}
          opacity={0.12}
          shouldAnimate={shouldAnimate}
        />
      )}

      {/* Main data polygon */}
      <DataPolygon
        points={mainPoints}
        color={identityColor}
        filterId={filterId}
        shouldAnimate={shouldAnimate}
      />

      {/* Dimension labels — full size only */}
      {size === 'full' &&
        axisEndpoints.map(([ex, ey], i) => {
          const dim = dimensions[i];
          const label = getDimensionLabel(dim);
          const score = scores[i];
          const dimColor = getIdentityColor(dim);

          const labelOffset = 16;
          const dx = ex - cx;
          const dy = ey - cy;
          const len = Math.sqrt(dx * dx + dy * dy);
          const nx = dx / len;
          const ny = dy / len;
          const lx = ex + nx * labelOffset;
          const ly = ey + ny * labelOffset;

          let textAnchor: 'start' | 'middle' | 'end' = 'middle';
          if (nx > 0.3) textAnchor = 'start';
          else if (nx < -0.3) textAnchor = 'end';

          return (
            <g key={dim}>
              <text
                x={lx}
                y={ly - 6}
                textAnchor={textAnchor}
                dominantBaseline="auto"
                className="fill-muted-foreground"
                fontSize={9}
                fontFamily="var(--font-geist-sans)"
              >
                {label}
              </text>
              <text
                x={lx}
                y={ly + 6}
                textAnchor={textAnchor}
                dominantBaseline="hanging"
                fill={dimColor.hex}
                fontSize={10}
                fontWeight={600}
                fontFamily="var(--font-geist-mono)"
              >
                {score}
              </text>
            </g>
          );
        })}
    </svg>
  );
}
