# 09 — Testing

> Estado: ✅ Completo (sesión 7, 2026-05-08).

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Pirámide de tests](#2-pirámide-de-tests)
3. [Unit tests](#3-unit-tests)
4. [Integration tests](#4-integration-tests)
5. [E2E tests](#5-e2e-tests)
6. [Visual regression](#6-visual-regression)
7. [Evals de agentes](#7-evals-de-agentes)
8. [Mock de Whoop (MSW)](#8-mock-de-whoop-msw)
9. [Coverage y gating](#9-coverage-y-gating)
10. [Anti-flake](#10-anti-flake)
11. [Decisiones cerradas en esta sesión](#11-decisiones-cerradas-en-esta-sesión)
12. [Decisiones abiertas](#12-decisiones-abiertas)

---

## 1. Resumen ejecutivo

Estrategia de testing de Creed:

- **TDD para lógica pura** (utilidades, hooks, transformaciones, agregaciones del semáforo).
- **Visual regression para UI con peso visual** (anti-template + glass moderno es sensible).
- **Evals para agentes** porque tests tradicionales no aplican a salidas en lenguaje natural.
- **MSW para Whoop** — sin llamadas reales en CI.

Aplicamos `~/.claude/rules/common/testing.md` y `~/.claude/rules/web/testing.md`. Coverage objetivo: **80% en lógica pura** (no en componentes UI puros, donde la regresión visual aporta más).

---

## 2. Pirámide de tests

```
                    ╭──────────────────────╮
                    │  Evals de agentes    │      ← 15 casos, runner propio
                    │   (manual + CI)      │
                    ╰──────────────────────╯
                  ╭────────────────────────────╮
                  │      E2E (Playwright)      │  ← flujos críticos
                  ╰────────────────────────────╯
                ╭──────────────────────────────────╮
                │   Visual regression (Playwright) │  ← screenshots por breakpoint
                ╰──────────────────────────────────╯
              ╭────────────────────────────────────────╮
              │    Integration (Vitest + Supabase)     │  ← API, RLS, edge functions
              ╰────────────────────────────────────────╯
            ╭──────────────────────────────────────────────╮
            │              Unit (Vitest)                   │  ← lógica pura
            ╰──────────────────────────────────────────────╯
```

---

## 3. Unit tests

### 3.1 Stack

- **Vitest** (más rápido que Jest, mismo API).
- Tests en `*.test.ts(x)` junto al código que prueban.

### 3.2 Qué cubrimos con unit

- Funciones puras en `packages/agents/lib/` (cómputo del semáforo, EMA del peso, adherencia, normalización de comidas).
- Custom hooks (`useReducedMotion`, `useScrollProgress`, etc.).
- Utilidades de fechas/timezones.
- Validaciones de zod para forms.
- Mappers de Whoop → tablas (`packages/integrations/whoop/mappers/`).
- Tools de los agentes (que son funciones TS aunque las invoque el modelo).

### 3.3 Estructura AAA

Aplicamos AAA (Arrange-Act-Assert) según `common/testing.md`:

```ts
test('computes weekly verdict as red when adherence is below 50%', () => {
  // Arrange
  const components = makeComponents({ adherenceMealsPct: 45 });

  // Act
  const verdict = computeWeeklyVerdict(components, defaultThresholds);

  // Assert
  expect(verdict.status).toBe('red');
  expect(verdict.reason).toContain('adherencia');
});
```

### 3.4 Tests prioritarios (TDD obligatorio)

- Cálculo del semáforo: cada combinación de inputs (verde/ámbar/rojo) tiene su test.
- Calorías mínimas: nunca devuelve por debajo del piso.
- EMA-7 / EMA-28 con datos sintéticos.
- Adherencia: contador correcto con datos parciales.
- Mapping Whoop: cada tabla (`whoop_cycles`, `whoop_recovery`, etc.) tiene tests con payloads reales cacheados.

---

## 4. Integration tests

### 4.1 Stack

- **Vitest** + Supabase local (`supabase start`).
- Cada test set-up/tear-down su propia DB con `supabase db reset`.

### 4.2 Qué cubrimos

- **RLS**: para cada tabla con `user_id`, test que confirma que un usuario no puede leer/escribir filas de otro.
- **API Routes**: `/api/coach/message`, `/api/whoop/callback`, `/api/admin/*`, `/api/account/delete`, `/api/meal-parser`.
- **Edge Functions** localmente vía `supabase functions serve`.
- **Triggers** de DB (e.g., trigger que crea `profiles` al crear `auth.users`).
- **Cifrado pgsodium** de tokens Whoop (encriptar → desencriptar idempotente).

### 4.3 Patrón de RLS test

```ts
test('athlete A cannot read meals of athlete B', async () => {
  const { userA, userB } = await seedTwoAthletes();
  const supabaseA = createSupabaseClient(userA.token);

  await supabaseA.from('meals').insert({ /* … */ });
  // Now try to read userB's meals
  const { data, error } = await supabaseA
    .from('meals')
    .select('*')
    .eq('user_id', userB.id);

  expect(data).toEqual([]);  // RLS filtra silenciosamente
  expect(error).toBeNull();
});
```

---

## 5. E2E tests

### 5.1 Stack

- **Playwright** contra preview deploys + Supabase branch DB.
- Browsers: Chromium (siempre), Firefox y WebKit (en `nightly.yml`).

### 5.2 Flujos críticos cubiertos

Definidos en `01-product.md` §4. Cada uno tiene su test:

1. **Login + onboarding completo**: signup, OTP, entrevista corta (validamos que se cubren todos los campos), llegada al dashboard.
2. **Conectar Whoop (MSW mock)**: click conectar → callback → backfill simulado → primer dato visible.
3. **Registrar comida**: input texto → parsing (mockeado el endpoint) → preview → guardar → ver en histórico.
4. **Conversación con coach**: enviar mensaje → ver streaming → recibir respuesta → propuesta inline (con datos mockeados de Anthropic).
5. **Modo lapso**: forzar 4 días sin actividad en seed → abrir app → ver flujo "ponme al día".
6. **Borrar cuenta**: confirmar → loader → redirect a despedida → verificar que no puede entrar.

### 5.3 Tipos de espera (anti-flake)

- **Esperas deterministas**: `expect(locator).toBeVisible()` con timeout, no `setTimeout`.
- **Network idle**: `page.waitForLoadState('networkidle')` cuando aplica.
- **Eventos custom**: la app emite `data-test-state="ready"` cuando termina de hidratar; los tests lo esperan.

---

## 6. Visual regression

### 6.1 Stack

Decisión sesión 7: **Playwright nativo con screenshots a archivos en repo**.

- Cada componente clave + cada pantalla clave tiene su test de screenshot.
- Screenshots se commitean a `apps/web/__snapshots__/`.
- Diff con tolerancia 0.1% (suficiente para detectar regresiones reales sin false positives por anti-aliasing).
- Cuando una regresión es intencional, el autor regenera con `pnpm test:visual --update-snapshots` y commitea.

### 6.2 Cobertura obligatoria

| Pantalla | Estados |
|---|---|
| Login | Vacío + email enviado + OTP input |
| Onboarding | 3 momentos (saludo, mid-questionnaire, reformulación final) |
| Dashboard | Verde + ámbar + rojo |
| Chat | 3 tabs + mensaje streaming + ProposalCard |
| Registrar comida | Vacío + parsed + editado |
| Plan semanal | Estados (programado/hecho/saltado/parcial) |
| Historial del coach | Vacío + con varias notas + filtrado |
| Banner Whoop | Cada estado (expired, revoked, error) |
| Admin settings | Página con sliders |

### 6.3 Breakpoints

Aplicamos `web/testing.md`: **320 / 768 / 1024 / 1440** + **modo claro y oscuro**. Total: 8 screenshots por pantalla. Aceptable porque las pantallas no son tantas (~12 + estados).

### 6.4 CI

- Ejecutamos en `ci.yml` paso `pnpm test:visual`.
- Si hay diff sin actualizar baseline → falla el PR.
- Los screenshots actualizados se ven en GitHub Actions artifacts para revisión humana.

---

## 7. Evals de agentes

### 7.1 Stack

Decisión sesión 7: **harness propio en TypeScript en `packages/agents/evals/`**.

```
packages/agents/evals/
├── cases/
│   ├── 01-macros-basicas.json
│   ├── 02-recovery-bajo.json
│   ├── ...
│   └── 15-plan-semanal-opus.json
├── runner.ts
├── scorers/
│   ├── tool-usage.ts            # ¿llamó a las tools esperadas?
│   ├── content-contains.ts      # ¿contiene tales palabras/no contiene tales?
│   ├── no-hallucination.ts      # heurística: no menciona "Schoenfeld 2017" ni paper-like
│   ├── tone-match.ts            # heurística + clasificador (LLM-as-judge con Haiku)
│   └── latency-tokens.ts
└── report.ts
```

### 7.2 Estructura de un case

```json
{
  "id": "01-macros-basicas",
  "description": "Atleta pregunta calorías y el nutri usa compute_macro_targets",
  "agent": "nutritionist",
  "setup": {
    "athlete_folder": { "primary_objective": "lose_fat", "baseline_weight_kg": 78 },
    "recent_biometrics": { "weight_ema_7": 78.4 },
    "active_app_settings": { "cal_floor_male": 1500 }
  },
  "messages_in": [
    { "role": "user", "content": "¿Cuántas calorías al día para perder grasa?" }
  ],
  "expected": {
    "tools_called": ["compute_macro_targets"],
    "tools_not_called": ["update_athlete_folder"],
    "content_contains": ["kcal", "/día"],
    "content_not_contains": ["et al.", "Schoenfeld", "según el paper"],
    "respects_calorie_floor": true,
    "tone": "nutritionist",
    "max_latency_ms": 12000,
    "max_input_tokens": 8000
  }
}
```

### 7.3 Métricas

Por caso, el runner mide:

- **Pass / Fail**: el caso pasa si **todas** las assertions del `expected` se cumplen.
- **Tools used**: lista exacta vs esperada.
- **Content checks**: contains / not-contains exactos.
- **No alucinaciones**: heurística (regex de patrones tipo "Author Año" en español/inglés) + LLM-as-judge para casos sutiles.
- **Tono**: LLM-as-judge con Haiku contra una rúbrica fija ("¿esta respuesta tiene tono profesional, empático, sin emojis?").
- **Latencia**: tiempo total desde request a respuesta completa.
- **Tokens**: input/output/cache.

### 7.4 Cuándo se ejecuta

- **Smoke (5 casos en Haiku)** en cada PR vía `ci.yml` step `evals:smoke`. Coste: ~$0.02 por ejecución.
- **Completos (15 casos contra el modelo asignado)** cada noche en `nightly.yml`. Coste: ~$0.50.
- **Manual desde admin** antes de activar una versión nueva de prompt: dispara los 15 contra la nueva versión.
- **Threshold para activar prompt**: 14/15 (≥90%, decisión sesión 5).

### 7.5 Reporte

- Cada ejecución genera un reporte HTML+JSON en GitHub Actions artifacts.
- El admin puede pedirlos desde `/admin/prompts/:agent/:version`.
- Comparación entre versiones: el panel admin muestra diff de scores entre versión activa y candidata.

---

## 8. Mock de Whoop (MSW)

Decisión sesión 7: **MSW (Mock Service Worker) con fixtures JSON**.

### 8.1 Estructura

```
packages/integrations/whoop/mocks/
├── handlers.ts                    # MSW handlers
├── fixtures/
│   ├── oauth-token.json
│   ├── user-profile.json
│   ├── cycles-page-1.json
│   ├── cycles-page-2.json
│   ├── recovery-list.json
│   ├── sleep-list.json
│   └── workout-list.json
├── browser.ts                     # browser worker (e2e)
└── node.ts                        # node server (vitest)
```

### 8.2 Handlers

Cada endpoint relevante de Whoop (`/oauth/oauth2/token`, `/v2/cycle`, `/v2/recovery`, etc.) tiene un handler MSW que devuelve la fixture correspondiente.

Algunos handlers simulan errores comunes:

- `/v2/recovery` con header `x-mock-error=429` → devuelve 429 (testear backoff).
- `/v2/cycle` con header `x-mock-error=401` → devuelve 401 (testear refresh).

### 8.3 Cómo se activa

- En **Vitest** (unit + integration): `setupFiles: ['./packages/integrations/whoop/mocks/node.ts']`.
- En **Playwright** (e2e): `await page.route('**/api.prod.whoop.com/**', mswRouter)`.
- En desarrollo local opcional: variable `MOCK_WHOOP=1` activa MSW en el cliente — útil cuando el autor no tiene acceso a Whoop real.

### 8.4 Fixtures vivos

- Cada vez que Whoop cambia algo en su API, regeneramos fixtures con un script `scripts/refresh-whoop-fixtures.ts` (usa una cuenta dev real una vez, captura responses, los serializa).
- Versionados en repo. Diff visible al actualizar.

---

## 9. Coverage y gating

### 9.1 Targets

Aplicamos `common/testing.md`: **80% coverage en lógica pura**.

- `packages/agents/lib/`: ≥85%.
- `packages/integrations/whoop/`: ≥80% (mappers e idempotencia incluidos).
- `apps/web/lib/`: ≥80%.
- Componentes UI puros (`packages/ui/`): **no** se mide coverage; se confía en visual regression + tests interactivos donde aplica.

### 9.2 Gate en CI

Decisión sesión 7: **coverage gate informativo en MVP**, bloqueante en V1.

- En MVP, el CI muestra el coverage en el comentario del PR pero **no** bloquea el merge si baja del target.
- Razón: priorizar velocidad de iteración. Si en 3 meses el coverage cae por debajo, evaluamos endurecer.
- En V1, gate bloqueante automático.

### 9.3 Visual regression no cuenta para coverage

Es un complemento, no un sustituto. Las pruebas visuales detectan regresiones que el coverage numérico no.

---

## 10. Anti-flake

Aplicamos `web/testing.md`. Reglas para que los tests sean fiables:

- **Esperas deterministas**: usamos `expect(locator).toBeVisible({ timeout: X })` en lugar de `setTimeout`.
- **Sin tiempos hardcoded** en tests excepto cuando se prueba específicamente latencia.
- **Cuarentena, no skip**: si un test es flaky, va a `quarantine/` y se ejecuta separado, sin bloquear el PR. Pero hay un cron que lo persigue para corregir o eliminar.
- **Re-run automático máximo 1 vez** en CI (Playwright). Si pasa al segundo intento, el test se marca como flaky y se investiga.
- **Mocks consistentes**: MSW devuelve siempre el mismo dato a la misma request en una misma ejecución.
- **Limpieza estricta**: cada test recrea su DB local, no asume estado previo.

---

## 11. Decisiones cerradas en esta sesión

> Sesión 7, fecha 2026-05-08.

- **Stack**: Vitest (unit + integration) + Playwright (e2e + visual).
- **Visual regression**: Playwright nativo con snapshots commiteadas; **sin** Chromatic en MVP.
- **Evals de agentes**: harness propio en `packages/agents/evals/`, casos en JSON, scorers TypeScript, smoke en cada PR (Haiku) + completos en nightly.
- **Threshold de evals para promover prompt**: 14/15 (≥90%).
- **Mock de Whoop**: MSW con fixtures versionadas en repo. Cuenta dev real solo para regenerar fixtures.
- **Coverage gate informativo en MVP** (target 80%); bloqueante en V1.
- **Anti-flake**: cuarentena en lugar de skip. Re-run máximo 1 vez en CI.

## 12. Decisiones abiertas

| Pregunta | Sesión que la cierra |
|---|---|
| Si añadimos Storybook (V1) para revisar componentes en aislamiento | V1 |
| Si añadimos contract testing entre frontend ↔ Edge Functions | V1 si crece complejidad |
| Tamaño exacto de la suite de evals tras los primeros casos reales | Tras 4-6 semanas de uso (objetivo 30 casos totales) |
| Si añadimos `pnpm test:e2e` en preview además de en main | Tras observar tasas de flake |
