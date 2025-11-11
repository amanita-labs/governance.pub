'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletConnect } from './WalletConnect';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '../ui/Button';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SheepIcon } from '../ui/SheepIcon';
import { EmojiBadge } from '../ui/Badge';

export default function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Home', icon: '🏠', description: 'Return to the meadow' },
    { href: '/dreps', label: 'DReps', icon: '👥', description: 'Meet the flock' },
    { href: '/actions', label: 'Actions', icon: '📋', description: 'Track proposals' },
    { href: '/governance', label: 'Interact', icon: '⚖️', description: 'Learn the rules' },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-[0_10px_30px_-25px_rgba(34,197,94,0.45)]">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="group flex items-center gap-3 rounded-full border border-border/80 bg-background/70 px-3 py-1.5 transition hover:border-primary/60 hover:bg-background/90"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-field-green/15 shadow-inner transition group-hover:scale-105">
              <SheepIcon size={28} className="opacity-90" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-lg font-semibold text-foreground leading-tight">
                GovtWool
              </span>
              <span className="text-xs text-muted-foreground leading-tight">
                Wool-powered governance
              </span>
            </div>
          </Link>
          
          <div className="flex items-center gap-6">
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                    pathname === link.href
                      ? "bg-field-green/20 text-field-dark dark:text-field-light shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <span aria-hidden="true" className="text-lg">
                    {link.icon}
                  </span>
                  {link.label}
                  <span className="sr-only">{link.description}</span>
                </Link>
              ))}
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-3">
              <ThemeToggle />
              <WalletConnect />
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t">
            <div className="px-2 pt-2 pb-3 space-y-3">
              <div className="rounded-xl border border-border/70 bg-background/80 p-3 text-sm text-muted-foreground shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-field-green/15 flex items-center justify-center">
                    <SheepIcon size={32} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Welcome to the meadow</p>
                    <p className="text-xs">
                      Browse, delegate, or register—a wool-lined workflow for every role.
                    </p>
                  </div>
                </div>
              </div>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname === link.href
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              ))}
              <EmojiBadge emoji="🌤" className="mx-1 w-fit">
                Next epoch outlook: optimistic
              </EmojiBadge>
              <div className="flex items-center gap-2 pt-2 border-t">
                <ThemeToggle />
                <div className="flex-1">
                  <WalletConnect />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

