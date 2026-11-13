import type { Guideline, Plan, SolutionType, Spec, Task } from "@hack/contracts";

/** Lo que el cerebro produce al especificar o revisar. La spec sale siempre en borrador. */
export interface SpecDraft {
  spec: Spec;
  plan: Plan;
  tasks: Task[];
  /** Mensaje para el usuario en el chat. */
  reply: string;
}

/**
 * El "cerebro" del agente: solo descubre y especifica (decisión D4 de la spec 000).
 * Las integraciones (Jira, GitHub, OCD) las ejecuta el orquestador con código determinista.
 */
export interface Brain {
  readonly name: string;
  /** Tipo de solución, para elegir el lineamiento de Confluence. */
  solutionType(requirement: string): Promise<SolutionType>;
  /** Mensaje con las preguntas aclaratorias (máx. una ronda). */
  discover(input: { requirement: string; guideline: Guideline }): Promise<string>;
  /** Especificación a partir del requerimiento y las respuestas. */
  specify(input: { requirement: string; answers: string; guideline: Guideline }): Promise<SpecDraft>;
  /** Ajusta la spec en borrador según un pedido del usuario. */
  revise(input: { current: SpecDraft; request: string; guideline: Guideline }): Promise<SpecDraft>;
}
