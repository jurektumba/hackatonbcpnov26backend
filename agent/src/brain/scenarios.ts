/**
 * Guiones del modo SCRIPTED (sin LLM). Copia de lib/demo/scenarios.ts del frontend. Cada escenario es un requerimiento completo, de la conversación
 * al OCD. Datos 100% ficticios. Para agregar uno: definirlo aquí y sumarlo a SCENARIOS.
 */
import type { Evidence, Guideline, Plan, Spec, Task, ValidationCheck, OcdTicket } from "@hack/contracts";
import { DEMO_REQUIREMENT, demoGuidelines, demoPlan, demoSpec, demoTasks } from "@hack/contracts/fixtures";

export interface DemoScenario {
  id: string;
  /** Nombre corto para el selector de ejemplos. */
  label: string;
  requirement: string;
  /** Palabras que, si aparecen en el requerimiento, activan este escenario. */
  keywords: string[];
  guideline: Guideline;
  discoveryReply: string;
  /** Respuesta de ejemplo a las preguntas, para agilizar la demo. */
  suggestedAnswer: string;
  specReply: string;
  spec: Spec;
  plan: Plan;
  tasks: Task[];
  evidence: (url: string, at: string) => Evidence[];
  /** Frase destacada en el chat al recolectar evidencias (opcional). */
  evidenceHeadline?: string;
  /** Verificaciones extra del OCD propias del escenario. */
  extraChecks?: (ocd: OcdTicket) => ValidationCheck[];
  keys: { firstStory: number; issue: number; ocd: string; repo: string; version: string };
}

// ---------------------------------------------------------------------------
// 1. Alerta por exceso de límite de transacciones (caso base de los contratos)
// ---------------------------------------------------------------------------

const alerta: DemoScenario = {
  id: "alerta-limite",
  label: "Alerta por límite de transacciones",
  requirement: DEMO_REQUIREMENT,
  keywords: ["límite", "limite", "transacciones"],
  guideline: demoGuidelines["cloud-function"],
  discoveryReply: `Revisé el estándar de Cloud Functions (v1.3) en Confluence. Antes de escribir la especificación necesito confirmar tres cosas:

1. ¿El límite diario se cuenta por número de transacciones o por monto?
2. ¿El correo puede mostrar el monto de la transacción, o solo el aviso?
3. Si el envío del correo falla, ¿basta con reintentar o hay que avisar por otro canal?`,
  suggestedAnswer: "Por número de transacciones. Solo el aviso, sin monto. Basta con reintentar 3 veces.",
  specReply: `Gracias. Con eso armé la especificación REQ-001: 4 criterios de aceptación, 4 requisitos no funcionales y 6 tareas, siguiendo el estándar de Cloud Functions.

Revísala en el panel de la derecha. Cuando la apruebes, creo la Historia en Jira, asigno el desarrollo al Copilot coding agent y preparo el OCD.`,
  spec: demoSpec,
  plan: demoPlan,
  tasks: demoTasks,
  evidence: (url, at) => [
    { kind: "lint", status: "passed", summary: "0 errores", url, collectedAt: at },
    { kind: "unit-tests", status: "passed", summary: "24 de 24 pruebas OK", url, collectedAt: at },
    { kind: "coverage", status: "passed", summary: "Cobertura 86%", url, collectedAt: at },
    { kind: "build", status: "passed", summary: "Build OK", url, collectedAt: at },
    { kind: "security-scan", status: "passed", summary: "0 vulnerabilidades altas", url, collectedAt: at },
  ],
  keys: { firstStory: 101, issue: 12, ocd: "OCD-501", repo: "intellihack/demo-cloud-function", version: "1.0.0" },
};

// ---------------------------------------------------------------------------
// 2. EPSM: subsanar observaciones del reporte Checkmarx
// ---------------------------------------------------------------------------

const EPSM_REQUIREMENT = `Necesitamos subsanar las observaciones del último reporte de Checkmarx de la aplicación EPSM. \
Seguridad de la Información no aprueba el siguiente pase a producción mientras haya observaciones altas o medias abiertas.`;

const epsmGuideline: Guideline = {
  solutionType: "web-app",
  title: "Estándar de remediación de vulnerabilidades (SAST)",
  url: "https://ejemplo.atlassian.net/wiki/spaces/LIN/pages/1003/Estandar+Remediacion+SAST",
  version: "2.1",
  content:
    "## Alcance\n- Observaciones altas y medias se cierran antes del pase\n- Bajas: corregir o registrar como deuda técnica\n" +
    "## Falsos positivos\n- Requieren justificación y visto bueno de Seguridad de la Información\n" +
    "## Evidencia\n- Re-escaneo Checkmarx adjunto al OCD con 0 altas y 0 medias\n" +
    "## Calidad\n- Una prueba por hallazgo corregido; sin regresiones funcionales",
  checklist: [
    "Altas y medias cerradas antes del pase",
    "Falsos positivos justificados y aprobados por Seguridad",
    "Una prueba por hallazgo corregido",
    "Sin secretos en el repositorio",
    "Re-escaneo Checkmarx adjunto al OCD",
    "Plan de reversión documentado",
  ],
};

