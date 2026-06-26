// jest hoisting: mock-prefixed vars are safe to reference before imports.

// ── Mocked SessionWithSets ───────────────────────────────────────────────────
const mockSession = {
  id: 'sess-1',
  user_id: 'user-123',
  routine_id: 'routine-1',
  source: 'manual',
  status: 'in_progress',
  started_at: '2026-06-25T10:00:00.000Z',
  completed_at: null,
  created_at: '2026-06-25T10:00:00.000Z',
  sets: [
    {
      id: 'set-a1',
      session_id: 'sess-1',
      user_id: 'user-123',
      exercise_id: 'ex-A',
      routine_exercise_id: 're-1',
      set_number: 1,
      reps: 10,
      weight_kg: 80,
      rir: 2,
      rpe: null,
      is_warmup: false,
      completed: false,
      performed_at: null,
      created_at: '2026-06-25T10:00:00.000Z',
      name_en: 'Bench Press',
      name_es: null,
      image_url: null,
      primary_muscle: 'chest',
    },
    {
      id: 'set-a2',
      session_id: 'sess-1',
      user_id: 'user-123',
      exercise_id: 'ex-A',
      routine_exercise_id: 're-1',
      set_number: 2,
      reps: null,
      weight_kg: null,
      rir: null,
      rpe: null,
      is_warmup: false,
      completed: false,
      performed_at: null,
      created_at: '2026-06-25T10:00:00.000Z',
      name_en: 'Bench Press',
      name_es: null,
      image_url: null,
      primary_muscle: 'chest',
    },
    {
      id: 'set-b1',
      session_id: 'sess-1',
      user_id: 'user-123',
      exercise_id: 'ex-B',
      routine_exercise_id: 're-2',
      set_number: 1,
      reps: null,
      weight_kg: null,
      rir: null,
      rpe: null,
      is_warmup: false,
      completed: true,
      performed_at: '2026-06-25T10:05:00.000Z',
      name_en: 'Overhead Press',
      name_es: null,
      image_url: null,
      primary_muscle: 'shoulders',
    },
  ],
};

const mockRoutine = {
  id: 'routine-1',
  name: 'Push Day',
  exercises: [
    { exercise_id: 'ex-A', target_sets: 3, target_reps: '8-10', target_rir: 2 },
    { exercise_id: 'ex-B', target_sets: 2, target_reps: '10-12', target_rir: 1 },
  ],
};

jest.mock('../../../lib/sessions', () => ({
  __esModule: true,
  getSession: jest.fn(async () => mockSession),
  updateSet: jest.fn().mockResolvedValue(undefined),
  addSet: jest.fn(),
  completeSession: jest.fn().mockResolvedValue(undefined),
  getLastPerformedByExercise: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../lib/routines', () => ({
  __esModule: true,
  getRoutine: jest.fn(async () => mockRoutine),
}));

jest.mock('../../../lib/exercises', () => ({
  __esModule: true,
  displayName: (e: any) => e.name_es ?? e.name_en,
}));

// expo-router: id param + router stub.
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'sess-1' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

// safe-area stub so Header renders without a provider.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
}));

import { Alert } from 'react-native';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { completeSession } from '../../../lib/sessions';
import LiveSession from './[id]';

test('sesión dark atlético: ejercicio en foco, series, cronómetro y progreso', async () => {
  await render(<LiveSession />);

  // El primer ejercicio (foco) y su nombre. El pager renderiza todas las
  // páginas en JSDOM, así que el resto de ejercicios también está presente.
  await waitFor(() =>
    expect(screen.getByText('Bench Press')).toBeOnTheScreen()
  );
  expect(screen.getByText('Overhead Press')).toBeOnTheScreen();

  // Cabecera: posición del ejercicio (eyebrow) + nombre de la rutina.
  expect(screen.getByText('Ejercicio 1 / 2')).toBeOnTheScreen();
  expect(screen.getByText('Push Day')).toBeOnTheScreen();

  // Filas de serie del primer ejercicio (inputs por testID de set).
  expect(screen.getByTestId('weight-set-a1')).toBeOnTheScreen();
  expect(screen.getByTestId('reps-set-a1')).toBeOnTheScreen();
  expect(screen.getByTestId('weight-set-a2')).toBeOnTheScreen();
  expect(screen.getByTestId('weight-set-b1')).toBeOnTheScreen();

  // Valores precargados del set 1 de Bench.
  expect(screen.getByDisplayValue('80')).toBeOnTheScreen();
  expect(screen.getByDisplayValue('10')).toBeOnTheScreen();

  // Check toggle por serie.
  expect(screen.getByTestId('check-set-a1')).toBeOnTheScreen();

  // Cronómetro horizontal (mm:ss en una sola línea) — formato presente.
  expect(screen.getByText(/^\d{1,2}:\d{2}(:\d{2})?$/)).toBeOnTheScreen();

  // Progreso global: 1 de 3 series marcadas (set-b1 completada en el mock).
  // Ahora el recuento se compone de stats tabulares separados; "/ 3" + "series"
  // son únicos (el "1" suelto colisiona con los números de serie).
  expect(screen.getByText('/ 3')).toBeOnTheScreen();
  expect(screen.getByText('series')).toBeOnTheScreen();

  // El swipe-to-finish reemplaza al botón plano (role=button + label).
  expect(
    screen.getByRole('button', { name: 'Desliza para finalizar' })
  ).toBeOnTheScreen();
});

test('finalizar pasa por el guard de series sin marcar (no completa directo)', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  await render(<LiveSession />);
  await waitFor(() =>
    expect(screen.getByText('Bench Press')).toBeOnTheScreen()
  );

  // El fallback accesible del SwipeToFinish dispara handleFinish.
  fireEvent.press(
    screen.getByRole('button', { name: 'Desliza para finalizar' })
  );

  // Con 1/3 series marcadas, el guard muestra confirmación y NO completa aún.
  expect(alertSpy).toHaveBeenCalledWith(
    'Finalizar entreno',
    expect.stringContaining('sin marcar'),
    expect.any(Array)
  );
  expect(completeSession).not.toHaveBeenCalled();

  alertSpy.mockRestore();
});
