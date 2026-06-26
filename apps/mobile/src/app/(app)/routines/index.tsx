/**
 * Rutinas — lista — dark atlético v3.
 * Canvas negro + orbe lima. Cards dark surface1 + hairline. FAB lima.
 * Lógica preservada: listRoutines/getRoutine, useFocusEffect, nav.
 */

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
  Button,
  Header,
  FAB,
  useFadeSlideIn,
  usePressScale,
  colors,
  gradients,
  glow,
  shadows,
  spacing,
  radii,
  fontFamily,
  fontSize,
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
    <Animated.View style={enter}>
      <Animated.View style={[animatedStyle, styles.cardOuter, shadows.md]}>
        <Pressable
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          accessibilityLabel={`Abrir rutina ${item.name}`}
          style={styles.cardInner}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <Dumbbell size={22} color={colors.accent} strokeWidth={1.8} />
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
            <ChevronRight size={20} color={colors.textMuted} strokeWidth={1.8} />
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
      </Animated.View>
    </Animated.View>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const enter = useFadeSlideIn(100);
  return (
    <Animated.View style={[styles.emptyWrap, enter]}>
      <View style={styles.emptyCard}>
        <View style={styles.emptyIconWrap}>
          <ListChecks size={34} color={colors.accent} strokeWidth={1.6} />
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
            variant="accent"
            size="md"
            onPress={onCreate}
          />
        </View>
      </View>
    </Animated.View>
  );
}

export default function RoutinesScreen() {
  const router = useRouter();
  const [cards, setCards] = useState<RoutineCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const slideHeading = useFadeSlideIn(0);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
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
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Recargar al volver al foco (tras crear/editar en el editor)
  useFocusEffect(load);

  // 'new' is a sentinel id: [id].tsx checks id==='new' and creates a draft routine.
  const goCreate = () => router.push('/(app)/routines/new' as any);

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

      <Header title="Mis rutinas" onBack={() => router.back()} withSafeArea />

      <View style={styles.body}>
        <Animated.View style={[styles.intro, slideHeading]}>
          <AppText style={styles.introTitle}>Tus planes</AppText>
          <AppText variant="muted">Diseña, ordena y ajusta cada sesión.</AppText>
        </Animated.View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={styles.spinner} />
        ) : loadError ? (
          <View style={styles.errorWrap}>
            <AppText variant="muted" style={styles.errorText}>
              No se pudo cargar — toca para reintentar
            </AppText>
            <Button label="Reintentar" variant="accent" size="md" onPress={load} />
          </View>
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
            <Plus size={26} color={colors.onAccent} strokeWidth={2.2} />
          </FAB>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
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
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.textPrimary,
    letterSpacing: -1.2,
    lineHeight: fontSize['2xl'] * 1.05,
  },
  listContent: {
    gap: spacing[3],
    paddingBottom: spacing[24],
  },
  spinner: {
    marginTop: spacing[16],
  },
  // Routine card — dark surface1
  cardOuter: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  cardInner: {
    padding: spacing[5],
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
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleBlock: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    letterSpacing: -0.2,
    color: colors.textPrimary,
  },
  muscleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  // Empty state — dark card
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing[16],
  },
  emptyCard: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[3],
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  emptyTitle: {
    textAlign: 'center',
    color: colors.textPrimary,
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
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[4],
    paddingBottom: spacing[16],
  },
  errorText: {
    textAlign: 'center',
  },
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  orbTopRight: {
    width: 360,
    height: 360,
    top: -120,
    right: -90,
  },
});
