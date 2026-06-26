import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../lib/auth-context';

export default function AuthLayout() {
  const { session } = useAuth();
  // Si ya hay sesión (p.ej. tras verificar el OTP), sal del flujo de auth.
  if (session) return <Redirect href="/(app)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
