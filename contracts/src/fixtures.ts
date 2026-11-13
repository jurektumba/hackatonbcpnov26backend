/**
 * Caso demo ÚNICO que usa todo el equipo para probar y para la presentación.
 * Datos 100% ficticios.
 */
import type { Guideline, Plan, Spec, Task } from "./domain";

export const DEMO_REQUIREMENT = `Necesitamos que cuando un cliente supere su límite diario de transacciones \
se le envíe una alerta por correo y quede registrado el evento para auditoría. \
El límite es configurable por segmento de cliente.`;

export const DEMO_USER = "po.demo@ejemplo.com";

export const demoSpec: Spec = {
  id: "REQ-001",
  title: "Alerta por exceso de límite diario de transacciones",
  solutionType: "cloud-function",
  summary:
    "Los clientes no se enteran cuando superan su límite diario de transacciones y llaman al call center. " +
    "Se requiere notificarles automáticamente y dejar trazabilidad para auditoría.",
  userStory: {
    asA: "cliente del banco",
    iWant: "recibir una alerta cuando supere mi límite diario de transacciones",
    soThat: "saber por qué se rechazan mis operaciones sin tener que llamar al call center",
  },
  acceptanceCriteria: [
    {
      id: "AC-01",
      title: "Envío de alerta al superar el límite",
      given: "un cliente del segmento 'Personas' con límite diario de 10 transacciones",
      when: "se registra su transacción número 11 del día",
      then: "se envía un correo de alerta al email registrado del cliente en menos de 1 minuto",
    },
    {
      id: "AC-02",
      title: "Una sola alerta por día",
      given: "un cliente que ya recibió la alerta del día",
      when: "realiza una nueva transacción por encima del límite",
      then: "no se envía una segunda alerta ese mismo día",
    },
    {
      id: "AC-03",
      title: "Registro de auditoría",
      given: "cualquier alerta enviada",
      when: "finaliza el envío",
      then: "se registra un evento de auditoría con id de cliente enmascarado, segmento, timestamp y resultado del envío",
    },
    {
      id: "AC-04",
      title: "Límite configurable por segmento",
      given: "la configuración de límites por segmento",
      when: "se actualiza el límite de un segmento",
      then: "la función usa el nuevo valor sin necesidad de redesplegar",
    },
  ],
  nonFunctional: [
    "No registrar datos personales en logs (enmascarar id y email).",
    "Logs estructurados en JSON con correlation-id.",
    "Reintentos con backoff exponencial ante fallas del servicio de correo (máx. 3).",
    "Cobertura de pruebas unitarias >= 80%.",
  ],
  outOfScope: ["Notificaciones por SMS o push.", "Cambio de los límites por parte del cliente."],
  openQuestions: [],
  version: 1,
  status: "draft",
};

export const demoPlan: Plan = {
  specId: "REQ-001",
  architecture:
    "Cloud Function disparada por evento de transacción (pub/sub). Lee el límite por segmento desde " +
    "configuración externa, mantiene un contador diario por cliente, y publica el envío de correo vía " +
    "servicio de notificaciones. Auditoría en una tabla append-only.",
  components: [
    { name: "fn-alerta-limite-transacciones", kind: "cloud-function", repoPath: "functions/alerta-limite" },
    { name: "config-limites-segmento", kind: "config", repoPath: "config/limites.yaml" },
    { name: "pipeline-ci", kind: "pipeline", repoPath: ".github/workflows/ci.yml" },
  ],
  rollbackPlan:
    "Redesplegar la versión anterior de fn-alerta-limite-transacciones (tag previo) y desactivar la " +
    "suscripción al tópico de transacciones. Sin migraciones de datos: la tabla de auditoría es append-only.",
  guidelineRefs: ["https://ejemplo.atlassian.net/wiki/spaces/LIN/pages/1001/Estandar+Cloud+Function"],
};

export const demoTasks: Task[] = [
  {
    id: "T-01",
    title: "Crear esqueleto de Cloud Function según estándar",
    description: "Estructura de carpetas, handler, logging estructurado y correlation-id según lineamiento.",
    estimateHours: 2,
    acceptanceCriteriaIds: [],
  },
  {
    id: "T-02",
    title: "Lógica de conteo diario y detección de exceso",
    description: "Contador por cliente/día, comparación con límite del segmento, alerta única por día.",
    estimateHours: 4,
    acceptanceCriteriaIds: ["AC-01", "AC-02"],
  },
  {
    id: "T-03",
    title: "Configuración externa de límites por segmento",
    description: "Lectura de config/limites.yaml en caliente, sin redespliegue.",
    estimateHours: 2,
    acceptanceCriteriaIds: ["AC-04"],
  },
  {
    id: "T-04",
    title: "Envío de correo con reintentos",
    description: "Integración con servicio de notificaciones, backoff exponencial, máx. 3 intentos.",
    estimateHours: 3,
    acceptanceCriteriaIds: ["AC-01"],
  },
  {
    id: "T-05",
    title: "Registro de auditoría con datos enmascarados",
    description: "Evento de auditoría append-only con id de cliente y email enmascarados.",
    estimateHours: 2,
    acceptanceCriteriaIds: ["AC-03"],
  },
  {
    id: "T-06",
    title: "Pruebas unitarias y pipeline de CI",
    description: "Tests por criterio de aceptación, cobertura >= 80%, workflow de GitHub Actions.",
    estimateHours: 3,
    acceptanceCriteriaIds: ["AC-01", "AC-02", "AC-03", "AC-04"],
  },
];

export const demoGuidelines: Record<"cloud-function" | "web-app", Guideline> = {
  "cloud-function": {
    solutionType: "cloud-function",
    title: "Estándar de desarrollo — Cloud Functions",
    url: "https://ejemplo.atlassian.net/wiki/spaces/LIN/pages/1001/Estandar+Cloud+Function",
    version: "1.3",
    content:
      "## Estructura\n- `functions/<nombre>/src/index.ts` como handler\n- Config externa, nunca hardcodeada\n" +
      "## Observabilidad\n- Logs JSON con correlation-id\n- Prohibido loggear datos personales\n" +
      "## Calidad\n- Cobertura mínima 80%\n- Pipeline con lint, test, build y escaneo de seguridad\n" +
      "## Despliegue\n- Plan de reversión obligatorio en el OCD",
    checklist: [
      "Handler en functions/<nombre>/src/index.ts",
      "Configuración externa (sin valores hardcodeados)",
      "Logs estructurados con correlation-id",
      "Sin datos personales en logs",
      "Cobertura >= 80%",
      "Pipeline con lint, test, build y security-scan",
      "Plan de reversión documentado",
    ],
  },
  "web-app": {
    solutionType: "web-app",
    title: "Estándar de desarrollo — Web Apps",
    url: "https://ejemplo.atlassian.net/wiki/spaces/LIN/pages/1002/Estandar+Web+App",
    version: "2.0",
    content:
      "## Estructura\n- SPA con build estático\n## Seguridad\n- CSP estricta, sin secretos en el cliente\n" +
      "## Calidad\n- Pruebas e2e de flujos críticos\n## Despliegue\n- Plan de reversión obligatorio en el OCD",
    checklist: [
      "Build estático reproducible",
      "CSP configurada",
      "Sin secretos en el cliente",
      "Pruebas e2e de flujos críticos",
      "Plan de reversión documentado",
    ],
  },
};
