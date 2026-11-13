import { CopilotClient, type CopilotSession } from "@github/copilot-sdk";
import type { Guideline, Plan, SolutionType, Spec, Task } from "@hack/contracts";
import { z } from "zod";
import type { Brain, SpecDraft } from "./types";

/**
 * Cerebro con GitHub Copilot SDK.
 * Autenticación (en este orden): COPILOT_GITHUB_TOKEN / GH_TOKEN / GITHUB_TOKEN, la sesión del Copilot CLI
 * o la de `gh auth`. Modelo opcional: COPILOT_MODEL.
 * El modelo NO tiene herramientas ni permisos: solo conversa y devuelve JSON validado con zod (decisión D5).
 */

const SYSTEM = `Eres el analista de requerimientos de Lanzalo, una herramienta interna de un banco que convierte requerimientos en
especificaciones (Spec-Driven Development). Respondes siempre en español, de forma breve y concreta.
Reglas:
- Pregunta antes de asumir. Pregunta por datos sensibles, integraciones, volumen y cómo se revierte el cambio.
- Los criterios de aceptación van en formato Dado / Cuando / Entonces y deben ser verificables.
- Los requisitos no funcionales respetan el checklist del lineamiento que se te entrega.
- Las tareas son pequeñas (4 horas o menos) y cada una dice qué criterios cubre.
- Siempre hay un plan de reversión concreto.
- No inventes datos de clientes ni cifras que no te dieron.`;

const nullableStr = z.string().nullable();

const SpecSchema = z.object({
  title: z.string(),
  summary: z.string(),
  userStory: z.object({ asA: z.string(), iWant: z.string(), soThat: z.string() }),
  acceptanceCriteria: z.array(z.object({ title: z.string(), given: z.string(), when: z.string(), then: z.string() })),
  nonFunctional: z.array(z.string()),
  outOfScope: z.array(z.string()),
  openQuestions: z.array(z.string()),
  plan: z.object({
    architecture: z.string(),
    components: z.array(
      z.object({ name: z.string(), kind: z.enum(["cloud-function", "web-app", "config", "pipeline"]), repoPath: z.string() }),
    ),
    rollbackPlan: z.string(),
  }),
  tasks: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      estimateHours: z.number().nullable(),
      acceptanceCriteriaIndexes: z.array(z.number()),
    }),
  ),
  reply: z.string(),
});
type SpecJson = z.infer<typeof SpecSchema>;

const TypeSchema = z.object({ solutionType: z.enum(["cloud-function", "web-app"]), reason: nullableStr });

const guidelineText = (g: Guideline) =>
  `Lineamiento "${g.title}" v${g.version}:\n${g.content}\nChecklist:\n${g.checklist.map((c) => `- ${c}`).join("\n")}`;

let reqCounter = 100;

function toDraft(json: SpecJson, solutionType: SolutionType, guideline: Guideline, base?: Spec): SpecDraft {
  const id = base?.id ?? `REQ-${++reqCounter}`;
  const acs = json.acceptanceCriteria.map((ac, i) => ({ id: `AC-${String(i + 1).padStart(2, "0")}`, ...ac }));
  const spec: Spec = {
    id,
    title: json.title,
    solutionType,
    summary: json.summary,
    userStory: json.userStory,
    acceptanceCriteria: acs,
    nonFunctional: json.nonFunctional,
    outOfScope: json.outOfScope,
    openQuestions: json.openQuestions,
    jiraTarget: base?.jiraTarget,
    version: (base?.version ?? 0) + 1,
    status: "draft",
  };
  const plan: Plan = { specId: id, ...json.plan, guidelineRefs: [guideline.url] };
  const tasks: Task[] = json.tasks.map((t, i) => ({
    id: `T-${String(i + 1).padStart(2, "0")}`,
    title: t.title,
    description: t.description,
    estimateHours: t.estimateHours ?? undefined,
    acceptanceCriteriaIds: t.acceptanceCriteriaIndexes.map((n) => acs[Math.round(n) - 1]?.id).filter((x): x is string => Boolean(x)),
  }));
  return { spec, plan, tasks, reply: json.reply };
}

export async function copilotBrain(): Promise<Brain> {
  const client = new CopilotClient();
  await client.start();
  const model = process.env.COPILOT_MODEL || undefined;
  const timeout = Number(process.env.COPILOT_TIMEOUT_MS ?? 120000);

  /** Una sesión corta por pedido, sin herramientas y rechazando cualquier permiso. */
  async function ask<T>(prompt: string, schema?: z.ZodType<T>): Promise<T | string> {
    const session: CopilotSession = await client.createSession({
      model,
      availableTools: [],
      systemMessage: { mode: "append", content: SYSTEM },
      onPermissionRequest: () => ({ kind: "reject", feedback: "Lanzalo no permite herramientas al modelo." }),
    });
    try {
      if (schema) return await session.sendAndWait(prompt, schema, timeout);
      const msg = await session.sendAndWait({ prompt }, timeout);
      return msg?.data.content ?? "";
    } finally {
      await session.disconnect().catch(() => undefined);
    }
  }

  const types = new Map<string, SolutionType>();

  const brain: Brain = {
    name: `copilot${model ? `:${model}` : ""}`,

    async solutionType(requirement) {
      if (!types.has(requirement)) {
        const r = (await ask(
          `Clasifica este requerimiento como "cloud-function" (proceso de backend, evento, integración) o "web-app" (aplicación web con interfaz):\n\n${requirement}`,
          TypeSchema,
        )) as z.infer<typeof TypeSchema>;
        types.set(requirement, r.solutionType);
      }
      return types.get(requirement)!;
    },

    async discover({ requirement, guideline }) {
      return (await ask(
        `Requerimiento del usuario:\n"""${requirement}"""\n\n${guidelineText(guideline)}\n\n` +
          `Escribe un mensaje breve: una línea diciendo qué lineamiento aplicaste y luego como máximo 3 preguntas aclaratorias numeradas (1., 2., 3.). ` +
          `No preguntes por el proyecto de Jira ni por el sprint.`,
      )) as string;
    },

    async specify({ requirement, answers, guideline }) {
      const solutionType = await brain.solutionType(requirement);
      const json = (await ask(
        `Requerimiento:\n"""${requirement}"""\n\nRespuestas del usuario a tus preguntas:\n"""${answers}"""\n\n${guidelineText(guideline)}\n\n` +
          `Genera la especificación completa. En "reply" escribe 2 frases para el chat: qué armaste (cuántos criterios y tareas) y que la revise antes de aprobar. ` +
          `En tasks.acceptanceCriteriaIndexes usa la posición (1, 2, 3…) de los criterios que cubre cada tarea. Deja openQuestions vacío si no queda nada por resolver.`,
        SpecSchema,
      )) as SpecJson;
      return toDraft(json, solutionType, guideline);
    },

    async revise({ current, request, guideline }) {
      const json = (await ask(
        `Especificación actual (JSON):\n${JSON.stringify({ spec: current.spec, plan: current.plan, tasks: current.tasks })}\n\n` +
          `Pedido de cambio del usuario:\n"""${request}"""\n\n${guidelineText(guideline)}\n\n` +
          `Devuelve la especificación completa con el cambio aplicado. En "reply" explica en 1 o 2 frases qué cambiaste.`,
        SpecSchema,
      )) as SpecJson;
      return toDraft(json, current.spec.solutionType, guideline, current.spec);
    },
  };
  return brain;
}
