import type { ConfluenceTools } from "@hack/contracts";
import { demoGuidelines } from "@hack/contracts/fixtures";

export function mockConfluence(): ConfluenceTools {
  return {
    async getGuidelines(solutionType) {
      return demoGuidelines[solutionType];
    },
  };
}
