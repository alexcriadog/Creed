/**
 * NumberStepper — control compacto −/valor/+ con háptica.
 *
 * Pensado para editar targets (sets, reps, RIR/RPE, descanso) inline.
 * - Botones circulares con feedback de opacidad al pulsar.
 * - Háptica 'light' en cada paso; clamp a [min, max].
 * - `value === null` muestra placeholder "—" y arranca en `defaultOnFirst`.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { haptic } from './motion';
import { getColors, radii, spacing, fontSize, fontFamily, fontWeight } from './theme';

export interface NumberStepperProps {
  /** Etiqueta superior (p.ej. "Series"). */
  label: string;
  /** Valor actual; null = sin definir. */
  value: number | null;
  /** Notifica el nuevo valor (ya clampeado). */
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  /** Incremento por paso. Default 1. */
  step?: number;
  /** Sufijo opcional tras el número (p.ej. "s" para segundos). */
  suffix?: string;
  /** Valor al que saltar desde null. Default `min`. */
  defaultOnFirst?: number;
  testID?: string;
}

const clamp = (n: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, n));

export function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  suffix,
  defaultOnFirst,
  testID,
}: NumberStepperProps) {
  const colors = getColors('light');
  const base = defaultOnFirst ?? min;

  const apply = (delta: number) => {
    const current = value ?? base;
    const next = clamp(value === null ? base : current + delta, min, max);
    haptic('light');
    onChange(next);
  };

  const display = value === null ? '—' : `${value}${suffix ?? ''}`;
  const atMin = value !== null && value <= min;
  const atMax = value !== null && value >= max;

  return (
    <View style={styles.wrap} testID={testID}>
      <Text
        style={[styles.label, { color: colors.textSecondary, fontFamily: fontFamily.sansMedium }]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.controls,
          { backgroundColor: colors.bgSurfaceRaised, borderColor: colors.borderSubtle },
        ]}
      >
        <Pressable
          testID={testID ? `${testID}-dec` : undefined}
          accessibilityRole="button"
          accessibilityLabel={`Bajar ${label}`}
          disabled={atMin}
          onPress={() => apply(-step)}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 2 }}
          style={({ pressed }) => [styles.btn, (pressed || atMin) && { opacity: 0.4 }]}
        >
          <Minus size={16} color={colors.accent} strokeWidth={2.4} />
        </Pressable>

        <Text
          style={[styles.value, { color: colors.textPrimary, fontFamily: fontFamily.sansSemibold }]}
        >
          {display}
        </Text>

        <Pressable
          testID={testID ? `${testID}-inc` : undefined}
          accessibilityRole="button"
          accessibilityLabel={`Subir ${label}`}
          disabled={atMax}
          onPress={() => apply(step)}
          hitSlop={{ top: 8, bottom: 8, left: 2, right: 6 }}
          style={({ pressed }) => [styles.btn, (pressed || atMax) && { opacity: 0.4 }]}
        >
          <Plus size={16} color={colors.accent} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
    alignItems: 'center',
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 4,
    height: 38,
  },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    minWidth: 40,
    textAlign: 'center',
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    paddingHorizontal: spacing[1],
  },
});
