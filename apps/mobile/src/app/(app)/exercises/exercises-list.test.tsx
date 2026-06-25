jest.mock('../../../lib/exercises', () => ({
  __esModule: true,
  displayName: (e: any) => e.name_es ?? e.name_en,
  listExercises: jest.fn().mockResolvedValue([
    { id: '1', name_en: 'Bench Press', name_es: null, primary_muscle: 'chest', equipment: 'barbell', image_url: null, instructions: [] },
    { id: '2', name_en: 'Squat', name_es: null, primary_muscle: 'quads', equipment: 'barbell', image_url: null, instructions: [] },
  ]),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
// Stub safe-area-context so Header can render without a SafeAreaProvider wrapper.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
}));


import { render, screen, waitFor } from '@testing-library/react-native';
import ExercisesScreen from './index';

test('renderiza los ejercicios devueltos por listExercises', async () => {
  await render(<ExercisesScreen />);
  await waitFor(() => expect(screen.getByText('Bench Press')).toBeOnTheScreen());
  expect(screen.getByText('Squat')).toBeOnTheScreen();
});
