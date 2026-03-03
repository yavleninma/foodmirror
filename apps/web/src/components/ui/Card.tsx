import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-[var(--color-bg-card)] rounded-2xl p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
