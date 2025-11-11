'use client';

import { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { EmojiBadge } from '../ui/Badge';
import { Upload, Link as LinkIcon, FileJson, X, Plus } from 'lucide-react';

export interface DRepMetadata {
  '@context': {
    '@language': string;
    CIP100: string;
    CIP119: string;
    hashAlgorithm: string;
    body: {
      '@id': string;
      references: {
        '@id': string;
      };
    };
  };
  hashAlgorithm: string;
  body: {
    givenName: string;
    objectives?: string;
    motivations?: string;
    qualifications?: string;
    paymentAddress?: string;
    image?: {
      '@type': 'ImageObject';
      contentUrl: string;
      sha256?: string;
    };
    references?: Array<{
      '@type': 'Link' | 'Identity' | 'Other';
      label: string;
      uri: string;
    }>;
    doNotList?: 'true' | 'false';
  };
}

export type StorageOption = 'ipfs' | 'custom' | 'none';
export type IpfsProvider = 'pinata' | 'blockfrost';

interface DRepMetadataFormProps {
  onMetadataCreated: (metadataUrl?: string, metadataHash?: string) => void;
  onCancel: () => void;
  initialMetadata?: Partial<DRepMetadata['body']>;
}

interface ReferenceItem {
  type: 'Link' | 'Identity' | 'Other';
  label: string;
  uri: string;
}

const MAX_CHAR_LIMITS = {
  givenName: 80,
  objectives: 1000,
  motivations: 1000,
  qualifications: 1000,
};

export default function DRepMetadataForm({
  onMetadataCreated,
  onCancel,
  initialMetadata,
}: DRepMetadataFormProps) {
  const [step, setStep] = useState<'fields' | 'storage' | 'uploading'>('fields');
  const [storageOption, setStorageOption] = useState<StorageOption>('ipfs');
  const [ipfsProvider, setIpfsProvider] = useState<IpfsProvider>('pinata');
  const [ipfsApiKey, setIpfsApiKey] = useState('');
  
  // Form fields
  const [givenName, setGivenName] = useState(initialMetadata?.givenName || '');
  const [objectives, setObjectives] = useState(initialMetadata?.objectives || '');
  const [motivations, setMotivations] = useState(initialMetadata?.motivations || '');
  const [qualifications, setQualifications] = useState(initialMetadata?.qualifications || '');
  const [paymentAddress, setPaymentAddress] = useState(initialMetadata?.paymentAddress || '');
  const [imageUrl, setImageUrl] = useState('');
  const [imageHash, setImageHash] = useState('');
  const [doNotList, setDoNotList] = useState<boolean>(false);
  const [references, setReferences] = useState<ReferenceItem[]>(
    initialMetadata?.references?.map(r => ({
      type: r['@type'] as 'Link' | 'Identity' | 'Other',
      label: r.label,
      uri: r.uri,
    })) || []
  );

  // Custom URL or JSON file
  const [customUrl, setCustomUrl] = useState('');
  const [customHash, setCustomHash] = useState('');
  const [uploadError, setUploadError] = useState('');

  const handleAddReference = () => {
    setReferences([...references, { type: 'Link', label: '', uri: '' }]);
  };

  const handleRemoveReference = (index: number) => {
    setReferences(references.filter((_, i) => i !== index));
  };

  const handleReferenceChange = (index: number, field: keyof ReferenceItem, value: string) => {
    const updated = [...references];
    updated[index] = { ...updated[index], [field]: value };
    setReferences(updated);
  };

  const buildMetadataJson = (): DRepMetadata => {
    const metadata: DRepMetadata = {
      '@context': {
        '@language': 'en-us',
        CIP100: 'https://github.com/cardano-foundation/CIPs/blob/master/CIP-0100/README.md#',
        CIP119: 'https://github.com/cardano-foundation/CIPs/blob/master/CIP-0119/README.md#',
        hashAlgorithm: 'CIP100:hashAlgorithm',
        body: {
          '@id': 'CIP119:body',
          references: {
            '@id': 'CIP100:references',
          },
        },
      },
      hashAlgorithm: 'blake2b-256',
      body: {
        givenName,
      },
    };

    if (objectives) metadata.body.objectives = objectives;
    if (motivations) metadata.body.motivations = motivations;
    if (qualifications) metadata.body.qualifications = qualifications;
    if (paymentAddress) metadata.body.paymentAddress = paymentAddress;
    if (doNotList) metadata.body.doNotList = 'true';

    if (imageUrl) {
      metadata.body.image = {
        '@type': 'ImageObject',
        contentUrl: imageUrl,
      };
      if (imageHash) {
        metadata.body.image.sha256 = imageHash;
      }
    }

    const validReferences = references.filter(r => r.label && r.uri);
    if (validReferences.length > 0) {
      metadata.body.references = validReferences.map(r => ({
        '@type': r.type,
        label: r.label,
        uri: r.uri,
      }));
    }

    return metadata;
  };

  const handleNextToStorage = () => {
    if (!givenName.trim()) {
      setUploadError('Given name is required');
      return;
    }
    setUploadError('');
    setStep('storage');
  };

  const uploadToIpfs = async (metadata: DRepMetadata) => {
    setUploadError('');
    setStep('uploading');

    try {
      if (!ipfsApiKey.trim()) {
        throw new Error('IPFS API key is required');
      }

      const response = await fetch('/api/ipfs/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Send as object; backend will pretty-print before pinning
          metadata,
          provider: ipfsProvider,
          apiKey: ipfsApiKey,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload to IPFS');
      }

      const result = await response.json();
      const ipfsUrl = result.url; // e.g., ipfs://QmHash
      const hash = result.hash; // blake2b-256 hash

      onMetadataCreated(ipfsUrl, hash);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to upload to IPFS');
      setStep('storage');
    }
  };

  const handleStorageComplete = async () => {
    if (storageOption === 'none') {
      onMetadataCreated(undefined, undefined);
      return;
    }

    if (storageOption === 'custom') {
      if (!customUrl.trim()) {
        setUploadError('Please provide a metadata URL');
        return;
      }
      onMetadataCreated(customUrl, customHash || undefined);
      return;
    }

    if (storageOption === 'ipfs') {
      if (!ipfsApiKey.trim()) {
        setUploadError('Please provide an API key for the selected IPFS provider');
        return;
      }
      const metadata = buildMetadataJson();
      await uploadToIpfs(metadata);
    }
  };

  const downloadMetadataJson = () => {
    const metadata = buildMetadataJson();
    const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drep-metadata-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (step === 'uploading') {
    return (
      <Card className="wooly-border rounded-3xl border border-border/70 bg-background/85 p-10 text-center shadow-lg">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-field-green mx-auto mb-4"></div>
          <p className="text-lg font-medium mb-2">Uploading to IPFS...</p>
          <p className="text-sm text-muted-foreground">
            This may take a moment. Please don't close this window.
          </p>
        </div>
      </Card>
    );
  }

  if (step === 'storage') {
    return (
      <Card className="wooly-border rounded-3xl border border-border/70 bg-background/85 p-6 shadow-lg">
        <div className="space-y-6">
          <div className="flex flex-col gap-3">
            <EmojiBadge emoji="🧺" srLabel="Storage options">
              Choose a storage path
            </EmojiBadge>
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">Storage Configuration</h2>
              <p className="text-sm text-muted-foreground">
                Choose how you want to host your DRep metadata
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setStorageOption('ipfs')}
              className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${
                storageOption === 'ipfs'
                  ? 'border-field-green/70 bg-field-green/10 shadow-lg shadow-field-green/20'
                  : 'border-border/60 bg-background/80 hover:border-field-green/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <Upload className="w-5 h-5 mt-0.5 text-field-green" />
                <div className="flex-1">
                  <p className="font-semibold mb-1">IPFS (Recommended)</p>
                  <p className="text-sm text-muted-foreground">
                    Upload your metadata to IPFS for permanent, decentralized storage. 
                    Choose between Pinata or Blockfrost providers.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setStorageOption('custom')}
              className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${
                storageOption === 'custom'
                  ? 'border-field-green/70 bg-field-green/10 shadow-lg shadow-field-green/20'
                  : 'border-border/60 bg-background/80 hover:border-field-green/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <LinkIcon className="w-5 h-5 mt-0.5 text-field-green" />
                <div className="flex-1">
                  <p className="font-semibold mb-1">Custom URL</p>
                  <p className="text-sm text-muted-foreground">
                    Provide your own hosted metadata URL (GitHub, personal server, etc.)
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setStorageOption('none')}
              className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${
                storageOption === 'none'
                  ? 'border-field-green/70 bg-field-green/10 shadow-lg shadow-field-green/20'
                  : 'border-border/60 bg-background/80 hover:border-field-green/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <FileJson className="w-5 h-5 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-semibold mb-1">No Metadata</p>
                  <p className="text-sm text-muted-foreground">
                    Register without metadata (you can add it later via update)
                  </p>
                </div>
              </div>
            </button>
          </div>

          {storageOption === 'custom' && (
            <div className="space-y-4 rounded-2xl border border-border/60 bg-background/70 p-4">
              <div>
                <label htmlFor="custom-url" className="block text-sm font-medium mb-2">
                  Metadata URL *
                </label>
                <input
                  id="custom-url"
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://example.com/drep-metadata.json"
                  className="w-full px-4 py-2 border border-input rounded-md bg-background"
                />
              </div>
              <div>
                <label htmlFor="custom-hash" className="block text-sm font-medium mb-2">
                  Blake2b-256 Hash (optional)
                </label>
                <input
                  id="custom-hash"
                  type="text"
                  value={customHash}
                  onChange={(e) => setCustomHash(e.target.value)}
                  placeholder="blake2b-256 hash of the metadata file"
                  className="w-full px-4 py-2 border border-input rounded-md bg-background font-mono text-sm"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadMetadataJson}
                className="w-full"
              >
                Download JSON Template
              </Button>
            </div>
          )}

          {storageOption === 'ipfs' && (
            <div className="space-y-4 rounded-2xl border border-border/60 bg-background/70 p-4">
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
              <div className="rounded-2xl border border-blue-200/60 bg-blue-50/70 p-3 dark:border-blue-800/70 dark:bg-blue-950/20">
                <p className="text-xs text-blue-900 dark:text-blue-100">
                  <strong>Note:</strong> Your API key is only used for this upload and is not stored.
                  Your metadata will be permanently available on IPFS.
                </p>
              </div>
            </div>
          )}

          {storageOption === 'ipfs' && (
            <div className="rounded-2xl border border-blue-200/60 bg-blue-50/70 p-4 dark:border-blue-800/70 dark:bg-blue-950/20">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Note:</strong> Your metadata will be uploaded to IPFS and will be permanently available.
                Make sure all information is correct before proceeding.
              </p>
            </div>
          )}

          {uploadError && (
            <div className="rounded-2xl border border-red-300/70 bg-red-100/50 p-4 dark:border-red-800/70 dark:bg-red-950/20">
              <p className="text-sm text-red-900 dark:text-red-100">{uploadError}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('fields')} className="flex-1 rounded-full">
              Back to Metadata
            </Button>
            <Button onClick={handleStorageComplete} className="flex-1 rounded-full">
              Continue
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="wooly-border rounded-3xl border border-border/70 bg-background/85 p-6 shadow-lg">
      <div className="space-y-6">
        <div className="flex flex-col gap-3">
          <EmojiBadge emoji="📜" srLabel="Metadata creation">
            Craft your story
          </EmojiBadge>
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">DRep Metadata</h2>
            <p className="text-sm text-muted-foreground">
              Create your DRep profile following the CIP-119 standard. Only Given Name is required.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Given Name - Required */}
          <div>
            <label htmlFor="given-name" className="block text-sm font-medium mb-2">
              Given Name * <span className="text-muted-foreground">({givenName.length}/{MAX_CHAR_LIMITS.givenName})</span>
            </label>
            <input
              id="given-name"
              type="text"
              value={givenName}
              onChange={(e) => setGivenName(e.target.value.slice(0, MAX_CHAR_LIMITS.givenName))}
              placeholder="Your name or username"
              className="w-full px-4 py-2 border border-input rounded-md bg-background"
              maxLength={MAX_CHAR_LIMITS.givenName}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your profile name or username (required, max 80 characters)
            </p>
          </div>

          {/* Objectives */}
          <div>
            <label htmlFor="objectives" className="block text-sm font-medium mb-2">
              Objectives <span className="text-muted-foreground">({objectives.length}/{MAX_CHAR_LIMITS.objectives})</span>
            </label>
            <textarea
              id="objectives"
              value={objectives}
              onChange={(e) => setObjectives(e.target.value.slice(0, MAX_CHAR_LIMITS.objectives))}
              placeholder="What do you want to achieve as a DRep?"
              className="w-full px-4 py-2 border border-input rounded-md bg-background min-h-[100px]"
              maxLength={MAX_CHAR_LIMITS.objectives}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Describe your goals and what you believe in (max 1000 characters)
            </p>
          </div>

          {/* Motivations */}
          <div>
            <label htmlFor="motivations" className="block text-sm font-medium mb-2">
              Motivations <span className="text-muted-foreground">({motivations.length}/{MAX_CHAR_LIMITS.motivations})</span>
            </label>
            <textarea
              id="motivations"
              value={motivations}
              onChange={(e) => setMotivations(e.target.value.slice(0, MAX_CHAR_LIMITS.motivations))}
              placeholder="Why do you want to be a DRep?"
              className="w-full px-4 py-2 border border-input rounded-md bg-background min-h-[100px]"
              maxLength={MAX_CHAR_LIMITS.motivations}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Share your personal and professional experiences (max 1000 characters)
            </p>
          </div>

          {/* Qualifications */}
          <div>
            <label htmlFor="qualifications" className="block text-sm font-medium mb-2">
              Qualifications <span className="text-muted-foreground">({qualifications.length}/{MAX_CHAR_LIMITS.qualifications})</span>
            </label>
            <textarea
              id="qualifications"
              value={qualifications}
              onChange={(e) => setQualifications(e.target.value.slice(0, MAX_CHAR_LIMITS.qualifications))}
              placeholder="What qualifies you for this role?"
              className="w-full px-4 py-2 border border-input rounded-md bg-background min-h-[100px]"
              maxLength={MAX_CHAR_LIMITS.qualifications}
            />
            <p className="text-xs text-muted-foreground mt-1">
              List relevant qualifications and experience (max 1000 characters)
            </p>
          </div>

          {/* Payment Address */}
          <div>
            <label htmlFor="payment-address" className="block text-sm font-medium mb-2">
              Payment Address (Optional)
            </label>
            <input
              id="payment-address"
              type="text"
              value={paymentAddress}
              onChange={(e) => setPaymentAddress(e.target.value)}
              placeholder="addr1..."
              className="w-full px-4 py-2 border border-input rounded-md bg-background font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Bech32 encoded Cardano address for donations or incentives
            </p>
          </div>

          {/* Image */}
          <div>
            <label htmlFor="image-url" className="block text-sm font-medium mb-2">
              Profile Image URL (Optional)
            </label>
            <input
              id="image-url"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/profile.jpg"
              className="w-full px-4 py-2 border border-input rounded-md bg-background"
            />
            {imageUrl && (
              <div className="mt-2">
                <label htmlFor="image-hash" className="block text-xs text-muted-foreground mb-1">
                  SHA256 Hash (optional, for verification)
                </label>
                <input
                  id="image-hash"
                  type="text"
                  value={imageHash}
                  onChange={(e) => setImageHash(e.target.value)}
                  placeholder="SHA256 hash of the image"
                  className="w-full px-3 py-1.5 border border-input rounded-md bg-background font-mono text-xs"
                />
              </div>
            )}
          </div>

          {/* References */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">
                References (Social Media, Websites)
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddReference}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Reference
              </Button>
            </div>
            {references.map((ref, index) => (
              <div key={index} className="p-3 border border-input rounded-md mb-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <select
                      value={ref.type}
                      onChange={(e) =>
                        handleReferenceChange(index, 'type', e.target.value)
                      }
                      className="w-full px-3 py-1.5 border border-input rounded-md bg-background text-sm"
                    >
                      <option value="Link">Link</option>
                      <option value="Identity">Identity</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={ref.label}
                      onChange={(e) =>
                        handleReferenceChange(index, 'label', e.target.value)
                      }
                      placeholder="Label (e.g., Twitter)"
                      className="w-full px-3 py-1.5 border border-input rounded-md bg-background text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={ref.uri}
                      onChange={(e) =>
                        handleReferenceChange(index, 'uri', e.target.value)
                      }
                      placeholder="URL"
                      className="flex-1 px-3 py-1.5 border border-input rounded-md bg-background text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveReference(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-1">
              Add links to your social media profiles or websites. Use "Identity" type for verification.
            </p>
          </div>

          {/* Do Not List */}
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/70 p-4">
            <input
              id="do-not-list"
              type="checkbox"
              checked={doNotList}
              onChange={(e) => setDoNotList(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="do-not-list" className="text-sm cursor-pointer">
              Do not list me in DRep directories (I don't want to campaign for delegations)
            </label>
          </div>
        </div>

        {uploadError && (
          <div className="rounded-2xl border border-red-300/70 bg-red-100/50 p-4 dark:border-red-800/70 dark:bg-red-950/20">
            <p className="text-sm text-red-900 dark:text-red-100">{uploadError}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1 rounded-full">
            Cancel
          </Button>
          <Button onClick={handleNextToStorage} disabled={!givenName.trim()} className="flex-1 rounded-full">
            Next: Storage
          </Button>
        </div>
      </div>
    </Card>
  );
}
