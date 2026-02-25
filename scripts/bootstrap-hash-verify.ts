/**
 * Bootstrap: Hash verification for rationales and DRep metadata.
 * Run: npx tsx scripts/bootstrap-hash-verify.ts
 *
 * Verifies blake2b-256 hashes of:
 * 1. Vote rationale content vs on-chain meta_hash
 * 2. DRep metadata content vs on-chain anchor_hash
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { blake2bHex } from 'blakejs';
import { getSupabaseAdmin } from '../lib/supabase';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const BATCH_SIZE = 50;

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const supabase = getSupabaseAdmin();

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Hash Verification Bootstrap                     ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // ═══ PART 1: Rationale Hash Verification ═══════════════════════════════════
  console.log('Part 1: Rationale hash verification (blake2b-256)...');
  const p1Start = Date.now();

  let verified = 0, mismatched = 0, noHash = 0, fetchErrors = 0, offset = 0;

  while (true) {
    const { data: batch } = await supabase.from('vote_rationales')
      .select('vote_tx_hash, meta_url')
      .is('hash_verified', null)
      .not('meta_url', 'is', null)
      .neq('meta_url', '')
      .range(offset, offset + BATCH_SIZE - 1);

    if (!batch || batch.length === 0) break;

    // Get meta_hash from drep_votes for these vote_tx_hashes
    const txHashes = batch.map(r => r.vote_tx_hash);
    const { data: votes } = await supabase.from('drep_votes')
      .select('vote_tx_hash, meta_hash')
      .in('vote_tx_hash', txHashes);
    const hashMap = new Map<string, string>();
    for (const v of votes || []) {
      if (v.meta_hash) hashMap.set(v.vote_tx_hash, v.meta_hash);
    }

    for (const rat of batch) {
      const metaHash = hashMap.get(rat.vote_tx_hash);
      if (!metaHash) {
        noHash++;
        continue;
      }

      const content = await fetchWithTimeout(rat.meta_url);
      if (!content) {
        fetchErrors++;
        offset++;
        continue;
      }

      const computedHash = blake2bHex(content, undefined, 32);
      const isVerified = computedHash === metaHash;

      await supabase.from('vote_rationales')
        .update({ hash_verified: isVerified })
        .eq('vote_tx_hash', rat.vote_tx_hash);

      if (isVerified) verified++;
      else mismatched++;

      await sleep(100);
    }

    const total = verified + mismatched + fetchErrors;
    if (total % 100 < BATCH_SIZE) {
      const elapsed = ((Date.now() - p1Start) / 1000).toFixed(0);
      console.log(`  [${elapsed}s] verified=${verified} mismatch=${mismatched} fetchErr=${fetchErrors} noHash=${noHash}`);
    }

    if (batch.length < BATCH_SIZE) break;
    offset += batch.length;
  }

  console.log(`  Final: verified=${verified} mismatch=${mismatched} fetchErr=${fetchErrors} noHash=${noHash}`);
  console.log(`  Part 1 done in ${((Date.now() - p1Start) / 1000).toFixed(1)}s\n`);

  // ═══ PART 2: DRep Metadata Hash Verification ══════════════════════════════
  console.log('Part 2: DRep metadata hash verification (blake2b-256)...');
  const p2Start = Date.now();

  let metaVerified = 0, metaMismatch = 0, metaFetchErr = 0, metaNoUrl = 0;
  offset = 0;

  while (true) {
    const { data: batch } = await supabase.from('dreps')
      .select('id, info')
      .is('metadata_hash_verified', null)
      .range(offset, offset + BATCH_SIZE - 1);

    if (!batch || batch.length === 0) break;

    for (const drep of batch) {
      const info = drep.info as Record<string, unknown> | null;
      const anchorUrl = info?.url as string | undefined;
      const anchorHash = info?.anchorHash as string | undefined;

      if (!anchorUrl || !anchorHash) {
        metaNoUrl++;
        offset++;
        continue;
      }

      const content = await fetchWithTimeout(anchorUrl);
      if (!content) {
        metaFetchErr++;
        offset++;
        continue;
      }

      const computedHash = blake2bHex(content, undefined, 32);
      const isVerified = computedHash === anchorHash;

      await supabase.from('dreps')
        .update({ metadata_hash_verified: isVerified })
        .eq('id', drep.id);

      if (isVerified) metaVerified++;
      else metaMismatch++;

      await sleep(100);
    }

    const total = metaVerified + metaMismatch + metaFetchErr;
    if (total % 100 < BATCH_SIZE) {
      const elapsed = ((Date.now() - p2Start) / 1000).toFixed(0);
      console.log(`  [${elapsed}s] verified=${metaVerified} mismatch=${metaMismatch} fetchErr=${metaFetchErr} noUrl=${metaNoUrl}`);
    }

    if (batch.length < BATCH_SIZE) break;
    offset += batch.length;
  }

  console.log(`  Final: verified=${metaVerified} mismatch=${metaMismatch} fetchErr=${metaFetchErr} noUrl=${metaNoUrl}`);
  console.log(`  Part 2 done in ${((Date.now() - p2Start) / 1000).toFixed(1)}s\n`);

  console.log('╔══════════════════════════════════════════════════╗');
  console.log(`║  Hash Verification Complete`);
  console.log(`║  Rationale: ${verified} verified, ${mismatched} mismatch`);
  console.log(`║  Metadata: ${metaVerified} verified, ${metaMismatch} mismatch`);
  console.log('╚══════════════════════════════════════════════════╝');
  process.exit(0);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
