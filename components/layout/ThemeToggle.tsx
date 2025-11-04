'use client';

import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { Button } from '../ui/Button';

export function ThemeToggle() {
  const { theme, setTheme, actualTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

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
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="w-9 h-9 px-0"
      aria-label="Toggle theme"
    >
      {iconToShow === 'sun' ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </Button>
  );
}

