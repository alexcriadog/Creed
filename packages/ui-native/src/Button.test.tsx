import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from './Button';

test('renderiza el label y dispara onPress al tocar', async () => {
  const onPress = jest.fn();
  await render(<Button label="Entrar" onPress={onPress} />);
  fireEvent.press(screen.getByText('Entrar'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('no dispara onPress si loading', async () => {
  const onPress = jest.fn();
  await render(<Button label="Entrar" onPress={onPress} loading />);
  fireEvent.press(screen.getByTestId('button'));
  expect(onPress).not.toHaveBeenCalled();
});

test('no dispara onPress si disabled', async () => {
  const onPress = jest.fn();
  await render(<Button label="Entrar" onPress={onPress} disabled />);
  fireEvent.press(screen.getByTestId('button'));
  expect(onPress).not.toHaveBeenCalled();
});

test('renderiza variante secondary con label', async () => {
  const onPress = jest.fn();
  await render(<Button label="Secundario" onPress={onPress} variant="secondary" />);
  expect(screen.getByText('Secundario')).toBeTruthy();
});

test('renderiza variante ghost con label', async () => {
  const onPress = jest.fn();
  await render(<Button label="Ghost" onPress={onPress} variant="ghost" />);
  expect(screen.getByText('Ghost')).toBeTruthy();
});

test('renderiza tamaño sm', async () => {
  const onPress = jest.fn();
  await render(<Button label="Pequeño" onPress={onPress} size="sm" />);
  expect(screen.getByText('Pequeño')).toBeTruthy();
});
