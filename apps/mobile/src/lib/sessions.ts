import { supabase } from './supabase';
import { getRoutine } from './routines';

// ── Types ────────────────────────────────────────────────────────────────────

export type Session = {
  id: string;
  user_id: string;
  routine_id: string | null;
  source: 'manual' | string;
  status: 'planned' | 'in_progress' | 'completed' | 'skipped';
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type SessionSet = {
  id: string;
  session_id: string;
  user_id: string;
  exercise_id: string;
  routine_exercise_id: string | null;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  rir: number | null;
  rpe: number | null;
  is_warmup: boolean;
  completed: boolean;
  performed_at: string | null;
  created_at: string;
  // Embedded exercise display fields
  name_en: string;
  name_es: string | null;
  image_url: string | null;
  primary_muscle: string | null;
};

export type SessionWithSets = Session & { sets: SessionSet[] };

// ── Helpers ──────────────────────────────────────────────────────────────────

async function requireUser(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No authenticated user');
  return user.id;
}

const DEFAULT_TARGET_SETS = 3;

// ── Sessions ─────────────────────────────────────────────────────────────────

export async function startSession(routineId: string): Promise<Session> {
  const userId = await requireUser();

  // Insert the session row
  const { data: sessionData, error: sessionError } = await supabase
    .from('sessions')
    .insert([
      {
        user_id: userId,
        routine_id: routineId,
        source: 'manual',
        status: 'in_progress',
      },
    ])
    .select()
    .single();

  if (sessionError) throw new Error(sessionError.message);
  const session = sessionData as Session;

  // Pre-create sets from the routine's exercises.
  // I1 (atomicity): if the session row was created but the sets pre-fill fails,
  // delete the just-created session so we never leave an orphan in_progress
  // session with no sets behind.
  const routine = await getRoutine(routineId);
  if (routine && routine.exercises.length > 0) {
    const setRows: Record<string, unknown>[] = [];
    for (const re of routine.exercises) {
      const targetSets = re.target_sets ?? DEFAULT_TARGET_SETS;
      for (let n = 1; n <= targetSets; n++) {
        setRows.push({
          session_id: session.id,
          user_id: userId,
          exercise_id: re.exercise_id,
          routine_exercise_id: re.id,
          set_number: n,
          reps: null,
          weight_kg: null,
          rir: null,
          rpe: null,
          is_warmup: false,
          completed: false,
          performed_at: null,
        });
      }
    }
    if (setRows.length > 0) {
      const { error: setsError } = await supabase.from('sets').insert(setRows);
      if (setsError) {
        // Roll back the session so the user is not stuck with an empty,
        // un-resumable in_progress session.
        await supabase.from('sessions').delete().eq('id', session.id);
        throw new Error(setsError.message);
      }
    }
  }

  return session;
}

export async function getActiveSession(): Promise<Session | null> {
  const userId = await requireUser();
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .maybeSingle();
  if (error) return null;
  return (data as Session) ?? null;
}

export async function getSession(id: string): Promise<SessionWithSets | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select(
      `*, sets ( *, exercises ( name_en, name_es, image_url, primary_muscle ) )`
    )
    .eq('id', id)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;

  const raw = data as any;
  const mapped: SessionSet[] = ((raw.sets ?? []) as any[]).map((s: any) => ({
    ...s,
    name_en: s.exercises?.name_en ?? '',
    name_es: s.exercises?.name_es ?? null,
    image_url: s.exercises?.image_url ?? null,
    primary_muscle: s.exercises?.primary_muscle ?? null,
  }));

  // M1 (ordering): group exercises in a stable order (by the order each
  // exercise first appears, which mirrors the pre-fill/position order) and,
  // within each exercise, order sets by set_number — never by exercise_id UUID.
  const firstSeen = new Map<string, number>();
  mapped.forEach((s, i) => {
    if (!firstSeen.has(s.exercise_id)) firstSeen.set(s.exercise_id, i);
  });
  const sets = [...mapped].sort((a, b) => {
    const ga = firstSeen.get(a.exercise_id) ?? 0;
    const gb = firstSeen.get(b.exercise_id) ?? 0;
    if (ga !== gb) return ga - gb;
    return a.set_number - b.set_number;
  });

  return { ...raw, sets } as SessionWithSets;
}

