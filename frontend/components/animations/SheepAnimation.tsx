'use client';

import { motion } from 'framer-motion';

interface SheepAnimationProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SheepAnimation({ className = '', size = 'md' }: SheepAnimationProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  return (
    <motion.div
      className={`${sizeClasses[size]} ${className}`}
      animate={{
        y: [0, -10, 0],
        rotate: [0, 5, -5, 0],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Sheep body */}
        <ellipse cx="50" cy="60" rx="35" ry="25" fill="#f5f5dc" stroke="#ddd" strokeWidth="2" />
        
        {/* Wool texture */}
        <circle cx="40" cy="55" r="8" fill="#ffffff" opacity="0.7" />
        <circle cx="50" cy="50" r="8" fill="#ffffff" opacity="0.7" />
        <circle cx="60" cy="55" r="8" fill="#ffffff" opacity="0.7" />
        <circle cx="45" cy="65" r="7" fill="#ffffff" opacity="0.7" />
        <circle cx="55" cy="65" r="7" fill="#ffffff" opacity="0.7" />
        
        {/* Head */}
        <circle cx="50" cy="35" r="18" fill="#f5f5dc" stroke="#ddd" strokeWidth="2" />
        
        {/* Face */}
        <circle cx="45" cy="32" r="3" fill="#333" />
        <circle cx="55" cy="32" r="3" fill="#333" />
        <ellipse cx="50" cy="40" rx="4" ry="2" fill="#333" />
        
        {/* Legs */}
        <rect x="35" y="80" width="6" height="15" fill="#f5f5dc" />
        <rect x="45" y="80" width="6" height="15" fill="#f5f5dc" />
        <rect x="55" y="80" width="6" height="15" fill="#f5f5dc" />
        <rect x="65" y="80" width="6" height="15" fill="#f5f5dc" />
      </svg>
    </motion.div>
  );
}

