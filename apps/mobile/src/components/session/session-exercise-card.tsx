/**
 * SessionExerciseCard — bloque de un ejercicio dentro de la sesión en vivo.
 *
 * Cabecera: thumb (expo-image) + nombre + músculo Badge + línea de referencia
 * del target ("4×8-10 · RIR 2") + progreso del ejercicio ("2/4").
 * Debajo: cabecera de columnas y una fila por serie (SetRow).
 * Pie: botón "Añadir serie".
 *
 * Es app-specific (conoce SessionSet), por eso vive en apps/mobile/src/components
 * y no en el design system.
 */

import { memo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';
import {
  AppText,
  Badge,
  GlassCard,
  Divider,
  useFadeSlideIn,
  haptic,
  lightColors,
  spacing,
  radii,
  shadows,
} from '@creed/ui-native';
import { displayName } from '../../lib/exercises';
import type { SessionSet } from '../../lib/sessions';
import { SetRow } from './set-row';

/** Referencia de target del ejercicio (de la rutina), opcional. */
export type ExerciseTarget = {
  target_sets: number | null;
  target_reps: string | null;
  target_rir: number | null;
};

export type SetPatch = {
  reps?: number | null;
  weight_kg?: number | null;
  rir?: number | null;
  completed?: boolean;
  performed_at?: string | null;
};

interface SessionExerciseCardProps {
  /** Sets de este ejercicio, ya ordenados por set_number. */
  sets: SessionSet[];
  /** Índice del ejercicio (para stagger de entrada). */
  index: number;
  /** Target de referencia de la rutina (si existe). */
  target?: ExerciseTarget;
  onChangeSet: (setId: string, patch: SetPatch) => void;
  onToggleComplete: (setId: string) => void;
  onAddSet: () => void;
}

/** Construye la línea de referencia "4×8-10 · RIR 2" a partir del target. */
function buildTargetLine(target: ExerciseTarget | undefined): string | null {
  if (!target) return null;
  const parts: string[] = [];
  const sets = target.target_sets;
  const reps = target.target_reps?.trim();
  if (sets != null && reps) parts.push(`${sets}×${reps}`);
  else if (sets != null) parts.push(`${sets} series`);
  else if (reps) parts.push(`${reps} reps`);
  if (target.target_rir != null) parts.push(`RIR ${target.target_rir}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function SessionExerciseCardBase({
  sets,
  index,
  target,
  onChangeSet,
  onToggleComplete,
  onAddSet,
}: SessionExerciseCardProps) {
  const enter = useFadeSlideIn(80 + index * 70);
  const head = sets[0];
  const targetLine = buildTargetLine(target);
  const doneCount = sets.filter((s) => s.completed).length;

  return (
    <Animated.View style={[enter, shadows.md]}>
      <GlassCard intensity={48} tone="light" padding={spacing[4]}>
        {/* Cabecera del ejercicio */}
        <View style={styles.header}>
          {head?.image_url ? (
            <Image
              source={{ uri: head.image_url }}
              style={styles.thumb}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <AppText variant="label" style={styles.thumbIndex}>
                {index + 1}
              </AppText>
            </View>
          )}

          <View style={styles.titleBlock}>
            <AppText variant="body" style={styles.title} numberOfLines={2}>
              {head ? displayName(head) : 'Ejercicio'}
            </AppText>
            <View style={styles.metaRow}>
              {head?.primary_muscle ? (
                <Badge label={head.primary_muscle} tone="accent" size="sm" />
              ) : null}
              {targetLine ? (
                <AppText variant="muted" style={styles.targetLine}>
                  {targetLine}
                </AppText>
              ) : null}
            </View>
          </View>

          {/* Progreso del ejercicio */}
          <View style={styles.exProgress}>
            <AppText variant="heading" style={styles.exProgressValue}>
              {doneCount}
              <AppText variant="muted" style={styles.exProgressTotal}>
                {`/${sets.length}`}
              </AppText>
            </AppText>
          </View>
        </View>

        <Divider color={lightColors.borderDefault} style={styles.divider} />

        {/* Cabecera de columnas */}
        <View style={styles.colHead}>
          <AppText variant="label" style={[styles.colLabel, styles.colSet]}>
            Serie
          </AppText>
          <AppText variant="label" style={[styles.colLabel, styles.colNum]}>
            Kg
          </AppText>
          <AppText variant="label" style={[styles.colLabel, styles.colNum]}>
            Reps
          </AppText>
          <AppText variant="label" style={[styles.colLabel, styles.colNum]}>
            RIR
          </AppText>
          <View style={styles.colCheck} />
        </View>

        {/* Filas de serie */}
        <View style={styles.rows}>
          {sets.map((set) => (
            <SetRow
              key={set.id}
              set={set}
              disabled={set.id.startsWith('temp-')}
              onChange={(patch) => onChangeSet(set.id, patch)}
              onToggleComplete={() => onToggleComplete(set.id)}
            />
          ))}
        </View>

        {/* Añadir serie */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Añadir serie"
          onPress={() => {
            haptic('light');
            onAddSet();
          }}
          style={({ pressed }) => [styles.addSet, pressed && { opacity: 0.6 }]}
        >
          <Plus size={16} color={lightColors.accent} strokeWidth={2.4} />
          <AppText variant="label" style={styles.addSetLabel}>
            Añadir serie
          </AppText>
        </Pressable>
      </GlassCard>
    </Animated.View>
  );
}

export const SessionExerciseCard = memo(SessionExerciseCardBase);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: lightColors.bgCanvasTint,
  },
  thumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: lightColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIndex: {
    color: lightColors.accent,
    fontWeight: '600',
  },
  titleBlock: {
    flex: 1,
    gap: spacing[1],
  },
  title: {
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  targetLine: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  exProgress: {
    minWidth: 48,
    alignItems: 'flex-end',
  },
  exProgressValue: {
    color: lightColors.textPrimary,
    fontWeight: '700',
  },
  exProgressTotal: {
    fontSize: 15,
    fontWeight: '500',
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
    fontSize: 11,
    color: lightColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  colSet: {
    width: 40,
  },
  colNum: {
    flex: 1,
    textAlign: 'center',
  },
  colCheck: {
    width: 44,
  },
  rows: {
    gap: spacing[2],
  },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    marginTop: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: lightColors.borderDefault,
    borderStyle: 'dashed',
    backgroundColor: lightColors.bgSurfaceRaised,
  },
  addSetLabel: {
    color: lightColors.accent,
    fontWeight: '600',
  },
});
