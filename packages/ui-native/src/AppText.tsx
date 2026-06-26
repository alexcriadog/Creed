/**
 * AppText — tipografía del design system v3 (dark atlético).
 *
 * Variantes:
 *   display  → Space Grotesk Bold, grande, héroe (titulares)
 *   eyebrow  → Space Grotesk Medium, pequeño, espaciado + uppercase (kicker)
 *   stat     → Space Grotesk Bold, tabular-nums grande (peso, cronómetro, X/Y series)
 *   title    → (legacy) Space Grotesk Bold, subtítulo grande
 *   heading  → Inter SemiBold, encabezado de sección
 *   body     → Inter Regular, texto base
 *   label    → Inter Medium, etiquetas/secundario
 *   muted    → Inter Regular, terciario tenue
 *
 * Display / eyebrow / stat / title usan Space Grotesk; el resto Inter.
 * Los alias title/body/muted del Text.tsx original siguen funcionando.
 */

import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { colors, fontSize, fontFamily, fontWeight, lineHeight } from './theme';

export type AppTextVariant =
  | 'display'
  | 'eyebrow'
  | 'stat'
  | 'title'
  | 'heading'
  | 'body'
  | 'label'
  | 'muted';

export interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
}

const variantStyles = StyleSheet.create({
  display: {
    fontFamily: fontFamily.display,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.display,
    lineHeight: fontSize.display * lineHeight.tight,
    color: colors.textPrimary,
    letterSpacing: -1.2,
  },
  eyebrow: {
    fontFamily: fontFamily.displayMedium,
    fontWeight: fontWeight.medium,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * lineHeight.snug,
    color: colors.textSecondary,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  stat: {
    fontFamily: fontFamily.display,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.numeric,
    // Space Grotesk tiene glifos altos: tight (1.05) recortaba el número.
    // ~1.15× deja respirar el "0" arriba/abajo sin descuadrar el baseline.
    lineHeight: fontSize.numeric * lineHeight.statNumber,
    color: colors.textPrimary,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    paddingVertical: 2,
  },
  title: {
    fontFamily: fontFamily.display,
    fontWeight: fontWeight.bold,
    fontSize: fontSize['2xl'],
    lineHeight: fontSize['2xl'] * lineHeight.snug,
    color: colors.textPrimary,
    letterSpacing: -0.6,
  },
  heading: {
    fontFamily: fontFamily.sansSemibold,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * lineHeight.snug,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: fontFamily.sans,
    fontWeight: fontWeight.regular,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.normal,
    color: colors.textPrimary,
  },
  label: {
    fontFamily: fontFamily.sansMedium,
    fontWeight: fontWeight.medium,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.snug,
    color: colors.textSecondary,
    letterSpacing: 0.1,
  },
  muted: {
    fontFamily: fontFamily.sans,
    fontWeight: fontWeight.regular,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
    color: colors.textMuted,
  },
});

export function AppText({ variant = 'body', style, ...props }: AppTextProps) {
  return <RNText style={[variantStyles[variant], style]} {...props} />;
}

/** Text — alias de AppText para compatibilidad con código existente. */
export { AppText as Text };
