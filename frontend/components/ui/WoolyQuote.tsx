'use client';

import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WoolyQuote } from '@/lib/constants/wooly-quotes';
import { getRandomWoolyQuote } from '@/lib/constants/wooly-quotes';
import { SheepIcon } from './SheepIcon';

type WoolyQuoteVariant = 'card' | 'inline' | 'banner';

interface WoolyQuoteProps {
  quote?: WoolyQuote;
  seed?: number;
  variant?: WoolyQuoteVariant;
  className?: string;
  hideIcon?: boolean;
  emphasis?: 'subtle' | 'bold';
}

const variantStyles: Record<WoolyQuoteVariant, string> = {
  card: 'rounded-2xl border border-border/60 bg-card/80 p-6 shadow-md wooly-card',
  inline: 'rounded-lg bg-muted/70 px-4 py-3 border border-border/50',
  banner:
    'rounded-3xl border border-primary/40 bg-wool-gradient px-6 py-5 shadow-lg ring-1 ring-primary/20 backdrop-blur',
};

export function WoolyQuote({
  quote,
  seed,
  variant = 'card',
  className,
  hideIcon = false,
  emphasis = 'subtle',
}: WoolyQuoteProps) {
  const chosenQuote = useMemo(() => {
    if (quote) {
      return quote;
    }
    return getRandomWoolyQuote(seed);
  }, [quote, seed]);

  return (
    <figure
      className={cn(
        'relative overflow-hidden transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        variantStyles[variant],
        emphasis === 'bold' ? 'text-lg leading-relaxed' : 'text-base',
        className
      )}
      tabIndex={0}
      aria-label="Wooly quote"
    >
      {!hideIcon && (
        <div className="absolute -top-5 -left-6 h-20 w-20 opacity-60">
          <SheepIcon className="h-full w-full drop-shadow-md" />
        </div>
      )}
      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs uppercase tracking-widest font-semibold">
            Whispers from the Wooliverse
          </span>
        </div>
        <blockquote className="text-foreground">
          <p className="font-semibold">
            “{chosenQuote.text}”
          </p>
        </blockquote>
        {(chosenQuote.author || chosenQuote.context) && (
          <figcaption className="text-sm text-muted-foreground">
            {chosenQuote.author && <span className="font-medium">{chosenQuote.author}</span>}
            {chosenQuote.author && chosenQuote.context && <span aria-hidden="true"> • </span>}
            {chosenQuote.context && <span>{chosenQuote.context}</span>}
          </figcaption>
        )}
      </div>
    </figure>
  );
}


