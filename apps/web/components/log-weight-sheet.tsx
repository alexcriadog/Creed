'use client';

import { useState, useTransition } from 'react';
import { Sheet } from './sheet';
import { Field, TextInput, PrimaryButton, SecondaryButton } from './form-controls';
import { logWeight } from '@/lib/actions/body-measurements';

export function LogWeightButton() {
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setWeight('');
    setBodyFat('');
    setError(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function submit() {
    setError(null);
    const weightNum = parseFloat(weight);
    if (!Number.isFinite(weightNum) || weightNum <= 0) {
      setError('Peso inválido');
      return;
    }
    const bodyFatNum = bodyFat ? parseFloat(bodyFat) : undefined;
    if (bodyFat && (!Number.isFinite(bodyFatNum!) || bodyFatNum! < 0 || bodyFatNum! > 70)) {
      setError('% grasa inválido (0-70)');
      return;
    }
    startTransition(async () => {
      const result = await logWeight({ weightKg: weightNum, bodyFatPct: bodyFatNum });
      if (result.ok) close();
      else setError(result.error ?? 'Error al guardar');
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-1.5 text-[length:var(--text-xs)] font-medium text-[color:var(--color-text-secondary)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
      >
        + Peso
      </button>
      <Sheet open={open} onClose={close} title="Registrar peso">
        <Field label="Peso (kg)">
          <TextInput
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            max="500"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="72.5"
            autoFocus
          />
        </Field>
        <Field label="% grasa corporal" hint="Opcional. Si tienes báscula con bioimpedancia.">
          <TextInput
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            max="70"
            value={bodyFat}
            onChange={(e) => setBodyFat(e.target.value)}
            placeholder="18.0"
          />
        </Field>
        {error && (
          <p className="mb-3 text-[length:var(--text-sm)] text-[color:var(--color-status-red)]">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={close}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton type="button" onClick={submit} disabled={isPending}>
            {isPending ? 'Guardando…' : 'Guardar'}
          </PrimaryButton>
        </div>
      </Sheet>
    </>
  );
}
