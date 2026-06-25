/**
 * GlassCard — superficie glass con expo-blur, borde sutil y sombra.
 *
 * Usa BlurView para el efecto frosted glass auténtico en iOS/Android.
 * En web cae a un fondo semitransparente.
 *
 * Surface es un alias thin que pre-configura tone='dark' + intensity=40.
 */

import { StyleSheet, View, ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { getColors, radii, shadows, spacing } from './theme';

export type GlassCardTone = 'light' | 'dark';

export interface GlassCardProps extends ViewProps {
  /** Intensidad del blur: 0–100. Default 55. */
  intensity?: number;
  /** Tono del tint de blurView. Default 'light'. */
  tone?: GlassCardTone;
  /** Padding interno. Default spacing.card (20). */
  padding?: number;
}

export function GlassCard({
  intensity = 55,
  tone = 'light',
  padding = spacing.card,
  style,
  children,
  ...props
}: GlassCardProps) {
  const colors = getColors('light');

  return (
    // Outer view: carries shadow + borderRadius, NO overflow (iOS shadow would be clipped otherwise)
    <View
      style={[
        styles.outerWrapper,
        shadows.md,
        {
          borderRadius: radii.lg,
        },
        style,
      ]}
      {...props}
    >
      {/* Inner view: clips BlurView to rounded corners */}
      <View style={[styles.innerWrapper, { borderRadius: radii.lg }]}>
        <BlurView
          intensity={intensity}
          tint={tone}
          style={StyleSheet.absoluteFill}
        />
        {/* Overlay tint para dar profundidad */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors.bgSurface,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
            },
          ]}
          pointerEvents="none"
        />
        <View style={{ padding, zIndex: 1 }}>{children}</View>
      </View>
    </View>
  );
}

/** Surface — alias de GlassCard con ajustes por defecto para paneles secundarios. */
export function Surface({ style, ...props }: GlassCardProps) {
  return (
    <GlassCard
      tone="light"
      intensity={40}
      style={style}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  // No overflow here — iOS would clip the shadow
  outerWrapper: {},
  // overflow hidden here clips BlurView to rounded corners
  innerWrapper: {
    overflow: 'hidden',
  },
});
