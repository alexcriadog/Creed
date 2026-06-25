// jest hoisting: mock-prefixed vars are safe to reference before imports.

// ── Mocked session list ──────────────────────────────────────────────────────
const mockSessions = [
  {
    id: 'sess-completed-1',
    user_id: 'user-123',
    routine_id: 'routine-1',
    source: 'manual',
    status: 'completed',
    started_at: '2026-06-25T10:00:00.000Z',
    completed_at: '2026-06-25T11:00:00.000Z',
    created_at: '2026-06-25T10:00:00.000Z',
    routine_name: 'Push Day',
    set_count: 6,
  },
  {
    id: 'sess-inprogress-1',
    user_id: 'user-123',
    routine_id: 'routine-2',
    source: 'manual',
    status: 'in_progress',
    started_at: '2026-06-25T12:00:00.000Z',
    completed_at: null,
    created_at: '2026-06-25T12:00:00.000Z',
    routine_name: 'Pull Day',
    set_count: 3,
  },
];

jest.mock('../../../lib/sessions', () => ({
  __esModule: true,
  listSessions: jest.fn(async () => mockSessions),
}));

// expo-router stubs.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

// safe-area stub so Header renders without a provider.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
}));

import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import HistoryList from './index';

test('muestra las sesiones con nombre de rutina, nº de series y badge "En curso"', async () => {
  await render(<HistoryList />);

  // Espera a que se cargue la lista (listSessions es async).
  await waitFor(() =>
    expect(screen.getByText('Push Day')).toBeOnTheScreen()
  );

  // Primera sesión (completada).
  expect(screen.getByText('Push Day')).toBeOnTheScreen();
  expect(screen.getByText('6 series')).toBeOnTheScreen();

  // Segunda sesión (en curso) — badge visible.
  expect(screen.getByText('Pull Day')).toBeOnTheScreen();
  expect(screen.getByText('3 series')).toBeOnTheScreen();
  expect(screen.getByText('En curso')).toBeOnTheScreen();
});

test('renderiza el estado vacío cuando no hay sesiones', async () => {
  const { listSessions } = require('../../../lib/sessions');
  listSessions.mockResolvedValueOnce([]);

  await render(<HistoryList />);

  await waitFor(() =>
    expect(screen.getByText('Sin sesiones')).toBeOnTheScreen()
  );
  expect(
    screen.getByText('Completa tu primer entreno y aparecerá aquí.')
  ).toBeOnTheScreen();
});

test('tap en sesión completada navega al detalle', async () => {
  await render(<HistoryList />);

  await waitFor(() => expect(screen.getByText('Push Day')).toBeOnTheScreen());

  fireEvent.press(screen.getByText('Push Day'));

  expect(mockPush).toHaveBeenCalledWith(
    expect.stringContaining('history/sess-completed-1')
  );
});

test('tap en sesión en curso navega a session/[id]', async () => {
  await render(<HistoryList />);

  await waitFor(() => expect(screen.getByText('Pull Day')).toBeOnTheScreen());

  fireEvent.press(screen.getByText('Pull Day'));

  expect(mockPush).toHaveBeenCalledWith(
    expect.stringContaining('session/sess-inprogress-1')
  );
});
