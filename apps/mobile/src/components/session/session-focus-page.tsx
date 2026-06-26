/**
 * SessionFocusPage — un ejercicio a pantalla completa dentro del modo foco.
 *
 * Es la página individual del pager horizontal de la sesión en vivo: como solo
 * hay un ejercicio en pantalla a la vez, los elementos respiran (thumb grande,
 * tipografía mayor, targets de toque más amplios que en la tarjeta de scroll).
 *
 * Cabecera: thumb (expo-image) + nombre + músculo Badge + línea de referencia
 * del target ("4×8-10 · RIR 2") + progreso del ejercicio ("2 / 4").
 * Cuerpo: cabecera de columnas + una fila por serie (SetRow) + "Añadir serie".
 *
 * App-specific (conoce SessionSet) → vive en apps/mobile/src/components.
 */

import { memo } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
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
  colors,
  spacing,
  radii,
  fontSize,
  fontFamily,
} from '@creed/ui-native';
import { displayName } from '../../lib/exercises';
import type { SessionSet, PrevByExercise } from '../../lib/sessions';
import { SetRow } from './set-row';
import type { ExerciseTarget, SetPatch } from './session-exercise-card';

interface SessionFocusPageProps {
  /** Ancho de la página (= ancho de pantalla) para el snap del pager. */
  width: number;
  /** Sets de este ejercicio, ya ordenados por set_number. */
  sets: SessionSet[];
  /** Índice del ejercicio (0-based) para el contador "i / N". */
  index: number;
  /** Total de ejercicios de la sesión. */
  total: number;
  /** Target de referencia de la rutina (si existe). */
  target?: ExerciseTarget;
  /**
   * Padding inferior del scroll para que la última fila + "Añadir serie"
   * libren la barra inferior fija (y el teclado cuando aplica).
   */
  bottomInset?: number;
  /**
   * Previous-session values per set_number for this exercise.
   * Used as gray placeholder hints in SetRow when no value is logged yet.
   */
  prevSets?: Record<number, { weight_kg: number | null; reps: number | null; rir: number | null }>;
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

function SessionFocusPageBase({
  width,
  sets,
  index,
  total,
  target,
  prevSets = {},
  bottomInset = 0,
  onChangeSet,
  onToggleComplete,
  onAddSet,
}: SessionFocusPageProps) {
  const head = sets[0];
  const targetLine = buildTargetLine(target);
  const doneCount = sets.filter((s) => s.completed).length;
  const enter = useFadeSlideIn(40);

  return (
    <ScrollView
      style={[styles.page, { width }]}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: spacing[6] + bottomInset },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      // iOS: inserta para el teclado y sube el campo enfocado a la vista.
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
    >
      <Animated.View style={[styles.cardWrap, enter]}>
        <GlassCard padding={spacing[5]}>
          {/* Eyebrow: posición del ejercicio en la sesión */}
          <AppText variant="eyebrow" style={styles.eyebrow}>
            {`Ejercicio ${index + 1} de ${total}`}
          </AppText>

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
                <AppText style={styles.thumbIndex}>{index + 1}</AppText>
              </View>
            )}

            <View style={styles.titleBlock}>
              <AppText variant="title" style={styles.title} numberOfLines={2}>
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
          </View>

          {/* Progreso del ejercicio — dato protagonista en stat tabular */}
          <View style={styles.exProgressBand}>
            <AppText variant="eyebrow" style={styles.exProgressLabel}>
              Series
            </AppText>
            <View style={styles.exProgressValue}>
              <AppText style={styles.exProgressDone}>{doneCount}</AppText>
              <AppText style={styles.exProgressTotal}>
                {` / ${sets.length}`}
              </AppText>
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Cabecera de columnas */}
          <View style={styles.colHead}>
            <AppText variant="eyebrow" style={[styles.colLabel, styles.colSet]}>
              #
            </AppText>
            <AppText variant="eyebrow" style={[styles.colLabel, styles.colNum]}>
              Kg
            </AppText>
            <AppText variant="eyebrow" style={[styles.colLabel, styles.colNum]}>
              Reps
            </AppText>
            <AppText variant="eyebrow" style={[styles.colLabel, styles.colNum]}>
              RIR
            </AppText>
            <View style={styles.colCheck} />
          </View>

          {/* Filas de serie — más espaciadas en modo foco */}
          <View style={styles.rows}>
            {sets.map((set) => (
              <SetRow
                key={set.id}
                set={set}
                prevSet={prevSets[set.set_number]}
                disabled={set.id.startsWith('temp-')}
                onChange={(patch) => onChangeSet(set.id, patch)}
                onToggleComplete={() => onToggleComplete(set.id)}
              />
            ))}
          </View>

          {/* Añadir serie — afordancia lima punteada */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Añadir serie"
            onPress={() => {
              haptic('light');
              onAddSet();
            }}
            style={({ pressed }) => [styles.addSet, pressed && { opacity: 0.6 }]}
          >
            <Plus size={18} color={colors.accent} strokeWidth={2.6} />
            <AppText style={styles.addSetLabel}>Añadir serie</AppText>
          </Pressable>
        </GlassCard>
      </Animated.View>
    </ScrollView>
  );
}

export const SessionFocusPage = memo(SessionFocusPageBase);

const styles = StyleSheet.create({
  // El ScrollView rellena la altura disponible (entre el riel y la barra
  // inferior); su contenido scrollea el overflow → todas las series alcanzables.
  page: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
  },
  cardWrap: {},
  eyebrow: {
    color: colors.accent,
    marginBottom: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: radii.lg,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  thumbPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: radii.lg,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(198,255,58,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIndex: {
    fontFamily: fontFamily.display,
    fontSize: 30,
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  titleBlock: {
    flex: 1,
    gap: spacing[2],
  },
  title: {
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * 1.1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  targetLine: {
    fontSize: 13,
    letterSpacing: 0.2,
    color: colors.textSecondary,
  },
  exProgressBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[5],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  exProgressLabel: {
    color: colors.textSecondary,
  },
  exProgressValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  exProgressDone: {
    fontFamily: fontFamily.display,
    fontSize: 34,
    // Space Grotesk recorta arriba/abajo sin lineHeight holgado (~1.15×) +
    // padding vertical: el "0" se veía como "U".
    lineHeight: 34 * 1.15,
    color: colors.accent,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    paddingVertical: 2,
  },
  exProgressTotal: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 19,
    lineHeight: 19 * 1.15,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
    paddingVertical: 2,
  },
  divider: {
    marginVertical: spacing[5],
  },
  colHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[2],
    marginBottom: spacing[3],
  },
  colLabel: {
    color: colors.textMuted,
  },
  colSet: {
    width: 34,
    textAlign: 'center',
  },
  colNum: {
    flex: 1,
    textAlign: 'center',
  },
  colCheck: {
    width: 48,
  },
  rows: {
    gap: spacing[3],
  },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: 'rgba(198,255,58,0.35)',
    borderStyle: 'dashed',
    backgroundColor: colors.accentSoft,
  },
  addSetLabel: {
    fontFamily: fontFamily.displayMedium,
    color: colors.accent,
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
