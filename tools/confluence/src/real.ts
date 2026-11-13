import type { ConfluenceTools } from "@hack/contracts";

/**
 * TODO persona 3 — ver specs/003-jira-confluence.
 * Buscar la página de lineamientos por label (ej. "lineamiento-cloud-function") en CONFLUENCE_SPACE_KEY,
 * convertir el storage format a markdown y extraer el checklist (lista bajo el título "Checklist").
 */
export function realConfluence(): ConfluenceTools {
  return {
    async getGuidelines(_solutionType) {
      throw new Error("realConfluence.getGuidelines no implementado (persona 3)");
    },
  };
}
