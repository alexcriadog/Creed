/**
 * SetRow — fila de una serie en la sesión en vivo (v3 dark atlético).
 *
 * Columnas: nº de serie · Kg · Reps · RIR (opcional) · check memorable.
 * - Inputs numéricos sobre surface2, números tabulares grandes; persisten en
 *   onBlur (optimista, vía onChange del padre). Focus → borde lima.
 * - Check: el momento memorable. Al completar → `usePop` (rebote) + relleno
 *   lima + glow accent + háptica `success`. La fila hecha se tiñe de accentSoft.
 *
 * App-specific (mobile / React Native). No confundir con el set-row del web.
 */

import { memo, useEffect, useRef, useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import {
  AppText,
  usePop,
  haptic,
  colors,
  glow,
  spacing,
  radii,
  fontFamily,
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
  const [focused, setFocused] = useState<'weight' | 'reps' | 'rir' | null>(null);

  useEffect(() => setWeight(toText(set.weight_kg)), [set.weight_kg]);
  useEffect(() => setReps(toText(set.reps)), [set.reps]);
  useEffect(() => setRir(toText(set.rir)), [set.rir]);

  // Pop del check al confirmar — el momento memorable de la serie.
  const { animatedStyle, pop } = usePop(1.22);
  const done = set.completed;
  // Evita disparar el pop en el render inicial (sólo en la transición a "done").
  const prevDone = useRef(done);
  useEffect(() => {
    if (done && !prevDone.current) pop();
    prevDone.current = done;
  }, [done, pop]);

  const handleToggle = () => {
    if (disabled) return;
    haptic(done ? 'light' : 'success');
    onToggleComplete();
  };

  const inputStyle = (field: 'weight' | 'reps' | 'rir') => [
    styles.input,
    styles.colNum,
    focused === field && styles.inputFocused,
  ];

  return (
    <View
      style={[styles.row, done && styles.rowDone, disabled && styles.rowDisabled]}
    >
      {/* Nº de serie */}
      <View style={styles.colSet}>
        <AppText style={styles.setNumber}>{set.set_number}</AppText>
      </View>

      {/* Peso (kg) */}
      <TextInput
        testID={`weight-${set.id}`}
        value={weight}
        onChangeText={setWeight}
        onFocus={() => setFocused('weight')}
        onBlur={() => {
          setFocused(null);
          onChange({ weight_kg: parseNumeric(weight) });
        }}
        editable={!disabled}
        placeholder="—"
        keyboardType="decimal-pad"
        returnKeyType="done"
        style={inputStyle('weight')}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        accessibilityLabel={`Peso serie ${set.set_number}`}
      />

      {/* Reps */}
      <TextInput
        testID={`reps-${set.id}`}
        value={reps}
        onChangeText={setReps}
        onFocus={() => setFocused('reps')}
        onBlur={() => {
          setFocused(null);
          onChange({ reps: parseNumeric(reps) });
        }}
        editable={!disabled}
        placeholder="—"
        keyboardType="number-pad"
        returnKeyType="done"
        style={inputStyle('reps')}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        accessibilityLabel={`Reps serie ${set.set_number}`}
      />

      {/* RIR (opcional) */}
      <TextInput
        testID={`rir-${set.id}`}
        value={rir}
        onChangeText={setRir}
        onFocus={() => setFocused('rir')}
        onBlur={() => {
          setFocused(null);
          onChange({ rir: parseNumeric(rir) });
        }}
        editable={!disabled}
        placeholder="—"
        keyboardType="number-pad"
        returnKeyType="done"
        style={inputStyle('rir')}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        accessibilityLabel={`RIR serie ${set.set_number}`}
      />

      {/* Check grande — el momento memorable (pop + relleno lima + glow) */}
      <Animated.View style={[styles.colCheck, animatedStyle]}>
        <Pressable
          testID={`check-${set.id}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done, disabled }}
          accessibilityLabel={`Serie ${set.set_number}`}
          disabled={disabled}
          onPress={handleToggle}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[
            styles.check,
            done ? styles.checkDone : styles.checkIdle,
            done && glow('strong'),
          ]}
        >
          <Check
            size={22}
            color={done ? colors.onAccent : colors.textMuted}
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
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowDone: {
    backgroundColor: colors.accentSoft,
    borderColor: 'rgba(198,255,58,0.20)',
  },
  rowDisabled: {
    opacity: 0.5,
  },
  colSet: {
    width: 34,
    alignItems: 'center',
  },
  setNumber: {
    fontFamily: fontFamily.display,
    fontSize: 18,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  colNum: {
    flex: 1,
  },
  input: {
    textAlign: 'center',
    fontFamily: fontFamily.display,
    fontSize: 19,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
    borderWidth: 1.5,
    borderColor: colors.hairline,
    borderRadius: radii.sm,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[1],
    backgroundColor: colors.surface2,
    minHeight: 48,
  },
  inputFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceHi,
  },
  colCheck: {
    width: 48,
    alignItems: 'center',
  },
  check: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  checkIdle: {
    backgroundColor: colors.surface2,
    borderColor: colors.hairlineStrong,
  },
  checkDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
});
