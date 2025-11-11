export interface MemeTemplate {
  id: string;
  name?: string;
  blank?: string;
  example?: string;
}

export interface BuildMemeUrlOptions {
  templateId: string;
  topText?: string;
  bottomText?: string;
  fileType?: 'png' | 'jpg' | 'gif' | 'webp';
  layout?: 'default' | 'top';
  font?: string;
  width?: number;
  height?: number;
  extraQuery?: Record<string, string | number | undefined>;
}

const encodeSegment = (value?: string): string => {
  if (!value || value.trim().length === 0) {
    return '_';
  }

  let encoded = value.trim();

  encoded = encoded.replace(/~/g, '~t');
  encoded = encoded.replace(/_/g, '__');
  encoded = encoded.replace(/-/g, '--');
  encoded = encoded.replace(/\n/g, '~n');
  encoded = encoded.replace(/\s+/g, '_');
  encoded = encoded.replace(/\?/g, '~q');
  encoded = encoded.replace(/&/g, '~a');
  encoded = encoded.replace(/%/g, '~p');
  encoded = encoded.replace(/#/g, '~h');
  encoded = encoded.replace(/\//g, '~s');
  encoded = encoded.replace(/\\/g, '~b');
  encoded = encoded.replace(/</g, '~l');
  encoded = encoded.replace(/>/g, '~g');
  encoded = encoded.replace(/"/g, "''");
  encoded = encoded.replace(/:/g, '~c');
  encoded = encoded.replace(/;/g, '~e');
  encoded = encoded.replace(/!/g, '~x');

  return encoded;
};

export const buildMemeUrl = ({
  templateId,
  topText,
  bottomText,
  fileType = 'png',
  layout,
  font,
  width,
  height,
  extraQuery = {},
}: BuildMemeUrlOptions): string => {
  const safeTemplate = templateId || 'custom';
  const safeTop = encodeSegment(topText);
  const safeBottom = encodeSegment(bottomText);

  const params = new URLSearchParams();

  if (font) {
    params.set('font', font);
  }
  if (layout && layout !== 'default') {
    params.set('layout', layout);
  }
  if (width) {
    params.set('width', String(Math.max(1, Math.min(width, 1200))));
  }
  if (height) {
    params.set('height', String(Math.max(1, Math.min(height, 1200))));
  }

  Object.entries(extraQuery).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    params.set(key, String(value));
  });

  const query = params.toString();

  const base = `https://api.memegen.link/images/${safeTemplate}/${safeTop}/${safeBottom}.${fileType}`;
  return query ? `${base}?${query}` : base;
};

export const blankMemeUrl = (templateId: string): string =>
  `https://api.memegen.link/images/${templateId}.png`;

export const sanitizeMemeCaption = (value: string): string =>
  value
    .replace(/₳/g, 'ADA')
    .replace(/[•·]/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\u0000-\u007E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();


