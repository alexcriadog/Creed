// jest hoisting: mock-prefixed vars are safe to reference before imports

// ── auth mock (getUser) ──────────────────────────────────────────────────────
const mockGetUser = jest.fn().mockResolvedValue({
  data: { user: { id: 'user-123' } },
  error: null,
});

// ── chainable query builder ──────────────────────────────────────────────────
const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });
const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
const mockInsert = jest.fn(() => mockBuilder);
const mockUpdate = jest.fn().mockResolvedValue({ data: [{}], error: null });
const mockDelete = jest.fn().mockResolvedValue({ data: [], error: null });

// mockOrder returns the builder so that chains like .order().maybeSingle() work.
// When used as a terminal (await .order()), the builder's then() is invoked —
// see the mockBuilderResolution control below.
const mockOrder = jest.fn(() => mockBuilder);

// Holds the resolved value that mockBuilder.then() yields when awaited.
// Default: { data: [], error: null }. Tests that use mockOrder as terminal
// must set mockBuilderResolution before calling the function under test.
let mockBuilderResolution: { data: any; error: any } = { data: [], error: null };

// Builder that supports chaining: from().select().eq().order() etc.
// It is also thenable so `await builder` works for terminal calls like listSessions.
const mockBuilder: any = {};
const mockSelect = jest.fn(() => mockBuilder);
const mockEq = jest.fn(() => mockBuilder);

Object.assign(mockBuilder, {
  select: mockSelect,
  eq: mockEq,
  order: mockOrder,
  single: mockSingle,
  maybeSingle: mockMaybeSingle,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  // Thenable: when this builder is awaited directly, resolve with mockBuilderResolution
  then: (resolve: (v: any) => void, _reject?: (e: any) => void) => {
    Promise.resolve(mockBuilderResolution).then(resolve, _reject);
  },
});

const mockFrom = jest.fn(() => mockBuilder);

jest.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => (mockFrom as any)(table),
    auth: { getUser: () => mockGetUser() },
  },
}));

// ── routines mock (getRoutine) ───────────────────────────────────────────────
const mockGetRoutine = jest.fn();

jest.mock('./routines', () => ({
  getRoutine: (id: string) => mockGetRoutine(id),
}));

import {
  startSession,
  getActiveSession,
  getSession,
  updateSet,
  addSet,
  removeSet,
  completeSession,
  listSessions,
} from './sessions';

beforeEach(() => {
  jest.clearAllMocks();
  // Reset thenable resolution to safe default
  mockBuilderResolution = { data: [], error: null };
  // Restore builder chaining after clearAllMocks
  mockSelect.mockReturnValue(mockBuilder);
  mockEq.mockReturnValue(mockBuilder);
  mockOrder.mockReturnValue(mockBuilder);
  mockInsert.mockReturnValue(mockBuilder);
  Object.assign(mockBuilder, {
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    then: (resolve: (v: any) => void, _reject?: (e: any) => void) => {
      Promise.resolve(mockBuilderResolution).then(resolve, _reject);
    },
  });
  // Sensible defaults
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockUpdate.mockResolvedValue({ data: [{}], error: null });
  mockDelete.mockResolvedValue({ data: [], error: null });
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
  mockGetRoutine.mockResolvedValue(null);
});

// ── startSession ─────────────────────────────────────────────────────────────

test('startSession inserts a session with status in_progress and routine_id', async () => {
  const mockSession = {
    id: 'sess-1',
    user_id: 'user-123',
    routine_id: 'routine-abc',
    source: 'manual',
    status: 'in_progress',
    started_at: '2026-06-25T10:00:00.000Z',
    completed_at: null,
    created_at: '2026-06-25T10:00:00.000Z',
  };
  mockSingle.mockResolvedValue({ data: mockSession, error: null });
  mockGetRoutine.mockResolvedValue(null); // no exercises → skip pre-create

  const result = await startSession('routine-abc');

  expect(mockFrom).toHaveBeenCalledWith('sessions');
  expect(mockInsert).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({
        user_id: 'user-123',
        routine_id: 'routine-abc',
        source: 'manual',
        status: 'in_progress',
      }),
    ])
  );
  expect(result).toMatchObject({ id: 'sess-1', status: 'in_progress' });
});

