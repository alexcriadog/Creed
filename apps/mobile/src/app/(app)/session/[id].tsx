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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import {
  AppText,
  GlassCard,
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
  type ExerciseTarget,
  type SetPatch,
} from '../../../components/session/session-exercise-card';
import { SessionFocusPage } from '../../../components/session/session-focus-page';
import {
  ExerciseRail,
  type RailSegment,
} from '../../../components/session/exercise-rail';

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
  // Ref kept in sync with sets state — allows snapshot capture outside updaters
  // so that Strict Mode double-invocation does not corrupt the snapshot.
  const setsRef = useRef<SessionSet[]>([]);
  const [routineName, setRoutineName] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, ExerciseTarget>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [finishing, setFinishing] = useState(false);
  // Índice del ejercicio en foco (controla pager + riel + cabecera).
  const [currentIndex, setCurrentIndex] = useState(0);

  const elapsed = useChronometer(session?.started_at ?? null);

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<FlatList<ExerciseGroup>>(null);

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

  // Keep ref in sync — must happen every render, before handlers read it.
  setsRef.current = sets;

  const groups = useMemo(() => groupByExercise(sets), [sets]);

  const totalSets = sets.length;
  const doneSets = useMemo(() => sets.filter((s) => s.completed).length, [sets]);

  // ── Paginación / modo foco ──────────────────────────────────────────────────
  const groupCount = groups.length;

  // Clamp del índice si el nº de ejercicios encoge (defensivo).
  useEffect(() => {
    if (currentIndex > groupCount - 1) {
      setCurrentIndex(Math.max(0, groupCount - 1));
    }
  }, [groupCount, currentIndex]);

  // Estados del riel — done (todas las series marcadas), current, pending.
  const railSegments = useMemo<RailSegment[]>(
    () =>
      groups.map((g, i) => {
        const allDone = g.sets.length > 0 && g.sets.every((s) => s.completed);
        return {
          id: g.exerciseId,
          state: allDone ? 'done' : i === currentIndex ? 'current' : 'pending',
        };
      }),
    [groups, currentIndex]
  );

  // Mueve el pager a un índice y sincroniza la cabecera/riel.
  const goToIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, groupCount - 1));
      setCurrentIndex(clamped);
      pagerRef.current?.scrollToOffset({
        offset: clamped * width,
        animated: true,
      });
    },
    [groupCount, width]
  );

  // Sincroniza el índice tras un swipe del usuario (al terminar el momentum).
  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return;
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      setCurrentIndex((prev) => (prev === next ? prev : next));
    },
    [width]
  );

  // ── Editar campo numérico (optimista + rollback) ────────────────────────────
  // Snapshot se captura desde la ref (lectura síncrona fuera del updater) para
  // evitar que el double-invoke de Strict Mode corrompa el rollback.
  const handleChangeSet = useCallback((setId: string, patch: SetPatch) => {
    // No persistir contra ids temporales aún no reconciliados (no-op en DB).
    if (setId.startsWith('temp-')) return;
    const snapshot = setsRef.current;
    setSets((prev) => prev.map((s) => (s.id === setId ? { ...s, ...patch } : s)));
    updateSet(setId, patch).catch(() => {
      setSets(() => snapshot);
      Alert.alert(
        'No se pudo guardar',
        'El valor no se guardó. Revisa tu conexión e inténtalo de nuevo.'
      );
    });
  }, []);

  // ── Marcar/desmarcar serie (optimista + rollback) ───────────────────────────
  // Snapshot + next values computed from the ref (outside the updater) to avoid
  // side-effect capture inside the setState updater (Strict Mode safe).
  const handleToggleComplete = useCallback((setId: string) => {
    if (setId.startsWith('temp-')) return;
    const snapshot = setsRef.current;
    const target = snapshot.find((s) => s.id === setId);
    if (!target) return;
    const nextCompleted = !target.completed;
    const performedAt = nextCompleted ? new Date().toISOString() : null;
    setSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? { ...s, completed: nextCompleted, performed_at: performedAt }
          : s
      )
    );
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
      // Guard: no añadir si la sesión aún no está cargada.
      if (!session) return;
      const nextNumber =
        group.sets.reduce((max, s) => Math.max(max, s.set_number), 0) + 1;
      const tempId = `temp-${group.exerciseId}-${Date.now()}`;
      const optimistic: SessionSet = {
        id: tempId,
        session_id: sessionId,
        user_id: session.user_id,
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
    // Guard: double-tap protection and already-finished sessions.
    if (finishing) return;
    if (session?.status !== 'in_progress') return;

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
  }, [finishing, session, doneSets, totalSets, sessionId, router]);

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
        <View style={[styles.topBar, { paddingTop: insets.top + spacing[3] }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
          >
            <X size={20} color={lightColors.textSecondary} strokeWidth={2.2} />
          </Pressable>
          <AppText variant="label" style={styles.topBarTitle}>
            Sesión
          </AppText>
          <View style={styles.topBarSide} />
        </View>
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
  const isEmpty = groupCount === 0;
  const headerLabel = isEmpty
    ? (routineName ?? 'Sesión')
    : `Ejercicio ${currentIndex + 1} / ${groupCount}`;
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= groupCount - 1;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Background />

      {/* ── Cabecera compacta fija ─────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[3] }]}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
          >
            <X size={20} color={lightColors.textSecondary} strokeWidth={2.2} />
          </Pressable>

          <View style={styles.headerCenter}>
            <AppText variant="label" style={styles.headerLabel} numberOfLines={1}>
              {headerLabel}
            </AppText>
            {routineName && !isEmpty ? (
              <AppText variant="muted" style={styles.headerSub} numberOfLines={1}>
                {routineName}
              </AppText>
            ) : null}
          </View>

          {/* Cronómetro — pastilla horizontal que nunca envuelve */}
          <View style={styles.chrono}>
            <AppText
              variant="label"
              style={styles.chronoValue}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {elapsed}
            </AppText>
          </View>
        </View>

        {/* Progreso global + recuento de series */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <AppText variant="muted" style={styles.progressCount} numberOfLines={1}>
            {`${doneSets} / ${totalSets} series`}
          </AppText>
        </View>

        {/* Riel de ejercicios */}
        {!isEmpty ? (
          <ExerciseRail
            segments={railSegments}
            currentIndex={currentIndex}
            onSelect={goToIndex}
          />
        ) : null}
      </View>

      {/* ── Ejercicio en foco (pager horizontal) ───────────────────────────── */}
      {isEmpty ? (
        <View style={[styles.center, styles.fill]}>
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
        </View>
      ) : (
        <FlatList
          ref={pagerRef}
          data={groups}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onMomentumScrollEnd={handleMomentumEnd}
          keyExtractor={(g) => g.exerciseId}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          contentContainerStyle={{ paddingBottom: spacing[4] }}
          renderItem={({ item, index }) => (
            <SessionFocusPage
              width={width}
              sets={item.sets}
              index={index}
              total={groupCount}
              target={targets[item.exerciseId]}
              onChangeSet={handleChangeSet}
              onToggleComplete={handleToggleComplete}
              onAddSet={() => handleAddSet(item)}
            />
          )}
        />
      )}

      {/* ── Barra inferior: navegación + finalizar ─────────────────────────── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing[3] }]}>
        {!isEmpty ? (
          <View style={styles.navRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ejercicio anterior"
              disabled={isFirst}
              onPress={() => {
                haptic('light');
                goToIndex(currentIndex - 1);
              }}
              style={({ pressed }) => [
                styles.navBtn,
                isFirst && styles.navBtnDisabled,
                pressed && !isFirst && { opacity: 0.6 },
              ]}
            >
              <ChevronLeft
                size={18}
                color={isFirst ? lightColors.textMuted : lightColors.accent}
                strokeWidth={2.4}
              />
              <AppText
                variant="label"
                style={[styles.navLabel, isFirst && styles.navLabelDisabled]}
              >
                Anterior
              </AppText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Siguiente ejercicio"
              disabled={isLast}
              onPress={() => {
                haptic('light');
                goToIndex(currentIndex + 1);
              }}
              style={({ pressed }) => [
                styles.navBtn,
                styles.navBtnNext,
                isLast && styles.navBtnSubtle,
                pressed && !isLast && { opacity: 0.6 },
              ]}
            >
              <AppText
                variant="label"
                style={[styles.navLabel, isLast && styles.navLabelDisabled]}
              >
                Siguiente
              </AppText>
              <ChevronRight
                size={18}
                color={isLast ? lightColors.textMuted : lightColors.accent}
                strokeWidth={2.4}
              />
            </Pressable>
          </View>
        ) : null}

        {/* Finalizar — secundario respecto al flujo de registro */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Finalizar entreno"
          disabled={isFinished || finishing}
          onPress={handleFinish}
          style={({ pressed }) => [
            styles.finishLink,
            (isFinished || finishing) && { opacity: 0.5 },
            pressed && !isFinished && !finishing && { opacity: 0.6 },
          ]}
        >
          <AppText variant="label" style={styles.finishLinkLabel}>
            {finishing ? 'Finalizando…' : 'Finalizar entreno'}
          </AppText>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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

  // ── Cabecera compacta ──────────────────────────────────────────────────────
  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: lightColors.borderSubtle,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  headerLabel: {
    color: lightColors.textPrimary,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightColors.bgSurfaceRaised,
    borderWidth: 1,
    borderColor: lightColors.borderSubtle,
  },

  // Cronómetro — pastilla horizontal; flexShrink:0 + minWidth para no envolver
  chrono: {
    flexShrink: 0,
    minWidth: 76,
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: lightColors.accentSoft,
    borderWidth: 1,
    borderColor: `${lightColors.accent}44`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chronoValue: {
    color: lightColors.accent,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  // Progreso global + recuento
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[3],
  },
  progressTrack: {
    flex: 1,
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
  progressCount: {
    flexShrink: 0,
    fontSize: 12,
    color: lightColors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },

  // ── Barra inferior ─────────────────────────────────────────────────────────
  bottomBar: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: lightColors.borderSubtle,
    backgroundColor: lightColors.bgSurfaceRaised,
  },
  navRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    height: 48,
    borderRadius: radii.md,
    backgroundColor: lightColors.bgSurface,
    borderWidth: 1,
    borderColor: lightColors.borderDefault,
    ...shadows.sm,
  },
  navBtnNext: {
    backgroundColor: lightColors.accentSoft,
    borderColor: `${lightColors.accent}44`,
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navBtnSubtle: {
    backgroundColor: lightColors.bgSurface,
    borderColor: lightColors.borderDefault,
  },
  navLabel: {
    color: lightColors.accent,
    fontWeight: '700',
  },
  navLabelDisabled: {
    color: lightColors.textMuted,
  },
  finishLink: {
    alignSelf: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    marginTop: spacing[1],
  },
  finishLinkLabel: {
    color: lightColors.textSecondary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // ── Empty / error ──────────────────────────────────────────────────────────
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

  // Top bar minimal (error state)
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: lightColors.borderSubtle,
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    color: lightColors.textPrimary,
    fontWeight: '700',
  },
  topBarSide: {
    width: 36,
  },

  // ── Fondo ──────────────────────────────────────────────────────────────────
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
