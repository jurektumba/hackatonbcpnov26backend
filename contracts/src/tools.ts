/**
 * Firmas de las tools que usa el agente. Cada paquete en /tools implementa una interfaz
 * (versión mock y real). El agente solo conoce estas interfaces.
 */
import type {
  DevIssueRef,
  Evidence,
  Guideline,
  JiraIssueRef,
  JiraProject,
  JiraSprint,
  OcdInput,
  OcdState,
  OcdTicket,
  Plan,
  PullRequestRef,
  SolutionType,
  Spec,
  Task,
  ValidationResult,
} from "./domain";

/** Persona 3 — tools/confluence */
export interface ConfluenceTools {
  getGuidelines(solutionType: SolutionType): Promise<Guideline>;
}

/** Persona 3 — tools/jira */
export interface JiraTools {
  /** Proyectos de Jira Software en los que el usuario puede crear historias. */
  listProjects(): Promise<JiraProject[]>;
  /** Sprint activo del tablero del proyecto, o null si no hay (entonces se usa el backlog). */
  getActiveSprint(projectKey: string): Promise<JiraSprint | null>;
  /**
   * Crea la Historia con descripción + criterios de aceptación (Gherkin) en `spec.jiraTarget`
   * (proyecto y sprint/backlog). Requiere spec aprobada y con jiraTarget.
   */
  createStory(spec: Spec, plan: Plan): Promise<JiraIssueRef>;
  /** Crea una subtarea por cada Task, en el mismo orden. */
  createSubtasks(story: JiraIssueRef, tasks: Task[]): Promise<JiraIssueRef[]>;
}

/** Persona 5 — tools/github */
export interface GitHubTools {
  /** Crea un issue con spec+plan+tareas y lo asigna al Copilot coding agent. */
  createDevIssue(spec: Spec, plan: Plan, tasks: Task[], story: JiraIssueRef): Promise<DevIssueRef>;
  /** Devuelve el PR abierto por Copilot para el issue, o null si aún no existe. */
  findPullRequest(issue: DevIssueRef): Promise<PullRequestRef | null>;
  /** Recolecta evidencias (checks de GitHub Actions) del head del PR. */
  collectEvidence(pr: PullRequestRef): Promise<Evidence[]>;
}

/** Persona 4 — tools/jsm */
export interface JsmTools {
  /** Crea el ticket OCD en estado VALIDACION, prellenado. */
  createOcd(input: OcdInput): Promise<OcdTicket>;
  /** Evalúa el checklist para pasar `ocd` al estado `to`. No modifica nada. */
  validateOcdTransition(ocd: OcdTicket, to: OcdState): Promise<ValidationResult>;
  /** Ejecuta la transición. Debe fallar si la validación no pasa. */
  transitionOcd(ocd: OcdTicket, to: OcdState): Promise<OcdTicket>;
}

export type ToolName =
  | "listProjects"
  | "getActiveSprint"
  | "getGuidelines"
  | "createStory"
  | "createSubtasks"
  | "createDevIssue"
  | "findPullRequest"
  | "collectEvidence"
  | "createOcd"
  | "validateOcdTransition"
  | "transitionOcd";

export interface ToolSet {
  confluence: ConfluenceTools;
  jira: JiraTools;
  github: GitHubTools;
  jsm: JsmTools;
}
