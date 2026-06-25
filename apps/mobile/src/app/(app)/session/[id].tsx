/**
 * Sesión en vivo — registro de series (HÉROE de la fase 4).
 *
 * Carga la sesión (getSession) + targets de la rutina (getRoutine) y permite
 * registrar peso/reps/RIR por serie, marcarlas hechas y finalizar.
 *
 * Estado de los sets vive en memoria; cada edición persiste de forma optimista
 * (con rollback si la persistencia falla). El cronómetro tira de un intervalo
 * que se limpia al desmontar.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppText,
  Button,
  Header,
  GlassCard,
  useFadeSlideIn,
  haptic,
  lightColors,
  spacing,
  radii,
  shadows,
} from '@creed/ui-native';
import {
  getSession,
  updateSet,
  addSet,
  completeSession,
  type SessionWithSets,
  type SessionSet,
} from '../../../lib/sessions';
import { getRoutine } from '../../../lib/routines';
import {
  SessionExerciseCard,
  type ExerciseTarget,
  type SetPatch,
} from '../../../components/session/session-exercise-card';

// ── Cronómetro ────────────────────────────────────────────────────────────────

/** Formatea milisegundos transcurridos como mm:ss (o h:mm:ss si ≥ 1h). */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

const TICK_MS = 1000;

/** Cronómetro vivo: tick cada segundo, se limpia al desmontar / cambiar inicio. */
function useChronometer(startedAt: string | null): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return '00:00';
  const startMs = new Date(startedAt).getTime();
  return formatElapsed(now - startMs);
}

// ── Agrupación por ejercicio ────────────────────────────────────────────────

type ExerciseGroup = {
  exerciseId: string;
  routineExerciseId: string | null;
  sets: SessionSet[];
};

