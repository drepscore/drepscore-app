/**
 * Data Layer - Supabase Cache with Koios Fallback
 * Fast reads from Supabase with automatic freshness checks and sync triggering
 */

import { createClient } from './supabase';
import { getEnrichedDReps, EnrichedDRep } from './koios';
import { isWellDocumented } from '@/utils/documentation';

const CACHE_FRESHNESS_MINUTES = 15;

/**
 * Transform Supabase row to EnrichedDRep
 * Full transformation with all fields preserved for API route serving
 */
function transformSupabaseRowToDRep(row: any): EnrichedDRep {
  const info = row.info || {};
  
  return {
    drepId: row.id,
    drepHash: info.drepHash || '',
    handle: info.handle || null,
    name: info.name || null,
    ticker: info.ticker || null,
    description: info.description || null,
    votingPower: info.votingPower || 0,
    votingPowerLovelace: info.votingPowerLovelace || '0',
    participationRate: row.participation_rate || 0,
    rationaleRate: row.rationale_rate || 0,
    decentralizationScore: row.decentralization_score || 0,
    sizeTier: row.size_tier || 'Small',
    delegatorCount: info.delegatorCount || 0,
    totalVotes: info.totalVotes || 0,
    yesVotes: info.yesVotes || 0,
    noVotes: info.noVotes || 0,
    abstainVotes: info.abstainVotes || 0,
    isActive: info.isActive || false,
    anchorUrl: info.anchorUrl || null,
    metadata: row.metadata || null,
    drepScore: row.score || 0,
  };
}

/**
 * Trigger background sync without blocking
 * Note: In production, this should be handled by a cron job or external trigger
 */
async function triggerBackgroundSync() {
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    console.log('[Data] ⚠ Data is stale (>15min), sync recommended');
    console.log('[Data] Run: npm run sync');
  }
  
  // In production, this would trigger a webhook or queue job
  // For now, we just log a warning
}

/**
 * Get all DReps with caching and fallback
 * Returns same structure as getEnrichedDReps() for drop-in replacement
 */
export async function getAllDReps(): Promise<{
  dreps: EnrichedDRep[];
  allDReps: EnrichedDRep[];
  error: boolean;
  totalAvailable: number;
}> {
  const isDev = process.env.NODE_ENV === 'development';
  
  try {
    if (isDev) {
      console.log('[Data] Querying Supabase cache...');
    }
    
    const supabase = createClient();
    
    // Query all DReps ordered by score
    const { data: rows, error: supabaseError } = await supabase
      .from('dreps')
      .select('*')
      .order('score', { ascending: false });
    
    if (supabaseError) {
      console.error('[Data] Supabase query failed:', supabaseError.message);
      throw new Error('Supabase unavailable');
    }
    
    // Check if we have data
    if (!rows || rows.length === 0) {
      console.warn('[Data] No data in Supabase, falling back to Koios');
      console.warn('[Data] Run: npm run sync');
      return await getEnrichedDReps(false);
    }
    
    if (isDev) {
      console.log(`[Data] ✓ Retrieved ${rows.length} DReps from Supabase`);
    }
    
    // Check freshness
    const timestamps = rows
      .map(r => r.updated_at ? new Date(r.updated_at).getTime() : 0)
      .filter(t => t > 0);
    
    if (timestamps.length > 0) {
      const maxTimestamp = Math.max(...timestamps);
      const maxUpdatedAt = new Date(maxTimestamp);
      const freshnessThreshold = new Date(Date.now() - CACHE_FRESHNESS_MINUTES * 60 * 1000);
      const isStale = maxUpdatedAt < freshnessThreshold;
      
      if (isStale) {
        const ageMinutes = Math.round((Date.now() - maxTimestamp) / 1000 / 60);
        if (isDev) {
          console.log(`[Data] ⚠ Cache is stale (${ageMinutes} min old)`);
        }
        // Trigger sync in background (non-blocking)
        triggerBackgroundSync();
      } else if (isDev) {
        const ageMinutes = Math.round((Date.now() - maxTimestamp) / 1000 / 60);
        console.log(`[Data] ✓ Cache is fresh (${ageMinutes} min old)`);
      }
    }
    
    // Transform Supabase rows to EnrichedDRep[] (full data)
    const allDReps = rows.map(transformSupabaseRowToDRep);
    
    // Filter to well-documented DReps (default view)
    const wellDocumentedDReps = allDReps.filter(d => isWellDocumented(d));
    
    if (isDev) {
      console.log(`[Data] Well documented: ${wellDocumentedDReps.length}/${allDReps.length}`);
    }
    
    return {
      dreps: wellDocumentedDReps,
      allDReps: allDReps,
      error: false,
      totalAvailable: allDReps.length,
    };
    
  } catch (error: any) {
    console.error('[Data] Cache read failed, falling back to Koios:', error.message);
    
    // Fallback to direct Koios fetch
    if (isDev) {
      console.log('[Data] Fetching directly from Koios (slow)...');
    }
    
    return await getEnrichedDReps(false);
  }
}

/**
 * Get a single DRep by ID
 * Returns DRep data or null if not found
 */
export async function getDRepById(drepId: string): Promise<EnrichedDRep | null> {
  const isDev = process.env.NODE_ENV === 'development';
  
  try {
    if (isDev) {
      console.log(`[Data] Querying Supabase for DRep: ${drepId}`);
    }
    
    const supabase = createClient();
    
    const { data: row, error: supabaseError } = await supabase
      .from('dreps')
      .select('*')
      .eq('id', drepId)
      .single();
    
    if (supabaseError) {
      console.error('[Data] Supabase query failed:', supabaseError.message);
      throw new Error('Supabase unavailable');
    }
    
    if (!row) {
      if (isDev) {
        console.warn(`[Data] DRep ${drepId} not found in cache`);
      }
      return null;
    }
    
    if (isDev) {
      console.log(`[Data] ✓ Found DRep ${drepId} in cache`);
    }
    
    return transformSupabaseRowToDRep(row);
    
  } catch (error: any) {
    console.error('[Data] Cache read failed for DRep:', drepId, error.message);
    
    // For detail page, we could fallback to Koios fetchDRepDetails
    // but that would require restructuring the detail page
    // For now, return null and let the page handle it
    return null;
  }
}
