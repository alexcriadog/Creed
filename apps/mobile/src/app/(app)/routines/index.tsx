import { useCallback, useState } from 'react';
import {
  FlatList,
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, ListChecks, ChevronRight, Dumbbell } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  AppText,
  Badge,
  GlassCard,
  Header,
  FAB,
  Button,
  useFadeSlideIn,
  usePressScale,
  lightColors,
  spacing,
  radii,
  shadows,
} from '@creed/ui-native';
import { listRoutines, getRoutine } from '../../../lib/routines';

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
  calves: 'Gemelos',
};

type RoutineCard = {
  id: string;
  name: string;
  exerciseCount: number;
  muscles: string[];
};

function muscleLabel(m: string): string {
  return MUSCLE_LABEL[m] ?? m.charAt(0).toUpperCase() + m.slice(1);
}

function RoutineRow({
  item,
  index,
  onPress,
}: {
  item: RoutineCard;
  index: number;
  onPress: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const enter = useFadeSlideIn(120 + index * 70);

  return (
    <Animated.View style={[enter]}>
      <Animated.View style={[animatedStyle, shadows.md]}>
        <GlassCard intensity={50} tone="light" padding={spacing[5]}>
          <Pressable
            onPress={onPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            accessibilityRole="button"
            accessibilityLabel={`Abrir rutina ${item.name}`}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <Dumbbell size={22} color={lightColors.accent} strokeWidth={1.8} />
              </View>
              <View style={styles.cardTitleBlock}>
                <AppText variant="heading" style={styles.cardTitle} numberOfLines={1}>
                  {item.name}
                </AppText>
                <AppText variant="muted">
                  {item.exerciseCount === 1
                    ? '1 ejercicio'
                    : `${item.exerciseCount} ejercicios`}
                </AppText>
              </View>
              <ChevronRight size={20} color={lightColors.textMuted} strokeWidth={1.8} />
            </View>

            {item.muscles.length > 0 ? (
              <View style={styles.muscleRow}>
                {item.muscles.slice(0, 4).map((m) => (
                  <Badge key={m} label={muscleLabel(m)} tone="accent" size="sm" />
                ))}
                {item.muscles.length > 4 ? (
                  <Badge label={`+${item.muscles.length - 4}`} tone="default" size="sm" />
                ) : null}
              </View>
            ) : null}
          </Pressable>
        </GlassCard>
      </Animated.View>
    </Animated.View>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const enter = useFadeSlideIn(100);
  return (
    <Animated.View style={[styles.emptyWrap, enter]}>
      <View style={[styles.emptyCard, shadows.md]}>
        <LinearGradient
          colors={['rgba(255,255,255,0.78)', 'rgba(255,255,255,0.5)']}
          style={[styles.emptyGradient, { borderRadius: radii.xl }]}
        >
          <View style={styles.emptyIconWrap}>
            <ListChecks size={34} color={lightColors.accent} strokeWidth={1.6} />
          </View>
          <AppText variant="heading" style={styles.emptyTitle}>
            Aún no tienes rutinas
          </AppText>
          <AppText variant="muted" style={styles.emptyCopy}>
            Crea tu primera rutina, añade ejercicios del catálogo y define tus series, reps
            y descansos. Tu coach trabajará sobre ellas.
          </AppText>
          <View style={styles.emptyBtn}>
            <Button
              label="Crear mi primera rutina"
              variant="primary"
              size="md"
              onPress={onCreate}
            />
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

export default function RoutinesScreen() {
  const router = useRouter();
  const [cards, setCards] = useState<RoutineCard[]>([]);
  const [loading, setLoading] = useState(true);

  const slideHeading = useFadeSlideIn(0);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    listRoutines()
      .then(async (routines) => {
        const enriched = await Promise.all(
          routines.map(async (r) => {
            const full = await getRoutine(r.id);
            const exercises = full?.exercises ?? [];
            const muscles = Array.from(
              new Set(
                exercises
                  .map((e) => e.primary_muscle)
                  .filter((m): m is string => Boolean(m))
              )
            );
            return {
              id: r.id,
              name: r.name,
              exerciseCount: exercises.length,
              muscles,
            } satisfies RoutineCard;
          })
        );
        if (active) setCards(enriched);
      })
      .catch(() => active && setCards([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Recargar al volver al foco (tras crear/editar en el editor)
  useFocusEffect(load);

  const goCreate = () => router.push('/(app)/routines/new' as any);

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

      <Header title="Mis rutinas" onBack={() => router.back()} withSafeArea />

      <View style={styles.body}>
        <Animated.View style={[styles.intro, slideHeading]}>
          <AppText variant="title" style={styles.introTitle}>
            Tus planes
          </AppText>
          <AppText variant="muted">Diseña, ordena y ajusta cada sesión.</AppText>
        </Animated.View>

        {loading ? (
          <ActivityIndicator color={lightColors.accent} style={styles.spinner} />
        ) : cards.length === 0 ? (
          <EmptyState onCreate={goCreate} />
        ) : (
          <FlatList
            data={cards}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <RoutineRow
                item={item}
                index={index}
                onPress={() => router.push(`/(app)/routines/${item.id}` as any)}
              />
            )}
          />
        )}
      </View>

      {/* FAB — solo cuando hay rutinas (el vacío ya ofrece su propio CTA) */}
      {!loading && cards.length > 0 ? (
        <View style={styles.fab}>
          <FAB accessibilityLabel="Nueva rutina" onPress={goCreate}>
            <Plus size={26} color="#FCFCFD" strokeWidth={2.2} />
          </FAB>
        </View>
      ) : null}
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
    paddingTop: spacing[3],
  },
  intro: {
    gap: spacing[1],
    marginBottom: spacing[4],
  },
  introTitle: {
    letterSpacing: -0.6,
  },
  listContent: {
    gap: spacing[3],
    paddingBottom: spacing[24],
  },
  spinner: {
    marginTop: spacing[16],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: lightColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleBlock: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    letterSpacing: -0.2,
  },
  muscleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing[16],
  },
  emptyCard: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: lightColors.borderDefault,
  },
  emptyGradient: {
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[3],
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    backgroundColor: lightColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyCopy: {
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyBtn: {
    marginTop: spacing[3],
    alignSelf: 'stretch',
  },
  fab: {
    position: 'absolute',
    right: spacing[5],
    bottom: spacing[8],
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
});
