import { randomUUID } from "node:crypto";
import {
  HUMAN_ONLY_OCD_STATES,
  OCD_FLOW,
  pendingApprovals,
  type AgentEvent,
  type ApproveSpecRequest,
  type CreateSessionRequest,
  type Guideline,
  type JiraProject,
  type JiraTarget,
  type OcdApproveRequest,
  type OcdTicket,
  type OcdTransitionRequest,
  type Session,
  type SessionPhase,
  type ToolName,
  type ToolSet,
  type TraceEvent,
  type UpdateSpecRequest,
  type ValidationResult,
} from "@hack/contracts";
import { APPROVER_LABELS } from "@hack/tools-jsm";
import { matchScenario } from "./brain/scenarios";
import type { Brain, SpecDraft } from "./brain/types";

/** Error con código HTTP para que el servidor responda bien. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Listener = (e: AgentEvent) => void;

interface Runtime {
  session: Session;
  listeners: Set<Listener>;
  /** El descubrimiento arranca cuando se conecta el primer cliente, para que no pierda el streaming. */
  started: boolean;
  /** Hay un trabajo del agente en curso (evita mensajes cruzados). */
  busy: boolean;
  /** El agente ya hizo sus preguntas (si falló antes, el próximo mensaje reintenta el descubrimiento). */
  discovered: boolean;
  /** La sesión pasó al cerebro de respaldo: los pasos siguientes lo usan directo (un solo aviso). */
  usingBackup: boolean;
  target?: JiraTarget;
  guideline?: Guideline;
  user: string;
}

const OCD_STATUS_LABEL: Record<string, string> = {
  VALIDACION: "Validación",
  CONGELAMIENTO: "Congelamiento",
  REVERSION_CONGELAMIENTO: "Reversión de congelamiento",
  RECONGELAMIENTO: "Recongelamiento",
  CALENDARIZACION: "Calendarización",
  APROBACION: "Aprobación",
  PRODUCCION: "Producción",
};

const JIRA_TARGET_QUESTION = "¿En qué proyecto de Jira creo la Historia, y la agrego al sprint activo o al backlog?";

const now = () => new Date().toISOString();

