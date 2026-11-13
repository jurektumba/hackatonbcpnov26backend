import type { ConfluenceTools } from "@hack/contracts";
import { mockConfluence } from "./mock";
import { realConfluence } from "./real";

export function createConfluenceTools(): ConfluenceTools {
  return process.env.USE_MOCKS === "false" && process.env.MOCK_CONFLUENCE !== "true" ? realConfluence() : mockConfluence();
}
