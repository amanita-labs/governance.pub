'use client';

import * as React from 'react';

interface SheepIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  title?: string;
}

export function SheepIcon({ size = 40, title, className, ...rest }: SheepIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <ellipse cx="50" cy="60" rx="35" ry="25" fill="#f5f5dc" stroke="#7cb342" strokeWidth="2" />
      <circle cx="40" cy="55" r="8" fill="#ffffff" opacity="0.7" />
      <circle cx="50" cy="50" r="8" fill="#ffffff" opacity="0.7" />
      <circle cx="60" cy="55" r="8" fill="#ffffff" opacity="0.7" />
      <circle cx="45" cy="65" r="7" fill="#ffffff" opacity="0.7" />
      <circle cx="55" cy="65" r="7" fill="#ffffff" opacity="0.7" />
      <circle cx="50" cy="35" r="18" fill="#f5f5dc" stroke="#7cb342" strokeWidth="2" />
      <circle cx="45" cy="32" r="3" fill="#333333" />
      <circle cx="55" cy="32" r="3" fill="#333333" />
      <ellipse cx="50" cy="40" rx="4" ry="2" fill="#333333" />
      <rect x="35" y="80" width="6" height="15" fill="#f5f5dc" />
      <rect x="45" y="80" width="6" height="15" fill="#f5f5dc" />
      <rect x="55" y="80" width="6" height="15" fill="#f5f5dc" />
      <rect x="65" y="80" width="6" height="15" fill="#f5f5dc" />
    </svg>
  );
}
