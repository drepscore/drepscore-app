/**
 * Koios API Integration Layer
 * Provides typed helpers for fetching Cardano governance data
 */

import {
  DRepListResponse,
  DRepInfoResponse,
  DRepMetadata,
  DRepMetadataResponse,
  DRepVotesResponse,
  ProposalListResponse,
} from '@/types/koios';
import { KoiosError } from '@/types/drep';

const KOIOS_BASE_URL = process.env.NEXT_PUBLIC_KOIOS_BASE_URL || 'https://api.koios.rest/api/v1';
const KOIOS_API_KEY = process.env.KOIOS_API_KEY;

// Cache revalidation time (15 minutes)
const CACHE_REVALIDATE_TIME = 900;

/**
 * Base fetch wrapper with error handling and caching
 */
async function koiosFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<T> {
  const url = `${KOIOS_BASE_URL}${endpoint}`;
  const isDev = process.env.NODE_ENV === 'development';
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(KOIOS_API_KEY && { 'Authorization': `Bearer ${KOIOS_API_KEY}` }),
    ...options.headers,
  };

  if (isDev) {
    console.log(`[Koios] Fetching: ${endpoint}`, options.method || 'GET');
  }

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      ...options,
      headers,
      next: { revalidate: CACHE_REVALIDATE_TIME },
    });

    if (isDev) {
      console.log(`[Koios] ${endpoint} completed in ${Date.now() - startTime}ms`);
    }

    if (!response.ok) {
      // Handle rate limiting with exponential backoff
      if (response.status === 429 && retryCount < 3) {
        const waitTime = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        if (isDev) {
          console.warn(`[Koios] Rate limited, retrying in ${waitTime}ms...`);
        }
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return koiosFetch<T>(endpoint, options, retryCount + 1);
      }

      throw new Error(`Koios API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    const koiosError: KoiosError = {
      message: error instanceof Error ? error.message : 'Unknown error fetching from Koios',
      retryable: retryCount < 3,
    };
    
    console.error('[Koios] API Error:', koiosError);
    throw koiosError;
  }
}

/**
 * Fetch all registered DReps
 */
export async function fetchAllDReps(): Promise<DRepListResponse> {
  try {
    const data = await koiosFetch<DRepListResponse>('/drep_list');
    return data || [];
  } catch (error) {
    console.error('Error fetching DRep list:', error);
    return [];
  }
}

/**
 * Fetch detailed information for specific DReps
 */
export async function fetchDRepInfo(drepIds: string[]): Promise<DRepInfoResponse> {
  try {
    if (drepIds.length === 0) return [];
    
    const data = await koiosFetch<DRepInfoResponse>('/drep_info', {
      method: 'POST',
      body: JSON.stringify({ _drep_ids: drepIds }),
    });
    
    return data || [];
  } catch (error) {
    console.error('Error fetching DRep info:', error);
    return [];
  }
}

/**
 * Fetch metadata for specific DReps
 * Includes name, ticker, description from metadata JSON
 * Cached for 15 minutes via Next.js fetch cache
 */
export async function fetchDRepMetadata(drepIds: string[]): Promise<DRepMetadataResponse> {
  const isDev = process.env.NODE_ENV === 'development';
  
  try {
    if (drepIds.length === 0) return [];
    
    if (isDev) {
      console.log(`[Koios] Fetching metadata for ${drepIds.length} DReps (includes name, ticker, description)`);
    }
    
    const data = await koiosFetch<DRepMetadataResponse>('/drep_metadata', {
      method: 'POST',
      body: JSON.stringify({ _drep_ids: drepIds }),
    });
    
    if (isDev && data) {
      // Count metadata by source format
      const withCIP119Names = data.filter(m => m.meta_json?.body?.givenName).length;
      const withLegacyNames = data.filter(m => m.meta_json?.name).length;
      const withTickers = data.filter(m => m.meta_json?.ticker).length;
      const withCIP119Objectives = data.filter(m => m.meta_json?.body?.objectives).length;
      const withLegacyDescriptions = data.filter(m => m.meta_json?.description).length;
      const withAnchorUrl = data.filter(m => m.meta_url !== null).length;
      
      const totalNames = withCIP119Names + withLegacyNames;
      const totalDescriptions = withCIP119Objectives + withLegacyDescriptions;
      
      console.log(`[Koios] Metadata: ${totalNames} with names (${withCIP119Names} CIP-119, ${withLegacyNames} legacy), ${withTickers} with tickers, ${totalDescriptions} with descriptions (${withCIP119Objectives} CIP-119, ${withLegacyDescriptions} legacy), ${withAnchorUrl} with anchor URLs`);
    }
    
    return data || [];
  } catch (error) {
    console.error('[Koios] Error fetching DRep metadata:', error);
    return [];
  }
}

/**
 * Extract value from JSON-LD format metadata
 * Handles both plain strings and JSON-LD objects with @value property
 */
function extractJsonLdValue(value: any): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  // If it's already a string, return it
  if (typeof value === 'string') {
    return value;
  }
  // If it's a JSON-LD object with @value, extract it
  if (typeof value === 'object' && '@value' in value) {
    return String(value['@value']);
  }
  // If it's another type of object, stringify it (last resort)
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  // Fallback: convert to string
  return String(value);
}

/**
 * Extract metadata fields with fallback parsing
 * Handles various metadata JSON structures including CIP-119 governance format
 */
export function parseMetadataFields(metadata: DRepMetadata | null | undefined): {
  name: string | null;
  ticker: string | null;
  description: string | null;
} {
  if (!metadata || !metadata.meta_json) {
    return { name: null, ticker: null, description: null };
  }

  const json = metadata.meta_json;
  
  // NAME EXTRACTION (priority order)
  // 1. Try direct fields first (custom/legacy format)
  let name = extractJsonLdValue(json.name);
  
  // 2. Try CIP-119 standard: body.givenName (primary governance metadata field)
  if (!name && json.body) {
    name = extractJsonLdValue((json.body as any).givenName);
  }
  
  // 3. Try nested body.name (legacy nested format)
  if (!name && json.body) {
    name = extractJsonLdValue((json.body as any).name);
  }
  
  // 4. Try givenName at root (alternative location)
  if (!name) {
    name = extractJsonLdValue((json as any).givenName);
  }
  
  // TICKER EXTRACTION (not part of CIP-119, but check legacy formats)
  let ticker = extractJsonLdValue(json.ticker);
  if (!ticker && json.body) {
    ticker = extractJsonLdValue((json.body as any).ticker);
  }
  
  // DESCRIPTION EXTRACTION (priority order)
  // 1. Try direct description field (custom/legacy)
  let description = extractJsonLdValue(json.description);
  
  // 2. Try CIP-119 standard: body.objectives (primary description field)
  if (!description && json.body) {
    const objectives = extractJsonLdValue((json.body as any).objectives);
    const motivations = extractJsonLdValue((json.body as any).motivations);
    
    // Combine objectives and motivations if both exist
    if (objectives && motivations) {
      description = `${objectives}\n\n${motivations}`;
    } else {
      description = objectives || motivations || null;
    }
  }
  
  // 3. Try nested body.description (legacy nested format)
  if (!description && json.body) {
    description = extractJsonLdValue((json.body as any).description);
  }
  
  return { name, ticker, description };
}

/**
 * Fetch voting history for a specific DRep
 */
export async function fetchDRepVotes(drepId: string): Promise<DRepVotesResponse> {
  try {
    const data = await koiosFetch<DRepVotesResponse>('/drep_votes', {
      method: 'POST',
      body: JSON.stringify({ _drep_id: drepId }),
    });
    
    return data || [];
  } catch (error) {
    console.error('Error fetching DRep votes:', error);
    return [];
  }
}

/**
 * Fetch details for a single DRep (convenience function)
 */
export async function fetchDRepDetails(drepId: string) {
  try {
    const [info, metadata, votes] = await Promise.all([
      fetchDRepInfo([drepId]),
      fetchDRepMetadata([drepId]),
      fetchDRepVotes(drepId),
    ]);

    return {
      info: info[0] || null,
      metadata: metadata[0] || null,
      votes: votes || [],
    };
  } catch (error) {
    console.error('Error fetching DRep details:', error);
    return {
      info: null,
      metadata: null,
      votes: [],
    };
  }
}

/**
 * Fetch all proposals (for calculating participation rates)
 * Note: This is a placeholder - actual endpoint may vary based on Koios API updates
 */
export async function fetchProposals(): Promise<ProposalListResponse> {
  try {
    // TODO: Update endpoint when available in Koios API
    // For now, we'll estimate from vote records
    return [];
  } catch (error) {
    console.error('Error fetching proposals:', error);
    return [];
  }
}

/**
 * Batch fetch DRep info and metadata for multiple DReps
 */
export async function fetchDRepsWithDetails(drepIds: string[]) {
  try {
    const batchSize = 50; // Koios API batch limit
    const batches = [];
    
    for (let i = 0; i < drepIds.length; i += batchSize) {
      const batch = drepIds.slice(i, i + batchSize);
      batches.push(
        Promise.all([
          fetchDRepInfo(batch),
          fetchDRepMetadata(batch),
        ])
      );
    }

    const results = await Promise.all(batches);
    
    // Combine results from all batches
    const allInfo = results.flatMap(([info]) => info);
    const allMetadata = results.flatMap(([, metadata]) => metadata);

    return {
      info: allInfo,
      metadata: allMetadata,
    };
  } catch (error) {
    console.error('[Koios] Error fetching DReps with details:', error);
    return {
      info: [],
      metadata: [],
    };
  }
}

/**
 * Batch fetch votes for multiple DReps
 * Note: This can be slow for many DReps, use sparingly
 */
export async function fetchDRepsVotes(drepIds: string[]): Promise<Record<string, DRepVotesResponse>> {
  const isDev = process.env.NODE_ENV === 'development';
  
  try {
    if (isDev) {
      console.log(`[Koios] Fetching votes for ${drepIds.length} DReps...`);
    }
    
    // Fetch votes sequentially to avoid overwhelming the API
    const votesMap: Record<string, DRepVotesResponse> = {};
    
    for (const drepId of drepIds) {
      try {
        const votes = await fetchDRepVotes(drepId);
        votesMap[drepId] = votes;
      } catch (error) {
        console.error(`[Koios] Error fetching votes for ${drepId}:`, error);
        votesMap[drepId] = [];
      }
    }
    
    return votesMap;
  } catch (error) {
    console.error('[Koios] Error fetching DReps votes:', error);
    return {};
  }
}

/**
 * Get total number of governance proposals
 * Used for calculating participation rates
 */
export async function fetchProposalCount(): Promise<number> {
  try {
    // Note: Koios may not have a direct count endpoint
    // This is an approximation based on available data
    const proposals = await fetchProposals();
    return proposals.length || 100; // Default estimate if no data
  } catch (error) {
    console.error('[Koios] Error fetching proposal count:', error);
    return 100; // Conservative estimate
  }
}

/**
 * Check if Koios API is available
 */
export async function checkKoiosHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${KOIOS_BASE_URL}/tip`, {
      method: 'GET',
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}
