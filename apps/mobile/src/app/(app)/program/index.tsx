import { useCallback, useState } from 'react';
import {
  Alert,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CalendarDays,
  ChevronRight,
  Dumbbell,
  Moon,
  Sparkles,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  AppText,
  Badge,
  Button,
  GlassCard,
  Header,
  Input,
  useFadeSlideIn,
  usePressScale,
  haptic,
  lightColors,
  spacing,
  radii,
  shadows,
} from '@creed/ui-native';
import {
  getActiveProgram,
  createProgram,
  listProgramDays,
  listRoutines,
  type Program,
  type Routine,
} from '../../../lib/routines';

// Lun–Dom. listProgramDays usa weekday 0=Lun … 6=Dom.
const WEEKDAYS: { index: number; short: string; long: string }[] = [
  { index: 0, short: 'Lun', long: 'Lunes' },
  { index: 1, short: 'Mar', long: 'Martes' },
  { index: 2, short: 'Mié', long: 'Miércoles' },
  { index: 3, short: 'Jue', long: 'Jueves' },
  { index: 4, short: 'Vie', long: 'Viernes' },
  { index: 5, short: 'Sáb', long: 'Sábado' },
  { index: 6, short: 'Dom', long: 'Domingo' },
];

type WeekDayView = {
  index: number;
  short: string;
  long: string;
  routineName: string | null;
};

// ── Day card ───────────────────────────────────────────────────────────────────

