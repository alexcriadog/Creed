// jest hoisting: mock-prefixed vars are safe to reference before imports.

// ── Mock data layer ──────────────────────────────────────────────────────────
const mockProgram = {
  id: 'prog-1',
  user_id: 'u1',
  name: 'Hipertrofia · Bloque 1',
  is_active: true,
  created_at: '2026-06-25T10:00:00Z',
};

const mockRoutines = [
  {
    id: 'rt-push',
    user_id: 'u1',
    program_id: null,
    name: 'Push Day',
    position: 0,
    created_at: '2026-06-01T10:00:00Z',
  },
  {
    id: 'rt-pull',
    user_id: 'u1',
    program_id: null,
    name: 'Pull Day',
    position: 1,
    created_at: '2026-06-01T10:00:00Z',
  },
];

// Lunes (0) → Push Day; Miércoles (2) → Pull Day. El resto, descanso.
const mockProgramDays = [
  { id: 'pd-0', program_id: 'prog-1', user_id: 'u1', weekday: 0, routine_id: 'rt-push' },
  { id: 'pd-2', program_id: 'prog-1', user_id: 'u1', weekday: 2, routine_id: 'rt-pull' },
];

jest.mock('../../../lib/routines', () => ({
  __esModule: true,
  getActiveProgram: jest.fn(async () => mockProgram),
  listRoutines: jest.fn(async () => mockRoutines),
  listProgramDays: jest.fn(async () => mockProgramDays),
  createProgram: jest.fn(),
  setProgramDay: jest.fn().mockResolvedValue(undefined),
}));

// expo-router: immediate focus effect + stub navigation.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => () => void) => {
    const React = require('react');
    React.useEffect(() => cb(), []);
  },
}));

// safe-area stub so Header renders without a provider.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
}));

import { render, screen, waitFor } from '@testing-library/react-native';
import ProgramScreen from './index';

test('la vista de semana muestra los 7 días y la rutina asignada a cada uno', async () => {
  await render(<ProgramScreen />);

  // El programa activo aparece (hero).
  await waitFor(() =>
    expect(screen.getByText('Hipertrofia · Bloque 1')).toBeOnTheScreen()
  );

  // Los 7 días de la semana (Lun–Dom).
  for (const label of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) {
    expect(screen.getByText(label)).toBeOnTheScreen();
  }

  // Días asignados muestran el nombre de su rutina.
  expect(screen.getByText('Push Day')).toBeOnTheScreen();
  expect(screen.getByText('Pull Day')).toBeOnTheScreen();

  // Los días sin asignar se muestran como descanso (5 restantes).
  expect(screen.getAllByText('Descanso')).toHaveLength(5);
});
