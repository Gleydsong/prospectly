import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

const EASE = [0.16, 1, 0.3, 1] as const;

interface DashboardWaveProps {
  delay?: number;
  className?: string;
  children: ReactNode;
}

/** Entrada em ondas (estilo command-center do frame de referência). */
export function DashboardWave({ delay = 0, className, children }: DashboardWaveProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={cn('h-full min-w-0', className)}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: reduce ? 0 : delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
