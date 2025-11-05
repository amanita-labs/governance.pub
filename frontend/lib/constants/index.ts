// Network constants
export const NETWORKS = {
  MAINNET: 'mainnet',
  PREPROD: 'preprod',
  PREVIEW: 'preview',
} as const;

export type Network = typeof NETWORKS[keyof typeof NETWORKS];

// API endpoints
export const API_ENDPOINTS = {
  KOIOS: 'https://api.koios.xyz/api/v1',
  BLOCKFROST_MAINNET: 'https://cardano-mainnet.blockfrost.io/api/v0',
  BLOCKFROST_PREPROD: 'https://cardano-preprod.blockfrost.io/api/v0',
  BLOCKFROST_PREVIEW: 'https://cardano-preview.blockfrost.io/api/v0',
} as const;

// Cardano constants
export const CARDANO_CONSTANTS = {
  LOVELACE_PER_ADA: 1_000_000,
  MIN_UTXO_VALUE: 1_000_000,
  MIN_POOL_DEPOSIT: 500_000_000,
  MIN_DREP_DEPOSIT: 2_000_000,
} as const;

// UI constants
export const UI_CONSTANTS = {
  ITEMS_PER_PAGE: 20,
  DEBOUNCE_DELAY: 300,
  ANIMATION_DURATION: 200,
  SKELETON_COUNT: 6,
} as const;

// Date formatting
export const DATE_FORMATS = {
  SHORT: 'MMM d, yyyy',
  LONG: 'MMMM d, yyyy',
  DATETIME: 'MMM d, yyyy HH:mm',
  TIME: 'HH:mm',
  RELATIVE_THRESHOLDS: {
    SECONDS: 60,
    MINUTES: 3600,
    HOURS: 86400,
    DAYS: 604800,
    WEEKS: 2592000,
  },
} as const;

