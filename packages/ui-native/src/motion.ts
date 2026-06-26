/**
 * motion.ts — hooks de animación y utilidades hápticas (design system v3)
 *
 * Reanimated 4.x: los callbacks de useAnimatedStyle se ejecutan
 * automáticamente en el UI thread — no se necesita la directiva 'worklet'.
 *
 * Motion v3 (dark atlético): spring press físico, entradas escalonadas rápidas,
 * y un "pop" para el momento memorable (check de serie). Todo en transform/opacity
 * (compositor) y respetando reduced-motion.
 */

import { useCallback, useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withSpring,
  withTiming,
  withSequence,
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

const PRESS_SCALE = 0.96;

/** Spring táctil — vivo pero contenido (sensación atlética, no rebote chillón). */
const pressSpring = {
  damping: 16,
  stiffness: 340,
  mass: 0.7,
} as const;

/**
 * Hook que devuelve un estilo animado con escala 0.96 al pulsar, vía spring físico.
 * Respeta reduced-motion (si está activo, no escala).
 *
 * Ejemplo:
 *   const { animatedStyle, onPressIn, onPressOut } = usePressScale();
 *   <Animated.View style={animatedStyle}>
 *     <Pressable onPressIn={onPressIn} onPressOut={onPressOut} />
 *   </Animated.View>
 */
export function usePressScale(): PressScaleResult {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = useCallback(() => {
    if (reduced) return;
    scale.value = withSpring(PRESS_SCALE, pressSpring);
  }, [reduced, scale]);

  const onPressOut = useCallback(() => {
    if (reduced) return;
    scale.value = withSpring(1, pressSpring);
  }, [reduced, scale]);

  return { animatedStyle, onPressIn, onPressOut };
}

// ─── Fade + slide entrance ────────────────────────────────────────────────────

/**
 * Hook de entrada: fade-in + translateY desde 12px hacia arriba.
 * Ideal para staged reveals (stagger delay entre elementos de lista).
 * Rápido (<350ms) y fluido. Respeta reduced-motion (aparece sin desplazamiento).
 *
 * @param delayMs — retraso en ms antes de iniciar la animación (default: 0)
 *
 * Ejemplo con stagger:
 *   const style0 = useFadeSlideIn(0);
 *   const style1 = useFadeSlideIn(60);
 *   const style2 = useFadeSlideIn(120);
 */
export function useFadeSlideIn(delayMs = 0): AnimatedStyle<ViewStyle> {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(reduced ? 0 : 12);

  useEffect(() => {
    if (reduced) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }
    const timingConfig = { duration: duration.slow }; // 320ms
    opacity.value = withDelay(delayMs, withTiming(1, timingConfig));
    translateY.value = withDelay(
      delayMs,
      withSpring(0, { damping: 22, stiffness: 220, mass: 0.9 })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

// ─── Pop (momento memorable: check de serie) ───────────────────────────────────

export type PopResult = {
  /** AnimatedStyle para aplicar a un Animated.View. */
  animatedStyle: AnimatedStyle<ViewStyle>;
  /** Dispara el pop (scale up → settle). Llamar al completar la serie. */
  pop: () => void;
};

/**
 * usePop — un "pop" de escala reutilizable para el momento de confirmación
 * (p. ej. el check de serie: la pastilla rebota con un overshoot lima + glow).
 *
 * @param peak — escala máxima del pop. Default 1.18.
 *
 * Ejemplo:
 *   const { animatedStyle, pop } = usePop();
 *   onComplete={() => { pop(); haptic('success'); }}
 *   <Animated.View style={animatedStyle}>…</Animated.View>
 */
export function usePop(peak = 1.18): PopResult {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pop = useCallback(() => {
    if (reduced) return;
    scale.value = withSequence(
      withSpring(peak, { damping: 9, stiffness: 320, mass: 0.6 }),
      withSpring(1, { damping: 14, stiffness: 280, mass: 0.7 })
    );
  }, [peak, reduced, scale]);

  return { animatedStyle, pop };
}

// ─── Haptics ──────────────────────────────────────────────────────────────────

export type HapticKind = 'light' | 'medium' | 'success';

/**
 * Wrapper thin sobre expo-haptics.
 * - 'light'   → ImpactFeedbackStyle.Light   (tap genérico, ticks de arrastre)
 * - 'medium'  → ImpactFeedbackStyle.Medium  (acciones significativas)
 * - 'success' → NotificationFeedbackType.Success (confirmación, swipe cruzado)
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
