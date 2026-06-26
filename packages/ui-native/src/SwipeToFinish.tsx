/**
 * SwipeToFinish — control de arrastrar-para-confirmar (v3 dark atlético).
 *
 * Reinventa "Finalizar entreno": pista oscura (surface2, ancho completo, ~60px,
 * pill) con un thumb lima arrastrable. Al arrastrar a la derecha el track se
 * rellena de lima por detrás del thumb y el label se desvanece. Cruzar ~85% +
 * soltar → `onFinish()` con háptica `success` (+ ticks ligeros al arrastrar).
 * Si se suelta antes del umbral, el thumb vuelve con spring.
 *
 * Accesible: `accessibilityRole="button"` + un fallback `onPress = onFinish`
 * (el Pressable de la pista) para que funcione sin gesto (lectores de pantalla,
 * web estática). Respeta reduced-motion.
 *
 * Props: { onFinish, label?, disabled?, loading? }.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { ChevronsRight } from 'lucide-react-native';
import { haptic } from './motion';
import { colors, fontFamily, fontSize, radii } from './theme';

export interface SwipeToFinishProps {
  /** Se dispara al cruzar el umbral + soltar (o vía fallback onPress). */
  onFinish: () => void;
  /** Texto guía. Default "Desliza para finalizar". */
  label?: string;
  disabled?: boolean;
  loading?: boolean;
}

const TRACK_HEIGHT = 60;
const THUMB_SIZE = 52;
const THUMB_INSET = (TRACK_HEIGHT - THUMB_SIZE) / 2;
const THRESHOLD = 0.85; // fracción del recorrido para confirmar
const TICK_STEP = 0.25; // ticks hápticos cada 25% del recorrido

const springBack = { damping: 18, stiffness: 280, mass: 0.7 } as const;

export function SwipeToFinish({
  onFinish,
  label = 'Desliza para finalizar',
  disabled = false,
  loading = false,
}: SwipeToFinishProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const reduced = useReducedMotion();

  // Recorrido máximo del thumb (de izq a der), en px.
  const maxX = Math.max(0, trackWidth - THUMB_SIZE - THUMB_INSET * 2);

  const x = useSharedValue(0);
  const lastTick = useSharedValue(0);
  const finished = useSharedValue(0);

  const inactive = disabled || loading;

  const onLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const tick = () => {
    haptic('light');
  };
  const confirm = () => {
    haptic('success');
    onFinish();
  };

  const pan = Gesture.Pan()
    .enabled(!inactive && maxX > 0)
    .onUpdate((e) => {
      const next = Math.min(Math.max(e.translationX, 0), maxX);
      x.value = next;
      // Ticks hápticos al cruzar marcas del recorrido.
      const frac = maxX > 0 ? next / maxX : 0;
      const mark = Math.floor(frac / TICK_STEP);
      if (mark !== lastTick.value) {
        lastTick.value = mark;
        runOnJS(tick)();
      }
    })
    .onEnd(() => {
      const frac = maxX > 0 ? x.value / maxX : 0;
      if (frac >= THRESHOLD) {
        finished.value = 1;
        x.value = withSpring(maxX, springBack);
        runOnJS(confirm)();
      } else {
        lastTick.value = 0;
        x.value = withSpring(0, springBack);
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  // El relleno lima crece detrás del thumb.
  const fillStyle = useAnimatedStyle(() => ({
    width: x.value + THUMB_SIZE + THUMB_INSET,
  }));

  // El label se desvanece a medida que se rellena.
  const labelStyle = useAnimatedStyle(() => ({
    opacity: maxX > 0 ? interpolate(x.value, [0, maxX * 0.6], [1, 0]) : 1,
  }));

  // Fallback accesible: completar de inmediato (sin gesto).
  const handleFallbackPress = () => {
    if (inactive) return;
    if (!reduced && maxX > 0) {
      finished.value = 1;
      x.value = withSpring(maxX, springBack);
    }
    confirm();
  };

  return (
    <View
      style={[styles.track, { opacity: inactive ? 0.5 : 1 }]}
      onLayout={onLayout}
    >
      {/* Relleno lima */}
      <Animated.View pointerEvents="none" style={[styles.fill, fillStyle]} />

      {/* Label (fallback Pressable: role button + onPress=onFinish) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPress={handleFallbackPress}
        style={styles.labelHit}
      >
        {loading ? (
          <ActivityIndicator color={colors.onAccent} size="small" />
        ) : (
          <Animated.Text style={[styles.label, labelStyle]}>{label}</Animated.Text>
        )}
      </Pressable>

      {/* Thumb arrastrable */}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.thumb, thumbStyle]}>
          <ChevronsRight color={colors.onAccent} size={24} strokeWidth={2.6} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    width: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
  },
  labelHit: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fontFamily.displayMedium,
    fontSize: fontSize.base,
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  thumb: {
    position: 'absolute',
    left: THUMB_INSET,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
