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
  deposit?: string;
  reward_account?: string;
  type: 'parameter_change' | 'hard_fork_initiation' | 'treasury_withdrawals' | 'no_confidence' | 'update_committee' | 'new_committee' | 'info';
  description?: string;
  status?: 'submitted' | 'voting' | 'ratified' | 'enacted' | 'expired' | 'rejected';
  voting_epoch?: number;
  enactment_epoch?: number;
  expiry_epoch?: number;
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

