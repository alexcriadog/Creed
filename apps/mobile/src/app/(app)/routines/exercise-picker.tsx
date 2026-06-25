import { useEffect, useState } from 'react';
import {
  FlatList,
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Check, Plus } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppText,
  Input,
  Chip,
  Badge,
  GlassCard,
  Header,
  Button,
  useFadeSlideIn,
  usePressScale,
  haptic,
  lightColors,
  spacing,
  radii,
  shadows,
} from '@creed/ui-native';
import { listExercises, displayName, type Exercise } from '../../../lib/exercises';
import { addRoutineExercise } from '../../../lib/routines';

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

function PickerRow({
  item,
  added,
  onAdd,
}: {
  item: Exercise;
  added: boolean;
  onAdd: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();

  return (
    <Animated.View style={[animatedStyle, shadows.sm]}>
      <GlassCard intensity={40} tone="light" padding={spacing[3]}>
        <Pressable
          onPress={onAdd}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={added}
          accessibilityRole="button"
          accessibilityLabel={`Añadir ${displayName(item)}`}
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
            <AppText variant="body" style={styles.rowTitle} numberOfLines={1}>
              {displayName(item)}
            </AppText>
            {item.primary_muscle ? (
              <Badge label={item.primary_muscle} tone="accent" size="sm" />
            ) : null}
          </View>

          {/* Estado añadido vs añadir */}
          <View
            style={[
              styles.addPill,
              {
                backgroundColor: added
                  ? lightColors.statusGreen + '22'
                  : lightColors.accentSoft,
                borderColor: added
                  ? lightColors.statusGreen + '55'
                  : lightColors.accent + '44',
              },
            ]}
          >
            {added ? (
              <Check size={18} color={lightColors.statusGreen} strokeWidth={2.4} />
            ) : (
              <Plus size={18} color={lightColors.accent} strokeWidth={2.4} />
            )}
          </View>
        </Pressable>
      </GlassCard>
    </Animated.View>
  );
}

export default function ExercisePicker() {
  const { routineId } = useLocalSearchParams<{ routineId: string }>();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [items, setItems] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addedCount, setAddedCount] = useState(0);

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

  const handleAdd = (exercise: Exercise) => {
    if (!routineId || addedIds.has(exercise.id)) return;
    haptic('success');
    // Optimista: marca añadido al instante; persiste en background.
    setAddedIds((prev) => new Set(prev).add(exercise.id));
    setAddedCount((c) => c + 1);
    addRoutineExercise(String(routineId), exercise.id, {}).catch(() => {
      // Rollback en caso de error
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(exercise.id);
        return next;
      });
      setAddedCount((c) => Math.max(0, c - 1));
    });
  };

  return (
    <View style={styles.root}>
      <Header title="Añadir ejercicio" onBack={() => router.back()} withSafeArea />

      <View style={styles.body}>
        <Animated.View style={slideSearch}>
          <Input
            testID="picker-search"
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar ejercicio…"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </Animated.View>

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

        <Animated.View style={[styles.listWrap, slideList]}>
          {loading ? (
            <ActivityIndicator color={lightColors.accent} style={styles.spinner} />
          ) : (
            <FlatList
              data={items}
              keyExtractor={(e) => e.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <PickerRow
                  item={item}
                  added={addedIds.has(item.id)}
                  onAdd={() => handleAdd(item)}
                />
              )}
              ListEmptyComponent={
                <AppText variant="muted" style={styles.empty}>
                  Sin resultados.
                </AppText>
              }
            />
          )}
        </Animated.View>
      </View>

      {/* Barra inferior: resumen + cerrar (multi-add fluido) */}
      <View style={styles.footer}>
        <AppText variant="muted">
          {addedCount === 0
            ? 'Toca para añadir varios'
            : addedCount === 1
            ? '1 añadido'
            : `${addedCount} añadidos`}
        </AppText>
        <View style={styles.doneBtn}>
          <Button label="Hecho" variant="primary" size="md" onPress={() => router.back()} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: lightColors.bgCanvas,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing[5],
    gap: spacing[4],
    paddingTop: spacing[4],
  },
  chipsContent: {
    gap: spacing[2],
    paddingVertical: spacing[1],
  },
  listWrap: {
    flex: 1,
  },
  listContent: {
    gap: spacing[2],
    paddingBottom: spacing[20],
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
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: lightColors.bgCanvasTint,
  },
  thumbPlaceholder: {
    width: 52,
    height: 52,
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
  addPill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    textAlign: 'center',
    marginTop: spacing[8],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[8],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: lightColors.borderSubtle,
    backgroundColor: lightColors.bgSurfaceStrong,
  },
  doneBtn: {
    minWidth: 120,
  },
});
