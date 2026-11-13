# Spec 005 — GitHub: desarrollo delegado, evidencias y demo

**Dueño:** persona 5 · **Carpeta:** `tools/github` (+ repo demo aparte) · **Repo:** backend
**Implementa:** `GitHubTools` de `contracts/src/tools.ts` · **Además:** guion de demo y deck

## Objetivo

Hacer realidad el "el agente también desarrolla" de forma confiable: la spec aprobada se convierte en un issue
que el **Copilot coding agent** implementa en un PR, y el pipeline produce las evidencias que alimentan el OCD.

## Parte A — Repo demo (un tercer repo, separado del backend)
- Repo `demo-cloud-function` con la **plantilla estándar de Cloud Function** (según el lineamiento sintético):
  `functions/<nombre>/src/index.ts`, logger JSON con correlation-id, config externa, tests con cobertura.
- Workflow `.github/workflows/ci.yml` con jobs separados (uno por `EvidenceKind`): `lint`, `unit-tests`,
  `coverage` (umbral 80%), `build`, `security-scan` (p. ej. `npm audit` o CodeQL).
- `.github/copilot-instructions.md` del repo demo con el lineamiento, para que el coding agent lo respete.
- Habilitar Copilot coding agent en el repo (verificar plan/créditos de la cuenta dueña).

## Parte B — Tools

### `createDevIssue(spec, plan, tasks, story)`
- Issue con título `"[REQ-001] <title>"` y cuerpo markdown: historia, criterios Gherkin, NFR, plan, componentes,
  tareas (checklist), link a la Historia de Jira, y la instrucción "Implementa siguiendo el lineamiento y crea una
  prueba por criterio de aceptación".
- Asignarlo al Copilot coding agent. **Investigar en H0** el método vigente por API (documentación de GitHub sobre
  asignar issues a Copilot; históricamente vía GraphQL con `suggestedActors` + `replaceActorsForAssignable`).

### `findPullRequest(issue)`
- Encontrar el PR abierto por Copilot vinculado al issue (timeline del issue / búsqueda). `null` si aún no existe.

### `collectEvidence(pr)`
- Check-runs del `headSha`; mapear cada job a `EvidenceKind`; `summary` legible (p. ej. "24/24 pruebas OK");
  `url` al run.

## Parte C — Demo y pitch
- **Grabar un video de respaldo** del coding agent resolviendo el issue (tarda minutos: en vivo se muestra un PR
  ya generado y el video acelerado).
- `demo/guion.md`: guion de 5 min minuto a minuto (problema → demo → impacto → roadmap), quién habla, plan B por paso.
- Deck: problema, solución, demo, caso de negocio (slide de persona 3), arquitectura, roadmap
  ("cómo entra al banco": cambiar proveedor LLM y Jira Data Center gracias a los contratos/tools).

## Recorte para 6 horas
- **El Copilot coding agent tarda minutos por ejecución:** asignar el primer issue de REQ-001 **a mano** antes de
  la 1:30, para tener un PR real y grabar el video temprano. La automatización por API es SHOULD.
- Plantilla mínima en el repo demo: handler + 1 test + CI con jobs `lint`, `unit-tests`, `build`
  (`coverage` y `security-scan` son COULD).
- **El pitch empieza a las 3:00 a más tardar**: es tan importante como el código.

## Criterios de éxito
- **1:30:** repo demo con CI verde e issue de REQ-001 asignado a Copilot (manual).
- **2:30 (C1):** PR de Copilot generado; `createDevIssue` real.
- **4:30 (C2):** `findPullRequest` y `collectEvidence` reales; `USE_MOCKS=false` en GitHub pasa en `demo:mock`.
- **5:15:** video de respaldo, guion y deck listos; 2 ensayos antes de las 6:00.
