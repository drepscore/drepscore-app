'use client';

import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { Lock, Info } from 'lucide-react';
import { CHAIN_IDENTITIES, type Chain } from '@/lib/crossChain';

interface EDIData {
  chain: Chain;
  composite: number | null;
}

interface CrossChainDecentralizationProps {
  data?: EDIData[];
  className?: string;
}

export function CrossChainDecentralization({
  data = [],
  className = '',
}: CrossChainDecentralizationProps) {
  const chains: Chain[] = ['cardano', 'ethereum', 'polkadot'];
  const hasAnyData = data.some((d) => d.composite != null);

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className={`rounded-xl border border-border/50 bg-card/30 p-5 ${className}`}
    >
      <div className="mb-4 flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Power Decentralization</h3>
        <span className="ml-auto rounded-full bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
          EDI Methodology
        </span>
      </div>

      {hasAnyData ? (
        <div className="space-y-3">
          {chains.map((chain) => {
            const identity = CHAIN_IDENTITIES[chain];
            const edi = data.find((d) => d.chain === chain);
            const score = edi?.composite;

            return (
              <div key={chain} className="flex items-center gap-3">
                <span className="w-20 text-xs font-medium">{identity.name}</span>
                {score != null ? (
                  <>
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted/30">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ backgroundColor: identity.color }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${Math.min(score, 100)}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    <span
                      className="w-10 text-right text-xs font-bold tabular-nums"
                      style={{ color: identity.color }}
                    >
                      {score.toFixed(0)}
                    </span>
                  </>
                ) : (
                  <span className="flex-1 text-xs italic text-muted-foreground/70">
                    Coming soon
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Info className="h-5 w-5 text-muted-foreground/70" />
          <p className="text-xs text-muted-foreground/60">
            Edinburgh Decentralization Index metrics will appear here once EDI data is available for
            each chain&apos;s voting power distribution.
          </p>
        </div>
      )}

      <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground/70">
        Power decentralization measured using the Edinburgh Decentralization Index methodology — 7
        standardized metrics applied to each chain&apos;s voting power distribution.
      </p>
    </motion.div>
  );
}
