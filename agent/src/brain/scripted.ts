import { findScenario } from "./scenarios";
import type { Brain, SpecDraft } from "./types";

/**
 * Cerebro sin LLM: responde con los guiones de los casos demo (alerta de transacciones y EPSM/Checkmarx).
 * Es el plan B de la demo: nunca depende de la red ni de créditos.
 */
export function scriptedBrain(): Brain {
  return {
    name: "scripted",
    slow: false,
    async solutionType(requirement) {
      return findScenario(requirement).spec.solutionType;
    },
    async discover({ requirement }) {
      return findScenario(requirement).discoveryReply;
    },
    async specify({ requirement }) {
      const sc = findScenario(requirement);
      return {
        spec: structuredClone({ ...sc.spec, status: "draft", version: 1 }),
        plan: structuredClone(sc.plan),
        tasks: structuredClone(sc.tasks),
        reply: sc.specReply,
      };
    },
    async revise({ current, request }): Promise<SpecDraft> {
      const spec = { ...current.spec, version: current.spec.version + 1 };
      return {
        ...current,
        spec,
        reply: `Anotado: "${request.slice(0, 120)}". Actualicé la especificación a la versión ${spec.version}. (Modo guionado: el contenido no cambia; con el cerebro Copilot se reescribe.)`,
      };
    },
  };
}
