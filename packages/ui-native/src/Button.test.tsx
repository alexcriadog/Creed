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
