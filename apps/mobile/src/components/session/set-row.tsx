/**
 * SetRow — fila de una serie en la sesión en vivo.
 *
 * Columnas: nº de serie · Peso (kg) · Reps · RIR (opcional) · check grande.
 * - Inputs numéricos: persisten en onBlur (optimista, vía onChange del padre).
 * - Check: marca la serie hecha con press-scale, relleno accent y háptica de
 *   éxito; al completar el padre fija performed_at = ahora.
 *
 * App-specific (mobile / React Native). No confundir con el set-row del web.
 */

import { memo, useEffect, useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import {
  AppText,
  usePressScale,
  haptic,
  lightColors,
  spacing,
  radii,
} from '@creed/ui-native';
import type { SessionSet } from '../../lib/sessions';

export type SetRowPatch = {
  reps?: number | null;
  weight_kg?: number | null;
  rir?: number | null;
};

interface SetRowProps {
  set: SessionSet;
  /** Persistir un campo numérico (optimista en el padre). */
  onChange: (patch: SetRowPatch) => void;
  /** Alternar el estado "hecha". El padre fija completed + performed_at. */
  onToggleComplete: () => void;
  /** Bloquea la edición mientras la serie no esté reconciliada (id temporal). */
  disabled?: boolean;
}

/** Parsea texto a número o null (vacío). Ignora valores no numéricos. */
function parseNumeric(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Convierte un valor numérico almacenado a texto de input. */
function toText(value: number | null): string {
  return value == null ? '' : String(value);
}

function SetRowBase({
  set,
  onChange,
  onToggleComplete,
  disabled = false,
}: SetRowProps) {
  // Estado local de los inputs para edición fluida; se sincroniza si cambia el
  // valor persistido por fuera (p.ej. rollback de un fallo de persistencia).
  const [weight, setWeight] = useState(toText(set.weight_kg));
  const [reps, setReps] = useState(toText(set.reps));
  const [rir, setRir] = useState(toText(set.rir));

  useEffect(() => setWeight(toText(set.weight_kg)), [set.weight_kg]);
  useEffect(() => setReps(toText(set.reps)), [set.reps]);
  useEffect(() => setRir(toText(set.rir)), [set.rir]);

  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const done = set.completed;

  const handleToggle = () => {
    if (disabled) return;
    haptic(done ? 'light' : 'success');
    onToggleComplete();
  };

  return (
    <View
      style={[styles.row, done && styles.rowDone, disabled && styles.rowDisabled]}
    >
      {/* Nº de serie */}
      <View style={styles.colSet}>
        <AppText variant="label" style={styles.setNumber}>
          {set.set_number}
        </AppText>
      </View>

      {/* Peso (kg) */}
      <TextInput
        testID={`weight-${set.id}`}
        value={weight}
        onChangeText={setWeight}
        onBlur={() => onChange({ weight_kg: parseNumeric(weight) })}
        editable={!disabled}
        placeholder="—"
        keyboardType="decimal-pad"
        returnKeyType="done"
        style={[styles.input, styles.colNum]}
        placeholderTextColor={lightColors.textMuted}
        accessibilityLabel={`Peso serie ${set.set_number}`}
      />

      {/* Reps */}
      <TextInput
        testID={`reps-${set.id}`}
        value={reps}
        onChangeText={setReps}
        onBlur={() => onChange({ reps: parseNumeric(reps) })}
        editable={!disabled}
        placeholder="—"
        keyboardType="number-pad"
        returnKeyType="done"
        style={[styles.input, styles.colNum]}
        placeholderTextColor={lightColors.textMuted}
        accessibilityLabel={`Reps serie ${set.set_number}`}
      />

      {/* RIR (opcional) */}
      <TextInput
        testID={`rir-${set.id}`}
        value={rir}
        onChangeText={setRir}
        onBlur={() => onChange({ rir: parseNumeric(rir) })}
        editable={!disabled}
        placeholder="—"
        keyboardType="number-pad"
        returnKeyType="done"
        style={[styles.input, styles.colNum]}
        placeholderTextColor={lightColors.textMuted}
        accessibilityLabel={`RIR serie ${set.set_number}`}
      />

      {/* Check grande */}
      <Animated.View style={[styles.colCheck, animatedStyle]}>
        <Pressable
          testID={`check-${set.id}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done, disabled }}
          accessibilityLabel={`Serie ${set.set_number}`}
          disabled={disabled}
          onPress={handleToggle}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={[styles.check, done ? styles.checkDone : styles.checkIdle]}
        >
          <Check
            size={20}
            color={done ? lightColors.textOnAccent : lightColors.textMuted}
            strokeWidth={done ? 3 : 2}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

export const SetRow = memo(SetRowBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[1],
    borderRadius: radii.md,
  },
  rowDone: {
    backgroundColor: lightColors.accentSoft,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  colSet: {
    width: 40,
    alignItems: 'center',
  },
  setNumber: {
    color: lightColors.textSecondary,
    fontWeight: '600',
  },
  colNum: {
    flex: 1,
  },
  input: {
    textAlign: 'center',
    fontSize: 16,
    color: lightColors.textPrimary,
    borderWidth: 1,
    borderColor: lightColors.borderDefault,
    borderRadius: radii.sm,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[1],
    backgroundColor: lightColors.bgSurface,
    minHeight: 40,
  },
  colCheck: {
    width: 44,
    alignItems: 'center',
  },
  check: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  checkIdle: {
    backgroundColor: lightColors.bgSurfaceRaised,
    borderColor: lightColors.borderStrong,
  },
  checkDone: {
    backgroundColor: lightColors.accent,
    borderColor: lightColors.accent,
  },
});
