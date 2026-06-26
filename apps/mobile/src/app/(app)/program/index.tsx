/**
 * Programa activo — dark atlético v3.
 * Canvas negro + orbe lima. Hero card dark surface1. Routine cards dark con lima accent.
 * Lógica preservada: getActiveProgram / listRoutines / startSession / Alert / guards.
 */

import { useCallback, useState } from 'react';
import {
  Alert,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronRight,
  Dumbbell,
  ListChecks,
  Play,
  Sparkles,
  Target,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  AppText,
  Button,
  Header,
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
import {
  getActiveProgram,
  listRoutines,
  type Program,
  type Routine,
} from '../../../lib/routines';
import { startSession } from '../../../lib/sessions';

// ── Routine card ──────────────────────────────────────────────────────────────

function RoutineCard({
  item,
  index,
  isStarting,
  onOpen,
  onStart,
}: {
  item: Routine;
  index: number;
  isStarting: boolean;
  onOpen: () => void;
  onStart: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const enter = useFadeSlideIn(140 + index * 65);

  return (
    <Animated.View style={enter}>
      <Animated.View style={[animatedStyle, styles.cardOuter, glow('soft')]}>
        {/* Row: icon + title + chevron → opens editor */}
        <Pressable
          onPress={onOpen}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          accessibilityLabel={`Ver rutina ${item.name}`}
          style={styles.cardHeader}
        >
          <View style={styles.cardIconWrap}>
            <Dumbbell size={22} color={colors.accent} strokeWidth={1.8} />
          </View>
          <View style={styles.cardTitleBlock}>
            <AppText
              variant="heading"
              style={styles.cardTitle}
              numberOfLines={1}
            >
              {item.name}
            </AppText>
            <AppText variant="muted">Toca para editar</AppText>
          </View>
          <ChevronRight size={20} color={colors.textMuted} strokeWidth={1.8} />
        </Pressable>

        {/* Hairline divider */}
        <View style={styles.cardDivider} />

        {/* Empezar CTA */}
        <Pressable
          onPress={onStart}
          disabled={isStarting}
          accessibilityRole="button"
          accessibilityLabel={`Empezar rutina ${item.name}`}
          style={styles.startRow}
        >
          <View style={styles.startIconWrap}>
            <Play size={16} color={colors.onAccent} strokeWidth={2} />
          </View>
          <AppText variant="label" style={styles.startLabel}>
            Empezar
          </AppText>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ── Empty: no program or no routines ─────────────────────────────────────────

function EmptyState({ onNavigate }: { onNavigate: () => void }) {
  const enter = useFadeSlideIn(80);
  return (
    <Animated.View style={[styles.emptyWrap, enter]}>
      <View style={[styles.emptyCard, glow('soft')]}>
        <View style={styles.emptyIconWrap}>
          <Sparkles size={32} color={colors.accent} strokeWidth={1.6} />
        </View>
        <AppText variant="heading" style={styles.emptyTitle}>
          Aún no tienes rutinas
        </AppText>
        <AppText variant="muted" style={styles.emptyCopy}>
          Crea rutinas, añade ejercicios y vincúlalas a tu programa. Tu coach
          trabajará sobre ellas.
        </AppText>
        <View style={styles.emptyBtn}>
          <Button
            label="Gestionar rutinas"
            variant="accent"
            size="md"
            onPress={onNavigate}
          />
        </View>
      </View>
    </Animated.View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProgramScreen() {
  const router = useRouter();
  const [program, setProgram] = useState<Program | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  const slideHeader = useFadeSlideIn(0);
  const slideSection = useFadeSlideIn(80);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);

    (async () => {
      const activeProgram = await getActiveProgram();
      const programRoutines = activeProgram
        ? await listRoutines({ programId: activeProgram.id })
        : [];

      if (!active) return;
      setProgram(activeProgram);
      setRoutines(programRoutines);
    })()
      .catch(() => {
        if (!active) return;
        setLoadError(true);
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(load);

  const handleStart = useCallback(
    async (routine: Routine) => {
      if (startingId !== null) return;
      setStartingId(routine.id);
      try {
        const session = await startSession(routine.id);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace(`/(app)/session/${session.id}` as any);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        Alert.alert('No se pudo iniciar el entreno', message);
      } finally {
        setStartingId(null);
      }
    },
    [startingId, router]
  );

  // Hero meta line: goal · period
  const heroMeta = (() => {
    if (!program) return '';
    const parts: string[] = [];
    if (program.goal) parts.push(program.goal);
    if (program.period_weeks) parts.push(`${program.period_weeks} semanas`);
    return parts.join(' · ');
  })();

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

      <Header
        title={program?.name ?? 'Programa'}
        onBack={() => router.back()}
        withSafeArea
      />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.spinner} />
      ) : loadError ? (
        <View style={styles.centeredBody}>
          <View style={styles.errorWrap}>
            <AppText variant="muted" style={styles.errorText}>
              No se pudo cargar — toca para reintentar
            </AppText>
            <Button label="Reintentar" variant="accent" size="md" onPress={load} />
          </View>
        </View>
      ) : !program || routines.length === 0 ? (
        <View style={styles.centeredBody}>
          <EmptyState onNavigate={() => router.push('/(app)/routines' as any)} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero del programa — dark surface1 con borde acento + glow */}
          <Animated.View style={slideHeader}>
            <View style={[styles.heroCard, glow('soft')]}>
              {/* Orbe lima interno muy tenue */}
              <LinearGradient
                colors={gradients.accentOrb}
                start={{ x: 1, y: 0 }}
                end={{ x: 0.1, y: 0.8 }}
                style={[StyleSheet.absoluteFill, { borderRadius: radii.xl }]}
              />

              {/* Badge "Programa activo" */}
              <View style={styles.heroBadge}>
                <Target size={13} color={colors.accent} strokeWidth={2} />
                <AppText variant="eyebrow" style={styles.heroBadgeText}>
                  Programa activo
                </AppText>
              </View>

              {/* Nombre — Space Grotesk display */}
              <AppText style={styles.heroTitle} numberOfLines={2}>
                {program.name}
              </AppText>

              {heroMeta.length > 0 ? (
                <AppText variant="body" style={styles.heroMeta}>
                  {heroMeta}
                </AppText>
              ) : null}

              {/* Stat: nº rutinas en lima */}
              <View style={styles.heroStats}>
                <AppText style={styles.heroStatNumber}>
                  {routines.length}
                </AppText>
                <AppText variant="muted" style={styles.heroStatLabel}>
                  {routines.length === 1 ? 'rutina' : 'rutinas'}
                </AppText>
              </View>
            </View>
          </Animated.View>

          {/* Section label */}
          <Animated.View style={[styles.sectionLabel, slideSection]}>
            <View style={styles.sectionLabelRow}>
              <ListChecks size={18} color={colors.accent} strokeWidth={1.8} />
              <AppText variant="heading" style={styles.sectionLabelText}>
                Rutinas del programa
              </AppText>
            </View>
            <AppText variant="muted">
              Toca una tarjeta para editarla o empezar el entreno.
            </AppText>
          </Animated.View>

          {/* Routine cards */}
          <View style={styles.routineList}>
            {routines.map((r, index) => (
              <RoutineCard
                key={r.id}
                item={r}
                index={index}
                isStarting={startingId !== null}
                onOpen={() => router.push(`/(app)/routines/${r.id}` as any)}
                onStart={() => handleStart(r)}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

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
    paddingTop: spacing[4],
    paddingBottom: spacing[16],
    gap: spacing[5],
  },
  centeredBody: {
    flex: 1,
    paddingHorizontal: spacing[5],
  },
  spinner: {
    marginTop: spacing[16],
  },

  // Orbe
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

  // Hero del programa — dark surface1 + hairline + glow lima tenue
  heroCard: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    padding: spacing[6],
    gap: spacing[2],
    overflow: 'hidden',
    ...shadows.md,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginBottom: spacing[1],
    borderWidth: 1,
    borderColor: 'rgba(198,255,58,0.25)',
  },
  heroBadgeText: {
    color: colors.accent,
  },
  heroTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.textPrimary,
    letterSpacing: -1,
    lineHeight: fontSize['2xl'] * 1.1,
  },
  heroMeta: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: spacing[3],
  },
  heroStatNumber: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['3xl'],
    color: colors.accent,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  heroStatLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  // Section label
  sectionLabel: {
    gap: spacing[1],
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  sectionLabelText: {
    letterSpacing: -0.2,
    color: colors.textPrimary,
  },

  // Routine list
  routineList: {
    gap: spacing[3],
  },

  // Routine card — dark surface1 + hairline
  cardOuter: {
    backgroundColor: colors.surface1,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing[5],
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(198,255,58,0.18)',
  },
  cardTitleBlock: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    letterSpacing: -0.2,
    color: colors.textPrimary,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginVertical: spacing[3],
  },
  startRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  startIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startLabel: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: fontSize.sm,
    letterSpacing: 0.2,
  },

  // Empty state — dark surface
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing[16],
  },
  emptyCard: {
    backgroundColor: colors.surface1,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[3],
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
    borderWidth: 1,
    borderColor: 'rgba(198,255,58,0.2)',
  },
  emptyTitle: {
    textAlign: 'center',
    color: colors.textPrimary,
  },
  emptyCopy: {
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyBtn: {
    marginTop: spacing[2],
    alignSelf: 'stretch',
  },

  // Error
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[4],
    paddingBottom: spacing[16],
  },
  errorText: {
    textAlign: 'center',
  },
});
