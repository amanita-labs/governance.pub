import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        success:
          'border-transparent bg-green-500/10 text-green-700 dark:text-green-400 dark:bg-green-500/20',
        warning:
          'border-transparent bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 dark:bg-yellow-500/20',
        error:
          'border-transparent bg-red-500/10 text-red-700 dark:text-red-400 dark:bg-red-500/20',
        info:
          'border-transparent bg-blue-500/10 text-blue-700 dark:text-blue-400 dark:bg-blue-500/20',
        wooly:
          'border-transparent bg-wool-gradient text-foreground shadow-sm shadow-field-green/10 dark:text-foreground/90',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

interface EmojiBadgeProps extends BadgeProps {
  emoji: string;
  srLabel?: string;
}

function EmojiBadge({ emoji, srLabel, children, className, variant = 'wooly', ...props }: EmojiBadgeProps) {
  return (
    <Badge
      className={cn('gap-2 px-3 py-1 text-xs', className)}
      variant={variant}
      {...props}
    >
      <span aria-hidden="true" className="text-base leading-none">
        {emoji}
      </span>
      <span>{children}</span>
      {srLabel ? <span className="sr-only">{srLabel}</span> : null}
    </Badge>
  );
}

export { Badge, badgeVariants, EmojiBadge };

