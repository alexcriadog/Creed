// jest hoisting: mock-prefixed vars are safe to reference before imports

// ── auth mock (getUser) ──────────────────────────────────────────────────────
const mockGetUser = jest.fn().mockResolvedValue({
  data: { user: { id: 'user-123' } },
  error: null,
});

// ── chainable query builder ──────────────────────────────────────────────────
const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });
const mockOrder = jest.fn().mockResolvedValue({ data: [], error: null });
// insert/upsert return the builder so .select().single() can be chained
const mockInsert = jest.fn(() => mockBuilder);
const mockUpsert = jest.fn(() => mockBuilder);
const mockUpdate = jest.fn().mockResolvedValue({ data: [{}], error: null });
const mockDelete = jest.fn().mockResolvedValue({ data: [], error: null });

// Builder that supports chaining: from().select().eq().order() etc.
const mockBuilder: any = {};
const mockSelect = jest.fn(() => mockBuilder);
const mockEq = jest.fn(() => mockBuilder);

Object.assign(mockBuilder, {
  select: mockSelect,
  eq: mockEq,
  order: mockOrder,
  single: mockSingle,
  maybeSingle: mockSingle, // maybeSingle shares the same terminal mock
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  upsert: mockUpsert,
});

const mockFrom = jest.fn(() => mockBuilder);

jest.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => (mockFrom as any)(table),
    auth: { getUser: () => mockGetUser() },
  },
}));

import {
  listRoutines,
  getRoutine,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  addRoutineExercise,
  updateRoutineExercise,
  removeRoutineExercise,
  reorderRoutineExercises,
  getActiveProgram,
  createProgram,
  setProgramDay,
  listProgramDays,
} from './routines';

beforeEach(() => {
  jest.clearAllMocks();
  // Reset all mock return values to sensible defaults
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockSingle.mockResolvedValue({ data: null, error: null });
  // insert/upsert chain to .select().single() — terminal is mockSingle
  mockInsert.mockReturnValue(mockBuilder);
  mockUpsert.mockReturnValue(mockBuilder);
  mockUpdate.mockResolvedValue({ data: [{}], error: null });
  mockDelete.mockResolvedValue({ data: [], error: null });
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
  // Restore builder chaining after clearAllMocks
  mockSelect.mockReturnValue(mockBuilder);
  mockEq.mockReturnValue(mockBuilder);
  // Restore maybeSingle (same terminal mock as single)
  mockBuilder.maybeSingle = mockSingle;
});

// ── listRoutines ─────────────────────────────────────────────────────────────

test('listRoutines queries the routines table ordered by position', async () => {
  mockOrder.mockResolvedValue({ data: [{ id: 'r1', name: 'Push' }], error: null });
  const result = await listRoutines();
  expect(mockFrom).toHaveBeenCalledWith('routines');
  expect(mockOrder).toHaveBeenCalledWith('position', { ascending: true });
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ id: 'r1', name: 'Push' });
});

test('listRoutines returns empty array when no routines exist', async () => {
  mockOrder.mockResolvedValue({ data: [], error: null });
  const result = await listRoutines();
  expect(result).toEqual([]);
});

test('listRoutines throws when supabase returns an error', async () => {
  mockOrder.mockResolvedValue({ data: null, error: { message: 'DB error' } });
  await expect(listRoutines()).rejects.toThrow('DB error');
});

// ── getRoutine ───────────────────────────────────────────────────────────────

test('getRoutine returns null on error', async () => {
  mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });
  const result = await getRoutine('nonexistent-id');
  expect(result).toBeNull();
});

test('getRoutine queries with the correct id and selects routine_exercises nested', async () => {
  mockSingle.mockResolvedValue({
    data: { id: 'r1', name: 'Push', routine_exercises: [] },
    error: null,
  });
  await getRoutine('r1');
  expect(mockFrom).toHaveBeenCalledWith('routines');
  expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('routine_exercises'));
  expect(mockEq).toHaveBeenCalledWith('id', 'r1');
});

// ── createRoutine ────────────────────────────────────────────────────────────

