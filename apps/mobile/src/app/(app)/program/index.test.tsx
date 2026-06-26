// jest hoisting: mock-prefixed vars are safe to reference before imports.

// ── Mock data ─────────────────────────────────────────────────────────────────

const mockProgram = {
  id: 'prog-1',
  user_id: 'user-123',
  name: 'Hipertrofia · Bloque 1',
  status: 'active' as const,
  goal: 'Fuerza',
  period_weeks: 8,
  start_date: null,
  created_at: '2026-06-01T00:00:00.000Z',
};

const mockRoutines = [
  {
    id: 'routine-1',
    user_id: 'user-123',
    program_id: 'prog-1',
    name: 'Push Day',
    position: 0,
    created_at: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'routine-2',
    user_id: 'user-123',
    program_id: 'prog-1',
    name: 'Pull Day',
    position: 1,
    created_at: '2026-06-01T00:01:00.000Z',
  },
];

const mockNewSession = {
  id: 'sess-new-1',
  user_id: 'user-123',
  routine_id: 'routine-1',
  source: 'manual',
  status: 'in_progress',
  started_at: '2026-06-26T12:00:00.000Z',
  completed_at: null,
  created_at: '2026-06-26T12:00:00.000Z',
};

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('../../../lib/routines', () => ({
  __esModule: true,
  getActiveProgram: jest.fn(async () => mockProgram),
  listRoutines: jest.fn(async () => mockRoutines),
}));

jest.mock('../../../lib/sessions', () => ({
  __esModule: true,
  startSession: jest.fn(async () => mockNewSession),
}));

// expo-haptics stub.
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success' },
}));

// expo-router stubs.
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: jest.fn() }),
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

import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ProgramScreen from './index';

beforeEach(() => {
  jest.clearAllMocks();
  const { getActiveProgram, listRoutines } = require('../../../lib/routines');
  getActiveProgram.mockResolvedValue(mockProgram);
  listRoutines.mockResolvedValue(mockRoutines);
  const { startSession } = require('../../../lib/sessions');
  startSession.mockResolvedValue(mockNewSession);
});

test('muestra el nombre del programa activo', async () => {
  await render(<ProgramScreen />);

  await waitFor(() => {
    const matches = screen.getAllByText('Hipertrofia · Bloque 1');
    expect(matches.length).toBeGreaterThan(0);
  });
});

test('muestra las rutinas del programa', async () => {
  await render(<ProgramScreen />);

  await waitFor(() => expect(screen.getByText('Push Day')).toBeOnTheScreen());
  expect(screen.getByText('Pull Day')).toBeOnTheScreen();
});

test('listRoutines se llama con programId del programa activo', async () => {
  const { listRoutines } = require('../../../lib/routines');
  await render(<ProgramScreen />);

  await waitFor(() => expect(screen.getByText('Push Day')).toBeOnTheScreen());

  expect(listRoutines).toHaveBeenCalledWith({ programId: 'prog-1' });
});

test('tap en "Empezar" llama a startSession con el routineId correcto', async () => {
  const { startSession } = require('../../../lib/sessions');
  await render(<ProgramScreen />);

  await waitFor(() => expect(screen.getByText('Push Day')).toBeOnTheScreen());

  fireEvent.press(screen.getByLabelText('Empezar rutina Push Day'));

  await waitFor(() =>
    expect(startSession).toHaveBeenCalledWith('routine-1')
  );
});

test('startSession exitoso navega a la sesión creada', async () => {
  await render(<ProgramScreen />);

  await waitFor(() => expect(screen.getByText('Push Day')).toBeOnTheScreen());

  fireEvent.press(screen.getByLabelText('Empezar rutina Push Day'));

  await waitFor(() =>
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('sess-new-1')
    )
  );
});

test('startSession con error muestra Alert y no navega', async () => {
  const { startSession } = require('../../../lib/sessions');
  startSession.mockRejectedValueOnce(new Error('DB error'));
  const alertSpy = jest.spyOn(Alert, 'alert');

  await render(<ProgramScreen />);

  await waitFor(() => expect(screen.getByText('Push Day')).toBeOnTheScreen());

  fireEvent.press(screen.getByLabelText('Empezar rutina Push Day'));

  await waitFor(() => expect(alertSpy).toHaveBeenCalled());
  expect(mockReplace).not.toHaveBeenCalled();
});

test('tap en una rutina abre el editor de rutina', async () => {
  await render(<ProgramScreen />);

  await waitFor(() => expect(screen.getByText('Push Day')).toBeOnTheScreen());

  fireEvent.press(screen.getByLabelText('Ver rutina Push Day'));

  expect(mockPush).toHaveBeenCalledWith(
    expect.stringContaining('routine-1')
  );
});

test('renderiza estado vacío cuando no hay programa activo', async () => {
  const { getActiveProgram } = require('../../../lib/routines');
  getActiveProgram.mockResolvedValueOnce(null);

  await render(<ProgramScreen />);

  await waitFor(() =>
    expect(screen.getByText('Aún no tienes rutinas')).toBeOnTheScreen()
  );
  expect(screen.getByText('Gestionar rutinas')).toBeOnTheScreen();
});

test('renderiza estado vacío cuando el programa no tiene rutinas', async () => {
  const { listRoutines } = require('../../../lib/routines');
  listRoutines.mockResolvedValueOnce([]);

  await render(<ProgramScreen />);

  await waitFor(() =>
    expect(screen.getByText('Aún no tienes rutinas')).toBeOnTheScreen()
  );
});

test('tap en "Gestionar rutinas" navega a la pantalla de rutinas', async () => {
  const { getActiveProgram } = require('../../../lib/routines');
  getActiveProgram.mockResolvedValueOnce(null);

  await render(<ProgramScreen />);

  await waitFor(() =>
    expect(screen.getByText('Gestionar rutinas')).toBeOnTheScreen()
  );

  fireEvent.press(screen.getByText('Gestionar rutinas'));

  expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('routines'));
});
