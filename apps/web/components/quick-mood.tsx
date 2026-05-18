'use client';

import { useState, useTransition } from 'react';
import { Sheet } from './sheet';
import { ChipButton } from './chip-button';
import { PrimaryButton, SecondaryButton } from './form-controls';
import { logMoodEnergy } from '@/lib/actions/mood-energy';

export function QuickMood({
  initialMood,
  initialEnergy,
}: {
  initialMood: number | null;
  initialEnergy: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<number | null>(initialMood);
  const [energy, setEnergy] = useState<number | null>(initialEnergy);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (mood === null && energy === null) {
      setError('Selecciona al menos uno');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await logMoodEnergy({
        mood: mood ?? undefined,
        energy: energy ?? undefined,
      });
      if (!result.ok) {
        setError(result.error ?? 'Error');
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <ChipButton
        icon="😊"
        label="Mood"
        onClick={() => {
          setError(null);
          setMood(initialMood);
          setEnergy(initialEnergy);
          setOpen(true);
        }}
      />
      <Sheet open={open} onClose={() => setOpen(false)} title="¿Cómo estás hoy?">
        <Scale label="Ánimo" current={mood} onPick={setMood} />
        <Scale label="Energía" current={energy} onPick={setEnergy} />
        {error && (
          <p className="mb-3 text-[length:var(--text-sm)] text-[color:var(--color-status-red)]">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={() => setOpen(false)}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton type="button" onClick={save} loading={isPending}>
            Guardar
          </PrimaryButton>
        </div>
      </Sheet>
    </>
  );
}

function Scale({
  label,
  current,
  onPick,
}: {
  label: string;
  current: number | null;
  onPick: (v: number) => void;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-secondary)]">
          {label}
        </span>
        <span className="font-mono text-[length:var(--text-xs)] tabular-nums text-[color:var(--color-text-muted)]">
          {current ?? '–'} / 5
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((v) => {
          const active = current === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onPick(v)}
              aria-label={`${label} ${v}`}
              aria-pressed={active}
              className={
                'btn-feedback rounded-[var(--radius-md)] border px-2 py-2 font-mono text-[length:var(--text-sm)] tabular-nums transition ' +
                (active
                  ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-[color:var(--color-text-on-accent)]'
                  : 'border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-accent)]')
              }
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}
