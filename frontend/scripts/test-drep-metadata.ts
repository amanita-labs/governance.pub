import assert from 'node:assert/strict';
import {
  sanitizeMetadataValue,
  getMetadataName,
  getMetadataDescription,
  getMetadataWebsite,
  getMetadataPaymentAddress,
} from '../lib/governance/drepMetadata';

type Sample = {
  raw: unknown;
  expectedName?: string;
  expectedDescription?: string;
  expectedWebsite?: string;
  expectedPaymentAddress?: string;
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
  {
    raw: {
      paymentAddress: 'addr1q9examplepayment',
    },
    expectedPaymentAddress: 'addr1q9examplepayment',
  },
  {
    raw: {
      body: {
        paymentAddress: 'addr1qybodyaddress',
      },
    },
    expectedPaymentAddress: 'addr1qybodyaddress',
  },
];

for (const sample of samples) {
  const metadata = sanitizeMetadataValue(sample.raw);
  const name = getMetadataName(metadata);
  const description = getMetadataDescription(metadata);
  const website = getMetadataWebsite(metadata);
  const paymentAddress = getMetadataPaymentAddress(metadata);

  if (sample.expectedName !== undefined) {
    assert.equal(name, sample.expectedName, 'expected metadata name to match');
  }

  if (sample.expectedDescription !== undefined) {
    assert.equal(description, sample.expectedDescription, 'expected description to match');
  }

  if (sample.expectedWebsite !== undefined) {
    assert.equal(website, sample.expectedWebsite, 'expected website to match');
  }

  if (sample.expectedPaymentAddress !== undefined) {
    assert.equal(paymentAddress, sample.expectedPaymentAddress, 'expected payment address to match');
  }
}

console.log('drep metadata helper tests passed');
