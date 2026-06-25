import { useEffect, useState } from 'react';
import { ScrollView, View, StyleSheet, ActivityIndicator } from 'react-native';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppText, Badge, GlassCard, Header, Divider,
  useFadeSlideIn, lightColors, spacing, radii, shadows,
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
        <ActivityIndicator color={lightColors.accent} size="large" />
      </View>
    );
  }
  if (!exercise) {
    return (
      <View style={[styles.root, styles.center]}>
        <AppText variant="muted">Ejercicio no encontrado.</AppText>
      </View>
    );
  }

  const metaBadges = [exercise.primary_muscle, exercise.equipment].filter(Boolean) as string[];

  return (
    <View style={styles.root}>
      <Header title="" onBack={() => router.back()} withSafeArea />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image with gradient overlay + title */}
        {exercise.image_url ? (
          <View style={[styles.heroWrap, shadows.md]}>
            <Image
              source={{ uri: exercise.image_url }}
              style={styles.heroImage}
              contentFit="cover"
              transition={300}
            />
            <LinearGradient
              colors={['transparent', 'rgba(20,20,30,0.72)']}
              locations={[0.4, 1]}
              style={[StyleSheet.absoluteFill, { borderRadius: radii.xl }]}
            />
            <View style={styles.heroOverlay}>
              <AppText variant="title" style={styles.heroTitle}>
                {displayName(exercise)}
              </AppText>
              {metaBadges.length > 0 ? (
                <View style={styles.heroBadges}>
                  {metaBadges.map((b) => (
                    <Badge key={b} label={b} tone="default" size="sm" />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <Animated.View style={slideContent}>
            <AppText variant="title" style={styles.titleNoImage}>{displayName(exercise)}</AppText>
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
          {/* Meta badges (shown below image when image exists) */}
          {exercise.image_url && metaBadges.length > 0 ? (
            <View style={styles.metaRow}>
              {metaBadges.map((b) => (
                <Badge key={b} label={b} tone="accent" size="md" />
              ))}
            </View>
          ) : null}

          {/* Instructions */}
          {exercise.instructions.length > 0 ? (
            <GlassCard intensity={45} tone="light" padding={spacing[5]}>
              <View style={styles.instructionsInner}>
                <AppText variant="heading" style={styles.sectionTitle}>Instrucciones</AppText>
                <Divider color={lightColors.borderDefault} style={styles.sectionDivider} />
                {exercise.instructions.map((step, i) => (
                  <View key={i} style={styles.step}>
                    <View style={styles.stepNumber}>
                      <AppText variant="label" style={styles.stepNumberText}>{i + 1}</AppText>
                    </View>
                    <AppText variant="body" style={styles.stepText}>{step}</AppText>
                  </View>
                ))}
              </View>
            </GlassCard>
          ) : null}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: lightColors.bgCanvas,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing[12],
    gap: spacing[4],
  },
  heroWrap: {
    marginHorizontal: spacing[5],
    marginTop: spacing[2],
    borderRadius: radii.xl,
    overflow: 'hidden',
    height: 260,
  },
  heroImage: {
    width: '100%',
    height: 260,
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
    color: '#FCFCFD',
    letterSpacing: -0.5,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  titleNoImage: {
    marginHorizontal: spacing[5],
    marginTop: spacing[3],
  },
  sections: {
    paddingHorizontal: spacing[5],
    gap: spacing[4],
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  instructionsInner: {
    gap: spacing[3],
  },
  sectionTitle: {
    marginBottom: spacing[1],
  },
  sectionDivider: {
    marginBottom: spacing[1],
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
    backgroundColor: lightColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  stepNumberText: {
    color: lightColors.accent,
    fontWeight: '600',
  },
  stepText: {
    flex: 1,
    lineHeight: 24,
  },
});
