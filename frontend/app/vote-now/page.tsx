'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useWalletContext } from '@/components/layout/WalletProvider';
import { getGovernanceActionsPage } from '@/lib/governance/governance';
import { getActionTitle, getActionDescription } from '@/lib/governance/action-helpers';
import type { GovernanceAction } from '@/types/governance';
import type { VoteRationaleMetadata, VoteChoice } from '@/types/vote';
import { Upload, FileJson, CheckCircle, AlertCircle, Vote } from 'lucide-react';

type Step = 'voter-id' | 'proposal' | 'vote-choice' | 'rationale' | 'ipfs-config' | 'confirm' | 'uploading' | 'success';
type IpfsProvider = 'pinata' | 'blockfrost';

const MAX_CHAR_LIMITS = {
  summary: 300, // CIP-136: Short summary
  rationaleStatement: 5000, // CIP-136: Long form rationale
  precedentDiscussion: 3000, // CIP-136: Optional precedent discussion
  counterargumentDiscussion: 3000, // CIP-136: Optional counterargument discussion
  conclusion: 1000, // CIP-136: Optional conclusion
};

export default function VoteNowPage() {
  
  // Wallet & voter identification
  const { connectedWallet } = useWalletContext();
  const [drepId, setDrepId] = useState<string>('');

    // Multi-step state
  const [step, setStep] = useState<Step>('voter-id');
  const [error, setError] = useState<string>('');

  // Proposal selection
  const [proposals, setProposals] = useState<GovernanceAction[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<GovernanceAction | null>(null);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [preSelectedProposalId, setPreSelectedProposalId] = useState<string | null>(null);

  // Vote choice
  const [voteChoice, setVoteChoice] = useState<VoteChoice | null>(null);

  // Rationale fields (CIP-136)
 // const [authorName, setAuthorName] = useState('');
  const [summary, setSummary] = useState('');
  const [rationaleStatement, setRationaleStatement] = useState('');
  const [precedentDiscussion, setPrecedentDiscussion] = useState('');
  const [counterargumentDiscussion, setCounterargumentDiscussion] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [references, setReferences] = useState<Array<{ type: 'GovernanceMetadata' | 'Other' | 'RelevantArticles'; label: string; uri: string }>>([]);

  // IPFS configuration
  const [ipfsProvider, setIpfsProvider] = useState<IpfsProvider>('pinata');
  const [ipfsApiKey, setIpfsApiKey] = useState('');
  const [rationaleUrl, setRationaleUrl] = useState<string>('');
  const [rationaleHash, setRationaleHash] = useState<string>('');

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [txHash, setTxHash] = useState<string>('');

  // Load proposals on mount and check for pre-selected proposal
  useEffect(() => {
    // Check URL params for proposal parameter
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const proposalParam = params.get('proposal');
      if (proposalParam) {
        setPreSelectedProposalId(proposalParam);
      }
    }
    loadProposals();
  }, []);

  // Auto-populate DRep ID from wallet if available
  useEffect(() => {
    let cancelled = false;
    async function fetchDRepId() {
      if (connectedWallet && !drepId) {
        try {
          // Use wallet.getDRep() to get DRep ID
          if (connectedWallet.wallet && typeof connectedWallet.wallet.getDRep === 'function') {
            const dRep = await connectedWallet.wallet.getDRep();
            if (dRep?.dRepIDCip105 && !cancelled) {
              setDrepId(dRep.dRepIDCip105);
            }
          }
        } catch (err) {
          // Fallback: leave drepId empty
        }
      }
    }
    fetchDRepId();
    return () => { cancelled = true; };
  }, [connectedWallet, drepId]);

  // Auto-select proposal if pre-selected from URL
  useEffect(() => {
    if (preSelectedProposalId && proposals.length > 0 && !selectedProposal) {
      const proposal = proposals.find((p) => p.action_id === preSelectedProposalId);
      if (proposal) {
        setSelectedProposal(proposal);
        // If already on proposal step, skip ahead to vote choice
        if (step === 'proposal') {
          setStep('vote-choice');
        }
      }
    }
  }, [preSelectedProposalId, proposals, selectedProposal, step]);

  const loadProposals = async () => {
    setLoadingProposals(true);
    try {
      const { actions } = await getGovernanceActionsPage(1, 50);
      // Filter for voting or submitted proposals
      const activeProposals = actions.filter(
        (a) => a.status === 'voting' || a.status === 'submitted'
      );
      setProposals(activeProposals);
    } catch (err) {
      console.error('Error loading proposals:', err);
      setError('Failed to load proposals');
    } finally {
      setLoadingProposals(false);
    }
  };

  const buildRationaleJson = (): VoteRationaleMetadata => {
    return {
      '@context': {
        '@language': 'en-us',
        CIP100: 'https://github.com/cardano-foundation/CIPs/blob/master/CIP-0100/README.md#',
        CIP136: 'https://github.com/cardano-foundation/CIPs/blob/master/CIP-0136/README.md#',
        hashAlgorithm: 'CIP100:hashAlgorithm',
        body: {
          '@id': 'CIP136:body',
          '@context': {
            references: {
              '@id': 'CIP100:references',
              '@container': '@set',
              '@context': {
                GovernanceMetadata: 'CIP100:GovernanceMetadataReference',
                Other: 'CIP100:OtherReference',
                label: 'CIP100:reference-label',
                uri: 'CIP100:reference-uri',
                RelevantArticles: 'CIP136:RelevantArticles',
              },
            },
            summary: 'CIP136:summary',
            rationaleStatement: 'CIP136:rationaleStatement',
            precedentDiscussion: 'CIP136:precedentDiscussion',
            counterargumentDiscussion: 'CIP136:counterargumentDiscussion',
            conclusion: 'CIP136:conclusion',
          },
        },
        authors: {
          '@id': 'CIP100:authors',
          '@container': '@set',
          '@context': {
            name: 'http://xmlns.com/foaf/0.1/name',
            witness: {
              '@id': 'CIP100:witness',
              '@context': {
                witnessAlgorithm: 'CIP100:witnessAlgorithm',
                publicKey: 'CIP100:publicKey',
                signature: 'CIP100:signature',
              },
            },
          },
        },
      },
      hashAlgorithm: 'blake2b-256',
      authors: [
    //     {
    //       name: authorName,
    //       witness: {
    //         witnessAlgorithm: 'ed25519',
    //       },
    //     },
      ],
      body: {
        summary,
        rationaleStatement,
        ...(precedentDiscussion && { precedentDiscussion }),
        ...(counterargumentDiscussion && { counterargumentDiscussion }),
        ...(conclusion && { conclusion }),
        ...(references.length > 0 && {
          references: references.map(ref => ({
            '@type': ref.type,
            label: ref.label,
            uri: ref.uri,
          })),
        }),
      },
    };
  };

  const uploadRationaleToIpfs = async () => {
    setIsUploading(true);
    setError('');
    setStep('uploading');

    try {
      if (!ipfsApiKey.trim()) {
        throw new Error('IPFS API key is required');
      }

      const metadata = buildRationaleJson();

      const response = await fetch('/api/ipfs/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metadata,
          provider: ipfsProvider,
          apiKey: ipfsApiKey,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload to IPFS');
      }

      const result = await response.json();
      setRationaleUrl(result.url); // e.g., ipfs://QmHash
      setRationaleHash(result.hash); // blake2b-256 hash

      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload to IPFS');
      setStep('ipfs-config');
    } finally {
      setIsUploading(false);
    }
  };

  const submitVote = async () => {
    setIsUploading(true);
    setError('');

    try {
      if (!connectedWallet) {
        throw new Error('Please connect a wallet to submit your vote.');
      }
      if (!drepId?.trim()) {
        throw new Error('DRep ID is required to submit a vote.');
      }
      if (!selectedProposal) {
        throw new Error('No proposal selected.');
      }
      if (!voteChoice) {
        throw new Error('Please select a vote choice.');
      }

      // Indicate submission progress
      setStep('uploading');

      const { submitVoteTransaction } = await import('@/lib/governance/transactions/vote');

      const txHashSubmitted = await submitVoteTransaction({
        wallet: connectedWallet,
        action: selectedProposal,
        drepId,
        vote: voteChoice,
        anchorUrl: rationaleUrl || undefined,
        anchorHash: rationaleHash || undefined,
        onStageChange: (stage) => {
          // Keep simple UI: we're already in 'uploading' step
          console.log('[vote] stage:', stage);
        },
      });

      setTxHash(txHashSubmitted);
      setStep('success');
    } catch (err) {
      console.error('[vote] submit error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit vote');
      setStep('confirm');
    } finally {
      setIsUploading(false);
    }
  };

  const downloadRationaleJson = () => {
    const metadata = buildRationaleJson();
    const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vote-rationale-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleNextFromVoterId = () => {
    if (!drepId.trim()) {
      setError('Please enter your DRep ID');
      return;
    }
    setError('');
    setStep('proposal');
  };

  const handleNextFromProposal = () => {
    if (!selectedProposal) {
      setError('Please select a proposal');
      return;
    }
    setError('');
    setStep('vote-choice');
  };

  const handleNextFromVoteChoice = () => {
    if (!voteChoice) {
      setError('Please select your vote');
      return;
    }
    setError('');
    setStep('rationale');
  };

  const handleNextFromRationale = () => {
    // Validate required fields for CIP-136
    // if (!authorName.trim()) {
    //   setError('Author name is required');
    //   return;
    // }
    if (!summary.trim()) {
      setError('Summary is required');
      return;
    }
    if (summary.length > MAX_CHAR_LIMITS.summary) {
      setError(`Summary must be ${MAX_CHAR_LIMITS.summary} characters or less`);
      return;
    }
    if (!rationaleStatement.trim()) {
      setError('Rationale statement is required');
      return;
    }
    setError('');
    setStep('ipfs-config');
  };

  const resetForm = () => {
    setStep('voter-id');
    setDrepId('');
    setSelectedProposal(null);
    setVoteChoice(null);
   // setAuthorName('');
    setSummary('');
    setRationaleStatement('');
    setPrecedentDiscussion('');
    setCounterargumentDiscussion('');
    setConclusion('');
    setReferences([]);
    setIpfsApiKey('');
    setRationaleUrl('');
    setRationaleHash('');
    setTxHash('');
    setError('');
  };

  // Render uploading state
  if (step === 'uploading') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-field-green mx-auto mb-4"></div>
            <p className="text-lg font-medium mb-2">
              {rationaleUrl ? 'Submitting your vote...' : 'Uploading rationale to IPFS...'}
            </p>
            <p className="text-sm text-muted-foreground">
              This may take a moment. Please don't close this window.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Render success state
  if (step === 'success') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-field-green mx-auto mb-4" />
            <h2 className="text-2xl font-display font-bold mb-2">Vote Submitted Successfully!</h2>
            <p className="text-muted-foreground mb-6">
              Your vote has been recorded on the Cardano blockchain.
            </p>
            
            <div className="bg-muted rounded-lg p-4 mb-6 text-left max-w-2xl mx-auto">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">Transaction Hash:</span>
                  <span className="font-mono text-xs">{txHash}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">DRep ID:</span>
                  <span className="font-mono text-xs truncate ml-2">{drepId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Proposal:</span>
                  <span className="truncate ml-2">{getActionTitle(selectedProposal!)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Vote:</span>
                  <span className="uppercase font-semibold">{voteChoice}</span>
                </div>
                {rationaleUrl && (
                  <div className="flex justify-between">
                    <span className="font-medium">Rationale:</span>
                    <span className="font-mono text-xs truncate ml-2">{rationaleUrl}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={resetForm}>
                Submit Another Vote
              </Button>
              <Button onClick={() => window.location.href = '/actions'}>
                View All Proposals
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold mb-2">Cast Your Vote</h1>
        <p className="text-muted-foreground">
          Vote on governance proposals as a Delegated Representative (DRep)
        </p>
      </div>

      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[
            { id: 'voter-id', label: 'Voter ID' },
            { id: 'proposal', label: 'Proposal' },
            { id: 'vote-choice', label: 'Vote' },
            { id: 'rationale', label: 'Rationale' },
            { id: 'ipfs-config', label: 'Storage' },
            { id: 'confirm', label: 'Confirm' },
          ].map((s, idx, arr) => {
            const isActive = step === s.id;
            const isCompleted = arr.findIndex((x) => x.id === step) > idx;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      isCompleted
                        ? 'bg-field-green text-white'
                        : isActive
                        ? 'bg-field-green/20 text-field-green border-2 border-field-green'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? '✓' : idx + 1}
                  </div>
                  <span className="text-xs mt-1 text-center">{s.label}</span>
                </div>
                {idx < arr.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 ${
                      isCompleted ? 'bg-field-green' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Voter Identification */}
      {step === 'voter-id' && (
        <Card>
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-display font-bold mb-2">Voter Identification</h2>
              <p className="text-sm text-muted-foreground">
                Enter your DRep ID to cast a vote. This should be your registered DRep credential.
              </p>
            </div>

            <div>
              <label htmlFor="drep-id" className="block text-sm font-medium mb-2">
                DRep ID *
              </label>
              <input
                id="drep-id"
                type="text"
                value={drepId}
                onChange={(e) => setDrepId(e.target.value)}
                placeholder="drep1..."
                className="w-full px-4 py-2 border border-input rounded-md bg-background font-mono text-sm"
                autoComplete="off"
                readOnly={!!connectedWallet && !!drepId}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your registered DRep identifier (CIP-105 or CIP-129 format)
              </p>
              {connectedWallet && drepId && (
                <div className="mt-2 text-xs text-blue-700 dark:text-blue-300 font-mono">
                  <span className="font-semibold">Auto-filled from wallet:</span> {connectedWallet.stakeAddress}
                </div>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => window.history.back()} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleNextFromVoterId} disabled={!drepId.trim()} className="flex-1">
                Next: Select Proposal
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Proposal Selection */}
      {step === 'proposal' && (
        <Card>
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-display font-bold mb-2">Select Proposal</h2>
              <p className="text-sm text-muted-foreground">
                Choose the governance action you want to vote on.
              </p>
              {preSelectedProposalId && selectedProposal && (
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded">
                  <p className="text-xs text-blue-900 dark:text-blue-100">
                    ℹ️ Pre-selected proposal from link
                  </p>
                </div>
              )}
            </div>

            {loadingProposals ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-field-green mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Loading proposals...</p>
              </div>
            ) : proposals.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No active proposals found</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {proposals.map((proposal) => (
                  <button
                    key={proposal.action_id}
                    onClick={() => setSelectedProposal(proposal)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                      selectedProposal?.action_id === proposal.action_id
                        ? 'border-field-green bg-field-green/10'
                        : 'border-input hover:border-field-green/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold mb-1 truncate">
                          {getActionTitle(proposal)}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {getActionDescription(proposal) || 'No description available'}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <span className="text-xs px-2 py-1 bg-muted rounded">
                            {proposal.type}
                          </span>
                          <span className="text-xs px-2 py-1 bg-muted rounded">
                            {proposal.status}
                          </span>
                        </div>
                      </div>
                      {selectedProposal?.action_id === proposal.action_id && (
                        <CheckCircle className="w-5 h-5 text-field-green flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('voter-id')} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleNextFromProposal}
                disabled={!selectedProposal}
                className="flex-1"
              >
                Next: Cast Vote
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 3: Vote Choice */}
      {step === 'vote-choice' && (
        <Card>
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-display font-bold mb-2">Cast Your Vote</h2>
              <p className="text-sm text-muted-foreground">
                Select how you want to vote on this proposal.
              </p>
            </div>

            {selectedProposal && (
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-1">{getActionTitle(selectedProposal)}</h3>
                <p className="text-sm text-muted-foreground">
                  {getActionDescription(selectedProposal)}
                </p>
              </div>
            )}

            <div className="space-y-3">
              {(['yes', 'no', 'abstain'] as VoteChoice[]).map((choice) => (
                <button
                  key={choice}
                  onClick={() => setVoteChoice(choice)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    voteChoice === choice
                      ? 'border-field-green bg-field-green/10'
                      : 'border-input hover:border-field-green/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-lg capitalize">{choice}</p>
                      <p className="text-sm text-muted-foreground">
                        {choice === 'yes' && 'Vote in favor of this proposal'}
                        {choice === 'no' && 'Vote against this proposal'}
                        {choice === 'abstain' && 'Abstain from voting on this proposal'}
                      </p>
                    </div>
                    {voteChoice === choice && (
                      <CheckCircle className="w-6 h-6 text-field-green" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('proposal')} className="flex-1">
                Back
              </Button>
              <Button onClick={handleNextFromVoteChoice} disabled={!voteChoice} className="flex-1">
                Next: Add Rationale
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 4: Vote Rationale (CIP-136) */}
      {step === 'rationale' && (
        <Card>
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-display font-bold mb-2">Vote Rationale</h2>
              <p className="text-sm text-muted-foreground">
                Explain your reasoning following the CIP-136 standard. Required fields are marked with *.
              </p>
            </div>

            <div className="space-y-4">
              {/* Author Name
              <div>
                <label htmlFor="author-name" className="block text-sm font-medium mb-2">
                  Author Name *
                </label>
                <input
                  id="author-name"
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Your name or username"
                  className="w-full px-4 py-2 border border-input rounded-md bg-background"
                />
              </div> */}

              {/* Summary */}
              <div>
                <label htmlFor="summary" className="block text-sm font-medium mb-2">
                  Summary * <span className="text-muted-foreground">({summary.length}/{MAX_CHAR_LIMITS.summary})</span>
                </label>
                <textarea
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value.slice(0, MAX_CHAR_LIMITS.summary))}
                  placeholder="A clear and concise statement of your position (max 300 characters)"
                  className="w-full px-4 py-2 border border-input rounded-md bg-background min-h-[80px]"
                  maxLength={MAX_CHAR_LIMITS.summary}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Clearly state your stance and give a brief overview of your main arguments
                </p>
              </div>

              {/* Rationale Statement */}
              <div>
                <label htmlFor="rationale-statement" className="block text-sm font-medium mb-2">
                  Rationale Statement * <span className="text-muted-foreground">({rationaleStatement.length}/{MAX_CHAR_LIMITS.rationaleStatement})</span>
                </label>
                <textarea
                  id="rationale-statement"
                  value={rationaleStatement}
                  onChange={(e) => setRationaleStatement(e.target.value.slice(0, MAX_CHAR_LIMITS.rationaleStatement))}
                  placeholder="Fully describe your rationale and discuss your arguments in detail (markdown supported)"
                  className="w-full px-4 py-2 border border-input rounded-md bg-background min-h-[200px]"
                  maxLength={MAX_CHAR_LIMITS.rationaleStatement}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This is the core of your rationale. Discuss your arguments in full detail.
                </p>
              </div>

              {/* Precedent Discussion (Optional) */}
              <div>
                <label htmlFor="precedent-discussion" className="block text-sm font-medium mb-2">
                  Precedent Discussion <span className="text-muted-foreground">(Optional, {precedentDiscussion.length}/{MAX_CHAR_LIMITS.precedentDiscussion})</span>
                </label>
                <textarea
                  id="precedent-discussion"
                  value={precedentDiscussion}
                  onChange={(e) => setPrecedentDiscussion(e.target.value.slice(0, MAX_CHAR_LIMITS.precedentDiscussion))}
                  placeholder="Discuss relevant precedent (markdown supported)"
                  className="w-full px-4 py-2 border border-input rounded-md bg-background min-h-[120px]"
                  maxLength={MAX_CHAR_LIMITS.precedentDiscussion}
                />
              </div>

              {/* Counterargument Discussion (Optional) */}
              <div>
                <label htmlFor="counterargument-discussion" className="block text-sm font-medium mb-2">
                  Counterargument Discussion <span className="text-muted-foreground">(Optional, {counterargumentDiscussion.length}/{MAX_CHAR_LIMITS.counterargumentDiscussion})</span>
                </label>
                <textarea
                  id="counterargument-discussion"
                  value={counterargumentDiscussion}
                  onChange={(e) => setCounterargumentDiscussion(e.target.value.slice(0, MAX_CHAR_LIMITS.counterargumentDiscussion))}
                  placeholder="Discuss significant counter-arguments to your position (markdown supported)"
                  className="w-full px-4 py-2 border border-input rounded-md bg-background min-h-[120px]"
                  maxLength={MAX_CHAR_LIMITS.counterargumentDiscussion}
                />
              </div>

              {/* Conclusion (Optional) */}
              <div>
                <label htmlFor="conclusion" className="block text-sm font-medium mb-2">
                  Conclusion <span className="text-muted-foreground">(Optional, {conclusion.length}/{MAX_CHAR_LIMITS.conclusion})</span>
                </label>
                <textarea
                  id="conclusion"
                  value={conclusion}
                  onChange={(e) => setConclusion(e.target.value.slice(0, MAX_CHAR_LIMITS.conclusion))}
                  placeholder="Conclude your rationale"
                  className="w-full px-4 py-2 border border-input rounded-md bg-background min-h-[80px]"
                  maxLength={MAX_CHAR_LIMITS.conclusion}
                />
              </div>

              {/* References (Optional) */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  References <span className="text-muted-foreground">(Optional)</span>
                </label>
                <div className="space-y-3">
                  {references.map((ref, index) => (
                    <div key={index} className="p-3 border border-input rounded-md bg-muted/30">
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex gap-2">
                          <select
                            value={ref.type}
                            onChange={(e) => {
                              const newRefs = [...references];
                              newRefs[index].type = e.target.value as 'GovernanceMetadata' | 'Other' | 'RelevantArticles';
                              setReferences(newRefs);
                            }}
                            className="px-2 py-1 border border-input rounded-md bg-background text-sm"
                          >
                            <option value="RelevantArticles">Relevant Articles</option>
                            <option value="GovernanceMetadata">Governance Metadata</option>
                            <option value="Other">Other</option>
                          </select>
                          <button
                            onClick={() => setReferences(references.filter((_, i) => i !== index))}
                            className="px-2 py-1 text-sm text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          type="text"
                          value={ref.label}
                          onChange={(e) => {
                            const newRefs = [...references];
                            newRefs[index].label = e.target.value;
                            setReferences(newRefs);
                          }}
                          placeholder="Reference label (e.g., 'Article III section 8')"
                          className="w-full px-3 py-1.5 border border-input rounded-md bg-background text-sm"
                        />
                        <input
                          type="url"
                          value={ref.uri}
                          onChange={(e) => {
                            const newRefs = [...references];
                            newRefs[index].uri = e.target.value;
                            setReferences(newRefs);
                          }}
                          placeholder="URL (e.g., 'https://...')"
                          className="w-full px-3 py-1.5 border border-input rounded-md bg-background text-sm font-mono"
                        />
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReferences([...references, { type: 'Other', label: '', uri: '' }])}
                    className="w-full"
                  >
                    + Add Reference
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Add links to relevant constitution articles, governance metadata, or other supporting resources
                </p>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('vote-choice')} className="flex-1">
                Back
              </Button>
              <Button onClick={handleNextFromRationale} className="flex-1">
                Next: Storage Config
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 5: IPFS Storage Configuration */}
      {step === 'ipfs-config' && (
        <Card>
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-display font-bold mb-2">IPFS Storage Configuration</h2>
              <p className="text-sm text-muted-foreground">
                Upload your CIP-136 compliant vote rationale to IPFS for permanent, decentralized storage.
              </p>
            </div>

            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <div>
                <label htmlFor="ipfs-provider" className="block text-sm font-medium mb-2">
                  IPFS Provider *
                </label>
                <select
                  id="ipfs-provider"
                  value={ipfsProvider}
                  onChange={(e) => setIpfsProvider(e.target.value as IpfsProvider)}
                  className="w-full px-4 py-2 border border-input rounded-md bg-background"
                >
                  <option value="pinata">Pinata</option>
                  <option value="blockfrost">Blockfrost</option>
                </select>
              </div>

              <div>
                <label htmlFor="ipfs-api-key" className="block text-sm font-medium mb-2">
                  {ipfsProvider === 'pinata' ? 'Pinata JWT Token' : 'Blockfrost Project ID'} *
                </label>
                <input
                  id="ipfs-api-key"
                  type="password"
                  value={ipfsApiKey}
                  onChange={(e) => setIpfsApiKey(e.target.value)}
                  placeholder={
                    ipfsProvider === 'pinata'
                      ? 'Your Pinata JWT token'
                      : 'Your Blockfrost IPFS project ID'
                  }
                  className="w-full px-4 py-2 border border-input rounded-md bg-background font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {ipfsProvider === 'pinata' ? (
                    <>
                      Get your JWT from{' '}
                      <a
                        href="https://app.pinata.cloud/developers/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-field-green hover:underline"
                      >
                        Pinata Dashboard
                      </a>
                    </>
                  ) : (
                    <>
                      Get your project ID from{' '}
                      <a
                        href="https://blockfrost.io/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-field-green hover:underline"
                      >
                        Blockfrost Dashboard
                      </a>
                    </>
                  )}
                </p>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-900 dark:text-blue-100">
                  <strong>Note:</strong> Your API key is only used for this upload and is not stored.
                  Your rationale will be permanently available on IPFS.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={downloadRationaleJson}
                className="w-full"
              >
                <FileJson className="w-4 h-4 mr-2" />
                Download Rationale JSON
              </Button>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('rationale')} className="flex-1">
                Back
              </Button>
              <Button
                onClick={uploadRationaleToIpfs}
                disabled={!ipfsApiKey.trim()}
                className="flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload & Continue
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 6: Confirm & Submit */}
      {step === 'confirm' && (
        <Card>
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-display font-bold mb-2">Confirm Your Vote</h2>
              <p className="text-sm text-muted-foreground">
                Review your vote details before submitting to the blockchain.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div>
                  <span className="text-sm font-medium">DRep ID:</span>
                  <p className="font-mono text-sm mt-1 break-all">{drepId}</p>
                </div>

                <div>
                  <span className="text-sm font-medium">Proposal:</span>
                  <p className="text-sm mt-1">{getActionTitle(selectedProposal!)}</p>
                  <p className="font-mono text-xs text-muted-foreground mt-1">
                    {selectedProposal?.action_id}
                  </p>
                </div>

                <div>
                  <span className="text-sm font-medium">Your Vote:</span>
                  <p className="text-lg font-semibold uppercase mt-1">{voteChoice}</p>
                </div>

                <div>
                  <span className="text-sm font-medium">Rationale:</span>
                  <p className="text-sm mt-1">{summary}</p>
                  <p className="font-mono text-xs text-muted-foreground mt-1 break-all">
                    {rationaleUrl}
                  </p>
                </div>

                <div>
                  <span className="text-sm font-medium">Hash:</span>
                  <p className="font-mono text-xs mt-1 break-all">{rationaleHash}</p>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-900 dark:text-yellow-100">
                  <strong>Important:</strong> Once submitted, your vote cannot be changed. Please ensure
                  all information is correct before proceeding.
                </p>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('ipfs-config')} className="flex-1">
                Back
              </Button>
              <Button onClick={submitVote} className="flex-1">
                <Vote className="w-4 h-4 mr-2" />
                Submit Vote
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
