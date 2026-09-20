# Diseño — Creed como memoria + MCP remoto para claude.ai

> Estado: ✅ Validado en brainstorming (2026-09-20). El autor delegó el cierre de las secciones 2-5 ("haz todo").
> Tipo: spec de re-enfoque. Creed deja de ser una app con UI propia y pasa a ser **base de datos + capturador + servidor MCP** que alimenta al Claude que el autor ya usa (claude.ai).

## 1. Contexto y decisiones cerradas

El autor entrena con Whoop, apunta los entrenos en WhatsApp, va a empezar con una nutricionista y quiere registrar lo que come. Hoy pega ese contexto a mano en claude.ai. Creed ya tiene el 70 % del backend (Supabase con sync de Whoop, tablas de comidas, medidas corporales, catálogo de 873 ejercicios, rutinas/sesiones/series) pero **ninguna de las dos UIs (web mayo-2026, móvil jul-2026) se usa de verdad**. El coach embebido tampoco.

| Decisión | Valor |
|---|---|
| Cerebro | **claude.ai** (app móvil/web) con Creed como *custom connector* MCP remoto |
| Entrenos | **Texto libre** (WhatsApp) → Claude lo estructura → `log_workout`. App móvil **aparcada** |
| Comida | **Aproximada**: descripción/foto → Claude estima kcal/macros → `log_meal` |
| Nutricionista | **Números** (`log_measurement`) **y documentos** completos (`save_document`) |
| Whoop | **Se guarda en Supabase** (sync existente) + refresco si el dato tiene >2 h. Backfill inicial: **todo el historial** |
| Salida | Solo **bajo demanda** en el chat. Nada proactivo (fase posterior) |
| Idioma | Tools y descripciones en **español** |
| Código legado | No se borra; se deja de usar (limpieza en fase posterior) |

## 2. Arquitectura

```
claude.ai ──OAuth 2.1──▶ Supabase Auth (servidor OAuth) ──JWT──▶ apps/web /api/mcp  ──RLS──▶ Postgres
                                                                        │
Whoop API ──webhook + cron 3h──▶ apps/web /api/whoop/* ──service role──▶ whoop_* tables
```

