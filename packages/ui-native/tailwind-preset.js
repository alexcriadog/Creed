/**
 * Tailwind preset — Creed Design System v3 (dark atlético)
 *
 * Tokens de docs/design.md portados a valores renderizables por React Native / NativeWind.
 * Los oklch originales no son renderizables en RN; estos hex/rgba son conversiones
 * aproximadas — afinar en revisión visual, no inventar nuevos.
 *
 * v1 (Fase 1): colores light básicos + radius + fuente.
 * v2 (Fase 3): dark completo, accent-strong/soft, gradientes, sombras, semánticos.
 * v3 (Fase 6): canvas y tokens principales actualizados al dark atlético v3
 *              (#0A0B0D negro frío, lima #C6FF3A). Los tokens light v2 se mantienen
 *              como `canvas-light` para backward compat.
 *
 * CLASES QUE DEBEN SEGUIR FUNCIONANDO:
 *   bg-canvas (#0A0B0D v3), bg-surface, text-text-primary, bg-accent (#C6FF3A v3),
 *   border-border, rounded-sm/md/lg/xl/2xl/pill,
 *   bg-canvas-light (v2 legacy #F6F7FA)
 */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── v3 Dark Atlético — tokens primarios ───────────────────────────
        // `canvas` apunta al negro frío v3. Los valores light v2 → `canvas-light`.
        canvas: {
          DEFAULT: '#0A0B0D',                    // v3 negro frío (era #F6F7FA)
          tint: '#141619',                       // v3 surface1 (era #EDEFF4)
        },
        // v3 surfaces
        'surface-1': '#141619',
        'surface-2': '#1C1F25',
        'surface-hi': '#232730',
        // v3 hairlines
        hairline: 'rgba(255,255,255,0.07)',
        'hairline-strong': 'rgba(255,255,255,0.12)',
        surface: {
          DEFAULT: '#141619',                    // v3 surface1 (era rgba glass)
          strong: '#1C1F25',                     // v3 surface2
          raised: '#232730',                     // v3 surfaceHi
        },
        border: {
          subtle: 'rgba(255,255,255,0.07)',       // v3 hairline
          DEFAULT: 'rgba(255,255,255,0.07)',      // v3 hairline
          strong: 'rgba(255,255,255,0.12)',       // v3 hairlineStrong
        },
        text: {
          primary: '#F4F6F8',                    // v3 textPrimary (era #1F2024)
          secondary: '#9AA1AC',                  // v3 textSecondary
          muted: '#7A828D',                      // v3 textMuted (AA-compliant ≈4.5:1)
          'on-accent': '#0A0B0D',               // v3 onAccent (era #FCFCFD)
        },
        accent: {
          DEFAULT: '#C6FF3A',                    // v3 lima/volt (era #4F62E0)
          strong: '#9FCC2E',                     // v3 accentDim
          soft: 'rgba(198,255,58,0.10)',         // v3 accentSoft
          glow: 'rgba(198,255,58,0.25)',         // v3 accentGlow
        },
        status: {
          green: '#34B36B',
          amber: '#FFB44D',                      // v3 warn
          red: '#FF5D5D',                        // v3 danger
        },
        info: '#4E88CC',

        // ── v2 legacy (backward compat) ───────────────────────────────────
        'canvas-light': {
          DEFAULT: '#F6F7FA',
          tint: '#EDEFF4',
        },

        // ── Dark v2 (usar con dark: prefix en NativeWind) ─────────────────
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
