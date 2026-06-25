import { useState } from 'react';
import { TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, AppText, Button } from '@creed/ui-native';
import { sendOtp } from '../../lib/auth';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    const { error } = await sendOtp(email);
    setLoading(false);
    if (error) return setError('No pudimos enviar el código. Revisa el email.');
    router.push({ pathname: '/(auth)/verify', params: { email: email.trim().toLowerCase() } });
  }

  return (
    <Screen className="justify-center gap-6">
      <AppText variant="title">Entra en Creed</AppText>
      <AppText variant="muted">Te enviamos un código de 6 dígitos a tu email.</AppText>
      <TextInput
        testID="email-input"
        value={email}
        onChangeText={setEmail}
        placeholder="tu@email.com"
        autoCapitalize="none"
        keyboardType="email-address"
        className="h-12 rounded-lg border border-border px-4 text-text-primary"
      />
      {error ? <AppText className="text-status-red">{error}</AppText> : null}
      <Button label="Enviar código" onPress={onSubmit} loading={loading} />
    </Screen>
  );
}
