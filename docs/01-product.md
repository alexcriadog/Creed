# 01 — Producto

> Estado: ✅ Completo (sesión 2, 2026-05-08).

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Personas](#2-personas)
3. [Job stories](#3-job-stories)
4. [User stories priorizadas (MoSCoW)](#4-user-stories-priorizadas-moscow)
5. [Flujos críticos](#5-flujos-críticos)
6. [Cadencia y recordatorios](#6-cadencia-y-recordatorios)
7. [Veredicto de progreso](#7-veredicto-de-progreso)
8. [Anti-features](#8-anti-features)
9. [Decisiones cerradas en esta sesión](#9-decisiones-cerradas-en-esta-sesión)
10. [Decisiones abiertas](#10-decisiones-abiertas)

---

## 1. Resumen ejecutivo

Creed sirve a una pareja en cambio físico que quiere rigor sin contratar a un equipo humano. Los datos del wearable dan el lado pasivo; los registros del atleta dan el lado activo; los dos agentes (nutricionista + preparador) interpretan el conjunto.

Este doc define **quién usa Creed**, **qué hace** un día normal, **qué historias entran en MVP** y **qué decidimos no construir**. No baja a UI ni a schema; eso vive en docs siguientes.

---

## 2. Personas

### 2.1 Atleta principal — el autor

- Programador, alta exigencia técnica.
- Cambio físico activo en curso.
- Espera del coach: profesionalidad, datos, decisiones explicadas.
- Tolera onboarding largo si entrega valor.
- Usa móvil y desktop indistintamente.
- Riesgo: obsesión con datos; el sistema **no** debe gamificar.

### 2.2 Atleta pareja

- Comparte el mismo deployment y el mismo wearable, pero su perfil físico y objetivos pueden diferir (composición corporal, plazos, restricciones).
- Tolerancia técnica menor que la del autor: la UI debe ser respetable sin requerir explicación previa.
- Espera del coach: trato respetuoso y profesional, sin jerga innecesaria.
- Cuenta totalmente aislada — nada cruza con la del autor.

### 2.3 Atletas invitados de confianza (1–3 plazas)

- Perfiles indefinidos, llegan con invitación manual del autor.
- Heredan el flujo del atleta principal sin adaptaciones específicas.
- Si en algún momento alguno aporta requisitos nuevos, se reabre este doc.

---

## 3. Job stories

> Formato: "Cuando … quiero … para …".

### Diario

- Cuando empiezo el día, quiero ver de un vistazo cómo estoy de recuperado y qué toca, para no tener que pensar.
- Cuando como, quiero registrarlo en menos de 30 segundos, para que el coste no me haga abandonar el log.
- Cuando termino el entrenamiento, quiero marcarlo como hecho con una sola interacción, para no romper el flujo.
- Cuando me peso, quiero ver la tendencia, no el ruido del día, para no obsesionarme con cifras.

### Semanal

- Cuando termino la semana, quiero saber si voy bien y por qué, para tener foco la siguiente.
- Cuando el coach cambia mi plan, quiero entender la razón, para no sentirme un objeto pasivo.

### Lapso

- Cuando vuelvo después de unos días flojos, quiero que el coach me ponga al día sin culpa, para retomar sin fricción.

### Onboarding

- Cuando entro por primera vez, quiero que el coach me entreviste como un profesional, no rellenar formularios, para que el plan se sienta diseñado para mí.

---

## 4. User stories priorizadas (MoSCoW)

### Must (MVP) — sin esto no salimos

- Como atleta, completo un onboarding tipo entrevista con el coach que registra mi perfil, lesiones, alergias, equipamiento y objetivos.
- Como atleta, conecto Whoop por OAuth y veo mis últimos N días sincronizados.
- Como atleta, registro una comida en texto libre y el sistema la convierte en macros aproximados.
- Como atleta, registro mi peso y veo la tendencia EMA-7, no el dato bruto del día.
- Como atleta, marco un entrenamiento programado como hecho o no hecho, opcionalmente con RPE.
- Como atleta, tengo conversación con cualquiera de los dos agentes y el orquestador decide a quién dirigirla.
- Como atleta, abro el dashboard diario y veo: recovery, strain, peso EMA, balance calórico estimado, semáforo de progreso y mensaje del coach.
- Como atleta, recibo un recordatorio diario si no he registrado nada en el día.
- Como atleta, si llevo 3+ días sin registrar, al volver entro en flujo "ponme al día" donde el coach pide resumen libre y reajusta.
- Como atleta, puedo borrar mi cuenta y todo lo asociado (Whoop revocado, datos eliminados, fotos en Storage borradas).

### Should (V1) — eleva el rigor pero no bloquea MVP

- Como atleta, registro sets/reps/peso por ejercicio para que el preparador valore progreso de fuerza.
- Como atleta, subo fotos de progreso (semanales o mensuales) y las comparo lado a lado.
- Como atleta, registro estado de ánimo y energía subjetiva (1–5) y el coach lo usa al ajustar el plan.
- Como atleta, recibo el plan semanal redactado por el preparador con razones explícitas.

### Could (V2) — exploratorio

- Como atleta, hago foto a un plato y el sistema parsea ingredientes y macros.
- Como atleta, conecto otro wearable (Garmin / Apple Watch / Oura).
- Como atleta, exporto mi histórico en un archivo procesable.

### Won't — descartado, no se construye

- Compartir datos con la pareja u otros atletas.
- Comparativa con medias del mercado o con otros atletas.
- Comunidad, feed, mensajes, likes.
- Gamificación (rachas, puntos, badges).
- Compartir datos con un coach humano externo desde la app.
- Marketplace de planes prediseñados.

---

## 5. Flujos críticos

### 5.1 Onboarding profundo (20–30 min)

No es un formulario plano. Es una **entrevista con el coach** que cubre:

1. Identidad y datos físicos (sexo, edad, altura, peso actual, % grasa si lo conoce).
2. Historial deportivo (años entrenando, deportes anteriores, nivel actual).
3. Lesiones y dolores (presentes y pasados relevantes).
4. Alergias e intolerancias.
5. Preferencias y rechazos alimentarios (qué le gusta, qué no se va a comer ni con plan).
6. Equipamiento disponible (gimnasio comercial, equipo en casa, espacio).
7. Restricciones de horario (días que entrena, ventana de comidas).
8. Objetivo principal y secundarios (perder grasa, ganar fuerza, ganar músculo, mantener salud).
9. Expectativas y plazos (qué espera ver y para cuándo).

El agente **reformula los objetivos en sus propias palabras**, los reta si no son realistas y cierra con un resumen que el atleta confirma. La salida del onboarding se guarda como **carpeta del atleta** inicial (ver `03-data-model.md` y `05-agents.md`).

Si el atleta abandona a mitad del onboarding, se guarda lo que haya y se reanuda al volver. No hay penalización.

### 5.2 Registro diario

Optimizado para **ser barato en cualquier momento del día**:

- **Comida**: input de texto libre. Haiku 4.5 lo parsea a alimentos + cantidades + macros aproximados. El atleta puede corregir con un toque.
- **Hidratación**: contador rápido (vasos / litros).
- **Peso**: input numérico opcional, no diario.
- **Entrenamiento**: marca "hecho" / "no hecho" en la sesión programada del día. Opcional: RPE 1–10. Opcional V1: sets/reps/peso.

Latencia objetivo de cada registro individual: **< 30 segundos** de interacción.

### 5.3 Conversación con un agente

1. Atleta escribe un mensaje libre.
2. **Orquestador** (Haiku con tool de routing) decide si va al nutricionista, al preparador, o si necesita ambos.
3. El agente elegido lee la carpeta del atleta + datos recientes (Whoop, último registro) vía tools.
4. Responde con texto y, si aplica, anota una decisión en `agent_notes` que el otro agente verá.
5. Si el atleta pregunta "¿por qué dijiste X?", el agente lee sus propias notas pasadas.

### 5.4 Cierre semanal

Cada domingo (zona horaria del atleta):

1. El sistema calcula el veredicto compuesto (sección 7).
2. El preparador genera un mensaje semanal explicando el ajuste para la siguiente.
3. El nutricionista, si aplica, ajusta calorías o macros.
4. El atleta ve un resumen visual + texto y puede preguntar.

### 5.5 Re-engagement tras lapso (≥ 3 días)

Disparador: el atleta abre la app y la última actividad de cualquier tipo es ≥ 3 días.

Comportamiento:

1. La pantalla principal abre un flow especial — no es el dashboard normal.
2. El coach saluda con tono **profesional y directo, sin reproche**: "Bien, pongámonos al día. Cuéntame qué ha pasado estos días, sobre todo lo que no ha ido bien."
3. El atleta responde libremente.
4. El agente extrae lo relevante (entrenamientos saltados, comidas fuera, lesión, viaje, enfermedad), lo guarda como nota con tag y reajusta el plan si hace falta.
5. Después del flow, vuelve al dashboard normal.

El sistema **no borra** los datos de los días en blanco; los marca como "no registrados" para que el coach pueda contextualizarlos.

---

## 6. Cadencia y recordatorios

### 6.1 Cadencia esperada por parte del atleta

| Acción | Cadencia esperada | Obligatorio para que el coach trabaje |
|---|---|---|
| Onboarding | Una vez al empezar | Sí |
| Registro de comidas | Diario | Sí (umbral mínimo: 1 comida/día) |
| Hidratación | Diario | No, recomendado |
| Peso | Semanal | Sí |
| Marcar entrenamiento | Cada sesión programada | Sí |
| Sets/reps/peso | Cada sesión (V1) | No en MVP |
| Foto de progreso | Mensual (V1) | No |
| Conversación con coach | Cuando quiera | No |

### 6.2 Recordatorio diario

Si al final del día el atleta no ha registrado **nada**, el sistema envía **un único recordatorio**.

- Canal preferente: PWA push notifications (opt-in en perfil, requiere PWA instalada).
- Fallback: email diario nocturno con resumen del día y huecos.
- Nunca más de un recordatorio por día.
- Decisión final del canal y horario en `06-frontend.md` y `08-deployment.md`.

### 6.3 Umbrales

- **Día sin registros** → dispara recordatorio (1).
- **3+ días sin registros** → al volver, flujo de re-engagement (sección 5.5).

---

## 7. Veredicto de progreso

### 7.1 Por qué un panel compuesto y no una métrica única

El usuario es programador, no profesional de la salud. Una sola cifra simplifica de más y arrastra hacia obsesión. Un panel compuesto + un veredicto cualitativo lo deja informado sin que se ate a un número.

### 7.2 Componentes del veredicto

| Componente | Fuente | Ventana |
|---|---|---|
| Tendencia de peso (EMA-7) | Logs del atleta | 2–4 semanas |
| Recovery medio | Whoop | Últimas 2 semanas |
| Adherencia comidas | Logs del atleta | Últimos 7 días |
| Adherencia entrenamientos | Logs del atleta + plan | Últimos 7 días |
| Sensación subjetiva (opcional) | Logs del atleta | Últimos 7 días |

### 7.3 Semáforo (drafting)

| Color | Disparador (alguno basta) |
|---|---|
| 🟢 Verde | Tendencia hacia objetivo + recovery medio en zona aceptable + adherencia ≥ 70%. |
| 🟡 Ámbar | Cualquier señal en zona de riesgo (recovery cayendo 7+ días, adherencia 50–70%, peso plano sostenido) **sin** tendencia clara hacia atrás. |
| 🔴 Rojo | Tendencia contraria al objetivo ≥ 14 días, **o** recovery cayendo durante 7+ días con adherencia < 70%, **o** adherencia < 50% durante 7+ días. |

Los **umbrales numéricos exactos** se calibran en `05-agents.md` con evals.

### 7.4 El texto del coach acompaña siempre

El semáforo nunca aparece solo. El coach siempre añade:

- **Qué señal** lo dispara ("recovery medio 42 los últimos 14 días, viniendo de 58").
- **Qué propone** ("voy a reducir volumen un 15% esta semana y subir las horas en la cama 30 min").
- **Qué espera ver** ("si recovery sube por encima de 50 en 5 días, volvemos al volumen normal").

Refuerza el principio de **decisiones explicadas** del `00-overview.md`.

---

## 8. Anti-features

Lo que decidimos **no construir**, con razón explícita:

- **Comunidad / feed / leaderboard** — la privacidad gana al engagement social. Riesgo de comparación tóxica.
- **Gamificación (rachas, badges, puntos)** — refuerza la cifra sobre el progreso real, dispara obsesión, contradice el principio "todo en general".
- **Notificaciones agresivas** — máximo 1 recordatorio diario. Más es ruido.
- **Compartir datos entre cuentas** — cerrado en sesión 1. Aislamiento estricto.
- **Coach humano externo conectado a la app** — fuera de scope; el atleta puede consultar a un profesional aparte si quiere, no integramos.
- **Marketplace de planes** — el coach genera el plan a medida; no hay catálogo prediseñado.
- **Auto-importación de comidas via foto en MVP** — buena idea, pero la calidad es difícil de garantizar; va a V2 con evals.
- **Comparativa con otros atletas o medias del mercado** — irrelevante para el objetivo personal y peligroso (puede demotivar).

---

## 9. Decisiones cerradas en esta sesión

> Sesión 2, fecha 2026-05-08.

- **Veredicto de progreso = semáforo (verde/ámbar/rojo) + texto del coach**. Sin score numérico, sin métrica única.
- **Onboarding profundo de 20–30 min** en formato entrevista con el coach, no formulario plano. Reanudable.
- **Recordatorio diario** si no hay registros del día (1 sola vez). Canal preferente PWA push opt-in, fallback email.
- **Modo lapso: ≥ 3 días sin registros** dispara flujo "ponme al día" con tono profesional y directo, sin reproche.
- **Cadencia mínima**: registro de comidas diario y peso semanal. El coach no puede hacer su trabajo bien por debajo de esto y lo dirá explícitamente al atleta.
- **Aislamiento estricto por cuenta** (heredado y reafirmado): no hay vista pareja, no hay comparativa entre atletas.

## 10. Decisiones abiertas

| Pregunta | Sesión que la cierra |
|---|---|
| Diseño concreto del semáforo y del panel compuesto en UI | 6 (frontend) |
| Canal final del recordatorio diario (PWA push vs email) y horario | 6 (frontend) + 8 (deployment) |
| ¿El onboarding es una sola entrevista cerrada o se ajusta cada N semanas? | 5 (agentes) |
| Umbrales numéricos exactos del semáforo (recovery, adherencia, tendencia) | 5 (agentes) — calibrar con evals |
| Persistencia y formato exacto de la "carpeta del atleta" producto del onboarding | 3 (data model) + 5 (agentes) |
| Política de retención de los días "no registrados" | 3 (data model) |
