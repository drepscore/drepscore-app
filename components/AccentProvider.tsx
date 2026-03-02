'use client';

import { type ReactNode } from 'react';
import { type AlignmentDimension, getIdentityCSSVars } from '@/lib/drepIdentity';

interface AccentProviderProps {
  dimension?: AlignmentDimension;
  color?: string;
  rgb?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Sets contextual identity accent CSS variables on a wrapping element.
 * All descendant components that use var(--identity) or var(--identity-rgb)
 * will pick up the accent color.
 *
 * Usage:
 *   <AccentProvider dimension="innovation">  — use a named dimension
 *   <AccentProvider color="#dc2626" rgb="220 38 38">  — use explicit values
 */
export function AccentProvider({
  dimension,
  color,
  rgb,
  children,
  className,
}: AccentProviderProps) {
  let style: Record<string, string> = {};

  if (dimension) {
    style = getIdentityCSSVars(dimension);
  } else if (color && rgb) {
    style = {
      '--identity': color,
      '--identity-rgb': rgb,
    };
  }

  return (
    <div style={style} className={className}>
      {children}
    </div>
  );
}
