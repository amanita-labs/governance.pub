'use client';

import { SheepAnimation } from './SheepAnimation';
import { motion } from 'framer-motion';

interface SheepFlockProps {
  count?: number;
  className?: string;
}

export function SheepFlock({ count = 5, className = '' }: SheepFlockProps) {
  const sheep = Array.from({ length: count }, (_, i) => i);

  return (
    <div className={`flex items-center justify-center space-x-4 ${className}`}>
      {sheep.map((index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.2, duration: 0.5 }}
        >
          <SheepAnimation size={index % 2 === 0 ? 'md' : 'sm'} />
        </motion.div>
      ))}
    </div>
  );
}

