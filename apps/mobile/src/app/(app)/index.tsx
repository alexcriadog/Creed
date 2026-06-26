import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Dumbbell, CalendarDays, CalendarRange, ChevronRight, ClipboardList, Zap } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import {
  AppText, Button, Header, Divider,
  useFadeSlideIn, lightColors, spacing, radii, shadows,
} from '@creed/ui-native';
import { signOut } from '../../lib/auth';

export default function Home() {
  const router = useRouter();

  const slideHeader = useFadeSlideIn(0);
  const slideHero = useFadeSlideIn(80);
  const slideActions = useFadeSlideIn(160);
  const slideProgram = useFadeSlideIn(220);
  const slideHistory = useFadeSlideIn(270);
  const slideSignOut = useFadeSlideIn(340);

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

        {/* Hero CTA — Empezar entreno */}
        <Animated.View style={slideHero}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Empezar entreno"
            onPress={() => router.push('/(app)/start' as any)}
            style={({ pressed }) => [pressed && { opacity: 0.94 }]}
          >
            <View style={[styles.heroCard, shadows.lg]}>
              <LinearGradient
                colors={['#4F62E0', '#3D4FCC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.heroGradient, { borderRadius: radii.xl }]}
              >
                <View style={styles.heroIconWrap}>
                  <Zap size={30} color="#FCFCFD" strokeWidth={1.8} />
                </View>
                <View style={styles.heroTextBlock}>
                  <AppText variant="heading" style={styles.heroTitle}>
                    Empezar entreno
                  </AppText>
                  <AppText variant="body" style={styles.heroSub}>
                    Elige una rutina y empieza ahora.
                  </AppText>
                </View>
                <ChevronRight size={24} color="rgba(255,255,255,0.85)" strokeWidth={2} />
              </LinearGradient>
            </View>
          </Pressable>
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
              <AppText variant="muted" style={styles.ctaSub}>Mis planes</AppText>
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

        {/* Programa — horario semanal (CTA ancho) */}
        <Animated.View style={slideProgram}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir programa semanal"
            onPress={() => router.push('/(app)/program' as any)}
            style={({ pressed }) => [pressed && { opacity: 0.94 }]}
          >
            <View style={[styles.programCard, shadows.md]}>
              <LinearGradient
                colors={['#4F62E0', '#3D4FCC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.programGradient, { borderRadius: radii.xl }]}
              >
                <View style={styles.programIconWrap}>
                  <CalendarRange size={26} color="#FCFCFD" strokeWidth={1.9} />
                </View>
                <View style={styles.programText}>
                  <AppText variant="heading" style={styles.programTitle}>
                    Tu programa
                  </AppText>
                  <AppText variant="body" style={styles.programSub}>
                    Tu programa y sus rutinas.
                  </AppText>
                </View>
                <ChevronRight size={22} color="rgba(255,255,255,0.85)" strokeWidth={2} />
              </LinearGradient>
            </View>
          </Pressable>
        </Animated.View>

        {/* Historial — mis sesiones pasadas */}
        <Animated.View style={slideHistory}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir historial de sesiones"
            onPress={() => router.push('/(app)/history' as any)}
            style={({ pressed }) => [pressed && { opacity: 0.94 }]}
          >
            <View style={[styles.historyCard, shadows.sm]}>
              <LinearGradient
                colors={['rgba(255,255,255,0.80)', 'rgba(255,255,255,0.60)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.historyGradient, { borderRadius: radii.xl }]}
              >
                <View style={styles.historyIconWrap}>
                  <ClipboardList size={24} color={lightColors.accent} strokeWidth={1.8} />
                </View>
                <View style={styles.historyText}>
                  <AppText variant="heading" style={styles.historyTitle}>
                    Historial
                  </AppText>
                  <AppText variant="muted" style={styles.historySub}>
                    Revisa tus sesiones pasadas.
                  </AppText>
                </View>
                <ChevronRight size={20} color={lightColors.textMuted} strokeWidth={1.8} />
              </LinearGradient>
            </View>
          </Pressable>
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
    borderRadius: radii.xl,
    overflow: 'hidden',
    marginTop: spacing[2],
  },
  heroGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    padding: spacing[5],
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextBlock: {
    flex: 1,
    gap: 3,
  },
  heroTitle: {
    color: '#FCFCFD',
    letterSpacing: -0.3,
    fontSize: 19,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
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
  programCard: {
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  programGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    padding: spacing[5],
  },
  programIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  programText: {
    flex: 1,
    gap: 2,
  },
  programTitle: {
    color: '#FCFCFD',
    letterSpacing: -0.2,
  },
  programSub: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
  },
  divider: {
    marginBottom: spacing[3],
  },
  historyCard: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: lightColors.borderDefault,
  },
  historyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    padding: spacing[4],
  },
  historyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: lightColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyText: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    color: lightColors.textPrimary,
    letterSpacing: -0.2,
  },
  historySub: {
    fontSize: 13,
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
