/**
 * Header — barra superior con título, acción back opcional y acción derecha.
 * Respeta el safe-area top vía useSafeAreaInsets.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getColors, spacing, fontSize, fontFamily, fontWeight } from './theme';

export interface HeaderProps {
  title: string;
  /** Callback para acción volver */
  onBack?: () => void;
  /** Componente/nodo a mostrar en la esquina derecha */
  rightAction?: React.ReactNode;
  /** Si debe incluir el padding del safe-area top */
  withSafeArea?: boolean;
}

export function Header({
  title,
  onBack,
  rightAction,
  withSafeArea = true,
}: HeaderProps) {
  const insets = useSafeAreaInsets();
  const colors = getColors('light');

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: withSafeArea ? insets.top + spacing[3] : spacing[3],
          borderBottomColor: colors.borderSubtle,
        },
      ]}
    >
      {/* Back button */}
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={[styles.backArrow, { color: colors.accent }]}>{'‹'}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Title */}
      <Text
        style={[
          styles.title,
          {
            color: colors.textPrimary,
            fontFamily: fontFamily.sansSemibold,
          },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>

      {/* Right action */}
      <View style={[styles.side, styles.sideRight]}>
        {rightAction ?? null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  backBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 28,
    fontWeight: fontWeight.semibold,
    lineHeight: 32,
  },
  title: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
});
