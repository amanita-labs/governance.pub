import assert from 'node:assert/strict';
import {
  sanitizeMetadataValue,
  getMetadataName,
  getMetadataDescription,
  getMetadataWebsite,
} from '../lib/governance/drepMetadata';

type Sample = {
  raw: unknown;
  expectedName?: string;
  expectedDescription?: string;
  expectedWebsite?: string;
};

const samples: Sample[] = [
  {
    raw: {
      name: 'AltcoinOracle',
      website: 'https://altcoinoracle.com',
    },
    expectedName: 'AltcoinOracle',
    expectedWebsite: 'https://altcoinoracle.com',
  },
  {
    raw: {
      body: {
        givenName: 'Jocelyn',
        motivations: 'Motivations',
        references: [
          {
            '@type': 'Other',
            label: 'Label',
            uri: 'https://round-liar.info',
          },
        ],
      },
      '@context': {
        '@language': 'en-us',
        body: {
          givenName: 'CIP119:givenName',
        },
      },
    },
    expectedName: 'Jocelyn',
  },
  {
    raw: {
      body: {
        givenName: 'Margaret',
        description: [{ '@value': 'Cardano DRep' }],
        image: {
          '@type': 'ImageObject',
          contentUrl: 'ipfs://example',
        },
        website: [{ '@value': 'https://cardano.org' }],
      },
    },
    expectedName: 'Margaret',
    expectedDescription: 'Cardano DRep',
    expectedWebsite: 'https://cardano.org',
  },
];

for (const sample of samples) {
  const metadata = sanitizeMetadataValue(sample.raw);
  const name = getMetadataName(metadata);
  const description = getMetadataDescription(metadata);
  const website = getMetadataWebsite(metadata);

  if (sample.expectedName !== undefined) {
    assert.equal(name, sample.expectedName, 'expected metadata name to match');
  }

  if (sample.expectedDescription !== undefined) {
    assert.equal(description, sample.expectedDescription, 'expected description to match');
  }

  if (sample.expectedWebsite !== undefined) {
    assert.equal(website, sample.expectedWebsite, 'expected website to match');
  }
}

console.log('drep metadata helper tests passed');
