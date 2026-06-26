/**
 * Home — dark atlético v3.
 * Canvas negro + orbe lima. Greeting Space Grotesk. Hero CTA lima accent.
 * Tarjetas dark surface1 con hairline + iconos lima. Staged motion.
 * Lógica preservada: rutas de navegación + signOut.
 */

import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Dumbbell,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  ClipboardList,
  Zap,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import {
  AppText,
  Button,
  Header,
  Divider,
  useFadeSlideIn,
  usePressScale,
  colors,
  gradients,
  glow,
  spacing,
  radii,
  shadows,
  fontFamily,
  fontSize,
} from '@creed/ui-native';
import { signOut } from '../../lib/auth';

export default function Home() {
  const router = useRouter();

  const slideHeader = useFadeSlideIn(0);
  const slideHero = useFadeSlideIn(80);
  const slideActions = useFadeSlideIn(160);
  const slideProgram = useFadeSlideIn(230);
  const slideHistory = useFadeSlideIn(290);
  const slideSignOut = useFadeSlideIn(350);

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
        end={{ x: 0.15, y: 0.6 }}
        style={[styles.orb, styles.orbTopRight]}
      />

      <Header title="Hoy" withSafeArea />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting — Space Grotesk display */}
        <Animated.View style={[styles.greeting, slideHeader]}>
          <AppText style={styles.greetingDisplay}>Hola</AppText>
          <AppText variant="muted">Aquí vivirá tu día de entreno.</AppText>
        </Animated.View>

        {/* Hero CTA — Empezar entreno, lima accent fill */}
        <Animated.View style={slideHero}>
          <HeroCard onPress={() => router.push('/(app)/start' as any)} />
        </Animated.View>

        {/* CTA grid — Ejercicios + Rutinas */}
        <Animated.View style={[styles.ctaRow, slideActions]}>
          <NavCard
            icon={<Dumbbell size={26} color={colors.accent} strokeWidth={1.8} />}
            title="Ejercicios"
            sub="Catálogo completo"
            onPress={() => router.push('/(app)/exercises')}
            style={styles.ctaFlex}
          />
          <NavCard
            icon={<CalendarDays size={26} color={colors.accent} strokeWidth={1.8} />}
            title="Rutinas"
            sub="Mis planes"
            onPress={() => router.push('/(app)/routines' as any)}
            style={styles.ctaFlex}
          />
        </Animated.View>

        {/* Programa */}
        <Animated.View style={slideProgram}>
          <NavCard
            icon={<CalendarRange size={24} color={colors.accent} strokeWidth={1.8} />}
            title="Tu programa"
            sub="Tus rutinas y plan."
            onPress={() => router.push('/(app)/program' as any)}
            showChevron
          />
        </Animated.View>

        {/* Historial */}
        <Animated.View style={slideHistory}>
          <NavCard
            icon={<ClipboardList size={24} color={colors.accent} strokeWidth={1.8} />}
            title="Historial"
            sub="Revisa tus sesiones pasadas."
            onPress={() => router.push('/(app)/history' as any)}
            showChevron
          />
        </Animated.View>

        <Animated.View style={slideSignOut}>
          <Divider style={styles.divider} />
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

// ── Subcomponentes ────────────────────────────────────────────────────────────

function HeroCard({ onPress }: { onPress: () => void }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <Animated.View style={[animatedStyle, styles.heroWrap, glow('soft')]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel="Empezar entreno"
        style={styles.heroCard}
      >
        {/* Lima accent fill — texto onAccent */}
        <View style={[styles.heroGradient, { borderRadius: radii.xl }]}>
          <View style={styles.heroIconWrap}>
            <Zap size={30} color={colors.onAccent} strokeWidth={2} />
          </View>
          <View style={styles.heroTextBlock}>
            <AppText style={styles.heroTitle}>Empezar entreno</AppText>
            <AppText style={styles.heroSub}>Elige una rutina y empieza ahora.</AppText>
          </View>
          <ChevronRight size={24} color={colors.onAccent} strokeWidth={2.2} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function NavCard({
  icon,
  title,
  sub,
  onPress,
  showChevron = false,
  style,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onPress: () => void;
  showChevron?: boolean;
  style?: object;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <Animated.View style={[animatedStyle, styles.navCardOuter, shadows.md, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={styles.navCardInner}
      >
        <View style={styles.navIconWrap}>{icon}</View>
        <View style={styles.navTextBlock}>
          <AppText variant="heading" style={styles.navTitle}>
            {title}
          </AppText>
          <AppText variant="muted" style={styles.navSub}>
            {sub}
          </AppText>
        </View>
        {showChevron ? (
          <ChevronRight size={20} color={colors.textMuted} strokeWidth={1.8} />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[10],
    gap: spacing[4],
  },
  orb: {
    position: 'absolute',
    borderRadius: radii.pill,
  },
  orbTopRight: {
    width: 360,
    height: 360,
    top: -120,
    right: -90,
  },

  // Greeting
  greeting: {
    paddingTop: spacing[5],
    gap: spacing[1],
  },
  greetingDisplay: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.textPrimary,
    letterSpacing: -1.5,
    lineHeight: fontSize['2xl'] * 1.05,
  },

  // Hero CTA
  heroWrap: {
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  heroCard: {
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  heroGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    padding: spacing[5],
    backgroundColor: colors.accent,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(10,11,13,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextBlock: {
    flex: 1,
    gap: 3,
  },
  heroTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.onAccent,
    letterSpacing: -0.3,
    lineHeight: fontSize.lg * 1.15,
  },
  heroSub: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    color: 'rgba(10,11,13,0.72)',
  },

  // CTA row (grid 2 columnas)
  ctaRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  ctaFlex: {
    flex: 1,
  },

  // Nav cards dark
  navCardOuter: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  navCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
  },
  navIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTextBlock: {
    flex: 1,
    gap: 2,
  },
  navTitle: {
    fontSize: 17,
    letterSpacing: -0.2,
  },
  navSub: {
    fontSize: 13,
  },

  divider: {
    marginBottom: spacing[3],
  },
});
