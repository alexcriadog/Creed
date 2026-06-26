/**
 * Tipos compartidos del registro de serie en la sesión.
 * (El render vive en `session-focus-page.tsx` — dark atlético v3. El antiguo
 * `SessionExerciseCard` se retiró al pasar a modo foco; solo quedan los tipos.)
 */

export type ExerciseTarget = {
  target_sets: number | null;
  target_reps: string | null;
  target_rir: number | null;
};

export type SetPatch = {
  reps?: number | null;
  weight_kg?: number | null;
  rir?: number | null;
  completed?: boolean;
  performed_at?: string | null;
};
