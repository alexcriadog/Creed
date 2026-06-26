// jest hoisting: mock-prefixed vars are safe to reference before imports.

// ── Mocked routines ──────────────────────────────────────────────────────────
const mockRoutines = [
  {
    id: 'routine-1',
    user_id: 'user-123',
    program_id: null,
    name: 'Push Day',
    position: 0,
    created_at: '2026-06-26T10:00:00.000Z',
  },
  {
    id: 'routine-2',
    user_id: 'user-123',
    program_id: null,
    name: 'Pull Day',
    position: 1,
    created_at: '2026-06-26T10:01:00.000Z',
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

jest.mock('../../lib/routines', () => ({
  __esModule: true,
  listRoutines: jest.fn(async () => mockRoutines),
}));

jest.mock('../../lib/sessions', () => ({
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
import StartScreen from './start';

beforeEach(() => {
  jest.clearAllMocks();
  const { listRoutines } = require('../../lib/routines');
  listRoutines.mockResolvedValue(mockRoutines);
  const { startSession } = require('../../lib/sessions');
  startSession.mockResolvedValue(mockNewSession);
});

test('muestra las rutinas disponibles', async () => {
  await render(<StartScreen />);

  await waitFor(() =>
    expect(screen.getByText('Push Day')).toBeOnTheScreen()
  );
  expect(screen.getByText('Pull Day')).toBeOnTheScreen();
});

test('tap en una rutina llama a startSession con su id', async () => {
  const { startSession } = require('../../lib/sessions');
  await render(<StartScreen />);

  await waitFor(() => expect(screen.getByText('Push Day')).toBeOnTheScreen());

  fireEvent.press(screen.getByText('Push Day'));

  await waitFor(() =>
    expect(startSession).toHaveBeenCalledWith('routine-1')
  );
});

test('startSession exitoso navega a la sesión creada', async () => {
  await render(<StartScreen />);

  await waitFor(() => expect(screen.getByText('Push Day')).toBeOnTheScreen());

  fireEvent.press(screen.getByText('Push Day'));

  await waitFor(() =>
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('sess-new-1')
    )
  );
});

test('startSession con error muestra Alert y no navega', async () => {
  const { startSession } = require('../../lib/sessions');
  startSession.mockRejectedValueOnce(new Error('DB error'));
  const alertSpy = jest.spyOn(Alert, 'alert');

  await render(<StartScreen />);

  await waitFor(() => expect(screen.getByText('Push Day')).toBeOnTheScreen());

  fireEvent.press(screen.getByText('Push Day'));

  await waitFor(() => expect(alertSpy).toHaveBeenCalled());
  expect(mockReplace).not.toHaveBeenCalled();
});

test('renderiza estado vacío cuando no hay rutinas', async () => {
  const { listRoutines } = require('../../lib/routines');
  listRoutines.mockResolvedValueOnce([]);

  await render(<StartScreen />);

  await waitFor(() =>
    expect(screen.getByText('Aún no tienes rutinas')).toBeOnTheScreen()
  );
  expect(screen.getByText('Crear rutina')).toBeOnTheScreen();
});

test('tap en "Crear rutina" navega a la pantalla de rutinas', async () => {
  const { listRoutines } = require('../../lib/routines');
  listRoutines.mockResolvedValueOnce([]);

  await render(<StartScreen />);

  await waitFor(() => expect(screen.getByText('Crear rutina')).toBeOnTheScreen());

  fireEvent.press(screen.getByText('Crear rutina'));

  expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('routines'));
});
