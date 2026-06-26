/**
 * IconButton — botón circular para iconos (v3 dark atlético) con press-spring + háptica.
 *
 * Variantes:
 *   glass  → surface2 + hairline (default; el back/close circular del header)
 *   accent → wash de acento + borde acento
 *   ghost  → transparente
 *
 * Pasa el icono como children:
 *   <IconButton onPress={...}><ChevronLeft color={colors.textPrimary} size={22} /></IconButton>
 *
 * API preservada: { onPress, children, size?, hapticKind?, variant?, ... }.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale, haptic, HapticKind } from './motion';
import { colors, shadows } from './theme';

export interface IconButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  /** Tamaño del contenedor circular. Default 44. */
  size?: number;
  /** Tipo de feedback háptico. Default 'light'. */
  hapticKind?: HapticKind;
  /** Variante de fondo. Default 'glass'. */
  variant?: 'glass' | 'ghost' | 'accent';
  accessibilityLabel?: string;
  testID?: string;
  disabled?: boolean;
}

export function IconButton({
  onPress,
  children,
  size = 44,
  hapticKind = 'light',
  variant = 'glass',
  accessibilityLabel,
  testID,
  disabled = false,
}: IconButtonProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();

  const bgColor =
    variant === 'accent'
      ? colors.accentSoft
      : variant === 'glass'
      ? colors.surface2
      : 'transparent';

  const borderColor =
    variant === 'accent'
      ? colors.accent
      : variant === 'ghost'
      ? 'transparent'
      : colors.hairline;

  const handlePress = () => {
    if (disabled) return;
    haptic(hapticKind);
    onPress();
  };

  return (
    <Animated.View style={[animatedStyle, { opacity: disabled ? 0.45 : 1 }]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <View
          style={[
            styles.container,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: bgColor,
              borderColor,
            },
            variant === 'glass' ? shadows.sm : undefined,
          ]}
        >
          {children}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
