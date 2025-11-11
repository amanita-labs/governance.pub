'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { cn } from '@/lib/utils';
import { buildMemeUrl, blankMemeUrl, type MemeTemplate } from '@/lib/utils/memegen';
import { Download, ExternalLink, Shuffle, Sparkles } from 'lucide-react';

const FALLBACK_TEMPLATES: MemeTemplate[] = [
  { id: 'buzz', name: 'Buzz Lightyear' },
  { id: 'aag', name: 'American Chopper Argument' },
  { id: 'fry', name: 'Futurama Fry' },
  { id: 'disastergirl', name: 'Disaster Girl' },
  { id: 'success', name: 'Success Kid' },
  { id: 'drake', name: 'Drake Hotline Bling' },
  { id: 'gru', name: 'Gru Plan' },
  { id: 'morpheus', name: 'Morpheus' },
];

type MemeGeneratorProps = {
  defaultTopText: string;
  defaultBottomText: string;
  contextLabel?: string;
  className?: string;
  captionOptions?: Array<{ top: string; bottom: string }>;
};

type RemoteTemplate = {
  id: string;
  name?: string;
  blank?: string;
  example?: string;
};

const normaliseTemplate = (template: RemoteTemplate): MemeTemplate => ({
  id: template.id,
  name: template.name ?? template.id.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
  blank: template.blank,
  example: template.example,
});

export function MemeGenerator({
  defaultTopText,
  defaultBottomText,
  contextLabel,
  className,
  captionOptions,
}: MemeGeneratorProps) {
  const [templates, setTemplates] = useState<MemeTemplate[]>(FALLBACK_TEMPLATES);
  const getRandomTemplateId = (list: MemeTemplate[]) =>
    list[Math.floor(Math.random() * list.length)]?.id ?? FALLBACK_TEMPLATES[0].id;
  const initialTemplate = useMemo(() => getRandomTemplateId(FALLBACK_TEMPLATES), []);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(initialTemplate);

  const chooseCaptionPair = () => {
    if (captionOptions && captionOptions.length > 0) {
      const randomPair = captionOptions[Math.floor(Math.random() * captionOptions.length)];
      return {
        top: randomPair.top || defaultTopText,
        bottom: randomPair.bottom || defaultBottomText,
      };
    }
    return { top: defaultTopText, bottom: defaultBottomText };
  };

  const initialCaptions = useMemo(() => chooseCaptionPair(), [defaultTopText, defaultBottomText, captionOptions]);

  const [topText, setTopText] = useState(initialCaptions.top);
  const [bottomText, setBottomText] = useState(initialCaptions.bottom);
  const [isFetchingTemplates, setIsFetchingTemplates] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;

    async function fetchTemplates() {
      setIsFetchingTemplates(true);
      try {
        const response = await fetch('https://api.memegen.link/templates/', {
          cache: 'force-cache',
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch templates: ${response.status}`);
        }
        const payload: RemoteTemplate[] = await response.json();
        if (cancelled || !Array.isArray(payload) || payload.length === 0) {
          return;
        }

        const normalised = payload
          .map(normaliseTemplate)
          .filter((template) => template.id && !template.id.startsWith('_') && template.id !== 'custom');

        const seen = new Set<string>();
        const uniqueTemplates: MemeTemplate[] = [];

        for (const template of normalised) {
          if (seen.has(template.id)) {
            continue;
          }
          seen.add(template.id);
          uniqueTemplates.push(template);
        }

        if (uniqueTemplates.length > 0 && !cancelled) {
          setTemplates(uniqueTemplates);
          setSelectedTemplate((previous) => {
            if (uniqueTemplates.some((template) => template.id === previous)) {
              return previous;
            }
            return getRandomTemplateId(uniqueTemplates);
          });
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError' && !cancelled) {
          console.error('[MemeGenerator] template fetch failed', error);
        }
      } finally {
        if (!cancelled) {
          setIsFetchingTemplates(false);
        }
      }
    }

    fetchTemplates();

    return () => {
      cancelled = true;
    };
  }, []);

  const memePreviewUrl = useMemo(
    () =>
      buildMemeUrl({
        templateId: selectedTemplate,
        topText,
        bottomText,
        font: undefined,
        layout: 'default',
        width: 600,
      }),
    [selectedTemplate, topText, bottomText]
  );

  const shuffleEverything = () => {
    const nextTemplate = getRandomTemplateId(templates);
    setSelectedTemplate(nextTemplate);
    const { top, bottom } = chooseCaptionPair();
    setTopText(top);
    setBottomText(bottom);
  };

  useEffect(() => {
    const { top, bottom } = chooseCaptionPair();
    setTopText(top);
    setBottomText(bottom);
  }, [defaultTopText, defaultBottomText, captionOptions]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(memePreviewUrl);
      setCopyState('success');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (error) {
      console.error('[MemeGenerator] copy failed', error);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = memePreviewUrl;
    const filename = `govtwool-meme-${selectedTemplate}.png`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    window.open(memePreviewUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className={cn('wooly-card overflow-hidden max-w-xl border-border/60', className)}>
      <CardHeader className="border-b border-border/60 bg-muted/20 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            <span>Meme Forge</span>
          </div>
          <Button type="button" size="sm" variant="outline" className="gap-1 text-xs" onClick={shuffleEverything}>
            <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
            Shuffle
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Auto-generated captions for {contextLabel ?? 'this view'}. Hit shuffle for new combos, then copy or download.
        </p>
      </CardHeader>

      <CardContent className="space-y-5 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3 rounded-lg border border-border/50 bg-background/60 p-3 text-xs text-muted-foreground sm:w-1/2">
            <div className="flex items-center justify-between gap-2">
              <span>Template</span>
              <Badge variant="outline" className="text-[11px] capitalize">
                {templates.find((template) => template.id === selectedTemplate)?.name ?? selectedTemplate}
              </Badge>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground/80">Top text</p>
              <p className="font-medium text-foreground">{topText}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground/80">Bottom text</p>
              <p className="font-medium text-foreground">{bottomText}</p>
            </div>
            {isFetchingTemplates && <p className="text-[11px] text-muted-foreground/70">Refreshing templates…</p>}
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-1/2">
            <div className="relative h-48 w-full overflow-hidden rounded-lg border border-border/70 bg-muted">
              <Image
                src={memePreviewUrl}
                alt="Meme preview"
                fill
                sizes="240px"
                className="object-contain"
                unoptimized
              />
              <Badge variant="wooly" className="absolute left-2 top-2 text-[10px]">
                Live Preview
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" className="gap-2" onClick={handleCopyUrl} aria-live="polite">
                {copyState === 'success' ? 'Copied!' : copyState === 'error' ? 'Copy failed' : 'Copy URL'}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={handleOpenInNewTab} className="gap-2">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Open
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={handleDownload} className="gap-2">
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Save
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-[11px] text-muted-foreground">
          <p>
            Powered by{' '}
            <a
              href="https://memegen.link/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              memegen.link
            </a>
            . Share the generated URL anywhere—no upload step required.
          </p>
          <p className="mt-1">
            Template preview:{' '}
            <a
              href={blankMemeUrl(selectedTemplate)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {selectedTemplate}
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default MemeGenerator;


