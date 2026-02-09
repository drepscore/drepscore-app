'use client';

/**
 * Info Modal Component
 * Provides detailed educational explanations
 */

import { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';

interface InfoModalProps {
  title: string;
  children: ReactNode;
  triggerText?: string;
  triggerVariant?: 'default' | 'outline' | 'ghost' | 'link';
  iconOnly?: boolean;
}

export function InfoModal({ 
  title, 
  children, 
  triggerText = 'Learn More', 
  triggerVariant = 'ghost',
  iconOnly = false 
}: InfoModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant={triggerVariant} 
          size={iconOnly ? 'icon' : 'sm'} 
          className={iconOnly ? 'h-6 w-6' : 'gap-2'}
          aria-label={iconOnly ? title : undefined}
        >
          <Info className="h-4 w-4" />
          {!iconOnly && triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogDescription asChild>
          <div className="space-y-4 text-sm text-foreground">
            {children}
          </div>
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}

// Predefined educational content
export function WhatIsDRepModal() {
  return (
    <InfoModal title="What is a DRep?" triggerVariant="link">
      <p>
        A <strong>Delegated Representative (DRep)</strong> is a governance participant in the Cardano blockchain 
        who votes on behalf of ADA holders who delegate their voting power to them.
      </p>
      <p>
        Think of DReps as elected representatives in traditional government, but for blockchain governance. 
        They vote on proposals that affect the Cardano ecosystem, including:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li>Treasury funding allocations</li>
        <li>Protocol parameter changes</li>
        <li>Constitutional amendments</li>
        <li>Hard fork decisions</li>
      </ul>
      <p>
        By delegating to a DRep, you give them the power to vote with your stake weight, 
        while you retain full control of your ADA.
      </p>
    </InfoModal>
  );
}

export function ParticipationRateModal() {
  return (
    <InfoModal title="Understanding Participation Rate" triggerVariant="ghost" iconOnly>
      <p>
        <strong>Participation Rate</strong> measures how actively a DRep engages with governance proposals.
      </p>
      <p>
        It's calculated as: (Votes Cast / Total Proposals) × 100
      </p>
      <div className="bg-muted p-4 rounded-lg space-y-2">
        <p className="font-medium">What's a good rate?</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><span className="text-green-600 dark:text-green-400">70%+ (Excellent)</span> - Highly engaged, votes on most proposals</li>
          <li><span className="text-yellow-600 dark:text-yellow-400">40-70% (Good)</span> - Moderately active, votes on important proposals</li>
          <li><span className="text-red-600 dark:text-red-400">&lt;40% (Poor)</span> - Low engagement, rarely votes</li>
        </ul>
      </div>
      <p>
        A higher participation rate generally indicates a more committed DRep, but consider their 
        rationale provision as well—quality matters as much as quantity.
      </p>
    </InfoModal>
  );
}

export function DecentralizationScoreModal() {
  return (
    <InfoModal title="Understanding Decentralization Score" triggerVariant="ghost" iconOnly>
      <p>
        The <strong>Decentralization Score</strong> measures how voting power is distributed among a DRep's delegators.
      </p>
      <p>
        A higher score indicates better decentralization, which is important for several reasons:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Resistance to Coercion</strong> - Harder for any single entity to control the DRep</li>
        <li><strong>Broader Representation</strong> - More individual voices contributing to the delegation</li>
        <li><strong>Network Health</strong> - Distributes influence across the ecosystem</li>
      </ul>
      <div className="bg-muted p-4 rounded-lg">
        <p className="font-medium mb-2">Score Factors:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Number of unique delegators (more is better)</li>
          <li>Distribution of stake among delegators (balanced is better)</li>
        </ul>
      </div>
      <p className="text-sm text-muted-foreground">
        Note: Future versions will include stake pool operator links to provide more transparency 
        about the delegation structure.
      </p>
    </InfoModal>
  );
}

export function RationaleImportanceModal() {
  return (
    <InfoModal title="Why Rationale Matters" triggerVariant="ghost" iconOnly>
      <p>
        <strong>Rationale</strong> refers to the written explanation a DRep provides for their votes.
      </p>
      <p>
        High-quality DReps provide rationale because:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Transparency</strong> - You can understand their decision-making process
        </li>
        <li>
          <strong>Accountability</strong> - They publicly justify their positions
        </li>
        <li>
          <strong>Education</strong> - Helps you learn about complex governance issues
        </li>
        <li>
          <strong>Trust Building</strong> - Shows thoughtful consideration of proposals
        </li>
      </ul>
      <p>
        When selecting a DRep, look for those with high rationale provision rates (80%+) and 
        review their past rationales to ensure their reasoning aligns with your values.
      </p>
    </InfoModal>
  );
}

export function DelegationRisksModal() {
  return (
    <InfoModal title="Delegation: Risks and Myths" triggerText="Important Info">
      <div className="space-y-4">
        <div>
          <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2">Myth: Delegation Locks Your ADA</h4>
          <p>
            <strong>FALSE.</strong> Your ADA remains in your wallet and is always accessible. 
            You can spend, move, or redelegate at any time. Delegation only affects voting power, not ownership.
          </p>
        </div>
        
        <div>
          <h4 className="font-semibold text-yellow-600 dark:text-yellow-400 mb-2">Risk: Poor DRep Performance</h4>
          <p>
            A DRep who rarely votes or votes against your values may not represent you well. 
            Solution: Monitor their activity and redelegate if needed. There's no penalty for changing DReps.
          </p>
        </div>
        
        <div>
          <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">Best Practice: Stay Informed</h4>
          <p>
            Regularly check your DRep's voting record and rationales. The governance landscape 
            evolves, and what aligned with your values yesterday may not tomorrow.
          </p>
        </div>
        
        <div className="bg-muted p-4 rounded-lg">
          <p className="font-medium mb-2">Remember:</p>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>You can always redelegate</li>
            <li>Your ADA is never at risk</li>
            <li>No fees for delegation changes</li>
            <li>You can become your own DRep if you prefer</li>
          </ul>
        </div>
      </div>
    </InfoModal>
  );
}
