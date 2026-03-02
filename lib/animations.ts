'use client';

import { type Transition, type Variants } from 'framer-motion';

/* ──────────────────────────────────────────────
   Spring presets — the animation vocabulary
   for the entire app. Every animated element
   uses one of these three springs.
   ────────────────────────────────────────────── */

export const spring = {
  snappy: { type: 'spring', stiffness: 400, damping: 30 } as Transition,
  smooth: { type: 'spring', stiffness: 200, damping: 25 } as Transition,
  bouncy: { type: 'spring', stiffness: 300, damping: 15 } as Transition,
} as const;

/* ──────────────────────────────────────────────
   Shared animation variants
   ────────────────────────────────────────────── */

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: spring.smooth,
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4 },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: spring.snappy,
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerSlow: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
};

/* ──────────────────────────────────────────────
   Radar-specific variants
   ────────────────────────────────────────────── */

export const radarReveal: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { ...spring.smooth, delay: 0.1 },
  },
};

export const radarAxisReveal: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { ...spring.smooth, duration: 0.8 },
  },
};

/* ──────────────────────────────────────────────
   Hex score morphing
   ────────────────────────────────────────────── */

export const hexMorph: Variants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: spring.bouncy,
  },
};
