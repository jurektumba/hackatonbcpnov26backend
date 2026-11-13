import { scriptedBrain } from "./scripted";
import type { Brain } from "./types";

export type { Brain, SpecDraft } from "./types";

/**
 * AGENT_BRAIN=scripted (default): guiones de los casos demo, sin LLM.
 * AGENT_BRAIN=copilot: GitHub Copilot SDK (si no arranca, se usa el guionado y se avisa).
 */
export async function createBrain(): Promise<{ brain: Brain; backup?: Brain }> {
  if (process.env.AGENT_BRAIN === "copilot") {
    try {
      const { copilotBrain } = await import("./copilot");
      // El guionado queda de respaldo: si Copilot falla en un caso que el guion conoce, se usa el guion.
      return { brain: await copilotBrain(), backup: scriptedBrain() };
    } catch (e) {
      console.warn(`No se pudo iniciar el cerebro Copilot; uso el guionado. Motivo: ${e instanceof Error ? e.message : e}`);
    }
  }
  return { brain: scriptedBrain() };
}
