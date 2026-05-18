'use client';

import { useEffect, useState, useTransition } from 'react';
import { Sheet } from '@/components/sheet';
import {
  Field,
  PrimaryButton,
  SecondaryButton,
  TextArea,
  TextInput,
} from '@/components/form-controls';
import { SetRow } from './set-row';
import {
  addSet,
  deleteSession,
  linkWhoopWorkout,
  listUnlinkedWhoopWorkoutsForWeek,
  markSessionDone,
  substituteSession,
  unlinkWhoopWorkout,
  updateSessionNotes,
  type WhoopWorkoutLite,
} from '@/lib/actions/training';
import { mondayOf, isoDate } from '@/lib/plan/dates';
import type { PlanSessionRow, PlanSetRow } from '@/lib/plan/week-data';

interface SessionDrawerProps {
  open: boolean;
  onClose: () => void;
  session: PlanSessionRow;
  sets: PlanSetRow[];
}

const STATUSES = [
  { value: 'scheduled', label: 'Pendiente' },
  { value: 'done', label: 'Hecho' },
  { value: 'partial', label: 'Parcial' },
  { value: 'skipped', label: 'Saltado' },
] as const;

export function SessionDrawer({ open, onClose, session, sets }: SessionDrawerProps) {
  const [notes, setNotes] = useState(session.notes ?? '');
  const [showSubst, setShowSubst] = useState(false);
  const [newType, setNewType] = useState('');
  const [exercise, setExercise] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setStatus(status: 'scheduled' | 'done' | 'partial' | 'skipped') {
    startTransition(async () => {
      await markSessionDone({ sessionId: session.id, status });
    });
  }

  function saveNotes() {
    if (notes === (session.notes ?? '')) return;
    startTransition(async () => {
      await updateSessionNotes(session.id, notes);
    });
  }

  function addNewSet() {
    if (exercise.trim().length === 0) {
      setError('Pon un nombre al ejercicio');
      return;
    }
    setError(null);
    startTransition(async () => {
      const nextNumber = (sets[sets.length - 1]?.set_number ?? 0) + 1;
      const result = await addSet({
        sessionId: session.id,
        exercise: exercise.trim(),
        setNumber: nextNumber,
      });
      if (!result.ok) {
        setError(result.error ?? 'Error');
        return;
      }
    });
  }

  function substitute() {
    if (newType.trim().length === 0) {
      setError('Indica el tipo de la nueva sesión');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await substituteSession({
        sessionId: session.id,
        newType: newType.trim(),
      });
      if (!result.ok) {
        setError(result.error ?? 'Error');
        return;
      }
      setShowSubst(false);
      onClose();
    });
  }

  function remove() {
    if (!confirm('¿Borrar esta sesión completa?')) return;
    startTransition(async () => {
      await deleteSession(session.id);
      onClose();
    });
  }

  const grouped = sets.reduce<Record<string, PlanSetRow[]>>((acc, s) => {
    const key = s.exercise;
    (acc[key] = acc[key] ?? []).push(s);
    return acc;
  }, {});

  return (
    <Sheet open={open} onClose={onClose} title={session.type ?? 'Sesión'}>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatus(s.value)}
            disabled={isPending}
            aria-pressed={session.status === s.value}
            className="tap-feedback rounded-[var(--radius-md)] border px-3 py-1 text-[length:var(--text-xs)] font-medium transition disabled:opacity-50"
            style={
              session.status === s.value
                ? {
                    borderColor: 'var(--color-accent)',
                    color: 'var(--color-accent)',
                    background: 'color-mix(in oklch, var(--color-accent) 12%, transparent)',
                  }
                : {
                    borderColor: 'var(--color-border-default)',
                    color: 'var(--color-text-secondary)',
                  }
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      <section className="mb-4">
        <h3 className="text-label mb-2">SETS</h3>
        {Object.keys(grouped).length === 0 ? (
          <p className="mb-3 text-[length:var(--text-sm)] text-[color:var(--color-text-muted)]">
            Sin sets registrados. Añade abajo.
          </p>
        ) : (
          <div className="mb-3 rounded-[var(--radius-md)] border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface)] px-3">
            {Object.entries(grouped).map(([ex, list]) => (
              <div key={ex} className="border-b border-[color:var(--color-border-subtle)] py-2 last:border-0">
                <div className="mb-1 text-[length:var(--text-sm)] font-semibold text-[color:var(--color-text-primary)]">
                  {ex}
                </div>
                {list.map((s) => (
                  <SetRow key={s.id} set={s} />
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <TextInput
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
            placeholder="Ejercicio (p. ej. Press banca)"
            className="flex-1"
          />
          <SecondaryButton type="button" onClick={addNewSet} loading={isPending}>
            + Set
          </SecondaryButton>
        </div>
      </section>

      <WhoopSection session={session} />

      <Field label="Notas de la sesión">
        <TextArea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Sensaciones, dolores, cambios…"
        />
      </Field>

      {showSubst ? (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] p-3">
          <Field label="Tipo de la sustituta">
            <TextInput
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              placeholder="p. ej. cardio, full body…"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <SecondaryButton type="button" onClick={() => setShowSubst(false)}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="button" onClick={substitute} loading={isPending}>
              Sustituir
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowSubst(true)}
          className="tap-feedback mb-3 w-full rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-border-default)] px-3 py-2 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
        >
          ↺ Sustituir por otra sesión
        </button>
      )}

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
          Borrar sesión
        </button>
        <SecondaryButton type="button" onClick={onClose}>
          Cerrar
        </SecondaryButton>
      </div>
    </Sheet>
  );
}

function WhoopSection({ session }: { session: PlanSessionRow }) {
  const [candidates, setCandidates] = useState<WhoopWorkoutLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const isLinked = !!session.whoop_workout_id;

  useEffect(() => {
    if (isLinked) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const weekStart = isoDate(mondayOf(new Date(session.scheduled_for + 'T00:00:00')));
      const list = await listUnlinkedWhoopWorkoutsForWeek(weekStart);
      if (!cancelled) {
        setCandidates(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLinked, session.scheduled_for]);

  function link(workoutId: string) {
    startTransition(async () => {
      await linkWhoopWorkout(session.id, workoutId);
    });
  }

  function unlink() {
    if (!confirm('¿Quitar el link con Whoop de esta sesión?')) return;
    startTransition(async () => {
      await unlinkWhoopWorkout(session.id);
    });
  }

  return (
    <section className="mb-4">
      <h3 className="text-label mb-2">WHOOP</h3>
      {isLinked ? (
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface)] px-3 py-2">
          <div className="text-[length:var(--text-sm)] text-[color:var(--color-text-primary)]">
            <div className="font-medium">Linkado a workout Whoop</div>
            <div className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
              id {session.whoop_workout_id?.slice(0, 8)}…
            </div>
          </div>
          <button
            type="button"
            onClick={unlink}
            className="tap-feedback rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] px-3 py-1 text-[length:var(--text-xs)] text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-status-red)] hover:text-[color:var(--color-status-red)]"
          >
            Desvincular
          </button>
        </div>
      ) : loading ? (
        <p className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
          Cargando workouts…
        </p>
      ) : candidates.length === 0 ? (
        <p className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
          No hay workouts Whoop sueltos esta semana.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {candidates.map((w) => {
            const date = new Date(w.start_at).toLocaleDateString('es-ES', {
              weekday: 'short',
              day: 'numeric',
            });
            const time = new Date(w.start_at).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
            });
            const isOtherDay = w.start_at.slice(0, 10) !== session.scheduled_for;
            return (
              <li key={w.whoop_id}>
                <button
                  type="button"
                  onClick={() => link(w.whoop_id)}
                  className="tap-feedback flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-2 text-left hover:border-[color:var(--color-accent)]"
                >
                  <div>
                    <div className="text-[length:var(--text-sm)] text-[color:var(--color-text-primary)]">
                      {w.sport ?? 'Workout'} · {date} {time}
                    </div>
                    <div className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
                      {w.strain !== null && `Strain ${w.strain.toFixed(1)} · `}
                      {w.avg_hr !== null && `HR ${w.avg_hr} bpm`}
                      {isOtherDay && ' · moverá la sesión a este día'}
                    </div>
                  </div>
                  <span aria-hidden className="text-[color:var(--color-text-muted)]">
                    →
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
