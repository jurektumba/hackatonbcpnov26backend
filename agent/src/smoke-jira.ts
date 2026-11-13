/**
 * Prueba de humo de Jira real a través de jira-backend.
 *   npm run smoke:jira            → solo lecturas (proyectos y sprint activo)
 *   npm run smoke:jira -- --crear → además crea 1 Historia + 2 subtareas de prueba (etiqueta "prueba-pase")
 * Requiere JIRA_GATEWAY_URL (y JIRA_GATEWAY_API_KEY si el servicio la exige).
 */
import type { JiraTarget, Spec } from "@hack/contracts";
import { demoPlan, demoTasks } from "@hack/contracts/fixtures";
import { realJira } from "@hack/tools-jira/real";

async function main() {
  const jira = realJira();
  const projectKey = process.env.JIRA_PROJECT_KEY ?? "GRUP";

  const projects = await jira.listProjects();
  console.log("Proyectos:", projects.map((p) => `${p.key} (${p.name})`).join(", ") || "ninguno");

  const project = projects.find((p) => p.key === projectKey);
  if (!project) throw new Error(`La cuenta no ve el proyecto ${projectKey}`);
  const sprint = await jira.getActiveSprint(project.key);
  console.log(`Sprint activo de ${project.key}:`, sprint ? `${sprint.name} (#${sprint.id})` : "ninguno → backlog");

  if (!process.argv.includes("--crear")) return;

  const target: JiraTarget = { project, sprint: sprint ?? "backlog" };
  const spec: Spec = {
    id: "REQ-PRUEBA",
    title: "[PRUEBA Pase] Historia de prueba de la integración (se puede eliminar)",
    solutionType: "web-app",
    summary: "Historia creada por la prueba de humo de Pase.",
    userStory: { asA: "equipo IntelliHack", iWant: "probar la integración con Jira", soThat: "confirmar que Pase crea historias" },
    acceptanceCriteria: [{ id: "AC-01", title: "Se crea", given: "la spec aprobada", when: "se aprueba", then: "existe la Historia" }],
    nonFunctional: [],
    outOfScope: [],
    openQuestions: [],
    jiraTarget: target,
    version: 1,
    status: "approved",
  };
  const story = await jira.createStory(spec, demoPlan);
  console.log("Historia:", story.key, story.url);
  const subtasks = await jira.createSubtasks(story, demoTasks.slice(0, 2));
  console.log("Subtareas:", subtasks.map((s) => s.key).join(", "));
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
