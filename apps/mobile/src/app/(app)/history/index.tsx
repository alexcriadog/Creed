/**
 * Historial de sesiones — lista cronológica inversa — dark atlético v3.
 *
 * Muestra todas las sesiones del usuario con:
 * - Fecha (relativa si < 7 días, absoluta si más antigua)
 * - Nombre de la rutina (o "Sesión libre")
 * - Nº de series registradas
 * - Estado: completada o en curso (Badge "En curso")
 *
 * Tap en una sesión completada → detalle (read-only).
 * Tap en una sesión en curso   → reanuda en session/[id].
 */

import { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, ClipboardList } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import {
  AppText,
  Badge,
  Header,
  useFadeSlideIn,
  usePressScale,
  colors,
  gradients,
  glow,
  shadows,
  spacing,
  radii,
  fontFamily,
} from '@creed/ui-native';
import { listSessions, type Session } from '../../../lib/sessions';

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Formatea la fecha de una sesión:
 * - Si es de los últimos 7 días: tiempo relativo ("hace 2 días").
 * - Si es más antigua: fecha absoluta ("12 jun 2026").
 */
function formatSessionDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    if (diffMinutes < 1) return 'ahora mismo';
    if (diffHours < 1) return rtf.format(-diffMinutes, 'minute');
    if (diffDays < 1) return rtf.format(-diffHours, 'hour');
    return rtf.format(-diffDays, 'day');
  }

  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SessionListItem = Session & {
  routine_name: string | null;
  set_count: number;
};

// ── Session card ──────────────────────────────────────────────────────────────

interface SessionCardProps {
  item: SessionListItem;
  index: number;
  onPress: () => void;
}

function SessionCard({ item, index, onPress }: SessionCardProps) {
  const enter = useFadeSlideIn(index * 60);
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const isInProgress = item.status === 'in_progress';

  return (
    <Animated.View style={enter}>
      <Animated.View style={[animatedStyle, styles.cardOuter, shadows.md]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Abrir sesión ${item.routine_name ?? 'Sesión libre'}`}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={styles.cardInner}
        >
          <View style={styles.cardRow}>
            {/* Left: info */}
            <View style={styles.cardInfo}>
              <View style={styles.cardTitleRow}>
                <AppText variant="body" style={styles.cardTitle} numberOfLines={1}>
                  {item.routine_name ?? 'Sesión libre'}
                </AppText>
                {isInProgress && (
                  <Badge label="En curso" tone="amber" size="sm" />
                )}
              </View>
              <View style={styles.cardMeta}>
                <AppText variant="muted" style={styles.cardDate}>
                  {formatSessionDate(item.started_at)}
                </AppText>
                <AppText variant="muted" style={styles.cardDot}>·</AppText>
                <AppText style={styles.cardSets}>
                  {item.set_count} {item.set_count === 1 ? 'serie' : 'series'}
                </AppText>
              </View>
            </View>

            {/* Right: chevron */}
            <ChevronRight
              size={18}
              color={colors.textMuted}
              strokeWidth={1.8}
            />
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  const enter = useFadeSlideIn(80);
  return (
    <Animated.View style={enter}>
      <View style={styles.emptyCard}>
        <View style={styles.emptyIcon}>
          <ClipboardList size={32} color={colors.accent} strokeWidth={1.5} />
        </View>
        <AppText variant="heading" style={styles.emptyTitle}>
          Sin sesiones
        </AppText>
        <AppText variant="muted" style={styles.emptyCopy}>
          Completa tu primer entreno y aparecerá aquí.
        </AppText>
      </View>
    </Animated.View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HistoryList() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const slideHeader = useFadeSlideIn(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    listSessions()
      .then((data) => {
        if (active) setSessions(data as SessionListItem[]);
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

  function handlePress(item: SessionListItem) {
    if (item.status === 'in_progress') {
      router.push(`/(app)/session/${item.id}` as any);
    } else {
      router.push(`/(app)/history/${item.id}` as any);
    }
  }

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

      <Header title="Historial" onBack={() => router.back()} withSafeArea />

      {loading ? (
        <View style={[styles.fill, styles.center]}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : loadError ? (
        <View style={[styles.fill, styles.center, styles.padH]}>
          <View style={styles.errorCard}>
            <View style={styles.emptyInner}>
              <AppText variant="heading" style={styles.emptyTitle}>
                Error al cargar
              </AppText>
              <AppText variant="muted" style={styles.emptyCopy}>
                No se pudo cargar el historial. Inténtalo de nuevo.
              </AppText>
            </View>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Section header */}
          <Animated.View style={slideHeader}>
            <AppText style={styles.sectionLabel}>
              {sessions.length === 0
                ? 'Tus entrenos aparecerán aquí'
                : `${sessions.length} ${sessions.length === 1 ? 'sesión' : 'sesiones'}`}
            </AppText>
          </Animated.View>

          {sessions.length === 0 ? (
            <EmptyState />
          ) : (
            sessions.map((item, index) => (
              <SessionCard
                key={item.id}
                item={item}
                index={index}
                onPress={() => handlePress(item)}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  fill: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  padH: {
    paddingHorizontal: spacing[5],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[10],
    gap: spacing[3],
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: fontFamily.sansSemibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: colors.textMuted,
    marginBottom: spacing[1],
  },
  // Session card — dark surface1
  cardOuter: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  cardInner: {
    padding: spacing[4],
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  cardInfo: {
    flex: 1,
    gap: spacing[1],
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontFamily: fontFamily.sansSemibold,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  cardDate: {
    fontSize: 13,
  },
  cardDot: {
    fontSize: 13,
    color: colors.textMuted,
  },
  cardSets: {
    fontSize: 13,
    fontFamily: fontFamily.sansMedium,
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  // Empty / error cards
  emptyCard: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing[8],
    alignItems: 'center',
    gap: spacing[3],
  },
  errorCard: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing[6],
    width: '100%',
  },
  emptyInner: {
    gap: spacing[3],
    alignItems: 'center',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radii.xl,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    textAlign: 'center',
    color: colors.textPrimary,
  },
  emptyCopy: {
    textAlign: 'center',
    lineHeight: 22,
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
