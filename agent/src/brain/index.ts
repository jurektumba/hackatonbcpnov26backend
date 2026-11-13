import { scriptedBrain } from "./scripted";
import type { Brain } from "./types";

export type { Brain, SpecDraft } from "./types";

/**
 * AGENT_BRAIN=scripted (default): guiones de los casos demo, sin LLM.
 * AGENT_BRAIN=copilot: GitHub Copilot SDK (si no arranca, se usa el guionado y se avisa).
 */
export async function createBrain(): Promise<Brain> {
  if (process.env.AGENT_BRAIN === "copilot") {
    try {
      const { copilotBrain } = await import("./copilot");
      return await copilotBrain();
    } catch (e) {
      console.warn(`No se pudo iniciar el cerebro Copilot; uso el guionado. Motivo: ${e instanceof Error ? e.message : e}`);
    }
  }
  return scriptedBrain();
}
