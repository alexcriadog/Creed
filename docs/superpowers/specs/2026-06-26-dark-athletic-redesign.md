# Creed — Rediseño Dark Atlético (Design System v3)

Dirección elegida por el usuario: **dark atlético premium** (tier Whoop / Gymshark / Nike Training). Objetivo: que NO parezca UI de IA. Moderno, visual, con motion fluido (compositor: transform/opacity/scale), 100% mobile-first. Esto **reemplaza** el light glass de v2 en TODA la app.

## Principios
- **Un campo dominante (negro) + un acento (lima/volt)**, usado con disciplina. Nada de arcoíris.
- **Profundidad por superficies + hairlines + glow sutil**, no por blur pesado (el blur sobre negro embarra).
- **Tipografía con carácter**: display geométrico + números tabulares grandes (peso, cronómetro, series). El dato es protagonista.
- **Motion con sentido**: spring press, entradas escalonadas, un momento memorable por pantalla (el check de serie, el swipe-to-finish). Nunca micro-animaciones porque sí.
- **Navegación coherente**: back/close circular arriba-izq en TODA pantalla + gestos nativos. Pulgar alcanza las acciones (acciones primarias abajo).

## Paleta (hex exactos)
```
canvas        #0A0B0D   (negro frío, fondo más profundo)
surface1      #141619   (tarjetas)
surface2      #1C1F25   (inputs, filas, elevado)
surfaceHi     #232730   (hover/activo)
hairline      rgba(255,255,255,0.07)
hairlineStrong rgba(255,255,255,0.12)
textPrimary   #F4F6F8
textSecondary #9AA1AC
textMuted      #5C636E
accent        #C6FF3A   (lima/volt — THE acento)
accentDim     #9FCC2E   (lima apagado)
onAccent      #0A0B0D   (texto/icono SOBRE relleno lima = casi negro)
accentGlow    rgba(198,255,58,0.25)  (glow/sombra de acento)
danger        #FF5D5D
warn          #FFB44D
```
Gradientes de atmósfera: del canvas a un negro con tinte (#0A0B0D → #101317 → #0C0E11), + un **orbe de glow lima** muy tenue (rgba(198,255,58,0.06)) en una esquina. Sutil, no neón chillón.

## Tipografía
- **Display** (titulares, eyebrows, números hero): `Space Grotesk` (vía @expo-google-fonts/space-grotesk) — geométrico, técnico, con carácter. Pesos 500/700.
- **Body / UI**: `Inter` (ya instalado). 400/500/600.
- **Números** (peso, reps, cronómetro, contadores): tabular (`fontVariant:['tabular-nums']`), grandes y rotundos. El cronómetro y "X/Y series" como dato protagonista.
- Escala con buen contraste de tamaño (display grande de verdad: 32-44 para héroes; nada de todo-igual).

## Profundidad / superficies
- Tarjetas = `surface1` con **hairline** (1px, `hairline`) + sombra suave hacia abajo; las activas/foco llevan **borde acento + glow** (`accentGlow`).
- Inputs/filas = `surface2`, radios generosos (12-16), focus con borde acento.
- Capas: la app se siente "de cristal oscuro con luz", no plano. Usa overlap/elevación intencional.

## Motion (reanimated 4)
- `usePressScale`: spring a 0.96 (no timing lineal).
- Entradas escalonadas (`useFadeSlideIn` con delays), pero rápidas (<350ms) y fluidas.
- **Check de serie** (momento memorable): al completar, pop + relleno lima + glow + háptica `success`.
- **Cronómetro**: pulso/respiración muy sutil del glow.
- Transiciones de página (rail/foco) springy.
- Todo en transform/opacity (compositor). Respeta reduced-motion.

## Navegación
- `IconButton` circular (surface2 + hairline) con icono back/close (lucide `ChevronLeft` / `X`) arriba-izq, consistente en TODA pantalla.
- Acciones primarias al alcance del pulgar (abajo).

## Swipe-to-finish (reinventa "Finalizar entreno")
- Componente nuevo `SwipeToFinish` (gesture-handler + reanimated): pista oscura (surface2) con thumb lima arrastrable; al arrastrar, **se rellena** de lima; pasado el umbral (~85%) + soltar → dispara `onFinish` con háptica (ticks al arrastrar + success al cruzar) y un estado "Finalizado". Label "Desliza para finalizar". Accesible (también un onPress de fallback / role button). Reemplaza el botón plano.

## Componentes a renovar (packages/ui-native)
theme.ts (tokens v3 como **default**, manteniendo el dark; el light v2 puede quedar como `lightColors` legacy pero la app usa el dark), motion.ts (springs), y: AppText (variants display/eyebrow/heading/body/label/muted/stat con la tipografía nueva), Button (variants: `accent` [relleno lima, texto onAccent], `surface` [surface2 + hairline], `ghost`; tamaños; estados press/disabled/loading con spring), Surface/Card (dark depth + variante con glow), Input (surface2, focus acento), Badge/Chip (dark + acento), Header (con back integrado), IconButton (circular dark), Divider (hairline), NumberStepper, FAB, y `SwipeToFinish` (nuevo), `ExerciseRail` (ya existe — re-skin dark+glow).

## Rollout
1. **Foundation + Sesión (vitrina):** sistema v3 + componentes + rediseño de `session/[id].tsx` (+ rail/page) en dark atlético con swipe-to-finish, back/close, motion. Capturar y confirmar dirección con el usuario.
2. **Resto de pantallas** a v3: login/verify, Home, start (selector), program, exercises (catálogo+detalle), routines (lista+editor), history (lista+detalle). Back coherente + motion en cada una.
3. Review final + merge.

Restricción: preservar TODA la lógica de datos/estado existente (los fixes de Fase 4 en la sesión, etc.). Esto es re-skin + motion + nav, no cambiar la lógica. jest verde · tsc 0 · expo export en cada paso. Fuente nueva = `npx expo install @expo-google-fonts/space-grotesk` y cargarla en el gate de fuentes de `_layout`.
