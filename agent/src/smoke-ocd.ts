/**
 * Prueba de punta a punta con Jira real (Historia + subtareas en GRUP y OCD en el proyecto OCD).
 * GitHub sigue simulado (PR y evidencias del mock).
 *   npm run smoke:ocd
 * Requiere JIRA_GATEWAY_URL (y JIRA_GATEWAY_API_KEY si el servicio la exige). Crea issues reales de prueba.
 */
import { HUMAN_ONLY_OCD_STATES, OCD_FLOW, type JiraTarget, type OcdTicket, type Spec } from "@hack/contracts";
import { demoPlan, demoSpec, demoTasks } from "@hack/contracts/fixtures";
import { mockGitHub } from "@hack/tools-github/mock";
import { realJira } from "@hack/tools-jira/real";
import { realJsm } from "@hack/tools-jsm/real";

async function main() {
  const jira = realJira();
  const jsm = realJsm();
  const github = mockGitHub();

  const projectKey = process.env.JIRA_PROJECT_KEY ?? "GRUP";
  const project = (await jira.listProjects()).find((p) => p.key === projectKey);
  if (!project) throw new Error(`La cuenta no ve el proyecto ${projectKey}`);
  const target: JiraTarget = { project, sprint: (await jira.getActiveSprint(project.key)) ?? "backlog" };

  const spec: Spec = {
    ...demoSpec,
    id: "REQ-PRUEBA",
    title: "[PRUEBA Pase] Flujo OCD de punta a punta (se puede eliminar)",
    status: "approved",
    approvedBy: "prueba@pase",
    approvedAt: new Date().toISOString(),
    jiraTarget: target,
  };

  const story = await jira.createStory(spec, demoPlan);
  const subtasks = await jira.createSubtasks(story, demoTasks.slice(0, 2));
  console.log(`Historia ${story.key} + subtareas ${subtasks.map((s) => s.key).join(", ")}`);

  const issue = await github.createDevIssue(spec, demoPlan, demoTasks, story);
  const pr = await github.findPullRequest(issue);
  if (!pr) throw new Error("sin PR");
  const evidence = await github.collectEvidence(pr);

  let ocd: OcdTicket = await jsm.createOcd({ spec, plan: demoPlan, story, pullRequest: pr, evidence, requestedBy: "prueba@pase" });
  console.log(`OCD ${ocd.key} creado en ${ocd.state} → ${ocd.url}`);

  for (const to of OCD_FLOW.slice(1)) {
    const human = HUMAN_ONLY_OCD_STATES.includes(to);
    ocd = await jsm.transitionOcd(ocd, to, human ? "prueba@pase" : undefined);
    console.log(`  → ${to}${human ? " (acción humana simulada)" : ""}${ocd.scheduledFor ? `, fecha de pase ${ocd.scheduledFor.slice(0, 10)}` : ""}`);
  }
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
