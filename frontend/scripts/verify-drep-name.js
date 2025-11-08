/* eslint-env node */
/* global require, console */
const { execSync } = require('child_process');

const GOVTOOL_URL = 'https://be.gov.tools/drep/list?page=0&pageSize=1&sort=Activity';

const fetchGovToolJson = () => {
  const raw = execSync(`curl -s '${GOVTOOL_URL}'`, { encoding: 'utf8' });
  return JSON.parse(raw);
};

const isJsonObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizeJsonValue = (value) => {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    const sanitized = value
      .map((entry) => sanitizeJsonValue(entry))
      .filter((entry) => entry !== undefined);
    return sanitized;
  }

  if (isJsonObject(value)) {
    const result = {};
    for (const [key, entry] of Object.entries(value)) {
      const sanitized = sanitizeJsonValue(entry);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    }
    return result;
  }

  return undefined;
};

const sanitizeMetadataValue = (value) => {
  if (!isJsonObject(value)) {
    return null;
  }
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    const sanitized = sanitizeJsonValue(entry);
    if (sanitized !== undefined) {
      result[key] = sanitized;
    }
  }
  return result;
};

const findFirstStringValue = (value, keys) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findFirstStringValue(entry, keys);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  if (!isJsonObject(value)) {
    return undefined;
  }

  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  for (const entry of Object.values(value)) {
    const found = findFirstStringValue(entry, keys);
    if (found) {
      return found;
    }
  }

  return undefined;
};

const getMetadataName = (metadata) => (metadata ? findFirstStringValue(metadata, ['name', 'title', 'givenName']) : undefined);

(async () => {
  const payload = fetchGovToolJson();
  const element = payload.elements?.[0];
  if (!element) {
    throw new Error('No DRep returned from GovTool sample fetch');
  }

  const backendStyleMetadata = { extra: { name: element.givenName, objectives: element.objectives } };
  const sanitized = sanitizeMetadataValue(backendStyleMetadata);
  const derivedName = getMetadataName(sanitized);

  console.log('GovTool givenName field:', element.givenName);
  console.log('Sanitized metadata object:', sanitized);
  console.log('Derived name from metadata helpers:', derivedName);
})();
