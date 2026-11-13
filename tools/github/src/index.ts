import type { GitHubTools } from "@hack/contracts";
import { mockGitHub } from "./mock";
import { realGitHub } from "./real";

export function createGitHubTools(): GitHubTools {
  return process.env.USE_MOCKS === "false" && process.env.MOCK_GITHUB !== "true" ? realGitHub() : mockGitHub();
}
