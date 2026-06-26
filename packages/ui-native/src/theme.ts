/**
 * Design System v3 — Creed · Dark Atlético (tier Whoop / Gymshark / Nike)
 *
 * Dirección: un campo dominante (negro frío) + un acento lima/volt usado con
 * disciplina. Profundidad por superficies + hairlines + glow sutil (no blur).
 * Tipografía con carácter: Space Grotesk (display) + Inter (body), números
 * tabulares grandes. Referencia canonical: docs/superpowers/specs/2026-06-26-dark-athletic-redesign.md
 *
 * IMPORTANTE — compatibilidad:
 *   - `colors` / `darkColors` = tokens v3 (lo que los componentes consumen).
 *   - `lightColors` (LIGHT) = paleta v2 legacy. Se MANTIENE intacta para que las
 *     pantallas aún no rediseñadas sigan compilando. Se retirará por pantalla.
 */

// ─── v3 Dark Atlético — paleta primaria ───────────────────────────────────────
/** Tokens v3 (hex exactos del spec). Esto es lo que la app usa. */
const DARK_V3 = {
  // Campo
  canvas: '#0A0B0D', // negro frío, fondo más profundo
  surface1: '#141619', // tarjetas
  surface2: '#1C1F25', // inputs, filas, elevado
  surfaceHi: '#232730', // hover/activo

  // Hairlines (líneas de 1px que dan estructura sobre negro)
  hairline: 'rgba(255,255,255,0.07)',
  hairlineStrong: 'rgba(255,255,255,0.12)',

  // Texto
  textPrimary: '#F4F6F8',
  textSecondary: '#9AA1AC',
  textMuted: '#5C636E',

  // Acento — lima/volt, THE acento
  accent: '#C6FF3A',
  accentDim: '#9FCC2E', // lima apagado
  onAccent: '#0A0B0D', // texto/icono SOBRE relleno lima = casi negro
  accentGlow: 'rgba(198,255,58,0.25)', // glow/sombra de acento
  accentSoft: 'rgba(198,255,58,0.10)', // wash de acento (chips, rings tenues)

  // Estado
  danger: '#FF5D5D',
  warn: '#FFB44D',
} as const;

// ─── Light palette v2 (LEGACY — no tocar) ──────────────────────────────────────
const LIGHT = {
  // Canvas — fondos de página
  bgCanvas: '#F6F7FA', // oklch(98% 0.005 260)
  bgCanvasTint: '#EDEFF4', // oklch(96% 0.010 260)

  // Surfaces glass — translúcidos; usar con BlurView / LinearGradient
  bgSurface: 'rgba(255,255,255,0.65)', // oklch(100% 0 0 / 0.65)
  bgSurfaceStrong: 'rgba(255,255,255,0.85)', // oklch(100% 0 0 / 0.85)
  bgSurfaceRaised: 'rgba(255,255,255,0.40)', // oklch(100% 0 0 / 0.40)

  // Borders
  borderSubtle: 'rgba(255,255,255,0.18)', // oklch(100% 0 0 / 0.18) — borde luz glass
  borderDefault: 'rgba(32,32,32,0.10)', // oklch(20% 0 0 / 0.10)
  borderStrong: 'rgba(32,32,32,0.20)', // oklch(20% 0 0 / 0.20)

  // Text
  textPrimary: '#1F2024', // oklch(18% 0 0)
  textSecondary: '#555860', // oklch(38% 0 0)
  textMuted: '#8A8C93', // oklch(56% 0 0)
  textOnAccent: '#FCFCFD', // oklch(99% 0 0)

  // Accent
  accent: '#4F62E0', // oklch(58% 0.21 260)
  accentStrong: '#3D4FCC', // oklch(50% 0.22 260)
  accentSoft: 'rgba(79,98,224,0.12)', // oklch(58% 0.21 260 / 0.12)

  // Status (semáforo)
  statusGreen: '#34B36B', // oklch(68% 0.18 145)
  statusAmber: '#E2A23A', // oklch(75% 0.16 75)
  statusRed: '#DE4A3C', // oklch(60% 0.21 25)

  info: '#4E88CC', // oklch(60% 0.15 230)
} as const;

