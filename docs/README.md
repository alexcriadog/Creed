# Documentación de Creed

Esta carpeta contiene **toda la documentación viva** del proyecto. Cada archivo se llena en su propia sesión de trabajo según la plantilla de [`PLAN.md`](../PLAN.md).

## Estado actual

| Estado | Significado |
|---|---|
| ✅ Completo | El documento está cerrado para esta fase. Cualquier cambio futuro va en una nueva sesión. |
| 🟡 Parcial | Tiene contenido útil pero quedan secciones marcadas como `TODO`. |
| ⬜ Esqueleto | Solo título, índice (TOC), preguntas abiertas y qué se decide en su sesión. |

## Documentos vivos (se actualizan continuamente)

| Estado | Documento | Qué cubre |
|---|---|---|
| 🟢 | [`inbox.md`](inbox.md) | Buzón cronológico de cosas que el usuario me pasa entre sesiones (decisiones, IDs públicos, links, preferencias) |
| 🟢 | [`setup-checklist.md`](setup-checklist.md) | Estado vivo de cada cuenta externa + TODOs operacionales y documentales |

## Índice

| Estado | Sesión | Documento | Qué cubre |
|---|---|---|---|
| ✅ | 1 | [`00-overview.md`](00-overview.md) | Visión, alcance, glosario, decisiones cerradas, principios, qué NO es Creed |
| ✅ | 2 | [`01-product.md`](01-product.md) | Personas (atleta + pareja), user stories, features MVP, métricas de éxito |
| ✅ | 3 | [`02-architecture.md`](02-architecture.md) | Diagrama de sistema, componentes, flujos de datos, edge cases |
| ✅ | 3 | [`03-data-model.md`](03-data-model.md) | Esquema Postgres completo, RLS, eventos, retention, índices |
| ✅ | 4 | [`04-whoop-integration.md`](04-whoop-integration.md) | OAuth flow, scopes, endpoints v2, sync incremental, webhooks, mapeo |
| ✅ | 5 | [`05-agents.md`](05-agents.md) | **Pieza central** — Nutricionista, Preparador, Orquestador: prompts, tools, memoria compartida, evaluación, guardrails |
| ✅ | 6 | [`06-frontend.md`](06-frontend.md) | Stack frontend, pantallas (atleta + admin), notificaciones, PWA, i18n, accesibilidad |
| ✅ | 6 | [`07-security-privacy.md`](07-security-privacy.md) | Modelo de amenazas, GDPR, auth, RLS, cifrado, retención, borrado, incidentes |
| ✅ | 6 | [`design.md`](design.md) | Design system reusable: tokens (color OKLCH, tipografía Geist, spacing, motion), receta de glass moderno, componentes, anti-patterns |
| ✅ | 7 | [`08-deployment.md`](08-deployment.md) | Entornos, env vars, CI/CD, Resend, crons, admin endpoints, observabilidad, runbooks, rotación |
| ✅ | 7 | [`09-testing.md`](09-testing.md) | Pirámide (Vitest + Playwright), visual regression, evals propios, MSW para Whoop, coverage |
| ✅ | 7 | [`10-roadmap.md`](10-roadmap.md) | 8 fases hacia MVP, demo usable en fase 5, V1 + V2, riesgos, presupuesto ≤50 €/mes |

## Cómo leer la documentación

- **Si vienes nuevo al proyecto**: lee [`00-overview.md`](00-overview.md) entero. Luego salta al doc del área que te interese.
- **Si vas a contribuir a una sesión**: lee este índice, lee el archivo de la sesión, y sigue el flujo de [`PLAN.md`](../PLAN.md) (proponer plan → esperar OK → implementar).
- **Si buscas una decisión concreta**: cada doc tiene una sección `Decisiones cerradas` y otra `Decisiones abiertas` al final. Empieza ahí.

## Convenciones de escritura

- Cada doc tiene **TOC** al inicio.
- Bloques `> Nota:` resaltan razonamiento que sería difícil reconstruir más adelante.
- Bloques `> Decisión:` registran un trade-off resuelto, con su fecha y la sesión que lo cerró.
- Las preguntas pendientes van en una sección `Decisiones abiertas` al final del doc, no enterradas en el cuerpo.
- Lenguaje en **español** (UI ES por decisión de producto, ver `00-overview.md`). El código y los nombres de identificadores van en inglés.
