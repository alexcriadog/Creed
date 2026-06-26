/**
 * ExerciseRail — riel horizontal compacto de ejercicios para el modo foco.
 *
 * Una pastilla por ejercicio con tres estados:
 *   - done    → relleno accent + check (todas las series marcadas)
 *   - current → anillo/énfasis accent (ejercicio en pantalla)
 *   - pending → muted (aún por hacer)
 *
 * Tocar una pastilla salta a ese ejercicio. La pastilla actual se auto-scrollea
 * a la vista cuando cambia el índice. Da una vista general sin un scroll largo.
 *
 * App-specific (orquesta el pager de la sesión) → vive en components/session.
 */

import { memo, useEffect, useRef } from 'react';
import { ScrollView, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import {
  AppText,
  haptic,
  lightColors,
  spacing,
} from '@creed/ui-native';

export type RailSegmentState = 'done' | 'current' | 'pending';

export interface RailSegment {
  /** Clave estable (exerciseId). */
  id: string;
  /** Estado visual. */
  state: RailSegmentState;
}

interface ExerciseRailProps {
  segments: RailSegment[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

const SEG_WIDTH = 44;
const SEG_GAP = spacing[2];

function ExerciseRailBase({
  segments,
  currentIndex,
  onSelect,
}: ExerciseRailProps) {
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll: centra (lo más posible) la pastilla actual al cambiar índice.
  useEffect(() => {
    const offset = Math.max(
      0,
      currentIndex * (SEG_WIDTH + SEG_GAP) - SEG_WIDTH * 2
    );
    scrollRef.current?.scrollTo({ x: offset, animated: true });
  }, [currentIndex]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {segments.map((seg, index) => (
        <RailPill
          key={seg.id}
          index={index}
          state={seg.state}
          isCurrent={index === currentIndex}
          onPress={() => {
            haptic('light');
            onSelect(index);
          }}
        />
      ))}
    </ScrollView>
  );
}

interface RailPillProps {
  index: number;
  state: RailSegmentState;
  isCurrent: boolean;
  onPress: () => void;
}

/** Pastilla individual del riel — el énfasis "current" se anima al activarse. */
function RailPillBase({ index, state, isCurrent, onPress }: RailPillProps) {
  const emphasis = useSharedValue(isCurrent ? 1 : 0);

  useEffect(() => {
    emphasis.value = withTiming(isCurrent ? 1 : 0, { duration: 220 });
  }, [isCurrent, emphasis]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: emphasis.value,
    transform: [{ scale: 0.9 + emphasis.value * 0.1 }],
  }));

  const done = state === 'done';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ir al ejercicio ${index + 1}`}
      accessibilityState={{ selected: isCurrent }}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={styles.pillWrap}
    >
      {/* Anillo de énfasis (current) — animado, detrás de la pastilla */}
      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />

      <View
        style={[
          styles.pill,
          done && styles.pillDone,
          isCurrent && styles.pillCurrent,
        ]}
      >
        {done ? (
          <Check size={18} color={lightColors.textOnAccent} strokeWidth={3} />
        ) : (
          <AppText
            variant="label"
            style={[styles.pillLabel, isCurrent && styles.pillLabelCurrent]}
          >
            {index + 1}
          </AppText>
        )}
      </View>
    </Pressable>
  );
}

const RailPill = memo(RailPillBase);

export const ExerciseRail = memo(ExerciseRailBase);

const RING_SIZE = SEG_WIDTH + 8;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    gap: SEG_GAP,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillWrap: {
    width: SEG_WIDTH,
    height: SEG_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: lightColors.accent,
  },
  pill: {
    width: SEG_WIDTH,
    height: SEG_WIDTH,
    borderRadius: SEG_WIDTH / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightColors.bgSurfaceRaised,
    borderWidth: 1,
    borderColor: lightColors.borderDefault,
  },
  pillDone: {
    backgroundColor: lightColors.accent,
    borderColor: lightColors.accent,
  },
  pillCurrent: {
    backgroundColor: lightColors.accentSoft,
    borderColor: lightColors.accent,
  },
  pillLabel: {
    color: lightColors.textMuted,
    fontWeight: '700',
  },
  pillLabelCurrent: {
    color: lightColors.accent,
  },
});
