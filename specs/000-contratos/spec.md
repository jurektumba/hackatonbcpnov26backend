# Spec 000 — Contratos compartidos y arquitectura

**Dueños:** los 5 (se revisa en H0). **Mantenedor:** persona 2.
**Código:** `contracts/` y `agent/src/demo-mock.ts` en el repo **backend**.

> **Fuente de verdad:** esta spec y `contracts/` viven en el repo backend. El frontend tiene una copia de ambos
> (`specs/000-contratos/`, `lib/contracts/`) que se actualiza con `npm run sync:contracts`.

## 1. Qué construimos (visión de producto)

Una web donde un PO o desarrollador escribe un requerimiento en lenguaje natural. Un agente:

1. **Descubre:** hace preguntas aclaratorias y consulta los lineamientos de Confluence.
2. **Especifica (SDD):** produce `spec` (qué/por qué), `plan` (cómo) y `tasks` (desglose) en formato inspirado en GitHub Spec Kit.
3. **Espera aprobación humana** de la spec (editable).
4. **Crea en Jira Software** la Historia (descripción + criterios Gherkin) y una subtarea por cada tarea.
5. **Delega el desarrollo** creando un issue en GitHub asignado al Copilot coding agent, que abre un PR.
6. **Recolecta evidencias** (checks de GitHub Actions) del PR.
7. **Crea el OCD en JSM** prellenado y lo avanza por el flujo validando el checklist en cada paso,
   hasta donde se requiere un humano (`APROBACION`, `PRODUCCION`).

**Mensaje del pitch:** la spec aprobada es la fuente única de verdad; todo lo demás se deriva de ella,
con trazabilidad de punta a punta y sin re-escribir la misma información 5 veces.

## 2. Decisiones de arquitectura

| # | Decisión | Motivo |
|---|---|---|
| D1 | **Dos repos:** frontend [`jurektumba/hackatonbcpnov26`](https://github.com/jurektumba/hackatonbcpnov26) (Next.js) y backend [`hybridcloudcompany/hackatonbcpnov26backend`](https://github.com/hybridcloudcompany/hackatonbcpnov26backend) (TypeScript, npm workspaces) | Decisión de la organización de la hackatón; cada repo con su `npm install` |
| D2 | `contracts/` del backend es la única fuente de tipos; el frontend tiene una **copia** en `lib/contracts/` sincronizada con `npm run sync:contracts` (repos clonados como carpetas hermanas) | 5 IAs trabajando en paralelo divergen si no hay contrato fijo; copiar es más simple que publicar un paquete en 6 h |
| D3 | Cada tool tiene `mock` + `real`, selector `USE_MOCKS` (default `true`) | Nadie bloquea a nadie; la demo tiene plan B si falla una API |
| D4 | **El LLM solo actúa en DISCOVERY y SPEC_DRAFT.** Tras la aprobación, el pipeline es **código determinista** (como `demo-mock.ts`) | Confiabilidad en la demo y auditabilidad: el LLM no decide crear tickets por su cuenta |
| D5 | El LLM devuelve la spec llamando a una tool estructurada (`propose_spec`), no como texto libre | Garantiza que la spec cumple el tipo `Spec` |
| D6 | Backend ↔ frontend por HTTP + SSE (`contracts/src/session.ts`), CORS abierto en el backend | Simple, streaming del chat y eventos de progreso |
| D7 | Motor LLM: GitHub Copilot SDK (plan B: Copilot CLI en modo no interactivo) | Usa los créditos de Copilot asignados |
| D8 | Humanos aprueban: spec, PR, OCD→`APROBACION`/`PRODUCCION` | Segregación de funciones; argumento clave ante el jurado |
| D9 | Sesiones en memoria (Map) para la hackatón | Sin base de datos = menos piezas que fallen |

## 3. Contratos (resumen — el detalle está en el código)

- `contracts/src/domain.ts` — `Spec`, `Plan`, `Task`, `Guideline`, `JiraIssueRef`, `DevIssueRef`,
  `PullRequestRef`, `Evidence`, `OcdTicket`, `OCD_FLOW`, `HUMAN_ONLY_OCD_STATES`, `ValidationResult`.
- `contracts/src/tools.ts` — `ConfluenceTools`, `JiraTools`, `GitHubTools`, `JsmTools`, `ToolSet`.
- `contracts/src/session.ts` — `Session`, `SessionPhase`, API HTTP y eventos SSE `AgentEvent`.
- `contracts/src/fixtures.ts` — **caso demo único** (REQ-001, alerta por límite de transacciones).

## 4. Reglas de cambio de contratos

1. Nadie edita `/contracts` salvo la persona 2.
2. Para pedir un cambio: mensaje al grupo con *qué* y *por qué*. Persona 2 decide en < 15 min.
3. Cambios **aditivos** (campo opcional nuevo) se aprueban casi siempre; cambios que rompen, solo antes de C1.
4. Tras cada cambio: `npm run typecheck && npm run demo:mock` en verde en el backend, push, y la persona 1 corre
   `npm run sync:contracts` en el frontend.
5. **Con 6 h: después de las 2:30 los contratos quedan congelados.** Solo se permiten campos opcionales nuevos.

## 5. Cronograma — hackatón de 6 horas

Con 6 h no hay margen: **todo lo marcado MUST debe funcionar con mocks a las 2:30**, y lo real se integra
después. Si algo real no está a las 4:30, **se presenta con su mock** y se dice abiertamente.

| Hora | Hito | Qué pasa | Criterio de salida |
|---|---|---|---|
| 0:00–0:30 | **H0** (los 5 juntos) | Clonar, `npm install`, `demo:mock`, revisión **rápida** de contratos (15 min máx.), sitio Atlassian | Todos con `demo:mock` en verde y su rama creada |
| 0:30–2:30 | Construcción | Cada uno contra mocks | Las tareas MUST de cada spec listas |
| **2:30** | **C1** (10 min) | Demo interna de cada pieza | Web + agente conectados en modo `SCRIPTED` |
| 2:40–4:30 | Integración | Reemplazar mocks por real, uno por uno | `USE_MOCKS=false npm run demo:mock` pasa con lo que esté listo |
| **4:30** | **C2** (10 min) | Flujo completo desde la web | Decidir qué va real y qué va mock en la demo |
| 4:30–5:15 | Pulido | UI, plan B, video de respaldo | — |
| **5:15–6:00** | **Freeze** | Solo ensayos (mín. 2) y presentación | Nada de código nuevo |

**Prioridades en cada `tasks.md`:** `MUST` = sin esto no hay demo · `SHOULD` = la hace convincente · `COULD` = solo si sobra tiempo.

## 6. Agenda de H0 (30 min, cronometrados)

- [ ] (0:00) Persona 3 crea el sitio Atlassian Cloud Free y comparte la invitación — **en paralelo** con lo demás.
- [ ] (0:00) Todos: clonar **ambos repos como carpetas hermanas**, `npm install` en el que les toca, `npm run demo:mock` en el backend.
- [ ] (0:05) Acordar la estrategia de ramas (pendiente de definir por el equipo).
- [ ] (0:10) Revisión de `contracts/src/*.ts` y del flujo OCD: **solo cambios que bloqueen a alguien**.
- [ ] (0:25) Cada uno abre su spec con su IA y arranca. Persona 5 lanza ya la consulta del Copilot coding agent.
