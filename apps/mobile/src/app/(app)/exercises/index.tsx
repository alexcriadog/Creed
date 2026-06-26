import { useEffect, useState } from 'react';
import { FlatList, View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  AppText, Input, Chip, Badge, GlassCard, Header,
  useFadeSlideIn, usePressScale, lightColors, spacing, radii, shadows,
} from '@creed/ui-native';
import { listExercises, displayName, type Exercise } from '../../../lib/exercises';

const MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'abs'];

const MUSCLE_LABEL: Record<string, string> = {
  chest: 'Pecho', back: 'Espalda', shoulders: 'Hombros',
  biceps: 'Bíceps', triceps: 'Tríceps', quads: 'Cuádriceps',
  hamstrings: 'Isquios', glutes: 'Glúteos', abs: 'Abdomen',
};

function ExerciseRow({ item, onPress }: { item: Exercise; onPress: () => void }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();

  return (
    <Animated.View style={[animatedStyle, shadows.sm]}>
      <GlassCard intensity={40} tone="light" padding={spacing[3]}>
        <Pressable
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
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
            <View style={styles.thumbPlaceholder} />
          )}
          <View style={styles.rowText}>
            <AppText variant="body" style={styles.rowTitle}>{displayName(item)}</AppText>
            {item.primary_muscle ? (
              <Badge label={item.primary_muscle} tone="accent" size="sm" />
            ) : null}
          </View>
        </Pressable>
      </GlassCard>
    </Animated.View>
  );
}

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
      <LinearGradient
        colors={['#EEF0FF', '#F6F7FA', '#FFF8F4']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb, styles.orbTop]} />
      <Header title="Ejercicios" withSafeArea />

      <View style={styles.body}>
        {/* Search input */}
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

        {/* Filter chips — horizontal scroll, no height clip */}
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
            <ActivityIndicator color={lightColors.accent} style={styles.spinner} />
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
                <AppText variant="muted" style={styles.empty}>Sin resultados.</AppText>
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
  },
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  orbTop: {
    width: 320,
    height: 320,
    top: -120,
    right: -90,
    backgroundColor: 'rgba(139,157,255,0.16)',
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: lightColors.bgCanvasTint,
  },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: lightColors.bgCanvasTint,
  },
  rowText: {
    flex: 1,
    gap: spacing[1],
  },
  rowTitle: {
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    marginTop: spacing[8],
  },
});
