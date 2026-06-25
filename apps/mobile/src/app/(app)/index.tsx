import { Screen, AppText, Button } from '@creed/ui-native';
import { signOut } from '../../lib/auth';

export default function Home() {
  return (
    <Screen className="justify-center gap-6">
      <AppText variant="title">Hoy</AppText>
      <AppText variant="muted">Estás dentro. Aquí vivirá tu día de entreno.</AppText>
      <Button label="Cerrar sesión" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
