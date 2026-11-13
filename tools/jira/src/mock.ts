import type { JiraIssueRef, JiraProject, JiraTools } from "@hack/contracts";

const BASE = "https://ejemplo.atlassian.net/browse";

/** Proyectos ficticios para la demo. */
export const MOCK_PROJECTS: JiraProject[] = [
  { key: "SQSDT", name: "SQ Service Desk Transform" },
  { key: "CDIG", name: "Canales Digitales" },
  { key: "PAGT", name: "Pagos y Transferencias" },
  { key: "SEGAP", name: "Seguridad de Aplicaciones" },
];

export function mockJira(): JiraTools {
  let next = 101;
  return {
    async listProjects() {
      return MOCK_PROJECTS;
    },
    async getActiveSprint(projectKey) {
      // PAGT no tiene sprint activo: sirve para probar el caso "backlog".
      if (projectKey === "PAGT") return null;
      return { id: 24, name: `${projectKey} Sprint 24`, state: "active" };
    },
    async createStory(spec) {
      if (spec.status !== "approved") throw new Error("La spec debe estar aprobada para crear la Historia");
      if (!spec.jiraTarget) throw new Error("La spec no tiene proyecto de Jira de destino");
      const key = `${spec.jiraTarget.project.key}-${next++}`;
      return { key, url: `${BASE}/${key}`, type: "Story" };
    },
    async createSubtasks(story, tasks) {
      const prefix = story.key.split("-")[0];
      return tasks.map((): JiraIssueRef => {
        const key = `${prefix}-${next++}`;
        return { key, url: `${BASE}/${key}`, type: "Subtask" };
      });
    },
  };
}
