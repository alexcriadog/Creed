/**
 * Tokens de docs/design.md portados a valores renderizables por React Native.
 * Los oklch originales no son renderizables en RN; estos hex/rgba son conversiones
 * aproximadas — afinar en revisión visual, no inventar nuevos.
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: { DEFAULT: '#F6F7FA', tint: '#EDEFF4' },
        surface: { DEFAULT: '#FFFFFF', strong: '#FFFFFF' },
        border: { subtle: '#E7E9EE', DEFAULT: '#E3E5EA', strong: '#CDD0D8' },
        text: { primary: '#1F2024', secondary: '#54565C', muted: '#8A8C93', 'on-accent': '#FCFCFD' },
        accent: { DEFAULT: '#4F62E0', strong: '#3D4FCC', soft: 'rgba(79,98,224,0.12)' },
        status: { green: '#34B36B', amber: '#E2A23A', red: '#DE4A3C' },
        // Dark (usar con variante dark:)
        'canvas-dark': { DEFAULT: '#16171B', tint: '#1D1F25' },
        'surface-dark': { DEFAULT: '#23252C' },
        'text-dark': { primary: '#F4F5F7', secondary: '#B3B5BC', muted: '#83858C' },
        'accent-dark': { DEFAULT: '#7C8CFF' },
      },
      borderRadius: { sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, pill: 9999 },
      fontFamily: { sans: ['Geist', 'System'], display: ['Geist', 'System'], mono: ['Geist Mono', 'monospace'] },
    },
  },
};
