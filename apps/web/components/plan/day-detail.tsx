'use client';

import { useState } from 'react';
import { SessionDrawer } from './session-drawer';
import { MealDrawer } from './meal-drawer';
import type {
  PlanHydrationRow,
  PlanMealRow,
  PlanMeasurementRow,
  PlanMoodRow,
  PlanSessionRow,
  PlanSetRow,
} from '@/lib/plan/week-data';

interface DayDetailProps {
  selectedDate: string;
  sessions: PlanSessionRow[];
  sets: PlanSetRow[];
  meals: PlanMealRow[];
  measurements: PlanMeasurementRow[];
  moods: PlanMoodRow[];
  hydration: PlanHydrationRow[];
}

const TYPE_LABEL: Record<string, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  full: 'Full body',
  cardio: 'Cardio',
  rest: 'Descanso',
};

const STATUS_COLOR: Record<string, string> = {
  done: 'var(--color-status-green)',
  partial: 'var(--color-status-amber)',
  skipped: 'var(--color-status-red)',
  scheduled: 'var(--color-text-muted)',
};

export function DayDetail({
  selectedDate,
  sessions,
  sets,
  meals,
  measurements,
  moods,
  hydration,
}: DayDetailProps) {
  const [openSession, setOpenSession] = useState<PlanSessionRow | null>(null);
  const [openMeal, setOpenMeal] = useState<PlanMealRow | null>(null);

  const date = new Date(selectedDate + 'T00:00:00');
  const fullLabel = date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const hydrationTotal = hydration.reduce((sum, h) => sum + h.amount_ml, 0);
  const latestMood = moods[moods.length - 1];
  const latestMeasurement = measurements[measurements.length - 1];

  const empty =
    sessions.length === 0 &&
    meals.length === 0 &&
    measurements.length === 0 &&
    moods.length === 0 &&
    hydration.length === 0;

  return (
    <section>
      <div className="mb-3 px-1">
        <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-lg)] font-semibold capitalize text-[color:var(--color-text-primary)]">
          {fullLabel}
        </h2>
      </div>

      {empty && (
        <p className="surface-glass mb-3 px-4 py-6 text-center text-[length:var(--text-sm)] text-[color:var(--color-text-muted)]">
          Nada registrado en este día. Usa los botones de abajo para empezar.
        </p>
      )}

      {sessions.map((s) => {
        const sessionSets = sets.filter((set) => set.session_id === s.id);
        const isSkipped = s.status === 'skipped';
        const isDone = s.status === 'done';
        const color = STATUS_COLOR[s.status] ?? STATUS_COLOR.scheduled!;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => setOpenSession(s)}
            className="tap-feedback surface-glass mb-2 block w-full px-4 py-3 text-left transition"
          >
            <div className="mb-1 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span aria-hidden>🏋️</span>
                <span
                  className={
                    'font-semibold text-[color:var(--color-text-primary)] ' +
                    (isSkipped ? 'line-through opacity-60' : '')
                  }
                >
                  {s.type ? (TYPE_LABEL[s.type] ?? s.type) : 'Sesión'}
                </span>
                {s.whoop_workout_id && (
                  <span className="rounded bg-[color:var(--color-accent)]/15 px-1.5 py-0.5 text-[10px] text-[color:var(--color-accent)]">
                    whoop
                  </span>
                )}
              </div>
              <span
                className="text-[10px] font-medium uppercase tracking-wider"
                style={{ color }}
              >
                {isDone ? '✓ Hecho' : isSkipped ? '✕ Saltado' : s.status === 'partial' ? 'Parcial' : 'Pendiente'}
              </span>
            </div>
            <div className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
              {sessionSets.length > 0
                ? `${sessionSets.length} sets · ${new Set(sessionSets.map((x) => x.exercise)).size} ejercicios`
                : 'Sin sets'}
              {s.rpe && ` · RPE ${s.rpe}`}
            </div>
          </button>
        );
      })}

      {meals.map((m) => {
        const time = new Date(m.consumed_at).toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const hasMacros = m.total_calories !== null || m.total_protein_g !== null;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => setOpenMeal(m)}
            className="tap-feedback surface-glass mb-2 block w-full px-4 py-3 text-left transition"
          >
            <div className="mb-1 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span aria-hidden>🥗</span>
                <span className="font-mono text-[length:var(--text-xs)] tabular-nums text-[color:var(--color-text-muted)]">
                  {time}
                </span>
                <span className="line-clamp-1 text-[length:var(--text-sm)] text-[color:var(--color-text-primary)]">
                  {m.raw_text}
                </span>
              </div>
              {m.photo_path && <span aria-hidden>📷</span>}
            </div>
            <div className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
              {hasMacros
                ? `${m.total_calories ?? '?'} kcal · ${m.total_protein_g ?? '?'}g P · ${m.total_carbs_g ?? '?'}g C · ${m.total_fat_g ?? '?'}g F`
                : 'Macros pendientes'}
            </div>
          </button>
        );
      })}

      {latestMeasurement && (
        <div className="surface-glass mb-2 flex items-center gap-3 px-4 py-3">
          <span aria-hidden>⚖️</span>
          <div>
            <div className="font-mono text-[length:var(--text-sm)] font-semibold tabular-nums text-[color:var(--color-text-primary)]">
              {latestMeasurement.weight_kg} kg
            </div>
            {latestMeasurement.body_fat_pct !== null && (
              <div className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
                Grasa {latestMeasurement.body_fat_pct}%
              </div>
            )}
          </div>
        </div>
      )}

      {latestMood && (
        <div className="surface-glass mb-2 flex items-center gap-3 px-4 py-3">
          <span aria-hidden>😊</span>
          <div className="text-[length:var(--text-sm)] text-[color:var(--color-text-primary)]">
            Mood {latestMood.mood ?? '–'} · Energía {latestMood.energy ?? '–'}
          </div>
        </div>
      )}

      {hydrationTotal > 0 && (
        <div className="surface-glass mb-2 flex items-center gap-3 px-4 py-3">
          <span aria-hidden>💧</span>
          <div className="font-mono text-[length:var(--text-sm)] font-semibold tabular-nums text-[color:var(--color-text-primary)]">
            {(hydrationTotal / 1000).toFixed(2)} L
            <span className="ml-2 text-[10px] font-normal text-[color:var(--color-text-muted)]">
              {hydration.length} registros
            </span>
          </div>
        </div>
      )}

      {openSession && (
        <SessionDrawer
          open={true}
          onClose={() => setOpenSession(null)}
          session={openSession}
          sets={sets.filter((s) => s.session_id === openSession.id)}
        />
      )}
      {openMeal && (
        <MealDrawer open={true} onClose={() => setOpenMeal(null)} meal={openMeal} />
      )}
    </section>
  );
}
