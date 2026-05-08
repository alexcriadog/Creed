# Inbox

> Buzón cronológico de cosas que el usuario me pasa. Clasificadas por fecha y categoría. **Cero secrets aquí** — los secrets viven en `.env.local` y memoria privada de Claude.

---

## 2026-05-08 — Setup inicial post-docs

### Cuentas externas creadas y entregadas

- **Supabase**
  - `project_id`: `hlgqxingeavdltgzzbvy`
  - Region: `eu-north-1`
  - URL: `https://hlgqxingeavdltgzzbvy.supabase.co`
  - `publishable_key` (pública, equivale a anon key) → en `.env.local` como `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `secret_keys` → en `.env.local` como `SUPABASE_SECRET_KEY` (bypassea RLS, solo backend)
  - **TODO operativo**: considerar rotar el `secret_keys` que pasó por chat hace varios turnos.

- **GitHub**
  - Repo: `git@github.com:alexcriadog/Creed.git`
  - Estado: vacío. Pendiente de `git init` + push inicial cuando arranquemos código.

- **Vercel**
  - `project_id`: `prj_pZXy39e5fmmF1d8Km3D5jDdLDcct`
  - Dashboard: `https://vercel.com/alexcrilez-gmailcoms-projects/project-7h15x/settings`
  - **TODO**: renombrar el proyecto de `project-7h15x` a `creed` desde Settings.

- **Anthropic API**
  - Cuenta creada con cap mensual.
  - Key `sk-ant-…` en `.env.local` como `ANTHROPIC_API_KEY`.
  - **Directiva del usuario** (importante): usar con cuidado. Todos los tests y desarrollo se hacen contra Groq con modelos baratos. Anthropic se reserva para los flujos reales del coach en producción (Sonnet 4.6).

- **Groq API**
  - Cuenta creada (free tier, sin billing inicial).
  - Key `gsk_…` en `.env.local` como `GROQ_API_KEY`.
  - **Default de desarrollo**: cualquier llamada LLM en pruebas usa Groq con Llama 3.3 70B o Llama 3.1 8B.

- **Resend**
  - Cuenta creada.
  - Key `re_…` en `.env.local` como `RESEND_API_KEY`.
  - Sender por defecto en MVP: `onboarding@resend.dev` (sandbox de Resend → solo envía a `alexcrilez@gmail.com`).
  - **Limitación MVP**: la pareja no recibe email transaccional (necesitaría dominio verificado). Recibe avisos vía PWA push si instala la app.

### Cuentas pendientes

- **developer.whoop.com** (Creed-Dev y Creed-Prod): diferido a fase 1 / fase 8 (necesita callback URL pública + privacy policy URL pública, que llegan al desplegar la app).
- **Sentry**: diferido a V1. MVP usa solo logs nativos de Vercel + Supabase.
- **Dominio**: opcional. MVP funciona en `…vercel.app`. Si en algún momento se compra, se reabre Resend con dominio verificado + HSTS preload.

### Decisiones operacionales tomadas

- **Sin dominio en MVP** → app vivirá en `creed-<algo>.vercel.app`. Privacy policy en ruta `/privacy` de la propia app (fase 1).
- **Resend sandbox-only en MVP** → email solo al autor. Pareja con PWA push.
- **Sentry diferido a V1** → MVP solo con Vercel/Supabase logs. Hay que ajustar `08-deployment.md`, `02-architecture.md`, `07-security-privacy.md`, `10-roadmap.md` antes de fase 1.
- **LLMs híbrido Claude + Groq**:
  - Sonnet 4.6 → coaches en chat, onboarding, plan semanal, cierre semanal.
  - Plan semanal **baja de Opus 4.7 → Sonnet 4.6** (Opus era overkill).
  - Llama 3.3 70B (Groq) → parser comidas, compactación de conversaciones.
  - Llama 3.1 8B Instant (Groq) → orquestador (router).
  - **Default de tests y desarrollo: Groq cheap models**. Anthropic solo para flujos reales del coach.
  - HF descartado.
- **Coste estimado MVP**: ~15-25 €/mes (vs ~25-35 € solo Claude).
- **Email del autor confirmado**: `alexcrilez@gmail.com`.

### Observaciones sobre cómo trabaja el usuario

- Pasa información por chat. Yo capturo y organizo.
- Si pasa secrets en chat, le aviso de rotación; los pongo en `.env.local` y memoria privada.
- A partir de aquí, **prefiere que las nuevas credenciales vayan directamente a `.env.local`** sin pasar por chat.

### Inspiración visual / referencias

- **`design-frontend.md`** (en raíz del repo, dejado por el usuario). Análisis del marketing site de ClickHouse — black canvas + electric yellow + Inter. **Decisión del usuario (2026-05-08)**: ignorar este archivo. La dirección visual oficial sigue siendo **glass moderno bien hecho** según `docs/design.md` (sesión 6). El archivo se queda en raíz pero no se aplica.


---

## 2026-05-08 (tarde) — Vercel deploy + Whoop dev

### Acción del usuario

- Conectó el repo GitHub al proyecto Vercel.
- Registró la app Whoop-Dev en developer.whoop.com con URL **placeholder** (aún sin dominio real). `WHOOP_CLIENT_ID` y `WHOOP_CLIENT_SECRET` añadidos por el usuario directamente en `.env.local` (forma segura, no por chat).

### Problema reportado

- Deploy de Vercel falla con `No Output Directory named "public" found`. Vercel no detectaba la app Next.js porque vive en `apps/web/`, no en raíz.

### Fix aplicado

- Creado `vercel.json` en raíz con framework=nextjs + buildCommand turbo + outputDirectory `apps/web/.next`. El próximo push a `main` debería desbloquear el deploy.

### Pendiente

- Tras el primer deploy verde, actualizar `WHOOP_REDIRECT_URI` en developer.whoop.com con la URL real de Vercel y guardarla también en Vercel env vars.
