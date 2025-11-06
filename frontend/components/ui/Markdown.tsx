'use client';

import React, { type AnchorHTMLAttributes, type ComponentPropsWithoutRef, type MouseEventHandler, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components, ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

type MarkdownCodeProps = ComponentPropsWithoutRef<'code'> & ExtraProps & { inline?: boolean };

const baseComponents: Components = {
  p: ({ className, children, ...props }) => (
    <p
      className={cn('text-sm leading-relaxed', '[&:not(:last-child)]:mb-4', className)}
      {...props}
    >
      {children}
    </p>
  ),
  strong: ({ className, children, ...props }) => (
    <strong className={cn('font-semibold', className)} {...props}>
      {children}
    </strong>
  ),
  em: ({ className, children, ...props }) => (
    <em className={cn('italic', className)} {...props}>
      {children}
    </em>
  ),
  a: ({ className, children, ...props }) => {
    const { onClick, ...rest } = props as AnchorHTMLAttributes<HTMLAnchorElement>;
    const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
      event.stopPropagation();
      onClick?.(event);
    };

    return (
      <a
        className={cn('text-field-green underline underline-offset-2 transition hover:text-field-green/80', className)}
        {...rest}
        onClick={handleClick}
      >
        {children}
      </a>
    );
  },
  ul: ({ className, children, ...props }) => (
    <ul
      className={cn('list-disc pl-6 space-y-2 text-sm leading-relaxed', className)}
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ className, children, ...props }) => (
    <ol
      className={cn('list-decimal pl-6 space-y-2 text-sm leading-relaxed', className)}
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ className, children, ...props }) => (
    <li
      className={cn('text-sm leading-relaxed marker:text-muted-foreground', className)}
      {...props}
    >
      {children}
    </li>
  ),
  blockquote: ({ className, children, ...props }) => (
    <blockquote
      className={cn('border-l-4 border-muted pl-4 italic text-sm leading-relaxed text-muted-foreground', className)}
      {...props}
    >
      {children}
    </blockquote>
  ),
  code: ({ inline, className, children, ...props }: MarkdownCodeProps) => {
    if (inline) {
      return (
        <code className={cn('rounded bg-muted px-1 py-0.5 font-mono text-xs', className)} {...props}>
          {children}
        </code>
      );
    }

    return (
      <code className={cn('font-mono text-xs', className)} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ className, children, ...props }) => (
    <pre className={cn('w-full overflow-x-auto rounded-md bg-muted p-4', className)} {...props}>
      {children}
    </pre>
  ),
  table: ({ className, children, ...props }) => (
    <div className="w-full overflow-x-auto">
      <table
        className={cn(
          'w-full border-collapse text-sm',
          '[&_*]:border [&_*]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2',
          className
        )}
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  hr: () => <hr className="my-6 border-border" />,
};

interface MarkdownProps {
  children?: string | null;
  className?: string;
  components?: Components;
}

export function Markdown({ children, className, components }: MarkdownProps) {
  if (!children) {
    return null;
  }

  const mergedComponents = useMemo(
    () => ({
      ...baseComponents,
      ...(components || {}),
    }),
    [components]
  );

  return (
    <div className={cn('space-y-4', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mergedComponents}>
        {children}
      </ReactMarkdown>
    </div>
  );
}


