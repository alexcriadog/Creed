'use client';

import { useState, useTransition } from 'react';
import { Sheet } from './sheet';
import { Field, TextArea, PrimaryButton, SecondaryButton } from './form-controls';
import { updateSessionNotes } from '@/lib/actions/training';

interface Props {
  sessionId: string;
  initialNotes: string;
  label?: string;
}

export function EditSessionNotesButton({ sessionId, initialNotes, label = 'Notas' }: Props) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateSessionNotes(sessionId, notes);
      if (result.ok) close();
      else setError(result.error ?? 'Error al guardar');
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-base)] px-2 py-1 text-[length:var(--text-xs)] text-[color:var(--color-text-secondary)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
      >
        {label}
      </button>
      <Sheet open={open} onClose={close} title="Notas de la sesión">
        <Field
          label="¿Qué hiciste realmente?"
          hint="P. ej.: 'cumplí lo prescrito', 'solo tren inferior', 'cambié curl por preacher'. El preparador lo lee y ajusta la próxima sesión."
        >
          <TextArea
            rows={6}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Texto libre…"
            autoFocus
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
          <PrimaryButton type="button" onClick={save} disabled={isPending}>
            {isPending ? 'Guardando…' : 'Guardar'}
          </PrimaryButton>
        </div>
      </Sheet>
    </>
  );
}
