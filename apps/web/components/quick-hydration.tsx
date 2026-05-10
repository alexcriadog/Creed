'use client';

import { useState, useTransition } from 'react';
import { logHydration } from '@/lib/actions/hydration';

const PRESETS = [250, 500];

export function QuickHydration() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function add(amount: number) {
    setError(null);
    startTransition(async () => {
      const result = await logHydration({ amountMl: amount });
      if (!result.ok) setError(result.error ?? 'Error');
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1.5">
        {PRESETS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => add(amount)}
            disabled={isPending}
            aria-busy={isPending || undefined}
            className="btn-feedback flex-1 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-2 py-1 text-[length:var(--text-xs)] font-medium text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
          >
            +{amount}ml
          </button>
        ))}
      </div>
      {error && (
        <p className="text-[length:var(--text-xs)] text-[color:var(--color-status-red)]">{error}</p>
      )}
    </div>
  );
}
