import type { JsmTools } from "@hack/contracts";
import { mockJsm } from "./mock";
import { realJsm } from "./real";

export { buildChecklist } from "./checklist";

export function createJsmTools(): JsmTools {
  return process.env.USE_MOCKS === "false" ? realJsm() : mockJsm();
}