test('createRoutine inserts with user_id from getUser', async () => {
  mockSingle.mockResolvedValue({
    data: { id: 'r-new', name: 'Legs', user_id: 'user-123' },
    error: null,
  });
  const routine = await createRoutine({ name: 'Legs' });
  expect(mockGetUser).toHaveBeenCalled();
  expect(mockInsert).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ name: 'Legs', user_id: 'user-123' }),
    ])
  );
  expect(routine).toMatchObject({ name: 'Legs' });
});

test('createRoutine throws if no authenticated user', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(createRoutine({ name: 'Test' })).rejects.toThrow();
});

test('createRoutine includes program_id when programId is provided', async () => {
  mockSingle.mockResolvedValue({
    data: { id: 'r-new', name: 'Pull', program_id: 'prog-1', user_id: 'user-123' },
    error: null,
  });
  await createRoutine({ name: 'Pull', programId: 'prog-1' });
  expect(mockInsert).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ program_id: 'prog-1' }),
    ])
  );
});

// ── updateRoutine ────────────────────────────────────────────────────────────

test('updateRoutine updates the routines table', async () => {
  const mockUpdateEq = jest.fn().mockResolvedValue({ data: [{}], error: null });
  mockUpdate.mockReturnValue({ ...mockBuilder, eq: mockUpdateEq });
  await updateRoutine('r1', { name: 'Updated Push' });
  expect(mockFrom).toHaveBeenCalledWith('routines');
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated Push' }));
  expect(mockUpdateEq).toHaveBeenCalledWith('id', 'r1');
});

// ── deleteRoutine ────────────────────────────────────────────────────────────

test('deleteRoutine deletes from routines by id', async () => {
  const mockDeleteEq = jest.fn().mockResolvedValue({ data: [], error: null });
  mockDelete.mockReturnValue({ ...mockBuilder, eq: mockDeleteEq });
  await deleteRoutine('r1');
  expect(mockFrom).toHaveBeenCalledWith('routines');
  expect(mockDelete).toHaveBeenCalled();
  expect(mockDeleteEq).toHaveBeenCalledWith('id', 'r1');
});

// ── addRoutineExercise ───────────────────────────────────────────────────────

test('addRoutineExercise inserts into routine_exercises with user_id and targets', async () => {
  mockSingle.mockResolvedValue({
    data: { id: 're-1', routine_id: 'r1', exercise_id: 'ex-1', target_sets: 3, user_id: 'user-123' },
    error: null,
  });
  const result = await addRoutineExercise('r1', 'ex-1', { target_sets: 3, target_reps: '8-10' });
  expect(mockFrom).toHaveBeenCalledWith('routine_exercises');
  expect(mockInsert).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({
        routine_id: 'r1',
        exercise_id: 'ex-1',
        target_sets: 3,
        target_reps: '8-10',
        user_id: 'user-123',
      }),
    ])
  );
  expect(result).toMatchObject({ id: 're-1' });
});

test('addRoutineExercise throws if no authenticated user', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(addRoutineExercise('r1', 'ex-1', {})).rejects.toThrow();
});

// ── updateRoutineExercise ────────────────────────────────────────────────────

test('updateRoutineExercise updates the row by id', async () => {
  const mockUpdateEq = jest.fn().mockResolvedValue({ data: [{}], error: null });
  mockUpdate.mockReturnValue({ ...mockBuilder, eq: mockUpdateEq });
  await updateRoutineExercise('re-1', { target_sets: 4 });
  expect(mockFrom).toHaveBeenCalledWith('routine_exercises');
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ target_sets: 4 }));
  expect(mockUpdateEq).toHaveBeenCalledWith('id', 're-1');
});

// ── removeRoutineExercise ────────────────────────────────────────────────────

test('removeRoutineExercise deletes the row by id', async () => {
  const mockDeleteEq = jest.fn().mockResolvedValue({ data: [], error: null });
  mockDelete.mockReturnValue({ ...mockBuilder, eq: mockDeleteEq });
  await removeRoutineExercise('re-1');
  expect(mockFrom).toHaveBeenCalledWith('routine_exercises');
  expect(mockDelete).toHaveBeenCalled();
  expect(mockDeleteEq).toHaveBeenCalledWith('id', 're-1');
});

