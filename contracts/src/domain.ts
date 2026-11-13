/**
 * Tipos de dominio compartidos. Dueño: persona 2 (integrador).
 * Cambios solo por acuerdo del equipo — ver specs/000-contratos/spec.md.
 */

export type SolutionType = "cloud-function" | "web-app";

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
  userStory: { asA: string; iWant: string; soThat: string };
  acceptanceCriteria: AcceptanceCriterion[];
  /** Requisitos no funcionales: seguridad, logging, observabilidad, performance. */
  nonFunctional: string[];
  outOfScope: string[];
  /** Preguntas sin resolver; la spec no debería aprobarse con preguntas abiertas. */
  openQuestions: string[];
  version: number;
  status: SpecStatus;
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

/** Estados a los que SOLO un humano puede transicionar. El agente nunca lo hace. */
export const HUMAN_ONLY_OCD_STATES: readonly OcdState[] = ["APROBACION", "PRODUCCION"];

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
