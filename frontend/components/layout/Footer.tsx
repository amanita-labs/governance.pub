'use client';

import Link from 'next/link';
import { Github, Heart, MessageCircle } from 'lucide-react';
import { WoolyQuote } from '../ui/WoolyQuote';
import { SheepFlock } from '../animations/SheepFlock';

export default function Footer() {
  return (
    <footer className="relative mt-16 border-t bg-meadow-haze">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/2 h-48 w-[70%] -translate-x-1/2 rounded-full bg-field-green/15 blur-3xl" />
      </div>
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 rounded-full border border-primary/30 bg-background/80 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary backdrop-blur">
              <span aria-hidden="true">✨</span>
              <span>Stay wooly, stay curious</span>
            </div>
            <h2 className="text-3xl font-display font-bold text-foreground">
              Ready to shepherd the next governance epoch?
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
            GovtWool is open-source and forever evolving. Share feedback, contribute PRs, or just
              say hello—our flock is friendly and always up for governance banter.
            </p>
            <div className="flex flex-wrap gap-4 text-sm font-medium">
              <Link
                href="https://github.com/insectslab/govtwool"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-4 py-2 text-foreground shadow-sm transition hover:border-primary/60 hover:text-primary"
              >
                <Github className="h-4 w-4" aria-hidden="true" />
                Contribute on GitHub
              </Link>
              <Link
                href="mailto:team@insects.studio"
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-4 py-2 text-foreground shadow-sm transition hover:border-primary/60 hover:text-primary"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Send feedback
              </Link>
            </div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Heart className="h-4 w-4 text-red-400" aria-hidden="true" />
              Handcrafted for the Cardano Summit LayerUp Hackathon &amp; beyond.
            </p>
          </div>

          <div className="space-y-6">
            <WoolyQuote variant="card" emphasis="subtle" hideIcon />
            <div className="rounded-3xl border border-border/50 bg-background/80 p-6 shadow-lg backdrop-blur">
              <p className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                The Night Watch
              </p>
              <SheepFlock count={4} className="justify-between" />
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-border/60 pt-6 text-xs text-muted-foreground">
          <p>
            © {new Date().getFullYear()} GovtWool. Cardano governance insights powered by open APIs
            and lovingly maintained wool-based puns.
          </p>
        </div>
      </div>
    </footer>
  );
}


