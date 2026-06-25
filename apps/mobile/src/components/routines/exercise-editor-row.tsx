/**
 * ExerciseEditorRow — fila editable de un ejercicio dentro del builder.
 *
 * Muestra: thumb (expo-image) + nombre + steppers de targets (sets × reps,
 * RIR, descanso) + controles de reordenar (▲▼) y eliminar (🗑).
 *
 * Es app-specific (conoce el modelo RoutineExercise), por eso vive en
 * apps/mobile/src/components y no en el design system.
 */

import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import { ArrowUp, ArrowDown, Trash2, Link2 } from 'lucide-react-native';
import {
  AppText,
  Badge,
  GlassCard,
  IconButton,
  NumberStepper,
  Divider,
  useFadeSlideIn,
  lightColors,
  spacing,
  radii,
  shadows,
} from '@creed/ui-native';
import { TextInput } from 'react-native';
import { displayName } from '../../lib/exercises';

export type EditorExercise = {
  /** id de la fila routine_exercises (o id temporal optimista). */
  id: string;
  exercise_id: string;
  name_en: string;
  name_es: string | null;
  image_url: string | null;
  primary_muscle: string | null;
  target_sets: number | null;
  /** Texto libre para rangos como "8-10". */
  target_reps: string | null;
  target_rir: number | null;
  rest_seconds: number | null;
  /** Solo UI (agrupación visual). No se persiste aún. */
  superset_group: number | null;
};

export type TargetField = 'target_sets' | 'target_reps' | 'target_rir' | 'rest_seconds';

interface ExerciseEditorRowProps {
  item: EditorExercise;
  index: number;
  total: number;
  /** Called with a string value for target_reps, number for all others. */
  onChangeTarget: (field: TargetField, value: number | string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onToggleSuperset: () => void;
}

function ExerciseEditorRowBase({
  item,
  index,
  total,
  onChangeTarget,
  onMoveUp,
  onMoveDown,
  onRemove,
  onToggleSuperset,
}: ExerciseEditorRowProps) {
  const enter = useFadeSlideIn(80 + index * 60);
  const inSuperset = item.superset_group !== null;

  return (
    <Animated.View style={[enter, shadows.md]}>
      <GlassCard intensity={48} tone="light" padding={spacing[4]}>
        {/* Cabecera: thumb + nombre + acciones de orden */}
        <View style={styles.header}>
          {item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
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
              {displayName(item)}
            </AppText>
            <View style={styles.metaRow}>
              {item.primary_muscle ? (
                <Badge label={item.primary_muscle} tone="accent" size="sm" />
              ) : null}
              {inSuperset ? (
                <Badge label={`SS ${item.superset_group! + 1}`} tone="amber" size="sm" />
              ) : null}
            </View>
          </View>

          {/* Reorder ▲▼ (fallback robusto a drag) */}
          <View style={styles.orderControls}>
            <IconButton
              size={34}
              variant="ghost"
              accessibilityLabel="Subir ejercicio"
              disabled={index === 0}
              onPress={onMoveUp}
            >
              <ArrowUp size={18} color={lightColors.textSecondary} strokeWidth={2} />
            </IconButton>
            <IconButton
              size={34}
              variant="ghost"
              accessibilityLabel="Bajar ejercicio"
              disabled={index === total - 1}
              onPress={onMoveDown}
            >
              <ArrowDown size={18} color={lightColors.textSecondary} strokeWidth={2} />
            </IconButton>
          </View>
        </View>

        <Divider color={lightColors.borderDefault} style={styles.divider} />

        {/* Targets */}
        <View style={styles.targets}>
          <NumberStepper
            testID={`sets-${item.id}`}
            label="Series"
            value={item.target_sets}
            min={1}
            max={20}
            defaultOnFirst={3}
            onChange={(v) => onChangeTarget('target_sets', v)}
          />
          <View style={styles.repsField}>
            <AppText variant="label" style={styles.repsLabel}>
              Reps
            </AppText>
            <TextInput
              testID={`reps-${item.id}`}
              value={item.target_reps ?? ''}
              onChangeText={(v) => onChangeTarget('target_reps', v)}
              placeholder="8-10"
              keyboardType="default"
              returnKeyType="done"
              style={styles.repsInput}
              placeholderTextColor={lightColors.textMuted}
              accessibilityLabel="Reps"
            />
          </View>
          <NumberStepper
            testID={`rir-${item.id}`}
            label="RIR"
            value={item.target_rir}
            min={0}
            max={10}
            defaultOnFirst={2}
            onChange={(v) => onChangeTarget('target_rir', v)}
          />
          <NumberStepper
            testID={`rest-${item.id}`}
            label="Descanso"
            value={item.rest_seconds}
            min={0}
            max={600}
            step={15}
            suffix="s"
            defaultOnFirst={90}
            onChange={(v) => onChangeTarget('rest_seconds', v)}
          />
        </View>

        {/* Acciones de fila */}
        <View style={styles.rowActions}>
          <IconButton
            size={36}
            variant={inSuperset ? 'accent' : 'glass'}
            accessibilityLabel="Agrupar en superserie"
            hapticKind="medium"
            onPress={onToggleSuperset}
          >
            <Link2
              size={18}
              color={inSuperset ? lightColors.accent : lightColors.textSecondary}
              strokeWidth={2}
            />
          </IconButton>
          <IconButton
            size={36}
            variant="glass"
            accessibilityLabel="Quitar ejercicio"
            hapticKind="medium"
            onPress={onRemove}
          >
            <Trash2 size={18} color={lightColors.statusRed} strokeWidth={2} />
          </IconButton>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

export const ExerciseEditorRow = memo(ExerciseEditorRowBase);

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
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  orderControls: {
    gap: 2,
  },
  divider: {
    marginVertical: spacing[3],
  },
  targets: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: spacing[3],
  },
  repsField: {
    alignItems: 'center',
    gap: spacing[1],
    minWidth: 64,
  },
  repsLabel: {
    color: lightColors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  repsInput: {
    width: 64,
    textAlign: 'center',
    fontSize: 15,
    color: lightColors.textPrimary,
    borderWidth: 1,
    borderColor: lightColors.borderDefault,
    borderRadius: radii.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    backgroundColor: lightColors.bgSurface,
    minHeight: 36,
  },
  rowActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[2],
    marginTop: spacing[3],
  },
});
