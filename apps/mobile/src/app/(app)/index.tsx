import { useRouter } from 'expo-router';
import { Screen, AppText, Button } from '@creed/ui-native';
import { signOut } from '../../lib/auth';

export default function Home() {
  const router = useRouter();
  return (
    <Screen className="justify-center gap-6">
      <AppText variant="title">Hoy</AppText>
      <AppText variant="muted">Estás dentro. Aquí vivirá tu día de entreno.</AppText>
      <Button label="Ver ejercicios" onPress={() => router.push('/(app)/exercises')} />
      <Button label="Cerrar sesión" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
