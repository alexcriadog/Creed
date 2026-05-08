# 06 — Frontend

> Estado: ✅ Completo (sesión 6, 2026-05-08).
>
> Este doc cierra **decisiones de producto frontend** (qué pantallas, cómo se comportan, qué stack). El **design system reusable** (tokens, glass moderno, componentes core) vive en [`design.md`](./design.md).

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Stack frontend](#2-stack-frontend)
3. [Estructura de la app](#3-estructura-de-la-app)
4. [Pantallas — usuario atleta](#4-pantallas--usuario-atleta)
5. [Pantallas — admin](#5-pantallas--admin)
6. [Notificaciones](#6-notificaciones)
7. [PWA](#7-pwa)
8. [Internacionalización](#8-internacionalización)
9. [Accesibilidad](#9-accesibilidad)
10. [Rendimiento (Core Web Vitals)](#10-rendimiento-core-web-vitals)
11. [Visual regression y testing visual](#11-visual-regression-y-testing-visual)
12. [Decisiones cerradas en esta sesión](#12-decisiones-cerradas-en-esta-sesión)
13. [Decisiones abiertas](#13-decisiones-abiertas)

---

## 1. Resumen ejecutivo

Frontend de Creed: **Next.js 15 (App Router) + Tailwind v4 + Geist + Recharts modificado + Framer Motion en momentos clave**. Diseño **glass moderno bien hecho** con modo claro/oscuro automático. Mobile-first, instalable como PWA. Todas las decisiones visuales y los tokens viven en [`design.md`](./design.md).

Las pantallas clave son: **dashboard diario** (anillo de recovery + texto del coach + bento de stats), **chat con tabs Nutri/Prep/IA**, **registrar comida** (texto libre + parser Haiku con preview editable), **plan semanal** (cuadrícula 7 días), **historial del coach** (timeline cronológico inverso), y un **panel admin** completo solo para `role='admin'`.

---

## 2. Stack frontend

| Capa | Elección | Razón |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | RSC, edge runtime, streaming, ecosistema con Supabase |
| Lenguaje | **TypeScript estricto** | Sin `any` en código de aplicación |
| Estilos | **Tailwind v4** | OKLCH nativo, `@theme`, JIT, integración con tokens |
| Componentes | **shadcn/ui como base, reescritos** | Estructura sólida, estilos custom alineados a `design.md` |
| Tipografía | **Geist** (Vercel) | Sans + Display + Mono en una familia variable |
| Iconos | **Lucide** (`lucide-react`) | Stroke ajustable, tree-shake |
| Charts | **Recharts modificado pesadamente** | API React, comunidad, override total de estilos |
| Motion | **CSS puro + Framer Motion en momentos clave** | Bundle bajo, calidad alta donde aporta |
| Forms | **react-hook-form + zod** | Validación declarativa, errores tipados |
| State servidor | **Server Components + Supabase JS RLS-aware** | Sin librería extra de fetching para queries normales |
| State cliente | **Zustand** (mínimo) | Solo para UI state global (tema, banners) |
| i18n | **next-intl** | Estándar moderno con App Router |
| Realtime | **Supabase Realtime** | Datos de Whoop en vivo en el dashboard |

**No usamos** (decisiones explícitas):
- Material UI / Chakra / Mantine: defaults se ven a "template".
- Redux: overkill para una app de 2-5 cuentas.
- TanStack Query: Server Components + Supabase ya cubre la mayoría; lo añadimos en V1 si surge necesidad real.
- styled-components / emotion: Tailwind cubre el 100%.

---

## 3. Estructura de la app

```
apps/web/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── verify/                     # OTP verification
│   ├── (athlete)/
│   │   ├── layout.tsx                  # shell con TabBar/Sidebar
│   │   ├── page.tsx                    # dashboard diario
│   │   ├── chat/
│   │   │   └── [conversationId]/
│   │   ├── log/
│   │   │   ├── meal/
│   │   │   ├── weight/
│   │   │   └── workout/
│   │   ├── plan/
│   │   ├── history/                    # Historial del coach
│   │   └── profile/
│   │       └── whoop/                  # estado y reconectar
│   ├── (admin)/
│   │   └── admin/
│   │       ├── layout.tsx              # protección por role
│   │       ├── settings/               # umbrales, calorías mínimas
│   │       ├── models/                 # asignación por flujo + gasto
│   │       ├── conversations/          # visor por cuenta
│   │       └── prompts/                # versionado y rollback
│   ├── api/
│   │   ├── coach/                      # streaming SSE de los agentes
│   │   ├── whoop/                      # authorize, callback, disconnect
│   │   ├── meal-parser/                # Haiku parsing
│   │   ├── push/                       # PWA push subscription
│   │   └── admin/                      # endpoints protegidos por rol
│   └── layout.tsx                      # html, theme provider, fonts
├── components/                         # specific to apps/web
└── styles/
    └── tokens.css                      # tokens extraídos de design.md
```

Componentes compartidos viven en `packages/ui/` (definidos en `design.md` §10).

---

## 4. Pantallas — usuario atleta

### 4.1 Login

- Email + OTP (decisión sesión 6).
- Pantalla minimal: logotipo, input email, botón "Enviar código".
- Tras enviar: input de 6 dígitos con autofocus.
- Si el atleta es nuevo (primer login), redirige a `/onboarding`. Si ya completado, a `/`.

### 4.2 Onboarding (entrevista con el coach)

- Pantalla full-height con un solo Coach activo (mode='onboarding').
- Layout: **chat ocupa el 100%**, sin TabBar. Mensaje inicial del coach: "Hola. Voy a hacerte unas preguntas para diseñarte un plan a medida. Dura unos 20 minutos. Empezamos por…".
- Input al fondo, fijo. Botón "Pausar y continuar luego" arriba a la derecha.
- Cuando el atleta completa todas las secciones, el coach muestra una `ProposalCard` con el resumen del perfil. El atleta confirma y entra al dashboard.
- El progreso (% del cuestionario cubierto) se muestra como barra delgada arriba.

### 4.3 Dashboard diario (`/`)

**La pantalla más importante**. Layout vertical en móvil, 2 columnas en desktop.

**Móvil**:

```
┌─────────────────────────────┐
│ Banner de estado (si hay)   │  ← Sutil, glass, arriba
├─────────────────────────────┤
│        ⊛                    │
│      ╱   ╲                  │
│    │  62  │  Verde           │  ← RecoveryRing
│      ╲   ╱                  │
│        ⊕                    │
├─────────────────────────────┤
│ "Hoy vas bien. Recovery     │  ← Texto del coach
│  alto y peso bajando como   │
│  esperaba. Sigue."          │
├─────────────────────────────┤
│ ┌───────┐ ┌───────┐         │
│ │ Peso  │ │ Cal   │         │  ← Bento stats
│ │ 78.4  │ │ 1850  │         │
│ │ ↓0.3  │ │ /2050 │         │
│ └───────┘ └───────┘         │
│ ┌───────┐ ┌───────┐         │
│ │Adher. │ │Strain │         │
│ │ 86%   │ │ 14.2  │         │
│ └───────┘ └───────┘         │
├─────────────────────────────┤
│ Plan de hoy                 │
│ Push · 60min · RPE 7        │  ← Sesión hoy
│ [▶ Empezar]                 │
└─────────────────────────────┘
```

- **RecoveryRing**: anillo grande con número compuesto (no es 0-100; es etiqueta tipo "62 / Verde"). Color del ring = color del semáforo. Animación de entrada con CSS (delay 50ms tras LCP).
- **Texto del coach**: el resumen escrito por el preparador en el último cierre semanal o el día. Si no hay, fallback genérico.
- **Bento stats**: 4 mini-cards glass con datos clave del día. Tap abre detalle.
- **Plan de hoy**: card destacada con CTA primario "Empezar" o "Marcar hecho".
- En desktop, la columna derecha muestra adicionalmente el **histórico EMA del peso** y los **últimos eventos del coach**.

### 4.4 Chat con coaches (`/chat` o `/chat/[id]`)

- **Tabs arriba**: 🥗 Nutri · 💪 Prep · 🤖 Deja que decida.
- Al cambiar tab, cambia la conversación activa (cada agente tiene su threading).
- **Burbujas**:
  - Atleta: glass blanco, alineado a la derecha.
  - Coach: glass con tinte sutil del agente (verde para nutri, azul para prep), avatar al lado.
  - Sistema: gris muy suave, centrado, fuente más pequeña (modo lapso, cierre semanal).
- **ProposalCard inline**: cuando el coach propone un cambio, aparece dentro del chat con:
  - Título del cambio ("Reducir volumen 15%").
  - Razón ("Recovery medio 14d 38, viniendo de 56").
  - Diff visual (antes/después) si aplica.
  - 3 botones: **Aceptar** (accent), **Discutir** (ghost), **Rechazar** (danger ghost).
- **Streaming**: la respuesta del coach aparece token a token con un cursor parpadeante. Mientras llega, el botón "Enviar" muestra un loader y el chat scroll-locks al fondo.
- Input al fondo: textarea autoresize + botón enviar. En móvil, soporta enviar con Enter (con Shift+Enter para newline).

### 4.5 Registrar comida (`/log/meal`)

Optimizado para < 30s:

- Sheet desde abajo (no página completa) — el atleta vuelve al dashboard rápido tras registrar.
- **Input**: textarea grande con autofocus, placeholder "2 huevos revueltos, una tostada con aguacate, café con leche".
- Botón "Calcular" → llama a `/api/meal-parser` (Haiku 4.5).
- **Preview** aparece debajo: lista de items con cantidades y macros aproximados. Cada item es tap-to-edit (cambia gramos, sustituye por algo similar). MacroBar muestra el total con barra horizontal proteína/carbos/grasa.
- Botones al fondo: **Guardar** (primary) y **Cancelar** (ghost).
- Tras guardar, toast "Comida registrada · 540 kcal" y vuelve al dashboard.

### 4.6 Registrar peso/medidas (`/log/weight`)

- Sheet desde abajo.
- Input numérico grande con teclado numérico (`inputmode="decimal"`).
- Campos opcionales (% grasa, perímetros) plegados — tap "Más detalles" los expande.
- Botón "Guardar".

### 4.7 Plan semanal (`/plan`)

- Cuadrícula de 7 columnas (cards glass) en desktop, scroll horizontal en móvil con snap.
- Cada card: día (Lun · Mar · …), tipo de sesión (Push / Pull / Cardio / Rest), volumen estimado, estado (programado / hecho / saltado / parcial) con código de color del semáforo.
- Tap en una card abre un sheet con el detalle: ejercicios, sets prescritos, RPE objetivo, notas del preparador.
- Botón "Empezar" en la sesión de hoy.
- Botón "Regenerar plan con Opus" arriba a la derecha (solo aparece si han pasado ≥7 días desde la última generación o si el atleta tiene `role='admin'`).

### 4.8 Historial del coach (`/history`)

- Timeline cronológica inversa.
- Filtros arriba: agente (Todos / Nutri / Prep), categoría (chip multi-select).
- Cada `agent_note` es una card tap-to-expand:
  - Header: avatar del agente · categoría (chip de color) · fecha humana.
  - Body completo de la nota.
  - Si tiene `signal`, se muestra como bloque code-like con los datos que la dispararon.
  - Botón "¿Por qué?" — abre chat con el coach contextualizado en la nota (envía `note_id` con el primer mensaje).
- Vista vacía elegante: ilustración minimal + "Aún no hay decisiones registradas. Las verás aquí cuando empiecen a llegar".

### 4.9 Perfil (`/profile`)

- Datos básicos: avatar, display name, email, locale.
- Carpeta del atleta (lectura): objetivo, baseline, target, restrictions, equipment, schedule. Botón "Editar" abre conversación con el coach para que actualice.
- **Wearables**: estado de Whoop con el patrón visual de §4.10.
- **Notificaciones**: toggle PWA push + selector de hora del recordatorio + email de fallback.
- **Tema**: selector Auto / Claro / Oscuro.
- **Privacidad**: link a la política. Toggle "Permitir al admin leer mis conversaciones para mejorar el coach" (decisión de sesión 6: implícit consent — el toggle existe pero por defecto está activado y la política lo explica).
- **Borrar cuenta**: botón rojo, confirmación única, redirige a logout tras la cascada (sesión 6: cascada simple).

### 4.10 Banner de estado de Whoop (cabecera del dashboard)

Patrón **glass sutil arriba** con icono semafórico (decisión sesión 6).

Variantes:

- 🟢 connected — no se muestra (todo va bien).
- 🟡 sync > 25h — "Whoop sin sincronizar desde <hace>". CTA "Reintentar".
- 🟡 expired — "Conexión caducada". CTA "Reconectar".
- 🔴 revoked / error — "Error de sincronización". CTA "Reconectar" + "Detalles".

Cuando se resuelve, el banner desaparece con `--duration-normal` con `--ease-out-apple`.

### 4.11 Modo lapso

Pantalla full-height del chat con conversación nueva (`mode='lapse_recovery'`). El coach abre con el mensaje de re-engagement (definido en `05-agents.md` §12). Al cerrar el flow, vuelve al dashboard.

### 4.12 Cierre semanal

Si toca cierre, el dashboard tiene una card destacada arriba: "Cierre de la semana del <X> al <Y>". Tap abre el chat en `mode='weekly_close'` con el mensaje del preparador y, si aplica, propuestas de cambio. Tras leer/responder, se marca como leído y vuelve al dashboard normal.

---

## 5. Pantallas — admin

Toda esta sección solo accesible si `profiles.role='admin'`. Middleware en `app/(admin)/layout.tsx` redirige al dashboard normal si no.

### 5.1 Settings (`/admin/settings`)

- Sliders agrupados por área:
  - **Recovery**: `recovery_green_min`, `recovery_red_max`.
  - **Adherencia comidas**: `adherence_meals_green_min`, `adherence_meals_red_max`.
  - **Adherencia entrenos**: `adherence_training_green_min`, `adherence_training_red_max`.
  - **Tendencia peso**: ventana EMA, días en zona roja.
  - **Calorías mínimas**: pisos por sexo (mujer/hombre).
  - **Compactación**: turnos antes de compactar.
- Cada slider muestra valor actual + valor por defecto + botón "Reset".
- Cambio se guarda en `app_settings`. Inserta `audit_log`.

### 5.2 Modelos (`/admin/models`)

- Tabla: cada flujo (definido en `05-agents.md` §5) tiene un dropdown con Sonnet 4.6 / Haiku 4.5 / Opus 4.7.
- Cambios se guardan en `model_assignments`.
- Debajo: gasto del mes actual por servicio (Anthropic) con barra horizontal vs `cost_limits`. Si > 80%, banner ámbar; si 100%, banner rojo.
- Toggle "Pause automático al 100%".

### 5.3 Conversaciones (`/admin/conversations`)

- Lista por cuenta, ordenable por última actividad.
- Tap entra a una vista read-only del chat.
- Métricas por conversación: tokens (input/output/cache), coste estimado, número de turnos, tools llamadas, errores.
- Filtros por agente, modo, presencia de red flags.

### 5.4 Prompts (`/admin/prompts`)

- Lista de versiones por agente (`prompt_versions`).
- Cada versión: número, fecha, autor, diff vs versión anterior.
- Botones: **Activar** (cambia `active=true`), **Rollback** (activa la versión inmediatamente anterior).
- Botón "Crear nueva versión" abre editor de texto en pantalla completa. Al guardar, ejecuta la suite de evals automáticamente. Muestra resultado (X/15 casos OK) antes de permitir activar.

---

## 6. Notificaciones

Decisiones de sesión 6:

### 6.1 Recordatorio diario

- **Canal**: PWA push si está instalada y permisos OK; **fallback email**.
- **MVP (sesión 7-bis)**: Resend en modo sandbox — el email solo llega a `alexcrilez@gmail.com`. La pareja recibe avisos solo vía PWA push si instala la app. Cuando haya dominio verificado en Resend (V1) volvemos al esquema completo.
- **Cuándo**: si el atleta no ha registrado nada del día.
- **Hora**: por defecto **21:00 hora local del atleta**. Configurable en perfil al onboarding.
- **Anti-duplicado**: tabla `daily_reminders_sent` (definida en `03-data-model.md` §9.1).

### 6.2 Permiso de push

- Se pide **al onboarding tras instalar la PWA**, con explicación clara: "Para avisarte 1 vez al día si no registraste nada y para confirmar que Whoop sincroniza. Nada más".
- El atleta puede revocar/activar desde perfil en cualquier momento.

### 6.3 Plantilla del email de recordatorio

- **Asunto**: "Hoy no has registrado nada en Creed".
- **Cuerpo**: 1-2 frases ("Aún puedes registrar tu cena, peso o entrenamiento de hoy. Tarda menos de 30s.") + botón grande al dashboard.
- Sin HTML decorativo, sin colores corporativos en tablas. Texto + un botón.
- From: `<noreply@creed.app>` (cuando se decida el dominio).
- Plantilla en `apps/web/emails/daily-reminder.tsx` con `react-email`.

### 6.4 Email de fallo de sync de Whoop

- **Asunto**: "Tu Whoop dejó de sincronizar".
- **Cuerpo**: 1 frase (el coach está operando con datos antiguos) + botón "Reconectar Whoop".
- Throttle: máximo 1 email cada 72h por mismo incidente.

### 6.5 Lo que NO mandamos

- Notificaciones de cierre semanal (decisión sesión 5: 100% reactivo).
- Promociones, novedades, "te echamos de menos".
- Email de bienvenida más allá del primer login.

---

## 7. PWA

- **Manifest** (`apps/web/public/manifest.json`):
  - `name`: "Creed".
  - `short_name`: "Creed".
  - `display`: "standalone".
  - `theme_color`: token de accent.
  - `background_color`: token de canvas.
  - Iconos 192 / 512 / maskable.
- **Service worker** vía Next.js + `@serwist/next` o similar. Estrategia: network-first para datos, cache-first para assets estáticos.
- **Offline**: no soportamos uso offline en MVP. Si no hay red, mostramos pantalla "Sin conexión" elegante.
- **Install prompt**: tras 2-3 visitas, sugerimos instalar (banner sutil), nunca un modal bloqueante.
- **iOS**: añadir a pantalla de inicio funciona; sin push iOS hasta iOS 16.4+ (la mayoría de dispositivos relevantes lo soportan ya).

---

## 8. Internacionalización

Decidido en sesión 1: **ES por defecto, i18n-ready para EN**.

- Stack: **next-intl** con namespaces.
- Estructura:
  ```
  packages/i18n/
  ├── es/
  │   ├── common.json
  │   ├── dashboard.json
  │   ├── chat.json
  │   ├── log.json
  │   ├── plan.json
  │   ├── history.json
  │   ├── profile.json
  │   ├── admin.json
  │   ├── auth.json
  │   └── notifications.json
  └── en/                                # cuando se añada
  ```
- Convención de claves: `dashboard.welcome`, `chat.send_button`, etc.
- **Output del coach**: en el `locale` del atleta (`profiles.locale`). El prompt al modelo incluye instrucción explícita "respond in Spanish" o "respond in English" según `locale`.
- Fechas: `Intl.DateTimeFormat` con la timezone del atleta.
- Números: `Intl.NumberFormat` con formato local (peso 78,4 vs 78.4).
- Pluralización: ICU MessageFormat de next-intl.

---

## 9. Accesibilidad

Aplicamos `~/.claude/rules/web/testing.md` (accessibility checks) y `design.md` §11.

- WCAG **AA** mínimo.
- Tests automatizados con **axe-core** integrado en Playwright.
- Foco visible siempre (`design.md` §5).
- Soporte completo de teclado (todo lo interactivo accesible con Tab).
- Reduced motion respetado vía media query (no requiere lógica adicional).
- `aria-live="polite"` en banners y toasts.
- `aria-live="assertive"` solo en errores críticos.
- Contraste de texto sobre glass: testeado por componente, no asumido.

---

## 10. Rendimiento (Core Web Vitals)

Aplicamos `~/.claude/rules/web/performance.md`.

| Métrica | Target |
|---|---|
| LCP | < 2.5s |
| INP | < 200ms |
| CLS | < 0.1 |
| FCP | < 1.5s |
| TBT | < 200ms |

### 10.1 Bundle budgets

| Página | JS gzipped | CSS |
|---|---|---|
| Login + Onboarding | < 100 kb | < 20 kb |
| Dashboard | < 250 kb | < 40 kb |
| Chat | < 200 kb | < 30 kb |
| Plan / Histórico | < 250 kb | < 40 kb |
| Admin (no cuenta para budget de atleta) | < 350 kb | < 60 kb |

### 10.2 Estrategias

- **Recharts** se importa dinámicamente en las pantallas que lo usan (no en el shell).
- **Framer Motion** lo mismo (`dynamic(() => import('framer-motion'))`).
- Imagen del avatar usa `next/image` con dimensiones explícitas.
- Fonts (Geist) cargadas con `next/font`, subset latin-1, `display: swap`.
- Streaming de respuestas del coach minimiza TTFB.
- React Server Components para el dashboard (datos en server, solo hydration ligera).

---

## 11. Visual regression y testing visual

Aplicamos `~/.claude/rules/web/testing.md`.

- **Playwright** screenshots en CI para los 4 breakpoints clave: **320 / 768 / 1024 / 1440**, en **modo claro y oscuro**.
- Pantallas cubiertas obligatoriamente:
  - Login.
  - Dashboard (con datos sintéticos).
  - Chat (con conversación sintética + ProposalCard).
  - Registrar comida (con preview).
  - Plan semanal.
  - Historial del coach.
- Toleranza de diff: 0.1% (suficiente para detectar regresiones reales sin falsos positivos por anti-aliasing).
- Cuando pasa diff, se sube el screenshot a GitHub Actions artifacts para revisión humana.
- **No** confiamos solo en visual regression para componentes con peso lógico (forms, validación). Esos llevan tests de comportamiento adicional.

---

## 12. Decisiones cerradas en esta sesión

> Sesión 6, fecha 2026-05-08.

- **Dirección visual: glass moderno bien hecho**. Definido al detalle en `design.md`.
- **Modo claro/oscuro**: ambos con detección automática (`prefers-color-scheme`) + override en perfil (Auto/Claro/Oscuro).
- **Motion**: CSS puro + Framer Motion solo en momentos clave (sheets, modales, ProposalCard).
- **Charts**: Recharts modificado pesadamente.
- **Tipografía**: Geist (Vercel) para todo.
- **Iconos**: Lucide.
- **Forms**: react-hook-form + zod.
- **State**: RSC + Supabase JS para servidor; Zustand mínimo para UI state global.
- **Sem谷oro en dashboard**: anillo grande arriba con número compuesto + texto del coach debajo.
- **Historial del coach**: timeline cronológica inversa con cards expandibles.
- **Propuestas del coach**: card inline en el chat con diff visual y 3 botones (Aceptar/Rechazar/Discutir).
- **Banners de estado**: glass sutil arriba con icono semafórico.
- **Chat**: pantalla única con tabs Nutri/Prep/IA arriba.
- **Registrar comida**: input texto libre + parsing Haiku con preview editable.
- **Plan semanal**: cuadrícula 7 columnas con cards por día + detalle on-tap.
- **Recordatorio diario**: PWA push con fallback email.
- **Hora del recordatorio**: configurable en onboarding, default 21:00 local.
- **Permiso push**: pedido en onboarding tras instalar PWA con explicación.
- **Plantilla email**: corto, directo, una frase + CTA.

## 13. Decisiones abiertas

| Pregunta | Sesión que la cierra |
|---|---|
| Subset definitivo de fonts (qué pesos cargar y cuáles no) | Implementación (fase 1) |
| Stack de email transaccional (Resend / Postmark / Supabase Auth emails para todo) | 8 (deployment) |
| Estrategia de signed URLs en Storage (TTL exacto) | 8 (deployment) |
| Estrategia de PWA service worker (Serwist vs Workbox) | Implementación (fase 7) |
| Sentido de los gestos del Sheet (drag-to-dismiss?) | Implementación (fase 4) |
| Si añadimos visx u otro chart específico para el RecoveryRing | Implementación (fase 3) |
