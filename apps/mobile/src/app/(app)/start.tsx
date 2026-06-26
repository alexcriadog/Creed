/**
 * Start — selector de rutina, dark atlético v3.
 * Canvas negro + orbe lima + Header v3 con back circular.
 * Cada rutina: tarjeta dark surface1 con borde acento + play lima + press-spring.
 * Lógica preservada: listRoutines + startSession + guard + Alert.
 */

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
import { Play, ListChecks } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  AppText,
  GlassCard,
  Header,
  Button,
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
import { listRoutines, type Routine } from '../../lib/routines';
import { startSession } from '../../lib/sessions';

// ── Subcomponentes ────────────────────────────────────────────────────────────

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
      <Animated.View style={[animatedStyle, styles.routineOuter, glow('soft')]}>
        <Pressable
          onPress={onStart}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={isStarting}
          accessibilityRole="button"
          accessibilityLabel={`Empezar rutina ${item.name}`}
          style={styles.routineInner}
        >
          {/* Chip play lima */}
          <View style={styles.playChip}>
            <Play size={20} color={colors.onAccent} fill={colors.onAccent} strokeWidth={0} />
          </View>

          {/* Nombre y sub */}
          <View style={styles.routineTextBlock}>
            <AppText style={styles.routineTitle} numberOfLines={1}>
              {item.name}
            </AppText>
            <AppText variant="muted" style={styles.routineSub}>
              Empezar
            </AppText>
          </View>

          {/* Flecha lima */}
          <AppText style={styles.routineArrow}>›</AppText>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function EmptyState({ onNavigate }: { onNavigate: () => void }) {
  const enter = useFadeSlideIn(100);
  return (
    <Animated.View style={[styles.centerWrap, enter]}>
      <GlassCard padding={spacing[6]}>
        <View style={styles.emptyInner}>
          <View style={styles.emptyIconWrap}>
            <ListChecks size={34} color={colors.accent} strokeWidth={1.6} />
          </View>
          <AppText variant="title" style={styles.emptyTitle}>
            Aún no tienes rutinas
          </AppText>
          <AppText variant="muted" style={styles.emptyCopy}>
            Crea una rutina y podrás empezar a entrenar desde aquí.
          </AppText>
          <View style={styles.emptyBtn}>
            <Button
              label="Crear rutina"
              variant="accent"
              size="md"
              onPress={onNavigate}
            />
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const enter = useFadeSlideIn(100);
  return (
    <Animated.View style={[styles.centerWrap, enter]}>
      <GlassCard padding={spacing[6]}>
        <View style={styles.emptyInner}>
          <AppText variant="muted" style={styles.emptyCopy}>
            No se pudo cargar las rutinas — toca para reintentar
          </AppText>
          <Button label="Reintentar" variant="accent" size="md" onPress={onRetry} />
        </View>
      </GlassCard>
    </Animated.View>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────

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
      {/* Fondo dark atlético */}
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
        end={{ x: 0.2, y: 0.6 }}
        style={[styles.orb, styles.orbTopRight]}
      />

      <Header
        title="Empezar entreno"
        onBack={() => router.back()}
        withSafeArea
      />

      <View style={styles.body}>
        {/* Heading */}
        <Animated.View style={[styles.intro, slideHeading]}>
          <AppText style={styles.introTitle}>Elige una rutina</AppText>
          <AppText variant="muted">Selecciona y empieza en segundos.</AppText>
        </Animated.View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={styles.spinner} size="large" />
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

// ── Estilos ───────────────────────────────────────────────────────────────────

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
  orb: {
    position: 'absolute',
    borderRadius: radii.pill,
  },
  orbTopRight: {
    width: 360,
    height: 360,
    top: -120,
    right: -90,
  },
  intro: {
    gap: spacing[1],
    marginBottom: spacing[4],
  },
  introTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.textPrimary,
    letterSpacing: -1,
    lineHeight: fontSize['2xl'] * 1.05,
  },
  listContent: {
    gap: spacing[3],
    paddingBottom: spacing[24],
  },
  spinner: {
    marginTop: spacing[16],
  },

  // Routine row card
  routineOuter: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface1,
    borderWidth: 1.5,
    borderColor: colors.accent,
    overflow: 'hidden',
    ...shadows.md,
  },
  routineInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
  },
  playChip: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routineTextBlock: {
    flex: 1,
    gap: 2,
  },
  routineTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  routineSub: {
    fontSize: 13,
  },
  routineArrow: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: colors.accent,
    lineHeight: fontSize.xl * 1.1,
  },

  // Empty / error states
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing[16],
  },
  emptyInner: {
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
  },
  emptyCopy: {
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyBtn: {
    marginTop: spacing[3],
    alignSelf: 'stretch',
  },
});
