jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
      verifyOtp: jest.fn().mockResolvedValue({ error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

import { supabase } from './supabase';
import { sendOtp, verifyOtp } from './auth';

test('sendOtp llama a signInWithOtp con shouldCreateUser', async () => {
  const res = await sendOtp('Test@Mail.com ');
  expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
    email: 'test@mail.com',
    options: { shouldCreateUser: true },
  });
  expect(res.error).toBeNull();
});

test('verifyOtp rechaza códigos que no son 6 dígitos sin llamar a la API', async () => {
  const res = await verifyOtp('test@mail.com', '12a');
  expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  expect(res.error).toBe('invalid_code');
});

test('verifyOtp llama a la API con type email para un código válido', async () => {
  const res = await verifyOtp('test@mail.com', '123456');
  expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
    email: 'test@mail.com',
    token: '123456',
    type: 'email',
  });
  expect(res.error).toBeNull();
});
