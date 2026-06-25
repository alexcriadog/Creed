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

export type GlassCardTone = 'light' | 'dark' | 'prominent';

export interface GlassCardProps extends ViewProps {
  /** Intensidad del blur: 0–100. Default 55. */
  intensity?: number;
  /** Tono del tint de blurView. Default 'dark'. */
  tone?: GlassCardTone;
  /** Padding interno. Default spacing.card (20). */
  padding?: number;
}

export function GlassCard({
  intensity = 55,
  tone = 'dark',
  padding = spacing.card,
  style,
  children,
  ...props
}: GlassCardProps) {
  const colors = getColors('dark');

  return (
    <View
      style={[
        styles.wrapper,
        shadows.md,
        {
          borderRadius: radii.lg,
          borderColor: colors.borderSubtle,
        },
        style,
      ]}
      {...props}
    >
      <BlurView
        intensity={intensity}
        tint={tone}
        style={[StyleSheet.absoluteFill, { borderRadius: radii.lg, overflow: 'hidden' }]}
      />
      {/* Overlay tint para dar profundidad */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radii.lg,
            backgroundColor: colors.bgSurface,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
          },
        ]}
        pointerEvents="none"
      />
      <View style={{ padding, zIndex: 1 }}>{children}</View>
    </View>
  );
}

/** Surface — alias de GlassCard con ajustes por defecto para paneles secundarios. */
export function Surface({ style, ...props }: GlassCardProps) {
  return (
    <GlassCard
      tone="dark"
      intensity={40}
      style={style}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderWidth: 1,
  },
});
