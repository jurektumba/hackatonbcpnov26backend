import type { JsmTools } from "@hack/contracts";
import { buildChecklist } from "./checklist";

/**
 * TODO persona 4 — ver specs/004-ocd.
 * - createOcd: POST {ATLASSIAN_BASE_URL}/rest/servicedeskapi/request
 *   { serviceDeskId: JSM_SERVICE_DESK_ID, requestTypeId: JSM_REQUEST_TYPE_ID, requestFieldValues: {...} }
 * - transitionOcd: GET/POST /rest/api/3/issue/{key}/transitions (mapear OcdState → transition id).
 * - Validar SIEMPRE con buildChecklist antes de transicionar.
 */
export function realJsm(): JsmTools {
  return {
    async createOcd() {
      throw new Error("realJsm.createOcd no implementado (persona 4)");
    },
    async validateOcdTransition(ocd, to) {
      return buildChecklist(ocd, to);
    },
    async transitionOcd() {
      throw new Error("realJsm.transitionOcd no implementado (persona 4)");
    },
  };
}
