'use client';

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';

interface IconSubmitButtonProps {
  ariaLabel: string;
  children: ReactNode;
}

export function IconSubmitButton({ ariaLabel, children }: IconSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      aria-label={ariaLabel}
      aria-busy={pending}
      disabled={pending}
      className="icon-chip btn-feedback"
    >
      {pending ? <SmallSpinner /> : children}
    </button>
  );
}

function SmallSpinner() {
  return (
    <svg
      width="16"
      height="16"
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
