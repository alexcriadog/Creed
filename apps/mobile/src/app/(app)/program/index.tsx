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
  Badge,
  Button,
  GlassCard,
  Header,
  useFadeSlideIn,
  usePressScale,
  lightColors,
  spacing,
  radii,
  shadows,
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
      <Animated.View style={[animatedStyle, shadows.md]}>
        <GlassCard intensity={50} tone="light" padding={spacing[5]}>
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
              <Dumbbell size={22} color={lightColors.accent} strokeWidth={1.8} />
            </View>
            <View style={styles.cardTitleBlock}>
              <AppText variant="heading" style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </AppText>
              <AppText variant="muted">Toca para editar</AppText>
            </View>
            <ChevronRight size={20} color={lightColors.textMuted} strokeWidth={1.8} />
          </Pressable>

          {/* Divider */}
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
              <Play size={16} color={lightColors.accent} strokeWidth={2} />
            </View>
            <AppText variant="label" style={styles.startLabel}>
              Empezar
            </AppText>
          </Pressable>
        </GlassCard>
      </Animated.View>
    </Animated.View>
  );
}

// ── Empty: no program or no routines ─────────────────────────────────────────

function EmptyState({ onNavigate }: { onNavigate: () => void }) {
  const enter = useFadeSlideIn(80);
  return (
    <Animated.View style={[styles.emptyWrap, enter]}>
      <View style={[styles.emptyCard, shadows.md]}>
        <LinearGradient
          colors={['rgba(255,255,255,0.78)', 'rgba(255,255,255,0.5)']}
          style={[styles.emptyGradient, { borderRadius: radii.xl }]}
        >
          <View style={styles.emptyIconWrap}>
            <Sparkles size={32} color={lightColors.accent} strokeWidth={1.6} />
          </View>
          <AppText variant="heading" style={styles.emptyTitle}>
            Aún no tienes rutinas
          </AppText>
          <AppText variant="muted" style={styles.emptyCopy}>
            Crea rutinas, añade ejercicios y vincúlalas a tu programa. Tu coach trabajará
            sobre ellas.
          </AppText>
          <View style={styles.emptyBtn}>
            <Button
              label="Gestionar rutinas"
              variant="primary"
              size="md"
              onPress={onNavigate}
            />
          </View>
        </LinearGradient>
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
      <LinearGradient
        colors={['#EEF0FF', '#F6F7FA', '#FFF8F4']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb, styles.orbTop]} />

      <Header
        title={program?.name ?? 'Programa'}
        onBack={() => router.back()}
        withSafeArea
      />

      {loading ? (
        <ActivityIndicator color={lightColors.accent} style={styles.spinner} />
      ) : loadError ? (
        <View style={styles.centeredBody}>
          <View style={styles.errorWrap}>
            <AppText variant="muted" style={styles.errorText}>
              No se pudo cargar — toca para reintentar
            </AppText>
            <Button label="Reintentar" variant="primary" size="md" onPress={load} />
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
          {/* Hero del programa */}
          <Animated.View style={slideHeader}>
            <View style={[styles.heroCard, shadows.md]}>
              <LinearGradient
                colors={['#4F62E0', '#3D4FCC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.heroGradient, { borderRadius: radii.xl }]}
              >
                <View style={styles.heroBadge}>
                  <Target size={14} color="#FCFCFD" strokeWidth={2} />
                  <AppText variant="label" style={styles.heroBadgeText}>
                    Programa activo
                  </AppText>
                </View>

                <AppText variant="title" style={styles.heroTitle} numberOfLines={2}>
                  {program.name}
                </AppText>

                {heroMeta.length > 0 ? (
                  <AppText variant="body" style={styles.heroMeta}>
                    {heroMeta}
                  </AppText>
                ) : null}

                <View style={styles.heroStats}>
                  <Badge
                    label={
                      routines.length === 1
                        ? '1 rutina'
                        : `${routines.length} rutinas`
                    }
                    tone="accent"
                    size="sm"
                  />
                </View>
              </LinearGradient>
            </View>
          </Animated.View>

          {/* Section label */}
          <Animated.View style={[styles.sectionLabel, slideSection]}>
            <View style={styles.sectionLabelRow}>
              <ListChecks size={18} color={lightColors.accent} strokeWidth={1.8} />
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
    backgroundColor: lightColors.bgCanvas,
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
  // Hero
  heroCard: {
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  heroGradient: {
    padding: spacing[6],
    gap: spacing[2],
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginBottom: spacing[1],
  },
  heroBadgeText: {
    color: '#FCFCFD',
  },
  heroTitle: {
    color: '#FCFCFD',
    letterSpacing: -0.5,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.82)',
    marginTop: 2,
  },
  heroStats: {
    flexDirection: 'row',
    marginTop: spacing[3],
    gap: spacing[2],
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
  },
  // Routine list
  routineList: {
    gap: spacing[3],
  },
  // Routine card
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: lightColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleBlock: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    letterSpacing: -0.2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: lightColors.borderDefault,
    marginVertical: spacing[3],
    marginHorizontal: -spacing[5],
    // pull out to full card width
    marginLeft: 0,
    marginRight: 0,
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
    backgroundColor: lightColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startLabel: {
    color: lightColors.accent,
    fontWeight: '600',
  },
  // Empty
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing[16],
  },
  emptyCard: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: lightColors.borderDefault,
  },
  emptyGradient: {
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[3],
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    backgroundColor: lightColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  emptyTitle: {
    textAlign: 'center',
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
  // Orb
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  orbTop: {
    width: 330,
    height: 330,
    top: -120,
    right: -85,
    backgroundColor: 'rgba(139,157,255,0.17)',
  },
});