// ─── Dark palette v2 (LEGACY — preservada para getColors('dark')) ──────────────
const DARK = {
  bgCanvas: '#16171B',
  bgCanvasTint: '#1D1F25',

  bgSurface: 'rgba(30,32,40,0.55)',
  bgSurfaceStrong: 'rgba(28,30,38,0.80)',
  bgSurfaceRaised: 'rgba(35,37,46,0.40)',

  borderSubtle: 'rgba(255,255,255,0.08)',
  borderDefault: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.18)',

  textPrimary: '#F4F5F7',
  textSecondary: '#B3B5BC',
  textMuted: '#83858C',
  textOnAccent: '#FCFCFD',

  accent: '#7C8CFF',
  accentStrong: '#6B7BF0',
  accentSoft: 'rgba(124,140,255,0.15)',

  statusGreen: '#3EC97A',
  statusAmber: '#F0AE42',
  statusRed: '#E85B4D',

  info: '#5B9DD8',
} as const;

// ─── Gradients ───────────────────────────────────────────────────────────────
/** Tuplas para uso directo con expo-linear-gradient `colors` prop */
export const gradients = {
  // v3 — atmósfera dark atlético
  /** Fondo de pantalla: del canvas a un negro con tinte (3 stops). */
  canvasV3: ['#0A0B0D', '#101317', '#0C0E11'] as [string, string, string],
  /** Orbe de glow lima muy tenue para una esquina (radial-ish vía linear). */
  accentOrb: ['rgba(198,255,58,0.06)', 'transparent'] as [string, string],
  /** Relleno de botón/elemento acento (lima → lima apagado). */
  accentV3: ['#C6FF3A', '#9FCC2E'] as [string, string],

  // v2 legacy
  canvasLight: ['#F6F7FA', '#EDEFF4'] as [string, string],
  canvasDark: ['#16171B', '#1D1F25'] as [string, string],
  accent: ['#4F62E0', '#3D4FCC'] as [string, string],
  accentDark: ['#7C8CFF', '#6B7BF0'] as [string, string],
  ambientTopLeft: ['rgba(139,157,255,0.30)', 'transparent'] as [string, string],
  ambientBottomRight: ['rgba(255,180,130,0.20)', 'transparent'] as [string, string],
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────
/** Presets de sombra RN (una sombra por objeto) */
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 2,
  } satisfies ShadowPreset,
  /** Cards y paneles — sombra suave hacia abajo sobre negro */
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 6,
  } satisfies ShadowPreset,
  /** Modales, sheets, FAB */
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 40,
    elevation: 12,
  } satisfies ShadowPreset,
} as const;

/**
 * glow — sombra de acento (halo lima) para superficies/elementos activos.
 * Úsalo en cards con foco, el cronómetro, el thumb del swipe, etc.
 *
 * @param strength 'soft' | 'strong' — intensidad del halo. Default 'soft'.
 */
export function glow(strength: 'soft' | 'strong' = 'soft'): ShadowPreset {
  return {
    shadowColor: DARK_V3.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: strength === 'strong' ? 0.55 : 0.35,
    shadowRadius: strength === 'strong' ? 20 : 12,
    elevation: strength === 'strong' ? 10 : 6,
  };
}

// ─── Radii ───────────────────────────────────────────────────────────────────
/** Radios generosos (12-16 para superficies, pill para circulares) */
export const radii = {
  sm: 10,
  md: 14,
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
/** Tamaños fijos (RN no tiene clamp/vw). Escala con buen contraste de tamaño. */
export const fontSize = {
  xs: 13,
  sm: 15,
  base: 17,
  lg: 19,
  xl: 23,
  '2xl': 30,
  '3xl': 40,
  display: 44, // héroes de verdad: 32-44
  numeric: 52,
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
} as const;

export const lineHeight = {
  tight: 1.05,
  snug: 1.2,
  normal: 1.5,
  relaxed: 1.65,
} as const;

/**
 * Nombres de familia para fontFamily prop. Cargadas via use-fonts.ts.
 * Display = Space Grotesk (geométrico/técnico) · Body = Inter.
 */
export const fontFamily = {
  // Display — Space Grotesk
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_500Medium',
  // Body — Inter
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  system: 'System',
} as const;

/**
 * `fonts` — mapeo semántico display/body para el design system v3.
 * Úsalo cuando quieras la intención ("esto es display") sin acordarte del peso.
 */
export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

// ─── Motion ──────────────────────────────────────────────────────────────────
/** Duraciones en ms (entradas rápidas <350ms) */
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

/** Devuelve el conjunto de colores v2 (legacy) según el scheme activo */
export function getColors(scheme: ColorScheme): Colors {
  return scheme === 'dark' ? DARK : LIGHT;
}

// ─── v3 primary exports ────────────────────────────────────────────────────────
export type DarkColors = typeof DARK_V3;

/** Tokens v3 dark atlético — export PRIMARIO que consumen los componentes. */
export const colors = DARK_V3;

// `darkColors` = v3 (lo que la app usa). `lightColors` = v2 legacy (no tocar).
export { DARK_V3 as darkColors, LIGHT as lightColors };
