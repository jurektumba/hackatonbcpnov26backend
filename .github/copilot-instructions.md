# Instrucciones para Copilot — repo BACKEND

## Contexto del proyecto
Plataforma web donde un PO o desarrollador escribe un requerimiento, un agente lo convierte
en una especificación (Spec-Driven Development, formato inspirado en GitHub Spec Kit), y tras
la aprobación humana crea automáticamente: Historia + subtareas en Jira Software, issue para el
Copilot coding agent en GitHub, y el ticket OCD (One Click Deploy) en Jira Service Management.

Este repo es **el backend** (agente + integraciones). El frontend (Next.js) está en `jurektumba/hackatonbcpnov26`
y consume la API HTTP + SSE definida en `contracts/src/session.ts`; tiene una copia de `contracts/`.

## Reglas obligatorias
1. **`/contracts` es la fuente de verdad.** Importa tipos desde `@hack/contracts`. NO redefinas
   tipos que ya existen ahí. NO modifiques archivos de `/contracts`: si necesitas un cambio,
   detente y avisa al humano (lo aprueba la persona 2). Tras un cambio, avisar a persona 1 para `npm run sync:contracts`.
2. **Trabaja solo en tu carpeta** (indicada en tu spec en `specs/00X-*`). No toques carpetas de otros.
3. **Toda tool tiene versión `mock` y `real`.** La selección se hace con `USE_MOCKS` (default `true`).
   El mock debe devolver datos realistas y deterministas basados en `@hack/contracts/fixtures`.
4. **TypeScript estricto, ESM.** Nada de `any` salvo en el borde con APIs externas (y tipado de inmediato).
5. **Secretos solo por variables de entorno** (ver `.env.example`). Nunca hardcodear tokens.
6. **Idioma:** código e identificadores en inglés; textos visibles al usuario, en español.
7. **Antes de terminar una tarea:** `npm run typecheck` sin errores y `npm run demo:mock` sigue funcionando.
8. **No uses datos ni documentos reales del banco.** Todo es sintético.
9. **El agente nunca aprueba por un humano:** aprobar la spec, aprobar el PR y las transiciones OCD
   a `APROBACION` y `PRODUCCION` siempre son acciones humanas (`HUMAN_ONLY_OCD_STATES`).

## Comandos
- `npm install` — instala todo el monorepo (npm workspaces)
- `npm run typecheck` — verifica tipos de todos los paquetes
- `npm run demo:mock` — corre el flujo completo con mocks (spec → Jira → GitHub → OCD)
