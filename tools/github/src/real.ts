import type { GitHubTools } from "@hack/contracts";

/**
 * TODO persona 5 — ver specs/005-github-dev.
 * - createDevIssue: crear issue en GITHUB_REPO con spec+plan+tareas en markdown y asignarlo al
 *   Copilot coding agent (verificar en la doc de GitHub el método vigente para asignar a Copilot por API).
 * - findPullRequest: buscar PR vinculado al issue (timeline del issue o búsqueda "linked:issue").
 * - collectEvidence: check-runs del headSha (GET /repos/{owner}/{repo}/commits/{sha}/check-runs),
 *   mapeando cada job del workflow a un EvidenceKind.
 */
export function realGitHub(): GitHubTools {
  return {
    async createDevIssue() {
      throw new Error("realGitHub.createDevIssue no implementado (persona 5)");
    },
    async findPullRequest() {
      throw new Error("realGitHub.findPullRequest no implementado (persona 5)");
    },
    async collectEvidence() {
      throw new Error("realGitHub.collectEvidence no implementado (persona 5)");
    },
  };
}
