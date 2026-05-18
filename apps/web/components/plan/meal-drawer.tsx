'use client';

import { useState, useTransition } from 'react';
import { Sheet } from '@/components/sheet';
import {
  Field,
  PrimaryButton,
  SecondaryButton,
  TextArea,
} from '@/components/form-controls';
import { deleteMeal, updateMeal, uploadMealPhoto } from '@/lib/actions/meals';
import type { PlanMealRow } from '@/lib/plan/week-data';

interface MealDrawerProps {
  open: boolean;
  onClose: () => void;
  meal: PlanMealRow;
}

function triggerParse(mealId: string) {
  void fetch('/api/meal-parser', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mealId }),
  }).catch((err) => console.warn('[meal-parser]', err));
}

export function MealDrawer({ open, onClose, meal }: MealDrawerProps) {
  const [rawText, setRawText] = useState(meal.raw_text);
  const [cal, setCal] = useState(meal.total_calories?.toString() ?? '');
  const [prot, setProt] = useState(meal.total_protein_g?.toString() ?? '');
  const [carb, setCarb] = useState(meal.total_carbs_g?.toString() ?? '');
  const [fat, setFat] = useState(meal.total_fat_g?.toString() ?? '');
  const [isPending, startTransition] = useTransition();
  const [uploading, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function saveText() {
    if (rawText === meal.raw_text) return;
    startTransition(async () => {
      const result = await updateMeal({ mealId: meal.id, rawText });
      if (!result.ok) {
        setError(result.error ?? 'Error');
        return;
      }
      if (!meal.user_corrected) triggerParse(meal.id);
    });
  }

  function saveMacros() {
    const next = {
      mealId: meal.id,
      totalCalories: cal.trim() === '' ? null : Number(cal),
      totalProteinG: prot.trim() === '' ? null : Number(prot),
      totalCarbsG: carb.trim() === '' ? null : Number(carb),
      totalFatG: fat.trim() === '' ? null : Number(fat),
      userCorrected: true,
    };
    startTransition(async () => {
      const result = await updateMeal(next);
      if (!result.ok) setError(result.error ?? 'Error');
    });
  }

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    startUpload(async () => {
      const result = await uploadMealPhoto(meal.id, file);
      if (!result.ok) {
        setError(result.error ?? 'Error al subir');
        return;
      }
      triggerParse(meal.id);
    });
  }

  function remove() {
    if (!confirm('¿Borrar esta comida?')) return;
    startTransition(async () => {
      await deleteMeal(meal.id);
      onClose();
    });
  }

  const time = new Date(meal.consumed_at).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const parserPending = meal.parser_confidence === null && !meal.user_corrected;

  return (
    <Sheet open={open} onClose={onClose} title={`Comida · ${time}`}>
      <Field label="¿Qué has comido?">
        <TextArea
          rows={3}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          onBlur={saveText}
          placeholder="Texto libre…"
        />
      </Field>

      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-label">FOTO</h3>
          {parserPending && (
            <span className="text-[10px] text-[color:var(--color-text-muted)]">
              parseando…
            </span>
          )}
        </div>
        {meal.photo_path ? (
          <div className="mb-2 overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-border-subtle)]">
            <MealPhoto path={meal.photo_path} />
          </div>
        ) : (
          <p className="mb-2 text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
            Sube una foto y se estimarán los macros de la comida.
          </p>
        )}
        <label className="tap-feedback inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] px-3 py-1.5 text-[length:var(--text-xs)] font-medium text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]">
          {uploading ? 'Subiendo…' : meal.photo_path ? 'Reemplazar foto' : '+ Foto'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPhotoChange}
            disabled={uploading}
          />
        </label>
      </section>

      <section className="mb-4">
        <h3 className="text-label mb-2">MACROS</h3>
        <div className="grid grid-cols-4 gap-2">
          <MacroBox label="kcal" value={cal} onChange={setCal} />
          <MacroBox label="P (g)" value={prot} onChange={setProt} />
          <MacroBox label="C (g)" value={carb} onChange={setCarb} />
          <MacroBox label="F (g)" value={fat} onChange={setFat} />
        </div>
        <p className="mt-1 text-[10px] text-[color:var(--color-text-muted)]">
          {meal.user_corrected
            ? 'Editado manualmente — el parser no sobrescribirá.'
            : meal.parser_confidence !== null
              ? `Estimación parser · confianza ${Math.round(meal.parser_confidence * 100)}%`
              : 'Estimación pendiente.'}
        </p>
        <div className="mt-2 flex justify-end">
          <PrimaryButton type="button" onClick={saveMacros} loading={isPending}>
            Guardar macros
          </PrimaryButton>
        </div>
      </section>

      {error && (
        <p className="mb-3 text-[length:var(--text-sm)] text-[color:var(--color-status-red)]">
          {error}
        </p>
      )}

      <div className="flex justify-between gap-2">
        <button
          type="button"
          onClick={remove}
          className="tap-feedback rounded-[var(--radius-md)] px-3 py-2 text-[length:var(--text-sm)] text-[color:var(--color-status-red)] hover:underline"
        >
          Borrar
        </button>
        <SecondaryButton type="button" onClick={onClose}>
          Cerrar
        </SecondaryButton>
      </div>
    </Sheet>
  );
}

function MacroBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col items-center gap-1 rounded-[var(--radius-md)] border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)] px-2 py-2">
      <span className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step="0.5"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-center font-mono text-[length:var(--text-base)] font-semibold tabular-nums text-[color:var(--color-text-primary)] outline-none"
      />
    </label>
  );
}

function MealPhoto({ path }: { path: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/meal-photo?path=${encodeURIComponent(path)}`}
      alt="Foto de la comida"
      className="block h-full w-full object-cover"
      style={{ maxHeight: 320 }}
    />
  );
}
