'use client';

import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { motion, useInView, useSpring } from 'framer-motion';
import {
  type AlignmentScores,
  getDominantDimension,
  getIdentityColor,
  getHexVertices,
  hexVerticesToPath,
} from '@/lib/drepIdentity';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────
   HexScore — Procedural hexagonal score display.
   6 vertices mapped to alignment dimensions.
   Three sizes: hero (120px), card (48px), badge (24px).
   ────────────────────────────────────────────── */

type HexSize = 'hero' | 'card' | 'badge';

interface HexScoreProps {
  score: number;
  alignments: AlignmentScores;
  size?: HexSize;
  className?: string;
  animate?: boolean;
}

const SIZE_MAP: Record<HexSize, number> = {
  hero: 120,
  card: 48,
  badge: 24,
};

function useCountUp(target: number, shouldAnimate: boolean): number {
  const [display, setDisplay] = useState(shouldAnimate ? 0 : target);
  const springValue = useSpring(0, {
    stiffness: 80,
    damping: 20,
    restDelta: 0.5,
  });

  useEffect(() => {
    if (shouldAnimate) {
      springValue.set(target);
    } else {
      setDisplay(target);
    }
  }, [target, shouldAnimate, springValue]);

  useEffect(() => {
    const unsubscribe = springValue.on('change', (v) => {
      setDisplay(Math.round(v));
    });
    return unsubscribe;
  }, [springValue]);

  return display;
}

/** Edge particles — hero size only, disabled on reduced-motion and mobile */
function EdgeParticles({
  vertices,
  color,
  size,
}: {
  vertices: [number, number][];
  color: string;
  size: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<
    { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }[]
  >([]);
  const rafRef = useRef<number>(0);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);

    const particles = particlesRef.current;

    if (particles.length < 20 && Math.random() > 0.6) {
      const edgeIdx = Math.floor(Math.random() * 6);
      const [x1, y1] = vertices[edgeIdx];
      const [x2, y2] = vertices[(edgeIdx + 1) % 6];
      const t = Math.random();
      particles.push({
        x: x1 + (x2 - x1) * t,
        y: y1 + (y2 - y1) * t,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        life: 0,
        maxLife: 40 + Math.random() * 40,
      });
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life++;

      if (p.life > p.maxLife) {
        particles.splice(i, 1);
        continue;
      }

      const alpha = 1 - p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
      ctx.fillStyle = `${color}${Math.round(alpha * 180).toString(16).padStart(2, '0')}`;
      ctx.fill();
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [vertices, color, size]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;

    const isMobile = window.innerWidth < 768;
    if (isMobile) return;

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="absolute inset-0 pointer-events-none"
    />
  );
}

export function HexScore({
  score,
  alignments,
  size = 'hero',
  className,
  animate: enableAnim = true,
}: HexScoreProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-30px' });
  const shouldAnimate = enableAnim && isInView;

  const svgSize = SIZE_MAP[size];
  const dominant = getDominantDimension(alignments);
  const identityColor = getIdentityColor(dominant);

  const vertices = useMemo(
    () => getHexVertices(alignments, svgSize),
    [alignments, svgSize],
  );

  const polygonPoints = useMemo(
    () => hexVerticesToPath(vertices),
    [vertices],
  );

  const animatedScore = useCountUp(score, shouldAnimate);

  const filterId = `hex-glow-${size}`;
  const noiseId = `hex-noise-${size}`;

  const showParticles = size === 'hero';
  const showNumber = size !== 'badge';
  const showGlow = size !== 'badge';

  return (
    <div
      ref={ref}
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: svgSize, height: svgSize }}
    >
      <motion.svg
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        width={svgSize}
        height={svgSize}
        initial={shouldAnimate ? { scale: 0.8, opacity: 0 } : undefined}
        animate={shouldAnimate ? { scale: 1, opacity: 1 } : undefined}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        role="img"
        aria-label={`Score: ${score}`}
      >
        <defs>
          {showGlow && (
            <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation={size === 'hero' ? 8 : 3}
              />
              <feComposite in2="SourceGraphic" operator="over" />
            </filter>
          )}
          {size === 'hero' && (
            <filter id={noiseId}>
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.8"
                numOctaves="4"
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
              <feBlend in="SourceGraphic" mode="overlay" />
            </filter>
          )}
        </defs>

        {/* Glow layer */}
        {showGlow && (
          <polygon
            points={polygonPoints}
            fill={`rgba(${identityColor.rgb.join(',')}, 0.15)`}
            stroke={identityColor.hex}
            strokeWidth={size === 'hero' ? 1.5 : 1}
            filter={`url(#${filterId})`}
            className={size === 'hero' ? 'animate-breathing-glow' : undefined}
          />
        )}

        {/* Main hex with noise texture (hero) or solid fill */}
        <polygon
          points={polygonPoints}
          fill={`rgba(${identityColor.rgb.join(',')}, ${size === 'hero' ? 0.08 : 0.12})`}
          stroke={identityColor.hex}
          strokeWidth={size === 'hero' ? 1.5 : size === 'card' ? 1 : 0.5}
          strokeLinejoin="round"
          filter={size === 'hero' ? `url(#${noiseId})` : undefined}
        />

        {/* Score number */}
        {showNumber && (
          <text
            x={svgSize / 2}
            y={svgSize / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontSize={size === 'hero' ? 28 : 14}
            fontWeight={700}
            fontFamily="var(--font-geist-mono)"
            style={{
              textShadow: `0 0 12px ${identityColor.hex}`,
            }}
          >
            {animatedScore}
          </text>
        )}
      </motion.svg>

      {showParticles && (
        <EdgeParticles
          vertices={vertices}
          color={identityColor.hex}
          size={svgSize}
        />
      )}
    </div>
  );
}
