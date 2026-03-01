import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Landmark, Shield, Zap, Vote } from 'lucide-react';

interface FinancialImpactCardProps {
  proposalType: string;
  withdrawalAmount?: number | null;
  treasuryTier?: string | null;
  paramChanges?: Record<string, any> | null;
  treasuryBalance?: number | null;
  totalVotePower?: number | null;
}

const PARAM_LABELS: Record<string, string> = {
  min_fee_a: 'Min Fee Coefficient (A)',
  min_fee_b: 'Min Fee Constant (B)',
  max_block_body_size: 'Max Block Body Size',
  max_tx_size: 'Max Transaction Size',
  max_block_header_size: 'Max Block Header Size',
  key_deposit: 'Stake Key Deposit',
  pool_deposit: 'Pool Registration Deposit',
  max_epoch: 'Pool Retirement Max Epoch',
  n_opt: 'Desired Number of Pools',
  pool_pledge_influence: 'Pool Pledge Influence (a0)',
  expansion_rate: 'Monetary Expansion Rate (ρ)',
  treasury_growth_rate: 'Treasury Growth Rate (τ)',
  decentralisation_param: 'Decentralisation Parameter',
  extra_entropy: 'Extra Entropy',
  protocol_major_ver: 'Protocol Major Version',
  protocol_minor_ver: 'Protocol Minor Version',
  min_utxo: 'Min UTXO Value',
  min_pool_cost: 'Min Pool Cost',
  price_mem: 'Plutus Memory Price',
  price_step: 'Plutus Step Price',
  max_tx_ex_mem: 'Max Tx Execution Memory',
  max_tx_ex_steps: 'Max Tx Execution Steps',
  max_block_ex_mem: 'Max Block Execution Memory',
  max_block_ex_steps: 'Max Block Execution Steps',
  max_val_size: 'Max Value Size',
  collateral_percent: 'Collateral Percentage',
  max_collateral_inputs: 'Max Collateral Inputs',
  coins_per_utxo_size: 'Coins Per UTXO Byte',
  cost_model_v1: 'Plutus V1 Cost Model',
  cost_model_v2: 'Plutus V2 Cost Model',
  cost_model_v3: 'Plutus V3 Cost Model',
  gov_action_lifetime: 'Governance Action Lifetime',
  gov_action_deposit: 'Governance Action Deposit',
  drep_deposit: 'DRep Deposit',
  drep_activity: 'DRep Activity Period',
  committee_min_size: 'Min Committee Size',
  committee_max_term_length: 'Committee Max Term Length',
  dvt_motion_no_confidence: 'DRep Threshold: No Confidence',
  dvt_committee_normal: 'DRep Threshold: Committee Normal',
  dvt_committee_no_confidence: 'DRep Threshold: Committee (No Conf)',
  dvt_update_to_constitution: 'DRep Threshold: Constitution Update',
  dvt_hard_fork_initiation: 'DRep Threshold: Hard Fork',
  dvt_p_p_network_group: 'DRep Threshold: Network Params',
  dvt_p_p_economic_group: 'DRep Threshold: Economic Params',
  dvt_p_p_technical_group: 'DRep Threshold: Technical Params',
  dvt_p_p_gov_group: 'DRep Threshold: Governance Params',
  dvt_treasury_withdrawal: 'DRep Threshold: Treasury Withdrawal',
};

const TYPE_STYLES: Record<string, { accent: string; border: string; bg: string }> = {
  TreasuryWithdrawals: {
    accent: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
  },
  ParameterChange: {
    accent: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
  },
  HardForkInitiation: {
    accent: 'text-red-700 dark:text-red-400',
    border: 'border-red-500/30',
    bg: 'bg-red-500/5',
  },
};

function formatAda(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatParamValue(key: string, value: any): string {
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 80) + '…';
  return String(value);
}

function getParamLabel(key: string): string {
  return PARAM_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function FinancialImpactCard({
  proposalType,
  withdrawalAmount,
  treasuryTier,
  paramChanges,
  treasuryBalance,
  totalVotePower,
}: FinancialImpactCardProps) {
  const isTreasury = proposalType === 'TreasuryWithdrawals';
  const isParamChange = proposalType === 'ParameterChange';
  const isHardFork = proposalType === 'HardForkInitiation';

  const hasFinancialContent =
    (isTreasury && withdrawalAmount) ||
    (isParamChange && paramChanges && Object.keys(paramChanges).length > 0) ||
    isHardFork ||
    totalVotePower;

  if (!hasFinancialContent) return null;

  const style = TYPE_STYLES[proposalType] ?? TYPE_STYLES.ParameterChange;
  const Icon = isTreasury ? Landmark : isHardFork ? Zap : Shield;
  const title = isTreasury
    ? 'Treasury Impact'
    : isHardFork
      ? 'Protocol Impact'
      : 'Parameter Changes';

  const treasuryPct =
    isTreasury && withdrawalAmount && treasuryBalance && treasuryBalance > 0
      ? ((withdrawalAmount / treasuryBalance) * 100).toFixed(2)
      : null;

  return (
    <Card className={`${style.border} ${style.bg}`}>
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center gap-2 text-base ${style.accent}`}>
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isTreasury && withdrawalAmount != null && (
          <div className="space-y-1.5">
            <p>
              This proposal requests{' '}
              <span className="font-semibold">{formatAda(withdrawalAmount)} ADA</span>
              {treasuryPct && treasuryBalance ? (
                <>
                  {' '}({treasuryPct}% of the {formatAda(treasuryBalance)} ADA treasury)
                </>
              ) : null}
              {treasuryTier && (
                <span className="text-muted-foreground"> · {treasuryTier} tier</span>
              )}
            </p>
            {treasuryBalance != null && (
              <p className="text-muted-foreground">
                If approved, treasury would have{' '}
                <span className="font-medium">
                  {formatAda(Math.max(0, treasuryBalance - withdrawalAmount))} ADA
                </span>{' '}
                remaining
              </p>
            )}
          </div>
        )}

        {isParamChange && paramChanges && Object.keys(paramChanges).length > 0 && (
          <div className="space-y-1.5">
            <p className="text-muted-foreground">
              This proposal modifies {Object.keys(paramChanges).length} protocol parameter
              {Object.keys(paramChanges).length !== 1 ? 's' : ''}:
            </p>
            <div className="rounded-md border border-border/50 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left px-3 py-1.5 font-medium">Parameter</th>
                    <th className="text-right px-3 py-1.5 font-medium">New Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(paramChanges).map(([key, value]) => (
                    <tr key={key} className="border-b border-border/30 last:border-0">
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {getParamLabel(key)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {formatParamValue(key, value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isHardFork && (
          <p>
            This is a <span className="font-semibold">fundamental protocol change</span> that
            requires broad consensus across DReps, SPOs, and the Constitutional Committee.
          </p>
        )}

        {totalVotePower != null && totalVotePower > 0 && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/30 text-muted-foreground">
            <Vote className="h-3.5 w-3.5" />
            <span>
              <span className="font-medium text-foreground">{formatAda(totalVotePower)} ADA</span>
              {' '}in voting power committed to this decision
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
