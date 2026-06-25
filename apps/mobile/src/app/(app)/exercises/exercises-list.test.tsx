jest.mock('../../../lib/exercises', () => ({
  __esModule: true,
  displayName: (e: any) => e.name_es ?? e.name_en,
  listExercises: jest.fn().mockResolvedValue([
    { id: '1', name_en: 'Bench Press', name_es: null, primary_muscle: 'chest', equipment: 'barbell', image_url: null, instructions: [] },
    { id: '2', name_en: 'Squat', name_es: null, primary_muscle: 'quads', equipment: 'barbell', image_url: null, instructions: [] },
  ]),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

import { render, screen, waitFor } from '@testing-library/react-native';
import ExercisesScreen from './index';

test('renderiza los ejercicios devueltos por listExercises', async () => {
  await render(<ExercisesScreen />);
  await waitFor(() => expect(screen.getByText('Bench Press')).toBeOnTheScreen());
  expect(screen.getByText('Squat')).toBeOnTheScreen();
});
