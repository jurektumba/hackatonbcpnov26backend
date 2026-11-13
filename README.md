# Hackatón BCP nov-26 — Backend

Agente e integraciones que llevan un requerimiento desde el prompt hasta el pase a producción:
spec (SDD) → Historia y subtareas en Jira → desarrollo con el Copilot coding agent → OCD en JSM.

- **Este repo:** backend (TypeScript, npm workspaces). **Fuente de verdad de los contratos.**
- **Frontend:** [`jurektumba/hackatonbcpnov26`](https://github.com/jurektumba/hackatonbcpnov26) (Next.js) — tiene una copia de `contracts/` en `lib/contracts/`.

Visión, decisiones de arquitectura, cronograma de 6 h y reglas: [`specs/000-contratos/spec.md`](specs/000-contratos/spec.md).

## Equipo y specs

| Persona | Rol | Spec | Repo / carpeta |
|---|---|---|---|
| 1 | Frontend web | `specs/001-web` (en el repo frontend) | frontend |
| 2 | Agente + **integrador** + dueño de contratos | [002-agente](specs/002-agente/spec.md) | `agent/`, `contracts/` |
| 3 | Jira Software + Confluence + caso de negocio | [003-jira-confluence](specs/003-jira-confluence/spec.md) | `tools/jira`, `tools/confluence` |
| 4 | OCD en JSM | [004-ocd](specs/004-ocd/spec.md) | `tools/jsm` |
| 5 | GitHub + coding agent + demo/deck | [005-github-dev](specs/005-github-dev/spec.md) | `tools/github`, `demo/` |

## Cronograma (6 horas)

| Hora | Qué |
|---|---|
| 0:00–0:30 | **H0** juntos: clonar ambos repos, instalar, `demo:mock`, revisión rápida de contratos |
| 0:30–2:30 | Construcción contra mocks (tareas `MUST`) |
| **2:30** | **C1** — frontend ↔ backend en modo `SCRIPTED`; contratos congelados |
| 2:40–4:30 | Integración real, tool por tool |
| **4:30** | **C2** — se decide qué va real y qué va mock en la demo |
| 4:30–5:15 | Pulido + plan B + video de respaldo |
| **5:15–6:00** | **Freeze**: solo ensayos y presentación |

## Arranque

Clona ambos repos **como carpetas hermanas** (el frontend copia los contratos desde aquí):

```bash
git clone https://github.com/jurektumba/hackatonbcpnov26backend.git
```

```bash
cd hackatonbcpnov26backend && npm install && cp .env.example .env && npm run demo:mock
```

Luego cambia a tu rama: `feature/p2-agente`, `feature/p3-jira`, `feature/p4-ocd` o `feature/p5-github`.

```bash
git switch feature/p2-agente
```

## Ramas (GitHub Flow)

- `main` siempre funciona y es lo que se presenta. Cada persona trabaja en su `feature/pX-*`.
- PR a `main` **mínimo cada hora** y obligatorio antes de C1 (2:30) y C2 (4:30); antes, `git pull origin main` en tu rama.
- Se mergea (squash) si `npm run typecheck && npm run demo:mock` pasa. Si el PR toca `contracts/`, lo aprueba la persona 2.
- Tags `c1` y `c2` en `main` como punto de retorno para la demo. Detalle: spec 000, sección 7.

`demo:mock` corre el flujo completo con mocks. Con `USE_MOCKS=false` usa las APIs reales: es la prueba de
humo en cada punto de integración.

## Levantar el agente (servidor para el frontend)

```bash
npm run agent
```

API HTTP + SSE en `http://localhost:4000` (contrato en `contracts/src/session.ts`). Lee `.env`:

- `AGENT_BRAIN=scripted` (default): guiones de los dos casos demo, sin LLM. Plan B garantizado.
- `AGENT_BRAIN=copilot`: GitHub Copilot SDK para descubrir y especificar (usa la sesión de `gh auth`, del Copilot CLI o
  `COPILOT_GITHUB_TOKEN`). Si no arranca, cae en el guionado y lo avisa.
- `USE_MOCKS` / `MOCK_<HERRAMIENTA>`: qué integraciones son reales.

En el frontend: `NEXT_PUBLIC_USE_MOCKS=false` y `NEXT_PUBLIC_AGENT_URL=http://localhost:4000` en `.env.local`.

## Cómo trabajar con tu IA

Dale como contexto **solo**: tu `specs/00X-*/spec.md` + `tasks.md`, la carpeta `contracts/` y
`.github/copilot-instructions.md`. Ve marcando tus tareas y haz commits pequeños.

## Estructura

```
contracts/          tipos, firmas de tools, API/eventos, fixtures del caso demo (FUENTE DE VERDAD)
tools/<servicio>/   index.ts (selector) · mock.ts · real.ts
agent/              servidor + orquestación (hoy: demo-mock.ts)
specs/              000 (compartida) y 002–005
demo/               guion, proceso OCD, material del pitch
```