/** Mensaje entendible para el chat a partir de un error técnico. */
function friendly(message: string): string {
  if (/timeout|timed out|session\.idle/i.test(message)) return "Copilot no respondió a tiempo.";
  if (/auth|token|401|403|unauthorized|forbidden/i.test(message)) return "No pude autenticarme con Copilot.";
  if (/rate|429|quota|limit/i.test(message)) return "Copilot está limitando las solicitudes en este momento.";
  return `No pude completar este paso (${message.slice(0, 140)}).`;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Pausa entre palabras al "escribir" en el chat (0 en pruebas). */
const STREAM_MS = Number(process.env.AGENT_STREAM_MS ?? 15);
/** Espera entre consultas del PR del Copilot coding agent. */
const PR_POLL_MS = Number(process.env.AGENT_PR_POLL_MS ?? 30000);
const PR_POLL_TRIES = Number(process.env.AGENT_PR_POLL_TRIES ?? 20);

export class Orchestrator {
  private runtimes = new Map<string, Runtime>();

  constructor(
    private readonly tools: ToolSet,
    private readonly brain: Brain,
    /** Cerebro de respaldo (guionado) para casos conocidos si el principal falla. */
    private readonly backup?: Brain,
  ) {}

  /**
   * Ejecuta un paso del cerebro. Si falla y el requerimiento es un caso guionado, sigue con el respaldo y lo avisa.
   */
  private async think<T>(rt: Runtime, step: (b: Brain) => Promise<T>): Promise<T> {
    if (rt.usingBackup && this.backup) return step(this.backup);
    try {
      return await step(this.brain);
    } catch (e) {
      if (!this.backup || !matchScenario(rt.session.requirement)) throw e;
      const why = e instanceof Error ? e.message : String(e);
      console.warn(`Cerebro principal falló (${why}); uso el respaldo guionado.`);
      rt.usingBackup = true;
      await this.say(rt, `${friendly(why)} Sigo con la versión preparada de este caso.`);
      return step(this.backup);
    }
  }

  /** Une los lineamientos aplicables en uno solo para el cerebro (el primero es el del tipo de solución). */
  private mergeGuidelines(list: Guideline[]): Guideline {
    if (list.length === 1) return list[0];
    return {
      ...list[0],
      title: list.map((g) => g.title).join(" + "),
      content: list.map((g) => `# ${g.title} v${g.version}\n${g.content}`).join("\n\n"),
      checklist: [...new Set(list.flatMap((g) => g.checklist))],
    };
  }

  // ---------------------------------------------------------------- utilidades

  private rt(sessionId: string): Runtime {
    const rt = this.runtimes.get(sessionId);
    if (!rt) throw new HttpError(404, `No existe la sesión ${sessionId}`);
    return rt;
  }

  private emit(rt: Runtime, event: AgentEvent) {
    for (const l of rt.listeners) {
      try {
        l(event);
      } catch {
        /* un cliente caído no detiene a los demás */
      }
    }
  }

  private changed(rt: Runtime) {
    this.emit(rt, { type: "session.updated", session: structuredClone(rt.session) });
  }

  private setPhase(rt: Runtime, phase: SessionPhase) {
    rt.session.phase = phase;
    this.emit(rt, { type: "phase.changed", phase });
    this.changed(rt);
  }

  private trace(rt: Runtime, kind: TraceEvent["kind"], label: string, ref?: string) {
    const event: TraceEvent = { at: now(), phase: rt.session.phase, kind, label, ref };
    rt.session.trace.push(event);
    this.emit(rt, { type: "trace.added", event });
    this.changed(rt);
  }

  private async say(rt: Runtime, text: string) {
    const messageId = randomUUID();
    for (const part of text.split(/(\s+)/)) {
      if (!part) continue;
      this.emit(rt, { type: "message.delta", messageId, delta: part });
      if (STREAM_MS && part.trim()) await sleep(STREAM_MS);
    }
    this.emit(rt, { type: "message.done", messageId });
    rt.session.messages.push({ id: messageId, role: "assistant", content: text, createdAt: now() });
    this.changed(rt);
  }

  /** Ejecuta una tool emitiendo inicio, fin y traza. */
  private async tool<T>(rt: Runtime, tool: ToolName, run: () => Promise<T>, describe: (r: T) => { summary: string; ref?: string }) {
    const toolCallId = randomUUID();
    this.emit(rt, { type: "tool.started", toolCallId, tool });
    try {
      const result = await run();
      const { summary, ref } = describe(result);
      this.emit(rt, { type: "tool.finished", toolCallId, tool, ok: true, summary, ref });
      this.trace(rt, "tool", summary, ref);
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.emit(rt, { type: "tool.finished", toolCallId, tool, ok: false, summary: message });
      throw e;
    }
  }

  /** Corre trabajo del agente en segundo plano; los errores llegan al chat como evento. */
  private background(rt: Runtime, work: () => Promise<void>) {
    rt.busy = true;
    work()
      .catch(async (e) => {
        const message = e instanceof Error ? e.message : String(e);
        console.error(e);
        this.emit(rt, { type: "error", message: `El agente se detuvo: ${message}` });
        const phase = rt.session.phase;
        if (phase === "DISCOVERY" || phase === "SPEC_DRAFT") {
          await this.say(rt, `${friendly(message)} Vuelve a enviar tu mensaje para reintentar.`).catch(() => undefined);
        }
      })
      .finally(() => {
        rt.busy = false;
      });
  }

  private draft(rt: Runtime): SpecDraft {
    const { spec, plan, tasks } = rt.session;
    if (!spec || !plan || !tasks) throw new HttpError(409, "Todavía no hay especificación.");
    return { spec, plan, tasks, reply: "" };
  }

  // ---------------------------------------------------------------- destino en Jira

  async listJiraProjects(): Promise<JiraProject[]> {
    return this.tools.jira.listProjects();
  }

  async getActiveSprint(projectKey: string) {
    return this.tools.jira.getActiveSprint(projectKey);
  }

  /** Busca un proyecto (por nombre o clave) y la preferencia de sprint en un texto libre. */
  private async detectTarget(text: string): Promise<JiraTarget | undefined> {
    const projects = await this.tools.jira.listProjects().catch(() => []);
    const t = text.toLowerCase();
    const project = projects.find(
      (p) => t.includes(p.name.toLowerCase()) || new RegExp(`\\b${p.key.toLowerCase()}\\b`).test(t),
    );
    if (!project) return undefined;
    const active = t.includes("backlog") ? null : await this.tools.jira.getActiveSprint(project.key).catch(() => null);
    return { project, sprint: active ?? "backlog" };
  }

  // ---------------------------------------------------------------- API

  async createSession(req: CreateSessionRequest): Promise<{ sessionId: string }> {
    if (!req.requirement?.trim()) throw new HttpError(400, "El requerimiento no puede estar vacío.");
    const id = randomUUID();
    const rt: Runtime = {
      session: {
        id,
        phase: "DISCOVERY",
        requirement: req.requirement.trim(),
        messages: [{ id: randomUUID(), role: "user", content: req.requirement.trim(), createdAt: now() }],
        trace: [],
      },
      listeners: new Set(),
      started: false,
      busy: false,
      discovered: false,
      usingBackup: false,
      target: req.jiraTarget,
      user: req.user,
    };
    this.runtimes.set(id, rt);
    return { sessionId: id };
  }

  getSession(sessionId: string): Session {
    return structuredClone(this.rt(sessionId).session);
  }

  /** Suscribe un cliente SSE. El primero dispara el descubrimiento. */
  subscribe(sessionId: string, listener: Listener): () => void {
    const rt = this.rt(sessionId);
    rt.listeners.add(listener);
    listener({ type: "session.updated", session: structuredClone(rt.session) });
    if (!rt.started) {
      rt.started = true;
      this.background(rt, () => this.runDiscovery(rt));
    }
    return () => rt.listeners.delete(listener);
  }

  async sendMessage(sessionId: string, content: string) {
    const rt = this.rt(sessionId);
    if (!content?.trim()) throw new HttpError(400, "El mensaje no puede estar vacío.");
    if (rt.busy) throw new HttpError(409, "El agente todavía está trabajando; espera a que termine.");
    rt.session.messages.push({ id: randomUUID(), role: "user", content: content.trim(), createdAt: now() });
    this.changed(rt);

    if (rt.session.phase === "DISCOVERY") {
      // Si el descubrimiento falló, este mensaje lo reintenta; si no, ya son las respuestas.
      this.background(rt, () => (rt.discovered ? this.runSpec(rt, content) : this.runDiscovery(rt)));
    } else if (rt.session.phase === "SPEC_DRAFT") {
      this.background(rt, async () => {
        if (this.brain.slow) await this.say(rt, "Aplico el cambio a la especificación; toma unos segundos…");
        const revised = await this.brain.revise({ current: this.draft(rt), request: content, guideline: rt.guideline! });
        this.applyDraft(rt, revised);
        await this.say(rt, revised.reply);
      });
    } else {
      this.background(rt, () =>
        this.say(rt, "La especificación ya está aprobada. Sigo con el pase; los cambios nuevos van en otro requerimiento."),
      );
    }
  }

  async updateSpec(sessionId: string, req: UpdateSpecRequest): Promise<Session> {
    const rt = this.rt(sessionId);
    if (rt.session.phase !== "SPEC_DRAFT") throw new HttpError(409, "Solo se puede editar la especificación antes de aprobarla.");
    const before = rt.session.spec?.jiraTarget;
    rt.session.spec = { ...req.spec, status: "draft" };
    if (req.plan) rt.session.plan = req.plan;
    if (req.tasks) rt.session.tasks = req.tasks;
    this.emit(rt, { type: "spec.updated", spec: rt.session.spec, plan: rt.session.plan, tasks: rt.session.tasks });
    this.changed(rt);
    const after = req.spec.jiraTarget;
    if (after && JSON.stringify(after) !== JSON.stringify(before)) {
      const where = after.sprint === "backlog" ? "en el backlog" : `en ${after.sprint.name}`;
      this.trace(rt, "approval", `Destino en Jira: ${after.project.name}, ${where}`);
    }
    return this.getSession(sessionId);
  }

  async approveSpec(sessionId: string, req: ApproveSpecRequest) {
    const rt = this.rt(sessionId);
    const spec = rt.session.spec;
    if (rt.session.phase !== "SPEC_DRAFT" || !spec) throw new HttpError(409, "No hay una especificación en borrador para aprobar.");
    if (!req.approvedBy?.trim()) throw new HttpError(400, "La aprobación la debe dar una persona (approvedBy).");
    if (spec.openQuestions.length > 0) throw new HttpError(409, "La especificación tiene preguntas abiertas.");
    if (!spec.jiraTarget) throw new HttpError(409, "Elige el proyecto de Jira donde se creará la Historia.");
    rt.session.spec = { ...spec, status: "approved", approvedBy: req.approvedBy, approvedAt: now() };
    this.setPhase(rt, "SPEC_APPROVED");
    this.trace(rt, "approval", `Especificación ${spec.id} v${spec.version} aprobada por ${req.approvedBy}`);
    this.background(rt, () => this.runPipeline(rt));
  }

  async validateOcd(sessionId: string, req: OcdTransitionRequest): Promise<ValidationResult> {
    const rt = this.rt(sessionId);
    const ocd = rt.session.ocd;
    if (!ocd) throw new HttpError(409, "Todavía no hay OCD.");
    const result = await this.tools.jsm.validateOcdTransition(ocd, req.to);
    this.emit(rt, { type: "ocd.validated", to: req.to, result });
    return result;
  }

  async transitionOcd(sessionId: string, req: OcdTransitionRequest): Promise<OcdTicket> {
    const rt = this.rt(sessionId);
    const ocd = rt.session.ocd;
    if (!ocd) throw new HttpError(409, "Todavía no hay OCD.");
    if (HUMAN_ONLY_OCD_STATES.includes(req.to) && !req.actor) throw new HttpError(403, "Esta transición la debe hacer una persona (actor).");
    let updated: OcdTicket;
    try {
      updated = await this.tools.jsm.transitionOcd(ocd, req.to, req.actor);
    } catch (e) {
      throw new HttpError(409, e instanceof Error ? e.message : String(e));
    }
    rt.session.ocd = updated;
    this.trace(rt, req.actor ? "approval" : "tool", `${ocd.key} pasó a ${OCD_STATUS_LABEL[req.to]}${req.actor ? ` (por ${req.actor})` : ""}`, ocd.url);
    if (req.to === "PRODUCCION") {
      this.setPhase(rt, "DONE");
      this.background(rt, () => this.say(rt, `Listo: ${ocd.key} quedó en producción. La trazabilidad completa está en el panel.`));
    }
    return updated;
  }

  async approveOcd(sessionId: string, req: OcdApproveRequest): Promise<OcdTicket> {
    const rt = this.rt(sessionId);
    const ocd = rt.session.ocd;
    if (!ocd) throw new HttpError(409, "Todavía no hay OCD.");
    if (!req.approvedBy?.trim()) throw new HttpError(400, "La aprobación la debe dar una persona (approvedBy).");
    let updated: OcdTicket;
    try {
      updated = await this.tools.jsm.approveOcd(ocd, req.role, req.approvedBy);
    } catch (e) {
      throw new HttpError(409, e instanceof Error ? e.message : String(e));
    }
    rt.session.ocd = updated;
    this.trace(rt, "approval", `${ocd.key} aprobado por ${req.approvedBy} como ${APPROVER_LABELS[req.role]}`, ocd.url);
    if (pendingApprovals(updated.approvals).length === 0) {
      this.background(rt, () => this.say(rt, `Aprobaciones obligatorias completas en ${ocd.key}. El pase a Producción ya se puede confirmar.`));
    }
    return updated;
  }

  // ---------------------------------------------------------------- guiones del agente

  private applyDraft(rt: Runtime, d: SpecDraft) {
    rt.session.spec = { ...d.spec, status: "draft", jiraTarget: d.spec.jiraTarget ?? rt.target };
    rt.session.plan = d.plan;
    rt.session.tasks = d.tasks;
    this.emit(rt, { type: "spec.updated", spec: rt.session.spec, plan: d.plan, tasks: d.tasks });
    this.changed(rt);
  }

  private async runDiscovery(rt: Runtime) {
    const requirement = rt.session.requirement;
    if (this.brain.slow) await this.say(rt, "Analizo tu requerimiento y busco los lineamientos que aplican…");
    if (!rt.target) rt.target = await this.detectTarget(requirement);
    const type = await this.think(rt, (b) => b.solutionType(requirement));
    const guidelines = await this.tool(
      rt,
      "getGuidelines",
      () =>
        this.tools.confluence
          .findGuidelines(requirement, type)
          .catch(async () => [await this.tools.confluence.getGuidelines(type)]),
      (list) => ({
        summary: `Lineamientos aplicados: ${list.map((g) => `${g.title} v${g.version}`).join(" y ")}`,
        ref: list[0]?.url,
      }),
    );
    rt.guideline = this.mergeGuidelines(guidelines);
    const guideline = rt.guideline;

    // Las preguntas se escriben en vivo si el cerebro hace streaming.
    const messageId = randomUUID();
    let streamed = "";
    const questions = await this.think(rt, (b) =>
      b.discover({
        requirement,
        guideline,
        onDelta: (delta) => {
          streamed += delta;
          this.emit(rt, { type: "message.delta", messageId, delta });
        },
      }),
    );
    // Si se pasó a una pregunta extra o no hubo streaming, se completa el texto.
    const numbered = (questions.match(/^\s*\d+\./gm) ?? []).length;
    const extra = rt.target ? "" : `\n${numbered ? `${numbered + 1}.` : "-"} ${JIRA_TARGET_QUESTION}`;
    const full = questions + extra;
    const rest = streamed && full.startsWith(streamed) ? full.slice(streamed.length) : streamed ? extra : full;
    for (const part of rest.split(/(\s+)/)) {
      if (!part) continue;
      this.emit(rt, { type: "message.delta", messageId, delta: part });
      if (STREAM_MS && part.trim()) await sleep(STREAM_MS);
    }
    this.emit(rt, { type: "message.done", messageId });
    rt.session.messages.push({ id: messageId, role: "assistant", content: streamed && !full.startsWith(streamed) ? streamed + extra : full, createdAt: now() });
    rt.discovered = true;
    this.changed(rt);
  }

  private async runSpec(rt: Runtime, answers: string) {
    if (!rt.target) rt.target = await this.detectTarget(answers);
    if (this.brain.slow) await this.say(rt, "Armo la especificación con tus respuestas; toma unos segundos…");
    const draft = await this.think(rt, (b) =>
      b.specify({ requirement: rt.session.requirement, answers, guideline: rt.guideline! }),
    );
    draft.spec.jiraTarget = rt.target;
    this.applyDraft(rt, draft);
    this.setPhase(rt, "SPEC_DRAFT");
    this.trace(rt, "phase-change", `Especificación ${draft.spec.id} v${draft.spec.version} lista para revisión`);
    await this.say(rt, draft.reply);
  }

  private async runPipeline(rt: Runtime) {
    const { spec, plan, tasks = [] } = rt.session;
    if (!spec || !plan || !spec.jiraTarget) return;
    const target = spec.jiraTarget;
    const where = target.sprint === "backlog" ? "en el backlog" : `en ${target.sprint.name}`;

    const story = await this.tool(rt, "createStory", () => this.tools.jira.createStory(spec, plan), (r) => ({
      summary: `Historia ${r.key} creada en ${target.project.name}, ${where}, con ${spec.acceptanceCriteria.length} criterios`,
      ref: r.url,
    }));
    rt.session.story = story;
    const subtasks = await this.tool(rt, "createSubtasks", () => this.tools.jira.createSubtasks(story, tasks), (r) => ({
      summary: `${r.length} subtareas creadas (${r[0]?.key ?? "—"} a ${r[r.length - 1]?.key ?? "—"})`,
      ref: story.url,
    }));
    rt.session.subtasks = subtasks;
    this.setPhase(rt, "JIRA_CREATED");

    const devIssue = await this.tool(rt, "createDevIssue", () => this.tools.github.createDevIssue(spec, plan, tasks, story), (r) => ({
      summary: `Issue #${r.number} asignado al Copilot coding agent`,
      ref: r.url,
    }));
    rt.session.devIssue = devIssue;
    this.setPhase(rt, "DEV_IN_PROGRESS");

    // El Copilot coding agent tarda: se consulta el PR cada cierto tiempo.
    let pr = null;
    for (let i = 0; i < PR_POLL_TRIES && !pr; i++) {
      pr = await this.tool(rt, "findPullRequest", () => this.tools.github.findPullRequest(devIssue), (r) => ({
        summary: r ? `Copilot abrió el PR #${r.number}` : "El PR todavía no existe; vuelvo a consultar",
        ref: r?.url,
      }));
      if (!pr) await sleep(PR_POLL_MS);
    }
    if (!pr) throw new Error(`El Copilot coding agent no abrió el PR de #${devIssue.number} a tiempo`);
    rt.session.pullRequest = pr;
    const pullRequest = pr;

    const evidence = await this.tool(rt, "collectEvidence", () => this.tools.github.collectEvidence(pullRequest), (r) => ({
      summary: `${r.filter((e) => e.status === "passed").length} de ${r.length} evidencias en verde`,
      ref: r[0]?.url,
    }));
    rt.session.evidence = evidence;
    this.setPhase(rt, "PR_READY");

    let ocd = await this.tool(
      rt,
      "createOcd",
      () => this.tools.jsm.createOcd({ spec, plan, story, pullRequest, evidence, requestedBy: spec.approvedBy ?? rt.user }),
      (r) => ({ summary: `Ticket ${r.key} creado y prellenado`, ref: r.url }),
    );
    rt.session.ocd = ocd;
    this.setPhase(rt, "OCD_IN_PROGRESS");

    // El agente avanza hasta antes de los estados que exigen una persona.
    for (const to of OCD_FLOW.slice(OCD_FLOW.indexOf(ocd.state) + 1)) {
      if (HUMAN_ONLY_OCD_STATES.includes(to)) break;
      const result = await this.tool(rt, "validateOcdTransition", () => this.tools.jsm.validateOcdTransition(ocd, to), (r) => ({
        summary: `Checklist de ${OCD_STATUS_LABEL[to].toLowerCase()}: ${r.checks.filter((c) => c.passed).length} de ${r.checks.length} OK`,
      }));
      this.emit(rt, { type: "ocd.validated", to, result });
      if (!result.ok) {
        await this.say(rt, `El checklist para ${OCD_STATUS_LABEL[to]} no pasó. Revisa los puntos marcados en la pestaña OCD.`);
        return;
      }
      ocd = await this.tools.jsm.transitionOcd(ocd, to);
      rt.session.ocd = ocd;
      this.trace(rt, "tool", `${ocd.key} pasó a ${OCD_STATUS_LABEL[to]}`, ocd.url);
    }

    const pending = pendingApprovals(ocd.approvals).map((a) => APPROVER_LABELS[a.role]);
    const date = ocd.scheduledFor
      ? new Date(ocd.scheduledFor).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })
      : "sin fecha";
    await this.say(
      rt,
      `${ocd.key} pasó validación, congelamiento, reversión y recongelamiento, quedó calendarizado para el ${date} y está en ${OCD_STATUS_LABEL[ocd.state]}.\n\n` +
        (pending.length
          ? `Faltan las aprobaciones de: ${pending.join(", ")}. Cuando estén completas, una persona confirma el pase a Producción desde la pestaña OCD.`
          : "Una persona puede confirmar el pase a Producción desde la pestaña OCD."),
    );
  }
}