/** Agrupa los sets (ya ordenados) por ejercicio, preservando el orden. */
function groupByExercise(sets: SessionSet[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  const indexById = new Map<string, number>();
  for (const set of sets) {
    let idx = indexById.get(set.exercise_id);
    if (idx === undefined) {
      idx = groups.length;
      indexById.set(set.exercise_id, idx);
      groups.push({
        exerciseId: set.exercise_id,
        routineExerciseId: set.routine_exercise_id,
        sets: [],
      });
    }
    groups[idx].sets.push(set);
  }
  return groups;
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

export default function LiveSession() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = String(id);
  const router = useRouter();

  const [session, setSession] = useState<SessionWithSets | null>(null);
  const [sets, setSets] = useState<SessionSet[]>([]);
  const [routineName, setRoutineName] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, ExerciseTarget>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const elapsed = useChronometer(session?.started_at ?? null);

  const slideHero = useFadeSlideIn(0);

  // ── Carga inicial ──────────────────────────────────────────────────────────
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
        setSets(data.sets);
        // Targets + nombre de la rutina (best-effort, no bloqueante).
        if (data.routine_id) {
          try {
            const routine = await getRoutine(data.routine_id);
            if (active && routine) {
              setRoutineName(routine.name);
              const map: Record<string, ExerciseTarget> = {};
              for (const re of routine.exercises) {
                map[re.exercise_id] = {
                  target_sets: re.target_sets,
                  target_reps: re.target_reps,
                  target_rir: re.target_rir,
                };
              }
              setTargets(map);
            }
          } catch {
            // Sin targets: la sesión sigue siendo usable.
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

  const groups = useMemo(() => groupByExercise(sets), [sets]);

  const totalSets = sets.length;
  const doneSets = useMemo(() => sets.filter((s) => s.completed).length, [sets]);

  // ── Editar campo numérico (optimista + rollback) ────────────────────────────
  // El snapshot se captura DENTRO del updater (estado actual en el momento del
  // procesado) para no perder cambios concurrentes en el rollback.
  const handleChangeSet = useCallback((setId: string, patch: SetPatch) => {
    // No persistir contra ids temporales aún no reconciliados (no-op en DB).
    if (setId.startsWith('temp-')) return;
    let snapshot: SessionSet[] = [];
    setSets((prev) => {
      snapshot = prev;
      return prev.map((s) => (s.id === setId ? { ...s, ...patch } : s));
    });
    updateSet(setId, patch).catch(() => {
      setSets(() => snapshot);
      Alert.alert(
        'No se pudo guardar',
        'El valor no se guardó. Revisa tu conexión e inténtalo de nuevo.'
      );
    });
  }, []);

  // ── Marcar/desmarcar serie (optimista + rollback) ───────────────────────────
  const handleToggleComplete = useCallback((setId: string) => {
    if (setId.startsWith('temp-')) return;
    let snapshot: SessionSet[] = [];
    let nextCompleted = false;
    let performedAt: string | null = null;
    setSets((prev) => {
      snapshot = prev;
      const target = prev.find((s) => s.id === setId);
      if (!target) return prev;
      nextCompleted = !target.completed;
      performedAt = nextCompleted ? new Date().toISOString() : null;
      return prev.map((s) =>
        s.id === setId
          ? { ...s, completed: nextCompleted, performed_at: performedAt }
          : s
      );
    });
    updateSet(setId, {
      completed: nextCompleted,
      performed_at: performedAt,
    }).catch(() => {
      setSets(() => snapshot);
      Alert.alert(
        'No se pudo actualizar',
        'La serie no se pudo marcar. Inténtalo de nuevo.'
      );
    });
  }, []);

  // ── Añadir serie (optimista con id temporal + reconciliación) ───────────────
  const handleAddSet = useCallback(
    (group: ExerciseGroup) => {
      const nextNumber =
        group.sets.reduce((max, s) => Math.max(max, s.set_number), 0) + 1;
      const tempId = `temp-${group.exerciseId}-${Date.now()}`;
      const optimistic: SessionSet = {
        id: tempId,
        session_id: sessionId,
        user_id: session?.user_id ?? '',
        exercise_id: group.exerciseId,
        routine_exercise_id: group.routineExerciseId,
        set_number: nextNumber,
        reps: null,
        weight_kg: null,
        rir: null,
        rpe: null,
        is_warmup: false,
        completed: false,
        performed_at: null,
        created_at: new Date().toISOString(),
        name_en: group.sets[0]?.name_en ?? '',
        name_es: group.sets[0]?.name_es ?? null,
        image_url: group.sets[0]?.image_url ?? null,
        primary_muscle: group.sets[0]?.primary_muscle ?? null,
      };

      setSets((prev) => [...prev, optimistic]);

      addSet(sessionId, group.exerciseId, group.routineExerciseId, nextNumber)
        .then((created) => {
          // Reconcilia el id temporal con el real, preservando los datos
          // embebidos del ejercicio (addSet no los devuelve).
          setSets((prev) =>
            prev.map((s) =>
              s.id === tempId
                ? {
                    ...created,
                    name_en: optimistic.name_en,
                    name_es: optimistic.name_es,
                    image_url: optimistic.image_url,
                    primary_muscle: optimistic.primary_muscle,
                  }
                : s
            )
          );
        })
        .catch(() => {
          // Rollback quirúrgico: elimina solo la fila temporal, preservando
          // cualquier cambio concurrente hecho durante la petición.
          setSets((prev) => prev.filter((s) => s.id !== tempId));
          Alert.alert(
            'No se pudo añadir',
            'La serie no se pudo añadir. Inténtalo de nuevo.'
          );
        });
    },
    [sessionId, session]
  );

  // ── Finalizar entreno ───────────────────────────────────────────────────────
  const handleFinish = useCallback(() => {
    if (finishing) return;

    const run = async () => {
      setFinishing(true);
      try {
        await completeSession(sessionId);
        haptic('success');
        router.back();
      } catch (err) {
        setFinishing(false);
        const msg = err instanceof Error ? err.message : 'Error al finalizar';
        Alert.alert('No se pudo finalizar', msg);
      }
    };

    if (totalSets > 0 && doneSets < totalSets) {
      Alert.alert(
        'Finalizar entreno',
        `Tienes ${totalSets - doneSets} serie(s) sin marcar. ¿Finalizar de todas formas?`,
        [
          { text: 'Seguir entrenando', style: 'cancel' },
          { text: 'Finalizar', style: 'destructive', onPress: run },
        ]
      );
      return;
    }
    run();
  }, [finishing, doneSets, totalSets, sessionId, router]);

  // ── Render states ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <Background />
        <ActivityIndicator color={lightColors.accent} size="large" />
      </View>
    );
  }

  if (loadError || !session) {
    return (
      <View style={styles.root}>
        <Background />
        <Header title="Sesión" onBack={() => router.back()} withSafeArea />
        <View style={[styles.center, styles.fill]}>
          <GlassCard intensity={42} tone="light" padding={spacing[6]}>
            <View style={styles.emptyInner}>
              <AppText variant="heading" style={styles.emptyTitle}>
                No se pudo cargar
              </AppText>
              <AppText variant="muted" style={styles.emptyCopy}>
                No encontramos esta sesión o hubo un error al cargarla.
              </AppText>
            </View>
          </GlassCard>
        </View>
      </View>
    );
  }

  const isFinished = session.status !== 'in_progress';
  const progressPct = totalSets > 0 ? (doneSets / totalSets) * 100 : 0;

  return (
    <View style={styles.root}>
      <Background />

      <Header
        title="En sesión"
        onBack={() => router.back()}
        withSafeArea
        rightAction={
          <View style={styles.chrono}>
            <AppText variant="label" style={styles.chronoValue}>
              {elapsed}
            </AppText>
          </View>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Hero: nombre + progreso global */}
        <Animated.View style={[slideHero, shadows.md]}>
          <GlassCard intensity={52} tone="light" padding={spacing[5]}>
            <AppText variant="muted" style={styles.heroEyebrow}>
              {isFinished ? 'Sesión finalizada' : 'Entreno en curso'}
            </AppText>
            <AppText variant="title" style={styles.heroTitle} numberOfLines={2}>
              {routineName ?? 'Sesión libre'}
            </AppText>
            <View style={styles.heroMeta}>
              <View style={styles.progressPill}>
                <AppText variant="label" style={styles.progressText}>
                  {`${doneSets} / ${totalSets} series`}
                </AppText>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
          </GlassCard>
        </Animated.View>

        {/* Ejercicios */}
        {groups.length === 0 ? (
          <GlassCard intensity={42} tone="light" padding={spacing[6]}>
            <View style={styles.emptyInner}>
              <AppText variant="heading" style={styles.emptyTitle}>
                Sin series
              </AppText>
              <AppText variant="muted" style={styles.emptyCopy}>
                Esta sesión no tiene series registradas.
              </AppText>
            </View>
          </GlassCard>
        ) : (
          groups.map((group, index) => (
            <SessionExerciseCard
              key={group.exerciseId}
              sets={group.sets}
              index={index}
              target={targets[group.exerciseId]}
              onChangeSet={handleChangeSet}
              onToggleComplete={handleToggleComplete}
              onAddSet={() => handleAddSet(group)}
            />
          ))
        )}
      </ScrollView>

      {/* CTA fijo: finalizar */}
      <View style={styles.finishBar}>
        <Button
          label={finishing ? 'Finalizando…' : 'Finalizar entreno'}
          onPress={handleFinish}
          loading={finishing}
          disabled={isFinished}
        />
      </View>
    </View>
  );
}

/** Fondo glass: gradiente premium + orbe ambiental. */
function Background() {
  return (
    <>
      <LinearGradient
        colors={['#EEF0FF', '#F6F7FA', '#FFF8F4']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb, styles.orbTop]} />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: lightColors.bgCanvas,
  },
  fill: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: 128,
    gap: spacing[4],
  },
  chrono: {
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: lightColors.accentSoft,
    borderWidth: 1,
    borderColor: `${lightColors.accent}44`,
  },
  chronoValue: {
    color: lightColors.accent,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  heroEyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: lightColors.accent,
    fontWeight: '600',
  },
  heroTitle: {
    marginTop: spacing[1],
  },
  heroMeta: {
    flexDirection: 'row',
    marginTop: spacing[3],
  },
  progressPill: {
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: lightColors.bgSurfaceRaised,
    borderWidth: 1,
    borderColor: lightColors.borderSubtle,
  },
  progressText: {
    color: lightColors.textSecondary,
    fontWeight: '600',
  },
  progressTrack: {
    marginTop: spacing[3],
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: lightColors.bgCanvasTint,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: lightColors.accent,
  },
  emptyInner: {
    gap: spacing[2],
    alignItems: 'center',
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyCopy: {
    textAlign: 'center',
    lineHeight: 22,
  },
  finishBar: {
    position: 'absolute',
    left: spacing[5],
    right: spacing[5],
    bottom: spacing[8],
  },
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  orbTop: {
    width: 300,
    height: 300,
    top: -110,
    right: -90,
    backgroundColor: 'rgba(139,157,255,0.16)',
  },
});
