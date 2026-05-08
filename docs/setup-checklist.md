# Setup checklist

> Estado vivo de cada cuenta externa y de los TODOs operacionales / documentales pendientes. Se actualiza a medida que avanzamos.

| Estado | Significado |
|---|---|
| 🟢 | Listo, key en `.env.local`, sin acciones pendientes inmediatas |
| 🟡 | En progreso o con TODO operacional pendiente |
| ⬜ | No iniciado o diferido |

---

## Cuentas externas

| Cuenta | Estado | Notas |
|---|---|---|
| **GitHub** (`git@github.com:alexcriadog/Creed.git`) | 🟢 | Repo creado, vacío. Pendiente `git init` + push en fase 1 |
| **Supabase Cloud** (`hlgqxingeavdltgzzbvy`, `eu-north-1`) | 🟡 | Credenciales en `.env.local`. **TODO**: considerar rotar `SUPABASE_SECRET_KEY` (pasó por chat). |
| **Vercel** (`prj_pZXy39e5fmmF1d8Km3D5jDdLDcct`) | 🟡 | **TODO**: renombrar proyecto de `project-7h15x` a `creed` desde Settings. Conectar al repo de GitHub. |
| **Anthropic API** | 🟢 | Key en `.env.local`. **Directiva**: uso cuidadoso, default Groq para tests. |
| **Groq API** | 🟢 | Key en `.env.local`. Default para desarrollo y tareas baratas. |
| **developer.whoop.com — Creed-Dev** | ⬜ | Diferido a fase 1 (necesita callback `…vercel.app/api/whoop/callback` y privacy URL `…vercel.app/privacy`). |
| **developer.whoop.com — Creed-Prod** | ⬜ | Diferido a fase 8 (necesita dominio final). |
| **Resend** | 🟢 | Key en `.env.local`. Sandbox-only en MVP (`onboarding@resend.dev`, solo a `alexcrilez@gmail.com`). |
| **Sentry** | ⬜ | Diferido a V1. MVP solo con logs Vercel + Supabase. |
| **Dominio** | ⬜ | Opcional. MVP funciona en `…vercel.app`. Si se compra, reabre Resend con dominio verificado + HSTS preload + Whoop-Prod. |

---

## TODOs operacionales (fuera del código)

### Antes de empezar fase 1

- [ ] Renombrar proyecto Vercel `project-7h15x` → `creed` (Settings → General).
- [ ] Conectar repo GitHub `Creed` a Vercel (Settings → Git).
- [ ] (Opcional pero recomendado) Rotar `SUPABASE_SECRET_KEY` y `RESEND_API_KEY` que pasaron por chat hace varios turnos. Actualizar `.env.local` con las nuevas.

### Durante fase 1

- [ ] Registrar Whoop-Dev cuando la app esté desplegada en Vercel preview con `/privacy` accesible.

### Más adelante

- [ ] Dominio (V1+ opcional).
- [ ] Sentry (V1).
- [ ] Whoop-Prod (fase 8).
- [ ] Verificar dominio en Resend (cuando haya dominio).

---

## TODOs documentales

### Antes de empezar fase 1 — Sentry diferido

Sentry sale de MVP. Hay que actualizar:

- [ ] `docs/08-deployment.md` §3 servicios externos: marcar Sentry como "V1+".
- [ ] `docs/08-deployment.md` §4.1 env vars: quitar `SENTRY_DSN` de MVP.
- [ ] `docs/08-deployment.md` §11 observabilidad: reescribir basándose en Vercel/Supabase logs solamente.
- [ ] `docs/02-architecture.md` §2 diagrama: quitar el nodo de Sentry o marcarlo "V1+".
- [ ] `docs/07-security-privacy.md` §8.4 filtros de Sentry: marcar como "V1+".
- [ ] `docs/10-roadmap.md` fase 1: quitar "Sentry SDK instalado".

### Antes de empezar fase 1 — Resend sandbox

- [ ] `docs/06-frontend.md` §6.1 Recordatorio diario: documentar que en MVP solo llega a `alexcrilez@gmail.com`. Pareja con PWA push.
- [ ] `docs/08-deployment.md` §7.1 Configuración Resend: dominio verificado pasa a "cuando haya dominio en V1".
- [ ] `docs/07-security-privacy.md` §4 HSTS preload: marcar como "se reabre cuando haya dominio propio".

### Antes de empezar fase 5 — LLMs híbrido Claude + Groq

- [ ] `docs/05-agents.md` §5 Modelos por flujo: reescribir tabla con la asignación híbrida (Sonnet/Llama 3.3 70B/Llama 3.1 8B).
- [ ] `docs/05-agents.md` §17.2 capacidades MVP del admin: añadir override por flujo a Groq también.
- [ ] `docs/08-deployment.md` §3 servicios externos: añadir Groq.
- [ ] `docs/08-deployment.md` §4.1 env vars: añadir `GROQ_API_KEY`.
- [ ] `docs/08-deployment.md` §10 política de gasto: añadir Groq al monitoreo.
- [ ] `docs/02-architecture.md` §2 diagrama: añadir Groq como provider externo junto a Anthropic.
- [ ] `docs/03-data-model.md` §14b.2 `model_assignments`: ampliar set de modelos posibles incluyendo IDs de Groq.
- [ ] `docs/09-testing.md` §8: añadir mock MSW de Groq (`api.groq.com`).

---

## Estado actual de fases

- ✅ **Fase 0 — Documentación** (sesiones 1–7).
- ✅ **Fase 1 — Andamiaje técnico** (2026-05-08).
  - Monorepo pnpm + Turborepo, Next.js 16 + React 19 + TS 6 + Tailwind v4.
  - apps/web con landing minimal + `/api/health`.
  - 5 packages placeholder (`db`, `agents`, `ui`, `i18n`, `whoop`).
  - GitHub Actions CI con lint/typecheck/build.
  - `pnpm dev` corre en `http://localhost:3030` (port 3000 lo usa OrbStack).
  - `pnpm typecheck` y `pnpm build` verde y limpio.
  - Repo en `github.com:alexcriadog/Creed`, branch `main` pusheada.
- ⬜ **Fase 2 — Auth + perfil + onboarding mínimo**.

## Próximo paso operativo

**Acciones manuales del autor (Vercel Dashboard)**:
1. Conectar el repo `alexcriadog/Creed` al proyecto Vercel desde Settings → Git.
2. Renombrar el proyecto Vercel `project-7h15x` → `creed`.
3. Añadir las env vars de `.env.local` en Vercel Settings → Environment Variables (excluir `NEXT_PUBLIC_APP_URL` y `ADMIN_EMAILS` que se ajustan por entorno).

Tras conectar Vercel, el primer push genera preview deployment automático.

Después: propongo el plan de **fase 2 — Auth + perfil + onboarding mínimo** según `docs/10-roadmap.md` fase 1:

- Monorepo pnpm + Turborepo
- `apps/web` con Next.js 15 App Router
- `packages/db`, `packages/agents`, `packages/integrations/whoop`, `packages/ui`, `packages/i18n`
- Tailwind v4 + Geist + tokens base de `design.md`
- GitHub Actions CI mínimo (lint/typecheck/build)
- Vercel conectado, preview funcional
- Supabase init local

Antes de tocar código, reabrimos los TODOs documentales de "Antes de fase 1" arriba.
