const listeners: Array<(e: string, s: unknown) => void> = [];
jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
        listeners.push(cb);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      },
    },
  },
}));

import { render, screen, waitFor, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AuthProvider, useAuth } from './auth-context';

function Probe() {
  const { session, loading } = useAuth();
  if (loading) return <Text>loading</Text>;
  return <Text>{session ? 'in' : 'out'}</Text>;
}

test('arranca en loading y resuelve a out sin sesión', async () => {
  await render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('out')).toBeOnTheScreen());
});

test('pasa a in cuando llega una sesión por onAuthStateChange', async () => {
  await render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('out')).toBeOnTheScreen());
  await act(async () => {
    listeners.forEach((cb) => cb('SIGNED_IN', { user: { id: 'u1' } }));
  });
  await waitFor(() => expect(screen.getByText('in')).toBeOnTheScreen());
});
