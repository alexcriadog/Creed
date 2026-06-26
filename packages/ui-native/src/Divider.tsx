/**
 * Divider — separador horizontal hairline (v3 dark atlético).
 *
 * API preservada: { color?, ...ViewProps }. Por defecto usa el hairline del theme.
 */

import { View, StyleSheet, ViewProps } from 'react-native';
import { colors } from './theme';

export interface DividerProps extends ViewProps {
  /** Color override. Por defecto usa `hairline` del theme. */
  color?: string;
}

export function Divider({ color, style, ...props }: DividerProps) {
  return (
    <View
      style={[styles.divider, { backgroundColor: color ?? colors.hairline }, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
});
