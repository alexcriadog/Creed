/**
 * Chip — etiqueta seleccionable con toggle.
 *
 * Activo:   fondo accent soft + borde accent + texto accent
 * Inactivo: fondo glass + borde subtle + texto secondary
 */

import { Pressable, Text, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale, haptic } from './motion';
import { getColors, radii, spacing, fontSize, fontFamily, fontWeight } from './theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: (nextSelected: boolean) => void;
  testID?: string;
}

export function Chip({ label, selected = false, onPress, testID }: ChipProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const colors = getColors('dark');

  const handlePress = () => {
    haptic('light');
    onPress?.(!selected);
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        testID={testID ?? 'chip'}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        style={[
          styles.chip,
          {
            borderRadius: radii.pill,
            borderColor: selected ? colors.accent : colors.borderDefault,
            backgroundColor: selected ? colors.accentSoft : colors.bgSurfaceRaised,
          },
        ]}
      >
        <Text
          style={[
            styles.label,
            {
              color: selected ? colors.accent : colors.textSecondary,
              fontFamily: selected ? fontFamily.sansMedium : fontFamily.sans,
            },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2, // 6px vertical
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
});