test('startSession pre-creates sets for each routine exercise × target_sets', async () => {
  const mockSession = {
    id: 'sess-2',
    user_id: 'user-123',
    routine_id: 'routine-xyz',
    source: 'manual',
    status: 'in_progress',
    started_at: '2026-06-25T10:00:00.000Z',
    completed_at: null,
    created_at: '2026-06-25T10:00:00.000Z',
  };
  mockSingle.mockResolvedValue({ data: mockSession, error: null });

  // 2 exercises: exercise A with 3 sets, exercise B with 2 sets → 5 rows total
  mockGetRoutine.mockResolvedValue({
    id: 'routine-xyz',
    name: 'Push',
    exercises: [
      {
        id: 're-1',
        exercise_id: 'ex-A',
        routine_id: 'routine-xyz',
        position: 0,
        target_sets: 3,
        target_reps: '8-10',
        target_rir: null,
        target_rpe: null,
        rest_seconds: null,
        name_en: 'Bench Press',
        name_es: null,
        image_url: null,
        primary_muscle: 'chest',
        user_id: 'user-123',
      },
      {
        id: 're-2',
        exercise_id: 'ex-B',
        routine_id: 'routine-xyz',
        position: 1,
        target_sets: 2,
        target_reps: '10-12',
        target_rir: null,
        target_rpe: null,
        rest_seconds: null,
        name_en: 'Overhead Press',
        name_es: null,
        image_url: null,
        primary_muscle: 'shoulders',
        user_id: 'user-123',
      },
    ],
  });

  // Track insert calls: first is session, second is sets batch
  let insertCallCount = 0;
  mockInsert.mockImplementation(() => {
    insertCallCount++;
    if (insertCallCount === 1) {
      // Session insert → chain to .select().single()
      return mockBuilder;
    }
    // Sets batch insert → resolves directly
    return { error: null };
  });

  await startSession('routine-xyz');

  // sets insert should have been called with 5 rows
  expect(mockInsert).toHaveBeenCalledTimes(2);
  const setsInsertCall = (mockInsert.mock.calls as any[][])[1][0] as any[];
  expect(setsInsertCall).toHaveLength(5);

  // Check set_numbers for exercise A (3 sets: 1, 2, 3)
  const setsForA = setsInsertCall.filter((s: any) => s.exercise_id === 'ex-A');
  expect(setsForA).toHaveLength(3);
  expect(setsForA.map((s: any) => s.set_number).sort()).toEqual([1, 2, 3]);

  // Check set_numbers for exercise B (2 sets: 1, 2)
  const setsForB = setsInsertCall.filter((s: any) => s.exercise_id === 'ex-B');
  expect(setsForB).toHaveLength(2);
  expect(setsForB.map((s: any) => s.set_number).sort()).toEqual([1, 2]);

  // All rows must have correct session_id and user_id
  setsInsertCall.forEach((s: any) => {
    expect(s.session_id).toBe('sess-2');
    expect(s.user_id).toBe('user-123');
    expect(s.completed).toBe(false);
  });
});

test('startSession uses DEFAULT_TARGET_SETS=3 when target_sets is null', async () => {
  const mockSession = {
    id: 'sess-3',
    user_id: 'user-123',
    routine_id: 'routine-null-sets',
    source: 'manual',
    status: 'in_progress',
    started_at: '2026-06-25T10:00:00.000Z',
    completed_at: null,
    created_at: '2026-06-25T10:00:00.000Z',
  };
  mockSingle.mockResolvedValue({ data: mockSession, error: null });

  mockGetRoutine.mockResolvedValue({
    id: 'routine-null-sets',
    name: 'Test',
    exercises: [
      {
        id: 're-3',
        exercise_id: 'ex-C',
        routine_id: 'routine-null-sets',
        position: 0,
        target_sets: null, // null → should default to 3
        target_reps: null,
        target_rir: null,
        target_rpe: null,
        rest_seconds: null,
        name_en: 'Squat',
        name_es: null,
        image_url: null,
        primary_muscle: 'quads',
        user_id: 'user-123',
      },
    ],
  });

  let insertCallCount = 0;
  mockInsert.mockImplementation(() => {
    insertCallCount++;
    if (insertCallCount === 1) return mockBuilder;
    return { error: null };
  });

  await startSession('routine-null-sets');

  const setsInsertCall = (mockInsert.mock.calls as any[][])[1][0] as any[];
  expect(setsInsertCall).toHaveLength(3); // default 3 sets
  expect(setsInsertCall.map((s: any) => s.set_number).sort()).toEqual([1, 2, 3]);
});

