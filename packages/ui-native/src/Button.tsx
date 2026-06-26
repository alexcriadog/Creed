/**
 * Button — botón del design system v3 (dark atlético) con press-spring + háptica.
 *
 * Variantes (v3):
 *   accent  → relleno lima, texto onAccent (casi negro) — acción primaria
 *   surface → surface2 + hairline, texto primario — acción secundaria
 *   ghost   → transparente, texto acento — acción terciaria
 *
 * Aliases legacy (siguen funcionando):
 *   primary   → accent · secondary → surface
 *
 * API preservada: { label, onPress, loading?, disabled?, variant?, size? }.
 */

import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale, haptic } from './motion';
import {
  colors,
  glow,
  radii,
  spacing,
  fontSize,
  fontFamily,
  fontWeight,
  shadows,
} from './theme';

export type ButtonVariant =
  | 'accent'
  | 'surface'
  | 'ghost'
  // legacy aliases
  | 'primary'
  | 'secondary';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 44, md: 54 };
const H_PADDING: Record<ButtonSize, number> = { sm: spacing[4], md: spacing[6] };
const FONT_SIZE: Record<ButtonSize, number> = { sm: fontSize.sm, md: fontSize.base };

/** Normaliza aliases legacy → variantes v3. */
function resolveVariant(v: ButtonVariant): 'accent' | 'surface' | 'ghost' {
  if (v === 'primary') return 'accent';
  if (v === 'secondary') return 'surface';
  return v;
}

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'accent',
  size = 'md',
}: ButtonProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const inactive = loading || disabled;
  const resolved = resolveVariant(variant);

  const handlePress = () => {
    if (inactive) return;
    haptic('light');
    onPress();
  };

  const height = HEIGHT[size];
  const hPadding = H_PADDING[size];
  const fs = FONT_SIZE[size];

  // Colores por variante
  const bg =
    resolved === 'accent'
      ? colors.accent
      : resolved === 'surface'
      ? colors.surface2
      : 'transparent';
  const fg =
    resolved === 'accent'
      ? colors.onAccent
      : resolved === 'ghost'
      ? colors.accent
      : colors.textPrimary;
  const borderColor = resolved === 'surface' ? colors.hairlineStrong : 'transparent';
  const elevation =
    resolved === 'accent' ? glow('soft') : resolved === 'surface' ? shadows.sm : undefined;

  return (
    <Animated.View style={[animatedStyle, { opacity: inactive ? 0.46 : 1 }]}>
      <Pressable
        testID="button"
        accessibilityRole="button"
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        style={[
          styles.base,
          {
            height,
            paddingHorizontal: hPadding,
            borderRadius: radii.md,
            backgroundColor: bg,
            borderWidth: resolved === 'surface' ? 1 : 0,
            borderColor,
          },
          elevation,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg} size="small" />
        ) : (
          <Text style={[styles.label, { fontSize: fs, color: fg }]}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  label: {
    fontFamily: fontFamily.sansSemibold,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.2,
  },
});
