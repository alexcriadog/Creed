/**
 * Detalle de sesión (solo lectura) — dark atlético v3.
 * Muestra ejercicios y series: peso × reps, RIR, duración, fecha.
 * Lógica preservada: getSession/getRoutine, estados de carga/error.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppText,
  Badge,
  Header,
  Divider,
  useFadeSlideIn,
  colors,
  gradients,
  glow,
  shadows,
  spacing,
  radii,
  fontFamily,
} from '@creed/ui-native';
import {
  getSession,
  type SessionWithSets,
  type SessionSet,
} from '../../../lib/sessions';
import { getRoutine } from '../../../lib/routines';
import { displayName } from '../../../lib/exercises';

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatAbsoluteDate(dateStr: string): string {
  return new Intl.DateTimeFormat('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return '—';
  const diffMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

// ── Grouping ──────────────────────────────────────────────────────────────────

type ExerciseGroup = {
  exerciseId: string;
  sets: SessionSet[];
};

function groupByExercise(sets: SessionSet[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  const indexById = new Map<string, number>();
  for (const set of sets) {
    let idx = indexById.get(set.exercise_id);
    if (idx === undefined) {
      idx = groups.length;
      indexById.set(set.exercise_id, idx);
      groups.push({ exerciseId: set.exercise_id, sets: [] });
    }
    groups[idx].sets.push(set);
  }
  return groups;
}

// ── Read-only set row ─────────────────────────────────────────────────────────

interface ReadOnlySetRowProps {
  set: SessionSet;
}

function ReadOnlySetRow({ set }: ReadOnlySetRowProps) {
  const done = set.completed;
  return (
    <View style={[styles.setRow, done && styles.setRowDone]}>
      {/* Nº de serie */}
      <View style={styles.colSet}>
        <AppText style={styles.setNumber}>
          {set.set_number}
        </AppText>
      </View>

      {/* Peso */}
      <View style={[styles.colNum, styles.cellCenter]}>
        <AppText style={styles.cellValue}>
          {set.weight_kg != null ? String(set.weight_kg) : '—'}
        </AppText>
      </View>

      {/* Reps */}
      <View style={[styles.colNum, styles.cellCenter]}>
        <AppText style={styles.cellValue}>
          {set.reps != null ? String(set.reps) : '—'}
        </AppText>
      </View>

      {/* RIR */}
      <View style={[styles.colNum, styles.cellCenter]}>
        <AppText style={styles.cellValue}>
          {set.rir != null ? String(set.rir) : '—'}
        </AppText>
      </View>

      {/* Completada indicator */}
      <View style={styles.colCheck}>
        <View style={[styles.dot, done && styles.dotDone]} />
      </View>
    </View>
  );
}

// ── Read-only exercise card ───────────────────────────────────────────────────

interface ExerciseCardProps {
  group: ExerciseGroup;
  index: number;
}

