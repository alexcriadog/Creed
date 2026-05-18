'use client';

import { useState, useTransition } from 'react';
import { Sheet } from './sheet';
import { Field, PrimaryButton, SecondaryButton, TextInput } from './form-controls';
import { ChipButton } from './chip-button';
import { logHydration } from '@/lib/actions/hydration';

const PRESETS = [250, 500, 750];

export function QuickHydration() {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function add(amount: number) {
    setError(null);
    startTransition(async () => {
      const result = await logHydration({ amountMl: amount });
      if (!result.ok) {
        setError(result.error ?? 'Error');
        return;
      }
      setCustom('');
      setOpen(false);
    });
  }

  function submitCustom() {
    const ml = Number(custom);
    if (!Number.isFinite(ml) || ml <= 0) {
      setError('Cantidad no válida');
      return;
    }
    add(Math.round(ml));
  }

  return (
    <>
      <ChipButton
        icon="💧"
        label="Agua"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      />
      <Sheet open={open} onClose={() => setOpen(false)} title="Registrar hidratación">
        <p className="mb-3 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
          Elige una cantidad o introduce la tuya.
        </p>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {PRESETS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => add(amount)}
              disabled={isPending}
              className="btn-feedback rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-3 text-center font-mono text-[length:var(--text-sm)] font-semibold tabular-nums text-[color:var(--color-text-primary)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] disabled:opacity-50"
            >
              +{amount} ml
            </button>
          ))}
        </div>
        <Field label="Otra cantidad (ml)">
          <TextInput
            type="number"
            inputMode="numeric"
            min={1}
            max={5000}
            placeholder="p. ej. 330"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        </Field>
        {error && (
          <p className="mb-3 text-[length:var(--text-sm)] text-[color:var(--color-status-red)]">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={() => setOpen(false)}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton
            type="button"
            onClick={submitCustom}
            loading={isPending}
            disabled={!custom.trim()}
          >
            Guardar
          </PrimaryButton>
        </div>
      </Sheet>
    </>
  );
}
