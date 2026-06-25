/**
 * Divider — separador horizontal sutil.
 */

import { View, StyleSheet, ViewProps } from 'react-native';
import { getColors } from './theme';

export interface DividerProps extends ViewProps {
  /** Color override. Por defecto usa borderSubtle del theme. */
  color?: string;
}

export function Divider({ color, style, ...props }: DividerProps) {
  const colors = getColors('light');

  return (
    <View
      style={[
        styles.divider,
        { backgroundColor: color ?? colors.borderDefault },
        style,
      ]}
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
