/**
 * Flujo completo SIN LLM, solo encadenando las tools. Sirve para:
 *  1. Verificar que los contratos encajan (si esto corre, las piezas son compatibles).
 *  2. Prueba de humo en cada punto de integración (C1, C2): correr con USE_MOCKS=false
 *     a medida que cada persona termina su versión real.
 * Uso: npm run demo:mock
 */
import { HUMAN_ONLY_OCD_STATES, OCD_FLOW, type OcdTicket, type Spec } from "@hack/contracts";
import { DEMO_REQUIREMENT, DEMO_USER, demoPlan, demoSpec, demoTasks } from "@hack/contracts/fixtures";
import { createToolSet } from "./tools";

const log = (step: string, detail = "") => console.log(`\n▶ ${step}${detail ? `\n  ${detail}` : ""}`);

async function main() {
  const tools = createToolSet();
  console.log(`Modo: ${process.env.USE_MOCKS === "false" ? "REAL" : "MOCK"}`);

  log("1. Requerimiento", DEMO_REQUIREMENT);

  const guideline = await tools.confluence.getGuidelines(demoSpec.solutionType);
  log("2. Lineamiento aplicado", `${guideline.title} v${guideline.version} (${guideline.checklist.length} ítems)`);

  // En la app real, el LLM produce spec/plan/tareas a partir del requerimiento + lineamiento.
  const spec: Spec = { ...demoSpec, status: "approved", approvedBy: DEMO_USER, approvedAt: new Date().toISOString() };
  log("3. Spec aprobada", `${spec.id} — ${spec.acceptanceCriteria.length} criterios, ${demoTasks.length} tareas`);

  const story = await tools.jira.createStory(spec, demoPlan);
  const subtasks = await tools.jira.createSubtasks(story, demoTasks);
  log("4. Jira Software", `Historia ${story.key} + subtareas ${subtasks.map((s) => s.key).join(", ")}`);

  const devIssue = await tools.github.createDevIssue(spec, demoPlan, demoTasks, story);
  log("5. Issue para Copilot coding agent", devIssue.url);

  const pr = await tools.github.findPullRequest(devIssue);
  if (!pr) throw new Error("Aún no hay PR (en real: reintentar con polling)");
  const evidence = await tools.github.collectEvidence(pr);
  log("6. PR + evidencias", `${pr.url}\n  ${evidence.map((e) => `${e.kind}: ${e.status}`).join(" | ")}`);

  let ocd: OcdTicket = await tools.jsm.createOcd({
    spec,
    plan: demoPlan,
    story,
    pullRequest: pr,
    evidence,
    requestedBy: DEMO_USER,
  });
  log("7. OCD creado", `${ocd.key} en ${ocd.state}`);

  for (const to of OCD_FLOW.slice(1)) {
    const result = await tools.jsm.validateOcdTransition(ocd, to);
    const marks = result.checks.map((c) => `${c.passed ? "✓" : "✗"} ${c.id}`).join("  ");
    if (HUMAN_ONLY_OCD_STATES.includes(to)) {
      console.log(`  → ${to}: [${marks}] — requiere acción humana (el agente se detiene aquí)`);
      break;
    }
    ocd = await tools.jsm.transitionOcd(ocd, to);
    console.log(`  → ${to}: [${marks}]`);
  }

  log("Fin", `OCD ${ocd.key} listo para aprobación humana (calendarizado: ${ocd.scheduledFor ?? "—"})`);
}

main().catch((err) => {
  console.error("\n✗ Falló el flujo:", err instanceof Error ? err.message : err);
  process.exit(1);
});