test('startSession throws if no authenticated user', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(startSession('r1')).rejects.toThrow();
});

test('startSession throws if session insert fails', async () => {
  mockSingle.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });
  await expect(startSession('r1')).rejects.toThrow('Insert failed');
});

// ── getActiveSession ─────────────────────────────────────────────────────────

test('getActiveSession queries sessions filtered by user_id and status=in_progress', async () => {
  const mockSession = {
    id: 'sess-active',
    status: 'in_progress',
    user_id: 'user-123',
  };
  mockMaybeSingle.mockResolvedValue({ data: mockSession, error: null });

  const result = await getActiveSession();

  expect(mockFrom).toHaveBeenCalledWith('sessions');
  expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123');
  expect(mockEq).toHaveBeenCalledWith('status', 'in_progress');
  expect(result).toMatchObject({ id: 'sess-active', status: 'in_progress' });
});

test('getActiveSession returns null when no in_progress session exists', async () => {
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  const result = await getActiveSession();
  expect(result).toBeNull();
});

test('getActiveSession returns null on DB error', async () => {
  mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });
  const result = await getActiveSession();
  expect(result).toBeNull();
});

// ── getSession ───────────────────────────────────────────────────────────────

test('getSession returns session with embedded sets and exercise display fields', async () => {
  mockMaybeSingle.mockResolvedValue({
    data: {
      id: 'sess-1',
      user_id: 'user-123',
      status: 'in_progress',
      sets: [
        {
          id: 'set-1',
          exercise_id: 'ex-A',
          set_number: 1,
          completed: false,
          exercises: { name_en: 'Bench Press', name_es: null, image_url: null, primary_muscle: 'chest' },
        },
      ],
    },
    error: null,
  });

  const result = await getSession('sess-1');
  expect(result).not.toBeNull();
  expect(result!.sets).toHaveLength(1);
  expect(result!.sets[0]).toMatchObject({
    id: 'set-1',
    name_en: 'Bench Press',
    primary_muscle: 'chest',
  });
});

test('getSession returns null when session not found', async () => {
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  const result = await getSession('nonexistent');
  expect(result).toBeNull();
});

test('getSession returns null on DB error', async () => {
  mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });
  const result = await getSession('sess-1');
  expect(result).toBeNull();
});

// ── updateSet ────────────────────────────────────────────────────────────────

test('updateSet updates the set with the provided patch', async () => {
  const mockUpdateEq = jest.fn().mockResolvedValue({ data: [{}], error: null });
  mockUpdate.mockReturnValue({ ...mockBuilder, eq: mockUpdateEq });

  await updateSet('set-1', { reps: 10, weight_kg: 80, completed: true });

  expect(mockFrom).toHaveBeenCalledWith('sets');
  expect(mockUpdate).toHaveBeenCalledWith(
    expect.objectContaining({ reps: 10, weight_kg: 80, completed: true })
  );
  expect(mockUpdateEq).toHaveBeenCalledWith('id', 'set-1');
});

test('updateSet throws on DB error', async () => {
  const mockUpdateEq = jest.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } });
  mockUpdate.mockReturnValue({ ...mockBuilder, eq: mockUpdateEq });

  await expect(updateSet('set-1', { reps: 5 })).rejects.toThrow('Update failed');
});

// ── addSet ───────────────────────────────────────────────────────────────────

test('addSet inserts a new set and returns it with exercise display fields defaulted', async () => {
  mockSingle.mockResolvedValue({
    data: {
      id: 'set-new',
      session_id: 'sess-1',
      user_id: 'user-123',
      exercise_id: 'ex-A',
      routine_exercise_id: 're-1',
      set_number: 4,
      reps: null,
      weight_kg: null,
      rir: null,
      rpe: null,
      is_warmup: false,
      completed: false,
      performed_at: null,
      created_at: '2026-06-25T10:00:00.000Z',
    },
    error: null,
  });

  const result = await addSet('sess-1', 'ex-A', 're-1', 4);

  expect(mockFrom).toHaveBeenCalledWith('sets');
  expect(mockInsert).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({
        session_id: 'sess-1',
        user_id: 'user-123',
        exercise_id: 'ex-A',
        routine_exercise_id: 're-1',
        set_number: 4,
        completed: false,
      }),
    ])
  );
  expect(result).toMatchObject({
    id: 'set-new',
    set_number: 4,
    name_en: '',
    name_es: null,
    image_url: null,
    primary_muscle: null,
  });
});

