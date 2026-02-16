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

/**
 * Generate meaningful proposal title when metadata title is missing
 */
export function getProposalDisplayTitle(
  title: string | null,
  proposalTxHash: string,
  proposalIndex: number
): string {
  if (title) return title;
  
  // Generate fallback title from transaction hash and index
  const shortHash = proposalTxHash.slice(0, 8);
  return `Governance Action #${proposalIndex} (${shortHash})`;
}

/**
 * Extract social media platform name from URL
 */
export function extractSocialPlatform(uri: string, label?: string): string {
  // If label is provided, is a string, and not generic, use it
  if (label && typeof label === 'string' && label.toLowerCase() !== 'label' && label.toLowerCase() !== 'link') {
    return label;
  }

  try {
    const url = new URL(uri);
    const hostname = url.hostname.toLowerCase();
    
    // Map common platforms
    const platformMap: Record<string, string> = {
      'twitter.com': 'Twitter/X',
      'x.com': 'Twitter/X',
      't.co': 'Twitter/X',
      'linkedin.com': 'LinkedIn',
      'lnkd.in': 'LinkedIn',
      'github.com': 'GitHub',
      'gitlab.com': 'GitLab',
      'facebook.com': 'Facebook',
      'instagram.com': 'Instagram',
      'youtube.com': 'YouTube',
      'reddit.com': 'Reddit',
      'medium.com': 'Medium',
      'discord.com': 'Discord',
      'discord.gg': 'Discord',
      'telegram.org': 'Telegram',
      't.me': 'Telegram',
      'telegram.me': 'Telegram',
      'linktr.ee': 'Linktree',
      'cardano.org': 'Cardano Foundation',
      'iohk.io': 'IOHK',
      'emurgo.io': 'EMURGO',
    };

    // Check for exact matches
    for (const [domain, platform] of Object.entries(platformMap)) {
      if (hostname === domain || hostname === `www.${domain}`) {
        return platform;
      }
    }

    // Check for subdomain matches (e.g., blog.example.com)
    for (const [domain, platform] of Object.entries(platformMap)) {
      if (hostname.endsWith(`.${domain}`)) {
        return platform;
      }
    }

    // Fallback: use domain name (remove www. if present)
    return hostname.replace(/^www\./, '');
  } catch (error) {
    // If URL parsing fails, return the label (if string) or a generic fallback
    return (label && typeof label === 'string') ? label : 'Link';
  }
}
