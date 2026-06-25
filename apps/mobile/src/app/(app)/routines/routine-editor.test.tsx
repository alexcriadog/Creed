// jest hoisting: mock-prefixed vars are safe to reference before imports.

// ── Mock data layer ──────────────────────────────────────────────────────────
const mockRoutine = {
  id: 'r1',
  name: 'Push Day',
  position: 0,
  exercises: [
    {
      id: 're-1',
      exercise_id: 'ex-1',
      name_en: 'Bench Press',
      name_es: null,
      image_url: null,
      primary_muscle: 'chest',
      target_sets: 4,
      target_reps: 8,
      target_rir: 2,
      target_rpe: null,
      rest_seconds: 120,
      position: 0,
    },
    {
      id: 're-2',
      exercise_id: 'ex-2',
      name_en: 'Overhead Press',
      name_es: null,
      image_url: null,
      primary_muscle: 'shoulders',
      target_sets: 3,
      target_reps: 10,
      target_rir: 1,
      target_rpe: null,
      rest_seconds: 90,
      position: 1,
    },
  ],
};

jest.mock('../../../lib/routines', () => ({
  __esModule: true,
  getRoutine: jest.fn(async () => mockRoutine),
  createRoutine: jest.fn(),
  updateRoutine: jest.fn().mockResolvedValue(undefined),
  updateRoutineExercise: jest.fn().mockResolvedValue(undefined),
  removeRoutineExercise: jest.fn().mockResolvedValue(undefined),
  reorderRoutineExercises: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../lib/exercises', () => ({
  __esModule: true,
  displayName: (e: any) => e.name_es ?? e.name_en,
}));

// expo-router: id param + immediate focus effect.
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'r1' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
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
import RoutineEditor from './[id]';

test('el editor muestra los ejercicios de la rutina y sus targets', async () => {
  await render(<RoutineEditor />);

  // Nombres de ejercicios
  await waitFor(() => expect(screen.getByText('Bench Press')).toBeOnTheScreen());
  expect(screen.getByText('Overhead Press')).toBeOnTheScreen();

  // Valores de target renderizados por los NumberSteppers
  // Bench: 4 series · 8 reps · descanso 120s
  expect(screen.getByText('4')).toBeOnTheScreen();
  expect(screen.getByText('8')).toBeOnTheScreen();
  expect(screen.getByText('120s')).toBeOnTheScreen();
  // Overhead: descanso 90s
  expect(screen.getByText('90s')).toBeOnTheScreen();
});
