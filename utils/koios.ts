/**
 * Koios API Integration Layer
 * Provides typed helpers for fetching Cardano governance data
 */

import {
  DRepListResponse,
  DRepInfoResponse,
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
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(KOIOS_API_KEY && { 'Authorization': `Bearer ${KOIOS_API_KEY}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      next: { revalidate: CACHE_REVALIDATE_TIME },
    });

    if (!response.ok) {
      // Handle rate limiting with exponential backoff
      if (response.status === 429 && retryCount < 3) {
        const waitTime = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
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
    
    console.error('Koios API Error:', koiosError);
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
 */
export async function fetchDRepMetadata(drepIds: string[]): Promise<DRepMetadataResponse> {
  try {
    if (drepIds.length === 0) return [];
    
    const data = await koiosFetch<DRepMetadataResponse>('/drep_metadata', {
      method: 'POST',
      body: JSON.stringify({ _drep_ids: drepIds }),
    });
    
    return data || [];
  } catch (error) {
    console.error('Error fetching DRep metadata:', error);
    return [];
  }
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
    console.error('Error fetching DReps with details:', error);
    return {
      info: [],
      metadata: [],
    };
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
