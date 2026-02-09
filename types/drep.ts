/**
 * DRep Application Types
 */

// Value preferences for filtering
export type ValuePreference =
  | 'Treasury Conservative'
  | 'Pro-DeFi'
  | 'High Participation'
  | 'Pro-Privacy'
  | 'Pro-Decentralization'
  | 'Active Rationale Provider';

// DRep with calculated metrics
export interface DRep {
  drepId: string;
  drepHash: string;
  handle: string | null;
  name: string | null; // Human-readable name from metadata
  ticker: string | null; // Short ticker/symbol from metadata
  description: string | null; // Description from metadata
  votingPower: number; // in ADA
  votingPowerLovelace: string; // raw lovelace string
  participationRate: number; // percentage
  rationaleRate: number; // percentage
  decentralizationScore: number; // 0-100 score
  delegatorCount: number;
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  isActive: boolean;
  anchorUrl: string | null;
  metadata: {
    bio?: string;
    email?: string;
    references?: Array<{
      label: string;
      uri: string;
    }>;
  } | null;
}

// DRep with match score for value-based filtering
export interface DRepWithScore extends DRep {
  matchScore: number; // 0-100, based on value alignment
  matchReasons: string[];
}

// Vote record for display
export interface VoteRecord {
  id: string;
  proposalTxHash: string;
  proposalIndex: number;
  voteTxHash: string;
  date: Date;
  vote: 'Yes' | 'No' | 'Abstain';
  title: string | null;
  abstract: string | null;
  hasRationale: boolean;
  rationaleUrl: string | null;
  rationaleText: string | null;
  voteType: 'Governance' | 'Catalyst';
}

// DRep detail page data
export interface DRepDetail extends DRep {
  votes: VoteRecord[];
  statement: string | null;
  activeEpoch: number | null;
  deposit: string | null;
}

// Table filter options
export interface DRepFilters {
  search: string;
  minParticipation: number;
  minVotingPower: number;
  selectedValues: ValuePreference[];
  showActiveOnly: boolean;
}

// Sort options for table
export type DRepSortField =
  | 'drepId'
  | 'votingPower'
  | 'participationRate'
  | 'rationaleRate'
  | 'decentralizationScore'
  | 'matchScore';

export type SortDirection = 'asc' | 'desc';

export interface DRepSort {
  field: DRepSortField;
  direction: SortDirection;
}

// Pagination
export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// Error types
export interface KoiosError {
  message: string;
  code?: string;
  retryable: boolean;
}
