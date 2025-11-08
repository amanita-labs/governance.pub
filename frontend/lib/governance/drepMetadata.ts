import type { DRepMetadata, JsonObject, JsonValue } from '@/types/governance';

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const tryDecodeHexJson = (value: string): JsonValue | undefined => {
  const cleaned = value
    .trim()
    .replace(/\\x/g, '')
    .replace(/^\\?x/i, '');

  if (cleaned.length === 0 || cleaned.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(cleaned)) {
    return undefined;
  }

  try {
    const bytes = new Uint8Array(cleaned.length / 2);
    for (let i = 0; i < cleaned.length; i += 2) {
      bytes[i / 2] = parseInt(cleaned.slice(i, i + 2), 16);
    }
    const decoded = new TextDecoder('utf-8').decode(bytes);
    if (!decoded) {
      return undefined;
    }
    const parsed = JSON.parse(decoded);
    if (parsed === null || typeof parsed === 'string' || typeof parsed === 'number' || typeof parsed === 'boolean') {
      return parsed as JsonValue;
    }
    if (Array.isArray(parsed) || isJsonObject(parsed)) {
      return parsed as JsonValue;
    }
    return undefined;
  } catch {
    return undefined;
  }
};

const sanitizeJsonValue = (value: unknown): JsonValue | undefined => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    if (typeof value === 'string') {
      const decoded = tryDecodeHexJson(value);
      if (decoded !== undefined) {
        return sanitizeJsonValue(decoded);
      }
    }
    return value as JsonValue;
  }

  if (Array.isArray(value)) {
    const sanitized = value
      .map((entry) => sanitizeJsonValue(entry))
      .filter((entry): entry is JsonValue => entry !== undefined);
    return sanitized as JsonValue;
  }

  if (isJsonObject(value)) {
    const result: JsonObject = {};
    for (const [key, entry] of Object.entries(value)) {
      const sanitized = sanitizeJsonValue(entry);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    }
    return result as JsonObject;
  }

  return undefined;
};

export const sanitizeMetadataValue = (value: unknown): DRepMetadata | null => {
  if (!isJsonObject(value)) {
    return null;
  }
  const result: JsonObject = {};
  for (const [key, entry] of Object.entries(value)) {
    const sanitized = sanitizeJsonValue(entry);
    if (sanitized !== undefined) {
      result[key] = sanitized;
    }
  }
  return result as DRepMetadata;
};

const CIP_REFERENCE_PATTERN = /^CIP\d+:.*$/i;

const extractStringFromValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || CIP_REFERENCE_PATTERN.test(trimmed)) {
      return undefined;
    }
    return trimmed;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const extracted = extractStringFromValue(entry);
      if (extracted) {
        return extracted;
      }
    }
    return undefined;
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const prioritizedKeys = ['@value', 'value'];

  for (const key of prioritizedKeys) {
    if (key in record) {
      const extracted = extractStringFromValue(record[key]);
      if (extracted) {
        return extracted;
      }
    }
  }

  for (const entry of Object.values(record)) {
    const extracted = extractStringFromValue(entry);
    if (extracted) {
      return extracted;
    }
  }

  return undefined;
};

const findFirstStringValueInternal = (
  value: unknown,
  keys: string[],
  currentKey?: string
): string | undefined => {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findFirstStringValueInternal(entry, keys, currentKey);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (!currentKey || !keys.includes(currentKey)) {
    for (const key of keys) {
      if (key in record && key !== '@context') {
        const extracted = extractStringFromValue(record[key]);
        if (extracted) {
          return extracted;
        }
      }
    }
  }

  for (const [key, entry] of Object.entries(record)) {
    if (key === '@context') {
      continue;
    }
    if (keys.includes(key)) {
      const extracted = extractStringFromValue(entry);
      if (extracted) {
        return extracted;
      }
    } else {
      const found = findFirstStringValueInternal(entry, keys, key);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
};

export const findFirstStringValue = (value: unknown, keys: string[]): string | undefined =>
  findFirstStringValueInternal(value, keys);

export const getMetadataName = (metadata: DRepMetadata | null | undefined) =>
  metadata ? findFirstStringValue(metadata, ['name', 'title', 'givenName']) : undefined;

export const getMetadataDescription = (metadata: DRepMetadata | null | undefined) =>
  metadata ? findFirstStringValue(metadata, ['description', 'abstract', 'summary']) : undefined;

export const getMetadataWebsite = (metadata: DRepMetadata | null | undefined) => {
  if (!metadata) return undefined;
  const url = findFirstStringValue(metadata, ['website', 'url', 'homepage', 'link']);
  return url ? url.trim() : undefined;
};
