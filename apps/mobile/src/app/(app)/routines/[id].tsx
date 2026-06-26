/**
 * Editor de rutina — dark atlético v3.
 * Canvas negro + orbe lima. Input dark, cards dark surface1.
 * CTA "Empezar entreno" accent lima. "Añadir ejercicio" barra inferior lima.
 * Lógica preservada: crear borrador, targets, reordenar, eliminar, startSession.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Check } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  AppText,
  Button,
  Input,
  Header,
  useFadeSlideIn,
  haptic,
  colors,
  gradients,
  glow,
  shadows,
  spacing,
  radii,
  fontFamily,
} from '@creed/ui-native';
import {
  getRoutine,
  createRoutine,
  updateRoutine,
  updateRoutineExercise,
  removeRoutineExercise,
  reorderRoutineExercises,
} from '../../../lib/routines';
import { startSession } from '../../../lib/sessions';
import {
  ExerciseEditorRow,
  type EditorExercise,
  type TargetField,
} from '../../../components/routines/exercise-editor-row';

/** Numeric defaults for fields that are numbers. target_reps is text so excluded. */
const NUMERIC_DEFAULTS: Record<Exclude<TargetField, 'target_reps'>, number> = {
  target_sets: 3,
  target_rir: 2,
  rest_seconds: 90,
};

function toEditor(re: {
  id: string;
  exercise_id: string;
  name_en: string;
  name_es: string | null;
  image_url: string | null;
  primary_muscle: string | null;
  target_sets: number | null;
  target_reps: string | null;
  target_rir: number | null;
  rest_seconds: number | null;
}): EditorExercise {
  return {
    id: re.id,
    exercise_id: re.exercise_id,
    name_en: re.name_en,
    name_es: re.name_es,
    image_url: re.image_url,
    primary_muscle: re.primary_muscle,
    target_sets: re.target_sets,
    target_reps: re.target_reps,
    target_rir: re.target_rir,
    rest_seconds: re.rest_seconds,
    superset_group: null,
  };
}

