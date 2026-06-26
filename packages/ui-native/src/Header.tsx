/**
 * Header — barra superior v3 (dark atlético) con back/close circular integrado.
 *
 * Esquina arriba-izq: IconButton circular (surface2 + hairline) con ChevronLeft
 * (onBack) o X (onClose) — navegación coherente en TODA pantalla. La acción
 * derecha es libre (rightAction). Respeta el safe-area top.
 *
 * API: { title, onBack?, onClose?, rightAction?, withSafeArea? }.
 *   - Si se pasan ambos, `onClose` (X) tiene prioridad visual.
 */

import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, X } from 'lucide-react-native';
import { IconButton } from './IconButton';
import { colors, spacing, fontSize, fontFamily, fontWeight } from './theme';

export interface HeaderProps {
  title: string;
  /** Callback para acción volver (icono ChevronLeft). */
  onBack?: () => void;
  /** Callback para acción cerrar (icono X). Prioritario sobre onBack si ambos. */
  onClose?: () => void;
  /** Componente/nodo a mostrar en la esquina derecha. */
  rightAction?: React.ReactNode;
  /** Si debe incluir el padding del safe-area top. */
  withSafeArea?: boolean;
}

export function Header({
  title,
  onBack,
  onClose,
  rightAction,
  withSafeArea = true,
}: HeaderProps) {
  const insets = useSafeAreaInsets();

  const navAction = onClose
    ? { onPress: onClose, label: 'Cerrar', icon: <X color={colors.textPrimary} size={22} strokeWidth={2.4} /> }
    : onBack
    ? { onPress: onBack, label: 'Volver', icon: <ChevronLeft color={colors.textPrimary} size={24} strokeWidth={2.4} /> }
    : null;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: withSafeArea ? insets.top + spacing[3] : spacing[3],
          borderBottomColor: colors.hairline,
        },
      ]}
    >
      {/* Back / close circular */}
      <View style={styles.side}>
        {navAction ? (
          <IconButton
            onPress={navAction.onPress}
            accessibilityLabel={navAction.label}
            variant="glass"
            size={40}
          >
            {navAction.icon}
          </IconButton>
        ) : null}
      </View>

      {/* Title */}
      <Text
        style={[styles.title, { color: colors.textPrimary, fontFamily: fontFamily.display }]}
        numberOfLines={1}
      >
        {title}
      </Text>

      {/* Right action */}
      <View style={[styles.side, styles.sideRight]}>{rightAction ?? null}</View>
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
  title: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
});
