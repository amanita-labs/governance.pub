'use client';

import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { Button } from '../ui/Button';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme, actualTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [pressed, setPressed] = useState(false);

  // Only render the icon after hydration to avoid mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    if (theme === 'system') {
      setTheme(actualTheme === 'dark' ? 'light' : 'dark');
    } else {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    }
  };

  // During SSR and initial hydration, always render Sun icon
  // This ensures server and client render the same HTML
  // After hydration (mounted), we'll show the correct icon based on actualTheme
  const iconToShow = !mounted ? 'sun' : (actualTheme === 'dark' ? 'sun' : 'moon');

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={toggleTheme}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      className={cn(
        'h-10 gap-2 rounded-full border border-border/60 bg-background/80 px-3 text-sm font-semibold text-foreground transition-all',
        pressed ? 'scale-95' : 'hover:border-primary/50 hover:text-primary'
      )}
      aria-label="Toggle theme"
    >
      {iconToShow === 'sun' ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
      <span className="hidden md:inline text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {iconToShow === 'sun' ? 'Dawn Mode' : 'Dusk Mode'}
      </span>
    </Button>
  );
}

