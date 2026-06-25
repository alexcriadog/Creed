import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import {
  AppText, Button, Input, GlassCard,
  useFadeSlideIn, lightColors, spacing,
} from '@creed/ui-native';
import { verifyOtp } from '../../lib/auth';

export default function Verify() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slideTitle = useFadeSlideIn(0);
  const slideCard = useFadeSlideIn(80);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    const { error } = await verifyOtp(email ?? '', code);
    setLoading(false);
    // Con éxito, onAuthStateChange actualiza la sesión y el gate redirige solo.
    if (error) setError('Código inválido. Inténtalo de nuevo.');
  }

  return (
    <View style={styles.root}>
      {/* Same atmospheric gradient as login */}
      <LinearGradient
        colors={['#EEF0FF', '#F6F7FA', '#FDF5EE']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb, styles.orbTopLeft]} />
      <View style={[styles.orb, styles.orbBottomRight]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <View style={styles.center}>
          {/* Brand */}
          <Animated.View style={[styles.brand, slideTitle]}>
            <AppText variant="display" style={styles.brandName}>Creed</AppText>
            <AppText variant="muted">Revisa tu bandeja de entrada.</AppText>
          </Animated.View>

          {/* Glass form card */}
          <Animated.View style={slideCard}>
            <GlassCard intensity={60} tone="light" padding={spacing[6]}>
              <View style={styles.formInner}>
                <AppText variant="heading">Tu código</AppText>
                <AppText variant="muted">Enviado a {email}</AppText>
                <Input
                  testID="code-input"
                  label="Código de 6 dígitos"
                  value={code}
                  onChangeText={setCode}
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={6}
                  error={error ?? undefined}
                />
                <Button
                  label="Verificar"
                  onPress={onSubmit}
                  loading={loading}
                  size="md"
                />
              </View>
            </GlassCard>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  kav: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    gap: spacing[8],
  },
  brand: {
    alignItems: 'center',
    gap: spacing[2],
  },
  brandName: {
    letterSpacing: -2,
    color: lightColors.accent,
  },
  formInner: {
    gap: spacing[4],
  },
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  orbTopLeft: {
    width: 280,
    height: 280,
    top: -80,
    left: -80,
    backgroundColor: 'rgba(139,157,255,0.25)',
  },
  orbBottomRight: {
    width: 220,
    height: 220,
    bottom: -60,
    right: -60,
    backgroundColor: 'rgba(255,180,130,0.20)',
  },
});
