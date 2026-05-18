'use client';

import { useState, useTransition } from 'react';
import { updateSet, deleteSet } from '@/lib/actions/training';
import type { PlanSetRow } from '@/lib/plan/week-data';

interface SetRowProps {
  set: PlanSetRow;
}

export function SetRow({ set }: SetRowProps) {
  const [reps, setReps] = useState<string>(set.reps?.toString() ?? '');
  const [weight, setWeight] = useState<string>(set.weight_kg?.toString() ?? '');
  const [rpe, setRpe] = useState<string>(set.rpe?.toString() ?? '');
  const [isPending, startTransition] = useTransition();
  const [savedTick, setSavedTick] = useState(false);

  function save(field: 'reps' | 'weightKg' | 'rpe', value: string) {
    const num = value.trim() === '' ? null : Number(value);
    if (num !== null && Number.isNaN(num)) return;
    startTransition(async () => {
      const patch: Parameters<typeof updateSet>[0] = { setId: set.id };
      if (field === 'reps') patch.reps = num;
      else if (field === 'weightKg') patch.weightKg = num;
      else patch.rpe = num;
      const result = await updateSet(patch);
      if (result.ok) {
        setSavedTick(true);
        setTimeout(() => setSavedTick(false), 1200);
      }
    });
  }

  function remove() {
    if (!confirm('¿Borrar este set?')) return;
    startTransition(async () => {
      await deleteSet(set.id);
    });
  }

  return (
    <div className="flex items-center gap-2 border-b border-[color:var(--color-border-subtle)] py-2 last:border-0">
      <span
        className="w-6 shrink-0 font-mono text-[length:var(--text-xs)] tabular-nums text-[color:var(--color-text-muted)]"
        aria-label="Número de set"
      >
        {set.set_number}
      </span>
      <NumInput
        value={weight}
        onChange={setWeight}
        onBlur={() => save('weightKg', weight)}
        suffix="kg"
        ariaLabel="Peso en kg"
        wide
      />
      <span className="text-[color:var(--color-text-muted)]">×</span>
      <NumInput
        value={reps}
        onChange={setReps}
        onBlur={() => save('reps', reps)}
        ariaLabel="Repeticiones"
      />
      <span className="ml-2 text-[10px] text-[color:var(--color-text-muted)]">RPE</span>
      <NumInput
        value={rpe}
        onChange={setRpe}
        onBlur={() => save('rpe', rpe)}
        ariaLabel="RPE"
        max={10}
      />
      {set.is_warmup && (
        <span className="rounded bg-[color:var(--color-status-amber)]/15 px-1.5 py-0.5 text-[10px] text-[color:var(--color-status-amber)]">
          warmup
        </span>
      )}
      <span className="ml-auto flex w-6 items-center justify-center">
        {savedTick && <span className="text-[color:var(--color-status-green)]">✓</span>}
        {isPending && !savedTick && <span className="text-[color:var(--color-text-muted)]">…</span>}
      </span>
      <button
        type="button"
        onClick={remove}
        aria-label="Borrar set"
        className="tap-feedback rounded p-1 text-[color:var(--color-text-muted)] hover:text-[color:var(--color-status-red)]"
      >
        ✕
      </button>
    </div>
  );
}

interface NumInputProps {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  ariaLabel: string;
  suffix?: string;
  max?: number;
  wide?: boolean;
}

function NumInput({ value, onChange, onBlur, ariaLabel, suffix, max, wide }: NumInputProps) {
  return (
    <span className="inline-flex items-center">
      <input
        type="number"
        inputMode="decimal"
        step="0.5"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-label={ariaLabel}
        className={
          'rounded-[var(--radius-sm)] border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)] px-1.5 py-1 text-center font-mono text-[length:var(--text-sm)] tabular-nums outline-none focus:border-[color:var(--color-accent)] ' +
          (wide ? 'w-14' : 'w-12')
        }
      />
      {suffix && (
        <span className="ml-1 text-[10px] text-[color:var(--color-text-muted)]">{suffix}</span>
      )}
    </span>
  );
}
