import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

test('el harness de RNTL renderiza y consulta', async () => {
  await render(<Text>hola creed</Text>);
  expect(screen.getByText('hola creed')).toBeOnTheScreen();
});
