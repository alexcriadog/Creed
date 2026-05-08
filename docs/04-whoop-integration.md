# 04 — Integración con Whoop

> Estado: ✅ Completo (sesión 4, 2026-05-08).

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Referencias externas](#2-referencias-externas)
3. [Modelo conceptual de Whoop](#3-modelo-conceptual-de-whoop)
4. [Registro de la app en el portal](#4-registro-de-la-app-en-el-portal)
5. [Scopes solicitados](#5-scopes-solicitados)
6. [OAuth 2.0 — flujo completo](#6-oauth-20--flujo-completo)
7. [Almacenamiento cifrado de tokens](#7-almacenamiento-cifrado-de-tokens)
8. [Backfill inicial al conectar](#8-backfill-inicial-al-conectar)
9. [Sincronización continua](#9-sincronización-continua)
10. [Mapeo de datos a tablas](#10-mapeo-de-datos-a-tablas)
11. [Errores y reintentos](#11-errores-y-reintentos)
12. [Aviso al atleta cuando el sync falla](#12-aviso-al-atleta-cuando-el-sync-falla)
13. [Desconexión y borrado](#13-desconexión-y-borrado)
14. [Estados visibles al usuario](#14-estados-visibles-al-usuario)
15. [Decisiones cerradas en esta sesión](#15-decisiones-cerradas-en-esta-sesión)
16. [Decisiones abiertas](#16-decisiones-abiertas)

---

## 1. Resumen ejecutivo

Whoop es el único wearable soportado en MVP. La integración se compone de:

- **OAuth 2.0** con el portal de Whoop, usando `state` (anti-CSRF), PKCE si está disponible, y `offline` para refresh token.
- **Almacenamiento cifrado** de access/refresh tokens con **pgsodium + Supabase Vault**.
- **Backfill de 90 días** ejecutado en background al conectar.
- **Sync hybrid**: webhook entrante (camino rápido) + polling cada 6h (red de seguridad). Los dos comparten el mismo `upsert` idempotente.
- **Aviso al usuario** vía banner persistente en dashboard + email tras 24h si la sincronización falla.
- Toda la lógica vive aislada en `packages/integrations/whoop` para poder añadir Garmin/Oura/Apple Watch en el futuro sin tocar el resto.

---

## 2. Referencias externas

- Portal de desarrollador: <https://developer.whoop.com/>
- Documentación API: <https://developer.whoop.com/api/>
- OAuth 2.0: <https://developer.whoop.com/docs/developing/oauth/>
- Webhooks: <https://developer.whoop.com/docs/developing/webhooks/>
- Base URL del API: `https://api.prod.whoop.com`

> Nota: Whoop publica nuevas versiones del API periódicamente. Mantenemos la base **v2** y revisamos el changelog del portal en cada sesión de operaciones.

---

## 3. Modelo conceptual de Whoop

Whoop modela el día del atleta con cuatro entidades primarias:

### 3.1 Cycle

Período de ~24h definido por Whoop. **No** es medianoche-medianoche; un ciclo se cierra cuando empieza el siguiente bloque de sueño largo. Llega con `start`, `end`, métricas de strain, HR medio/máximo y un identificador propio (`whoop_id`).

Importante: un ciclo aparece **abierto** (`end_at = null`) hasta que Whoop lo cierra. Recibimos webhooks de actualización mientras se va calculando.

### 3.2 Recovery

Score 0–100 que Whoop publica al final del sueño nocturno. Una recovery pertenece a un cycle (vía `cycle_whoop_id`). Trae HRV (RMSSD), RHR, SpO₂, temperatura de piel.

### 3.3 Sleep

Sesiones de sueño (incluye siestas si el atleta las marca). Trae `start_at`, `end_at`, minutos en cama, minutos dormidos, REM/deep/light/awake, eficiencia, sueño "necesitado" según Whoop.

### 3.4 Workout

Sesiones detectadas o marcadas por el atleta. Trae deporte, `start_at`, `end_at`, strain, HR medio/máximo, distancia y kilojulios.

### 3.5 Cómo se relacionan en nuestro modelo

- 1 atleta tiene N `whoop_cycles`, N `whoop_recovery`, N `whoop_sleep`, N `whoop_workouts`.
- `whoop_recovery` puede unirse a `whoop_cycles` por `cycle_whoop_id`.
- Sleep y workouts son independientes de cycle (se identifican por sus propios `whoop_id`).
- Cada tabla guarda el payload original en `raw jsonb` para no perder información ante cambios futuros del API.

---

## 4. Registro de la app en el portal

### 4.1 Apps

Creamos **dos apps separadas** en el portal de Whoop:

| App | Propósito | Redirect URI | Webhook URL |
|---|---|---|---|
| `Creed-Dev` | Desarrollo local + previews | `http://localhost:3000/api/whoop/callback` y los URLs de Vercel preview | URL de Edge Function de Supabase del proyecto dev |
| `Creed-Prod` | Producción | `https://<dominio-prod>/api/whoop/callback` | URL de Edge Function de Supabase del proyecto prod |

### 4.2 Variables de entorno

Por entorno:

- `WHOOP_CLIENT_ID` (público para el flow OAuth, no sensible).
- `WHOOP_CLIENT_SECRET` (sensible — solo en server side, nunca en `NEXT_PUBLIC_*`).
- `WHOOP_REDIRECT_URI` (el callback de Next.js).
- `WHOOP_WEBHOOK_SECRET` (sensible — usado para verificar firma HMAC entrante).

Almacenadas en Vercel y Supabase con la política de rotación definida en `08-deployment.md`.

### 4.3 Política de rotación

- Rotación de `client_secret` y `webhook_secret` cada 12 meses, o inmediatamente ante sospecha de exposición.
- Cualquier rotación queda registrada en `audit_log` con `action='whoop_secret_rotated'`.

---

## 5. Scopes solicitados

Solicitamos el conjunto **completo de read scopes + offline**, porque los necesitamos todos para el coach:

| Scope | Por qué lo necesitamos |
|---|---|
| `read:profile` | Datos básicos del usuario Whoop (nombre, identificador) |
| `read:cycles` | Strain diario, ciclos abiertos/cerrados |
| `read:recovery` | Score de recovery, HRV, RHR — clave para el preparador |
| `read:sleep` | Calidad y duración del sueño |
| `read:workout` | Sesiones detectadas — el preparador valida con el plan |
| `read:body_measurement` | Talla/peso si Whoop los tiene; cross-check con `body_measurements` manual |
| `offline` | Refresh token. Sin esto, el usuario tendría que reautorizar cada hora |

No pedimos ningún scope `write:*` — Whoop es **lectura unidireccional** para nosotros. Si en V1 quisiéramos publicar workouts hacia Whoop, se reabre esta sección.

---

## 6. OAuth 2.0 — flujo completo

### 6.1 Authorize

1. Usuario pulsa "Conectar Whoop" en el perfil.
2. Next.js Route Handler `/api/whoop/authorize`:
   - Genera `state` aleatorio (UUID v4) y `code_verifier` para PKCE.
   - Guarda ambos en una cookie HttpOnly + Secure + SameSite=Lax con TTL 10 min, scoped al callback.
   - Redirige a `https://api.prod.whoop.com/oauth/oauth2/auth` con:
     - `response_type=code`
     - `client_id=WHOOP_CLIENT_ID`
     - `redirect_uri=WHOOP_REDIRECT_URI`
     - `scope` (lista de §5 separada por espacios)
     - `state=<el state generado>`
     - `code_challenge=<sha256(code_verifier) base64url>` y `code_challenge_method=S256` si Whoop soporta PKCE
3. El usuario autoriza en Whoop.

### 6.2 Callback

1. Whoop redirige a `/api/whoop/callback?code=<…>&state=<…>`.
2. Next.js Route Handler:
   - Lee la cookie HttpOnly y verifica que `state` coincide. Si no coincide → 400, posible CSRF, no se procesa.
   - Lee `code_verifier` de la cookie (si se usó PKCE).
   - POST a `https://api.prod.whoop.com/oauth/oauth2/token` con:
     - `grant_type=authorization_code`
     - `code=<…>`
     - `redirect_uri=WHOOP_REDIRECT_URI`
     - `client_id=WHOOP_CLIENT_ID`
     - `client_secret=WHOOP_CLIENT_SECRET`
     - `code_verifier=<…>` si aplica
   - Recibe `access_token`, `refresh_token`, `expires_in`, `scope`, `token_type=Bearer`.
   - GET `/v2/user/profile/basic` con el token para obtener `whoop_user_id`.
   - **Cifra** los tokens (ver §7) y hace `upsert` en `whoop_connections` con `status='connected'`, `last_synced_at = null`.
   - Inserta en `audit_log` con `action='whoop_connect'`.
   - Dispara Edge Function `whoop-backfill` (RPC con `service_role` JWT corto y firmado) para los últimos 90 días.
   - Borra la cookie de OAuth.
   - Redirige al dashboard con flash "Whoop conectado".

### 6.3 Refresh token

Cualquier 401 de la API o un `expires_at` que esté ≤ 5 minutos del momento dispara refresh:

1. POST `/oauth/oauth2/token` con:
   - `grant_type=refresh_token`
   - `refresh_token=<…>` (descifrado)
   - `client_id=WHOOP_CLIENT_ID`
   - `client_secret=WHOOP_CLIENT_SECRET`
2. Whoop devuelve nuevos `access_token`, `refresh_token`, `expires_in`. **Whoop rota refresh tokens** — guardamos los nuevos.
3. Cifrar los nuevos tokens y `update` en `whoop_connections`.
4. Reintentar la llamada original 1 vez.
5. Si el refresh falla con 401/403 → token revocado por el usuario en Whoop. Marcar `status='revoked'`, registrar `audit_log` `action='whoop_disconnect'` con metadata `{reason:'revoked'}`, mostrar banner.

### 6.4 Recursos

- Authorization endpoint: `https://api.prod.whoop.com/oauth/oauth2/auth`
- Token endpoint: `https://api.prod.whoop.com/oauth/oauth2/token`
- Revoke endpoint: `https://api.prod.whoop.com/oauth/oauth2/revoke`

---

## 7. Almacenamiento cifrado de tokens

### 7.1 Por qué pgsodium + Vault

Decisión de sesión 4: cifrado a nivel columna gestionado por Postgres. Razones:

- **Clave maestra fuera del código**: vive en Supabase Vault, no en variable de entorno de la app.
- **Las Edge Functions cifran/descifran de forma transparente** vía funciones SQL `SECURITY DEFINER`.
- **Un dump de DB no expone tokens en claro** sin la clave del Vault.
- Soporte oficial de Supabase, sin código de criptografía propio.

### 7.2 Diseño

Tabla `whoop_connections` (definida en `03-data-model.md`) tiene:

- `access_token_encrypted bytea`
- `refresh_token_encrypted bytea`

Una clave en Vault con identificador conocido (p.ej. `whoop_tokens_key`) se crea una vez en migración:

```sql
-- migración: setup-whoop-encryption.sql
select vault.create_secret(
  encode(gen_random_bytes(32), 'hex'),
  'whoop_tokens_key',
  'Master key for whoop access/refresh token encryption'
);
```

Helper SQL `SECURITY DEFINER` que solo `service_role` puede invocar:

```sql
create function whoop.encrypt_token(plain text)
  returns bytea
  language plpgsql
  security definer
  set search_path = public, pgsodium
as $$
declare
  key_id uuid;
  nonce  bytea;
begin
  select id into key_id
    from pgsodium.valid_key
    where name = 'whoop_tokens_key';
  nonce := pgsodium.crypto_aead_det_noncegen();
  return pgsodium.crypto_aead_det_encrypt(
    convert_to(plain, 'utf8'),
    convert_to(current_setting('request.jwt.claims', true), 'utf8'),  -- AAD
    key_id,
    nonce
  );
end;
$$;

create function whoop.decrypt_token(cipher bytea)
  returns text
  language plpgsql
  security definer
  set search_path = public, pgsodium
as $$
-- inversa, mismo key_id
…
$$;

revoke all on function whoop.encrypt_token, whoop.decrypt_token from public, anon, authenticated;
grant execute on function whoop.encrypt_token, whoop.decrypt_token to service_role;
```

> Los nombres exactos del API de pgsodium pueden variar según la versión instalada en Supabase Cloud — la migración real se ajusta con `\df pgsodium.*` antes del merge. El **patrón** es el descrito: clave en Vault, funciones definer, grants solo a `service_role`.

### 7.3 Política de rotación de la clave

- Rotación cada 12 meses o ante incidente.
- Procedimiento: nueva entrada en Vault → migración que re-encripta todos los `whoop_connections` con la nueva clave dentro de una transacción → eliminar la clave anterior.
- Registrado en `audit_log` con `action='whoop_master_key_rotated'`.

### 7.4 Lo que NO hacemos

- No exponemos las funciones `whoop.encrypt_token` ni `whoop.decrypt_token` a `authenticated` (cliente). Solo `service_role` (Edge Functions).
- No registramos tokens descifrados en logs ni en Sentry. El SDK de Sentry filtra por defecto cualquier campo cuyo nombre contenga `token`, `secret`, `password`.
- No mandamos tokens a Anthropic ni en mensajes ni en herramientas.

---

## 8. Backfill inicial al conectar

### 8.1 Volumen

- **90 días** de histórico (decisión de sesión 4).
- Se cubre `cycle`, `recovery`, `sleep`, `workout`. No re-pedimos `body_measurement` antiguo (solo el actual).

### 8.2 Cómo

1. La Edge Function `whoop-backfill` recibe `{user_id}` por payload.
2. Para cada recurso (cycles, recovery, sleep, workouts):
   - Llama al endpoint paginado: `GET /v2/<resource>?start=<now-90d>&end=<now>&limit=25` y sigue el cursor `nextToken` hasta agotar.
   - Por cada página, hace `upsert` idempotente (mismo path que el sync continuo).
   - Respeta rate limit con backoff (§11).
3. Al terminar, actualiza `whoop_connections.last_synced_at = now()` y emite un evento Realtime al canal del usuario `channel: user:{id}` evento `whoop:backfill_complete`.

### 8.3 UX durante el backfill

- El dashboard muestra "Sincronizando últimos 90 días…" con un indicador.
- Los datos van apareciendo conforme llegan (Realtime).
- Si el usuario cierra la pestaña, el backfill sigue en background y se ve completo la próxima vez.
- Tiempo objetivo: < 90 segundos para cuentas típicas.

### 8.4 Reintento si falla a mitad

- Si el backfill falla a mitad (rate limit sostenido, error 5xx), se marca un flag `last_error` y un `pg_cron` cada 30 minutos reanuda los recursos pendientes hasta cubrir los 90 días.
- Idempotencia por `(user_id, whoop_id)` garantiza que el reanudar no duplica filas.

---

## 9. Sincronización continua

### 9.1 Webhook (camino rápido)

Whoop publica eventos en su panel de developer; configuramos la URL `https://<project>.functions.supabase.co/whoop-webhook` y un secret de firma.

Eventos soportados (según docs Whoop v2):

- `cycle.updated`
- `recovery.updated`
- `sleep.updated`
- `workout.updated`

Procesamiento de la Edge Function `whoop-webhook`:

1. **Verificar firma**: cabecera (típicamente `X-WHOOP-Signature`) con HMAC SHA-256 de `body` usando `WHOOP_WEBHOOK_SECRET`. Si no coincide → 401 silencioso.
2. **Parse**: extrae `event_type`, `user_id` (Whoop), `id` del recurso.
3. **Resolver atleta local**: `select user_id from whoop_connections where whoop_user_id = $1`. Si no hay match → 200 OK silencioso (no es un usuario nuestro).
4. **Pedir el detalle a Whoop**: no confiamos en el payload del webhook como única fuente de verdad. Pedimos `GET /v2/<resource>/<id>` con el token del usuario.
5. **Upsert idempotente** por `(user_id, whoop_id)` en la tabla correspondiente (mapeo en §10).
6. **Actualizar `last_synced_at`** de la conexión.
7. **Realtime broadcast** al canal del usuario.
8. Devolver 200 OK con cuerpo vacío.

### 9.2 Polling (red de seguridad)

`pg_cron` invoca Edge Function `whoop-sync` cada 6 horas:

```sql
select cron.schedule(
  'whoop-sync-every-6h',
  '0 */6 * * *',
  $$ select net.http_post(
    url := '<edge function url>',
    headers := …,
    body := '{}'
  ); $$
);
```

Por cada `whoop_connections` con `status='connected'`:

1. Si `expires_at < now() + 5min` → refresh token (§6.3). Si falla → marcar `status` y siguiente.
2. Para cada recurso, GET con `start=<last_synced_at>&end=<now>&limit=25`, paginado.
3. Upsert idempotente.
4. Actualizar `last_synced_at`.

### 9.3 Idempotencia compartida

Webhook y polling **caen en el mismo path** de `upsert` por `(user_id, whoop_id)`. Si llegan ambos, el último gana, sin duplicados:

```sql
insert into whoop_cycles (user_id, whoop_id, start_at, end_at, strain, …, raw)
values (…)
on conflict (user_id, whoop_id) do update set
  end_at  = excluded.end_at,
  strain  = excluded.strain,
  raw     = excluded.raw,
  synced_at = now();
```

---

## 10. Mapeo de datos a tablas

### 10.1 `cycle` → `whoop_cycles`

| Campo Whoop | Columna |
|---|---|
| `id` | `whoop_id` |
| `start` | `start_at` |
| `end` | `end_at` (nullable) |
| `score.strain` | `strain` |
| `score.average_heart_rate` | `avg_hr` |
| `score.max_heart_rate` | `max_hr` |
| (payload completo) | `raw` |

### 10.2 `recovery` → `whoop_recovery`

| Campo Whoop | Columna |
|---|---|
| `cycle_id` | `cycle_whoop_id` |
| `created_at` (fecha del recovery) | `date` |
| `score.recovery_score` | `score` |
| `score.resting_heart_rate` | `resting_heart_rate` |
| `score.hrv_rmssd_milli` | `hrv_rmssd_milli` |
| `score.spo2_percentage` | `spo2_pct` |
| `score.skin_temp_celsius` | `skin_temp_celsius` |
| (payload completo) | `raw` |

### 10.3 `sleep` → `whoop_sleep`

| Campo Whoop | Columna |
|---|---|
| `id` | `whoop_id` |
| `start` | `start_at` |
| `end` | `end_at` |
| `score.stage_summary.total_in_bed_time_milli` | `duration_in_bed_minutes` (convertir) |
| `score.stage_summary.total_slow_wave_sleep_time_milli` | `deep_minutes` |
| `score.stage_summary.total_rem_sleep_time_milli` | `rem_minutes` |
| `score.stage_summary.total_light_sleep_time_milli` | `light_minutes` |
| `score.stage_summary.total_awake_time_milli` | `awake_minutes` |
| `score.sleep_efficiency_percentage` | `efficiency_pct` |
| `score.sleep_needed_baseline_milli` | `needed_minutes` (convertir) |
| `nap` | `is_nap` |
| (payload completo) | `raw` |

### 10.4 `workout` → `whoop_workouts`

| Campo Whoop | Columna |
|---|---|
| `id` | `whoop_id` |
| `sport_id` o `sport_name` | `sport` |
| `start` | `start_at` |
| `end` | `end_at` |
| `score.strain` | `strain` |
| `score.average_heart_rate` | `avg_hr` |
| `score.max_heart_rate` | `max_hr` |
| `score.kilojoule` | `kilojoule` |
| `score.distance_meter` | `distance_meters` |
| (payload completo) | `raw` |

### 10.5 Conversiones y nulls

- Todas las duraciones en `_milli` se convierten a `_minutes` enteros en los campos derivados; el original sigue en `raw`.
- Si Whoop entrega un campo como `null` o ausente, dejamos la columna derivada en `null`. Las queries del coach manejan `null` como "no disponible".

---

## 11. Errores y reintentos

### 11.1 Códigos HTTP

| Código | Acción |
|---|---|
| 200/201 | Procesar |
| 401 | Refresh token (§6.3); si falla → `status='revoked'` |
| 403 | Logear y marcar `status='error'` con `last_error` |
| 404 | Recurso desaparecido — no escribir, no reintentar |
| 429 | Rate limit; backoff 30s / 90s / 270s, máximo 3 reintentos. Si persiste → siguiente tick de cron |
| 5xx | Backoff con jitter (mismo patrón que 429) |

### 11.2 Polling vs webhook

- En el polling, los reintentos ocurren dentro del mismo tick. Si fallan los 3, el ciclo de cron de 6h cubre el siguiente intento.
- En el webhook, no reintentamos sincronamente: devolvemos 5xx para que Whoop reintente según su política. Si falla persistentemente, el polling lo recupera.

### 11.3 Marcado del `status` de conexión

- 3 intentos consecutivos fallidos en polling → `status='error'`, `last_error='<mensaje>'`.
- Token revocado por usuario en Whoop (401 sostenido tras refresh fallido) → `status='revoked'`.
- Cualquier error transitorio que pasa con un retry → no cambiamos `status`.

### 11.4 Logging

- Errores se mandan a Sentry con `whoop_user_id` (no PII) y `event_type`/`endpoint`.
- Tokens, payloads completos y `whoop_user_id` no aparecen en logs estándar — solo en Sentry para debugging activo.

---

## 12. Aviso al atleta cuando el sync falla

Decisión de sesión 4: **banner persistente en dashboard + email tras 24h**. Sin push (la app no es mobile-first todavía).

### 12.1 Banner en dashboard

- Componente `<WhoopStatusBanner>` (definido en `06-frontend.md`), renderizado siempre que `whoop_connections.status` no sea `connected` o `last_synced_at` esté > 25 horas atrás.
- Texto contextual:
  - `expired` → "Tu conexión con Whoop ha caducado. Pulsa para reconectar."
  - `revoked` → "Has revocado el acceso desde Whoop. Pulsa para reconectar."
  - `error` → "No hemos podido sincronizar Whoop desde <fecha>. <último error>". Botón reconectar y botón reintentar.
  - `connected` con `last_synced_at` antiguo → "Whoop sin sincronizar desde <fecha>. Estamos reintentando."
- El banner no se cierra hasta resolver el problema. Cero notificaciones modales.

### 12.2 Email tras 24h

- Cron en Edge Function `whoop-stale-notifier` corre cada hora.
- Selecciona `whoop_connections` con (`status in ('expired','revoked','error')` o `last_synced_at < now() - interval '24 hours'`) **y** sin email enviado en las últimas 72h por el mismo motivo.
- Manda email con plantilla en español (asunto: "Tu Whoop dejó de sincronizar"), CTA al perfil para reconectar.
- Inserta `audit_log` con `action='whoop_stale_email_sent'`.
- No mandamos más de 1 email por incidente cada 72h, para evitar spam.

### 12.3 Lo que NO hacemos

- No degradamos al coach con datos antiguos sin avisar — el agente sabe que `last_synced_at` está atrasado y lo menciona ("no he podido leer tus datos de Whoop desde X; opero con lo que hay hasta ese momento").
- No bloqueamos la app si Whoop falla. Los registros manuales siguen funcionando.

---

## 13. Desconexión y borrado

### 13.1 Desconexión manual desde el perfil

1. Usuario pulsa "Desconectar Whoop".
2. Confirmación clara: "Tus datos pasados se quedan. Dejaremos de sincronizar nuevos."
3. Next.js Route Handler `/api/whoop/disconnect`:
   - POST `/oauth/oauth2/revoke` con el refresh token (descifrado).
   - `delete from whoop_connections where user_id = auth.uid()`.
   - `audit_log` `action='whoop_disconnect'` con `metadata={reason:'user_initiated'}`.
   - Banner desaparece.
4. Las filas históricas en `whoop_cycles`, `whoop_recovery`, `whoop_sleep`, `whoop_workouts` **no se borran**. Son datos del atleta.

### 13.2 Reconexión

- Mismo flow de §6.1.
- Si el `whoop_user_id` coincide, reusamos las filas históricas (los `unique (user_id, whoop_id)` evitan duplicados).
- Si el `whoop_user_id` cambia (extraño pero posible), el atleta empieza con histórico nuevo.

### 13.3 Borrado de cuenta

Cubierto en `02-architecture.md` §4.9 y `03-data-model.md` §14.3:

1. Revoca el OAuth en Whoop.
2. La cascada de FKs vacía `whoop_connections` y todas las `whoop_*` de ese usuario.
3. `audit_log` queda con `user_id=null` para preservar la traza.

---

## 14. Estados visibles al usuario

En la pantalla de perfil, sección "Wearables", mostramos siempre el estado de la conexión:

| Estado interno | Color | Texto | Acción |
|---|---|---|---|
| `connected`, sync < 6h | Verde | "Conectado · sincronizado hace <X>" | "Desconectar" |
| `connected`, sync 6–25h | Verde claro | "Conectado · sincronizado hace <X>" | "Desconectar" / "Sincronizar ahora" |
| `connected`, sync > 25h | Ámbar | "Conectado pero sin sincronizar desde <fecha>. Estamos reintentando." | "Desconectar" / "Sincronizar ahora" |
| `expired` | Ámbar | "Conexión caducada. Reconecta." | "Reconectar" |
| `revoked` | Rojo | "Acceso revocado en Whoop. Reconecta." | "Reconectar" |
| `error` | Rojo | "Error de sincronización: <mensaje>" | "Reintentar" / "Reconectar" |

El timestamp humano ("hace 4 horas") se calcula en cliente con la timezone del perfil. El diseño visual concreto va en `06-frontend.md`.

---

## 15. Decisiones cerradas en esta sesión

> Sesión 4, fecha 2026-05-08.

- **Backfill inicial: 90 días**. Cubre cycles, recovery, sleep, workouts. Tiempo objetivo < 90s en background.
- **Cifrado de tokens con pgsodium + Supabase Vault**. Helpers `whoop.encrypt_token` / `whoop.decrypt_token` con `SECURITY DEFINER`, accesibles solo desde `service_role`.
- **Aviso al atleta de fallo de sync = banner persistente en dashboard + email tras 24h** (no push en MVP).
- **Scopes solicitados**: `read:profile`, `read:cycles`, `read:recovery`, `read:sleep`, `read:workout`, `read:body_measurement`, `offline`.
- **OAuth con `state` y PKCE** si Whoop lo soporta; fallback a `state` solo. Cookie HttpOnly + Secure + SameSite=Lax con TTL 10 min.
- **Webhook con verificación HMAC SHA-256** y secret específico (`WHOOP_WEBHOOK_SECRET`).
- **No confiamos en el payload del webhook como fuente de verdad**: siempre re-pedimos el detalle a Whoop antes de escribir.
- **Idempotencia por `(user_id, whoop_id)`** en todas las tablas `whoop_*`. Webhook y polling comparten path.
- **Política de errores**: refresh + 1 reintento en 401; backoff 30/90/270s en 429/5xx; tras 3 fallos consecutivos en polling → `status='error'`.
- **Desconexión manual** revoca OAuth, borra fila de `whoop_connections`, conserva el histórico.
- **Dos apps en el portal de Whoop**: `Creed-Dev` y `Creed-Prod`, secrets separados, redirect URIs separadas.

## 16. Decisiones abiertas

| Pregunta | Sesión que la cierra |
|---|---|
| Diseño visual del banner de estado y de la pantalla de "Wearables" | 6 (frontend) |
| Plantilla del email de fallo de sync | 6 (frontend) + 8 (deployment) |
| ¿Publicamos la app en el marketplace de Whoop o se queda como developer app privada? | Decisión del usuario, no técnica |
| Detalles de la rotación automatizada de la clave maestra de pgsodium | 8 (deployment) |
| Procedimiento exacto de re-encrypt en rotación de clave (transacción única vs por lotes) | 8 (deployment) |
| Soporte para múltiples dispositivos del mismo usuario en el futuro (Whoop + Garmin) | V1 — `04b-other-wearables.md` |
