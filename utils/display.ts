/**
 * Display Utilities for DRep Names and Formatting
 */

import { DRep } from '@/types/drep';

/**
 * Get formatted display name for a DRep
 * Priority: Name (Ticker) > $Handle > Shortened DRep ID
 */
export function getDRepDisplayName(drep: Pick<DRep, 'name' | 'ticker' | 'handle' | 'drepId'>): string {
  // Priority 1: Name with optional ticker
  if (drep.name) {
    if (drep.ticker) {
      return `${drep.name} (${drep.ticker})`;
    }
    return drep.name;
  }

  // Priority 2: Ticker alone
  if (drep.ticker) {
    return drep.ticker;
  }

  // Priority 3: Handle
  if (drep.handle) {
    return drep.handle;
  }

  // Fallback: Shortened DRep ID
  return shortenDRepId(drep.drepId);
}

/**
 * Get primary display name (without ticker in parentheses)
 */
export function getDRepPrimaryName(drep: Pick<DRep, 'name' | 'ticker' | 'handle' | 'drepId'>): string {
  return drep.name || drep.ticker || drep.handle || shortenDRepId(drep.drepId);
}

/**
 * Check if DRep has custom metadata
 */
export function hasCustomMetadata(drep: Pick<DRep, 'name' | 'ticker' | 'description'>): boolean {
  return !!(drep.name || drep.ticker || drep.description);
}

/**
 * Get display name with "Unnamed DRep" fallback
 */
export function getDRepDisplayNameOrUnnamed(drep: Pick<DRep, 'name' | 'ticker' | 'handle' | 'drepId'>): {
  name: string;
  isUnnamed: boolean;
} {
  const hasName = !!(drep.name || drep.ticker || drep.handle);
  
  if (hasName) {
    return {
      name: getDRepDisplayName(drep),
      isUnnamed: false,
    };
  }

  return {
    name: 'Unnamed DRep',
    isUnnamed: true,
  };
}

/**
 * Shorten DRep ID for display
 */
export function shortenDRepId(drepId: string, prefixLength: number = 10, suffixLength: number = 6): string {
  if (drepId.length <= prefixLength + suffixLength) return drepId;
  return `${drepId.slice(0, prefixLength)}...${drepId.slice(-suffixLength)}`;
}

/**
 * Format ticker for display (uppercase, max 10 chars)
 */
export function formatTicker(ticker: string | null): string | null {
  if (!ticker) return null;
  return ticker.toUpperCase().slice(0, 10);
}

/**
 * Truncate description for preview
 */
export function truncateDescription(description: string | null, maxLength: number = 150): string | null {
  if (!description) return null;
  if (description.length <= maxLength) return description;
  return `${description.slice(0, maxLength)}...`;
}