function DayCard({
  day,
  position,
  onPress,
}: {
  day: WeekDayView;
  position: number;
  onPress: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const enter = useFadeSlideIn(120 + position * 55);
  const assigned = day.routineName !== null;

  return (
    <Animated.View style={[enter]}>
      <Animated.View style={[animatedStyle, shadows.md]}>
        <GlassCard intensity={48} tone="light" padding={spacing[4]}>
          <Pressable
            onPress={onPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            accessibilityRole="button"
            accessibilityLabel={
              assigned
                ? `${day.long}: ${day.routineName}. Cambiar rutina`
                : `${day.long}: descanso. Asignar rutina`
            }
            style={styles.dayRow}
          >
            <View
              style={[
                styles.dayChip,
                assigned ? styles.dayChipActive : styles.dayChipRest,
              ]}
            >
              <AppText
                variant="label"
                style={[
                  styles.dayChipText,
                  { color: assigned ? lightColors.accent : lightColors.textMuted },
                ]}
              >
                {day.short}
              </AppText>
            </View>

            <View style={styles.dayBody}>
              <AppText variant="label" style={styles.dayLong}>
                {day.long}
              </AppText>
              {assigned ? (
                <View style={styles.dayRoutineRow}>
                  <Dumbbell size={15} color={lightColors.accent} strokeWidth={2} />
                  <AppText variant="body" style={styles.dayRoutine} numberOfLines={1}>
                    {day.routineName}
                  </AppText>
                </View>
              ) : (
                <View style={styles.dayRoutineRow}>
                  <Moon size={15} color={lightColors.textMuted} strokeWidth={1.8} />
                  <AppText variant="muted">Descanso</AppText>
                </View>
              )}
            </View>

            {assigned ? (
              <Badge label="Activo" tone="accent" size="sm" />
            ) : null}
            <ChevronRight size={18} color={lightColors.textMuted} strokeWidth={1.8} />
          </Pressable>
        </GlassCard>
      </Animated.View>
    </Animated.View>
  );
}

// ── Empty / onboarding ──────────────────────────────────────────────────────────

function CreateProgram({ onCreated }: { onCreated: (p: Program) => void }) {
  const enter = useFadeSlideIn(80);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const canCreate = name.trim().length > 0 && !saving;

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0 || saving) return;
    setSaving(true);
    try {
      const program = await createProgram({ name: trimmed });
      haptic('success');
      onCreated(program);
    } catch (err) {
      setSaving(false);
      const msg = err instanceof Error ? err.message : 'Error al crear el programa';
      Alert.alert('No se pudo crear', msg);
    }
  };

  return (
    <Animated.View style={[styles.emptyWrap, enter]}>
      <View style={[styles.emptyCard, shadows.md]}>
        <LinearGradient
          colors={['rgba(255,255,255,0.78)', 'rgba(255,255,255,0.5)']}
          style={[styles.emptyGradient, { borderRadius: radii.xl }]}
        >
          <View style={styles.emptyIconWrap}>
            <Sparkles size={32} color={lightColors.accent} strokeWidth={1.6} />
          </View>
          <AppText variant="heading" style={styles.emptyTitle}>
            Crea tu programa
          </AppText>
          <AppText variant="muted" style={styles.emptyCopy}>
            Un programa organiza tu semana: asigna una rutina a cada día y deja los
            demás como descanso. Tu coach trabajará sobre este horario.
          </AppText>

          <View style={styles.formField}>
            <Input
              label="Nombre del programa"
              value={name}
              onChangeText={setName}
              placeholder="Ej. Hipertrofia · Bloque 1"
              autoCapitalize="sentences"
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
          </View>

          <View style={styles.emptyBtn}>
            <Button
              label="Crear programa"
              variant="primary"
              size="md"
              loading={saving}
              disabled={!canCreate}
              onPress={handleCreate}
            />
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

// ── Screen ──────────────────────────────────────────────────────────────────────

export default function ProgramScreen() {
  const router = useRouter();
  const [program, setProgram] = useState<Program | null>(null);
  const [routinesById, setRoutinesById] = useState<Record<string, Routine>>({});
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const slideHeader = useFadeSlideIn(0);
  const slideWeekLabel = useFadeSlideIn(80);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    (async () => {
      // Independientes: en paralelo para evitar waterfall.
      const [activeProgram, routines] = await Promise.all([
        getActiveProgram(),
        listRoutines(),
      ]);
      const byId: Record<string, Routine> = {};
      routines.forEach((r) => {
        byId[r.id] = r;
      });

      const days: Record<number, string> = {};
      if (activeProgram) {
        const programDays = await listProgramDays(activeProgram.id);
        programDays.forEach((d) => {
          days[d.weekday] = d.routine_id;
        });
      }

      if (!active) return;
      setProgram(activeProgram);
      setRoutinesById(byId);
      setAssignments(days);
    })()
      .catch(() => {
        if (!active) return;
        setLoadError(true);
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(load);

  const week: WeekDayView[] = WEEKDAYS.map((d) => {
    const routineId = assignments[d.index];
    const routine = routineId ? routinesById[routineId] : undefined;
    return {
      index: d.index,
      short: d.short,
      long: d.long,
      routineName: routine ? routine.name : null,
    };
  });

  const trainingCount = week.filter((d) => d.routineName !== null).length;

  const goAssign = (weekday: number) => {
    if (!program) return;
    router.push(`/(app)/program/day/${weekday}?programId=${program.id}` as any);
  };

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

      <Header title="Programa" onBack={() => router.back()} withSafeArea />

      {loading ? (
        <ActivityIndicator color={lightColors.accent} style={styles.spinner} />
      ) : loadError ? (
        <View style={styles.body}>
          <View style={styles.errorWrap}>
            <AppText variant="muted" style={styles.errorText}>
              No se pudo cargar — toca para reintentar
            </AppText>
            <Button label="Reintentar" variant="primary" size="md" onPress={load} />
          </View>
        </View>
      ) : !program ? (
        <View style={styles.body}>
          <CreateProgram
            onCreated={(p) => {
              setProgram(p);
              setAssignments({});
            }}
          />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero del programa */}
          <Animated.View style={slideHeader}>
            <View style={[styles.heroCard, shadows.md]}>
              <LinearGradient
                colors={['#4F62E0', '#3D4FCC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.heroGradient, { borderRadius: radii.xl }]}
              >
                <View style={styles.heroBadge}>
                  <CalendarDays size={15} color="#FCFCFD" strokeWidth={2} />
                  <AppText variant="label" style={styles.heroBadgeText}>
                    Programa activo
                  </AppText>
                </View>
                <AppText variant="title" style={styles.heroTitle} numberOfLines={2}>
                  {program.name}
                </AppText>
                <AppText variant="body" style={styles.heroMeta}>
                  {trainingCount === 0
                    ? 'Sin días asignados todavía'
                    : trainingCount === 1
                    ? '1 día de entreno · 6 de descanso'
                    : `${trainingCount} días de entreno · ${7 - trainingCount} de descanso`}
                </AppText>
              </LinearGradient>
            </View>
          </Animated.View>

          {/* Etiqueta semana */}
          <Animated.View style={[styles.weekLabel, slideWeekLabel]}>
            <AppText variant="heading" style={styles.weekLabelTitle}>
              Tu semana
            </AppText>
            <AppText variant="muted">
              Toca un día para asignar o cambiar su rutina.
            </AppText>
          </Animated.View>

          {/* Días */}
          <View style={styles.week}>
            {week.map((day, position) => (
              <DayCard
                key={day.index}
                day={day}
                position={position}
                onPress={() => goAssign(day.index)}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: lightColors.bgCanvas,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[16],
    gap: spacing[5],
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing[5],
  },
  spinner: {
    marginTop: spacing[16],
  },
  // Hero
  heroCard: {
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  heroGradient: {
    padding: spacing[6],
    gap: spacing[2],
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginBottom: spacing[1],
  },
  heroBadgeText: {
    color: '#FCFCFD',
  },
  heroTitle: {
    color: '#FCFCFD',
    letterSpacing: -0.5,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.82)',
    marginTop: 2,
  },
  // Week label
  weekLabel: {
    gap: spacing[1],
  },
  weekLabelTitle: {
    letterSpacing: -0.2,
  },
  // Week
  week: {
    gap: spacing[3],
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  dayChip: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: {
    backgroundColor: lightColors.accentSoft,
  },
  dayChipRest: {
    backgroundColor: lightColors.bgCanvasTint,
  },
  dayChipText: {
    fontSize: 13,
    letterSpacing: 0.3,
  },
  dayBody: {
    flex: 1,
    gap: 3,
  },
  dayLong: {
    color: lightColors.textSecondary,
  },
  dayRoutineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayRoutine: {
    flex: 1,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  // Empty
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
  formField: {
    alignSelf: 'stretch',
    marginTop: spacing[2],
  },
  emptyBtn: {
    marginTop: spacing[2],
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
    width: 330,
    height: 330,
    top: -120,
    right: -85,
    backgroundColor: 'rgba(139,157,255,0.17)',
  },
});
