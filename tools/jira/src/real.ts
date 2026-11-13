import type { JiraIssueRef, JiraProject, JiraSprint, JiraTools, Plan, Spec, Task } from "@hack/contracts";
import { gateway } from "./gateway";

/**
 * Jira real a través del servicio jurektumba/jira-backend (.NET), que guarda las credenciales de Atlassian.
 *   JIRA_GATEWAY_URL      URL del servicio (ej. http://localhost:8080)
 *   JIRA_GATEWAY_API_KEY  clave compartida (header X-Api-Key), si el servicio la exige
 *   JIRA_STORY_TYPE       tipo de issue para la Historia (en GRUP: "Historia")
 */
const STORY_TYPE = () => process.env.JIRA_STORY_TYPE ?? "Historia";

/** Descripción de la Historia en texto plano (el servicio la convierte a ADF, una línea por párrafo). */
export function storyDescription(spec: Spec, plan: Plan): string {
  const lines = [
    `Como ${spec.userStory.asA}, quiero ${spec.userStory.iWant}, para ${spec.userStory.soThat}.`,
    "",
    spec.summary,
    "",
    "CRITERIOS DE ACEPTACIÓN",
    ...spec.acceptanceCriteria.flatMap((ac) => [
      `${ac.id} · ${ac.title}`,
      `Dado ${ac.given}`,
      `Cuando ${ac.when}`,
      `Entonces ${ac.then}`,
      "",
    ]),
    "REQUISITOS NO FUNCIONALES",
    ...spec.nonFunctional.map((r) => `• ${r}`),
    "",
  ];
  if (spec.outOfScope.length) lines.push("FUERA DE ALCANCE", ...spec.outOfScope.map((r) => `• ${r}`), "");
  lines.push("PLAN DE REVERSIÓN", plan.rollbackPlan, "");
  if (plan.guidelineRefs.length) lines.push("LINEAMIENTOS APLICADOS", ...plan.guidelineRefs, "");
  lines.push(`Generado por Lanzalo a partir de la especificación ${spec.id} v${spec.version}.`);
  return lines.join("\n");
}

const taskDescription = (t: Task) =>
  [t.description, t.acceptanceCriteriaIds.length ? `Cubre: ${t.acceptanceCriteriaIds.join(", ")}` : ""]
    .filter(Boolean)
    .join("\n");

export function realJira(): JiraTools {
  return {
    listProjects() {
      return gateway<JiraProject[]>("GET", "/api/projects");
    },

    async getActiveSprint(projectKey) {
      const sprint = await gateway<{ id: number; name: string } | null>(
        "GET",
        `/api/projects/${encodeURIComponent(projectKey)}/active-sprint`,
      );
      return sprint ? ({ id: sprint.id, name: sprint.name, state: "active" } satisfies JiraSprint) : null;
    },

    async createStory(spec, plan) {
      if (spec.status !== "approved") throw new Error("La spec debe estar aprobada para crear la Historia");
      if (!spec.jiraTarget) throw new Error("La spec no tiene proyecto de Jira de destino");
      const { project, sprint } = spec.jiraTarget;
      const created = await gateway<{ key: string; url: string }>("POST", "/api/tickets", {
        summary: `[${spec.id}] ${spec.title}`.slice(0, 250),
        description: storyDescription(spec, plan),
        issueType: STORY_TYPE(),
        projectKey: project.key,
        sprintId: sprint === "backlog" ? undefined : sprint.id,
        labels: ["lanzalo", spec.id],
      });
      return { key: created.key, url: created.url, type: "Story" } satisfies JiraIssueRef;
    },

    async createSubtasks(story, tasks) {
      if (tasks.length === 0) return [];
      const created = await gateway<{ key: string; url: string }[]>(
        "POST",
        `/api/tickets/${encodeURIComponent(story.key)}/subtasks`,
        {
          subtasks: tasks.map((t) => ({ summary: `${t.id} · ${t.title}`.slice(0, 250), description: taskDescription(t) })),
          labels: ["lanzalo"],
        },
      );
      return created.map((c) => ({ key: c.key, url: c.url, type: "Subtask" }) satisfies JiraIssueRef);
    },
  };
}
