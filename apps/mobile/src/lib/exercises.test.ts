const mockOrder = jest.fn().mockResolvedValue({ data: [], error: null });
const mockLimit = jest.fn(() => ({ order: mockOrder }));
const mockBuilder: any = {};
const mockIlike = jest.fn(() => mockBuilder);
const mockEq = jest.fn(() => mockBuilder);
const mockSelect = jest.fn(() => mockBuilder);
Object.assign(mockBuilder, { select: mockSelect, ilike: mockIlike, eq: mockEq, limit: mockLimit, order: mockOrder });
const mockFrom = jest.fn(() => mockBuilder);

jest.mock('./supabase', () => ({ supabase: { from: (table: string) => (mockFrom as any)(table) } }));

import { listExercises, displayName } from './exercises';

beforeEach(() => jest.clearAllMocks());

test('displayName cae a name_en cuando name_es es null', () => {
  expect(displayName({ name_es: null, name_en: 'Bench Press' } as any)).toBe('Bench Press');
  expect(displayName({ name_es: 'Press banca', name_en: 'Bench Press' } as any)).toBe('Press banca');
});

test('listExercises sin filtros consulta exercises sin ilike/eq', async () => {
  await listExercises();
  expect(mockFrom).toHaveBeenCalledWith('exercises');
  expect(mockIlike).not.toHaveBeenCalled();
  expect(mockEq).not.toHaveBeenCalled();
});

test('listExercises aplica search (ilike) y filtros (eq) cuando se pasan', async () => {
  await listExercises({ search: 'press', muscle: 'chest', equipment: 'barbell' });
  expect(mockIlike).toHaveBeenCalledWith('name_en', '%press%');
  expect(mockEq).toHaveBeenCalledWith('primary_muscle', 'chest');
  expect(mockEq).toHaveBeenCalledWith('equipment', 'barbell');
});
