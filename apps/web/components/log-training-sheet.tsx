'use client';

import { useState, useTransition } from 'react';
import { Sheet } from './sheet';
import { Field, TextInput, Select, PrimaryButton, SecondaryButton } from './form-controls';
import { createSession } from '@/lib/actions/training';

const SESSION_TYPES = [
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'legs', label: 'Legs' },
  { value: 'full', label: 'Full body' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'rest', label: 'Descanso activo' },
  { value: 'other', label: 'Otro' },
] as const;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function LogTrainingButton() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [type, setType] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setDate(todayIso());
    setType('');
    setNotes('');
    setError(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createSession({
        scheduledFor: date,
        type: type || undefined,
        notes: notes || undefined,
      });
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
        + Sesión
      </button>
      <Sheet open={open} onClose={close} title="Nueva sesión de entreno">
        <Field label="Fecha">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Tipo">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Sin clasificar</option>
            {SESSION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notas" hint="Opcional. Pega series y reps si tienes ahora, o márcala como hecha luego.">
          <TextInput
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="P. ej.: sentadilla 5x5 @80kg, prensa 4x10"
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
            {isPending ? 'Guardando…' : 'Crear sesión'}
          </PrimaryButton>
        </div>
      </Sheet>
    </>
  );
}
