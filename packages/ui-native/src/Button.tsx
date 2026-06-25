/**
 * Button — componente premium con gradiente, glass y press-scale.
 *
 * API preservada: { label, onPress, loading?, disabled?, variant? }
 * Extensiones: size sm/md, variante 'secondary' (glass).
 */

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { usePressScale, haptic } from './motion';
import { getColors, gradients, radii, spacing, fontSize, fontFamily, fontWeight, shadows } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 40, md: 48 };
const H_PADDING: Record<ButtonSize, number> = { sm: spacing[4], md: spacing[5] };
const FONT_SIZE: Record<ButtonSize, number> = { sm: fontSize.sm, md: fontSize.base };

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
}: ButtonProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const colors = getColors('dark');
  const inactive = loading || disabled;

  const handlePress = () => {
    if (inactive) return;
    haptic('light');
    onPress();
  };

  const height = HEIGHT[size];
  const hPadding = H_PADDING[size];
  const fs = FONT_SIZE[size];

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
      >
        {variant === 'primary' ? (
          <LinearGradient
            colors={gradients.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.base, { height, paddingHorizontal: hPadding, borderRadius: radii.md }, shadows.sm]}
          >
            {loading ? (
              <ActivityIndicator color={colors.textOnAccent} size="small" />
            ) : (
              <Text style={[styles.label, { fontSize: fs, color: colors.textOnAccent }]}>{label}</Text>
            )}
          </LinearGradient>
        ) : variant === 'secondary' ? (
          <View
            style={[
              styles.base,
              {
                height,
                paddingHorizontal: hPadding,
                borderRadius: radii.md,
                backgroundColor: colors.bgSurface,
                borderWidth: 1,
                borderColor: colors.borderDefault,
              },
              shadows.sm,
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={[styles.label, { fontSize: fs, color: colors.accent }]}>{label}</Text>
            )}
          </View>
        ) : (
          /* ghost */
          <View
            style={[
              styles.base,
              {
                height,
                paddingHorizontal: hPadding,
                borderRadius: radii.md,
                backgroundColor: 'transparent',
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={[styles.label, { fontSize: fs, color: colors.accent }]}>{label}</Text>
            )}
          </View>
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
