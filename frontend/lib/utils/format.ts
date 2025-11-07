/**
 * Formatting utilities for dates, numbers, and currency
 */

import { CARDANO_CONSTANTS, DATE_FORMATS } from '@/lib/constants';

type DateFormatKey = Exclude<keyof typeof DATE_FORMATS, 'RELATIVE_THRESHOLDS'>;

const DATE_FORMAT_OPTIONS: Record<DateFormatKey, Intl.DateTimeFormatOptions> = {
  SHORT: { year: 'numeric', month: 'short', day: 'numeric' },
  LONG: { year: 'numeric', month: 'long', day: 'numeric' },
  DATETIME: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
  TIME: { hour: '2-digit', minute: '2-digit' },
};

/**
 * Format ADA amount from lovelace
 */
export function formatAda(lovelace: string | bigint | number, decimals: number = 2): string {
  const amount = typeof lovelace === 'bigint' 
    ? Number(lovelace) 
    : typeof lovelace === 'string' 
      ? BigInt(lovelace) 
      : lovelace;
  
  const ada = Number(amount) / CARDANO_CONSTANTS.LOVELACE_PER_ADA;
  
  if (ada >= 1_000_000) {
    return `${(ada / 1_000_000).toFixed(decimals)}M ₳`;
  }
  if (ada >= 1_000) {
    return `${(ada / 1_000).toFixed(decimals)}K ₳`;
  }
  return `${ada.toFixed(decimals)} ₳`;
}

/**
 * Format voting power from lovelace
 */
export function formatVotingPower(power: string | undefined): string {
  if (!power) return '0 ₳';
  return formatAda(power);
}

/**
 * Format number with K/M suffixes
 */
export function formatNumber(num: number | undefined): string {
  if (!num) return '0';
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

/**
 * Format relative time from timestamp
 */
export function formatRelativeTime(timestamp?: number): string | null {
  if (!timestamp) return null;
  
  const now = Date.now() / 1000; // Current time in seconds
  const diff = now - timestamp; // Difference in seconds
  
  const { RELATIVE_THRESHOLDS } = DATE_FORMATS;
  
  if (diff < RELATIVE_THRESHOLDS.SECONDS) return 'Just now';
  if (diff < RELATIVE_THRESHOLDS.MINUTES) return `${Math.floor(diff / RELATIVE_THRESHOLDS.SECONDS)}m ago`;
  if (diff < RELATIVE_THRESHOLDS.HOURS) return `${Math.floor(diff / RELATIVE_THRESHOLDS.MINUTES)}h ago`;
  if (diff < RELATIVE_THRESHOLDS.DAYS) return `${Math.floor(diff / RELATIVE_THRESHOLDS.HOURS)}d ago`;
  if (diff < RELATIVE_THRESHOLDS.WEEKS) return `${Math.floor(diff / RELATIVE_THRESHOLDS.DAYS)}w ago`;
  return `${Math.floor(diff / RELATIVE_THRESHOLDS.WEEKS)}mo ago`;
}

/**
 * Format date string
 */
export function formatDate(date: Date | string | number, format: DateFormatKey = 'SHORT'): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date;
  
  const options = DATE_FORMAT_OPTIONS[format] ?? DATE_FORMAT_OPTIONS.SHORT;
  return new Intl.DateTimeFormat('en-US', options).format(dateObj);
}

