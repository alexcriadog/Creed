'use client';

import { useState, useTransition } from 'react';
import { Sheet } from './sheet';
import { Field, TextArea, Select, PrimaryButton, SecondaryButton } from './form-controls';
import { createMeal } from '@/lib/actions/meals';

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Desayuno' },
  { value: 'lunch', label: 'Comida' },
  { value: 'dinner', label: 'Cena' },
  { value: 'snack', label: 'Snack' },
  { value: 'other', label: 'Otro' },
] as const;

type MealType = (typeof MEAL_TYPES)[number]['value'];

export function LogMealButton() {
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState('');
  const [mealType, setMealType] = useState<MealType | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setRawText('');
    setMealType('');
    setError(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createMeal({
        rawText,
        mealType: mealType === '' ? undefined : mealType,
      });
      if (!result.ok) {
        setError(result.error ?? 'Error al guardar');
        return;
      }
      if (result.data?.id) {
        const mealId = result.data.id;
        void fetch('/api/meal-parser', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mealId }),
        })
          .then((r) => {
            if (!r.ok) console.warn('[meal-parser] not ok', r.status);
          })
          .catch((err) => console.warn('[meal-parser]', err));
      }
      close();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-1.5 text-[length:var(--text-xs)] font-medium text-[color:var(--color-text-secondary)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
      >
        + Comida
      </button>
      <Sheet open={open} onClose={close} title="Registrar comida">
        <Field label="Tipo">
          <Select value={mealType} onChange={(e) => setMealType(e.target.value as MealType | '')}>
            <option value="">Sin clasificar</option>
            {MEAL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="¿Qué has comido?" hint="Texto libre. El parser leerá esto luego.">
          <TextArea
            rows={5}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="P. ej.: 200g de pollo a la plancha, 100g de arroz, ensalada con aceite"
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
          <PrimaryButton
            type="button"
            onClick={submit}
            disabled={isPending || rawText.trim().length === 0}
          >
            {isPending ? 'Guardando…' : 'Guardar'}
          </PrimaryButton>
        </div>
      </Sheet>
    </>
  );
}
