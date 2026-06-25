import { supabase } from './supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export type Program = {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type Routine = {
  id: string;
  user_id: string;
  program_id: string | null;
  name: string;
  position: number;
  created_at: string;
};

export type RoutineExercise = {
  id: string;
  routine_id: string;
  exercise_id: string;
  user_id: string;
  position: number;
  target_sets: number | null;
  target_reps: number | null;
  target_rir: number | null;
  target_rpe: number | null;
  rest_seconds: number | null;
  // Embedded from exercises join (for UI display)
  name_en: string;
  name_es: string | null;
  image_url: string | null;
  primary_muscle: string | null;
};

export type ProgramDay = {
  id: string;
  program_id: string;
  user_id: string;
  weekday: number;
  routine_id: string;
};

type RoutineExerciseTargets = {
  target_sets?: number;
  target_reps?: number;
  target_rir?: number;
  target_rpe?: number;
  rest_seconds?: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function requireUser(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No authenticated user');
  return user.id;
}

// ── Routines ─────────────────────────────────────────────────────────────────

export async function listRoutines(): Promise<Routine[]> {
  const { data, error } = await supabase
    .from('routines')
    .select('*')
    .order('position', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Routine[];
}

const ROUTINE_WITH_EXERCISES_SELECT = `
  *,
  routine_exercises (
    *,
    exercises ( name_en, name_es, image_url, primary_muscle )
  )
`.trim();

export async function getRoutine(
  id: string
): Promise<(Routine & { exercises: RoutineExercise[] }) | null> {
  const { data, error } = await supabase
    .from('routines')
    .select(ROUTINE_WITH_EXERCISES_SELECT)
    .eq('id', id)
    .single();
  if (error) return null;
  if (!data) return null;
  const raw = data as any;
  const exercises: RoutineExercise[] = (raw.routine_exercises ?? [])
    .map((re: any) => ({
      ...re,
      name_en: re.exercises?.name_en ?? '',
      name_es: re.exercises?.name_es ?? null,
      image_url: re.exercises?.image_url ?? null,
      primary_muscle: re.exercises?.primary_muscle ?? null,
    }))
    .sort((a: RoutineExercise, b: RoutineExercise) => a.position - b.position);
  return { ...raw, exercises } as Routine & { exercises: RoutineExercise[] };
}

export async function createRoutine(input: {
  name: string;
  programId?: string;
}): Promise<Routine> {
  const userId = await requireUser();
  const payload: Record<string, unknown> = {
    name: input.name,
    user_id: userId,
  };
  if (input.programId) payload.program_id = input.programId;

  const { data, error } = await supabase
    .from('routines')
    .insert([payload]);
  if (error) throw new Error(error.message);
  return ((data as unknown) as any[])[0] as Routine;
}

export async function updateRoutine(
  id: string,
  patch: Partial<Pick<Routine, 'name' | 'position' | 'program_id'>>
): Promise<void> {
  const { error } = await supabase
    .from('routines')
    .update(patch)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteRoutine(id: string): Promise<void> {
  const { error } = await supabase
    .from('routines')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Routine exercises ─────────────────────────────────────────────────────────

export async function addRoutineExercise(
  routineId: string,
  exerciseId: string,
  targets: RoutineExerciseTargets
): Promise<RoutineExercise> {
  const userId = await requireUser();
  const payload: Record<string, unknown> = {
    routine_id: routineId,
    exercise_id: exerciseId,
    user_id: userId,
    ...targets,
  };
  const { data, error } = await supabase
    .from('routine_exercises')
    .insert([payload]);
  if (error) throw new Error(error.message);
  return ((data as unknown) as any[])[0] as RoutineExercise;
}

export async function updateRoutineExercise(
  id: string,
  patch: Partial<RoutineExerciseTargets & { position: number }>
): Promise<void> {
  const { error } = await supabase
    .from('routine_exercises')
    .update(patch)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function removeRoutineExercise(id: string): Promise<void> {
  const { error } = await supabase
    .from('routine_exercises')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function reorderRoutineExercises(
  routineId: string,
  orderedIds: string[]
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from('routine_exercises')
        .update({ position: index })
        .eq('id', id)
    )
  );
}

// ── Programs ──────────────────────────────────────────────────────────────────

export async function getActiveProgram(): Promise<Program | null> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('is_active', true)
    .single();
  if (error) return null;
  return data as Program;
}

export async function createProgram(input: {
  name: string;
  is_active?: boolean;
}): Promise<Program> {
  const userId = await requireUser();
  const payload: Record<string, unknown> = {
    name: input.name,
    user_id: userId,
    is_active: input.is_active ?? false,
  };
  const { data, error } = await supabase
    .from('programs')
    .insert([payload]);
  if (error) throw new Error(error.message);
  return ((data as unknown) as any[])[0] as Program;
}

// ── Program days ──────────────────────────────────────────────────────────────

export async function setProgramDay(
  programId: string,
  weekday: number,
  routineId: string
): Promise<void> {
  const userId = await requireUser();
  const { error } = await supabase.from('program_days').upsert(
    {
      program_id: programId,
      weekday,
      routine_id: routineId,
      user_id: userId,
    },
    { onConflict: 'program_id,weekday' }
  );
  if (error) throw new Error(error.message);
}

export async function listProgramDays(programId: string): Promise<ProgramDay[]> {
  const { data, error } = await supabase
    .from('program_days')
    .select('*')
    .eq('program_id', programId)
    .order('weekday', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProgramDay[];
}
