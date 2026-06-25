/**
 * FAB — Floating Action Button circular con gradiente accent, sombra elevada y háptica.
 *
 * Pasa el icono como children:
 *   <FAB onPress={...}><Plus color="#FCFCFD" size={24} /></FAB>
 */

import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { usePressScale, haptic, HapticKind } from './motion';
import { gradients, shadows } from './theme';

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
          ...shadows.lg,
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
        <LinearGradient
          colors={gradients.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.container,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <View style={styles.inner}>{children}</View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