// ── removeSet ────────────────────────────────────────────────────────────────

test('removeSet deletes the set by id', async () => {
  const mockDeleteEq = jest.fn().mockResolvedValue({ data: [], error: null });
  mockDelete.mockReturnValue({ ...mockBuilder, eq: mockDeleteEq });

  await removeSet('set-1');

  expect(mockFrom).toHaveBeenCalledWith('sets');
  expect(mockDelete).toHaveBeenCalled();
  expect(mockDeleteEq).toHaveBeenCalledWith('id', 'set-1');
});

// ── completeSession ──────────────────────────────────────────────────────────

test('completeSession updates status to completed and sets completed_at', async () => {
  const mockUpdateEq = jest.fn().mockResolvedValue({ data: [{}], error: null });
  mockUpdate.mockReturnValue({ ...mockBuilder, eq: mockUpdateEq });

  const before = Date.now();
  await completeSession('sess-1');
  const after = Date.now();

  expect(mockFrom).toHaveBeenCalledWith('sessions');
  expect(mockUpdate).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'completed' })
  );
  // Verify completed_at is an ISO string within the test window
  const updateArg = (mockUpdate.mock.calls[0][0] as any);
  expect(updateArg.completed_at).toBeDefined();
  const completedAtMs = new Date(updateArg.completed_at).getTime();
  expect(completedAtMs).toBeGreaterThanOrEqual(before);
  expect(completedAtMs).toBeLessThanOrEqual(after);
  expect(mockUpdateEq).toHaveBeenCalledWith('id', 'sess-1');
});

test('completeSession throws on DB error', async () => {
  const mockUpdateEq = jest.fn().mockResolvedValue({ data: null, error: { message: 'Complete failed' } });
  mockUpdate.mockReturnValue({ ...mockBuilder, eq: mockUpdateEq });

  await expect(completeSession('sess-1')).rejects.toThrow('Complete failed');
});

// ── listSessions ─────────────────────────────────────────────────────────────

test('listSessions queries sessions ordered by started_at desc', async () => {
  mockBuilderResolution = {
    data: [
      {
        id: 'sess-2',
        user_id: 'user-123',
        status: 'completed',
        started_at: '2026-06-25T10:00:00.000Z',
        routines: { name: 'Push' },
        sets: [{ id: 's1' }, { id: 's2' }],
      },
      {
        id: 'sess-1',
        user_id: 'user-123',
        status: 'completed',
        started_at: '2026-06-24T10:00:00.000Z',
        routines: { name: 'Pull' },
        sets: [{ id: 's3' }],
      },
    ],
    error: null,
  };

  const result = await listSessions();

  expect(mockFrom).toHaveBeenCalledWith('sessions');
  expect(mockOrder).toHaveBeenCalledWith('started_at', { ascending: false });
  expect(result).toHaveLength(2);
  // First result is the newer session
  expect(result[0]).toMatchObject({
    id: 'sess-2',
    routine_name: 'Push',
    set_count: 2,
  });
  expect(result[1]).toMatchObject({
    id: 'sess-1',
    routine_name: 'Pull',
    set_count: 1,
  });
});

test('listSessions returns routine_name as null when no routine', async () => {
  mockBuilderResolution = {
    data: [
      {
        id: 'sess-manual',
        user_id: 'user-123',
        status: 'completed',
        started_at: '2026-06-25T10:00:00.000Z',
        routines: null,
        sets: [],
      },
    ],
    error: null,
  };

  const result = await listSessions();
  expect(result[0].routine_name).toBeNull();
  expect(result[0].set_count).toBe(0);
});

test('listSessions throws on DB error', async () => {
  mockBuilderResolution = { data: null, error: { message: 'List failed' } };
  await expect(listSessions()).rejects.toThrow('List failed');
});

test('listSessions throws if no authenticated user', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(listSessions()).rejects.toThrow();
});
