# Spec 002 — Agente (backend + orquestación) e integración

**Dueño:** persona 2 (también **integrador** y dueño de `/contracts`) · **Carpeta:** `agent` · **Repo:** backend
**Expone:** API HTTP + SSE de `contracts/src/session.ts` · **Usa:** `ToolSet` vía `agent/src/tools.ts`

## Objetivo

Convertir un requerimiento en lenguaje natural en una `Spec` + `Plan` + `Task[]` de calidad mediante
conversación, y tras la aprobación humana ejecutar el pipeline determinista de integraciones.

## Comportamiento por fase (`SessionPhase`)

| Fase | Quién actúa | Qué pasa |
|---|---|---|
| `DISCOVERY` | LLM | Llama `getGuidelines(solutionType)`. Hace **1 ronda** (máx. 2) de preguntas aclaratorias (alcance, integraciones, datos sensibles, volumen, reversión). En la demo no hay tiempo para más. |
| `SPEC_DRAFT` | LLM + humano | El LLM llama la tool interna `propose_spec({spec, plan, tasks})`. El humano puede editar o pedir cambios por chat. |
| `SPEC_APPROVED` | Código | Al recibir `POST /approve`: `status="approved"`, `approvedBy`, `approvedAt`. Inicia pipeline. |
| `JIRA_CREATED` | Código | `createStory` + `createSubtasks`. |
| `DEV_IN_PROGRESS` | Código | `createDevIssue`; luego polling de `findPullRequest` cada 30 s (en mock, inmediato). |
| `PR_READY` | Código | `collectEvidence`. |
| `OCD_IN_PROGRESS` | Código + humano | `createOcd` y transiciones automáticas hasta antes de `HUMAN_ONLY_OCD_STATES`. |
| `DONE` | — | OCD en `PRODUCCION`. |

Cada paso emite `tool.started`/`tool.finished`, `phase.changed` y `trace.added`.

## Requisitos funcionales

- FR-01 Implementar todos los endpoints de `contracts/src/session.ts` (Fastify o Express, CORS abierto a la web).
- FR-02 SSE: `GET /sessions/:id/events` reenvía `AgentEvent` en vivo; al conectar, envía el estado actual.
- FR-03 Integración con **GitHub Copilot SDK**: sesión de agente con system prompt por fase, streaming de texto
  a `message.delta`, y tools propias: `get_guidelines` y `propose_spec`.
- FR-04 `propose_spec` valida el payload con **zod** (esquemas derivados de los tipos de `/contracts`);
  si es inválido, devuelve el error al LLM para que corrija.
- FR-05 El LLM **no** tiene acceso a tools de Jira/GitHub/JSM. Solo el pipeline (código) las usa (decisión D4).
- FR-06 El pipeline post-aprobación reutiliza la lógica de `src/demo-mock.ts` (extraerla a `src/pipeline.ts`).
- FR-07 Errores de tools: emitir `error` + `tool.finished(ok=false)`, dejar la sesión en su fase y permitir
  reintentar con `POST /sessions/:id/approve` (idempotente: no recrear lo ya creado).
- FR-08 Rechazar `/ocd/transition` a estados `HUMAN_ONLY_OCD_STATES` sin `actor`.

## Prompts (versionar en `agent/src/prompts/`)
- **discovery.md:** rol de analista de requerimientos bancarios; reglas: preguntar antes de asumir, preguntar por
  datos sensibles y por reversión, máximo 3 preguntas por ronda, en español.
- **spec.md:** generar criterios en Gherkin verificables, NFR alineados al checklist del lineamiento,
  tareas pequeñas (≤ 4 h) cada una ligada a criterios, plan de reversión obligatorio.
- Few-shot: usar `demoSpec`/`demoPlan`/`demoTasks` de los fixtures como ejemplo de salida.

## Riesgos y plan B
- **Copilot SDK:** está en technical preview desde inicios de 2026. **Lo primero en H0:** un "hola mundo" con una
  tool custom. Verificar el nombre del paquete, la autenticación con la cuenta de Copilot y el consumo de premium requests.
  - Plan B 1: invocar Copilot CLI en modo no interactivo desde el backend.
  - Plan B 2: modo `SCRIPTED` que devuelve las preguntas y la spec de los fixtures (la demo nunca se cae).
- **Consumo de créditos:** usar mocks y `SCRIPTED` para desarrollo de UI; LLM real solo para probar prompts.

## Recorte para 6 horas — orden estricto
1. **Primero el modo `SCRIPTED`** (sin LLM, con fixtures) + API + SSE. Debe estar a la **1:30** para que la web
   pueda conectarse. Es también el plan B de la demo.
2. **Spike del Copilot SDK con time-box de 45 min** (en paralelo mental, después del punto 1). Si a los 45 min no
   hay una tool custom respondiendo, se pasa a Copilot CLI en modo no interactivo; si tampoco, la demo usa
   `SCRIPTED` para el descubrimiento y se explica en el pitch.
3. Sin zod si aprieta el tiempo: validación manual de campos obligatorios.
4. Sin idempotencia sofisticada: si el pipeline falla, se reinicia la sesión.

## Criterios de éxito
- **1:30:** API + SSE + `SCRIPTED` corriendo; persona 1 puede conectarse.
- **2:30 (C1):** web ↔ agente en `SCRIPTED`; decisión tomada sobre Copilot SDK / CLI.
- **4:30 (C2):** el LLM genera la spec de REQ-001 y el pipeline usa las tools reales que estén listas.
- **Integrador:** en C1 y C2 correr `USE_MOCKS=false npm run demo:mock` y decidir qué va real y qué mock.
