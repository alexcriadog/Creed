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
import { View, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';
import {
  AppText,
  Badge,
  GlassCard,
  Divider,
  haptic,
  lightColors,
  spacing,
  radii,
  shadows,
} from '@creed/ui-native';
import { displayName } from '../../lib/exercises';
import type { SessionSet } from '../../lib/sessions';
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
  onChangeSet,
  onToggleComplete,
  onAddSet,
}: SessionFocusPageProps) {
  const head = sets[0];
  const targetLine = buildTargetLine(target);
  const doneCount = sets.filter((s) => s.completed).length;

  return (
    <View style={[styles.page, { width }]}>
      <View style={[styles.cardWrap, shadows.md]}>
        <GlassCard intensity={50} tone="light" padding={spacing[5]}>
          {/* Eyebrow: posición del ejercicio en la sesión */}
          <AppText variant="muted" style={styles.eyebrow}>
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
                <AppText variant="title" style={styles.thumbIndex}>
                  {index + 1}
                </AppText>
              </View>
            )}

            <View style={styles.titleBlock}>
              <AppText variant="heading" style={styles.title} numberOfLines={2}>
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

          {/* Progreso del ejercicio — banda destacada */}
          <View style={styles.exProgressBand}>
            <AppText variant="label" style={styles.exProgressLabel}>
              Series completadas
            </AppText>
            <AppText variant="heading" style={styles.exProgressValue}>
              {doneCount}
              <AppText variant="muted" style={styles.exProgressTotal}>
                {` / ${sets.length}`}
              </AppText>
            </AppText>
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

          {/* Filas de serie — más espaciadas en modo foco */}
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
            <Plus size={18} color={lightColors.accent} strokeWidth={2.4} />
            <AppText variant="label" style={styles.addSetLabel}>
              Añadir serie
            </AppText>
          </Pressable>
        </GlassCard>
      </View>
    </View>
  );
}

export const SessionFocusPage = memo(SessionFocusPageBase);

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
  },
  cardWrap: {},
  eyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: lightColors.accent,
    fontWeight: '600',
    marginBottom: spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radii.lg,
    backgroundColor: lightColors.bgCanvasTint,
  },
  thumbPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: radii.lg,
    backgroundColor: lightColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIndex: {
    color: lightColors.accent,
    fontWeight: '700',
  },
  titleBlock: {
    flex: 1,
    gap: spacing[2],
  },
  title: {
    fontWeight: '700',
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
  },
  exProgressBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[4],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radii.md,
    backgroundColor: lightColors.bgSurfaceRaised,
    borderWidth: 1,
    borderColor: lightColors.borderSubtle,
  },
  exProgressLabel: {
    color: lightColors.textSecondary,
    fontWeight: '600',
  },
  exProgressValue: {
    color: lightColors.textPrimary,
    fontWeight: '700',
  },
  exProgressTotal: {
    fontSize: 17,
    fontWeight: '500',
  },
  divider: {
    marginVertical: spacing[4],
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
    gap: spacing[3],
  },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: lightColors.borderDefault,
    borderStyle: 'dashed',
    backgroundColor: lightColors.bgSurfaceRaised,
  },
  addSetLabel: {
    color: lightColors.accent,
    fontWeight: '600',
    fontSize: 15,
  },
});
