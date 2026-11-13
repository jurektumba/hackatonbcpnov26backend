import type { JiraIssueRef, JiraTools } from "@hack/contracts";

const BASE = "https://ejemplo.atlassian.net/browse";

export function mockJira(): JiraTools {
  let next = 101;
  return {
    async createStory(spec) {
      if (spec.status !== "approved") throw new Error("La spec debe estar aprobada para crear la Historia");
      const key = `HACK-${next++}`;
      return { key, url: `${BASE}/${key}`, type: "Story" };
    },
    async createSubtasks(_story, tasks) {
      return tasks.map((): JiraIssueRef => {
        const key = `HACK-${next++}`;
        return { key, url: `${BASE}/${key}`, type: "Subtask" };
      });
    },
  };
}
