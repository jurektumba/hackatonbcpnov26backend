import { mentionsSecurity, type ConfluenceTools } from "@hack/contracts";
import { demoGuidelines, demoSecurityGuideline } from "@hack/contracts/fixtures";

export function mockConfluence(): ConfluenceTools {
  return {
    async getGuidelines(solutionType) {
      return demoGuidelines[solutionType];
    },
    async findGuidelines(requirement, solutionType) {
      const found = [demoGuidelines[solutionType]];
      if (mentionsSecurity(requirement)) found.push(demoSecurityGuideline);
      return found;
    },
  };
}
