/**
 * Badge — etiqueta de estado o grupo muscular (v3 dark atlético).
 *
 * tone:
 *   'green'   → accent lima (completado, bueno)
 *   'amber'   → warn (advertencia, moderado)
 *   'red'     → danger (error, intenso)
 *   'accent'  → accent lima (destacado)
 *   'default' → surface2 + hairline (neutro)
 *
 * API preservada: { label, tone?, size? }.
 */

import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, fontSize, fontFamily, fontWeight } from './theme';

export type BadgeTone = 'green' | 'amber' | 'red' | 'accent' | 'default';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** Tamaño. Default 'sm'. */
  size?: 'sm' | 'md';
}

export function Badge({ label, tone = 'default', size = 'sm' }: BadgeProps) {
  const toneStyles: Record<BadgeTone, { bg: string; text: string; border: string }> = {
    green: {
      bg: 'rgba(198,255,58,0.12)',
      text: colors.accent,
      border: 'rgba(198,255,58,0.30)',
    },
    amber: {
      bg: 'rgba(255,180,77,0.13)',
      text: colors.warn,
      border: 'rgba(255,180,77,0.32)',
    },
    red: {
      bg: 'rgba(255,93,93,0.13)',
      text: colors.danger,
      border: 'rgba(255,93,93,0.32)',
    },
    accent: {
      bg: colors.accentSoft,
      text: colors.accent,
      border: 'rgba(198,255,58,0.32)',
    },
    default: {
      bg: colors.surface2,
      text: colors.textSecondary,
      border: colors.hairline,
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
