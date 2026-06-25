import { useState } from 'react';
import { TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, AppText, Button } from '@creed/ui-native';
import { verifyOtp } from '../../lib/auth';

export default function Verify() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    const { error } = await verifyOtp(email ?? '', code);
    setLoading(false);
    // Con éxito, onAuthStateChange actualiza la sesión y el gate redirige solo.
    if (error) setError('Código inválido. Inténtalo de nuevo.');
  }

  return (
    <Screen className="justify-center gap-6">
      <AppText variant="title">Tu código</AppText>
      <AppText variant="muted">Enviado a {email}</AppText>
      <TextInput
        testID="code-input"
        value={code}
        onChangeText={setCode}
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={6}
        className="h-12 rounded-lg border border-border px-4 text-text-primary text-2xl tracking-widest"
      />
      {error ? <AppText className="text-status-red">{error}</AppText> : null}
      <Button label="Verificar" onPress={onSubmit} loading={loading} />
    </Screen>
  );
}
