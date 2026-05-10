'use client';

import { useState, useTransition } from 'react';
import { updateAppSetting } from '@/lib/actions/admin';
import type { AppSetting } from './page';

const LABELS: Record<string, string> = {
  recovery_green_min: 'Recovery verde ≥',
  recovery_red_max: 'Recovery rojo ≤',
  adherence_meals_green_min: 'Adherencia comidas verde ≥ (%)',
  adherence_meals_red_max: 'Adherencia comidas rojo ≤ (%)',
  adherence_training_green_min: 'Adherencia entrenos verde ≥ (%)',
  adherence_training_red_max: 'Adherencia entrenos rojo ≤ (%)',
  weight_trend_window_days: 'Ventana tendencia peso (días)',
  weight_trend_red_streak_days: 'Días en zona roja peso',
  cal_floor_female: 'Cal mínimas mujer (kcal/día)',
  cal_floor_male: 'Cal mínimas hombre (kcal/día)',
  conversation_compact_threshold_turns: 'Compactar a turnos',
  eval_pass_threshold_pct: 'Threshold pass evals (%)',
  meals_per_day_target: 'Comidas objetivo/día',
  trainings_per_week_target: 'Entrenos objetivo/semana',
};

export function SettingsForm({ settings }: { settings: AppSetting[] }) {
  return (
    <div className="space-y-2">
      {settings.map((s) => (
        <SettingRow key={s.key} setting={s} />
      ))}
    </div>
  );
}

function SettingRow({ setting }: { setting: AppSetting }) {
  const isNumeric = typeof setting.value === 'number';
  const [draft, setDraft] = useState<string>(JSON.stringify(setting.value));
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const label = LABELS[setting.key] ?? setting.key;

  const dirty = draft !== JSON.stringify(setting.value);

  function save() {
    setError(null);
    let parsed: unknown;
    if (isNumeric) {
      const n = Number(draft);
      if (!Number.isFinite(n)) {
        setError('Número inválido');
        return;
      }
      parsed = n;
    } else {
      try {
        parsed = JSON.parse(draft);
      } catch {
        setError('JSON inválido');
        return;
      }
    }
    startTransition(async () => {
      const result = await updateAppSetting({ key: setting.key, value: parsed });
      if (!result.ok) {
        setError(result.error ?? 'Error');
        return;
      }
      setSavedAt(new Date().toLocaleTimeString('es-ES'));
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-2">
      <div className="min-w-0 flex-1">
        <label
          htmlFor={`setting-${setting.key}`}
          className="text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]"
        >
          {label}
        </label>
        <p className="font-mono text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
          {setting.key}
        </p>
      </div>
      <input
        id={`setting-${setting.key}`}
        type={isNumeric ? 'number' : 'text'}
        inputMode={isNumeric ? 'numeric' : 'text'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-32 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-2 py-1 font-mono text-[length:var(--text-sm)] tabular-nums outline-none focus:border-[color:var(--color-accent)]"
      />
      <button
        type="button"
        onClick={save}
        disabled={!dirty || isPending}
        aria-busy={isPending || undefined}
        className="btn-feedback inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-3 py-1 text-[length:var(--text-xs)] font-medium text-[color:var(--color-text-on-accent)] hover:bg-[color:var(--color-accent-strong)]"
      >
        {isPending && (
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden
            className="animate-spin"
          >
            <path d="M21 12a9 9 0 1 1-6.2-8.55" />
          </svg>
        )}
        {isPending ? 'Guardando' : 'Guardar'}
      </button>
      {savedAt && !dirty && (
        <span className="text-[length:var(--text-xs)] text-[color:var(--color-status-green)]">
          ✓ {savedAt}
        </span>
      )}
      {error && (
        <span className="text-[length:var(--text-xs)] text-[color:var(--color-status-red)]">
          {error}
        </span>
      )}
    </div>
  );
}