export async function updateSet(
  setId: string,
  patch: {
    reps?: number | null;
    weight_kg?: number | null;
    rir?: number | null;
    rpe?: number | null;
    completed?: boolean;
    performed_at?: string | null;
  }
): Promise<void> {
  const { error } = await supabase.from('sets').update(patch).eq('id', setId);
  if (error) throw new Error(error.message);
}

export async function addSet(
  sessionId: string,
  exerciseId: string,
  routineExerciseId: string | null,
  setNumber: number
): Promise<SessionSet> {
  const userId = await requireUser();
  const { data, error } = await supabase
    .from('sets')
    .insert([
      {
        session_id: sessionId,
        user_id: userId,
        exercise_id: exerciseId,
        routine_exercise_id: routineExerciseId,
        set_number: setNumber,
        reps: null,
        weight_kg: null,
        rir: null,
        rpe: null,
        is_warmup: false,
        completed: false,
        performed_at: null,
      },
    ])
    .select()
    .single();
  if (error) throw new Error(error.message);
  const raw = data as any;
  return {
    ...raw,
    name_en: '',
    name_es: null,
    image_url: null,
    primary_muscle: null,
  } as SessionSet;
}

export async function removeSet(id: string): Promise<void> {
  const { error } = await supabase.from('sets').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function completeSession(id: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}


// ── Previous-set hints ────────────────────────────────────────────────────────

/**
 * Shape returned per exercise: set_number → {weight_kg, reps, rir} from the
 * user's most recent COMPLETED session that contains that exercise.
 */
export type PrevSetValues = {
  weight_kg: number | null;
  reps: number | null;
  rir: number | null;
};

export type PrevByExercise = Record<string, Record<number, PrevSetValues>>;

/**
 * For each exercise_id in the list, finds the user's most recent completed
 * session that contains it and returns its set values keyed by set_number.
 *
 * Returns an empty object for exercises with no prior completed history.
 * Never throws — on any DB error returns {}.
 */
export async function getLastPerformedByExercise(
  exerciseIds: string[]
): Promise<PrevByExercise> {
  if (exerciseIds.length === 0) return {};

  let userId: string;
  try {
    userId = await requireUser();
  } catch {
    return {};
  }

  // Fetch all completed sets for these exercises, ordered newest session first,
  // then by set_number. We keep only the newest session per exercise in JS.
  const { data, error } = await supabase
    .from('sets')
    .select(
      'exercise_id, set_number, weight_kg, reps, rir, sessions!inner(status, completed_at, user_id)'
    )
    .eq('sessions.status', 'completed')
    .eq('sessions.user_id', userId)
    .in('exercise_id', exerciseIds)
    .order('sessions.completed_at', { ascending: false })
    .order('set_number', { ascending: true });

  if (error || !data) return {};

  // Per exercise, keep only the rows from the single most recent session.
  // Because rows are ordered newest → oldest, the first completed_at we see
  // per exercise is the one we want.
  const latestCompletedAt = new Map<string, string>();
  const result: PrevByExercise = {};

  for (const row of data as any[]) {
    const exerciseId: string = row.exercise_id;
    const sessionCompletedAt: string = (row.sessions as any)?.completed_at ?? '';

    if (!latestCompletedAt.has(exerciseId)) {
      latestCompletedAt.set(exerciseId, sessionCompletedAt);
      result[exerciseId] = {};
    }

    // Skip rows from older sessions for this exercise
    if (latestCompletedAt.get(exerciseId) !== sessionCompletedAt) continue;

    result[exerciseId][row.set_number as number] = {
      weight_kg: row.weight_kg ?? null,
      reps: row.reps ?? null,
      rir: row.rir ?? null,
    };
  }

  return result;
}

export async function listSessions(): Promise<
  (Session & { routine_name: string | null; set_count: number })[]
> {
  const userId = await requireUser();
  const { data, error } = await supabase
    .from('sessions')
    .select(`*, routines ( name ), sets ( id )`)
    .eq('user_id', userId)
    .order('started_at', { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as any[]).map((row: any) => ({
    ...row,
    routine_name: (row.routines as { name: string } | null)?.name ?? null,
    set_count: Array.isArray(row.sets) ? row.sets.length : 0,
  })) as (Session & { routine_name: string | null; set_count: number })[];
}
