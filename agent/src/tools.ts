import type { ToolSet } from "@hack/contracts";
import { createConfluenceTools } from "@hack/tools-confluence";
import { createGitHubTools } from "@hack/tools-github";
import { createJiraTools } from "@hack/tools-jira";
import { createJsmTools } from "@hack/tools-jsm";

/** Punto único donde el agente obtiene sus tools (mock o real según USE_MOCKS). */
export function createToolSet(): ToolSet {
  return {
    confluence: createConfluenceTools(),
    jira: createJiraTools(),
    github: createGitHubTools(),
    jsm: createJsmTools(),
  };
}
