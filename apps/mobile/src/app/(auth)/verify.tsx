import { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import {
  AppText, Button, Input, GlassCard,
  useFadeSlideIn, lightColors, spacing, haptic,
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

  const slideTitle = useFadeSlideIn(0);
  const slideCard = useFadeSlideIn(80);

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
      // Verificado: hay sesión → navega a la app (no dependemos solo del gate).
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
      <LinearGradient
        colors={['#EEF0FF', '#F6F7FA', '#FDF5EE']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb, styles.orbTopLeft]} />
      <View style={[styles.orb, styles.orbBottomRight]} />

      {/* Botón atrás */}
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Volver"
        hitSlop={12}
        style={[styles.back, { top: insets.top + spacing[2] }]}
      >
        <ChevronLeft size={22} color={lightColors.textPrimary} />
        <AppText variant="label">Atrás</AppText>
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <View style={styles.center}>
          <Animated.View style={[styles.brand, slideTitle]}>
            <AppText variant="display" style={styles.brandName}>Creed</AppText>
            <AppText variant="muted">Revisa tu bandeja de entrada.</AppText>
          </Animated.View>

          <Animated.View style={slideCard}>
            <GlassCard intensity={60} tone="light" padding={spacing[6]}>
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
                  <AppText variant="label" style={styles.info}>{info}</AppText>
                ) : null}
                <Button label="Verificar" onPress={onSubmit} loading={loading} size="md" />
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
  root: { flex: 1 },
  kav: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    gap: spacing[8],
  },
  back: {
    position: 'absolute',
    left: spacing[4],
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingVertical: spacing[1],
    paddingRight: spacing[2],
  },
  brand: { alignItems: 'center', gap: spacing[2] },
  brandName: { letterSpacing: -2, color: lightColors.accent },
  formInner: { gap: spacing[4] },
  info: { color: lightColors.accent },
  orb: { position: 'absolute', borderRadius: 9999 },
  orbTopLeft: {
    width: 280, height: 280, top: -80, left: -80,
    backgroundColor: 'rgba(139,157,255,0.25)',
  },
  orbBottomRight: {
    width: 220, height: 220, bottom: -60, right: -60,
    backgroundColor: 'rgba(255,180,130,0.20)',
  },
});
