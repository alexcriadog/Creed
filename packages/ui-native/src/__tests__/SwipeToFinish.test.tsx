import { render, screen, fireEvent } from '@testing-library/react-native';
import { SwipeToFinish } from '../SwipeToFinish';

test('renderiza el label por defecto con role button', async () => {
  await render(<SwipeToFinish onFinish={jest.fn()} />);
  const control = screen.getByRole('button', { name: 'Desliza para finalizar' });
  expect(control).toBeTruthy();
});

test('renderiza un label custom', async () => {
  await render(<SwipeToFinish onFinish={jest.fn()} label="Acabar serie" />);
  expect(screen.getByRole('button', { name: 'Acabar serie' })).toBeTruthy();
});

test('el fallback onPress dispara onFinish', async () => {
  const onFinish = jest.fn();
  await render(<SwipeToFinish onFinish={onFinish} />);
  fireEvent.press(screen.getByRole('button', { name: 'Desliza para finalizar' }));
  expect(onFinish).toHaveBeenCalledTimes(1);
});

test('no dispara onFinish si disabled', async () => {
  const onFinish = jest.fn();
  await render(<SwipeToFinish onFinish={onFinish} disabled />);
  fireEvent.press(screen.getByRole('button', { name: 'Desliza para finalizar' }));
  expect(onFinish).not.toHaveBeenCalled();
});
