import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  AppText, Button, Input, GlassCard,
  useFadeSlideIn, lightColors, spacing,
} from '@creed/ui-native';
import { sendOtp } from '../../lib/auth';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slideTitle = useFadeSlideIn(0);
  const slideCard = useFadeSlideIn(80);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    const { error } = await sendOtp(email);
    setLoading(false);
    if (error) return setError('No pudimos enviar el código. Revisa el email.');
    router.push({ pathname: '/(auth)/verify', params: { email: email.trim().toLowerCase() } });
  }

  return (
    <View style={styles.root}>
      {/* Atmospheric gradient background */}
      <LinearGradient
        colors={['#EEF0FF', '#F6F7FA', '#FDF5EE']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Ambient orbs */}
      <View style={[styles.orb, styles.orbTopLeft]} />
      <View style={[styles.orb, styles.orbBottomRight]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <View style={styles.center}>
          {/* Brand / title */}
          <Animated.View style={[styles.brand, slideTitle]}>
            <AppText variant="display" style={styles.brandName}>Creed</AppText>
            <AppText variant="muted" style={styles.tagline}>
              Tu entrenamiento, elevado.
            </AppText>
          </Animated.View>

          {/* Glass form card */}
          <Animated.View style={slideCard}>
            <GlassCard intensity={60} tone="light" padding={spacing[6]}>
              <View style={styles.formInner}>
                <AppText variant="heading" style={styles.formTitle}>Entra en Creed</AppText>
                <AppText variant="muted" style={styles.formSub}>
                  Te enviamos un código de 6 dígitos a tu email.
                </AppText>
                <Input
                  testID="email-input"
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="tu@email.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  error={error ?? undefined}
                />
                <Button
                  label="Enviar código"
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
  tagline: {
    fontSize: 16,
    letterSpacing: 0.1,
  },
  formInner: {
    gap: spacing[4],
  },
  formTitle: {
    marginBottom: 2,
  },
  formSub: {
    marginBottom: spacing[2],
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
