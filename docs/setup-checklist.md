# Setup checklist

> Estado vivo de cada cuenta externa y de los TODOs operacionales / documentales pendientes. Se actualiza a medida que avanzamos.

| Estado | Significado |
|---|---|
| 🟢 | Listo, sin acciones pendientes inmediatas |
| 🟡 | En progreso o con TODO operacional pendiente |
| ⬜ | No iniciado o diferido |

---

## Cuentas externas

| Cuenta | Estado | Notas |
|---|---|---|
| **GitHub** (`git@github.com:alexcriadog/Creed.git`) | 🟢 | Repo creado, `main` pusheada con fase 1 completa. |
| **Supabase Cloud** (`hlgqxingeavdltgzzbvy`, `eu-north-1`) | 🟡 | Credenciales en `.env.local`. **Pendiente opcional**: rotar `SUPABASE_SECRET_KEY` (pasó por chat). |
| **Vercel** (`prj_pZXy39e5fmmF1d8Km3D5jDdLDcct`) | 🟡 | **Pendiente del autor**: renombrar `project-7h15x` → `creed`, conectar al repo desde Settings → Git, añadir env vars. |
| **Anthropic API** | 🟢 | Key en `.env.local`. **Directiva**: uso cuidadoso, default Groq para tests. |
| **Groq API** | 🟢 | Key en `.env.local`. Default para desarrollo y tareas baratas. |
| **developer.whoop.com — Creed-Dev** | ⬜ | Diferido a fase 1+ (necesita callback `…vercel.app/api/whoop/callback` y privacy URL `…vercel.app/privacy` accesibles tras conectar Vercel). |
| **developer.whoop.com — Creed-Prod** | ⬜ | Diferido a fase 8 (necesita dominio final). |
| **Resend** | 🟢 | Key en `.env.local`. Sandbox-only en MVP (`onboarding@resend.dev`, solo a `alexcrilez@gmail.com`). |
| **Sentry** | ⬜ | Diferido a V1. MVP solo con logs Vercel + Supabase. |
| **Dominio** | ⬜ | Opcional. MVP funciona en `…vercel.app`. Si se compra, reabre Resend con dominio verificado + HSTS preload + Whoop-Prod. |

---

## TODOs operacionales pendientes

### Acciones manuales del autor (Vercel Dashboard)

- [ ] Renombrar proyecto Vercel `project-7h15x` → `creed` (Settings → General).
- [ ] Conectar repo GitHub `Creed` a Vercel (Settings → Git → Connect Repository → seleccionar `alexcriadog/Creed`).
- [ ] Añadir env vars de `.env.local` en Vercel Settings → Environment Variables (excluyendo `NEXT_PUBLIC_APP_URL` que se ajusta por entorno y `ADMIN_EMAILS` que ya está hardcoded).

### Recomendado pero no bloqueante

- [ ] Rotar `SUPABASE_SECRET_KEY` y `RESEND_API_KEY` que pasaron por chat. Actualizar `.env.local` con las nuevas (sin pegarlas en chat).

### Durante fase 2-3

- [ ] Registrar Whoop-Dev cuando la app esté desplegada en Vercel preview con `/privacy` accesible.

### Más adelante

- [ ] Dominio (V1+ opcional).
- [ ] Sentry (V1).
- [ ] Whoop-Prod (fase 8).
- [ ] Verificar dominio en Resend (cuando haya dominio).

---

## TODOs documentales

### ✅ Aplicados antes de fase 1 (commit ccc6ed1)

- [x] Sentry diferido a V1 en `08-deployment.md`, `02-architecture.md`, `10-roadmap.md`.
- [x] HSTS preload diferido en `07-security-privacy.md` §4.
- [x] Resend sandbox documentado en `06-frontend.md` §6.1.

### ⬜ Pendientes antes de fase 5 — LLMs híbrido Claude + Groq

- [ ] `docs/05-agents.md` §5 Modelos por flujo: reescribir tabla con la asignación híbrida (Sonnet 4.6 / Llama 3.3 70B / Llama 3.1 8B).
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
- ⬜ **Fase 2 — Auth + perfil + onboarding mínimo** (próxima sesión).