const epsmSpec: Spec = {
  id: "REQ-002",
  title: "Resolver Vulnerabilidades de Checkmark de EPSM",
  solutionType: "web-app",
  summary:
    "El escaneo Checkmarx (SAST) del 4 de noviembre sobre EPSM reportó 9 observaciones: 2 altas, 4 medias y 3 bajas. " +
    "Seguridad de la Información exige cerrar las altas y medias antes del siguiente pase a producción. " +
    "Ninguna observación fue marcada como falso positivo.",
  userStory: {
    asA: "equipo responsable de EPSM",
    iWant: "corregir las observaciones altas y medias del reporte Checkmarx",
    soThat: "aprobar el control de seguridad y seguir pasando cambios a producción",
  },
  acceptanceCriteria: [
    {
      id: "AC-01",
      title: "SQL Injection en la búsqueda de solicitudes (alta)",
      given: "el endpoint de búsqueda de solicitudes que hoy concatena los filtros en la consulta SQL",
      when: "se reescribe la consulta con parámetros enlazados",
      then: "el re-escaneo no reporta SQL Injection en ese flujo y la búsqueda devuelve los mismos resultados que antes",
    },
    {
      id: "AC-02",
      title: "Stored XSS en comentarios de solicitudes (alta)",
      given: "los comentarios de una solicitud que se muestran sin codificar en la vista de detalle",
      when: "se codifica la salida HTML de esos campos",
      then: "el re-escaneo no reporta Stored XSS y un comentario con <script> se muestra como texto",
    },
    {
      id: "AC-03",
      title: "Contraseña en el código fuente (media)",
      given: "la contraseña de base de datos escrita en application.properties",
      when: "se mueve al gestor de secretos y se lee al iniciar",
      then: "no quedan credenciales en el repositorio y EPSM inicia correctamente en certificación",
    },
    {
      id: "AC-04",
      title: "Observaciones medias restantes",
      given: "las observaciones Reflected XSS, Log Forging y falta de cabecera HSTS",
      when: "se codifican los parámetros reflejados, se sanean las entradas a logs y se agrega HSTS",
      then: "el re-escaneo de Checkmarx muestra 0 observaciones altas y 0 medias",
    },
    {
      id: "AC-05",
      title: "Sin regresiones",
      given: "la suite de pruebas actual de EPSM",
      when: "se aplican todas las correcciones",
      then: "todas las pruebas pasan y la cobertura no baja del 80%",
    },
  ],
  nonFunctional: [
    "No cambiar el comportamiento visible para el usuario.",
    "Una prueba automatizada por cada observación corregida.",
    "Adjuntar al OCD el reporte del re-escaneo Checkmarx con 0 altas y 0 medias.",
    "Los secretos se leen solo desde el gestor de secretos.",
  ],
  outOfScope: [
    "Las 3 observaciones bajas: se registran como deuda técnica con fecha de atención.",
    "Escaneo de dependencias de terceros (SCA).",
  ],
  openQuestions: [],
  version: 1,
  status: "draft",
};

const epsmPlan: Plan = {
  specId: "REQ-002",
  architecture:
    "Correcciones puntuales sobre EPSM (backend Java con Spring Boot y vistas renderizadas en el servidor), sin cambios " +
    "de arquitectura: consultas parametrizadas, codificación de salida en las vistas, secretos externalizados, cabecera HSTS " +
    "y saneamiento de entradas a logs. Se agrega el re-escaneo Checkmarx al pipeline como puerta de calidad.",
  components: [
    { name: "epsm-api", kind: "web-app", repoPath: "src/main/java/pe/epsm/solicitudes" },
    { name: "epsm-vistas", kind: "web-app", repoPath: "src/main/resources/templates" },
    { name: "epsm-config", kind: "config", repoPath: "src/main/resources/application.properties" },
    { name: "pipeline-ci", kind: "pipeline", repoPath: ".github/workflows/ci.yml" },
  ],
  rollbackPlan:
    "Redesplegar el tag anterior de EPSM (v3.8.2). No hay migraciones de datos. El secreto en el gestor se mantiene " +
    "compatible con la versión anterior, que sigue leyendo application.properties hasta retirarlo 7 días después del pase.",
  guidelineRefs: [epsmGuideline.url],
};

