# 08 — Despliegue y operaciones

> Estado: ✅ Completo (sesión 7, 2026-05-08).

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Entornos](#2-entornos)
3. [Servicios externos](#3-servicios-externos)
4. [Variables de entorno](#4-variables-de-entorno)
5. [CI/CD](#5-cicd)
6. [Migraciones de DB](#6-migraciones-de-db)
7. [Email transaccional (Resend)](#7-email-transaccional-resend)
8. [Crons (`pg_cron`)](#8-crons-pg_cron)
9. [Endpoints admin](#9-endpoints-admin)
10. [Política de límite de gasto](#10-política-de-límite-de-gasto)
11. [Observabilidad](#11-observabilidad)
12. [Backups y restore drill](#12-backups-y-restore-drill)
13. [Rotación de claves](#13-rotación-de-claves)
14. [Runbooks](#14-runbooks)
15. [Decisiones cerradas en esta sesión](#15-decisiones-cerradas-en-esta-sesión)
16. [Decisiones abiertas](#16-decisiones-abiertas)

---

## 1. Resumen ejecutivo

Creed se despliega en **Vercel** (frontend + Route Handlers) + **Supabase Cloud** (DB + Auth + Storage + Edge Functions + `pg_cron`). Email transaccional vía **Resend**. Errores y monitoring vía **Sentry cloud free tier**. Pipeline: **GitHub Actions** con preview por PR + producción manual con confirmación.

Cero servidores propios. Cero infra mantenida a mano más allá de configurar las cuentas.

---

## 2. Entornos

| Entorno | URL | DB | Cuándo se usa |
|---|---|---|---|
| `local` | `http://localhost:3000` | Supabase local (`supabase start`) | Desarrollo en máquina del autor |
| `preview` | `https://<pr-slug>.creed.vercel.app` | Branch DB de Supabase por PR | Cada PR genera uno automático |
| `production` | `https://creed.app` (o dominio final) | Supabase Cloud `production` | Lo que usa la pareja |

Decisión sesión 7: **solo preview de PR**, sin staging permanente. Las preview branches de Supabase + Vercel cubren las necesidades para 5 cuentas.

### 2.1 Branch DB de Supabase

Cada rama de PR crea automáticamente una copia de la DB con migraciones aplicadas, datos vacíos. La preview de Vercel apunta a esa branch DB. Al cerrar el PR, la branch se destruye.

### 2.2 Datos sintéticos en preview

Para que la preview sea utilizable sin datos reales:

- Script `apps/web/scripts/seed-preview.ts` siembra una cuenta admin + una cuenta atleta sintética + ~30 días de Whoop simulado + ~50 comidas + 1 plan de entrenamiento.
- Se ejecuta automáticamente al desplegar preview vía GitHub Action.
- Los datos sintéticos llevan flag `is_synthetic=true` en `audit_log` para distinguir.

---

## 3. Servicios externos

| Servicio | Plan en MVP | Para qué |
|---|---|---|
| **Vercel** | Hobby (gratis) | Hosting Next.js + Edge runtime + previews |
| **Supabase Cloud** | Free tier (500MB DB, 1GB Storage) | DB + Auth + Edge Functions + Storage + Realtime + `pg_cron` |
| **Anthropic API** | Pay-as-you-go | Sonnet 4.6, Haiku 4.5, Opus 4.7 |
| **Whoop developer** | Gratis | OAuth + REST API + webhooks |
| **Resend** | Free tier (3k/mes) | Email transaccional |
| ~~Sentry cloud~~ | — | **Diferido a V1** (decisión sesión 7-bis). MVP usa solo logs Vercel + Supabase + `console.error` con wrapper |
| **GitHub** | Gratis | Repo + Actions |
| **Dominio** | A decidir | DNS apuntado a Vercel |

Cuando uno se acerque al free tier, se sube de plan o se ajusta.

---

## 4. Variables de entorno

### 4.1 Por entorno

| Variable | Pública | Local | Preview | Producción | Notas |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | ✅ | ✅ | ✅ | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | ✅ | ✅ | ✅ | Anon key (con RLS aplicado) |
| `SUPABASE_SERVICE_ROLE_KEY` | **No** | ✅ | ✅ | ✅ | Solo server-side; bypassea RLS |
| `WHOOP_CLIENT_ID` | No | ✅ (Creed-Dev) | ✅ (Creed-Dev) | ✅ (Creed-Prod) | OAuth client |
| `WHOOP_CLIENT_SECRET` | No | ✅ | ✅ | ✅ | OAuth secret |
| `WHOOP_REDIRECT_URI` | No | localhost | preview URL | prod URL | Callback OAuth |
| `WHOOP_WEBHOOK_SECRET` | No | ✅ | ✅ | ✅ | HMAC para verificar webhook |
| `ANTHROPIC_API_KEY` | No | ✅ | ✅ | ✅ | API key con cap mensual |
| `RESEND_API_KEY` | No | ✅ | ✅ | ✅ | Email transaccional |
| `RESEND_FROM_EMAIL` | No | `dev@…` | `dev@…` | `noreply@creed.app` | From address |
| ~~`SENTRY_DSN`~~ | — | — | — | — | **Diferido a V1** (sesión 7-bis) |
| `NEXT_PUBLIC_APP_URL` | Sí | localhost | preview URL | prod URL | Para construir links absolutos |
| `CRON_SECRET` | No | ✅ | ✅ | ✅ | Token para invocar Edge Functions desde cron |
| `ADMIN_EMAILS` | No | ✅ | ✅ | ✅ | Lista comma-separated de emails con `role='admin'` (para granting al signup) |

### 4.2 Política de almacenamiento

- Variables `NEXT_PUBLIC_*` viajan al cliente. **Nunca** poner secrets ahí.
- Resto de variables solo en server-side de Vercel + en Supabase para Edge Functions (nunca en código del cliente).
- El archivo `apps/web/.env.example` lista todas las variables sin valores. Se versiona.
- El `.env.local` real **nunca** se versiona (`.gitignore`).

### 4.3 Política de rotación

Ver §13.

---

## 5. CI/CD

### 5.1 GitHub Actions workflows

```
.github/workflows/
├── ci.yml                    # corre en cada push
├── preview.yml               # corre tras merge a una PR branch
├── production-deploy.yml     # manual con confirmación
└── nightly.yml               # tareas programadas
```

### 5.2 `ci.yml` — checks por PR

Steps obligatorios para que un PR sea merge-able:

1. **Setup**: Node 20, pnpm 9, restore cache.
2. **Install**: `pnpm install --frozen-lockfile`.
3. **Lint**: `pnpm lint` (eslint + prettier check).
4. **Typecheck**: `pnpm typecheck` (tsc --noEmit).
5. **Unit + integration tests**: `pnpm test` (Vitest, con DB local de Supabase).
6. **E2E tests**: `pnpm test:e2e` (Playwright contra preview build).
7. **Visual regression**: `pnpm test:visual` (Playwright screenshots).
8. **Evals smoke**: `pnpm evals:smoke` (ejecuta los 5 casos más críticos contra Anthropic con `claude-haiku-4-5` para reducir coste).
9. **Build**: `pnpm build` (asegura que el build pasa).
10. **Bundle size check**: avisa si supera los budgets de `06-frontend.md` §10.

### 5.3 `preview.yml` — deploy de preview

- Tras merge a PR branch, Vercel CLI despliega preview.
- Supabase CLI crea/actualiza la branch DB.
- Aplica las migraciones a la branch DB.
- Ejecuta seed de datos sintéticos.
- Comenta en el PR con la URL.

### 5.4 `production-deploy.yml` — deploy a producción (manual)

Tras merge a `main`:

1. GitHub Actions construye y deja un **environment "production"** en estado "waiting".
2. **Required reviewer = autor**. El autor entra a GitHub Environments y aprueba con un click.
3. Tras aprobación:
   a. Aplicar migraciones a la DB de producción (`supabase db push --linked`).
   b. Si la migración falla, no continúa al deploy de Vercel. Slack/email al autor.
   c. Vercel despliega.
   d. Healthcheck: GET `/api/health` y verificar 200.
   e. Si healthcheck falla: rollback automático en Vercel + Sentry alert.

Decisión sesión 7: **manual con confirmación** para evitar deploys nocturnos accidentales.

### 5.5 `nightly.yml`

- Ejecuta evals completos (los 15 casos) cada noche contra el prompt activo de cada agente.
- Si bajan del 90% (14/15) en algún agente, abre issue automático en GitHub.

---

## 6. Migraciones de DB

### 6.1 Crear

```bash
pnpm supabase migration new add_<nombre_descriptivo>
# edita el archivo SQL generado en supabase/migrations/
```

### 6.2 Probar local

```bash
pnpm supabase start          # inicia DB local
pnpm supabase db reset       # aplica todas las migraciones desde cero
pnpm test:integration         # run integration tests against local DB
```

### 6.3 Aplicar a preview

Automático al desplegar la preview branch (§5.3).

### 6.4 Aplicar a producción

Solo desde `production-deploy.yml` con aprobación manual (§5.4). Nunca a mano desde la terminal del autor en MVP.

### 6.5 Si una migración falla en producción

1. CI marca el deploy como fallido. Vercel **no** despliega la nueva versión.
2. La DB queda en su estado anterior (las migraciones de Supabase corren en transacción cuando es posible).
3. Sentry alert + email a admin.
4. El autor analiza, crea una migración correctiva, repite el flujo.
5. **Nunca** se edita una migración que ya tocó producción. Siempre `add_*` nueva que corrija.

### 6.6 Migraciones que no pueden ir en transacción

Algunas operaciones (CREATE INDEX CONCURRENTLY, ALTER TYPE en uso) no caben en transacción. Para esas:

- Se separan en su propia migración con comentario `-- NOT TRANSACTIONAL`.
- La migración se aplica con doble check: si falla a mitad, hay que reparar a mano siguiendo el runbook §14.

---

## 7. Email transaccional (Resend)

Decisión sesión 7: **Resend** con plantillas en `react-email`.

### 7.1 Configuración

- Dominio verificado: `creed.app` (o el final).
- DKIM, SPF, DMARC configurados según docs de Resend.
- From address: `noreply@creed.app` para transaccional, `support@creed.app` (alias al email del autor) para soporte.

### 7.2 Plantillas

```
apps/web/emails/
├── daily-reminder.tsx
├── whoop-disconnect.tsx
├── data-export-ready.tsx
├── account-deleted.tsx          # confirmación tras borrado
├── otp-fallback.tsx             # si SMTP de Supabase Auth falla, podemos enviarlo via Resend
└── _components/
    └── EmailLayout.tsx          # layout base con el wordmark
```

Todas en español por defecto. Variables `react-email` para personalizar (display_name, fecha, link).

### 7.3 SDK

- `resend` package en `packages/integrations/email/`.
- Wrapper que centraliza:
  - Envío con error handling (Sentry).
  - Throttling para evitar spam (no mismo tipo a mismo user en X horas).
  - Logging mínimo (solo metadata en `audit_log` con `action='email_sent'`).

### 7.4 Lo que NO mandamos por email

- Emails de marketing.
- Newsletters.
- Resúmenes semanales (decisión sesión 5: cierre semanal solo aparece in-app).
- Confirmaciones de cada cambio en plan (saturaría inbox).

---

## 8. Crons (`pg_cron`)

Programados al apply de migraciones. Lista actual:

| Job | Cron expr | Edge Function | Descripción |
|---|---|---|---|
| `whoop-sync-every-6h` | `0 */6 * * *` | `whoop-sync` | Polling de Whoop como red de seguridad |
| `whoop-stale-notifier-hourly` | `0 * * * *` | `whoop-stale-notifier` | Avisa por banner+email si sync atrasado |
| `daily-reminder-hourly` | `0 * * * *` | `daily-reminder` | Recordatorio si no hay registros del día (filtra por timezone del atleta) |
| `weekly-close-hourly` | `0 * * * *` | `weekly-close` | Cierre semanal (filtra por timezone y día de semana) |
| `compact-conversations-nightly` | `0 3 * * *` | `compact-conversations` | Resume conversaciones largas con Haiku |
| `purge-old-messages-monthly` | `0 4 1 * *` | `purge-old-messages` | Borra `messages` y `tool_calls` >2 años (decisión sesión 6) |
| `cost-snapshot-daily` | `0 5 * * *` | `cost-snapshot` | Captura gasto diario en `cost_snapshots` para gráfico admin |
| `evals-nightly` | n/a (GitHub Actions) | n/a | Ver `nightly.yml` |

### 8.1 Cómo se invocan

```sql
select cron.schedule(
  'job-name',
  'cron-expr',
  $$ select net.http_post(
    url := '<edge-function-url>',
    headers := jsonb_build_object('x-cron-secret', current_setting('app.cron_secret')),
    body := '{}'::jsonb
  ); $$
);
```

El `x-cron-secret` se valida en cada Edge Function — sin él, devuelve 401. Anti-abuso si alguien encuentra la URL pública.

### 8.2 Verificación

- Cada Edge Function que es invocada por cron loguea inicio + fin + duración + cantidad de filas afectadas.
- Cada noche un cron de meta-monitoring revisa que **todos los jobs hayan corrido** en las últimas 24h. Si falta uno, alerta.

---

## 9. Endpoints admin

Todas las rutas `/api/admin/*` están protegidas por middleware en `app/(admin)/layout.tsx` que verifica:

```ts
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single();

if (profile?.role !== 'admin') redirect('/');
```

### 9.1 Endpoints HTTP

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/admin/settings` | Devuelve `app_settings` actual |
| PATCH | `/api/admin/settings` | Actualiza `app_settings`; auditoría obligatoria |
| GET | `/api/admin/models` | Devuelve `model_assignments` actual |
| PATCH | `/api/admin/models` | Cambia asignación |
| GET | `/api/admin/cost-limits` | Devuelve `cost_limits` |
| PATCH | `/api/admin/cost-limits` | Cambia caps |
| GET | `/api/admin/spend?period=mtd` | Resumen de gasto mensual |
| GET | `/api/admin/conversations?user_id=...&limit=...` | Lista conversaciones (lectura) |
| GET | `/api/admin/conversations/:id` | Detalle de mensajes (lectura) |
| GET | `/api/admin/prompts/:agent` | Lista versiones |
| POST | `/api/admin/prompts/:agent` | Crear nueva versión + ejecutar evals |
| POST | `/api/admin/prompts/:agent/:version/activate` | Activar versión (rollback es activar la anterior) |

### 9.2 Auditoría

Cada endpoint que escribe inserta en `audit_log` con `action='admin_<area>_changed'` y `metadata` con el delta.

Cada endpoint que lee contenido del atleta (conversaciones) inserta `audit_log` con `action='admin_read_conversation'` para que el atleta lo vea (decisión sesión 6).

---

## 10. Política de límite de gasto

Decisión sesión 7:

- **Presupuesto mensual default**: 50 €/mes total. Distribución estimada:
  - Anthropic: ~35 €/mes (Sonnet conversación + Opus plan semanal × 2 cuentas activas).
  - Supabase, Vercel, Resend, Sentry: free tiers.
  - Whoop: gratis.
- **Cap configurable** desde el panel admin por servicio (`cost_limits.monthly_cap_eur`).
- **Comportamiento ante el cap**:
  - **80% del cap** → email al admin con el detalle (qué servicio, cuánto va, días que quedan).
  - **100% del cap** → **pause automático**: nuevas llamadas a Anthropic devuelven 503 con mensaje "Servicio en pausa hasta el día 1; el admin puede subir el cap". El atleta sigue pudiendo usar la app sin el coach (registrar comidas, ver datos), pero las conversaciones quedan en cola hasta que se resuelva.

### 10.1 Cómo se calcula el gasto

- Cada llamada a Anthropic registra tokens usados en `messages.input_tokens`, `output_tokens`, `cache_*_tokens`.
- Edge Function `cost-snapshot-daily` (§8) computa el coste estimado a partir de los tokens y precios actuales (almacenados en `app_settings.anthropic_pricing`).
- Una vista materializada `mv_monthly_spend` agrega por mes y servicio.
- El panel admin lee de la vista.

### 10.2 Pause automático

- Bandera global en `app_settings.anthropic_paused_at`.
- Middleware de las Route Handlers `/api/coach/*` revisa antes de cada llamada.
- Si está activa: devuelve 503 con cuerpo `{ paused: true, until_first_of_month: true }` y la UI muestra mensaje claro.
- Cuando llega el primer día del mes (cron `cost-snapshot-daily` lo verifica), si `mv_monthly_spend` se ha reseteado, automáticamente quita el pause.

---

## 11. Observabilidad

### 11.1 Sentry — DIFERIDO A V1

> **Sesión 7-bis**: Sentry no entra en MVP. MVP usa solo logs nativos de Vercel + Supabase + un wrapper `console.error` con filtros de campos sensibles. Cuando llegue V1 reabrimos esta sección.

#### (Histórico — diseño previsto para V1)

#### Sentry cloud (free tier)

- Proyectos separados:
  - `creed-web` para Next.js (cliente + server).
  - `creed-edge` para Supabase Edge Functions.
- Source maps subidos automáticamente en deploy.
- `beforeSend` filtra campos sensibles (token, secret, password, email).
- Sample rate de errores: 100%. Sample rate de transactions: 10% en producción (free tier).
- Alarmas:
  - Error nuevo no agrupado → email al admin.
  - Tasa de error > 1% / 5 min → email + posible PagerDuty si llegamos a V1.

### 11.2 Supabase logs

- Vercel y Supabase guardan logs nativamente.
- Retention: **30 días** (decisión sesión 7).
- Acceso: el admin entra a los respectivos paneles. No drainamos a almacenamiento propio en MVP.

### 11.3 Métricas a vigilar

| Métrica | Objetivo | Dónde se ve |
|---|---|---|
| Tasa de error global | < 1% | Sentry |
| Latencia P50 / P95 de `/api/coach/*` | P95 < 8s | Sentry / Vercel |
| Errores de sync de Whoop | 0 sostenidos | Sentry + dashboard admin |
| Whoop `last_synced_at` antiguo | < 24h para todas las cuentas activas | Cron `whoop-stale-notifier` |
| Gasto Anthropic | < cap mensual | Admin |
| Tokens por turno (medio) | < 4k input por mensaje | Admin |
| Tasa de cache hit (prompt caching) | > 60% | Admin |

---

## 12. Backups y restore drill

### 12.1 Backups

- Supabase Free tier: backup automático diario, retention 7 días.
- Si subimos a Pro: 30 días + point-in-time recovery.
- Storage: backups gestionados por la plataforma de Supabase.

### 12.2 Restore drill

Cada **6 meses**, el autor:

1. Crea un proyecto Supabase nuevo de prueba.
2. Restaura el backup más reciente de producción.
3. Verifica que las cuentas, datos, foto en Storage, y RLS estén intactos.
4. Documenta el tiempo total y problemas encontrados.
5. Borra el proyecto de prueba.

Drill apuntado en el calendario del autor.

---

## 13. Rotación de claves

| Clave | Frecuencia normal | En incidente | Cómo |
|---|---|---|---|
| Supabase `service_role` | 12 meses | Inmediato | Regenerar en Supabase, actualizar en Vercel/Edge Functions, redeploy |
| Anthropic API key | 12 meses | Inmediato | Regenerar en console.anthropic.com, actualizar en Vercel/Supabase |
| Whoop `client_secret` | 12 meses | Inmediato | Regenerar en developer.whoop.com (Creed-Prod), actualizar en Vercel |
| Whoop `webhook_secret` | 12 meses | Inmediato | Regenerar y reconfigurar webhook en developer.whoop.com |
| Master key de pgsodium | 12 meses | Inmediato + re-encrypt | Migración nueva con re-encrypt completo (ver §13.1) |
| Resend API key | 12 meses | Inmediato | Regenerar en resend.com |
| `CRON_SECRET` | 12 meses | Inmediato | Cambiar en variables y en `pg_cron` setting |
| Sentry DSN | Solo en compromiso | Inmediato | Regenerar en sentry.io |

### 13.1 Rotación de master key de pgsodium

La más delicada porque hay que re-encrypt todos los `whoop_connections`:

1. Crear nueva clave en Vault: `select vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'whoop_tokens_key_v2', '...')`.
2. Migración:
   ```sql
   begin;
     -- desencripta con vieja, encripta con nueva, fila a fila
     update whoop_connections
       set access_token_encrypted  = whoop.encrypt_token_v2(whoop.decrypt_token_v1(access_token_encrypted)),
           refresh_token_encrypted = whoop.encrypt_token_v2(whoop.decrypt_token_v1(refresh_token_encrypted));

     -- Apunta las helpers actuales a la v2
     create or replace function whoop.encrypt_token(plain text) ...
     create or replace function whoop.decrypt_token(cipher bytea) ...

     -- Borra la clave antigua del Vault
     delete from vault.secrets where name = 'whoop_tokens_key';
   commit;
   ```
3. Auditoría en `audit_log` con `action='whoop_master_key_rotated'`.
4. Verificar que todos los syncs siguen funcionando (CI ejecuta en preview con la nueva clave antes de producción).

Decisión sesión 5: rotación cada 12 meses programada en calendario.

---

## 14. Runbooks

Pasos cuando algo se rompe.

### 14.1 Whoop sync caído

**Síntoma**: banner persistente en dashboard, alerta de Sentry, varios atletas sin sync >24h.

1. Revisar Sentry para identificar tipo de error (401, 429, 5xx).
2. Si es 401 sostenido: Whoop probablemente cambió algo en OAuth. Revisar developer.whoop.com changelog.
3. Si es 429: rate limit. Reducir frecuencia del cron a 12h temporalmente. Investigar si subimos a tier de partner si crece el uso.
4. Si es 5xx persistente: status.whoop.com. Esperar.
5. Documentar incidente en `audit_log` con `action='incident_whoop_outage'`.

### 14.2 Anthropic devolviendo errores 5xx persistentes

**Síntoma**: chat falla, evals nocturnos fallidos.

1. status.anthropic.com.
2. Si es problema general: degradar UI (mostrar "Coach temporalmente no disponible, los datos siguen funcionando").
3. Si es problema de cuenta (cap rate limit): subir tier de uso o esperar.

### 14.3 Reset de sesión de un usuario

**Síntoma**: el atleta no puede entrar.

1. Verificar email correctamente escrito.
2. SQL: `update auth.users set updated_at = now() where email = $1` (fuerza re-login).
3. El atleta hace nuevo OTP request.
4. Si persistente, contactar Supabase support.

### 14.4 Restaurar desde backup

**Síntoma**: borrado accidental masivo, corrupción.

1. Crear nuevo proyecto Supabase de emergencia.
2. Restaurar backup del día anterior (PITR si lo tenemos).
3. Validar datos.
4. Apuntar Vercel al nuevo proyecto (cambiar env vars).
5. Comunicar a usuarios afectados qué datos se han perdido (si aplica).

### 14.5 Migración de DB falló a mitad

**Síntoma**: `production-deploy.yml` queda fallido en step "apply migrations".

1. Mirar logs del workflow: identifica qué SQL falló.
2. Conectar a la DB de producción con `psql` y ver el estado real (a veces el error es un constraint que ya existía).
3. Si la transacción rollbackeó limpiamente: corregir la migración localmente, crear una nueva que la corrija, repetir el deploy.
4. Si quedó parcial (raro, solo si era NOT TRANSACTIONAL): aplicar manualmente los pasos pendientes con cuidado.
5. Documentar en `audit_log` con `action='migration_repair'`.

### 14.6 Pause automático activado, atletas se quejan

**Síntoma**: el coach no responde porque alcanzamos el cap mensual.

1. Verificar gasto real desde el panel admin.
2. Decisión: subir cap (`cost_limits.monthly_cap_eur += 25 €`) o esperar al primer del mes.
3. Comunicar a la pareja la decisión.

---

## 15. Decisiones cerradas en esta sesión

> Sesión 7, fecha 2026-05-08.

- **Email transaccional: Resend** con plantillas `react-email`.
- **Migraciones DB: manual con confirmación** vía GitHub Environments + Required reviewer.
- **Sin staging permanente**: solo preview de PR + producción.
- **Retención de logs: 30 días** (Vercel y Supabase).
- **Sentry cloud free tier** (5k errores/mes basta para MVP).
- **Política de gasto**: 50 €/mes default; alarma al 80%, **pause automático al 100%** hasta primer del mes.
- **Exportación de datos**: async con email de descarga (TTL del link 24h).
- **Crons en `pg_cron`** con `x-cron-secret` para anti-abuso.
- **Rotación de claves**: 12 meses, runbook documentado para pgsodium master key.
- **Restore drill**: cada 6 meses.
- **Concesión de admin**: vía SQL al setup, basado en lista `ADMIN_EMAILS`.
- **GitHub Actions** con jobs CI / preview / production-deploy / nightly evals.

## 16. Decisiones abiertas

| Pregunta | Sesión que la cierra |
|---|---|
| Dominio final del proyecto | Decisión del autor, antes de ir a producción |
| Subir Supabase Free → Pro (cuándo) | Cuando excedamos free tier por crecimiento |
| Subir Sentry Free → Team (cuándo) | Cuando excedamos 5k errores/mes |
| Texto exacto del email transaccional + política de privacidad v1 | Implementación (fase 7) |
| Si publicamos la app en marketplace de Whoop | Decisión del autor en cualquier momento |
| Si añadimos PagerDuty / on-call cuando crezcamos | V1 si abrimos a más usuarios |
