import { View, StyleSheet, ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Dumbbell, CalendarDays, LogOut } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import {
  AppText, Button, GlassCard, Header, Divider,
  useFadeSlideIn, lightColors, spacing, radii, shadows,
} from '@creed/ui-native';
import { signOut } from '../../lib/auth';

export default function Home() {
  const router = useRouter();

  const slideHeader = useFadeSlideIn(0);
  const slideHero = useFadeSlideIn(80);
  const slideActions = useFadeSlideIn(160);
  const slideSignOut = useFadeSlideIn(240);

  return (
    <View style={styles.root}>
      {/* Ambient background */}
      <LinearGradient
        colors={['#EEF0FF', '#F6F7FA', '#FFF8F4']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb, styles.orbTop]} />

      <Header title="Hoy" withSafeArea />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <Animated.View style={[styles.greeting, slideHeader]}>
          <AppText variant="display" style={styles.greetingText}>Hola</AppText>
          <AppText variant="muted">Aquí vivirá tu día de entreno.</AppText>
        </Animated.View>

        {/* Hero placeholder card */}
        <Animated.View style={slideHero}>
          <GlassCard intensity={55} tone="light" padding={spacing[6]} style={styles.heroCard}>
            <View style={styles.heroInner}>
              <View style={styles.heroBadge}>
                <AppText variant="label" style={styles.heroBadgeText}>Próximo entreno</AppText>
              </View>
              <AppText variant="heading" style={styles.heroTitle}>
                Tu plan llega pronto
              </AppText>
              <AppText variant="muted">
                Aquí vivirá tu día de entreno con series, reps y notas del coach.
              </AppText>
            </View>
          </GlassCard>
        </Animated.View>

        {/* CTA cards */}
        <Animated.View style={[styles.ctaRow, slideActions]}>
          {/* Exercises CTA */}
          <View style={[styles.ctaCard, shadows.md]}>
            <LinearGradient
              colors={['rgba(255,255,255,0.75)', 'rgba(255,255,255,0.55)']}
              style={[styles.ctaGradient, { borderRadius: radii.lg }]}
            >
              <View style={styles.ctaIconWrap}>
                <Dumbbell size={28} color={lightColors.accent} strokeWidth={1.8} />
              </View>
              <AppText variant="heading" style={styles.ctaTitle}>Ejercicios</AppText>
              <AppText variant="muted" style={styles.ctaSub}>Catálogo completo</AppText>
              <View style={styles.ctaBtn}>
                <Button
                  label="Explorar"
                  variant="primary"
                  size="sm"
                  onPress={() => router.push('/(app)/exercises')}
                />
              </View>
            </LinearGradient>
          </View>

          {/* Routines CTA */}
          <View style={[styles.ctaCard, shadows.md]}>
            <LinearGradient
              colors={['rgba(255,255,255,0.75)', 'rgba(255,255,255,0.55)']}
              style={[styles.ctaGradient, { borderRadius: radii.lg }]}
            >
              <View style={styles.ctaIconWrap}>
                <CalendarDays size={28} color={lightColors.accent} strokeWidth={1.8} />
              </View>
              <AppText variant="heading" style={styles.ctaTitle}>Rutinas</AppText>
              <AppText variant="muted" style={styles.ctaSub}>Próximamente</AppText>
              <View style={styles.ctaBtn}>
                <Button
                  label="Ver"
                  variant="secondary"
                  size="sm"
                  onPress={() => router.push('/(app)/routines' as any)}
                />
              </View>
            </LinearGradient>
          </View>
        </Animated.View>

        <Animated.View style={slideSignOut}>
          <Divider color={lightColors.borderDefault} style={styles.divider} />
          <Button
            label="Cerrar sesión"
            variant="ghost"
            size="sm"
            onPress={signOut}
          />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: lightColors.bgCanvas,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[10],
    gap: spacing[5],
  },
  greeting: {
    paddingTop: spacing[5],
    gap: spacing[1],
  },
  greetingText: {
    letterSpacing: -1.5,
  },
  heroCard: {
    marginTop: spacing[2],
  },
  heroInner: {
    gap: spacing[3],
  },
  heroBadge: {
    backgroundColor: lightColors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing[3],
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  heroBadgeText: {
    color: lightColors.accent,
  },
  heroTitle: {
    marginTop: spacing[1],
  },
  ctaRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  ctaCard: {
    flex: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: lightColors.borderDefault,
  },
  ctaGradient: {
    padding: spacing[4],
    gap: spacing[2],
    flex: 1,
  },
  ctaIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: lightColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  ctaTitle: {
    fontSize: 17,
  },
  ctaSub: {
    fontSize: 13,
  },
  ctaBtn: {
    marginTop: spacing[3],
  },
  divider: {
    marginBottom: spacing[3],
  },
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  orbTop: {
    width: 340,
    height: 340,
    top: -120,
    right: -80,
    backgroundColor: 'rgba(139,157,255,0.18)',
  },
});
