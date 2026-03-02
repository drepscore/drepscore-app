'use client';

import { type ReactNode } from 'react';
import { motion, type Variants } from 'framer-motion';
import { fadeInUp, spring } from '@/lib/animations';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  variants?: Variants;
  delay?: number;
}

/**
 * Wraps content in a Framer Motion element that animates on scroll-into-view.
 * Uses IntersectionObserver internally (via whileInView).
 * Respects prefers-reduced-motion via CSS (Framer Motion's default).
 */
export function ScrollReveal({
  children,
  className,
  variants = fadeInUp,
  delay = 0,
}: ScrollRevealProps) {
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      transition={{ ...spring.smooth, delay }}
    >
      {children}
    </motion.div>
  );
}
