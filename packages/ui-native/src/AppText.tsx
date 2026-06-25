/**
 * AppText — tipografía del sistema de diseño Creed.
 *
 * Variantes: display / title / heading / body / label / muted
 * Los alias title/body/muted del Text.tsx original siguen funcionando.
 */

import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { getColors, fontSize, fontFamily, fontWeight, lineHeight } from './theme';

export type AppTextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'label'
  | 'muted';

export interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
}

const colors = getColors('light');

const variantStyles = StyleSheet.create({
  display: {
    fontFamily: fontFamily.sansBold,
    fontWeight: fontWeight.bold,
    fontSize: fontSize['3xl'],
    lineHeight: fontSize['3xl'] * lineHeight.tight,
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  title: {
    fontFamily: fontFamily.sansSemibold,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize['2xl'],
    lineHeight: fontSize['2xl'] * lineHeight.snug,
    color: colors.textPrimary,
    letterSpacing: -0.5,
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
