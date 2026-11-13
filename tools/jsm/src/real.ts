import { HUMAN_ONLY_OCD_STATES, type JsmTools, type OcdInput, type OcdState, type OcdTicket, type ValidationResult } from "@hack/contracts";
import { gateway } from "@hack/tools-jira/gateway";
import { buildChecklist } from "./checklist";

/**
 * Tickets OCD reales. En esta hackatón el OCD vive en un proyecto de **Jira Software** (no JSM),
 * así que se usa el mismo servicio jira-backend que las historias.
 *   OCD_PROJECT_KEY   proyecto de los OCD (default "OCD")
 *   OCD_ISSUE_TYPE    tipo de issue (default "OCD")
 * El flujo del tipo OCD en Jira tiene un estado por cada OcdState (ver JIRA_STATUS).
 */

/** Nombre del estado en Jira para cada estado del flujo de Pase. */
export const JIRA_STATUS: Record<OcdState, string> = {
  VALIDACION: "Validación",
  CONGELAMIENTO: "Congelamiento",
  REVERSION_CONGELAMIENTO: "Reversión de congelamiento",
  RECONGELAMIENTO: "Recongelamiento",
  CALENDARIZACION: "Calendarización",
  APROBACION: "Aprobación",
  PRODUCCION: "Producción",
};

/** Días entre la calendarización y la fecha de pase propuesta. */
const SCHEDULE_DAYS = 2;

export function ocdDescription(input: OcdInput): string {
  const { spec, plan, story, pullRequest, evidence, requestedBy } = input;
  return [
    `Pase a producción de ${spec.id} — ${spec.title}`,
    `Solicitado por: ${requestedBy}`,
    "",
    "TRAZABILIDAD",
    `Historia: ${story.key} (${story.url})`,
    `Pull request: #${pullRequest.number} (${pullRequest.url})`,
    `Versión: ${pullRequest.headSha}`,
    "",
    "COMPONENTES",
    ...plan.components.map((c) => `• ${c.name} (${c.repoPath})`),
    "",
    "EVIDENCIAS DEL PIPELINE",
    ...evidence.map((e) => `• ${e.kind}: ${e.status === "passed" ? "OK" : "FALLÓ"} — ${e.summary} (${e.url})`),
    "",
    "PLAN DE REVERSIÓN",
    plan.rollbackPlan,
    "",
    "Generado por Pase. Las transiciones a Aprobación y Producción las hace una persona.",
  ].join("\n");
}

function checklistComment(to: OcdState, result: ValidationResult, actor?: string): string {
  return [
    `Pase: checklist para pasar a ${JIRA_STATUS[to]}${actor ? ` (acción de ${actor})` : " (agente)"}`,
    ...result.checks.map((c) => `${c.passed ? "✓" : "✗"} ${c.description}${c.detail ? `: ${c.detail}` : ""}`),
  ].join("\n");
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function realJsm(): JsmTools {
  const projectKey = () => process.env.OCD_PROJECT_KEY ?? "OCD";
  const issueType = () => process.env.OCD_ISSUE_TYPE ?? "OCD";

  return {
    async createOcd(input) {
      const { spec, plan, story, pullRequest, evidence } = input;
      const created = await gateway<{ key: string; url: string }>("POST", "/api/tickets", {
        summary: `[OCD] ${spec.id} — ${spec.title}`.slice(0, 250),
        description: ocdDescription(input),
        issueType: issueType(),
        projectKey: projectKey(),
        labels: ["pase", spec.id],
        relatesTo: story.key,
        initialStatus: JIRA_STATUS.VALIDACION,
      });
      return {
        key: created.key,
        url: created.url,
        state: "VALIDACION",
        summary: `[OCD] ${spec.id} — ${spec.title}`,
        components: plan.components.map((c) => c.name),
        version: pullRequest.headSha,
        rollbackPlan: plan.rollbackPlan,
        storyKey: story.key,
        prUrl: pullRequest.url,
        evidence,
      } satisfies OcdTicket;
    },

    async validateOcdTransition(ocd, to) {
      return buildChecklist(ocd, to);
    },

    async transitionOcd(ocd, to, actor) {
      if (HUMAN_ONLY_OCD_STATES.includes(to) && !actor) {
        throw new Error(`La transición a ${JIRA_STATUS[to]} la debe hacer una persona (falta actor)`);
      }
      const result = buildChecklist(ocd, to);
      if (!result.ok) {
        const failed = result.checks.filter((c) => !c.passed).map((c) => c.id).join(", ");
        throw new Error(`Transición ${ocd.state} → ${to} rechazada: ${failed}`);
      }
      const key = encodeURIComponent(ocd.key);
      const updated: OcdTicket = { ...ocd, state: to };

      // Al calendarizar se propone la fecha de pase (fecha de vencimiento en Jira).
      if (to === "CALENDARIZACION" && !ocd.scheduledFor) {
        const date = new Date(Date.now() + SCHEDULE_DAYS * 86400000);
        await gateway("PATCH", `/api/tickets/${key}`, { dueDate: isoDate(date) });
        updated.scheduledFor = date.toISOString();
      }

      await gateway("POST", `/api/tickets/${key}/transition`, { status: JIRA_STATUS[to] });
      // Auditoría: el checklist evaluado queda como comentario en el ticket.
      await gateway("POST", `/api/tickets/${key}/comments`, { body: checklistComment(to, result, actor) });
      return updated;
    },
  };
}
