/**
 * GlassCard / Surface — superficie elevada del design system v3 (dark atlético).
 *
 * v3: "cristal oscuro con luz" → NO blur (sobre negro embarra). En su lugar:
 * surface1 + hairline (1px) + sombra suave hacia abajo. La variante `glow`
 * añade borde acento + halo accentGlow (tarjetas activas / con foco).
 *
 * API preservada: { intensity?, tone?, padding?, ...ViewProps }.
 *   - `intensity` y `tone` se conservan por compatibilidad pero ya no aplican
 *     blur (el sistema v3 es de superficies opacas). `glow` es nuevo.
 */

import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, glow, radii, shadows, spacing } from './theme';

export type GlassCardTone = 'light' | 'dark';

export interface GlassCardProps extends ViewProps {
  /** @deprecated v3 no usa blur. Se conserva por compatibilidad de API. */
  intensity?: number;
  /** @deprecated v3 es dark fijo. Se conserva por compatibilidad de API. */
  tone?: GlassCardTone;
  /** Padding interno. Default spacing.card (20). */
  padding?: number;
  /** Tarjeta activa/foco: borde acento + halo accentGlow. Default false. */
  glow?: boolean;
}

export function GlassCard({
  // intensity / tone retenidos en la firma pero no usados (compat)
  intensity: _intensity,
  tone: _tone,
  padding = spacing.card,
  glow: glowing = false,
  style,
  children,
  ...props
}: GlassCardProps) {
  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: radii.lg,
          backgroundColor: colors.surface1,
          borderColor: glowing ? colors.accent : colors.hairline,
          borderWidth: glowing ? 1.5 : 1,
          padding,
        },
        glowing ? glow('soft') : shadows.md,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

/** Surface — alias de GlassCard para paneles secundarios. */
export function Surface({ style, ...props }: GlassCardProps) {
  return <GlassCard style={style} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
});