export default function RoutineEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // routineId real (resuelto: si entras con 'new' creamos un borrador).
  const [routineId, setRoutineId] = useState<string | null>(
    id === 'new' ? null : String(id)
  );
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<EditorExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const creatingRef = useRef(false);

  const slideName = useFadeSlideIn(0);
  const slideList = useFadeSlideIn(60);

  // ── Crear borrador si entramos como 'new' ───────────────────────────────────
  useEffect(() => {
    if (id !== 'new' || routineId || creatingRef.current) return;
    let active = true;
    creatingRef.current = true;
    createRoutine({ name: 'Nueva rutina' })
      .then((r) => {
        if (!active) return;
        setRoutineId(r.id);
        setName(r.name);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        // No pudimos crear el borrador: no dejamos un editor que no persiste.
        // Volvemos atrás en vez de mostrar un formulario inerte.
        setLoading(false);
        router.back();
      });
    return () => {
      active = false;
    };
  }, [id, routineId, router]);

  // ── Cargar rutina (y recargar al volver del picker) ─────────────────────────
  const load = useCallback(() => {
    if (!routineId) return;
    let active = true;
    getRoutine(routineId)
      .then((r) => {
        if (!active || !r) return;
        setName((prev) => (prev.length === 0 ? r.name : prev));
        setExercises(r.exercises.map(toEditor));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [routineId]);

  useFocusEffect(load);

  // ── Nombre ──────────────────────────────────────────────────────────────────
  const commitName = () => {
    if (!routineId) return;
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    updateRoutine(routineId, { name: trimmed }).catch(() => {});
  };

  // ── Targets (optimista) ─────────────────────────────────────────────────────
  const handleChangeTarget = (rowId: string, field: TargetField, value: number | string) => {
    setExercises((prev) =>
      prev.map((e) => (e.id === rowId ? { ...e, [field]: value } : e))
    );
    updateRoutineExercise(rowId, { [field]: value } as any).catch(() => {});
  };

  // ── Reordenar (swap local + persistir con rollback) ─────────────────────────
  const move = (from: number, to: number) => {
    if (!routineId || to < 0 || to >= exercises.length) return;
    haptic('light');
    const snapshot = exercises;
    // Calcula el nuevo orden fuera del updater (los updaters deben ser puros).
    const next = [...exercises];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setExercises(next);
    reorderRoutineExercises(
      routineId,
      next.map((e) => e.id)
    ).catch(() => {
      setExercises(snapshot);
    });
  };

  // ── Eliminar (optimista con rollback) ──────────────────────────────────────
  const handleRemove = (rowId: string) => {
    haptic('medium');
    const snapshot = exercises;
    setExercises((prev) => prev.filter((e) => e.id !== rowId));
    removeRoutineExercise(rowId).catch(() => {
      setExercises(snapshot);
      Alert.alert('No se pudo eliminar', 'El ejercicio no pudo eliminarse. Inténtalo de nuevo.');
    });
  };

  // ── Superserie (solo UI por ahora) ──────────────────────────────────────────
  const handleToggleSuperset = (rowId: string) => {
    setExercises((prev) =>
      prev.map((e) =>
        e.id === rowId
          ? { ...e, superset_group: e.superset_group === null ? 0 : null }
          : e
      )
    );
  };

  // ── Guardar (defaults a targets sin definir) + salir ────────────────────────
  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      commitName();
      // Rellena targets vacíos (numéricos) con defaults sensatos antes de salir.
      await Promise.all(
        exercises.map((e) => {
          const patch: Partial<Record<Exclude<TargetField, 'target_reps'>, number>> = {};
          (Object.keys(NUMERIC_DEFAULTS) as Array<keyof typeof NUMERIC_DEFAULTS>).forEach((f) => {
            if (e[f] === null) patch[f] = NUMERIC_DEFAULTS[f];
          });
          if (Object.keys(patch).length === 0) return Promise.resolve();
          return updateRoutineExercise(e.id, patch);
        })
      );
      haptic('success');
      router.back();
    } catch (err) {
      setSaving(false);
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      Alert.alert('No se pudo guardar', msg);
    }
  };

  const openPicker = () => {
    if (!routineId) return;
    router.push(`/(app)/routines/exercise-picker?routineId=${routineId}` as any);
  };

  // ── Empezar entreno → crear sesión y navegar a la sesión en vivo ────────────
  const handleStart = async () => {
    if (!routineId || starting) return;
    setStarting(true);
    try {
      // Persistimos el nombre antes de salir del editor.
      commitName();
      const session = await startSession(routineId);
      haptic('success');
      router.push(`/(app)/session/${session.id}` as any);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al empezar';
      Alert.alert('No se pudo empezar', msg);
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <Background />
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Background />

      <Header
        title="Editor"
        onBack={() => router.back()}
        withSafeArea
        rightAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Guardar rutina"
            onPress={handleSave}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.6 }]}
          >
            <Check size={22} color={colors.accent} strokeWidth={2.4} />
          </Pressable>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Nombre editable — Input dark */}
        <Animated.View style={slideName}>
          <Input
            label="Nombre de la rutina"
            value={name}
            onChangeText={setName}
            onBlur={commitName}
            placeholder="Ej. Push · Pecho y hombros"
            autoCapitalize="sentences"
            returnKeyType="done"
          />
        </Animated.View>

        {/* Empezar entreno — CTA prominente lima (solo si hay ejercicios) */}
        {exercises.length > 0 ? (
          <Animated.View style={slideName}>
            <Button
              label={starting ? 'Empezando…' : 'Empezar entreno'}
              variant="accent"
              onPress={handleStart}
              loading={starting}
            />
          </Animated.View>
        ) : null}

        {/* Lista de ejercicios */}
        <Animated.View style={[styles.list, slideList]}>
          {exercises.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyInner}>
                <AppText variant="heading" style={styles.emptyTitle}>
                  Rutina vacía
                </AppText>
                <AppText variant="muted" style={styles.emptyCopy}>
                  Añade ejercicios desde el catálogo para empezar a construir tu sesión.
                </AppText>
              </View>
            </View>
          ) : (
            exercises.map((item, index) => (
              <ExerciseEditorRow
                key={item.id}
                item={item}
                index={index}
                total={exercises.length}
                onChangeTarget={(field, value) =>
                  handleChangeTarget(item.id, field, value)
                }
                onMoveUp={() => move(index, index - 1)}
                onMoveDown={() => move(index, index + 1)}
                onRemove={() => handleRemove(item.id)}
                onToggleSuperset={() => handleToggleSuperset(item.id)}
              />
            ))
          )}
        </Animated.View>
      </ScrollView>

      {/* CTA añadir ejercicio — barra inferior prominente lima */}
      <View style={styles.addBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Añadir ejercicio"
          onPress={openPicker}
          style={({ pressed }) => [pressed && { opacity: 0.88 }]}
        >
          <View style={[styles.addBtn, shadows.lg]}>
            <Plus size={22} color={colors.onAccent} strokeWidth={2.4} />
            <AppText style={styles.addLabel}>
              Añadir ejercicio
            </AppText>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

/** Fondo dark atlético: gradiente de atmósfera + orbe de glow lima muy tenue. */
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
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 0.6 }}
        style={[styles.orb, styles.orbTopLeft]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
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
    paddingBottom: 120,
    gap: spacing[5],
  },
  saveBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: spacing[3],
  },
  // Empty state — dark card
  emptyCard: {
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
  // Add exercise bar — lima accent fill
  addBar: {
    position: 'absolute',
    left: spacing[5],
    right: spacing[5],
    bottom: spacing[8],
  },
  addBtn: {
    height: 56,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.accent,
    ...glow('soft'),
  },
  addLabel: {
    fontFamily: fontFamily.display,
    fontSize: 17,
    color: colors.onAccent,
    letterSpacing: -0.2,
  },
  // Background orb
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  orbTopLeft: {
    width: 300,
    height: 300,
    top: -110,
    left: -80,
  },
});
