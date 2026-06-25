/**
 * Tailwind preset — Creed Design System v2
 *
 * Tokens de docs/design.md portados a valores renderizables por React Native / NativeWind.
 * Los oklch originales no son renderizables en RN; estos hex/rgba son conversiones
 * aproximadas — afinar en revisión visual, no inventar nuevos.
 *
 * v1 (Fase 1): colores light básicos + radius + fuente.
 * v2 (Fase 3): dark completo, accent-strong/soft, gradientes, sombras, semánticos.
 *
 * CLASES QUE DEBEN SEGUIR FUNCIONANDO (backward compat):
 *   bg-canvas, bg-surface, text-text-primary, bg-accent,
 *   border-border, rounded-sm/md/lg/xl/2xl/pill
 */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Light ─────────────────────────────────────────────────────────
        canvas: {
          DEFAULT: '#F6F7FA',                    // oklch(98% 0.005 260)
          tint: '#EDEFF4',                       // oklch(96% 0.010 260)
        },
        surface: {
          DEFAULT: 'rgba(255,255,255,0.65)',      // glass — translúcido
          strong: 'rgba(255,255,255,0.85)',
          raised: 'rgba(255,255,255,0.40)',
        },
        border: {
          subtle: 'rgba(255,255,255,0.18)',       // borde glass luz
          DEFAULT: 'rgba(32,32,32,0.10)',
          strong: 'rgba(32,32,32,0.20)',
        },
        text: {
          primary: '#1F2024',
          secondary: '#555860',
          muted: '#8A8C93',
          'on-accent': '#FCFCFD',
        },
        accent: {
          DEFAULT: '#4F62E0',
          strong: '#3D4FCC',
          soft: 'rgba(79,98,224,0.12)',
        },
        status: {
          green: '#34B36B',
          amber: '#E2A23A',
          red: '#DE4A3C',
        },
        info: '#4E88CC',

        // ── Dark (usar con dark: prefix en NativeWind) ────────────────────
        'canvas-dark': {
          DEFAULT: '#16171B',
          tint: '#1D1F25',
        },
        'surface-dark': {
          DEFAULT: 'rgba(30,32,40,0.55)',
          strong: 'rgba(28,30,38,0.80)',
          raised: 'rgba(35,37,46,0.40)',
        },
        'border-dark': {
          subtle: 'rgba(255,255,255,0.08)',
          DEFAULT: 'rgba(255,255,255,0.10)',
          strong: 'rgba(255,255,255,0.18)',
        },
        'text-dark': {
          primary: '#F4F5F7',
          secondary: '#B3B5BC',
          muted: '#83858C',
          'on-accent': '#FCFCFD',
        },
        'accent-dark': {
          DEFAULT: '#7C8CFF',
          strong: '#6B7BF0',
          soft: 'rgba(124,140,255,0.15)',
        },
        'status-dark': {
          green: '#3EC97A',
          amber: '#F0AE42',
          red: '#E85B4D',
        },
      },

      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '32px',
        pill: '9999px',
      },

      fontFamily: {
        sans: ['Inter_400Regular', 'Inter', 'System', 'ui-sans-serif'],
        display: ['Inter_700Bold', 'Inter', 'System', 'ui-sans-serif'],
        mono: ['ui-monospace', 'monospace'],
      },

      fontSize: {
        xs: ['13px', { lineHeight: '1.5' }],
        sm: ['15px', { lineHeight: '1.5' }],
        base: ['17px', { lineHeight: '1.5' }],
        lg: ['19px', { lineHeight: '1.3' }],
        xl: ['23px', { lineHeight: '1.3' }],
        '2xl': ['30px', { lineHeight: '1.15' }],
        '3xl': ['40px', { lineHeight: '1.15' }],
        display: ['56px', { lineHeight: '1.1' }],
        numeric: ['52px', { lineHeight: '1.1' }],
      },

      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        16: '64px',
        20: '80px',
        24: '96px',
      },
    },
  },
};
