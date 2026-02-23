/**
 * Rationale Fetch API Route
 * Fetches and caches rationale text from IPFS/HTTP URLs
 * 
 * POST /api/rationale
 * Body: { votes: [{ voteTxHash, drepId, proposalTxHash, proposalIndex, metaUrl }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface VoteRationaleRequest {
  voteTxHash: string;
  drepId: string;
  proposalTxHash: string;
  proposalIndex: number;
  metaUrl: string;
}

interface RationaleResponse {
  voteTxHash: string;
  rationaleText: string | null;
  error?: string;
}

const FETCH_TIMEOUT_MS = 5000;
const MAX_CONTENT_SIZE = 50000; // 50KB max

async function fetchRationaleFromUrl(url: string): Promise<string | null> {
  try {
    // Handle IPFS URLs by converting to gateway URL
    let fetchUrl = url;
    if (url.startsWith('ipfs://')) {
      fetchUrl = `https://ipfs.io/ipfs/${url.slice(7)}`;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    
    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json, text/plain, */*',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn(`[Rationale] Fetch failed for ${url}: ${response.status}`);
      return null;
    }
    
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_CONTENT_SIZE) {
      console.warn(`[Rationale] Content too large for ${url}: ${contentLength} bytes`);
      return null;
    }
    
    const text = await response.text();
    
    if (text.length > MAX_CONTENT_SIZE) {
      return null;
    }
    
    // Try to parse as JSON and extract rationale
    try {
      const json = JSON.parse(text);
      // Common fields where rationale might be stored
      const rationaleText = json.rationale || json.body || json.motivation || json.justification || json.reason;
      if (typeof rationaleText === 'string' && rationaleText.trim()) {
        return rationaleText.trim();
      }
      // If no specific field, check if the whole content is just text
      if (typeof json === 'string') {
        return json.trim();
      }
    } catch {
      // Not JSON - might be plain text
      if (text.trim() && !text.includes('<!DOCTYPE') && !text.includes('<html')) {
        return text.trim();
      }
    }
    
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[Rationale] Timeout fetching ${url}`);
    } else {
      console.warn(`[Rationale] Error fetching ${url}:`, error);
    }
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const votes: VoteRationaleRequest[] = body.votes;
    
    if (!votes || !Array.isArray(votes) || votes.length === 0) {
      return NextResponse.json({ error: 'No votes provided' }, { status: 400 });
    }
    
    // Limit to 10 votes per request to avoid long response times
    const votesToProcess = votes.slice(0, 10);
    
    const supabase = getSupabaseAdmin();
    const results: RationaleResponse[] = [];
    
    for (const vote of votesToProcess) {
      if (!vote.metaUrl) {
        results.push({ voteTxHash: vote.voteTxHash, rationaleText: null, error: 'No URL' });
        continue;
      }
      
      const { data: existing } = await supabase
        .from('vote_rationales')
        .select('rationale_text')
        .eq('vote_tx_hash', vote.voteTxHash)
        .single();
      
      if (existing?.rationale_text) {
        results.push({ voteTxHash: vote.voteTxHash, rationaleText: existing.rationale_text });
        continue;
      }
      
      const rationaleText = await fetchRationaleFromUrl(vote.metaUrl);
      
      // Cache even null results to avoid re-fetching on every page load
      await supabase
        .from('vote_rationales')
        .upsert({
          vote_tx_hash: vote.voteTxHash,
          drep_id: vote.drepId,
          proposal_tx_hash: vote.proposalTxHash,
          proposal_index: vote.proposalIndex,
          meta_url: vote.metaUrl,
          rationale_text: rationaleText,
        }, { onConflict: 'vote_tx_hash' });
      
      results.push({ voteTxHash: vote.voteTxHash, rationaleText });
    }
    
    return NextResponse.json({ results });
  } catch (error) {
    console.error('[Rationale] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
