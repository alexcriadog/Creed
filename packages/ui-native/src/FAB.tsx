/**
 * FAB — Floating Action Button circular (v3 dark atlético): relleno lima + glow
 * + press-spring + háptica. Icono onAccent (casi negro) para contraste sobre lima.
 *
 * Pasa el icono como children:
 *   <FAB onPress={...}><Plus color={colors.onAccent} size={24} /></FAB>
 *
 * API preservada: { onPress, children, size?, hapticKind?, ... }.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale, haptic, HapticKind } from './motion';
import { colors, glow } from './theme';

export interface FABProps {
  onPress: () => void;
  children: React.ReactNode;
  /** Tamaño del botón circular. Default 56. */
  size?: number;
  /** Tipo de feedback háptico. Default 'medium'. */
  hapticKind?: HapticKind;
  accessibilityLabel?: string;
  testID?: string;
  disabled?: boolean;
}

export function FAB({
  onPress,
  children,
  size = 56,
  hapticKind = 'medium',
  accessibilityLabel = 'Acción principal',
  testID,
  disabled = false,
}: FABProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();

  const handlePress = () => {
    if (disabled) return;
    haptic(hapticKind);
    onPress();
  };

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          opacity: disabled ? 0.45 : 1,
          borderRadius: size / 2,
          ...glow('strong'),
        },
      ]}
    >
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <View
          style={[
            styles.container,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.accent,
            },
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
  },
});
