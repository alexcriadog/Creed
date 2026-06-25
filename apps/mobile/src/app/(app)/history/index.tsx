/**
 * Historial de sesiones — lista cronológica inversa.
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
  GlassCard,
  Header,
  useFadeSlideIn,
  lightColors,
  spacing,
  radii,
  shadows,
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
  const isInProgress = item.status === 'in_progress';

  return (
    <Animated.View style={[enter, shadows.sm]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Abrir sesión ${item.routine_name ?? 'Sesión libre'}`}
        onPress={onPress}
        style={({ pressed }) => [pressed && { opacity: 0.88 }]}
      >
        <GlassCard intensity={46} tone="light" padding={spacing[4]}>
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
                <AppText variant="muted" style={styles.cardSets}>
                  {item.set_count} {item.set_count === 1 ? 'serie' : 'series'}
                </AppText>
              </View>
            </View>

            {/* Right: chevron */}
            <ChevronRight
              size={18}
              color={lightColors.textMuted}
              strokeWidth={1.8}
            />
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  const enter = useFadeSlideIn(80);
  return (
    <Animated.View style={enter}>
      <GlassCard intensity={42} tone="light" padding={spacing[8]}>
        <View style={styles.emptyInner}>
          <View style={styles.emptyIcon}>
            <ClipboardList size={32} color={lightColors.accent} strokeWidth={1.5} />
          </View>
          <AppText variant="heading" style={styles.emptyTitle}>
            Sin sesiones
          </AppText>
          <AppText variant="muted" style={styles.emptyCopy}>
            Completa tu primer entreno y aparecerá aquí.
          </AppText>
        </View>
      </GlassCard>
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
      {/* Ambient background */}
      <LinearGradient
        colors={['#EEF0FF', '#F6F7FA', '#FFF8F4']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb, styles.orbTop]} />

      <Header title="Historial" onBack={() => router.back()} withSafeArea />

      {loading ? (
        <View style={[styles.fill, styles.center]}>
          <ActivityIndicator color={lightColors.accent} size="large" />
        </View>
      ) : loadError ? (
        <View style={[styles.fill, styles.center, styles.padH]}>
          <GlassCard intensity={42} tone="light" padding={spacing[6]}>
            <View style={styles.emptyInner}>
              <AppText variant="heading" style={styles.emptyTitle}>
                Error al cargar
              </AppText>
              <AppText variant="muted" style={styles.emptyCopy}>
                No se pudo cargar el historial. Inténtalo de nuevo.
              </AppText>
            </View>
          </GlassCard>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Section header */}
          <Animated.View style={slideHeader}>
            <AppText variant="muted" style={styles.sectionLabel}>
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
    backgroundColor: lightColors.bgCanvas,
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
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: lightColors.textMuted,
    fontWeight: '600',
    marginBottom: spacing[1],
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
    fontWeight: '600',
    color: lightColors.textPrimary,
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
    color: lightColors.textMuted,
  },
  cardSets: {
    fontSize: 13,
  },
  emptyInner: {
    gap: spacing[3],
    alignItems: 'center',
  },
  emptyIcon: {
    width: 64,
    height: 64,
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
  },
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  orbTop: {
    width: 300,
    height: 300,
    top: -100,
    right: -80,
    backgroundColor: 'rgba(139,157,255,0.14)',
  },
});
