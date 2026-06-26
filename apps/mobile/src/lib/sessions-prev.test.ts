// jest hoisting: mock-prefixed vars are safe to reference before imports

// ── auth mock (getUser) ──────────────────────────────────────────────────────
const mockGetUser = jest.fn().mockResolvedValue({
  data: { user: { id: 'user-123' } },
  error: null,
});

// ── chainable query builder ──────────────────────────────────────────────────
const mockOrder = jest.fn(() => mockBuilder);
const mockEq = jest.fn(() => mockBuilder);
const mockIn = jest.fn(() => mockBuilder);
const mockSelect = jest.fn(() => mockBuilder);

// Resolution holder: tests set this before calling the fn
let mockBuilderResolution: { data: any; error: any } = { data: [], error: null };

const mockBuilder: any = {};
Object.assign(mockBuilder, {
  select: mockSelect,
  eq: mockEq,
  in: mockIn,
  order: mockOrder,
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

import { getLastPerformedByExercise } from './sessions';

beforeEach(() => {
  jest.clearAllMocks();
  mockBuilderResolution = { data: [], error: null };
  // Restore chaining
  mockSelect.mockReturnValue(mockBuilder);
  mockEq.mockReturnValue(mockBuilder);
  mockIn.mockReturnValue(mockBuilder);
  mockOrder.mockReturnValue(mockBuilder);
  Object.assign(mockBuilder, {
    select: mockSelect,
    eq: mockEq,
    in: mockIn,
    order: mockOrder,
    then: (resolve: (v: any) => void, _reject?: (e: any) => void) => {
      Promise.resolve(mockBuilderResolution).then(resolve, _reject);
    },
  });
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
});

// ── empty inputs ─────────────────────────────────────────────────────────────

test('returns {} when no exerciseIds provided', async () => {
  const result = await getLastPerformedByExercise([]);
  expect(result).toEqual({});
  expect(mockFrom).not.toHaveBeenCalled();
});

// ── DB error ─────────────────────────────────────────────────────────────────

test('returns {} when DB returns an error', async () => {
  mockBuilderResolution = { data: null, error: { message: 'DB error' } };
  const result = await getLastPerformedByExercise(['ex-A']);
  expect(result).toEqual({});
});

test('returns {} when user is not authenticated', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  const result = await getLastPerformedByExercise(['ex-A']);
  expect(result).toEqual({});
});

// ── basic mapping ─────────────────────────────────────────────────────────────

test('maps rows to exercise_id → set_number → values correctly', async () => {
  mockBuilderResolution = {
    data: [
      {
        exercise_id: 'ex-A',
        set_number: 1,
        weight_kg: 80,
        reps: 8,
        rir: 2,
        sessions: { status: 'completed', completed_at: '2026-06-24T10:00:00Z', user_id: 'user-123' },
      },
      {
        exercise_id: 'ex-A',
        set_number: 2,
        weight_kg: 80,
        reps: 7,
        rir: 3,
        sessions: { status: 'completed', completed_at: '2026-06-24T10:00:00Z', user_id: 'user-123' },
      },
    ],
    error: null,
  };

  const result = await getLastPerformedByExercise(['ex-A']);

  expect(result['ex-A']).toBeDefined();
  expect(result['ex-A'][1]).toEqual({ weight_kg: 80, reps: 8, rir: 2 });
  expect(result['ex-A'][2]).toEqual({ weight_kg: 80, reps: 7, rir: 3 });
});

// ── only latest session per exercise ─────────────────────────────────────────

test('keeps only the most recent completed session per exercise (rows ordered newest first)', async () => {
  // DB returns newest first (rows already ordered by completed_at desc).
  // ex-A: newer session 2026-06-24, older 2026-06-20 → only 2026-06-24 kept.
  mockBuilderResolution = {
    data: [
      // Newest session for ex-A (set 1 from 2026-06-24)
      {
        exercise_id: 'ex-A',
        set_number: 1,
        weight_kg: 85,
        reps: 8,
        rir: 2,
        sessions: { completed_at: '2026-06-24T10:00:00Z', user_id: 'user-123' },
      },
      // Older session for ex-A (should be ignored)
      {
        exercise_id: 'ex-A',
        set_number: 1,
        weight_kg: 80,
        reps: 10,
        rir: 1,
        sessions: { completed_at: '2026-06-20T10:00:00Z', user_id: 'user-123' },
      },
    ],
    error: null,
  };

  const result = await getLastPerformedByExercise(['ex-A']);

  expect(result['ex-A'][1]).toEqual({ weight_kg: 85, reps: 8, rir: 2 });
  // Only one set_number key — the old session row was skipped
  expect(Object.keys(result['ex-A'])).toHaveLength(1);
});

// ── multiple exercises ───────────────────────────────────────────────────────

test('handles multiple exercises independently', async () => {
  mockBuilderResolution = {
    data: [
      {
        exercise_id: 'ex-A',
        set_number: 1,
        weight_kg: 100,
        reps: 5,
        rir: 1,
        sessions: { completed_at: '2026-06-24T10:00:00Z', user_id: 'user-123' },
      },
      {
        exercise_id: 'ex-B',
        set_number: 1,
        weight_kg: 60,
        reps: 12,
        rir: 3,
        sessions: { completed_at: '2026-06-23T10:00:00Z', user_id: 'user-123' },
      },
    ],
    error: null,
  };

  const result = await getLastPerformedByExercise(['ex-A', 'ex-B']);

  expect(result['ex-A'][1]).toEqual({ weight_kg: 100, reps: 5, rir: 1 });
  expect(result['ex-B'][1]).toEqual({ weight_kg: 60, reps: 12, rir: 3 });
});

// ── exercise with no history ─────────────────────────────────────────────────

test('returns {} for exercises with no prior completed sessions', async () => {
  // DB returns empty for ex-B because it was never completed
  mockBuilderResolution = {
    data: [
      {
        exercise_id: 'ex-A',
        set_number: 1,
        weight_kg: 75,
        reps: 10,
        rir: 2,
        sessions: { completed_at: '2026-06-22T10:00:00Z', user_id: 'user-123' },
      },
    ],
    error: null,
  };

  const result = await getLastPerformedByExercise(['ex-A', 'ex-B']);

  expect(result['ex-A']).toBeDefined();
  // ex-B has no rows → not present in result (or empty)
  expect(result['ex-B']).toBeUndefined();
});

// ── null values ───────────────────────────────────────────────────────────────

test('maps null weight/reps/rir correctly', async () => {
  mockBuilderResolution = {
    data: [
      {
        exercise_id: 'ex-A',
        set_number: 1,
        weight_kg: null,
        reps: null,
        rir: null,
        sessions: { completed_at: '2026-06-24T10:00:00Z', user_id: 'user-123' },
      },
    ],
    error: null,
  };

  const result = await getLastPerformedByExercise(['ex-A']);
  expect(result['ex-A'][1]).toEqual({ weight_kg: null, reps: null, rir: null });
});

// ── query shape ───────────────────────────────────────────────────────────────

test('queries the sets table and filters by status=completed and user_id', async () => {
  mockBuilderResolution = { data: [], error: null };

  await getLastPerformedByExercise(['ex-A', 'ex-B']);

  expect(mockFrom).toHaveBeenCalledWith('sets');
  expect(mockIn).toHaveBeenCalledWith('exercise_id', ['ex-A', 'ex-B']);
  expect(mockEq).toHaveBeenCalledWith('sessions.status', 'completed');
  expect(mockEq).toHaveBeenCalledWith('sessions.user_id', 'user-123');
});
