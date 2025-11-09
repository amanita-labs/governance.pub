import type { GovernanceAction } from '@/types/governance';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const extractString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }

  if (isRecord(value)) {
    const candidates: Array<unknown> = [
      value.content,
      value.text,
      value.value,
      value.description,
      value.label,
      value.title,
      value.abstract,
      value.rationale,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        return candidate;
      }
    }
  }

  return undefined;
};

const getParsedMetaJson = (action: GovernanceAction): Record<string, unknown> | null => {
  if (!action.meta_json) {
    return null;
  }

  try {
    const parsed =
      typeof action.meta_json === 'string'
        ? (JSON.parse(action.meta_json) as unknown)
        : action.meta_json;

    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export function getActionTitle(action: GovernanceAction): string {
  const parsedMeta = getParsedMetaJson(action);

  if (parsedMeta) {
    const body = isRecord(parsedMeta.body) ? parsedMeta.body : undefined;

    const bodyTitle = extractString(body?.title);
    if (bodyTitle) return bodyTitle;

    const bodyAbstract = extractString(body?.abstract);
    if (bodyAbstract) return bodyAbstract;

    const title = extractString(parsedMeta.title);
    if (title) return title;
  }

  if (action.metadata) {
    const metaTitle = extractString(action.metadata.title);
    if (metaTitle) return metaTitle;

    const metaAbstract = extractString(action.metadata.abstract);
    if (metaAbstract) return metaAbstract;
  }

  const description = extractString(action.description);
  if (description) {
    return description;
  }

  return `Action ${action.action_id.slice(0, 8)}`;
}

export function getActionDescription(action: GovernanceAction): string | undefined {
  const parsedMeta = getParsedMetaJson(action);

  if (parsedMeta) {
    const body = isRecord(parsedMeta.body) ? parsedMeta.body : undefined;

    const bodyDescription = extractString(body?.description);
    if (bodyDescription) return bodyDescription;

    const bodyRationale = extractString(body?.rationale);
    if (bodyRationale) return bodyRationale;

    const description = extractString(parsedMeta.description);
    if (description) return description;
  }

  if (action.metadata) {
    const abstract = extractString(action.metadata.abstract);
    if (abstract) return abstract;

    const description = extractString(action.metadata.description);
    if (description) return description;

    const rationale = extractString(action.metadata.rationale);
    if (rationale) return rationale;
  }

  return extractString(action.description);
}

export function isBudgetAction(action: GovernanceAction): boolean {
  if (action.type !== 'info') {
    return false;
  }

  const title = getActionTitle(action);
  return /\bbudget\b/i.test(title);
}

export function getActionDisplayType(
  action: GovernanceAction
): GovernanceAction['type'] | 'budget' {
  return isBudgetAction(action) ? 'budget' : action.type;
}

export function getActionSearchText(action: GovernanceAction): string {
  const parts = [
    getActionTitle(action),
    getActionDescription(action) ?? '',
    typeof action.meta_comment === 'string' ? action.meta_comment : '',
    action.description && typeof action.description === 'string' ? action.description : '',
    action.action_id,
  ];

  return parts.join(' ').toLowerCase();
}