- **Host**: `apps/web` (Next 16 en Vercel). Ya aloja OAuth de Whoop, webhook y crons. Se añaden: `/api/mcp/[transport]` (mcp-handler), `/.well-known/oauth-protected-resource`, `/oauth/consent` (página de consentimiento que exige Supabase) y `/whoop` (página mínima "Conectar Whoop").
- **Auth del MCP**: Supabase Auth como servidor OAuth 2.1 con **registro dinámico de clientes**. El MCP verifica el bearer con JWKS (`getClaims`) y crea un cliente Supabase **con el token del usuario**, así **RLS aplica** y las tools no necesitan service role. Plan B si claude.ai no adjunta el token (issue #1038 de claude-ai-mcp): mini servidor OAuth propio de un solo usuario.
- **Tools** viven en `apps/web/lib/mcp/` como funciones puras `(ctx, input) => output` con `ctx = { supabase, userId, now }`, independientes del transporte. El route handler solo las registra con sus esquemas Zod.
- **Whoop**: `packages/integrations/whoop` sin cambios de API; `sync.ts` gana `full: true` (backfill completo) y `whoop_body_measurements`. Cron pasa de 6 h a 3 h.

## 3. Modelo de datos

**Se reutiliza tal cual**: `whoop_connections`, `whoop_cycles`, `whoop_recovery`, `whoop_sleep`, `whoop_workouts`, `meals`, `body_measurements`, `profiles`, `exercises`, `programs`, `routines`, `routine_exercises`, `sessions`, `sets`.

**Migración A — `documents` + `whoop_body_measurements`**

```sql
create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('nutri_report','nutri_plan','analitica','otro')),
  title       text not null,
  doc_date    date not null,
  text        text not null,
  source_path text,                       -- opcional: fichero en Storage
  created_at  timestamptz not null default now(),
  search      tsvector generated always as (to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(text,''))) stored
);
-- RLS self-only + índice GIN en search

create table public.whoop_body_measurements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  height_m   numeric(4,2), weight_kg numeric(5,2), max_hr smallint,
  raw        jsonb not null,
  synced_at  timestamptz not null default now()
);
-- RLS self-only; una fila por sync solo si cambia (comparación en TS)
```

**Migración B — columnas en `sessions` y `meals`**

```sql
alter table public.sessions drop constraint sessions_source_check;
alter table public.sessions add constraint sessions_source_check
  check (source in ('manual','whoop','coach','text'));
-- notes ya existe en sessions

alter table public.meals
  add column source text not null default 'manual' check (source in ('manual','claude','parser')),
  add column confidence text not null default 'estimated' check (confidence in ('estimated','measured'));
```

`exercises` ya soporta custom por usuario (`is_custom`, `created_by`, RLS). `name_es` está vacío en las 873 filas: el matching se hace contra `name_en` + `slug` + alias en español que aporta Claude al llamar (`search_exercises`).

**Legado (no se toca)**: `training_plans/sessions/sets`, `conversations`, `messages`, `agent_*`, `weekly_verdicts`, `prompt_versions`, `model_assignments`, `cost_limits`, `hydration_log`, `mood_energy_log`.

## 4. Tools del MCP

Todas devuelven JSON compacto pensado para leerse en un chat (fechas ISO, unidades en el nombre del campo, sin nulls innecesarios). Errores: mensaje en español + `code`.

### Lectura

| Tool | Entrada | Salida |
|---|---|---|
| `get_daily_briefing` | `{ date?: YYYY-MM-DD }` (default hoy, zona Europe/Madrid) | `recovery {score, hrv_ms, rhr, spo2_pct, skin_temp_c}`, `sleep {hours, efficiency_pct, performance_pct, rem_h, deep_h, light_h}`, `strain`, `whoop_workouts[]`, `sessions[]` (resumen), `meals {items[], totals}`, `weight_kg` (último), `program {name, next_routine}`, `whoop_stale: bool`. Si el último ciclo tiene >2 h, lanza sync incremental antes. |
| `get_training_history` | `{ exercise?: string, since?: date, limit?: n≤50 }` | Sin `exercise`: sesiones (fecha, rutina, nº series, tonelaje, notas, strain Whoop si enlazado). Con `exercise`: progresión (mejor serie por sesión: peso×reps, e1RM Epley). |
| `get_whoop_summary` | `{ from, to, granularity: 'day' \| 'week' }` (máx 90 días) | Por día/semana: recovery medio, HRV, RHR, horas de sueño, strain, nº workouts. |
| `get_nutrition_summary` | `{ from, to }` (máx 31 días) | Por día: kcal, proteína, carbs, grasa, nº comidas, lista corta. Medias del rango. |
| `get_body_trend` | `{ limit?: n≤60 }` | `body_measurements` ∪ `whoop_body_measurements` (peso) ordenado por fecha, con fuente. |
| `get_program` | — | Programa activo con rutinas, ejercicios y targets. |
| `search_exercises` | `{ query, limit?: n≤10 }` | Candidatos del catálogo (`id, slug, name_en, primary_muscle, equipment, is_custom`). Búsqueda ILIKE sobre `name_en`/`slug` + alias ES→EN estático (`press banca`→`bench press`, `sentadilla`→`squat`, …). |
| `search_docs` | `{ query?: string, kind?: kind, limit?: n≤10 }` | Documentos (`id, kind, title, doc_date, excerpt`). Full-text `spanish`. |
| `get_doc` | `{ id }` | Documento completo. |

### Escritura

| Tool | Entrada | Efecto |
|---|---|---|
| `log_workout` | `{ date, started_at?, duration_min?, routine?: string, notes?, exercises: [{ name, exercise_id?, sets: [{ weight_kg?, reps?, rir?, rpe?, is_warmup? }] }] }` | Crea `sessions` (`source='text'`, `status='completed'`) + `sets`. Resuelve cada ejercicio: `exercise_id` si viene; si no, `search_exercises` interno → si 1 candidato claro lo usa, si no crea **custom** (`is_custom=true`). Devuelve `{ session_id, exercises: [{name, matched: slug \| 'custom' }] }` para que Claude confirme. Si `routine` casa con una rutina del programa activo, enlaza `routine_id`. |
| `log_meal` | `{ consumed_at, meal_type?, description, kcal, protein_g, carbs_g, fat_g, items?: [{name, grams?}], confidence?: 'estimated' }` | Inserta en `meals` (`raw_text=description`, `parsed=items`, `source='claude'`). |
| `log_measurement` | `{ measured_at, weight_kg?, body_fat_pct?, muscle_mass_kg?, waist_cm?, hip_cm?, chest_cm?, arm_cm?, thigh_cm?, notes? }` | Inserta en `body_measurements`. `muscle_mass_kg` va en `notes` estructurado (`{"muscle_mass_kg":..}`) para no migrar la tabla ahora. |
| `save_document` | `{ kind, title, doc_date, text }` | Inserta en `documents`. Texto ≤ 50 000 chars. |
| `set_program` | `{ name, goal?, rationale?, routines: [{ name, exercises: [{ name, exercise_id?, target_sets, target_reps, target_rir?, target_rpe?, rest_seconds?, notes? }] }] }` | Archiva el programa activo (si lo hay) y crea uno nuevo `status='active'`, `created_by='coach'`. Mismo resolutor de ejercicios que `log_workout`. |

### Diseño de prompts de las tools

Cada tool lleva una descripción en español con: cuándo usarla, unidades, y un ejemplo de llamada. `log_workout` y `log_meal` indican explícitamente "confirma con el usuario lo que has entendido antes de guardar si hay ambigüedad", para que Claude no invente pesos.

## 5. Auth (OAuth 2.1 con Supabase)

1. **Supabase cloud**: habilitar *Authentication → OAuth Server*, `authorization_url_path = /oauth/consent`, `allow_dynamic_registration = true`. Se gestiona vía `[remotes.creed.auth.oauth_server]` en `config.toml` + `supabase config push` (mismo mecanismo ya usado para SMTP/OTP). Local: `[auth.oauth_server]` idéntico.
2. **Claves asimétricas**: verificar que el proyecto firma con ES256/RS256 (JWKS en `/auth/v1/.well-known/jwks.json`). Si es HS256 legacy, migrar desde el dashboard (JWT Signing Keys).
3. **`/.well-known/oauth-protected-resource`** (apps/web): `protectedResourceHandler({ authServerUrls: ['https://<ref>.supabase.co/auth/v1'] })` de `mcp-handler`. También `/.well-known/oauth-protected-resource/api/mcp` por si el cliente usa la variante con path.
4. **`/api/mcp/[transport]`**: `withMcpAuth(handler, verifyToken, { required: true })`. `verifyToken` valida el JWT con `getClaims` (JWKS) y devuelve `{ token, clientId, scopes, extra: { userId } }`. El handler crea `createClient(url, anonKey, { global: { headers: { Authorization: Bearer <token> } } })` → RLS.
5. **`/oauth/consent`** (página Next, protegida por el proxy): lee `authorization_id`, si no hay sesión redirige a `/login?next=/oauth/consent?authorization_id=…`, muestra cliente + scopes, botones Aprobar/Denegar → `supabase.auth.oauth.approveAuthorization` / `denyAuthorization` → redirect a `redirect_url`.
6. **Proxy**: `/api/mcp`, `/.well-known` pasan a `PUBLIC_PATHS` (el MCP hace su propia auth). `/login` debe respetar `next`.
7. **Spike de validación (día 1)**: desplegar con una sola tool `ping` y conectar desde claude.ai. Si el token no llega tras el OAuth → plan B (mini servidor OAuth propio con `@modelcontextprotocol/sdk` `ProxyOAuthServerProvider` o similar, un solo usuario, contraseña en env).

## 6. Whoop

- `syncWhoop(..., { full: true })`: pagina sin `start` (o desde 2015) para traer todo el historial la primera vez (`last_synced_at` null). Incremental como hasta ahora.
- Nuevo: `client.getBodyMeasurement()` → `whoop_body_measurements` si difiere de la última fila.
- Cron: `0 */3 * * *`.
- `get_daily_briefing` → si `max(whoop_cycles.start_at) < now - 2h` y hay conexión, `syncWhoop` incremental (con timeout 8 s; si falla, responde con `whoop_stale: true`).
- Página `/whoop`: estado de conexión + botón "Conectar" (reusa `/api/whoop/authorize`) + "Sincronizar ahora". Es la única UI web de atleta que se mantiene enlazada.

## 7. Despliegue

- Vercel (proyecto existente) con env: `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` (cloud), `SUPABASE_SECRET_KEY` (service role legacy JWT — ver gotcha en memoria), `WHOOP_*` (redirect URI = `https://<dominio>.vercel.app/api/whoop/callback`), `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`.
- `supabase config push` con el bloque `oauth_server`; Site URL = dominio de Vercel; redirect URLs incluyen `/oauth/consent`.
- Connector en claude.ai: URL `https://<dominio>.vercel.app/api/mcp` (sin client id/secret: registro dinámico).

## 8. Testing

- **Unit (vitest, apps/web)**: resolutor de ejercicios (alias ES, empate, custom), agregaciones (e1RM, tonelaje, medias por semana), formateo de briefing, esquemas Zod de cada tool (rechazo de fechas inválidas, límites).
- **Integración (vitest + Supabase local)**: por cada tool, con un usuario de prueba creado vía admin API y **sesión real** (anon key + JWT del usuario) para que **RLS se ejercite**. Cubre: `log_workout` → `get_training_history` ida y vuelta; `log_meal` → `get_nutrition_summary`; `save_document` → `search_docs`; `set_program` → `get_program`; otro usuario no ve los datos.
- **E2E manual**: MCP Inspector contra local; luego claude.ai contra Vercel (spike de auth).
- Objetivo ≥ 80 % en `lib/mcp/`.

## 9. Fases

1. **Spike auth** — `oauth_server` en local + cloud, `/oauth/consent`, `/.well-known`, `/api/mcp` con `ping`. Validar con MCP Inspector (local) y claude.ai (Vercel).
2. **Migraciones A y B** + tipos regenerados.
3. **Tools de escritura** (TDD): `search_exercises`, `log_workout`, `log_meal`, `log_measurement`, `save_document`, `set_program`.
4. **Tools de lectura** (TDD): `get_program`, `get_training_history`, `get_nutrition_summary`, `get_body_trend`, `search_docs`/`get_doc`, `get_whoop_summary`, `get_daily_briefing`.
5. **Whoop**: backfill completo, body measurements, cron 3 h, página `/whoop`, refresco en briefing.
6. **Despliegue + connector** + carga inicial (pegar histórico de WhatsApp a Claude → `log_workout` en lote).

## 10. Fuera de alcance

Proactividad (briefing programado), embeddings/RAG sobre documentos, borrado de tablas legado, app móvil, multiusuario más allá de RLS (la pareja puede conectar su propio Claude si quiere: el diseño ya es por usuario).

## 11. Riesgos

| Riesgo | Mitigación |
|---|---|
| claude.ai no adjunta el token tras OAuth (issue #1038) | Spike día 1; plan B mini-OAuth propio |
| Supabase OAuth server requiere claves asimétricas / features de plan | Verificar JWKS en fase 1; migrar claves desde dashboard |
| Claude inventa pesos/kcal | Descripciones de tools exigen confirmación; `log_*` devuelven eco de lo guardado |
| Matching de ejercicios falla (catálogo en inglés) | Alias ES estático + `search_exercises` explícita + fallback custom siempre visible en la respuesta |
| Whoop rate limit en backfill | Paginación con `limit=25` y reintento con backoff (ya existe) |
