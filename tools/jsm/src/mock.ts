import { HUMAN_ONLY_OCD_STATES, buildApprovals, type JsmTools, type OcdTicket } from "@hack/contracts";
import { applyApproval, buildChecklist } from "./checklist";

const BASE = "https://ejemplo.atlassian.net/servicedesk/customer/portal/1";

export function mockJsm(): JsmTools {
  let next = 501;
  return {
    async createOcd(input) {
      const key = `OCD-${next++}`;
      return {
        key,
        url: `${BASE}/${key}`,
        state: "VALIDACION",
        summary: `[OCD] ${input.spec.id} — ${input.spec.title}`,
        components: input.plan.components.map((c) => c.name),
        version: `1.0.0+${input.pullRequest.headSha}`,
        rollbackPlan: input.plan.rollbackPlan,
        storyKey: input.story.key,
        prUrl: input.pullRequest.url,
        evidence: input.evidence,
        approvals: buildApprovals(input.spec),
      };
    },
    async approveOcd(ocd, role, approvedBy) {
      return applyApproval(ocd, role, approvedBy);
    },
    async validateOcdTransition(ocd, to) {
      return buildChecklist(ocd, to);
    },
    async transitionOcd(ocd, to, actor) {
      if (HUMAN_ONLY_OCD_STATES.includes(to) && !actor) {
        throw new Error(`La transición a ${to} la debe hacer una persona (falta actor)`);
      }
      const result = buildChecklist(ocd, to);
      if (!result.ok) {
        const failed = result.checks.filter((c) => !c.passed).map((c) => c.id).join(", ");
        throw new Error(`Transición ${ocd.state} → ${to} rechazada: ${failed}`);
      }
      const updated: OcdTicket = { ...ocd, state: to };
      if (to === "CALENDARIZACION" && !updated.scheduledFor) {
        updated.scheduledFor = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
      }
      return updated;
    },
  };
}
