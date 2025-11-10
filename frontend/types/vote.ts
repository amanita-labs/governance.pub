// CIP-108 Vote Rationale Types

export interface VoteRationaleMetadata {
  '@context': {
    '@language': string;
    CIP100: string;
    CIP108: string;
    hashAlgorithm: string;
    body: {
      '@id': string;
    };
    authors: {
      '@id': string;
    };
  };
  hashAlgorithm: 'blake2b-256';
  authors: VoteAuthor[];
  body: VoteBody;
}

export interface VoteAuthor {
  name: string;
  witness: VoteWitness;
}

export interface VoteWitness {
  witnessAlgorithm: 'ed25519' | 'CIP-0008';
  publicKey?: string;
  signature?: string;
}

export interface VoteBody {
  title: string;
  abstract: string;
  motivation: string;
  rationale: string;
  references?: VoteReference[];
}

export interface VoteReference {
  '@type': 'GovernanceMetadata' | 'Other';
  label: string;
  uri: string;
  referenceHash?: {
    hashDigest: string;
    hashAlgorithm: 'blake2b-256';
  };
}

export type VoteChoice = 'yes' | 'no' | 'abstain';

export interface VoteSubmission {
  drepId: string;
  proposalId: string;
  vote: VoteChoice;
  rationaleUrl?: string;
  rationaleHash?: string;
}
