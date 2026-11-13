import type { Evidence, GitHubTools } from "@hack/contracts";

const REPO = "equipo-hack/demo-cloud-function";

export function mockGitHub(): GitHubTools {
  return {
    async createDevIssue() {
      return { number: 12, url: `https://github.com/${REPO}/issues/12`, repo: REPO, assignedToCopilot: true };
    },
    async findPullRequest(issue) {
      return {
        number: issue.number + 1,
        url: `https://github.com/${REPO}/pull/${issue.number + 1}`,
        repo: REPO,
        status: "open",
        headSha: "a1b2c3d",
      };
    },
    async collectEvidence(pr) {
      const at = new Date().toISOString();
      const run = `https://github.com/${pr.repo}/actions/runs/9001`;
      const items: Evidence[] = [
        { kind: "lint", status: "passed", summary: "0 errores, 0 warnings", url: run, collectedAt: at },
        { kind: "unit-tests", status: "passed", summary: "24/24 pruebas OK", url: run, collectedAt: at },
        { kind: "coverage", status: "passed", summary: "Cobertura 86%", url: run, collectedAt: at },
        { kind: "build", status: "passed", summary: "Build OK", url: run, collectedAt: at },
        { kind: "security-scan", status: "passed", summary: "0 vulnerabilidades altas", url: run, collectedAt: at },
      ];
      return items;
    },
  };
}
