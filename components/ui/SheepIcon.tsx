'use client';

import * as React from 'react';

interface SheepIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  title?: string;
}

export function SheepIcon({ size = 40, className, priority = false }: SheepIconProps) {
  return (
    <Image
      src="/icon.svg"
      alt="Playful sheep icon"
      width={size}
      height={size}
      priority={priority}
      className={cn('drop-shadow-sm', className)}
    />
  );
}


