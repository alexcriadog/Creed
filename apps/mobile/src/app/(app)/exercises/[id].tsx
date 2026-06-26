/**
 * Detalle de ejercicio — dark atlético v3.
 * Canvas negro + orbe. Hero image fullbleed con overlay gradiente.
 * Nombre en Space Grotesk display. Badges de músculo/equipamiento.
 * Instrucciones en dark surface1. Circular back.
 * Lógica preservada: getExercise / loading / not-found states.
 */

import { useEffect, useState } from 'react';
import { ScrollView, View, StyleSheet, ActivityIndicator } from 'react-native';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppText,
  Badge,
  Header,
  Divider,
  useFadeSlideIn,
  colors,
  gradients,
  glow,
  spacing,
  radii,
  shadows,
  fontFamily,
  fontSize,
} from '@creed/ui-native';
import { getExercise, displayName, type Exercise } from '../../../lib/exercises';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);

  const slideContent = useFadeSlideIn(60);

  useEffect(() => {
    let active = true;
    getExercise(String(id))
      .then((e) => active && setExercise(e))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <LinearGradient
          colors={gradients.canvasV3}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!exercise) {
    return (
      <View style={[styles.root, styles.center]}>
        <LinearGradient
          colors={gradients.canvasV3}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Header title="" onBack={() => router.back()} withSafeArea />
        <AppText variant="muted">Ejercicio no encontrado.</AppText>
      </View>
    );
  }

  const metaBadges = [exercise.primary_muscle, exercise.equipment].filter(
    Boolean
  ) as string[];

  return (
    <View style={styles.root}>
      {/* Fondo dark atlético */}
      <LinearGradient
        colors={gradients.canvasV3}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Orbe lima tenue */}
      <LinearGradient
        colors={gradients.accentOrb}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.15, y: 0.6 }}
        style={[styles.orb, styles.orbTopRight]}
      />

      <Header title="" onBack={() => router.back()} withSafeArea />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image fullbleed con overlay y nombre en Space Grotesk display */}
        {exercise.image_url ? (
          <View style={[styles.heroWrap, shadows.md]}>
            <Image
              source={{ uri: exercise.image_url }}
              style={styles.heroImage}
              contentFit="cover"
              transition={300}
            />
            {/* Overlay: transparente arriba → negro profundo abajo */}
            <LinearGradient
              colors={['transparent', 'rgba(10,11,13,0.88)']}
              locations={[0.35, 1]}
              style={[StyleSheet.absoluteFill, { borderRadius: radii.xl }]}
            />
            <View style={styles.heroOverlay}>
              <AppText style={styles.heroTitle} numberOfLines={3}>
                {displayName(exercise)}
              </AppText>
              {metaBadges.length > 0 ? (
                <View style={styles.heroBadges}>
                  {metaBadges.map((b) => (
                    <Badge key={b} label={b} tone="accent" size="sm" />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <Animated.View style={[styles.titleNoImageWrap, slideContent]}>
            <AppText style={styles.titleNoImage}>{displayName(exercise)}</AppText>
            {metaBadges.length > 0 ? (
              <View style={styles.metaRow}>
                {metaBadges.map((b) => (
                  <Badge key={b} label={b} tone="accent" size="md" />
                ))}
              </View>
            ) : null}
          </Animated.View>
        )}

        {/* Detail sections */}
        <Animated.View style={[styles.sections, slideContent]}>
          {/* Meta badges below image */}
          {exercise.image_url && metaBadges.length > 0 ? (
            <View style={styles.metaRow}>
              {metaBadges.map((b) => (
                <Badge key={b} label={b} tone="accent" size="md" />
              ))}
            </View>
          ) : null}

          {/* Instructions — dark surface1 card */}
          {exercise.instructions.length > 0 ? (
            <View style={[styles.instructionsCard, glow('soft')]}>
              <AppText variant="heading" style={styles.sectionTitle}>
                Instrucciones
              </AppText>
              <Divider style={styles.sectionDivider} />
              <View style={styles.stepsWrap}>
                {exercise.instructions.map((step, i) => (
                  <View key={i} style={styles.step}>
                    <View style={styles.stepNumber}>
                      <AppText style={styles.stepNumberText}>{i + 1}</AppText>
                    </View>
                    <AppText variant="body" style={styles.stepText}>
                      {step}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Orbe
  orb: {
    position: 'absolute',
    borderRadius: radii.pill,
  },
  orbTopRight: {
    width: 300,
    height: 300,
    top: -100,
    right: -80,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing[12],
    gap: spacing[4],
  },

  // Hero image
  heroWrap: {
    marginHorizontal: spacing[5],
    marginTop: spacing[2],
    borderRadius: radii.xl,
    overflow: 'hidden',
    height: 280,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  heroImage: {
    width: '100%',
    height: 280,
    borderRadius: radii.xl,
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing[5],
    gap: spacing[2],
  },
  heroTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.textPrimary,
    letterSpacing: -1,
    lineHeight: fontSize['2xl'] * 1.1,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
  },

  // No image fallback
  titleNoImageWrap: {
    marginHorizontal: spacing[5],
    marginTop: spacing[3],
    gap: spacing[3],
  },
  titleNoImage: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.textPrimary,
    letterSpacing: -1,
    lineHeight: fontSize['2xl'] * 1.1,
  },

  // Sections
  sections: {
    paddingHorizontal: spacing[5],
    gap: spacing[4],
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
  },

  // Instructions card — dark surface1
  instructionsCard: {
    backgroundColor: colors.surface1,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing[5],
    ...shadows.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    marginBottom: spacing[1],
  },
  sectionDivider: {
    marginBottom: spacing[3],
  },
  stepsWrap: {
    gap: spacing[3],
  },
  step: {
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
    borderWidth: 1,
    borderColor: 'rgba(198,255,58,0.2)',
  },
  stepNumberText: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xs,
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  stepText: {
    flex: 1,
    lineHeight: 24,
    color: colors.textSecondary,
  },
});
