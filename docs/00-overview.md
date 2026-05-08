# 00 — Overview

> Documento fundacional del proyecto. Define qué es Creed, qué no es, para quién, con qué stack y bajo qué principios.

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Problema que resolvemos](#2-problema-que-resolvemos)
3. [Alcance](#3-alcance)
4. [Glosario](#4-glosario)
5. [Decisiones cerradas](#5-decisiones-cerradas)
6. [Principios de diseño](#6-principios-de-diseño)
7. [Stack tecnológico](#7-stack-tecnológico)
8. [Estructura del repositorio](#8-estructura-del-repositorio)
9. [Qué NO es Creed](#9-qué-no-es-creed)
10. [Decisiones abiertas](#10-decisiones-abiertas)

---

## 1. Resumen ejecutivo

Creed es una **plataforma personal de coaching físico** para una pareja en proceso de transformación. Combina tres cosas:

1. **Datos pasivos** del dispositivo Whoop (sueño, recovery, strain, HRV).
2. **Datos activos** introducidos por el usuario (peso, medidas, comidas, hidratación; opcionalmente sets/reps de entrenamiento, fotos de progreso, estado de ánimo).
3. **Dos agentes AI coordinados** que actúan como un equipo profesional de élite:
   - Un **nutricionista** que diseña planes nutricionales y los ajusta semana a semana según adherencia y biometría.
   - Un **preparador físico** que diseña la rutina, gestiona la carga y vigila la recuperación.

Los agentes comparten una **carpeta del atleta** (memoria estructurada): cada uno deja notas que el otro puede leer, y un **orquestador** decide a quién dirigir cada conversación. La experiencia debe sentirse como tener un equipo profesional siguiendo el caso, no como dos chatbots sueltos.

---

## 2. Problema que resolvemos

Las apps actuales del mercado caen en uno de estos extremos:

- **Trackers pasivos** (Whoop, Apple Health, Garmin): muestran datos, pero no actúan ni razonan.
- **Apps de coach genérico** (MyFitnessPal, Strong, Macrofactor): plan rígido, sin contexto fisiológico real.
- **Coaching humano**: caro, asíncrono, y la mayoría no integra los datos del wearable de forma rigurosa.

Lo que falta para una pareja seria con sus datos:

- Que **alguien lea las señales** de Whoop antes de prescribir entrenamiento o ajustar calorías.
- Que la **historia del atleta persista**: lesiones, alergias, qué comidas funcionan, qué entrenamientos disparan strain alto sin recovery.
- Que **el coach explique sus decisiones** y se le pueda preguntar "por qué bajaste 200 kcal".
- Que los dos coaches **hablen entre sí** (el nutricionista necesita saber que es semana de descarga; el preparador necesita saber que estás en déficit).

Creed resuelve esto para nosotros dos. No es un producto comercial.

---

## 3. Alcance

### En MVP

- 2–5 cuentas (el autor y su pareja, con margen para 1–3 invitados de confianza).
- **Cada cuenta es totalmente aislada**: el atleta solo ve sus propios datos, no hay vista compartida con la pareja, los agentes mantienen memoria por usuario sin cruzarla. Convivimos en el mismo deployment, no en los mismos datos.
- Integración con **Whoop** (sync diario, OAuth 2.0, API v2).
- **Datos manuales**: peso/medidas/% grasa, comidas/macros/hidratación.
- **Datos opcionales**: sets/reps/peso de entrenamiento, fotos de progreso, estado de ánimo, energía subjetiva.
- **Dos agentes** (nutricionista + preparador) con memoria compartida **dentro de un mismo atleta**, nunca entre atletas.
- **Web app** responsive, instalable como PWA en móvil.
- **Idioma ES** con arquitectura i18n lista para añadir EN.

### Fuera de MVP

- App móvil nativa (iOS/Android).
- Otros wearables (Garmin, Apple Watch, Oura).
- Compartir datos con coaches humanos externos.
- Comunidad / social features.
- Billing / suscripciones.
- Auto-import de comidas via foto-AI (se valora para V1).

### Fuera del proyecto entero

- No es un producto comercial. No vamos a lanzarlo público.
- No es asesoramiento médico. Los agentes lo dirán explícitamente cuando aplique.

---

## 4. Glosario

> Términos que aparecen en toda la documentación y conviene fijar de entrada.

| Término | Definición |
|---|---|
| **Whoop strain** | Carga cardiovascular total del día, escala 0–21. Lo calcula Whoop a partir del HR y duración de zonas elevadas. |
| **Recovery** | % diario de Whoop (0–100) que estima cuán recuperado está el sistema nervioso autónomo. Se basa en HRV, RHR, sueño y respiración. |
| **HRV** | Heart Rate Variability — variabilidad entre latidos. Indicador clave de balance simpático/parasimpático. |
| **RHR** | Resting Heart Rate — ritmo cardíaco en reposo medido durante el sueño. |
| **Cycle** (Whoop) | Período de 24h definido por Whoop, no medianoche-medianoche; se cierra con el sueño. |
| **Atleta** | El usuario humano del sistema. En MVP somos dos. |
| **Carpeta del atleta** | Memoria estructurada del usuario que ambos agentes leen y escriben (preferencias, lesiones, objetivos, decisiones pasadas). |
| **Orquestador** | Capa AI que recibe el mensaje del usuario y decide qué agente (nutricionista / preparador) debe responder, y con qué contexto. |
| **Adherencia** | Grado en que el atleta cumple el plan prescrito (% de comidas registradas, % de entrenamientos hechos). Indicador clave para que el coach ajuste. |
| **RPE** | Rate of Perceived Exertion — esfuerzo subjetivo del entrenamiento (1–10). |
| **Tool use** | Capacidad del modelo de invocar funciones definidas por nosotros (consultar DB, escribir nota, generar plan) durante la conversación. |
| **RLS** | Row Level Security en Postgres / Supabase. Cada usuario solo puede leer/escribir sus propias filas. |

---

## 5. Decisiones cerradas

> Estas decisiones se cerraron en la sesión 1 (planning, fecha 2026-05-07). Cambios futuros requieren nueva sesión y dejan registro.

### 5.1 Producto

- **Alcance**: solo la pareja del autor y allegados de confianza, máximo ~5 cuentas. Sin signup público.
- **Aislamiento estricto por usuario**: cada cuenta es una sesión propia con sus propios datos y su propia memoria de atleta. Sin vista compartida, sin cruce de datos entre cuentas, sin notificaciones de progreso a la pareja. Los agentes saben de **un solo atleta** por sesión.
- **Idioma UI**: español por defecto. Arquitectura i18n-ready (next-intl con namespaces) para añadir inglés cuando convenga.
- **Datos obligatorios**: Whoop + peso/medidas/% grasa + comidas/macros/hidratación.
- **Datos opcionales**: sets/reps/peso de entrenamiento, fotos de progreso, ánimo/energía. Si el atleta no los registra, el coach informa que no podrá valorar progreso de fuerza con la misma precisión.
- **Dos agentes coordinados con memoria compartida**, no agentes independientes. Un orquestador decide a quién va cada pregunta. La memoria compartida es **entre nutricionista y preparador del mismo atleta**, nunca entre atletas distintos.

### 5.2 Stack

- **Monorepo**: pnpm workspaces + Turborepo.
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind v4 + shadcn/ui (con énfasis en romper el look genérico de template).
- **Backend / DB / Auth / Storage / Cron**: Supabase Cloud.
- **AI**: Anthropic Claude API. Sonnet 4.6 para los agentes; Haiku 4.5 para tareas baratas (clasificación de mensajes, parsing de comidas, etc.).
- **Integración Whoop**: API v2, OAuth 2.0, sync vía Edge Function en Supabase.
- **Deploy**: Vercel (web) + Supabase Cloud.
- **i18n**: next-intl.
- **Testing**: Vitest (unit) + Playwright (e2e) + screenshots a 320/768/1024/1440.
- **Observabilidad**: Sentry + logs de Supabase.

### 5.3 Lo que descartamos explícitamente

- Firebase: no encaja con nuestra preferencia por SQL + RLS.
- Express o backend Node custom: Supabase + Edge Functions cubre el caso.
- Material UI / Chakra: defaults se ven a "template", contradicen el principio de diseño.
- ORM extra encima de Supabase (Prisma/Drizzle): los tipos generados de Supabase + queries directas son suficientes.

---

## 6. Principios de diseño

> Reglas que guían trade-offs cuando hay varias formas de hacer algo.

### 6.1 Producto

1. **Profesional, no amateur**. Los agentes hablan como entrenadores serios, citan razones, no inventan estudios. Si no saben, lo dicen.
2. **Contexto > volumen**. Más vale una respuesta corta que se basa en los datos del atleta que un párrafo largo genérico.
3. **Decisiones explicadas**. Cuando el coach prescribe algo nuevo, registra la señal que lo dispara ("recovery 40 dos días seguidos → reduzco volumen un 20% esta semana").
4. **Adherencia primero**. El plan más perfecto que no se sigue vale cero. Los agentes priorizan ajustes que respeten la realidad del atleta.

### 6.2 Técnico

1. **Privacidad por defecto**. RLS estricto, tokens encriptados, mínimo posible mandado a Anthropic, retención clara por tabla.
2. **Sin abstracciones especulativas**. Construir solo lo que el MVP necesita; refactor cuando aparezca presión real (`YAGNI`).
3. **Inmutabilidad y tipos fuertes**. TypeScript estricto, sin `any`, datos derivados en lugar de duplicados (regla común del rule set).
4. **Pequeños archivos cohesivos**. 200–400 líneas típicas, 800 max (regla del rule set).
5. **Edge-first**. Edge Functions de Supabase y Edge Runtime de Next.js cuando aplique, para reducir latencia y coste.

### 6.3 Diseño visual (anti-template)

Aplicamos `~/.claude/rules/web/design-quality.md`. Cada superficie debe demostrar al menos cuatro de:

- Jerarquía clara por contraste de escala.
- Tipografía con carácter y pareja deliberada.
- Color usado semánticamente, no decorativo.
- Estados hover/focus/active intencionales.
- Composición editorial o bento donde encaje.
- Motion que clarifica el flujo, no que distrae.

Dirección visual provisional: editorial moderno + datos visuales tratados como parte del sistema, no como charts genéricos. Se cierra en `06-frontend.md`.

---

## 7. Stack tecnológico

| Capa | Elección | Justificación corta |
|---|---|---|
| Monorepo | pnpm + Turborepo | Build cache, paquetes compartidos sin fricción |
| Frontend | Next.js 15 (App Router) + TypeScript estricto | RSC + Edge + ecosistema Supabase |
| Estilos | Tailwind v4 + shadcn/ui (modificado) | Velocidad sin sacrificar calidad |
| DB / Auth / Storage / Cron | Supabase Cloud | Una sola plataforma con RLS de Postgres |
| AI | Anthropic Claude API (Sonnet 4.6 + Haiku 4.5) | Tool use + prompt caching + contexto de 200k |
| Integración wearable | Whoop API v2 (REST + OAuth 2.0) | Único device en MVP |
| Imágenes | Supabase Storage | Mismo modelo de RLS que el resto |
| i18n | next-intl | Estándar moderno en App Router |
| Testing | Vitest + Playwright | Unit + e2e + visual regression |
| Deploy | Vercel + Supabase Cloud | Mínima fricción, free tier suficiente |
| Observabilidad | Sentry + Supabase logs | Errores cliente/server + queries lentas |

Detalles operativos (env vars, CI/CD, runbooks) en `08-deployment.md`.

---

## 8. Estructura del repositorio

```
creed/
├── apps/
│   └── web/                     # Next.js 15 (App Router)
├── packages/
│   ├── db/                      # Tipos generados de Supabase y helpers
│   ├── agents/                  # Nutricionista, Preparador, Orquestador
│   ├── integrations/
│   │   └── whoop/               # OAuth, sync, mapeo
│   ├── ui/                      # Componentes compartidos
│   └── i18n/                    # Mensajes (ES, luego EN)
├── supabase/
│   ├── migrations/
│   ├── functions/               # Edge functions: whoop-sync, agents-runner
│   └── config.toml
├── docs/                        # Esta carpeta
├── PLAN.md                      # Plantilla de sesiones
├── README.md
├── .gitignore
└── package.json
```

> Nota: Esta estructura no existe todavía. En la sesión 1 solo se crea `docs/`, `README.md` y `.gitignore`. El resto se construye en sesiones posteriores según el roadmap.

---

## 9. Qué NO es Creed

Definir qué no es es tan importante como definir qué es. Esto evita scope creep en sesiones futuras.

- **No es asesoramiento médico**. Los agentes incluyen disclaimers cuando se acercan a temas clínicos. Si hay sospecha de patología, el agente recomienda consulta con profesional humano.
- **No es una red social**. No hay feed, no hay seguidores, no hay likes. Cada cuenta ve solo sus propios datos.
- **No es un producto comercial**. No hay intención de vender, monetizar ni captar usuarios. Si en el futuro cambia, queda registrado en `10-roadmap.md` y se reabren decisiones de privacidad/legal.
- **No reemplaza a Whoop**. Consume sus datos pero no replica su análisis ni intenta competir con su app.
- **No es un nutricionista o entrenador real**. Es un asistente AI entrenado para sonar profesional. Se le habla como tal, pero no tiene certificación legal.

---

## 10. Decisiones abiertas

Las que se cerrarán en sesiones siguientes:

| Sesión | Pregunta |
|---|---|
| 2 | ¿Qué métrica única usamos como proxy de "el proyecto funciona" (peso, % grasa, recovery promedio, adherencia)? |
| 3 | ¿Modelo de datos para la "carpeta del atleta": tablas estructuradas, JSON único, o híbrido? |
| 4 | ¿Whoop webhooks v2 o solo polling? Depende de SLA aceptable para datos del día anterior. |
| 5 | ¿Sonnet 4.6 para todo o Opus 4.7 (1M) en tareas de planificación de plan semanal? |
| 5 | ¿Cuántos turnos de conversación cacheamos (prompt caching) por sesión? |
| 6 | ¿Dirección visual final: editorial sobrio, neo-brutalismo deportivo, glass moderno? |
| 7 | ¿Sentry self-hosted o cloud? ¿Logtail o Axiom como alternativa? |
| 7 | ¿GDPR ligero o estricto pese a ser proyecto personal? Probablemente estricto por buenas prácticas. |

> Cada una se moverá a "Decisiones cerradas" en su doc correspondiente con la fecha y la sesión que la cerró.