function ExerciseCard({ group, index }: ExerciseCardProps) {
  const enter = useFadeSlideIn(80 + index * 70);
  const head = group.sets[0];
  const doneCount = group.sets.filter((s) => s.completed).length;

  return (
    <Animated.View style={enter}>
      <View style={[styles.exerciseCard, shadows.md]}>
        {/* Cabecera del ejercicio */}
        <View style={styles.exHeader}>
          {head?.image_url ? (
            <Image
              source={{ uri: head.image_url }}
              style={styles.thumb}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <AppText style={styles.thumbIndex}>
                {index + 1}
              </AppText>
            </View>
          )}

          <View style={styles.titleBlock}>
            <AppText variant="body" style={styles.exTitle} numberOfLines={2}>
              {head ? displayName(head) : 'Ejercicio'}
            </AppText>
            <View style={styles.metaRow}>
              {head?.primary_muscle ? (
                <Badge label={head.primary_muscle} tone="accent" size="sm" />
              ) : null}
            </View>
          </View>

          {/* Progreso del ejercicio */}
          <View style={styles.exProgress}>
            <AppText style={styles.exProgressValue}>
              {doneCount}
              <AppText style={styles.exProgressTotal}>
                {`/${group.sets.length}`}
              </AppText>
            </AppText>
          </View>
        </View>

        <Divider style={styles.divider} />

        {/* Cabecera de columnas */}
        <View style={styles.colHead}>
          <AppText style={[styles.colLabel, styles.colSet]}>Serie</AppText>
          <AppText style={[styles.colLabel, styles.colNum]}>Kg</AppText>
          <AppText style={[styles.colLabel, styles.colNum]}>Reps</AppText>
          <AppText style={[styles.colLabel, styles.colNum]}>RIR</AppText>
          <View style={styles.colCheck} />
        </View>

        {/* Filas de serie */}
        <View style={styles.rows}>
          {group.sets.map((set) => (
            <ReadOnlySetRow key={set.id} set={set} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

// ── Background ────────────────────────────────────────────────────────────────

function Background() {
  return (
    <>
      <LinearGradient
        colors={gradients.canvasV3}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={gradients.accentOrb}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.2, y: 0.6 }}
        style={[styles.orb, styles.orbTop]}
      />
    </>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = String(id);
  const router = useRouter();

  const [session, setSession] = useState<SessionWithSets | null>(null);
  const [routineName, setRoutineName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const slideHero = useFadeSlideIn(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    getSession(sessionId)
      .then(async (data) => {
        if (!active) return;
        if (!data) {
          setLoadError(true);
          return;
        }
        setSession(data);
        // Best-effort: fetch routine name without blocking screen load.
        if (data.routine_id) {
          try {
            const routine = await getRoutine(data.routine_id);
            if (active && routine) {
              setRoutineName(routine.name);
            }
          } catch {
            // Routine name is non-critical; screen remains usable.
          }
        }
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionId]);

  const groups = useMemo(
    () => groupByExercise(session?.sets ?? []),
    [session]
  );

  const totalSets = session?.sets.length ?? 0;
  const doneSets = useMemo(
    () => (session?.sets ?? []).filter((s) => s.completed).length,
    [session]
  );

  // ── Render states ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <Background />
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (loadError || !session) {
    return (
      <View style={styles.root}>
        <Background />
        <Header title="Sesión" onBack={() => router.back()} withSafeArea />
        <View style={[styles.center, styles.fill, styles.padH]}>
          <View style={styles.errorCard}>
            <View style={styles.emptyInner}>
              <AppText variant="heading" style={styles.emptyTitle}>
                No se pudo cargar
              </AppText>
              <AppText variant="muted" style={styles.emptyCopy}>
                No encontramos esta sesión o hubo un error al cargarla.
              </AppText>
            </View>
          </View>
        </View>
      </View>
    );
  }

  const progressPct = totalSets > 0 ? (doneSets / totalSets) * 100 : 0;
  const isCompleted = session.status === 'completed';

  return (
    <View style={styles.root}>
      <Background />

      <Header title="Sesión" onBack={() => router.back()} withSafeArea />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: nombre + resumen */}
        <Animated.View style={[slideHero, shadows.md]}>
          <View style={styles.heroCard}>
            {/* Eyebrow */}
            <AppText style={styles.heroEyebrow}>
              {isCompleted ? 'Sesión completada' : 'Entrenamiento en curso'}
            </AppText>
            <AppText style={styles.heroTitle} numberOfLines={2}>
              {routineName ?? (session.routine_id ? 'Entrenamiento' : 'Sesión libre')}
            </AppText>

            {/* Meta: fecha + duración */}
            <View style={styles.heroMetaRow}>
              <View style={styles.metaPill}>
                <AppText style={styles.metaPillText}>
                  {formatAbsoluteDate(session.started_at)}
                </AppText>
              </View>
              <View style={styles.metaPill}>
                <AppText style={[styles.metaPillText, styles.metaDuration]}>
                  {formatDuration(session.started_at, session.completed_at)}
                </AppText>
              </View>
            </View>

            {/* Progreso global */}
            <View style={styles.heroStats}>
              <AppText style={styles.statDone}>{doneSets}</AppText>
              <AppText style={styles.statTotal}>{` / ${totalSets}`}</AppText>
              <AppText style={styles.statUnit}> series</AppText>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
          </View>
        </Animated.View>

        {/* Ejercicios */}
        {groups.length === 0 ? (
          <View style={styles.emptyExCard}>
            <View style={styles.emptyInner}>
              <AppText variant="heading" style={styles.emptyTitle}>
                Sin series
              </AppText>
              <AppText variant="muted" style={styles.emptyCopy}>
                Esta sesión no tiene series registradas.
              </AppText>
            </View>
          </View>
        ) : (
          groups.map((group, index) => (
            <ExerciseCard key={group.exerciseId} group={group} index={index} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  fill: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  padH: {
    paddingHorizontal: spacing[5],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: 64,
    gap: spacing[4],
  },
  // Hero card
  heroCard: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing[5],
    gap: spacing[3],
  },
  heroEyebrow: {
    fontSize: 11,
    fontFamily: fontFamily.sansSemibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.accent,
  },
  heroTitle: {
    fontFamily: fontFamily.display,
    fontSize: 26,
    color: colors.textPrimary,
    letterSpacing: -0.8,
    lineHeight: 30,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  metaPill: {
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  metaPillText: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  metaDuration: {
    fontFamily: fontFamily.display,
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statDone: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    color: colors.accent,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  statTotal: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 18,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  statUnit: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    color: colors.textMuted,
  },
  progressTrack: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    ...glow('soft'),
  },
  // Error / empty cards
  errorCard: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing[6],
    width: '100%',
  },
  emptyExCard: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing[6],
  },
  emptyInner: {
    gap: spacing[2],
    alignItems: 'center',
  },
  emptyTitle: {
    textAlign: 'center',
    color: colors.textPrimary,
  },
  emptyCopy: {
    textAlign: 'center',
    lineHeight: 22,
  },
  // Exercise card
  exerciseCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing[4],
  },
  exHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
  },
  thumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIndex: {
    fontFamily: fontFamily.display,
    fontSize: 20,
    color: colors.accent,
  },
  titleBlock: {
    flex: 1,
    gap: spacing[1],
  },
  exTitle: {
    fontFamily: fontFamily.sansSemibold,
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  exProgress: {
    minWidth: 48,
    alignItems: 'flex-end',
  },
  exProgressValue: {
    fontFamily: fontFamily.display,
    fontSize: 22,
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  exProgressTotal: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 15,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    marginVertical: spacing[3],
  },
  colHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[1],
    marginBottom: spacing[2],
  },
  colLabel: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  // Set row
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[1],
    borderRadius: radii.md,
  },
  setRowDone: {
    backgroundColor: colors.accentSoft,
  },
  setNumber: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cellCenter: {
    alignItems: 'center',
  },
  cellValue: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 15,
    textAlign: 'center',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  colSet: {
    width: 40,
    alignItems: 'center',
  },
  colNum: {
    flex: 1,
  },
  colCheck: {
    width: 44,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  dotDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    ...glow('soft'),
  },
  rows: {
    gap: spacing[2],
  },
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  orbTop: {
    width: 360,
    height: 360,
    top: -130,
    right: -110,
  },
});
