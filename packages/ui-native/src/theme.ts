/**
 * Design System v2 — Creed
 *
 * Token system completo convertido de oklch a hex/rgba para React Native.
 * Referencia canonical: docs/design.md
 *
 * Conversión oklch→hex:
 *   - oklch(L% C H) convertido manualmente vía oklch.com y verificación
 *     perceptual. Los valores glass (con alpha) se expresan como rgba().
 *   - Prioridad: fidelidad perceptual > exactitud matemática exacta.
 *     Ajustar en revisión visual, no inventar nuevos valores.
 */

// ─── Light palette ───────────────────────────────────────────────────────────
const LIGHT = {
  // Canvas — fondos de página
  bgCanvas: '#F6F7FA',              // oklch(98% 0.005 260)
  bgCanvasTint: '#EDEFF4',          // oklch(96% 0.010 260)

  // Surfaces glass — translúcidos; usar con BlurView / LinearGradient
  bgSurface: 'rgba(255,255,255,0.65)',        // oklch(100% 0 0 / 0.65)
  bgSurfaceStrong: 'rgba(255,255,255,0.85)',  // oklch(100% 0 0 / 0.85)
  bgSurfaceRaised: 'rgba(255,255,255,0.40)',  // oklch(100% 0 0 / 0.40)

  // Borders
  borderSubtle: 'rgba(255,255,255,0.18)',    // oklch(100% 0 0 / 0.18) — borde luz glass
  borderDefault: 'rgba(32,32,32,0.10)',      // oklch(20% 0 0 / 0.10)
  borderStrong: 'rgba(32,32,32,0.20)',       // oklch(20% 0 0 / 0.20)

  // Text
  textPrimary: '#1F2024',     // oklch(18% 0 0)
  textSecondary: '#555860',   // oklch(38% 0 0)
  textMuted: '#8A8C93',       // oklch(56% 0 0)
  textOnAccent: '#FCFCFD',    // oklch(99% 0 0)

  // Accent
  accent: '#4F62E0',                      // oklch(58% 0.21 260)
  accentStrong: '#3D4FCC',               // oklch(50% 0.22 260)
  accentSoft: 'rgba(79,98,224,0.12)',    // oklch(58% 0.21 260 / 0.12)

  // Status (semáforo)
  statusGreen: '#34B36B',   // oklch(68% 0.18 145)
  statusAmber: '#E2A23A',   // oklch(75% 0.16 75)
  statusRed: '#DE4A3C',     // oklch(60% 0.21 25)

  info: '#4E88CC',          // oklch(60% 0.15 230)
} as const;

// ─── Dark palette ────────────────────────────────────────────────────────────
const DARK = {
  bgCanvas: '#16171B',
  bgCanvasTint: '#1D1F25',

  // Glass oscuro — más opaco y difuso (design.md §7.5)
  bgSurface: 'rgba(30,32,40,0.55)',
  bgSurfaceStrong: 'rgba(28,30,38,0.80)',
  bgSurfaceRaised: 'rgba(35,37,46,0.40)',

  // Borders oscuros (design.md §7.5)
  borderSubtle: 'rgba(255,255,255,0.08)',
  borderDefault: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.18)',

  // Text
  textPrimary: '#F4F5F7',
  textSecondary: '#B3B5BC',
  textMuted: '#83858C',
  textOnAccent: '#FCFCFD',

  // Accent oscuro — más luminoso para visibilidad
  accent: '#7C8CFF',
  accentStrong: '#6B7BF0',
  accentSoft: 'rgba(124,140,255,0.15)',

  // Status oscuro — ligeramente desaturados (design.md §8.2)
  statusGreen: '#3EC97A',   // oklch(72% 0.16 145)
  statusAmber: '#F0AE42',   // oklch(78% 0.14 75)
  statusRed: '#E85B4D',     // oklch(65% 0.18 25)

  info: '#5B9DD8',
} as const;

// ─── Gradients ───────────────────────────────────────────────────────────────
/** Tuplas para uso directo con expo-linear-gradient `colors` prop */
export const gradients = {
  canvasLight: ['#F6F7FA', '#EDEFF4'] as [string, string],
  canvasDark: ['#16171B', '#1D1F25'] as [string, string],
  accent: ['#4F62E0', '#3D4FCC'] as [string, string],
  accentDark: ['#7C8CFF', '#6B7BF0'] as [string, string],
  ambientTopLeft: ['rgba(139,157,255,0.30)', 'transparent'] as [string, string],
  ambientBottomRight: ['rgba(255,180,130,0.20)', 'transparent'] as [string, string],
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────
/** Presets de sombra RN (una sombra por objeto — design.md §5) */
export type ShadowPreset = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

export const shadows = {
  /** Chips, tooltips */
  sm: {
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  } satisfies ShadowPreset,
  /** Cards y paneles */
  md: {
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  } satisfies ShadowPreset,
  /** Modales, sheets */
  lg: {
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 40,
    elevation: 12,
  } satisfies ShadowPreset,
} as const;

// ─── Radii ───────────────────────────────────────────────────────────────────
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  pill: 9999,
} as const;

// ─── Spacing (ritmo de 4px) ───────────────────────────────────────────────────
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
  card: 20,
  section: 48,
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
/** Tamaños fijos (RN no tiene clamp/vw). Basados en extremo alto del clamp de design.md */
export const fontSize = {
  xs: 13,
  sm: 15,
  base: 17,
  lg: 19,
  xl: 23,
  '2xl': 30,
  '3xl': 40,
  display: 56,
  numeric: 52,
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
} as const;

export const lineHeight = {
  tight: 1.15,
  snug: 1.3,
  normal: 1.5,
  relaxed: 1.65,
} as const;

/**
 * Nombres de familia para usar en StyleSheet / fontFamily prop.
 * Las fuentes deben estar cargadas via use-fonts.ts antes de usarlas.
 */
export const fontFamily = {
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  system: 'System',
} as const;

// ─── Motion ──────────────────────────────────────────────────────────────────
/** Duraciones en ms — design.md §6 */
export const duration = {
  instant: 100,
  fast: 150,
  normal: 220,
  slow: 320,
  slowest: 500,
} as const;

// ─── Composed theme ──────────────────────────────────────────────────────────
export const theme = {
  light: LIGHT,
  dark: DARK,
} as const;

export type ColorScheme = 'light' | 'dark';
export type Colors = typeof LIGHT | typeof DARK;

/** Devuelve el conjunto de colores según el scheme activo */
export function getColors(scheme: ColorScheme): Colors {
  return scheme === 'dark' ? DARK : LIGHT;
}

export { LIGHT as lightColors, DARK as darkColors };
