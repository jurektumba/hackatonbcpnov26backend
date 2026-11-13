/**
 * Estado de una sesión (un requerimiento de punta a punta) y API HTTP + eventos
 * entre el backend (repo hackatonbcpnov26backend, persona 2) y el frontend (repo hackatonbcpnov26, persona 1).
 */
import type {
  DevIssueRef,
  Evidence,
  JiraIssueRef,
  OcdState,
  OcdTicket,
  Plan,
  PullRequestRef,
  Spec,
  Task,
  ValidationResult,
} from "./domain";
import type { ToolName } from "./tools";

export type SessionPhase =
  | "DISCOVERY" // el agente hace preguntas aclaratorias
  | "SPEC_DRAFT" // hay spec/plan/tareas en borrador, editables
  | "SPEC_APPROVED" // humano aprobó; se disparan las integraciones
  | "JIRA_CREATED" // Historia + subtareas creadas
  | "DEV_IN_PROGRESS" // issue asignado a Copilot, esperando PR
  | "PR_READY" // PR encontrado y evidencias recolectadas
  | "OCD_IN_PROGRESS" // ticket OCD creado y avanzando en su flujo
  | "DONE";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface TraceEvent {
  at: string;
  phase: SessionPhase;
  kind: "phase-change" | "tool" | "approval";
  label: string;
  /** URL al artefacto creado (Jira, GitHub, JSM...). */
  ref?: string;
}

export interface Session {
  id: string;
  phase: SessionPhase;
  /** Texto original ingresado por el usuario. */
  requirement: string;
  messages: ChatMessage[];
  spec?: Spec;
  plan?: Plan;
  tasks?: Task[];
  story?: JiraIssueRef;
  subtasks?: JiraIssueRef[];
  devIssue?: DevIssueRef;
  pullRequest?: PullRequestRef;
  evidence?: Evidence[];
  ocd?: OcdTicket;
  trace: TraceEvent[];
}

// ---------- API HTTP (backend expone, frontend consume) ----------
// POST   /sessions                    body: CreateSessionRequest   -> CreateSessionResponse
// GET    /sessions/:id                                             -> Session
// POST   /sessions/:id/messages       body: SendMessageRequest     -> 202
// PUT    /sessions/:id/spec           body: UpdateSpecRequest      -> Session
// POST   /sessions/:id/approve        body: ApproveSpecRequest     -> 202
// POST   /sessions/:id/ocd/validate   body: OcdTransitionRequest   -> ValidationResult
// POST   /sessions/:id/ocd/transition body: OcdTransitionRequest   -> OcdTicket
// GET    /sessions/:id/events         -> text/event-stream de AgentEvent (SSE)

export interface CreateSessionRequest {
  requirement: string;
  user: string;
}
export interface CreateSessionResponse {
  sessionId: string;
}
export interface SendMessageRequest {
  content: string;
}
export interface UpdateSpecRequest {
  spec: Spec;
  plan?: Plan;
  tasks?: Task[];
}
export interface ApproveSpecRequest {
  approvedBy: string;
}
export interface OcdTransitionRequest {
  to: OcdState;
  /** Requerido si `to` está en HUMAN_ONLY_OCD_STATES. */
  actor?: string;
}

// ---------- Eventos SSE (agent -> web) ----------

export type AgentEvent =
  | { type: "message.delta"; messageId: string; delta: string }
  | { type: "message.done"; messageId: string }
  | { type: "spec.updated"; spec: Spec; plan?: Plan; tasks?: Task[] }
  | { type: "phase.changed"; phase: SessionPhase }
  | { type: "tool.started"; toolCallId: string; tool: ToolName }
  | {
      type: "tool.finished";
      toolCallId: string;
      tool: ToolName;
      ok: boolean;
      summary: string;
      ref?: string;
    }
  | { type: "ocd.validated"; to: OcdState; result: ValidationResult }
  | { type: "trace.added"; event: TraceEvent }
  /**
   * Estado completo de la sesión. El backend lo emite (1) al conectarse un cliente al SSE y
   * (2) después de cada cambio de estado (spec, fase, artefactos creados, OCD). El frontend lo usa como
   * fuente de verdad para todo excepto el texto en streaming de los mensajes.
   */
  | { type: "session.updated"; session: Session }
  | { type: "error"; message: string };
