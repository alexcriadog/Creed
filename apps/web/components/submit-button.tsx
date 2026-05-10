'use client';

import { useFormStatus } from 'react-dom';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface SubmitButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'disabled'> {
  variant?: Variant;
  pendingLabel?: ReactNode;
  fullWidth?: boolean;
  size?: 'sm' | 'md';
}

export function SubmitButton({
  variant = 'primary',
  pendingLabel,
  fullWidth = false,
  size = 'md',
  children,
  className = '',
  ...rest
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  const sizeClasses =
    size === 'sm' ? 'px-3 py-1.5 text-[length:var(--text-xs)]' : 'px-5 py-2.5';
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`btn-feedback ${variantClasses(variant)} ${sizeClasses} ${widthClass} ${className}`.trim()}
      style={variantStyle(variant, pending)}
      {...rest}
    >
      <span
        className={`inline-flex items-center justify-center gap-2 ${pending ? 'opacity-90' : ''}`}
      >
        {pending && <Spinner />}
        <span>{pending && pendingLabel ? pendingLabel : children}</span>
      </span>
    </button>
  );
}

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden
      className="animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.2-8.55" />
    </svg>
  );
}

function variantClasses(v: Variant): string {
  switch (v) {
    case 'primary':
      return 'rounded-[var(--radius-md)] font-medium text-[color:var(--color-text-on-accent)]';
    case 'secondary':
      return 'rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] font-medium text-[color:var(--color-text-primary)] bg-[color:var(--color-surface-raised)]';
    case 'ghost':
      return 'rounded-[var(--radius-md)] text-[color:var(--color-text-secondary)] font-medium';
    case 'danger':
      return 'rounded-[var(--radius-md)] border border-[color:var(--color-status-red)] text-[color:var(--color-status-red)] font-medium';
  }
}

function variantStyle(v: Variant, pending: boolean): React.CSSProperties | undefined {
  if (v !== 'primary') return undefined;
  return {
    background:
      'linear-gradient(135deg, oklch(58% 0.21 260), oklch(50% 0.22 260))',
    boxShadow: pending
      ? 'inset 0 1px 0 oklch(100% 0 0 / 0.15), 0 1px 2px oklch(20% 0.05 260 / 0.1)'
      : 'inset 0 1px 0 oklch(100% 0 0 / 0.25), 0 4px 12px oklch(20% 0.05 260 / 0.25)',
  };
}
