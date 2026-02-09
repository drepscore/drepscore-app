/**
 * Koios API Response Types
 * Documentation: https://api.koios.rest/
 */

// Base types
export interface KoiosResponse<T> {
  data?: T;
  error?: string;
}

// DRep List Response
export interface DRepListItem {
  drep_id: string;
  drep_hash: string;
  hex: string;
  has_script: boolean;
  registered: boolean;
}

export type DRepListResponse = DRepListItem[];

// DRep Info Response
export interface DRepInfo {
  drep_id: string;
  drep_hash: string;
  hex: string;
  has_script: boolean;
  registered: boolean;
  deposit: string | null;
  anchor_url: string | null;
  anchor_hash: string | null;
  voting_power: string;
  delegators: number;
  active_epoch: number | null;
}

export type DRepInfoResponse = DRepInfo[];

// DRep Metadata Response
export interface DRepMetadata {
  drep_id: string;
  hex: string;
  has_script: boolean;
  meta_url: string | null;
  meta_hash: string | null;
  meta_json: {
    name?: string;
    ticker?: string;
    description?: string;
    body?: {
      // CIP-119 Governance Metadata Fields
      givenName?: string;
      objectives?: string;
      motivations?: string;
      qualifications?: string;
      paymentAddress?: string;
      // Legacy/Additional Fields
      bio?: string;
      email?: string;
      references?: Array<{
        label: string;
        uri: string;
      }>;
      [key: string]: any;
    };
    authors?: string[];
    [key: string]: any;
  } | null;
  bytes: string | null;
  warning: string | null;
  language: string | null;
  comment: string | null;
  is_valid: boolean | null;
}

export type DRepMetadataResponse = DRepMetadata[];

// DRep Votes Response (Governance Actions)
export interface DRepVote {
  proposal_tx_hash: string;
  proposal_index: number;
  vote_tx_hash: string;
  block_time: number;
  vote: 'Yes' | 'No' | 'Abstain';
  meta_url: string | null;
  meta_hash: string | null;
  meta_json: {
    title?: string;
    abstract?: string;
    motivation?: string;
    rationale?: string;
    [key: string]: any;
  } | null;
}

export type DRepVotesResponse = DRepVote[];

// Proposal Info (for governance actions)
export interface ProposalInfo {
  tx_hash: string;
  cert_index: number;
  block_time: number;
  proposal_type: string;
  proposal_description: string | null;
  deposit: string;
  return_address: string;
  rationale_url: string | null;
  rationale_hash: string | null;
  epoch_no: number;
}

export type ProposalListResponse = ProposalInfo[];
