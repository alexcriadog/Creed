/**
 * Verify — dark atlético v3.
 * Mismo canvas negro + orbe lima. Back circular (IconButton v3).
 * Tarjeta dark surface1. Botón accent (lima) + ghost reenvío.
 * Lógica preservada: verifyOtp + cooldown + router.replace('/(app)').
 */

import { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import {
  AppText,
  Button,
  Input,
  GlassCard,
  IconButton,
  useFadeSlideIn,
  colors,
  gradients,
  spacing,
  radii,
  fontFamily,
  fontSize,
  haptic,
} from '@creed/ui-native';
import { verifyOtp, sendOtp } from '../../lib/auth';

// Cooldown del reenvío para evitar abuso del envío de OTP.
const RESEND_COOLDOWN = 45;

export default function Verify() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);

  const slideBrand = useFadeSlideIn(0);
  const slideCard = useFadeSlideIn(90);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function onSubmit() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    const { error } = await verifyOtp(email ?? '', code);
    if (!error) {
      // Verificado: hay sesión → navega a la app.
      haptic('success');
      router.replace('/(app)');
      return;
    }
    setLoading(false);
    setError(
      error === 'expired'
        ? 'El código ha caducado o ya se usó. Pide uno nuevo.'
        : 'Código incorrecto. Revisa el último email.',
    );
  }

  async function onResend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    setInfo(null);
    const { error } = await sendOtp(email ?? '');
    setResending(false);
    if (error) {
      setError('No pudimos reenviar el código. Inténtalo en un momento.');
      return;
    }
    haptic('light');
    setCode('');
    setInfo('Código reenviado. Usa el del último email.');
    setCooldown(RESEND_COOLDOWN);
  }

  function onBack() {
    haptic('light');
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/login');
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

      {/* Back circular (IconButton v3) */}
      <View style={[styles.backRow, { top: insets.top + spacing[2] }]}>
        <IconButton
          onPress={onBack}
          accessibilityLabel="Volver"
          variant="glass"
          size={44}
        >
          <ChevronLeft size={22} color={colors.textPrimary} strokeWidth={2.4} />
        </IconButton>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <View style={styles.center}>
          {/* Wordmark */}
          <Animated.View style={[styles.brand, slideBrand]}>
            <AppText style={styles.wordmark}>CREED</AppText>
            <AppText variant="muted" style={styles.taglineSub}>
              Revisa tu bandeja de entrada.
            </AppText>
          </Animated.View>

          {/* Tarjeta dark surface1 */}
          <Animated.View style={[styles.cardWrap, slideCard]}>
            <GlassCard padding={spacing[6]}>
              <View style={styles.formInner}>
                <AppText variant="heading">Tu código</AppText>
                <AppText variant="muted">Enviado a {email}</AppText>
                <Input
                  testID="code-input"
                  label="Código de 6 dígitos"
                  value={code}
                  onChangeText={(t) => {
                    setCode(t);
                    if (error) setError(null);
                  }}
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={6}
                  error={error ?? undefined}
                />
                {info ? (
                  <AppText variant="label" style={styles.info}>
                    {info}
                  </AppText>
                ) : null}
                <Button
                  label="Verificar"
                  onPress={onSubmit}
                  loading={loading}
                  variant="accent"
                  size="md"
                />
                <Button
                  label={cooldown > 0 ? `Reenviar código en ${cooldown}s` : 'Reenviar código'}
                  onPress={onResend}
                  variant="ghost"
                  size="sm"
                  loading={resending}
                  disabled={cooldown > 0}
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
  backRow: {
    position: 'absolute',
    left: spacing[4],
    zIndex: 10,
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
  taglineSub: {
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
  info: {
    color: colors.accent,
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
