import type { JiraTools } from "@hack/contracts";

/**
 * TODO persona 3 — ver specs/003-jira-confluence.
 * Jira Cloud REST v3: POST {ATLASSIAN_BASE_URL}/rest/api/3/issue
 *   Auth: Basic base64(ATLASSIAN_EMAIL:ATLASSIAN_API_TOKEN)
 *   OJO: en v3 `description` va en Atlassian Document Format (ADF), no en texto plano.
 * Subtareas: issuetype "Subtask" (verificar el nombre exacto en el proyecto) + `parent: { key }`.
 */
export function realJira(): JiraTools {
  return {
    // TODO persona 3: GET /rest/api/3/project/search (proyectos con permiso CREATE_ISSUES).
    async listProjects() {
      throw new Error("realJira.listProjects no implementado (persona 3)");
    },
    // TODO persona 3: tablero del proyecto (GET /rest/agile/1.0/board?projectKeyOrId=KEY) y luego
    // GET /rest/agile/1.0/board/{id}/sprint?state=active. Para agregar al sprint: POST /rest/agile/1.0/sprint/{id}/issue.
    async getActiveSprint(_projectKey) {
      throw new Error("realJira.getActiveSprint no implementado (persona 3)");
    },
    async createStory(_spec, _plan) {
      throw new Error("realJira.createStory no implementado (persona 3)");
    },
    async createSubtasks(_story, _tasks) {
      throw new Error("realJira.createSubtasks no implementado (persona 3)");
    },
  };
}
