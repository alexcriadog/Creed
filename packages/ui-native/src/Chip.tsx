/**
 * Chip — etiqueta seleccionable con toggle (v3 dark atlético).
 *
 * Activo:   wash de acento + borde acento + texto acento
 * Inactivo: surface2 + hairline + texto secondary
 *
 * API preservada: { label, selected?, onPress?, testID? }.
 */

import { Pressable, Text, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale, haptic } from './motion';
import { colors, radii, spacing, fontSize, fontFamily, fontWeight } from './theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: (nextSelected: boolean) => void;
  testID?: string;
}

export function Chip({ label, selected = false, onPress, testID }: ChipProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();

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
            borderColor: selected ? colors.accent : colors.hairline,
            backgroundColor: selected ? colors.accentSoft : colors.surface2,
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