const epsmTasks: Task[] = [
  {
    id: "T-01",
    title: "Parametrizar consultas de la búsqueda de solicitudes",
    description: "Reemplazar la concatenación de filtros por parámetros enlazados en el repositorio de solicitudes.",
    estimateHours: 3,
    acceptanceCriteriaIds: ["AC-01"],
  },
  {
    id: "T-02",
    title: "Codificar la salida de comentarios y parámetros reflejados",
    description: "Usar codificación HTML en las vistas de detalle y en los mensajes que repiten parámetros.",
    estimateHours: 3,
    acceptanceCriteriaIds: ["AC-02", "AC-04"],
  },
  {
    id: "T-03",
    title: "Mover la contraseña de base de datos al gestor de secretos",
    description: "Eliminar la credencial de application.properties y leerla del gestor al iniciar.",
    estimateHours: 2,
    acceptanceCriteriaIds: ["AC-03"],
  },
  {
    id: "T-04",
    title: "Agregar cabecera HSTS y sanear entradas a logs",
    description: "Configurar HSTS en la capa web y escapar saltos de línea en los datos que se registran.",
    estimateHours: 2,
    acceptanceCriteriaIds: ["AC-04"],
  },
  {
    id: "T-05",
    title: "Pruebas por observación y de regresión",
    description: "Una prueba por hallazgo corregido y ejecución completa de la suite existente.",
    estimateHours: 3,
    acceptanceCriteriaIds: ["AC-01", "AC-02", "AC-03", "AC-04", "AC-05"],
  },
  {
    id: "T-06",
    title: "Re-escaneo Checkmarx en el pipeline",
    description: "Ejecutar Checkmarx en cada PR y publicar el reporte como evidencia para el OCD.",
    estimateHours: 1,
    acceptanceCriteriaIds: ["AC-04", "AC-05"],
  },
];

const epsm: DemoScenario = {
  id: "epsm-checkmarx",
  label: "Observaciones Checkmarx de EPSM",
  requirement: EPSM_REQUIREMENT,
  keywords: ["checkmarx", "epsm", "vulnerabilidad", "sast"],
  guideline: epsmGuideline,
  discoveryReply: `Revisé el estándar de remediación de vulnerabilidades (v2.1) en Confluence. Antes de escribir la especificación necesito confirmar tres cosas:

1. ¿Cuál es el escaneo de referencia y cuántas observaciones tiene por severidad?
2. ¿El alcance es cerrar altas y medias, o también las bajas?
3. ¿Alguna observación ya fue aceptada como falso positivo por Seguridad?`,
  suggestedAnswer:
    "El escaneo del 4 de noviembre: 2 altas (SQL Injection y Stored XSS), 4 medias (contraseña en el código, Reflected XSS, Log Forging y falta de HSTS) y 3 bajas. Cerramos altas y medias; las bajas van como deuda técnica. No hay falsos positivos aprobados.",
  specReply: `Gracias. Con eso armé la especificación REQ-002: 5 criterios de aceptación (uno por grupo de observaciones, más uno de no regresión), 4 requisitos no funcionales y 6 tareas.

El re-escaneo de Checkmarx queda como evidencia obligatoria: el OCD no avanza si sigue habiendo observaciones altas o medias. Revísala a la derecha y apruébala cuando esté conforme.`,
  spec: epsmSpec,
  plan: epsmPlan,
  tasks: epsmTasks,
  evidence: (url, at) => [
    { kind: "security-scan", status: "passed", summary: "Checkmarx: 0 altas y 0 medias (antes: 2 altas y 4 medias)", url, collectedAt: at },
    { kind: "unit-tests", status: "passed", summary: "218 de 218 pruebas OK (6 nuevas)", url, collectedAt: at },
    { kind: "coverage", status: "passed", summary: "Cobertura 82%", url, collectedAt: at },
    { kind: "lint", status: "passed", summary: "0 errores", url, collectedAt: at },
    { kind: "build", status: "passed", summary: "Build OK", url, collectedAt: at },
  ],
  evidenceHeadline: "Re-escaneo Checkmarx: 0 altas y 0 medias (antes 2 altas y 4 medias)",
  extraChecks: (ocd) => [
    {
      id: "checkmarx-rescan",
      description: "El re-escaneo Checkmarx no tiene observaciones altas ni medias",
      passed: ocd.evidence.some((e) => e.kind === "security-scan" && e.status === "passed"),
    },
  ],
  keys: { firstStory: 214, issue: 34, ocd: "OCD-502", repo: "intellihack/epsm", version: "3.8.3" },
};

export const SCENARIOS: DemoScenario[] = [alerta, epsm];

/** Escenario que coincide con el requerimiento por palabras clave, o null si ninguno. */
export function matchScenario(requirement: string): DemoScenario | null {
  const text = requirement.toLowerCase();
  const scored = SCENARIOS.map((s) => ({ s, hits: s.keywords.filter((k) => text.includes(k)).length }));
  const best = scored.reduce((a, b) => (b.hits > a.hits ? b : a));
  return best.hits > 0 ? best.s : null;
}

/** Elige el escenario según el texto del requerimiento. Si nada coincide, usa el primero. */
export function findScenario(requirement: string): DemoScenario {
  const text = requirement.toLowerCase();
  const scored = SCENARIOS.map((s) => ({ s, hits: s.keywords.filter((k) => text.includes(k)).length }));
  const best = scored.reduce((a, b) => (b.hits > a.hits ? b : a));
  return best.hits > 0 ? best.s : SCENARIOS[0];
}
