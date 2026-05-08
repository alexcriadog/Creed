# 07 — Seguridad y privacidad

> Estado: ✅ Completo (sesión 6, 2026-05-08).

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Modelo de amenazas](#2-modelo-de-amenazas)
3. [Capas de defensa](#3-capas-de-defensa)
4. [Headers HTTP](#4-headers-http)
5. [Autenticación](#5-autenticación)
6. [Autorización (RLS + rol admin)](#6-autorización-rls--rol-admin)
7. [Cifrado en tránsito y en reposo](#7-cifrado-en-tránsito-y-en-reposo)
8. [Tratamiento de datos en agentes (Anthropic)](#8-tratamiento-de-datos-en-agentes-anthropic)
9. [Retención por área](#9-retención-por-área)
10. [Procedimiento de borrado de cuenta](#10-procedimiento-de-borrado-de-cuenta)
11. [Cumplimiento (GDPR estricto)](#11-cumplimiento-gdpr-estricto)
12. [Acceso del admin a contenido del atleta](#12-acceso-del-admin-a-contenido-del-atleta)
13. [Cookies y tracking](#13-cookies-y-tracking)
14. [Plan de respuesta a incidentes](#14-plan-de-respuesta-a-incidentes)
15. [Decisiones cerradas en esta sesión](#15-decisiones-cerradas-en-esta-sesión)
16. [Decisiones abiertas](#16-decisiones-abiertas)

---

## 1. Resumen ejecutivo

Creed maneja **datos sensibles de salud** (Whoop, peso, comidas, ánimo, posibles fotos). Los protegemos con:

- **HTTPS + HSTS + CSP estricto + headers de seguridad**.
- **Auth email + OTP**, sin password (decisión sesión 6). 2FA opcional en V1.
- **RLS estricto por `user_id`** en Postgres, con rol `admin` separado para el panel de gestión.
- **Cifrado de tokens Whoop** con pgsodium + Vault (definido en `04-whoop-integration.md` §7).
- **Pseudonimización** al mandar contexto a Anthropic: solo `display_name`, sin email/dob/edad exacta.
- **Retención por área**: indefinida para datos del atleta, **2 años para `messages`** (decisión sesión 6), 365d para audit/reminders.
- **Borrado de cuenta** con cascada total + revoke de Whoop OAuth + vaciado de Storage, con **confirmación única**.
- **GDPR estricto** desde el día 1: política versionada, consentimientos, exportación, DPAs con cada provider.

---

## 2. Modelo de amenazas

Decisión cerrada (sesión 6): cubrimos **externo + dispositivo perdido del atleta**. No cubrimos exhaustivamente "empleado malicioso de proveedor" ni "ataque de cadena de suministro" en MVP — asumimos contratos DPA y reputación de Supabase / Anthropic / Vercel / Whoop.

### 2.1 Amenazas dentro de scope

| Amenaza | Mitigación principal |
|---|---|
| Atacante anónimo intenta acceder a datos de la pareja | RLS, HTTPS, CSP, auth fuerte |
| Robo de sesión (XSS, cookie theft) | CSP estricto, cookies HttpOnly+Secure+SameSite=Lax, sesiones rotables |
| Credential stuffing en login | Email + OTP (sin password = sin credentials a stuffear). Rate limit en login |
| Dispositivo del atleta perdido | Cierre remoto de sesión desde perfil; tokens de duración limitada |
| Token de Whoop comprometido (DB dump) | Cifrado a nivel columna con pgsodium |
| Foto de progreso filtrada (Storage) | Bucket privado, signed URLs con TTL corto |
| Fuga del prompt de Anthropic con datos del atleta | Pseudonimización; opt-out de logs si Anthropic lo ofrece |
| Ataque CSRF en endpoints de cambio | SameSite=Lax + verificación de origen + tokens si aplica |
| Clickjacking | `X-Frame-Options: DENY` + frame-ancestors CSP |
| Escalado de privilegios athlete → admin | RLS + columna `role` con `service_role` único en backend |

### 2.2 Amenazas fuera de scope (declaración explícita)

- Empleado malicioso interno de Supabase, Anthropic, Vercel, Whoop. Confiamos en sus contratos y SOC.
- Compromiso de la cadena de suministro de npm packages. En V1 añadimos lockfile audits y SBOM si crecemos.
- Ataques físicos al hardware del atleta (extracción de memoria, etc.).
- Vulnerabilidades zero-day en Postgres / Next.js / Deno. Mitigamos con actualizaciones puntuales.

---

## 3. Capas de defensa

Defense in depth: cada capa asume que la anterior puede fallar.

1. **Red**: HTTPS forzado, HSTS preload (1 año), TLS 1.3.
2. **Plataforma**: Vercel y Supabase con sus medidas estándar (DDoS protection, rate limit infra).
3. **App**: CSP estricto con nonce, headers de seguridad (§4), rate limit aplicativo.
4. **Auth**: email + OTP, sesiones con cookie HttpOnly + Secure + SameSite=Lax, expiración de 30 días con sliding refresh.
5. **DB**: RLS por usuario, service_role solo en Edge Functions, cifrado columna para tokens.
6. **Datos sensibles**: pseudonimización antes de Anthropic, mínimo necesario, sin logs detallados.
7. **Backup**: Supabase backups automáticos con retention. Restore drill cada 6 meses.

---

## 4. Headers HTTP

Aplicamos `~/.claude/rules/web/security.md`.

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains
# preload — diferido a V1: requiere apex domain controlado, MVP corre en *.vercel.app
Content-Security-Policy: <ver §4.1>
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

### 4.1 CSP

CSP con **nonce por request** generado en middleware de Next.js. Sin `unsafe-inline` para scripts.

```text
default-src 'self';
script-src 'self' 'nonce-{RANDOM}' 'strict-dynamic';
style-src 'self' 'unsafe-inline';   ← Tailwind necesita inline para estilos críticos
img-src 'self' data: blob: https://<project>.supabase.co;
font-src 'self' data:;
connect-src 'self' https://<project>.supabase.co https://api.anthropic.com https://api.prod.whoop.com;
frame-src 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

`unsafe-inline` en `style-src` es un compromiso necesario por Tailwind v4 + Next.js. Mitigado por: no usar `dangerouslySetInnerHTML` con contenido del usuario, sanitizar markdown si lo soportamos en V1.

---

## 5. Autenticación

### 5.1 Método principal

Decisión cerrada (sesión 6): **Email + OTP** (código de 6 dígitos por email).

- Sin password en MVP.
- Supabase Auth lo soporta nativo con `signInWithOtp`.
- Email se manda con plantilla custom (definida en `06-frontend.md` y `08-deployment.md`).
- Rate limit: máximo 3 intentos de OTP por código; 5 códigos por email por hora.

### 5.2 Sesiones

- Cookie HttpOnly + Secure + SameSite=Lax con JWT de Supabase.
- Refresh token rotativo cada 30 días.
- "Cerrar sesión en todos los dispositivos" disponible en perfil.
- Idle timeout: 30 días sin actividad → sesión expira.

### 5.3 2FA

Decisión cerrada (sesión 6): **post-MVP, en V1**. Sin 2FA en MVP por simplicidad. La razón es que con OTP por email + cuenta cerrada (5 cuentas) el riesgo es bajo. Cuando abramos en V1, 2FA se hace obligatorio para `role='admin'`.

### 5.4 Recuperación

- "He perdido el acceso al email" → no hay flujo automatizado. Contacto directo con admin (el autor) que valida out-of-band y resetea cuenta vía SQL.
- Adecuado para 5 cuentas; no escalable. Se reabre si V1.

---

## 6. Autorización (RLS + rol admin)

### 6.1 RLS por defecto

Todas las tablas con `user_id` tienen las cuatro políticas estándar (definidas en `03-data-model.md` §11):

```sql
auth.uid() = user_id
```

Para SELECT, INSERT, UPDATE, DELETE.

### 6.2 Excepciones por rol

Las tablas operacionales del admin (`prompt_versions`, `model_assignments`, `cost_limits`, `app_settings`) tienen política específica:

```sql
exists (
  select 1 from profiles
  where profiles.id = auth.uid()
    and profiles.role = 'admin'
)
```

Para SELECT/INSERT/UPDATE/DELETE.

### 6.3 Visor de conversaciones del admin

Política especial en `messages`, `conversations`, `agent_notes`, `tool_calls`:

```sql
auth.uid() = user_id  -- dueño normal
or
exists (
  select 1 from profiles p
  where p.id = auth.uid() and p.role = 'admin'
)
```

Solo para SELECT (el admin **lee**, nunca **escribe** por el atleta). Cada acceso del admin a contenido se registra en `audit_log` (§12).

### 6.4 Service role

`service_role` bypassea RLS. Usado solo en Edge Functions:

- Whoop sync (cron, webhook, backfill).
- Daily reminder, weekly close, conversation compactor.
- Admin endpoints que escriben en tablas operacionales.
- Borrado de cuenta.

**Nunca** se expone al cliente. La key vive solo en variables de entorno de Supabase / Vercel server-side.

### 6.5 Concesión inicial de admin

Vía SQL en setup (no hay UI):

```sql
update profiles set role = 'admin' where id = '<author_user_id>';
```

Operación queda registrada en `audit_log`.

---

## 7. Cifrado en tránsito y en reposo

### 7.1 En tránsito

- **TLS 1.3** mínimo para todo (HTTP, WebSocket, conexión a Whoop, Anthropic, Supabase).
- HSTS preload con `max-age=31536000; includeSubDomains; preload`.

### 7.2 En reposo

- **Supabase**: cifrado de disco gestionado por la plataforma.
- **Tokens de Whoop**: cifrado adicional a nivel columna con **pgsodium + Supabase Vault** (definido en `04-whoop-integration.md` §7).
- **Storage** (fotos): cifrado de disco de Supabase Storage. Acceso solo con signed URL.
- **Backups**: Supabase los cifra con la misma clave maestra de la plataforma.

### 7.3 Lo que NO ciframos extra

- `messages` body: en claro en DB (cifrado por la plataforma a nivel disco). Razón: necesitamos consultarlo y compactarlo. Su confidencialidad depende del control de acceso (RLS) y del modelo de amenazas (§2).
- `agent_notes` body: idem.
- Datos biométricos (peso, recovery, etc.): idem. El valor de cifrarlos a nivel columna es bajo comparado con el coste operativo.

---

## 8. Tratamiento de datos en agentes (Anthropic)

Decisión cerrada (sesión 6): **enviamos `display_name` (que el atleta elige) pero NO email/dob/edad exacta**.

### 8.1 Qué enviamos a Anthropic

En cada turno de conversación:

- `display_name` del atleta (puede ser nombre real o alias — su elección).
- `locale` (para `respond in Spanish`).
- `athlete_folder` serializado: objetivos, baseline (peso, % grasa), target, restrictions (lesiones, alergias, dislikes), equipment, schedule.
- `agent_notes` recientes.
- Datos recientes pedidos por las tools del agente (recovery 14d, peso 30d, comidas 7d, etc.).
- Mensajes nuevos de la conversación + resumen compactado si existe.
- System prompt + glosario.

### 8.2 Qué NO enviamos NUNCA

- Email del atleta.
- Fecha de nacimiento exacta. Si necesitamos edad, la enviamos como rango ("25-30 años").
- Tokens de Whoop o de cualquier otro servicio.
- Datos de otros atletas.
- Cookies o headers de sesión.
- IPs.
- Imágenes (Storage no se manda al modelo en MVP).

### 8.3 Logging de Anthropic

- Si Anthropic ofrece **opt-out de logs de prompts** en su contrato, lo activamos.
- Si por defecto retienen prompts X días, lo documentamos en la política de privacidad y obtenemos consentimiento del atleta al onboarding.
- Las llamadas a Anthropic se hacen con un `metadata.user_id` derivado del `user_id` interno (no es el `display_name`) para que su sistema pueda agrupar sin saber quién es.

### 8.4 Filtrado de logs propios

- Sentry SDK configurado con `beforeSend` que filtra cualquier campo cuyo nombre contenga `token`, `secret`, `password`, `email`.
- Los logs de Vercel y Supabase **no incluyen** body de mensajes ni body de notas. Solo metadata (conversation_id, duración, tokens, errores).

---

## 9. Retención por área

| Área | Retención | Razón |
|---|---|---|
| `profiles`, `athlete_folder` | Indefinida mientras la cuenta exista | Identidad y memoria del atleta |
| Wearables (Whoop) | Indefinida | Histórico relevante para el coach |
| Datos manuales (meals, peso, hydration, mood) | Indefinida | Histórico para el coach |
| Entrenamiento (`training_*`) | Indefinida | Progresión |
| **`messages` y `tool_calls`** | **2 años, luego purga automática** | Decisión cerrada en sesión 6 |
| `conversation_summaries` | Indefinida | Compactación; se mantiene cuando los mensajes se purgan |
| `agent_notes` | Indefinida | Memoria del coach que sobrevive a la purga de mensajes |
| `weekly_verdicts` | Indefinida | Histórico del progreso |
| `daily_reminders_sent` | 365 días | Anti-duplicado, no es histórico interesante |
| `audit_log` | 730 días | Auditoría legal/operacional |

### 9.1 Purga de `messages`

- Cron `pg_cron` mensual (primer día del mes 04:00 UTC).
- Borra `messages` con `created_at < now() - interval '2 years'` y `tool_calls` asociadas (cascade FK).
- **No** borra `conversation_summaries` ni `agent_notes` — la memoria del coach sobre el atleta sobrevive.
- Si la purga deja una conversación sin mensajes pero con summary, mantenemos la `conversation` row con un flag `purged_at`.

### 9.2 Borrado proactivo por el atleta

- En cada chat hay un botón "Borrar esta conversación" en el menú overflow.
- Borra todos los mensajes y tool_calls de esa conversación; mantiene `agent_notes` (las notas siguen siendo útiles para el coach futuro).
- Confirmación única.

---

## 10. Procedimiento de borrado de cuenta

Decisión cerrada (sesión 6): **cascada automática con confirmación inicial única**.

### 10.1 Flujo

1. Atleta entra en perfil → "Borrar mi cuenta".
2. Modal: "Esto borra tus datos, fotos, conversaciones y revoca Whoop. Es **irreversible**. ¿Confirmar?".
3. Tap "Confirmar" — un solo botón de confirmación.
4. La app llama a `/api/account/delete` (Next.js Route Handler).
5. El endpoint dispara la Edge Function `account-deletion` con `user_id` y un JWT de servicio.
6. Edge Function ejecuta:
   a. **Revoke OAuth de Whoop**: POST `/oauth/oauth2/revoke` con el refresh token actual. Si falla (token muerto), se ignora.
   b. **Borrar Storage**: borrado recursivo de `user/{user_id}/` en todos los buckets (`progress-photos`, `meal-photos`, `avatars`).
   c. **Auditoría**: insert en `audit_log` con `action='account_deleted'`, `user_id` aún válido.
   d. **Borrar `auth.users`**: `delete from auth.users where id = $1`.
7. La cascada de FKs vacía:
   - `profiles` → `athlete_folder`, `whoop_connections`, todas las `whoop_*`, `body_measurements`, `meals`, `hydration_log`, `mood_energy_log`, `training_*`, `conversations` → `messages` → `tool_calls`, `conversation_summaries`, `agent_notes`, `weekly_verdicts`, `daily_reminders_sent`.
8. La fila de `audit_log` queda con `user_id=null` (cascada `on delete set null`) preservando la traza.
9. Cliente recibe 200, cierra sesión, redirige a página de despedida.

### 10.2 Tiempo objetivo

- < 5 segundos para cuentas con histórico de hasta 1 año.
- < 30 segundos para cuentas más densas. Mostramos loader durante el proceso.

### 10.3 Lo que NO hacemos

- **No hay soft-delete**. Una vez confirmado, el dato desaparece. Sin "30 días para arrepentirse". Razón: privacidad > UX de "ups".
- **No exportamos automáticamente** antes de borrar. Para exportación, el atleta debe pulsar "Exportar mis datos" antes (botón separado, ver §11.4).

---

## 11. Cumplimiento (GDPR estricto)

Decisión cerrada (sesión 6): **GDPR estricto** desde el día 1.

### 11.1 Base jurídica

| Procesamiento | Base |
|---|---|
| Crear cuenta y prestar servicio | Ejecución de contrato |
| Procesar datos de Whoop con tu consentimiento | Consentimiento explícito |
| Mandar datos a Anthropic para que el coach responda | Consentimiento explícito |
| Auditoría legal/operacional | Interés legítimo |
| Comunicaciones transaccionales (recordatorio diario) | Interés legítimo + opt-out |
| Email marketing | No hacemos |

### 11.2 Derechos del atleta

| Derecho | Implementación |
|---|---|
| Acceso | El atleta ve **todos** sus datos en la app (dashboard, historial, perfil) |
| Rectificación | Edita en perfil o le pide al coach cambiar el folder |
| Supresión | Botón "Borrar cuenta" (§10) |
| Portabilidad | Botón "Exportar mis datos" (§11.4) |
| Oposición / restricción | Toggles en perfil para opt-out de procesos opcionales (notificaciones, lectura del admin) |
| No decisiones automatizadas | El coach **propone**, el atleta confirma cada cambio (sesión 5). Sin perfilado automático opaco |

### 11.3 Consentimientos registrados

Tabla `user_consents` (a definir en `03-data-model.md` mini-update si surge necesidad — en MVP basta con un campo `consents jsonb` en `profiles`):

```sql
profiles.consents jsonb default '{}'::jsonb
-- ejemplo:
-- {
--   "privacy_policy_v1": "2026-05-08T12:34:56Z",
--   "anthropic_processing": "2026-05-08T12:34:56Z",
--   "whoop_oauth": "2026-05-09T08:11:22Z",
--   "admin_can_read_conversations": "2026-05-08T12:34:56Z"
-- }
```

Cada consentimiento se acepta explícitamente al onboarding o al activar la feature correspondiente. Revocable en perfil (los que apliquen).

### 11.4 Exportación

- Botón "Exportar mis datos" en perfil.
- Genera un archivo ZIP con:
  - `profile.json`, `athlete_folder.json`.
  - `whoop_data.json` (cycles, recovery, sleep, workouts).
  - `meals.json`, `body_measurements.json`, `hydration.json`, `mood.json`.
  - `training.json` (plans + sessions + sets).
  - `conversations.json` (messages, tool_calls).
  - `agent_notes.json`.
  - `weekly_verdicts.json`.
  - Carpeta `photos/` con todas las imágenes.
- Generación asíncrona (Edge Function), email con link de descarga firmado, TTL 24h.

### 11.5 Política de privacidad

- Versionada (`docs/legal/privacy-vN.md` cuando creemos esa carpeta).
- Cada versión nueva requiere consentimiento explícito al siguiente login (modal).
- Idiomas: ES (obligatorio), EN cuando se añada.

### 11.6 DPA con providers

Antes de producción, firmamos / aceptamos los DPA de:

- Anthropic.
- Supabase.
- Vercel.
- Whoop.
- Servicio de email transaccional (decisión sesión 8).

### 11.7 DPO / contacto

- Sin DPO formal en MVP (no obligatorio para procesamiento personal a pequeña escala).
- Contacto: email del autor publicado en política de privacidad.

---

## 12. Acceso del admin a contenido del atleta

Decisión cerrada (sesión 6): **implicit consent** — el admin (autor del proyecto) tiene acceso por defecto. La política de privacidad lo explica explícitamente.

### 12.1 Política

La política de privacidad incluye párrafo:

> Esta aplicación es operada por una sola persona (el administrador) que también es uno de sus usuarios. Para depurar y mejorar el comportamiento del coach, el administrador puede leer las conversaciones de cualquier cuenta. Cada acceso queda registrado en el log de auditoría y es accesible para ti bajo solicitud. Si esto no te encaja, no crees una cuenta.

### 12.2 Auditoría obligatoria

Cada vez que el admin abre una conversación de otra cuenta:

```sql
insert into audit_log (user_id, action, metadata) values (
  '<athlete_id>',
  'admin_read_conversation',
  jsonb_build_object('admin_id', '<admin_id>', 'conversation_id', '<conv_id>')
);
```

### 12.3 Visibilidad para el atleta

- En perfil del atleta hay sección "Accesos del admin a mis datos" con la lista de eventos de `audit_log` con `action='admin_read_*'`.
- El atleta ve qué conversaciones leyó el admin y cuándo.
- No puede impedirlo, pero lo sabe.

### 12.4 Si en V1 abrimos a más usuarios

La decisión "implicit consent" se reabre. Probablemente migramos a:

- Toggle en perfil "Permitir al admin leer mis conversaciones" (opt-in, por defecto **off** fuera de la pareja).
- Sin acceso si está off.
- Política de privacidad actualizada.

---

## 13. Cookies y tracking

### 13.1 Cookies que ponemos

| Cookie | Propósito | Tipo |
|---|---|---|
| `sb-access-token` | Auth de Supabase | Necesaria |
| `sb-refresh-token` | Refresh de sesión | Necesaria |
| `csrf` | CSRF token cuando aplica | Necesaria |
| `theme` | Preferencia Auto/Claro/Oscuro | Funcional (cliente puede vivir sin ella, no rompemos UX) |
| `whoop_oauth_state` / `whoop_oauth_pkce` | OAuth flow | Necesaria, temporal (10 min) |

Todas HttpOnly + Secure + SameSite=Lax.

### 13.2 Lo que NO hacemos

- **No hay analytics de tracking** (Google Analytics, Mixpanel, Amplitude, etc.). Cero. Solo Sentry para errores y métricas de Anthropic / Supabase para uso interno.
- **No fingerprinting**.
- **No third-party cookies**.

### 13.3 Cookie banner

- Solo cookies necesarias y funcionales. Sin tracking.
- Por tanto, no necesitamos modal de aceptación de cookies según GDPR para tracking opcional.
- Sí incluimos en política de privacidad la lista exacta de cookies que ponemos.

---

## 14. Plan de respuesta a incidentes

### 14.1 Tipos de incidente

| Tipo | Ejemplo |
|---|---|
| **Brecha de credenciales** | Supabase service_role filtrado, Anthropic API key expuesta |
| **Brecha de datos** | Acceso no autorizado a la DB |
| **Compromiso de provider** | Anthropic / Supabase / Whoop / Vercel sufre incidente |
| **Vulnerabilidad detectada** | Por nosotros o por reporte externo |

### 14.2 Procedimiento

1. **Contención**: rotar credenciales afectadas, revocar tokens si aplica.
2. **Análisis**: scope (¿qué datos?), causa (¿cómo?), impacto (¿quiénes?).
3. **Notificación**:
   - Si afecta datos personales: notificar a los atletas afectados en < 72h (GDPR Art. 34).
   - Si afecta a la AEPD (autoridad UE): notificar también en 72h (Art. 33).
4. **Remediación**: parche, mitigación, prevención.
5. **Post-mortem**: documentar lo aprendido.

### 14.3 Rotación de claves

| Clave | Frecuencia | En incidente |
|---|---|---|
| Supabase `service_role` | 12 meses | Inmediato |
| Anthropic API key | 12 meses | Inmediato |
| Whoop `client_secret` | 12 meses | Inmediato |
| Whoop `webhook_secret` | 12 meses | Inmediato |
| Master key de pgsodium | 12 meses | Inmediato + re-encrypt |
| Resend / email API | 12 meses | Inmediato |

### 14.4 Backups

- Supabase backups automáticos diarios (gestionado por la plataforma).
- Restore drill cada 6 meses (apuntado en `08-deployment.md` y `10-roadmap.md`).

---

## 15. Decisiones cerradas en esta sesión

> Sesión 6, fecha 2026-05-08.

- **GDPR estricto** desde el día 1: política versionada, consentimientos registrados en `profiles.consents`, exportación, DPAs con cada provider.
- **2FA post-MVP** (V1). Forzado para `role='admin'` cuando llegue.
- **Auth: email + OTP** (Supabase Auth nativo).
- **Pseudonimización en Anthropic**: `display_name` sí, email/dob/edad exacta no.
- **Modelo de amenazas**: externo + dispositivo perdido. Empleado interno de proveedor y supply chain quedan fuera de scope explícitamente.
- **Borrado de cuenta**: cascada automática con confirmación única, sin soft-delete.
- **Retención de `messages`: 2 años**, luego purga automática (mantiene `agent_notes` y `conversation_summaries`).
- **Acceso del admin a conversaciones**: implicit consent documentado en política de privacidad. Cada acceso queda en `audit_log` y es visible al atleta.
- **Sin tracking analytics** (solo Sentry para errores + Supabase / Anthropic métricas internas).
- **Headers HTTP completos** (HSTS preload, CSP con nonce, X-Frame-Options DENY, etc.).
- **Cookies**: solo necesarias y funcionales, sin banner de tracking.

## 16. Decisiones abiertas

| Pregunta | Sesión que la cierra |
|---|---|
| Servicio de email transaccional concreto (Resend / Postmark / Mailgun) | 8 (deployment) |
| Texto exacto de la política de privacidad v1 | 8 (deployment) |
| Si añadimos tabla `user_consents` separada o seguimos con `profiles.consents jsonb` | V1 si el set de consentimientos crece |
| Implementación exacta de "Exportar mis datos" (síncrono pequeño / asíncrono con email) | 8 (deployment) |
| Cumplimiento extra para HIPAA-style si V2 abre a US | V2 |
