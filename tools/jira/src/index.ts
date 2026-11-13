import type { JiraTools } from "@hack/contracts";
import { mockJira } from "./mock";
import { realJira } from "./real";

export function createJiraTools(): JiraTools {
  return process.env.USE_MOCKS === "false" && process.env.MOCK_JIRA !== "true" ? realJira() : mockJira();
}
