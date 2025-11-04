'use client';

import { ReactNode } from 'react';

interface FieldBackgroundProps {
  children: ReactNode;
  className?: string;
}

export function FieldBackground({ children, className = '' }: FieldBackgroundProps) {
  return (
    <div className={`relative min-h-screen ${className}`}>
      {/* Sky gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-light via-sky-blue to-white z-0" />
      
      {/* Hills/Fields */}
      <svg
        className="absolute bottom-0 w-full h-64 z-0"
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
      >
        {/* Far hill */}
        <path
          d="M0,150 Q300,100 600,150 T1200,150 L1200,200 L0,200 Z"
          fill="#7cb342"
          opacity="0.6"
        />
        {/* Near hill */}
        <path
          d="M0,180 Q400,120 800,180 T1200,180 L1200,200 L0,200 Z"
          fill="#aed581"
          opacity="0.8"
        />
        {/* Grass */}
        <path
          d="M0,200 Q400,180 800,200 T1200,200 L1200,200 L0,200 Z"
          fill="#558b2f"
        />
      </svg>
      
      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

