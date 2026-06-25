import { useEffect, useState } from 'react';
import {
  FlatList,
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Check, Dumbbell, ListChecks } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppText,
  Button,
  GlassCard,
  Header,
  useFadeSlideIn,
  usePressScale,
  haptic,
  lightColors,
  spacing,
  radii,
  shadows,
} from '@creed/ui-native';
import {
  listRoutines,
  listProgramDays,
  setProgramDay,
  type Routine,
} from '../../../../lib/routines';

const WEEKDAY_LABEL: Record<number, string> = {
  0: 'Lunes',
  1: 'Martes',
  2: 'Miércoles',
  3: 'Jueves',
  4: 'Viernes',
  5: 'Sábado',
  6: 'Domingo',
};

function RoutineOption({
  routine,
  selected,
  position,
  onPress,
}: {
  routine: Routine;
  selected: boolean;
  position: number;
  onPress: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const enter = useFadeSlideIn(120 + position * 55);

  return (
    <Animated.View style={[enter]}>
      <Animated.View style={[animatedStyle, shadows.sm]}>
        <GlassCard intensity={46} tone="light" padding={spacing[4]}>
          <Pressable
            onPress={onPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Asignar ${routine.name}`}
            style={styles.optionRow}
          >
            <View style={styles.optionIcon}>
              <Dumbbell size={20} color={lightColors.accent} strokeWidth={1.8} />
            </View>
            <AppText variant="body" style={styles.optionName} numberOfLines={1}>
              {routine.name}
            </AppText>
            <View
              style={[
                styles.check,
                {
                  backgroundColor: selected
                    ? lightColors.accentSoft
                    : 'transparent',
                  borderColor: selected
                    ? lightColors.accent + '55'
                    : lightColors.borderDefault,
                },
              ]}
            >
              {selected ? (
                <Check size={16} color={lightColors.accent} strokeWidth={2.6} />
              ) : null}
            </View>
          </Pressable>
        </GlassCard>
      </Animated.View>
    </Animated.View>
  );
}

export default function AssignDayScreen() {
  const { weekday, programId } = useLocalSearchParams<{
    weekday: string;
    programId: string;
  }>();
  const router = useRouter();

  const dayIndex = Number(weekday);
  const dayLabel = WEEKDAY_LABEL[dayIndex] ?? 'Día';

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [currentRoutineId, setCurrentRoutineId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const slideIntro = useFadeSlideIn(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    (async () => {
      const list = await listRoutines();
      let assignedId: string | null = null;
      if (programId) {
        const days = await listProgramDays(String(programId));
        assignedId = days.find((d) => d.weekday === dayIndex)?.routine_id ?? null;
      }
      if (!active) return;
      setRoutines(list);
      setCurrentRoutineId(assignedId);
    })()
      .catch(() => {
        if (!active) return;
        setLoadError(true);
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [programId, dayIndex]);

  const handleAssign = async (routine: Routine) => {
    if (!programId || savingId || Number.isNaN(dayIndex)) return;
    // Optimista: marca seleccionado al instante.
    const previous = currentRoutineId;
    setCurrentRoutineId(routine.id);
    setSavingId(routine.id);
    try {
      await setProgramDay(String(programId), dayIndex, routine.id);
      haptic('success');
      setSavingId(null);
      router.back();
    } catch {
      // Rollback ante fallo.
      setCurrentRoutineId(previous);
      setSavingId(null);
    }
  };

  return (
    <View style={styles.root}>
      <Header title={dayLabel} onBack={() => router.back()} withSafeArea />

      <View style={styles.body}>
        <Animated.View style={[styles.intro, slideIntro]}>
          <AppText variant="title" style={styles.introTitle}>
            Elige una rutina
          </AppText>
          <AppText variant="muted">
            La rutina que asignes será el entreno de {dayLabel.toLowerCase()}.
          </AppText>
        </Animated.View>

        {loading ? (
          <ActivityIndicator color={lightColors.accent} style={styles.spinner} />
        ) : loadError ? (
          <View style={styles.emptyWrap}>
            <AppText variant="muted" style={styles.emptyCopy}>
              No se pudo cargar — toca para reintentar
            </AppText>
            <View style={styles.emptyBtn}>
              <Button
                label="Reintentar"
                variant="primary"
                size="md"
                onPress={() => {
                  setLoading(true);
                  setLoadError(false);
                  listRoutines()
                    .then(async (list) => {
                      let assignedId: string | null = null;
                      if (programId) {
                        const days = await listProgramDays(String(programId));
                        assignedId = days.find((d) => d.weekday === dayIndex)?.routine_id ?? null;
                      }
                      setRoutines(list);
                      setCurrentRoutineId(assignedId);
                    })
                    .catch(() => setLoadError(true))
                    .finally(() => setLoading(false));
                }}
              />
            </View>
          </View>
        ) : routines.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <ListChecks size={30} color={lightColors.accent} strokeWidth={1.6} />
            </View>
            <AppText variant="heading" style={styles.emptyTitle}>
              No tienes rutinas
            </AppText>
            <AppText variant="muted" style={styles.emptyCopy}>
              Crea una rutina primero para poder asignarla a un día de tu semana.
            </AppText>
            <View style={styles.emptyBtn}>
              <Button
                label="Ir a mis rutinas"
                variant="primary"
                size="md"
                onPress={() => router.push('/(app)/routines' as any)}
              />
            </View>
          </View>
        ) : (
          <FlatList
            data={routines}
            keyExtractor={(r) => r.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <RoutineOption
                routine={item}
                selected={currentRoutineId === item.id}
                position={index}
                onPress={() => handleAssign(item)}
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
  spinner: {
    marginTop: spacing[16],
  },
  listContent: {
    gap: spacing[3],
    paddingBottom: spacing[16],
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: lightColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionName: {
    flex: 1,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[3],
    paddingBottom: spacing[16],
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: radii.xl,
    backgroundColor: lightColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyCopy: {
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing[4],
  },
  emptyBtn: {
    marginTop: spacing[2],
    minWidth: 200,
  },
});
