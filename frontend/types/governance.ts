// Cardano Governance Types

export interface DRep {
  drep_id: string;
  drep_hash?: string;
  hex?: string;
  view?: string;
  url?: string;
  metadata?: {
    name?: string;
    email?: string;
    description?: string;
    website?: string;
    logo?: string;
    [key: string]: any;
  };
  anchor?: {
    url: string;
    data_hash: string;
  };
  voting_power?: string;
  voting_power_active?: string;
  amount?: string; // Amount from DRep endpoint
  status?: 'active' | 'inactive' | 'retired';
  active?: boolean;
  active_epoch?: number;
  last_active_epoch?: number;
  has_script?: boolean;
  retired?: boolean;
  expired?: boolean;
  registration_tx_hash?: string;
  registration_epoch?: number;
  // Enhanced fields (can be populated from voting history and metadata)
  delegator_count?: number;
  vote_count?: number;
  last_vote_epoch?: number;
  has_profile?: boolean; // Has metadata/profile
}

export interface GovernanceAction {
  tx_hash: string;
  action_id: string;
  // CIP-129 proposal ID from Koios (e.g., gov_action1...)
  proposal_id?: string;
  // For Blockfrost metadata endpoint
  proposal_tx_hash?: string;
  proposal_index?: number;
  cert_index?: number; // Alias for proposal_index
  deposit?: string;
  reward_account?: string;
  return_address?: string; // Stake address for deposit return
  type: 'parameter_change' | 'hard_fork_initiation' | 'treasury_withdrawals' | 'no_confidence' | 'update_committee' | 'new_committee' | 'info' | 'new_constitution';
  description?: string;
  status?: 'submitted' | 'voting' | 'ratified' | 'enacted' | 'expired' | 'rejected' | 'dropped';
  // Epoch information
  proposed_epoch?: number;
  voting_epoch?: number;
  ratification_epoch?: number; // When ratified
  ratified_epoch?: number; // Alias for ratification_epoch
  enactment_epoch?: number;
  expiry_epoch?: number;
  expiration?: number; // Expected expiration epoch
  dropped_epoch?: number; // When dropped/expired
  // Metadata fields
  meta_url?: string;
  meta_hash?: string;
  meta_json?: any; // Parsed metadata JSON from Koios
  meta_language?: string; // CIP-100 language code
  meta_comment?: string;
  meta_is_valid?: boolean | null;
  // Treasury withdrawal (for treasury_withdrawals type)
  withdrawal?: {
    amount: string; // In lovelace
    address?: string; // Stake address
  };
  // Parameter proposal (for parameter_change type)
  param_proposal?: any; // Parameter change object
  // Block time from Koios
  block_time?: number; // UNIX timestamp
  // Existing metadata structure (for backward compatibility)
  metadata?: {
    title?: string;
    description?: string;
    rationale?: string;
    [key: string]: any;
  };
}

export interface VotingResult {
  action_id: string;
  yes_votes: string;
  no_votes: string;
  abstain_votes: string;
  voter_type: 'drep' | 'spo' | 'cc';
  voting_power?: string;
}

export interface DRepVotingHistory {
  tx_hash?: string;
  cert_index?: number;
  proposal_id?: string; // Also called action_id in some contexts
  action_id?: string; // Alias for proposal_id for backward compatibility
  proposal_tx_hash?: string;
  proposal_cert_index?: number;
  vote: 'yes' | 'no' | 'abstain';
  voting_power?: string;
  epoch?: number;
}

export interface ActionVotingBreakdown {
  drep_votes: {
    yes: string;
    no: string;
    abstain: string;
  };
  spo_votes: {
    yes: string;
    no: string;
    abstain: string;
  };
  cc_votes: {
    yes: string;
    no: string;
    abstain: string;
  };
  total_voting_power: string;
}

export interface DRepDelegator {
  address: string;
  amount: string; // Amount in lovelace
}

/**
 * Detailed voting summary from Koios API
 * Includes percentages and vote counts for each voter type
 */
export interface ProposalVotingSummary {
  proposal_type: string;
  epoch_no: number;
  // DRep votes
  drep_yes_votes_cast: number;
  drep_active_yes_vote_power: string;
  drep_yes_vote_power: string;
  drep_yes_pct: number;
  drep_no_votes_cast: number;
  drep_active_no_vote_power: string;
  drep_no_vote_power: string;
  drep_no_pct: number;
  drep_abstain_votes_cast: number;
  drep_active_abstain_vote_power: string;
  drep_always_no_confidence_vote_power: string;
  drep_always_abstain_vote_power: string;
  // SPO/Pool votes
  pool_yes_votes_cast: number;
  pool_active_yes_vote_power: string;
  pool_yes_vote_power: string;
  pool_yes_pct: number;
  pool_no_votes_cast: number;
  pool_active_no_vote_power: string;
  pool_no_vote_power: string;
  pool_no_pct: number;
  pool_abstain_votes_cast: number;
  pool_active_abstain_vote_power: string;
  pool_passive_always_abstain_votes_assigned: number;
  pool_passive_always_abstain_vote_power: string;
  pool_passive_always_no_confidence_votes_assigned: number;
  pool_passive_always_no_confidence_vote_power: string;
  // Committee votes
  committee_yes_votes_cast: number;
  committee_yes_pct: number;
  committee_no_votes_cast: number;
  committee_no_pct: number;
  committee_abstain_votes_cast: number;
}