// ── reorderRoutineExercises ──────────────────────────────────────────────────

test('reorderRoutineExercises updates each id with its index as position', async () => {
  const mockUpdateEq = jest.fn().mockResolvedValue({ data: [{}], error: null });
  mockUpdate.mockReturnValue({ ...mockBuilder, eq: mockUpdateEq });

  await reorderRoutineExercises('r1', ['id-a', 'id-b', 'id-c']);

  expect(mockUpdate).toHaveBeenCalledTimes(3);
  expect(mockUpdate).toHaveBeenNthCalledWith(1, { position: 0 });
  expect(mockUpdate).toHaveBeenNthCalledWith(2, { position: 1 });
  expect(mockUpdate).toHaveBeenNthCalledWith(3, { position: 2 });

  expect(mockUpdateEq).toHaveBeenCalledWith('id', 'id-a');
  expect(mockUpdateEq).toHaveBeenCalledWith('id', 'id-b');
  expect(mockUpdateEq).toHaveBeenCalledWith('id', 'id-c');
});

test('reorderRoutineExercises does nothing for empty array', async () => {
  await reorderRoutineExercises('r1', []);
  expect(mockUpdate).not.toHaveBeenCalled();
});

// ── getActiveProgram ─────────────────────────────────────────────────────────

test('getActiveProgram queries programs filtered by status=active', async () => {
  mockSingle.mockResolvedValue({ data: { id: 'prog-1', name: 'Strength', status: 'active' }, error: null });
  const result = await getActiveProgram();
  expect(mockFrom).toHaveBeenCalledWith('programs');
  expect(mockEq).toHaveBeenCalledWith('status', 'active');
  expect(result).toMatchObject({ id: 'prog-1', status: 'active' });
});

test('getActiveProgram returns null when no active program (0 rows)', async () => {
  mockSingle.mockResolvedValue({ data: null, error: null });
  const result = await getActiveProgram();
  expect(result).toBeNull();
});

test('getActiveProgram returns null on DB error', async () => {
  mockSingle.mockResolvedValue({ data: null, error: { message: 'db error' } });
  const result = await getActiveProgram();
  expect(result).toBeNull();
});

// ── createProgram ────────────────────────────────────────────────────────────

test('createProgram inserts with user_id and status:active by default', async () => {
  mockSingle.mockResolvedValue({
    data: { id: 'prog-new', name: 'Hypertrophy', user_id: 'user-123', status: 'active' },
    error: null,
  });
  const prog = await createProgram({ name: 'Hypertrophy' });
  expect(mockFrom).toHaveBeenCalledWith('programs');
  expect(mockInsert).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ name: 'Hypertrophy', user_id: 'user-123', status: 'active' }),
    ])
  );
  expect(prog).toMatchObject({ id: 'prog-new', status: 'active' });
});

test('createProgram throws if no authenticated user', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(createProgram({ name: 'Test' })).rejects.toThrow();
});

// ── setProgramDay ────────────────────────────────────────────────────────────

test('setProgramDay upserts on (program_id, weekday) with user_id', async () => {
  mockUpsert.mockResolvedValue({ data: [{}], error: null });
  await setProgramDay('prog-1', 1, 'r1');
  expect(mockFrom).toHaveBeenCalledWith('program_days');
  expect(mockUpsert).toHaveBeenCalledWith(
    expect.objectContaining({
      program_id: 'prog-1',
      weekday: 1,
      routine_id: 'r1',
      user_id: 'user-123',
    }),
    expect.objectContaining({ onConflict: expect.stringContaining('program_id') })
  );
});

// ── listProgramDays ──────────────────────────────────────────────────────────

test('listProgramDays queries program_days for the given program ordered by weekday', async () => {
  mockOrder.mockResolvedValue({ data: [{ id: 'd1', weekday: 1 }], error: null });
  const days = await listProgramDays('prog-1');
  expect(mockFrom).toHaveBeenCalledWith('program_days');
  expect(mockEq).toHaveBeenCalledWith('program_id', 'prog-1');
  expect(days).toHaveLength(1);
});
