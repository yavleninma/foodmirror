import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  children: ReactNode;
}

const variants = {
  primary:
    'bg-gradient-to-br from-[var(--color-primary)] to-[#FF8C5A] text-white shadow-md hover:opacity-90 active:scale-[0.98] disabled:opacity-50',
  secondary:
    'border border-[var(--color-primary)] text-[var(--color-primary)] bg-transparent hover:bg-[var(--color-bg-secondary)] active:scale-[0.98] disabled:opacity-50',
  ghost:
    'text-[var(--color-primary)] bg-transparent hover:opacity-70 p-0',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-xl',
  md: 'px-5 py-3.5 text-base rounded-2xl',
  lg: 'px-6 py-4 text-lg rounded-2xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  pulse = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`font-semibold cursor-pointer transition-all disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${pulse ? 'animate-pulse-ring' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
