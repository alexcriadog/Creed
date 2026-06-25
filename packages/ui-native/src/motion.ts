/**
 * motion.ts — hooks de animación y utilidades hápticas
 *
 * Reanimated 4.x: los callbacks de useAnimatedStyle se ejecutan
 * automáticamente en el UI thread — no se necesita la directiva 'worklet'.
 *
 * Referencia: docs/design.md §6 (motion tokens)
 */

import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import type { AnimatedStyle } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { ViewStyle } from 'react-native';
import { duration } from './theme';

// ─── Press scale ─────────────────────────────────────────────────────────────

export type PressScaleResult = {
  /** AnimatedStyle para aplicar a un Animated.View */
  animatedStyle: AnimatedStyle<ViewStyle>;
  /** Llamar al inicio del toque (onPressIn) */
  onPressIn: () => void;
  /** Llamar al final del toque (onPressOut) */
  onPressOut: () => void;
};

const PRESS_SCALE = 0.97;

const springConfig = {
  damping: 18,
  stiffness: 300,
  mass: 0.8,
} as const;

/**
 * Hook que devuelve un estilo animado con escala 0.97 al pulsar.
 * Usa un spring físico para dar retroalimentación táctil visual.
 *
 * Ejemplo:
 *   const { animatedStyle, onPressIn, onPressOut } = usePressScale();
 *   <Animated.View style={animatedStyle}>
 *     <Pressable onPressIn={onPressIn} onPressOut={onPressOut} />
 *   </Animated.View>
 */
export function usePressScale(): PressScaleResult {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(PRESS_SCALE, springConfig);
  };

  const onPressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  return { animatedStyle, onPressIn, onPressOut };
}

// ─── Fade + slide entrance ────────────────────────────────────────────────────

/**
 * Hook de entrada: fade-in + translateY desde 12px hacia arriba.
 * Ideal para staged reveals (stagger delay entre elementos de lista).
 *
 * @param delayMs — retraso en ms antes de iniciar la animación (default: 0)
 *
 * Ejemplo con stagger:
 *   const style0 = useFadeSlideIn(0);
 *   const style1 = useFadeSlideIn(60);
 *   const style2 = useFadeSlideIn(120);
 */
export function useFadeSlideIn(delayMs = 0): AnimatedStyle<ViewStyle> {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    const timingConfig = {
      duration: duration.slow, // 320ms
    };

    opacity.value = withDelay(delayMs, withTiming(1, timingConfig));
    translateY.value = withDelay(
      delayMs,
      withSpring(0, {
        damping: 22,
        stiffness: 200,
        mass: 1,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

// ─── Haptics ──────────────────────────────────────────────────────────────────

export type HapticKind = 'light' | 'medium' | 'success';

/**
 * Wrapper thin sobre expo-haptics.
 * - 'light'   → ImpactFeedbackStyle.Light   (tap genérico)
 * - 'medium'  → ImpactFeedbackStyle.Medium  (acciones significativas)
 * - 'success' → NotificationFeedbackType.Success (confirmación)
 *
 * No lanza — si el dispositivo no soporta háptica, falla silenciosamente.
 */
export async function haptic(kind: HapticKind): Promise<void> {
  try {
    if (kind === 'success') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (kind === 'medium') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // Háptica no disponible en simulador o dispositivo sin soporte
  }
}
