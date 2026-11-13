import { OCD_FLOW, type OcdState, type OcdTicket, type ValidationResult } from "@hack/contracts";

/**
 * Lógica pura de validación de transiciones OCD. La usan tanto el mock como la versión real,
 * así las reglas de negocio se prueban sin depender de JSM. Dueño: persona 4.
 * TODO persona 4: completar reglas por estado según el proceso OCD real (ver specs/004-ocd).
 */
export function buildChecklist(ocd: OcdTicket, to: OcdState): ValidationResult {
  const from = OCD_FLOW.indexOf(ocd.state);
  const target = OCD_FLOW.indexOf(to);

  const checks = [
    {
      id: "flow-order",
      description: `La transición ${ocd.state} → ${to} respeta el orden del flujo`,
      passed: target === from + 1,
    },
    {
      id: "evidence-passed",
      description: "Todas las evidencias del pipeline están en estado passed",
      passed: ocd.evidence.length > 0 && ocd.evidence.every((e) => e.status === "passed"),
      detail: ocd.evidence.filter((e) => e.status !== "passed").map((e) => e.kind).join(", ") || undefined,
    },
    {
      id: "rollback-plan",
      description: "Existe un plan de reversión documentado",
      passed: ocd.rollbackPlan.trim().length > 0,
    },
    {
      id: "traceability",
      description: "El OCD referencia la Historia de Jira y el PR",
      passed: Boolean(ocd.storyKey && ocd.prUrl),
    },
  ];

  if (to === "APROBACION") {
    checks.push({
      id: "schedule",
      description: "Hay fecha de pase calendarizada",
      passed: Boolean(ocd.scheduledFor),
    });
  }

  return { ok: checks.every((c) => c.passed), checks };
}
