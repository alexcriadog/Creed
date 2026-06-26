import { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, ListChecks, ChevronRight } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  AppText,
  GlassCard,
  Header,
  Button,
  useFadeSlideIn,
  usePressScale,
  lightColors,
  spacing,
  radii,
  shadows,
} from '@creed/ui-native';
import { listRoutines, type Routine } from '../../lib/routines';
import { startSession } from '../../lib/sessions';

// ── Sub-components ────────────────────────────────────────────────────────────

function RoutineRow({
  item,
  index,
  isStarting,
  onStart,
}: {
  item: Routine;
  index: number;
  isStarting: boolean;
  onStart: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const enter = useFadeSlideIn(120 + index * 70);

  return (
    <Animated.View style={enter}>
      <Animated.View style={[animatedStyle, shadows.md]}>
        <GlassCard intensity={50} tone="light" padding={spacing[5]}>
          <Pressable
            onPress={onStart}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={isStarting}
            accessibilityRole="button"
            accessibilityLabel={`Empezar rutina ${item.name}`}
            style={styles.rowPressable}
          >
            <View style={styles.rowIconWrap}>
              <Play size={22} color={lightColors.accent} strokeWidth={1.8} />
            </View>
            <View style={styles.rowTextBlock}>
              <AppText variant="heading" style={styles.rowTitle} numberOfLines={1}>
                {item.name}
              </AppText>
              <AppText variant="muted" style={styles.rowSub}>
                Empezar
              </AppText>
            </View>
            <ChevronRight size={20} color={lightColors.textMuted} strokeWidth={1.8} />
          </Pressable>
        </GlassCard>
      </Animated.View>
    </Animated.View>
  );
}

function EmptyState({ onNavigate }: { onNavigate: () => void }) {
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
            Crea una rutina y podrás empezar a entrenar desde aquí.
          </AppText>
          <View style={styles.emptyBtn}>
            <Button
              label="Crear rutina"
              variant="primary"
              size="md"
              onPress={onNavigate}
            />
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const enter = useFadeSlideIn(100);
  return (
    <Animated.View style={[styles.errorWrap, enter]}>
      <AppText variant="muted" style={styles.errorText}>
        No se pudo cargar las rutinas — toca para reintentar
      </AppText>
      <Button label="Reintentar" variant="primary" size="md" onPress={onRetry} />
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function StartScreen() {
  const router = useRouter();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  const slideHeading = useFadeSlideIn(0);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    listRoutines()
      .then((data) => {
        if (active) setRoutines(data);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(load);

  const handleStart = useCallback(
    async (routine: Routine) => {
      if (startingId !== null) return;
      setStartingId(routine.id);
      try {
        const session = await startSession(routine.id);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace(`/(app)/session/${session.id}` as any);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        Alert.alert('No se pudo iniciar el entreno', message);
      } finally {
        setStartingId(null);
      }
    },
    [startingId, router]
  );

  return (
    <View style={styles.root}>
      {/* Atmospheric background */}
      <LinearGradient
        colors={['#EEF0FF', '#F6F7FA', '#FFF8F4']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb, styles.orbTop]} />

      <Header title="Empezar entreno" onBack={() => router.back()} withSafeArea />

      <View style={styles.body}>
        <Animated.View style={[styles.intro, slideHeading]}>
          <AppText variant="title" style={styles.introTitle}>
            Elige una rutina
          </AppText>
          <AppText variant="muted">Selecciona y empieza en segundos.</AppText>
        </Animated.View>

        {loading ? (
          <ActivityIndicator color={lightColors.accent} style={styles.spinner} />
        ) : loadError ? (
          <ErrorState onRetry={load} />
        ) : routines.length === 0 ? (
          <EmptyState onNavigate={() => router.push('/(app)/routines' as any)} />
        ) : (
          <FlatList
            data={routines}
            keyExtractor={(r) => r.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <RoutineRow
                item={item}
                index={index}
                isStarting={startingId !== null}
                onStart={() => handleStart(item)}
              />
            )}
          />
        )}
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
  rowPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  rowIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: lightColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextBlock: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    letterSpacing: -0.2,
  },
  rowSub: {
    fontSize: 13,
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
  orbTop: {
    width: 320,
    height: 320,
    top: -120,
    right: -90,
    backgroundColor: 'rgba(139,157,255,0.16)',
  },
});
