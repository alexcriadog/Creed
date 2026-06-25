import { render, screen, fireEvent } from '@testing-library/react-native';
import { Chip } from '../Chip';

test('renderiza el label', async () => {
  await render(<Chip label="Pecho" />);
  expect(screen.getByText('Pecho')).toBeTruthy();
});

test('toggle: llama onPress con true cuando estaba inactivo', async () => {
  const onPress = jest.fn();
  await render(<Chip label="Espalda" selected={false} onPress={onPress} />);
  fireEvent.press(screen.getByTestId('chip'));
  expect(onPress).toHaveBeenCalledWith(true);
});

test('toggle: llama onPress con false cuando estaba activo', async () => {
  const onPress = jest.fn();
  await render(<Chip label="Piernas" selected={true} onPress={onPress} />);
  fireEvent.press(screen.getByTestId('chip'));
  expect(onPress).toHaveBeenCalledWith(false);
});

test('no llama onPress si no se pasa callback', async () => {
  // No debe lanzar si onPress es undefined
  await render(<Chip label="Hombros" />);
  fireEvent.press(screen.getByTestId('chip'));
});
