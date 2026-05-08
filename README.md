# Creed

> Plataforma personal de coaching físico para una pareja. Une datos de Whoop con peso, comidas y entrenamientos manuales, y los pone en manos de dos agentes AI coordinados — un nutricionista y un preparador físico — que actúan con el rigor y la memoria de profesionales reales para un atleta de élite.

Repositorio en fase de **diseño**. No hay código de aplicación todavía; estamos produciendo la documentación que guiará la implementación.

---

## Estado

| Capa | Estado |
|---|---|
| Documentación | En progreso (sesión 1 de ~7) |
| Código aplicación | No iniciado |
| Despliegue | No iniciado |

---

## Por dónde empezar

1. Lee [`docs/README.md`](docs/README.md) — índice navegable de toda la documentación.
2. Si vienes nuevo al proyecto, abre [`docs/00-overview.md`](docs/00-overview.md). Es el único doc completo en este momento y explica qué es Creed.
3. Las sesiones de trabajo se rigen por la plantilla en [`PLAN.md`](PLAN.md).

---

## Estructura prevista del repositorio

```
creed/
├── apps/web/                # Next.js 15 (App Router) — UI principal
├── packages/
│   ├── db/                  # Tipos generados de Supabase y helpers
│   ├── agents/              # Nutricionista, Preparador, Orquestador
│   ├── integrations/whoop/  # OAuth + sync con Whoop API v2
│   ├── ui/                  # Componentes compartidos
│   └── i18n/                # Mensajes ES (EN se añade después)
├── supabase/                # Migraciones, RLS, edge functions
├── docs/                    # Documentación viva del proyecto
└── PLAN.md                  # Plantilla para sesiones de trabajo
```

Esta estructura no existe aún. Se construye en sesiones posteriores según el [roadmap](docs/10-roadmap.md).

---

## Stack (decidido en `docs/00-overview.md`)

- **Frontend**: Next.js 15 + TypeScript + Tailwind v4 + shadcn/ui
- **Backend**: Supabase (Postgres + Auth + RLS + Storage + Edge Functions)
- **AI**: Anthropic Claude API (Sonnet 4.6 / Haiku 4.5)
- **Integración**: Whoop API v2 (OAuth 2.0)
- **Deploy**: Vercel + Supabase Cloud
- **Monorepo**: pnpm workspaces + Turborepo

---

## Privacidad

Esta aplicación maneja datos sensibles de salud. La gestión está documentada en [`docs/07-security-privacy.md`](docs/07-security-privacy.md). Resumen rápido:

- Datos en Supabase con Row Level Security por usuario.
- Lo único que se manda a Anthropic es el contexto necesario para la respuesta del agente, sin identificadores directos cuando no hace falta.
- Sin terceros más allá de Whoop, Supabase y Anthropic.

---

## Contribuir

Proyecto personal cerrado a 2–5 cuentas (el autor y su pareja). No se aceptan contribuciones externas en esta fase.
