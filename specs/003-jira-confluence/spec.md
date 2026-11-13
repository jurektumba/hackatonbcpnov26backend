# Spec 003 — Jira Software + Confluence, y caso de negocio

**Dueño:** persona 3 · **Carpetas:** `tools/jira`, `tools/confluence` · **Repo:** backend
**Implementa:** `JiraTools`, `ConfluenceTools` de `contracts/src/tools.ts`

## Objetivo

Eliminar la redacción manual de Historias y la creación de subtareas, y darle al agente acceso a los
lineamientos de desarrollo. Además, **construir el caso de negocio con números reales** para el pitch.

## Parte A — Setup Atlassian Cloud (H0, compartido con todo el equipo)
- Sitio Atlassian Cloud plan Free (Jira Software + JSM + Confluence) e invitar a los 5.
- Proyecto Jira Software Scrum, key `HACK`, con tipos Story y Subtask.
- Espacio Confluence `LIN` con **2 páginas de lineamientos sintéticas** (no copiar las del banco):
  "Estándar Cloud Function" y "Estándar Web App", usando el contenido de `demoGuidelines` como base,
  cada una con label `lineamiento-<tipo>` y una sección **"Checklist"** con viñetas.
- API token de Atlassian → `.env` de quien lo necesite (personas 2, 3, 4).

## Parte B — Tools

> **Implementación actual:** las credenciales de Atlassian viven en el servicio .NET
> [`jurektumba/jira-backend`](https://github.com/jurektumba/jira-backend). `tools/jira/src/real.ts` lo llama por HTTP
> (`JIRA_GATEWAY_URL`, `JIRA_GATEWAY_API_KEY`). Prueba: `npm run smoke:jira` (lecturas) o `-- --crear`.
> Proyecto real: **GRUP (Grupo009)** en `intellihack.atlassian.net`; tipos `Historia` y `Subtask`.

### `getGuidelines(solutionType)`
- Busca por label `lineamiento-<solutionType>` en `CONFLUENCE_SPACE_KEY` (CQL).
- Devuelve `Guideline`: título, URL, versión (número de versión de la página), contenido en markdown
  (convertir storage format → markdown; una conversión simple de HTML basta) y `checklist` (viñetas bajo "Checklist").

### `createStory(spec, plan)`
- Falla si `spec.status !== "approved"`.
- Summary: `"[REQ-001] <title>"`. Descripción en **ADF** (Jira Cloud REST v3) con secciones:
  Historia de usuario · Contexto · Criterios de aceptación (Gherkin, uno por bloque) · Requisitos no funcionales ·
  Fuera de alcance · Lineamientos aplicados (links) · "Generado por el agente a partir de la spec v{version}".
- Label `generado-por-agente`.

### `listProjects()` y `getActiveSprint(projectKey)`
- Proyectos donde el usuario puede crear issues (`/rest/api/3/project/search`).
- Sprint activo del tablero del proyecto (`/rest/agile/1.0/board?projectKeyOrId=…` → `/board/{id}/sprint?state=active`); `null` si no hay.
- `createStory` usa `spec.jiraTarget.project.key`; si `sprint` no es `"backlog"`, mover la Historia al sprint
  (`POST /rest/agile/1.0/sprint/{id}/issue`).

### `createSubtasks(story, tasks)`
- Una subtarea por `Task`, en orden. Summary: `"T-01 · <title>"`. Descripción con criterios cubiertos.
- Si existe campo de estimación, usar `estimateHours`.

## Parte C — Caso de negocio (para el pitch, con persona 5)
- **A las 0:30**, mensaje rápido (chat del equipo / colegas) a 5+ desarrolladores/PO con 3 preguntas: minutos por
  requerimiento en (a) Historia + criterios + subtareas, (b) llenar OCD, (c) rehacer OCD rechazados.
- Calcular: `ahorro_horas_mes = Σ(minutos ahorrados) × requerimientos/mes × devs / 60`.
- 1 slide con la fórmula, los datos y los supuestos explícitos. Si no llegan respuestas a las 3:30, usar el propio
  equipo como muestra y decirlo. **No inventar cifras.**

## Recorte para 6 horas
- **Confluence real es COULD:** el mock (`demoGuidelines`) basta para la demo. Prioridad absoluta: Jira real.
- Descripción en ADF mínima: párrafos y listas, sin formato elaborado.

## Criterios de éxito
- **0:30:** sitio Atlassian creado y equipo invitado; consulta de tiempos enviada.
- **2:30 (C1):** `createStory` real funcionando contra el sitio.
- **4:30 (C2):** `createSubtasks` real; `USE_MOCKS=false` en Jira pasa en `demo:mock`.
- **5:00:** slide de caso de negocio entregada a persona 5.
