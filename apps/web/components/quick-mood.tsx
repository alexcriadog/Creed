'use client';

import { useState, useTransition } from 'react';
import { logMoodEnergy } from '@/lib/actions/mood-energy';

export function QuickMood({ initialMood, initialEnergy }: { initialMood: number | null; initialEnergy: number | null }) {
  const [mood, setMood] = useState<number | null>(initialMood);
  const [energy, setEnergy] = useState<number | null>(initialEnergy);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update(field: 'mood' | 'energy', value: number) {
    if (field === 'mood') setMood(value);
    else setEnergy(value);
    setError(null);
    startTransition(async () => {
      const result = await logMoodEnergy({
        mood: field === 'mood' ? value : (mood ?? undefined),
        energy: field === 'energy' ? value : (energy ?? undefined),
      });
      if (!result.ok) setError(result.error ?? 'Error');
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Row label="Mood" current={mood} onPick={(v) => update('mood', v)} disabled={isPending} />
      <Row label="Energía" current={energy} onPick={(v) => update('energy', v)} disabled={isPending} />
      {error && (
        <p className="text-[length:var(--text-xs)] text-[color:var(--color-status-red)]">{error}</p>
      )}
    </div>
  );
}

function Row({
  label,
  current,
  onPick,
  disabled,
}: {
  label: string;
  current: number | null;
  onPick: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-12 text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
        {label}
      </span>
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4, 5].map((v) => {
          const active = current === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onPick(v)}
              disabled={disabled}
              aria-label={`${label} ${v}`}
              aria-pressed={active}
              className={`btn-feedback flex-1 rounded-[var(--radius-sm)] border px-1 py-0.5 font-mono text-[length:var(--text-xs)] tabular-nums ${
                active
                  ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-[color:var(--color-text-on-accent)]'
                  : 'border-[color:var(--color-border-default)] text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-accent)]'
              }`}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}
