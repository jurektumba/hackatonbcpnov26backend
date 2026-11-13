import {
  OCD_FLOW,
  pendingApprovals,
  type ApproverRole,
  type OcdState,
  type OcdTicket,
  type ValidationCheck,
  type ValidationResult,
} from "@hack/contracts";

/** Nombre visible de cada rol aprobador. */
export const APPROVER_LABELS: Record<ApproverRole, string> = {
  LIDER_TECNICO: "Líder Técnico",
  CHAPTER_LEAD: "Chapter Lead",
  QA_CHAPTER_LEAD: "QA Chapter Lead",
  PO: "PO",
  SEGURIDAD: "Analista de seguridad",
};

/**
 * Registra la aprobación de un rol. Lógica pura compartida por mock y real.
 * Solo en estado APROBACION, para un rol del OCD que no haya aprobado aún.
 */
export function applyApproval(ocd: OcdTicket, role: ApproverRole, approvedBy: string): OcdTicket {
  if (ocd.state !== "APROBACION") throw new Error(`${ocd.key} no está en Aprobación (está en ${ocd.state})`);
  if (!approvedBy.trim()) throw new Error("La aprobación la debe dar una persona (falta approvedBy)");
  const approvals = ocd.approvals ?? [];
  const current = approvals.find((a) => a.role === role);
  if (!current) throw new Error(`${APPROVER_LABELS[role]} no es aprobador de ${ocd.key}`);
  if (current.approvedBy) throw new Error(`${APPROVER_LABELS[role]} ya aprobó ${ocd.key}`);
  return {
    ...ocd,
    approvals: approvals.map((a) => (a.role === role ? { ...a, approvedBy, approvedAt: new Date().toISOString() } : a)),
  };
}

/**
 * Lógica pura de validación de transiciones OCD. La usan tanto el mock como la versión real,
 * así las reglas de negocio se prueban sin depender de JSM. Dueño: persona 4.
 * TODO persona 4: completar reglas por estado según el proceso OCD real (ver specs/004-ocd).
 */
export function buildChecklist(ocd: OcdTicket, to: OcdState): ValidationResult {
  const from = OCD_FLOW.indexOf(ocd.state);
  const target = OCD_FLOW.indexOf(to);

  const checks: ValidationCheck[] = [
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

  if (to === "PRODUCCION") {
    const pending = pendingApprovals(ocd.approvals);
    checks.push({
      id: "approvals-complete",
      description: "Aprobaron todos los roles obligatorios",
      passed: (ocd.approvals?.length ?? 0) > 0 && pending.length === 0,
      detail: pending.length ? `faltan: ${pending.map((a) => APPROVER_LABELS[a.role]).join(", ")}` : undefined,
    });
  }

  return { ok: checks.every((c) => c.passed), checks };
}
