/**
 * Tipos de dominio compartidos. Dueño: persona 2 (integrador).
 * Cambios solo por acuerdo del equipo — ver specs/000-contratos/spec.md.
 */

export type SolutionType = "cloud-function" | "web-app";

// ---------- Destino en Jira Software ----------

export interface JiraProject {
  /** Clave del proyecto, prefijo de sus issues (ej. "SQSDT"). */
  key: string;
  /** Nombre visible (ej. "SQ Service Desk Transform"). */
  name: string;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: "active" | "future";
}

/** Dónde se crea la Historia: proyecto + sprint (o backlog). */
export interface JiraTarget {
  project: JiraProject;
  sprint: JiraSprint | "backlog";
}

// ---------- Especificación (SDD) ----------

export type SpecStatus = "draft" | "approved";

export interface AcceptanceCriterion {
  /** "AC-01", "AC-02", ... */
  id: string;
  title: string;
  given: string;
  when: string;
  then: string;
}

export interface Spec {
  /** "REQ-001" */
  id: string;
  title: string;
  solutionType: SolutionType;
  /** Contexto y problema de negocio. */
  summary: string;
  /** Frases que completan "Como…", "Quiero…", "Para…". `iWant` y `soThat` en infinitivo (ej. "saber por qué…"). */
  userStory: { asA: string; iWant: string; soThat: string };
  acceptanceCriteria: AcceptanceCriterion[];
  /** Requisitos no funcionales: seguridad, logging, observabilidad, performance. */
  nonFunctional: string[];
  outOfScope: string[];
  /** Preguntas sin resolver; la spec no debería aprobarse con preguntas abiertas. */
  openQuestions: string[];
  version: number;
  status: SpecStatus;
  /**
   * Proyecto y sprint donde se creará la Historia. Lo define la preferencia del usuario, el
   * requerimiento o una pregunta del agente; se puede editar antes de aprobar. Requerido para aprobar.
   */
  jiraTarget?: JiraTarget;
  approvedBy?: string;
  /** ISO-8601 */
  approvedAt?: string;
}

export type ComponentKind = "cloud-function" | "web-app" | "config" | "pipeline";

export interface Component {
  name: string;
  kind: ComponentKind;
  /** Ruta dentro del repo destino. */
  repoPath: string;
}

export interface Plan {
  specId: string;
  /** Descripción de la arquitectura en markdown. */
  architecture: string;
  components: Component[];
  /** Plan de reversión; alimenta al OCD. */
  rollbackPlan: string;
  /** URLs de los lineamientos de Confluence aplicados. */
  guidelineRefs: string[];
}

export interface Task {
  /** "T-01", "T-02", ... */
  id: string;
  title: string;
  description: string;
  estimateHours?: number;
  /** Criterios de aceptación que cubre esta tarea. */
  acceptanceCriteriaIds: string[];
}

// ---------- Confluence ----------

export interface Guideline {
  solutionType: SolutionType;
  title: string;
  url: string;
  version: string;
  /** Contenido en markdown. */
  content: string;
  /** Ítems verificables que el agente debe respetar al especificar. */
  checklist: string[];
}

// ---------- Jira Software ----------

export interface JiraIssueRef {
  key: string;
  url: string;
  type: "Story" | "Subtask";
}

// ---------- GitHub ----------

export interface DevIssueRef {
  number: number;
  url: string;
  /** "owner/name" */
  repo: string;
  assignedToCopilot: boolean;
}

export interface PullRequestRef {
  number: number;
  url: string;
  repo: string;
  status: "open" | "merged" | "closed";
  headSha: string;
}

export type EvidenceKind = "unit-tests" | "build" | "lint" | "security-scan" | "coverage";

export interface Evidence {
  kind: EvidenceKind;
  status: "passed" | "failed";
  summary: string;
  url: string;
  /** ISO-8601 */
  collectedAt: string;
}

// ---------- OCD (Jira Service Management) ----------

/**
 * PROVISIONAL: estados tomados de la descripción del proceso OCD actual. Se confirmarán con el proceso real
 * (spec 004). El frontend dibuja el stepper a partir de este arreglo, así que cambiarlo aquí basta.
 */
export const OCD_FLOW = [
  "VALIDACION",
  "CONGELAMIENTO",
  "REVERSION_CONGELAMIENTO",
  "RECONGELAMIENTO",
  "CALENDARIZACION",
  "APROBACION",
  "PRODUCCION",
] as const;

export type OcdState = (typeof OCD_FLOW)[number];

/**
 * Estados a los que SOLO un humano puede transicionar. El agente nunca lo hace.
 * APROBACION ya no está aquí: entrar a Aprobación significa "esperando aprobaciones";
 * las aprobaciones las dan las personas de cada rol (OcdApproval) y PRODUCCION exige que estén completas.
 */
export const HUMAN_ONLY_OCD_STATES: readonly OcdState[] = ["PRODUCCION"];

// ---------- Aprobadores del OCD ----------

export const APPROVER_ROLES = ["LIDER_TECNICO", "CHAPTER_LEAD", "QA_CHAPTER_LEAD", "PO", "SEGURIDAD"] as const;

export type ApproverRole = (typeof APPROVER_ROLES)[number];

export interface OcdApproval {
  role: ApproverRole;
  /** Obligatoria para pasar a Producción. SEGURIDAD solo lo es cuando el requerimiento es de seguridad. */
  required: boolean;
  approvedBy?: string;
  /** ISO-8601 */
  approvedAt?: string;
}

const SECURITY_TERMS = /seguridad|vulnerab|checkmarx|checkmark|sast|credencial|secreto|xss|inyecci|injection/i;

/** El texto trata de seguridad (vulnerabilidades, Checkmarx, credenciales…). */
export function mentionsSecurity(text: string): boolean {
  return SECURITY_TERMS.test(text);
}

/** Un requerimiento necesita al analista de seguridad cuando trata de seguridad. */
export function requiresSecurityReview(spec: Spec): boolean {
  return [spec.title, spec.summary, ...spec.nonFunctional].some(mentionsSecurity);
}

/** Aprobaciones iniciales (todas pendientes) para un OCD. */
export function buildApprovals(spec: Spec): OcdApproval[] {
  const security = requiresSecurityReview(spec);
  return APPROVER_ROLES.map((role) => ({ role, required: role === "SEGURIDAD" ? security : true }));
}

/** Roles obligatorios que todavía no aprueban. */
export function pendingApprovals(approvals: OcdApproval[] | undefined): OcdApproval[] {
  return (approvals ?? []).filter((a) => a.required && !a.approvedBy);
}

export interface OcdInput {
  spec: Spec;
  plan: Plan;
  story: JiraIssueRef;
  pullRequest: PullRequestRef;
  evidence: Evidence[];
  requestedBy: string;
}

export interface OcdTicket {
  key: string;
  url: string;
  state: OcdState;
  summary: string;
  components: string[];
  version: string;
  rollbackPlan: string;
  storyKey: string;
  prUrl: string;
  evidence: Evidence[];
  /** ISO-8601, se completa en CALENDARIZACION. */
  scheduledFor?: string;
  /** Aprobaciones por rol; se completan en el estado APROBACION. */
  approvals?: OcdApproval[];
}

export interface ValidationCheck {
  id: string;
  description: string;
  passed: boolean;
  detail?: string;
}

export interface ValidationResult {
  ok: boolean;
  checks: ValidationCheck[];
}
