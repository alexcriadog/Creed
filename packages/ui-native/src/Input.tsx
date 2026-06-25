/**
 * Input — campo de texto con label superior, focus ring y estado de error.
 */

import { useState } from 'react';
import {
  TextInput,
  TextInputProps,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { getColors, radii, spacing, fontSize, fontFamily, fontWeight } from './theme';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
}

export function Input({ label, error, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);
  const colors = getColors('light');

  const borderColor = error
    ? colors.statusRed
    : focused
    ? colors.accent
    : colors.borderDefault;

  return (
    <View style={styles.container}>
      {label ? (
        <Text
          style={[
            styles.label,
            {
              color: error ? colors.statusRed : focused ? colors.accent : colors.textSecondary,
              fontFamily: fontFamily.sansMedium,
            },
          ]}
        >
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputWrapper,
          {
            borderColor,
            borderWidth: focused ? 2 : 1,
            borderRadius: radii.md,
            backgroundColor: colors.bgSurface,
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              color: colors.textPrimary,
              fontFamily: fontFamily.sans,
            },
          ]}
          placeholderTextColor={colors.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          {...props}
        />
      </View>
      {error ? (
        <Text
          style={[
            styles.errorText,
            { color: colors.statusRed, fontFamily: fontFamily.sans },
          ]}
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[1],
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: 4,
  },
  inputWrapper: {
    overflow: 'hidden',
  },
  input: {
    fontSize: fontSize.base,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 48,
  },
  errorText: {
    fontSize: fontSize.xs,
    marginTop: 4,
  },
});
