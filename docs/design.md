# Design System — Creed

> Referencia visual y de tokens del proyecto. Se usa desde `06-frontend.md` y desde cualquier nuevo componente. Pensado como **fuente única de verdad estética**: cuando algo se ve "a template" o sale de identidad, este doc dice cómo corregirlo.
>
> Estado: ✅ v1 (sesión 6, 2026-05-08).

## Tabla de contenidos

1. [Filosofía visual](#1-filosofía-visual)
2. [Tokens — color](#2-tokens--color)
3. [Tokens — tipografía](#3-tokens--tipografía)
4. [Tokens — spacing y radius](#4-tokens--spacing-y-radius)
5. [Tokens — sombras y elevación](#5-tokens--sombras-y-elevación)
6. [Tokens — motion](#6-tokens--motion)
7. [Glass moderno: receta](#7-glass-moderno-receta)
8. [Modos claro y oscuro](#8-modos-claro-y-oscuro)
9. [Iconografía](#9-iconografía)
10. [Componentes core](#10-componentes-core)
11. [Accesibilidad](#11-accesibilidad)
12. [Anti-patterns](#12-anti-patterns)
13. [Cómo añadir un componente nuevo](#13-cómo-añadir-un-componente-nuevo)

---

## 1. Filosofía visual

Creed adopta **glass moderno bien hecho**. No es "le ponemos `backdrop-filter: blur(10px)` a una card y ya". Es:

- **Capas reales con profundidad**. Background ambiental + glass de superficie + contenido. Tres planos visualmente distintos.
- **Translucidez con propósito**. La transparencia revela un fondo que **importa** (color sutil, gradiente). Si el fondo es blanco plano, el glass parece truco.
- **Bordes finos con luz**. Cada superficie glass tiene un borde de 1px con un tinte de color que sugiere reflejo de luz.
- **Sombras suaves y largas**. Sombra grande con baja opacidad. Nada de drop-shadow agresivo.
- **Tipografía sólida sobre lo translúcido**. Cuando el fondo es glass, el texto **siempre** tiene contraste suficiente. Probamos con WCAG AA.
- **Movimiento que respeta físicas**. Sheets que vienen desde abajo, modales que escalan + fade, transiciones con `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) o `cubic-bezier(0.32, 0.72, 0, 1)` (Apple-style).

**Inspiración**: iOS 26 Liquid Glass, visionOS, Linear (capas), Stripe (calidad), Apple Fitness (data den­sity).

**Anti-inspiración**: cualquier card con `backdrop-blur-md` aplicado sin contexto, dashboards con todas las cards en el mismo plano, Material Design plano con elevación binaria.

---

## 2. Tokens — color

### 2.1 Por qué OKLCH

- Espacio perceptualmente uniforme: 50% lightness se ve como 50% lightness.
- Permite generar variantes (más claro / más oscuro / más saturado) sin saltos de tono.
- Soportado en navegadores modernos.

Todos los tokens de color se definen como variables CSS en `oklch()`. Nunca usamos hex en CSS de aplicación, solo en tokens.

### 2.2 Paleta semántica

```css
:root {
  /* Backgrounds — capas */
  --bg-canvas:        oklch(98% 0.005 260);   /* fondo de página, casi blanco con un tinte azul minúsculo */
  --bg-canvas-tint:   oklch(96% 0.010 260);   /* gradiente sutil sobre canvas */
  --bg-surface:       oklch(100% 0 0 / 0.65); /* glass — el blanco translúcido que ves "encima" */
  --bg-surface-strong: oklch(100% 0 0 / 0.85); /* glass cuando necesita más opacidad (modales) */
  --bg-surface-raised: oklch(100% 0 0 / 0.4);  /* glass hover/elevación extra */

  /* Borders */
  --border-subtle:    oklch(100% 0 0 / 0.18); /* borde glass — luz */
  --border-default:   oklch(20% 0 0 / 0.10);  /* borde de card, divisores */
  --border-strong:    oklch(20% 0 0 / 0.20);  /* borde de inputs activos */

  /* Text */
  --text-primary:     oklch(18% 0 0);
  --text-secondary:   oklch(38% 0 0);
  --text-muted:       oklch(56% 0 0);
  --text-on-accent:   oklch(99% 0 0);

  /* Accent — un solo accent contundente */
  --accent:           oklch(58% 0.21 260);    /* azul vivo */
  --accent-strong:    oklch(50% 0.22 260);    /* hover/active */
  --accent-soft:      oklch(58% 0.21 260 / 0.12); /* fondo sutil de accent */

  /* Semáforo */
  --status-green:     oklch(68% 0.18 145);    /* verde fresco */
  --status-amber:     oklch(75% 0.16 75);     /* ámbar dorado */
  --status-red:       oklch(60% 0.21 25);     /* rojo cálido */

  /* Estados de UI */
  --info:    oklch(60% 0.15 230);
  --success: var(--status-green);
  --warning: var(--status-amber);
  --danger:  var(--status-red);
}
```

### 2.3 Variantes de modo oscuro

Definidas en §8. La estructura de variables es **la misma**, solo cambian los valores. Los componentes nunca tocan colores específicos de modo, solo las variables semánticas.

### 2.4 Reglas de uso

- **Nunca animar `background-color`** entre estados de tema. El cambio de modo claro/oscuro es instantáneo en MVP (transición en V1).
- **Texto sobre glass**: contraste mínimo WCAG AA (4.5:1 para texto normal). Probar con linter.
- **No usar el accent como fondo de cards grandes**. El accent es para CTAs, links activos, indicadores de selección. Fondo de bloque grande = `--bg-surface`.

---

## 3. Tokens — tipografía

### 3.1 Familias

```css
:root {
  --font-sans:    "Geist", "Inter", system-ui, -apple-system, sans-serif;
  --font-display: "Geist", "Inter Display", system-ui, sans-serif;
  --font-mono:    "Geist Mono", "JetBrains Mono", ui-monospace, monospace;
}
```

Decisión cerrada en sesión 6: **Geist (Vercel) para todo**. Variable font, una sola familia para sans, display y mono.

Cargamos solo los pesos necesarios: 400, 500, 600, 700 + cursiva 400. Subset latin-1 + latin-ext.

### 3.2 Escala (clamp para fluidez)

```css
:root {
  --text-xs:       clamp(0.75rem, 0.72rem + 0.1vw, 0.8125rem);
  --text-sm:       clamp(0.875rem, 0.85rem + 0.1vw, 0.9375rem);
  --text-base:     clamp(1rem, 0.96rem + 0.2vw, 1.0625rem);
  --text-lg:       clamp(1.125rem, 1.05rem + 0.3vw, 1.1875rem);
  --text-xl:       clamp(1.25rem, 1.1rem + 0.6vw, 1.4375rem);
  --text-2xl:      clamp(1.5rem, 1.2rem + 1.2vw, 1.875rem);
  --text-3xl:      clamp(1.875rem, 1.4rem + 2vw, 2.5rem);
  --text-display:  clamp(2.5rem, 1.8rem + 3vw, 3.5rem);

  /* Para números grandes (recovery, peso, calorías) */
  --text-numeric:  clamp(2.25rem, 1.6rem + 2.6vw, 3.25rem);

  /* Line-heights — relativos a tamaño de texto */
  --leading-tight:   1.15;
  --leading-snug:    1.3;
  --leading-normal:  1.5;
  --leading-relaxed: 1.65;
}
```

### 3.3 Pesos y uso

- **400** texto de cuerpo y secundario.
- **500** énfasis ligero, labels.
- **600** títulos de card, links activos.
- **700** display y números grandes.

### 3.4 Numerales tabulares

Para datos tabulares y tickers (recovery, peso EMA, calorías), usamos `font-feature-settings: "tnum"` para que las cifras estén alineadas verticalmente cuando cambian.

### 3.5 Reglas

- Nunca poner texto en mayúsculas con `text-transform: uppercase` para cuerpo. Solo en labels muy cortos.
- `letter-spacing` por defecto de Geist está bien. Solo retocar en headings muy grandes (-0.02em).
- Los números grandes del dashboard usan `--font-mono` o sans con `tnum`.

---

## 4. Tokens — spacing y radius

```css
:root {
  /* Spacing (basado en 4px) */
  --space-1:  0.25rem;   /* 4 */
  --space-2:  0.5rem;    /* 8 */
  --space-3:  0.75rem;   /* 12 */
  --space-4:  1rem;      /* 16 */
  --space-5:  1.25rem;   /* 20 */
  --space-6:  1.5rem;    /* 24 */
  --space-8:  2rem;      /* 32 */
  --space-10: 2.5rem;    /* 40 */
  --space-12: 3rem;      /* 48 */
  --space-16: 4rem;      /* 64 */
  --space-20: 5rem;      /* 80 */
  --space-24: 6rem;      /* 96 */

  /* Spacing semánticos */
  --space-section: clamp(3rem, 2rem + 5vw, 6rem);
  --space-card:    var(--space-5);
  --space-input:   var(--space-3) var(--space-4);

  /* Radius */
  --radius-sm:   0.5rem;   /* 8 — botones pequeños */
  --radius-md:   0.75rem;  /* 12 — inputs */
  --radius-lg:   1rem;     /* 16 — cards */
  --radius-xl:   1.5rem;   /* 24 — modales, sheets */
  --radius-2xl:  2rem;     /* 32 — anillo de recovery */
  --radius-pill: 9999px;
}
```

### 4.1 Reglas

- Nunca usar `padding: 16px` directamente. Usa `--space-4`.
- Nunca mezclar más de 3 valores de radius en una pantalla (cards = `--radius-lg`, inputs = `--radius-md`, botones primarios = `--radius-md` o `--radius-pill`). Coherencia.
- Los modales y sheets usan `--radius-xl` o más para sentirse premium.

---

## 5. Tokens — sombras y elevación

Para glass: sombras grandes con baja opacidad. No `box-shadow: 0 1px 2px black` — eso es plano y feo.

```css
:root {
  /* Glass elevations */
  --shadow-glass-sm:
    0 1px 2px oklch(20% 0 0 / 0.04),
    0 8px 24px oklch(20% 0 0 / 0.06);

  --shadow-glass-md:
    0 2px 4px oklch(20% 0 0 / 0.04),
    0 16px 48px oklch(20% 0 0 / 0.08);

  --shadow-glass-lg:
    0 4px 8px oklch(20% 0 0 / 0.05),
    0 32px 80px oklch(20% 0 0 / 0.12);

  /* Inner highlight — el "vidrio" */
  --highlight-inner-top:
    inset 0 1px 0 oklch(100% 0 0 / 0.6);
  --highlight-inner-bottom:
    inset 0 -1px 0 oklch(20% 0 0 / 0.05);

  /* Focus ring */
  --ring-focus:
    0 0 0 2px var(--bg-canvas),
    0 0 0 4px var(--accent);
}
```

### 5.1 Cómo se combinan en una card glass

```css
.card-glass {
  background: var(--bg-surface);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--border-subtle);
  box-shadow:
    var(--shadow-glass-md),
    var(--highlight-inner-top);
  border-radius: var(--radius-lg);
}
```

---

## 6. Tokens — motion

```css
:root {
  /* Duraciones */
  --duration-instant: 100ms;
  --duration-fast:    150ms;
  --duration-normal:  220ms;
  --duration-slow:    320ms;
  --duration-slowest: 500ms;

  /* Easings */
  --ease-out-expo:   cubic-bezier(0.16, 1, 0.3, 1);     /* default — sale lentamente, llega rápido */
  --ease-out-apple:  cubic-bezier(0.32, 0.72, 0, 1);    /* iOS-like, bounce sutil */
  --ease-in-out:     cubic-bezier(0.65, 0, 0.35, 1);    /* pingpong */
  --ease-emphasized: cubic-bezier(0.2, 0, 0, 1);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-instant: 0ms;
    --duration-fast:    0ms;
    --duration-normal:  0ms;
    --duration-slow:    0ms;
  }
}
```

### 6.1 Reglas

- **Solo animar `transform`, `opacity`, `clip-path`, `filter`**. Nunca `width`, `height`, `top`, `left`.
- Hover states: `--duration-fast` con `--ease-out-expo`.
- Entradas de modal/sheet: `--duration-normal` con `--ease-out-apple`.
- Salidas: `--duration-fast` (más rápido que la entrada — más responsivo).
- `prefers-reduced-motion`: las duraciones se anulan automáticamente vía media query.

---

## 7. Glass moderno: receta

Cómo se hace una superficie glass que no parece truco:

### 7.1 Capa 1 — fondo con propósito

El fondo del canvas no es blanco plano. Tiene:

- Color base muy claro pero **con tinte** (`--bg-canvas` está en oklch con un poquito de chroma).
- Un gradiente radial ambiental sutil (un blob translúcido en una esquina) o un fondo con ruido sutil.

```css
body {
  background: var(--bg-canvas);
  background-image:
    radial-gradient(circle at 20% -10%, oklch(85% 0.10 260 / 0.6), transparent 50%),
    radial-gradient(circle at 90% 110%, oklch(85% 0.10 30 / 0.4), transparent 50%);
  background-attachment: fixed;
}
```

### 7.2 Capa 2 — superficie glass

Cards, panels, sheets, sidebars. Usan la receta de §5.1.

`backdrop-filter: blur(20px) saturate(180%)` da el efecto vidrio. El `saturate` realza los colores del fondo a través del cristal — sin él el glass se ve "lavado".

### 7.3 Capa 3 — contenido

Texto y elementos interactivos sobre el glass. **Nunca** otro glass encima de glass (rompe la jerarquía). Si hace falta otra capa, va modal con `--bg-surface-strong`.

### 7.4 Performance

- `backdrop-filter` es caro. Limitar a no más de **6-8 superficies glass simultáneas** en pantalla.
- Para listas largas (timeline, mensajes), las celdas son **transparentes plano** (no glass cada una). Solo el contenedor exterior es glass.
- En móvil de gama media, opcionalmente reducir blur a 12px con media query.

### 7.5 Modo oscuro

En oscuro, el glass es más sutil. Menos opacidad, más blur.

```css
[data-theme="dark"] {
  --bg-surface:       oklch(20% 0.005 260 / 0.55);
  --bg-surface-strong: oklch(20% 0.005 260 / 0.80);
  --border-subtle:    oklch(100% 0 0 / 0.08);
}
```

El fondo del canvas en oscuro tiene gradiente más profundo y algún punto de luz tenue.

---

## 8. Modos claro y oscuro

### 8.1 Detección y override

```html
<html data-theme="auto"> <!-- "auto" | "light" | "dark" -->
```

```css
:root { /* tokens claros */ }

[data-theme="dark"] { /* tokens oscuros */ }

@media (prefers-color-scheme: dark) {
  [data-theme="auto"] { /* tokens oscuros */ }
}
```

El atleta tiene en perfil un selector "Auto / Claro / Oscuro" que cambia `data-theme`.

### 8.2 Paleta oscura — semáforo

En oscuro, los colores del semáforo se desaturan ligeramente:

```css
[data-theme="dark"] {
  --status-green:  oklch(72% 0.16 145);
  --status-amber:  oklch(78% 0.14 75);
  --status-red:    oklch(65% 0.18 25);
}
```

### 8.3 Reglas

- Nunca animar el cambio de tema. Es instantáneo.
- Imágenes/fotos del atleta no se manipulan según tema.
- Logos y íconos tienen versiones para cada tema (o `currentColor` cuando aplica).

---

## 9. Iconografía

- Stack: **Lucide** (`lucide-react`). Razón: estilo coherente con minimal/glass, peso ajustable, tree-shakeable.
- Tamaños estándar: 16, 20, 24. Nada más en MVP.
- Stroke 1.5 por defecto. 2 para iconos en CTA primario.
- Los iconos heredan `currentColor` — nunca color hardcoded.

Para iconos específicos del producto (anillo de recovery, semáforo) creamos componentes propios (no íconos genéricos).

---

## 10. Componentes core

> Lista del mínimo viable. Cada componente vive en `packages/ui/`. Adoptamos shadcn/ui como **inspiración** (estructura del componente) pero **reescribimos los estilos** para alinearse al glass system.

### 10.1 Surfaces

- `Card` — surface glass estándar con padding `--space-card`.
- `CardElevated` — sombra mayor, blur mayor.
- `Sheet` — desliza desde abajo en móvil; desde el lado en desktop.
- `Modal` — centrado, backdrop oscurecido, escala + fade.
- `Popover` — flotante, tamaño contenido.

### 10.2 Inputs

- `Button` — variantes: primary (accent fill), secondary (outline), ghost (transparente), danger.
- `IconButton`.
- `Input` — para texto, número, fecha.
- `Textarea` — autorresize.
- `Select` — usa Popover, no `<select>` nativo (peor estilo en glass).
- `Toggle` — switch.
- `Slider` — para el panel admin (umbrales).
- `RadioGroup` y `CheckboxGroup`.

### 10.3 Navegación

- `Tabs` — el del chat (Nutri / Prep / IA).
- `TabBar` — bottom navigation en móvil.
- `Sidebar` — desktop, navegación principal.

### 10.4 Datos

- `Stat` — un único valor con label.
- `StatGroup` — bento de varios.
- `Progress` — barra horizontal.
- `Ring` — anillo de progreso (uso principal: recovery).
- `Sparkline` — minichart en línea para tendencias.
- `Chart` — wrapper sobre Recharts con tema aplicado.

### 10.5 Feedback

- `Banner` — el del estado (Whoop caído, etc.). Variantes: info, warning, danger, success.
- `Toast` — efímero, confirmación de acción.
- `EmptyState` — placeholder elegante cuando no hay datos.
- `Skeleton` — placeholder durante carga.

### 10.6 Específicos del producto

- `RecoveryRing` — anillo grande con el número compuesto + estado del semáforo.
- `WeightTrend` — chart EMA-7 vs EMA-28 con cruce visible.
- `MacroBar` — bar horizontal con porciones de proteína/carbo/grasa.
- `ProposalCard` — card inline en chat con diff + 3 botones.
- `CoachAvatar` — avatar de los dos coaches.
- `AgentNoteItem` — entrada en el timeline del Historial del coach.
- `WhoopStatusBadge` — chip con el estado.

---

## 11. Accesibilidad

- **Contraste**: WCAG AA mínimo (4.5:1 para texto normal, 3:1 para texto grande). Probamos con linter en CI.
- **Foco visible**: siempre un ring usando `--ring-focus`. Nunca `outline: none` sin reemplazo.
- **Navegación por teclado**: todo lo interactivo accesible con `Tab`. Modales atrapan foco.
- **Reduced motion**: respetado vía media query (§6).
- **Aria**: labels, roles y `aria-live` donde aplica (toasts, banners de estado).
- **Texto sobre imagen** (foto de progreso, etc.): siempre tiene un degradado oscuro detrás para asegurar contraste.

---

## 12. Anti-patterns

Si te encuentras escribiendo cualquiera de estos, para y revisa el sistema:

- ❌ Hex colors directamente en CSS. Usa tokens.
- ❌ `padding: 14px` o cualquier número fuera de la escala. Usa tokens.
- ❌ Glass sobre glass. Rompe jerarquía.
- ❌ `backdrop-blur-md` sin background con propósito. Resulta en truco.
- ❌ Drop shadows duros (`box-shadow: 0 2px 4px black`). Usa los `--shadow-glass-*`.
- ❌ Animar `width`/`height`/`top`/`left`. Solo `transform`/`opacity`.
- ❌ Cards uniformes en grid 3-columnas-todas-iguales. Rompe con jerarquía o usa bento.
- ❌ Colores semáforo de uso decorativo. Verde/ámbar/rojo solo para status.
- ❌ Iconos rellenos con `fill` sólido. Usa stroke 1.5.
- ❌ Botones outline grandes para CTA primario. CTA primario va relleno con accent.
- ❌ Modales con altura fija. Usan altura del contenido o `--vh`.

---

## 13. Cómo añadir un componente nuevo

1. Verifica que no exista en §10. Si existe pero te falta una variante, añade variante en su definición — no crees nuevo.
2. Define en `packages/ui/<Name>.tsx`. Sigue la convención de shadcn (props, forwardRef, `cn` para merging de clases).
3. Estilos solo con tokens. Si te falta un token, añádelo a este doc primero.
4. Storybook (cuando lo añadamos en V1) o un demo en `apps/web/app/demo/<name>/page.tsx`.
5. Test de regresión visual en Playwright (320, 768, 1440) en modo claro y oscuro.
6. Documenta uso en JSDoc del componente.
7. Si aporta un patrón nuevo (no solo variante), añade una entrada en §10 de este doc.
