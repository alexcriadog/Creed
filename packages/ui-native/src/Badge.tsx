/**
 * Badge — etiqueta de estado o grupo muscular.
 *
 * tone:
 *   'green'   → statusGreen (completado, bueno)
 *   'amber'   → statusAmber (advertencia, moderado)
 *   'red'     → statusRed (error, intenso)
 *   'accent'  → accent (destacado)
 *   'default' → bgSurfaceRaised (neutro)
 */

import { View, Text, StyleSheet } from 'react-native';
import { getColors, radii, spacing, fontSize, fontFamily, fontWeight } from './theme';

export type BadgeTone = 'green' | 'amber' | 'red' | 'accent' | 'default';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** Tamaño. Default 'sm'. */
  size?: 'sm' | 'md';
}

export function Badge({ label, tone = 'default', size = 'sm' }: BadgeProps) {
  const colors = getColors('dark');

  const toneStyles: Record<BadgeTone, { bg: string; text: string; border: string }> = {
    green: {
      bg: `${colors.statusGreen}22`,
      text: colors.statusGreen,
      border: `${colors.statusAmber}44`,
    },
    amber: {
      bg: `${colors.statusAmber}22`,
      text: colors.statusAmber,
      border: `${colors.statusAmber}44`,
    },
    red: {
      bg: `${colors.statusRed}22`,
      text: colors.statusRed,
      border: `${colors.statusRed}44`,
    },
    accent: {
      bg: colors.accentSoft,
      text: colors.accent,
      border: `${colors.accent}44`,
    },
    default: {
      bg: colors.bgSurfaceRaised,
      text: colors.textSecondary,
      border: colors.borderSubtle,
    },
  };

  const t = toneStyles[tone];
  const isMd = size === 'md';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: t.bg,
          borderColor: t.border,
          borderRadius: radii.pill,
          paddingHorizontal: isMd ? spacing[3] : spacing[2],
          paddingVertical: isMd ? 5 : 3,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: t.text,
            fontSize: isMd ? fontSize.sm : fontSize.xs,
            fontFamily: fontFamily.sansMedium,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontWeight: fontWeight.medium,
    letterSpacing: 0.2,
  },
});
