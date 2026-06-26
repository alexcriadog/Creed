/**
 * Catálogo de ejercicios — dark atlético v3.
 * Canvas negro + orbe lima. Search Input dark. Muscle filter Chips dark+lima.
 * Exercise rows dark surface1 + thumb + badge + press-spring.
 * Lógica preservada: listExercises / search / filter.
 */

import { useEffect, useState } from 'react';
import {
  FlatList,
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  AppText,
  Input,
  Chip,
  Badge,
  Header,
  useFadeSlideIn,
  usePressScale,
  colors,
  gradients,
  glow,
  spacing,
  radii,
  shadows,
  fontFamily,
  fontSize,
} from '@creed/ui-native';
import { listExercises, displayName, type Exercise } from '../../../lib/exercises';

const MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'abs',
];

const MUSCLE_LABEL: Record<string, string> = {
  chest: 'Pecho',
  back: 'Espalda',
  shoulders: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  quads: 'Cuádriceps',
  hamstrings: 'Isquios',
  glutes: 'Glúteos',
  abs: 'Abdomen',
};

// ── Exercise row ──────────────────────────────────────────────────────────────

function ExerciseRow({ item, onPress }: { item: Exercise; onPress: () => void }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();

  return (
    <Animated.View style={[animatedStyle, styles.rowOuter, glow('soft')]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={displayName(item)}
        style={styles.row}
      >
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.thumb}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <AppText style={styles.thumbInitial}>
              {displayName(item).charAt(0).toUpperCase()}
            </AppText>
          </View>
        )}
        <View style={styles.rowText}>
          <AppText style={styles.rowTitle} numberOfLines={1}>
            {displayName(item)}
          </AppText>
          {item.primary_muscle ? (
            <Badge label={item.primary_muscle} tone="accent" size="sm" />
          ) : null}
        </View>
        <View style={styles.rowChevron}>
          <AppText style={styles.rowChevronText}>›</AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ExercisesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [items, setItems] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  const slideSearch = useFadeSlideIn(0);
  const slideChips = useFadeSlideIn(60);
  const slideList = useFadeSlideIn(120);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listExercises({ search: search || undefined, muscle: muscle || undefined })
      .then((r) => active && setItems(r))
      .catch(() => active && setItems([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [search, muscle]);

  return (
    <View style={styles.root}>
      {/* Fondo dark atlético: gradiente de atmósfera */}
      <LinearGradient
        colors={gradients.canvasV3}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Orbe lima tenue — esquina superior derecha */}
      <LinearGradient
        colors={gradients.accentOrb}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.15, y: 0.6 }}
        style={[styles.orb, styles.orbTopRight]}
      />

      <Header title="Ejercicios" onBack={() => router.back()} withSafeArea />

      <View style={styles.body}>
        {/* Search input — dark */}
        <Animated.View style={[styles.searchWrap, slideSearch]}>
          <Input
            testID="search-input"
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar ejercicio…"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </Animated.View>

        {/* Filter chips — horizontal scroll */}
        <Animated.View style={slideChips}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={MUSCLES}
            keyExtractor={(m) => m}
            contentContainerStyle={styles.chipsContent}
            renderItem={({ item }) => (
              <Chip
                label={MUSCLE_LABEL[item] ?? item}
                selected={muscle === item}
                onPress={(selected) => setMuscle(selected ? item : null)}
              />
            )}
          />
        </Animated.View>

        {/* Exercise list */}
        <Animated.View style={[styles.listWrap, slideList]}>
          {loading ? (
            <ActivityIndicator color={colors.accent} style={styles.spinner} />
          ) : (
            <FlatList
              data={items}
              keyExtractor={(e) => e.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <ExerciseRow
                  item={item}
                  onPress={() => router.push(`/(app)/exercises/${item.id}`)}
                />
              )}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <AppText variant="muted" style={styles.empty}>
                    Sin resultados.
                  </AppText>
                </View>
              }
            />
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },

  // Orbe
  orb: {
    position: 'absolute',
    borderRadius: radii.pill,
  },
  orbTopRight: {
    width: 320,
    height: 320,
    top: -120,
    right: -90,
  },

  body: {
    flex: 1,
    paddingHorizontal: spacing[5],
    gap: spacing[4],
    paddingTop: spacing[4],
  },
  searchWrap: {},
  chipsContent: {
    gap: spacing[2],
    paddingVertical: spacing[1],
  },
  listWrap: {
    flex: 1,
  },
  listContent: {
    gap: spacing[2],
    paddingBottom: spacing[10],
  },
  spinner: {
    marginTop: spacing[8],
  },

  // Exercise row — dark surface1 card
  rowOuter: {
    backgroundColor: colors.surface1,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
    ...shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
  },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(198,255,58,0.15)',
  },
  thumbInitial: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.accent,
  },
  rowText: {
    flex: 1,
    gap: spacing[1],
  },
  rowTitle: {
    fontFamily: fontFamily.sansMedium,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  rowChevron: {
    paddingHorizontal: spacing[1],
  },
  rowChevronText: {
    fontSize: 20,
    color: colors.textMuted,
  },

  // Empty
  emptyWrap: {
    alignItems: 'center',
    marginTop: spacing[8],
  },
  empty: {
    textAlign: 'center',
  },
});
