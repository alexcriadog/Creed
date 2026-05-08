# 10 — Roadmap

> Estado: ✅ Completo (sesión 7, 2026-05-08).

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Fases hacia MVP](#2-fases-hacia-mvp)
3. [Hito de 'demo usable'](#3-hito-de-demo-usable)
4. [V1 — post-MVP](#4-v1--post-mvp)
5. [V2 — exploratorio](#5-v2--exploratorio)
6. [Riesgos y mitigaciones](#6-riesgos-y-mitigaciones)
7. [Presupuesto y costes](#7-presupuesto-y-costes)
8. [Decisiones cerradas en esta sesión](#8-decisiones-cerradas-en-esta-sesión)
9. [Decisiones abiertas](#9-decisiones-abiertas)

---

## 1. Resumen ejecutivo

Tras cerrar la fase de documentación (sesiones 1–7), Creed entra en implementación en 8 fases hasta MVP. **La primera versión "usable" llega tras la fase 5** (decisión sesión 7) — es la primera vez que la pareja puede hablar con los coaches de verdad. Las fases 6, 7 y 8 son pulido, no nuevas features.

Presupuesto operativo objetivo: **≤50 €/mes** (decisión sesión 7).

V1 añade entrenamientos detallados (sets/reps/peso), fotos de progreso y ánimo. V2 explora foto-AI de comidas y otros wearables.

---

## 2. Fases hacia MVP

Cada fase tiene **criterios de salida concretos**: lo que tiene que funcionar para considerar la fase cerrada.

### Fase 0 — Documentación

**Estado: ✅ Completa (sesiones 1–7, 2026-05-07/08)**.

Salida:
- 11 docs en `docs/` + `design.md` cerrados.
- `PLAN.md` con índice de sesiones.
- README + .gitignore.

### Fase 1 — Andamiaje técnico

**Objetivo**: monorepo funcionando con Next.js, Supabase y CI mínimo.

Trabajo:
- `pnpm-workspace.yaml` + Turborepo.
- `apps/web` con Next.js 15 App Router.
- `packages/db`, `packages/agents`, `packages/integrations/whoop`, `packages/ui`, `packages/i18n`.
- Supabase Cloud (proyecto creado), `supabase init` local.
- Tailwind v4 + Geist + tokens base de `design.md`.
- GitHub Actions: `ci.yml` con lint/typecheck/build (sin tests todavía, no hay código que probar).
- Vercel conectado al repo, preview funcional.
- ~~Sentry SDK instalado~~ → diferido a V1 (decisión sesión 7-bis).
- Variables de entorno configuradas en local + preview + prod.

**Criterios de salida**:
- `pnpm dev` corre y muestra una landing simple en `localhost:3000`.
- Cualquier PR genera preview deployment con URL en el comentario.
- `apps/web` se construye sin warnings.

### Fase 2 — Auth + perfil + onboarding mínimo

**Objetivo**: una persona puede crear cuenta y tener un perfil.

Trabajo:
- Supabase Auth con email + OTP.
- Trigger en `auth.users` que crea fila en `profiles` y `athlete_folder`.
- Página `/login` con UI según `design.md`.
- Página `/onboarding` — versión simple (formulario), no la entrevista con el coach. La entrevista llega en fase 5 cuando los agentes existen.
- Página `/profile` con datos básicos editables.
- Migraciones DB para `profiles`, `athlete_folder`, `audit_log`.
- RLS aplicado a todas las tablas creadas.
- Tests de RLS.
- Borrado de cuenta (cascada) ya operativo, sin Whoop ni storage todavía.

**Criterios de salida**:
- El autor puede crear cuenta, completar onboarding mínimo, ver su perfil y borrar la cuenta.
- Tests integración pasan (RLS verificado).

### Fase 3 — Whoop + dashboard pasivo

**Objetivo**: la pareja conecta su Whoop y ve sus datos.

Trabajo:
- App registrada en developer.whoop.com (Creed-Dev y Creed-Prod).
- OAuth flow (`/api/whoop/authorize` + `/api/whoop/callback`).
- Cifrado pgsodium + Vault para tokens.
- Edge Function `whoop-backfill` (90 días).
- Edge Function `whoop-sync` (cron 6h).
- Edge Function `whoop-webhook` (entrante).
- Migraciones DB para `whoop_*` tablas.
- Dashboard mínimo: RecoveryRing + stats básicos del día. **Sin** semáforo todavía (requiere reglas que se calibran tras tener datos).
- Banner de estado de Whoop (decisión sesión 4: persistente).
- MSW fixtures generadas con cuenta dev real.

**Criterios de salida**:
- El autor conecta su Whoop, ve 90 días de histórico tras backfill (~30s).
- Webhook entrante actualiza el dashboard en tiempo real (Realtime).
- Banner aparece si simulamos token revocado.

### Fase 4 — Registro manual + cierre semanal sin coach

**Objetivo**: el atleta registra peso, comidas y entrenamientos manualmente. El sistema computa el veredicto compuesto.

Trabajo:
- Sheets de "Registrar comida", "Registrar peso", "Registrar entrenamiento".
- Endpoint `/api/meal-parser` con Haiku 4.5.
- Migraciones DB para `meals`, `body_measurements`, `hydration_log`, `mood_energy_log`, `training_*`.
- Cómputo del semáforo (sin LLM): EMA-7, recovery medio 14d, adherencia 7d.
- Visualización del semáforo (RecoveryRing con color del estado + texto descriptivo automático sin coach).
- Cierre semanal computado por cron `weekly-close`, sin mensaje de coach todavía.
- Plan de la semana **manual** (el atleta puede crear plan/sesión sin coach).
- Visual regression: pantallas críticas con baseline.

**Criterios de salida**:
- El autor registra una semana entera manualmente y ve el dashboard completo con semáforo.
- El cierre semanal aparece automático con datos computados.
- 80% coverage en `packages/agents/lib/` (cómputo del semáforo).

### Fase 5 — Agentes v1 (la app cobra vida)

**Objetivo**: los coaches existen y conversan. **Aquí llega la primera demo usable** (decisión sesión 7).

Trabajo:
- `packages/agents/` con system prompts, tools, runner.
- Endpoint `/api/coach/message` con streaming SSE.
- Sonnet 4.6 para conversación + Haiku 4.5 para orquestador opcional.
- UI del chat con tabs Nutri/Prep/IA.
- ProposalCard inline en chat con 3 botones (Aceptar/Rechazar/Discutir).
- Aplicación efectiva de propuestas (cuando el atleta acepta, los datos cambian).
- Migraciones DB para `conversations`, `messages`, `tool_calls`, `agent_notes`.
- Modo onboarding: rehacemos la fase 2 con entrevista real con el coach (substituye al formulario).
- Modo lapso: detección + flujo "ponme al día".
- Suite de evals (15 casos) en `packages/agents/evals/`.
- Smoke en CI.

**Criterios de salida**:
- El autor y la pareja pueden tener conversaciones reales con ambos coaches y aceptar propuestas que cambian su plan.
- Modo lapso se dispara correctamente al simular 4 días sin actividad.
- Suite de evals con 15/15 verdes (target ≥14/15 según `09-testing.md`).
- **🎯 DEMO USABLE: la pareja empieza a usar la app de verdad.**

### Fase 6 — Memoria compartida + plan semanal con Opus

**Objetivo**: los coaches recuerdan decisiones pasadas y el plan semanal lo escribe Opus.

Trabajo:
- `agent_notes` totalmente integrado: cada propuesta deja nota; los coaches leen notas en cada turno.
- Vista "Historial del coach" (timeline cronológico).
- Compactación nocturna de conversaciones largas (Haiku).
- Endpoint y flujo "Generar plan semanal" con Opus 4.7.
- Vista del plan semanal en cuadrícula 7 días con detalle on-tap.
- Trazabilidad: el atleta puede preguntar "¿por qué decidiste X?".

**Criterios de salida**:
- Tras 2 semanas de uso, el coach cita decisiones pasadas con precisión.
- Generar plan con Opus tarda <60s y produce estructura completa.
- Compactación nocturna ocurre y reduce tokens del próximo turno >50% en conversaciones >30 turnos.

### Fase 7 — Pulido visual + PWA + i18n + admin

**Objetivo**: la app se siente premium y el autor tiene control operativo.

Trabajo:
- Aplicar `design.md` por completo (glass moderno bien hecho).
- PWA: manifest, service worker, install prompt.
- Push notifications (PWA push + email fallback).
- next-intl con namespaces ES.
- Panel admin completo:
  - `/admin/settings` (sliders).
  - `/admin/models` (asignación + gasto).
  - `/admin/conversations` (visor).
  - `/admin/prompts` (versionado + rollback).
- Email transaccional via Resend (recordatorio diario, fallo Whoop, exportación).
- Visual regression cubriendo todas las pantallas en claro y oscuro.

**Criterios de salida**:
- La app se ve "premium" — el autor confirma que no se siente "a template".
- Recordatorios diarios funcionan (push o email según permisos).
- El autor puede ajustar umbrales y modelos desde el admin.
- Visual regression con 0 diffs en main.

### Fase 8 — Hardening de seguridad + auditoría privacidad + producción

**Objetivo**: listo para uso real con privacidad y operaciones sólidas.

Trabajo:
- Headers HTTP completos (HSTS preload, CSP nonce, etc.).
- Rate limiting en endpoints sensibles.
- Política de privacidad v1 redactada y publicada.
- Sistema de consentimientos (`profiles.consents`).
- Exportación de datos asíncrona con email.
- Política de límite de gasto: alarma 80% + pause 100%.
- Runbooks documentados y probados.
- Restore drill ejecutado al menos una vez.
- DPA con providers firmados.
- Subir Supabase a Pro si ya excedemos free tier (probable).
- DNS apuntando a dominio final.
- Migración de DB de preview-prod si fuera necesaria.

**Criterios de salida**:
- Auditoría manual de seguridad pasada (CSP, headers, RLS, cifrado, retención).
- Exportación funciona end-to-end y devuelve un ZIP completo.
- Pause automático testeado simulando cap.
- **🚀 MVP READY**: la pareja puede usar Creed sin sobresaltos como herramienta principal.

---

## 3. Hito de 'demo usable'

Decisión sesión 7: **la primera demo usable es al cerrar la fase 5**.

Razones:

- La fase 4 ya tiene valor pasivo (Whoop + log manual), pero sin coach falta la pieza diferenciadora.
- Esperar a fase 5 hace que la primera demo sea "la idea de Creed", no una prueba de concepto.
- Las fases 6 y 7 son pulido — no detenemos uso real esperando a ellas. La pareja puede vivir con el plan semanal manual + chat hasta que llegue Opus.

Tras la fase 5, **la pareja empieza a usar Creed a diario**. El feedback alimenta:

- Casos reales para los 15 evals adicionales (objetivo total 30, decisión sesión 5).
- Calibración de umbrales del semáforo en el panel admin.
- Iteración de prompts.

---

## 4. V1 — post-MVP

Triggers para empezar V1: MVP estable durante ≥6 semanas + capacidad del autor.

Capacidades V1:

- **Sets/reps/peso detallados** en entrenamientos (ya está en el modelo de datos, falta UI + integración con preparador).
- **Fotos de progreso** mensuales con comparación lado a lado.
- **Ánimo y energía subjetiva** integrados en el cómputo del semáforo.
- **2FA** opt-in para todos, obligatorio para admin.
- **Storybook** para componentes en aislamiento.
- **Coverage gate bloqueante** en CI.
- **Tabla `athlete_folder_history`** para auditar regresiones.
- **Particionado** de `whoop_*` y `messages` por mes si crecemos.
- **Push iOS** (cuando llegue iOS 16.4+ a la mayoría).

---

## 5. V2 — exploratorio

Capacidades V2 (sin compromiso, depende de uso real):

- **Foto-AI de comidas**: foto a un plato → ingredientes + macros automáticos.
- **Otros wearables**: Garmin, Apple Watch, Oura. Requiere `04b-other-wearables.md` documentando cada integración.
- **Apertura a más usuarios** (decisión que reabre privacidad y consentimiento del admin).
- **App móvil nativa** (probablemente React Native + Expo).
- **HIPAA-style compliance** si abrimos a US.

---

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Whoop API cambia / rate limit reducido | Media | Alto | `raw jsonb` en cada tabla, mappers aislados en `packages/integrations/whoop/`, mock con MSW |
| Coste de Anthropic mayor de lo esperado | Media | Medio | Pause automático al 100% del cap, panel admin con visor por cuenta, prompt caching |
| La pareja no registra suficiente | Alta | Alto | Recordatorio diario, modo lapso indulgente, coach pide resumen libre con 30% adherencia |
| Calidad del coach insuficiente | Media | Alto | Suite de evals pre-deploy, panel admin con rollback, citas conservadoras (sin papers) |
| Cambios de identidad visual a mitad | Media | Medio | `design.md` documenta tokens; cualquier cambio se aplica reescribiendo tokens, no componentes |
| El autor (admin único) se queda sin tiempo | Alta | Alto | MVP usable en fase 5 — no hace falta llegar a fase 8 para usar la app. Pulido y producción se hacen sostenidamente |
| Regulación de IA en salud cambia | Baja | Alto | Disclaimer + scope personal documentado. Si V1 abrimos, revisar. Si llega regulación dura, replanteamos |
| Supabase Free tier insuficiente | Media | Bajo | Subir a Pro (~25 €/mes) — sigue dentro de presupuesto |

---

## 7. Presupuesto y costes

Decisión sesión 7: **objetivo ≤50 €/mes total**.

### 7.1 Estimación por servicio (con 2-5 cuentas activas)

| Servicio | Free tier | Coste estimado | Notas |
|---|---|---|---|
| Vercel | Hobby gratis | 0 € | 100 GB bandwidth incluidos |
| Supabase | Free 500 MB DB / 1 GB Storage | 0–25 € | Pro si crecemos |
| Anthropic | Pay-as-you-go | 30–40 € | Sonnet conversación + Opus plan semanal × 2 cuentas |
| Whoop | Gratis | 0 € | Developer tier |
| Resend | 3k emails/mes gratis | 0 € | Suficiente |
| Sentry | Free 5k errores/mes | 0 € | Suficiente |
| Dominio | n/a | ~12 €/año (~1 €/mes) | Una vez |
| **Total estimado MVP** | | **~30–40 €/mes** | Margen ~10-20 €/mes |

### 7.2 Si nos pasamos

- Subir cap de Anthropic en panel admin temporalmente.
- Considerar degradación Sonnet → Haiku en flujos seleccionados durante final de mes.
- Revisar prompt caching (target ≥60% hit rate).

### 7.3 Si abrimos a más cuentas (V1)

Costes escalan ~lineal con número de cuentas activas. Cada cuenta nueva añade ~15-20 €/mes en Anthropic con uso típico. Habría que reabrir presupuesto y posiblemente cobrar / limitar.

---

## 8. Decisiones cerradas en esta sesión

> Sesión 7, fecha 2026-05-08.

- **Demo usable = fase 5** (tras agentes v1). La pareja empieza a usar Creed de verdad ahí.
- **Presupuesto MVP: ≤50 €/mes** total. Pause automático al 100%.
- **Fases 6, 7, 8 son pulido**, no bloquean uso real.
- **MVP cubre 8 fases** (0–8). Cada una con criterios de salida concretos.
- **V1**: sets/reps detallados, fotos de progreso, ánimo, 2FA, athlete_folder_history.
- **V2**: foto-AI de comidas, otros wearables, apertura, mobile nativo, HIPAA-style si toca.
- **Riesgos identificados**: 8, todos con mitigación documentada.

## 9. Decisiones abiertas

| Pregunta | Sesión que la cierra |
|---|---|
| Fecha objetivo de MVP READY | Tras fase 1, cuando tengamos velocidad real medida |
| Si publicamos en marketplace de Whoop | Decisión del autor en cualquier momento |
| Cuándo abrir a más usuarios (si lo hacemos) | V1, basado en uso real de la pareja |
| Pricing si en algún momento monetizamos | V2, fuera de scope MVP |

---

## Cómo proceder tras esta sesión

La fase de documentación está cerrada. La sesión 8+ es la primera de **implementación**. Antes de empezar a codificar:

1. El autor crea las cuentas externas: GitHub repo, Supabase Cloud, Vercel, Anthropic, developer.whoop.com (Creed-Dev), Resend, Sentry.
2. Confirma el nombre real del proyecto si "Creed" no es definitivo.
3. Confirma dominio si quiere PWA con nombre bonito.
4. Pasa a sesión 8 — fase 1 — andamiaje técnico. El siguiente prompt sería:

> Sesión sobre la fase 1 del roadmap: andamiaje técnico (monorepo, Next.js, Supabase init, CI/CD básico).
