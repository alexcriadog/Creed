/**
 * Login — dark atlético v3.
 * Canvas negro + orbe glow lima tenue. Wordmark Space Grotesk.
 * Tarjeta dark surface1. Botón accent (lima). Motion escalonado.
 * Lógica preservada: sendOtp + router.push a verify.
 */

import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  AppText,
  Button,
  Input,
  GlassCard,
  useFadeSlideIn,
  colors,
  gradients,
  spacing,
  radii,
  fontFamily,
  fontSize,
} from '@creed/ui-native';
import { sendOtp } from '../../lib/auth';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slideBrand = useFadeSlideIn(0);
  const slideCard = useFadeSlideIn(90);

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
      {/* Fondo dark atlético: gradiente de atmósfera */}
      <LinearGradient
        colors={gradients.canvasV3}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Orbe lima tenue — esquina superior derecha */}
      <LinearGradient
        colors={gradients.accentOrb}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.2, y: 0.7 }}
        style={[styles.orb, styles.orbTopRight]}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <View style={styles.center}>
          {/* Wordmark */}
          <Animated.View style={[styles.brand, slideBrand]}>
            <AppText style={styles.wordmark}>CREED</AppText>
            <AppText variant="muted" style={styles.tagline}>
              Tu entrenamiento, elevado.
            </AppText>
          </Animated.View>

          {/* Formulario en tarjeta dark surface1 */}
          <Animated.View style={[styles.cardWrap, slideCard]}>
            <GlassCard padding={spacing[6]}>
              <View style={styles.formInner}>
                <AppText variant="heading" style={styles.formTitle}>
                  Entra en Creed
                </AppText>
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
                  variant="accent"
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
    backgroundColor: colors.canvas,
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
  wordmark: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.display,
    color: colors.accent,
    letterSpacing: 6,
    lineHeight: fontSize.display * 1.05,
  },
  tagline: {
    fontSize: 16,
    letterSpacing: 0.2,
    color: colors.textSecondary,
  },
  cardWrap: {
    width: '100%',
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
    borderRadius: radii.pill,
  },
  orbTopRight: {
    width: 360,
    height: 360,
    top: -130,
    right: -110,
  },
});
