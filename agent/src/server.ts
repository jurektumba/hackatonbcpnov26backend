/**
 * Servidor del agente: API HTTP + SSE definida en contracts/src/session.ts. Node puro, sin dependencias.
 *   npm run agent            (lee .env; AGENT_PORT, por defecto 4000)
 * Cerebro: AGENT_BRAIN=scripted (default, sin LLM) | copilot (GitHub Copilot SDK).
 * Tools: USE_MOCKS / MOCK_<HERRAMIENTA> como en el resto del backend.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AgentEvent } from "@hack/contracts";
import { createBrain } from "./brain";
import { HttpError, Orchestrator } from "./orchestrator";
import { createToolSet } from "./tools";

const PORT = Number(process.env.AGENT_PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

const { brain, backup } = await createBrain();
const orchestrator = new Orchestrator(createToolSet(), brain, backup);

function cors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res: ServerResponse, status: number, body?: unknown): void {
  res.statusCode = status;
  if (body === undefined) {
    res.end();
    return;
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new HttpError(413, "Cuerpo demasiado grande.");
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return {} as T;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
  } catch {
    throw new HttpError(400, "JSON inválido.");
  }
}

function sse(req: IncomingMessage, res: ServerResponse, sessionId: string) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(": conectado\n\n");
  const send = (e: AgentEvent) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  const unsubscribe = orchestrator.subscribe(sessionId, send);
  const ping = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => {
    clearInterval(ping);
    unsubscribe();
  });
}

type Handler = (req: IncomingMessage, res: ServerResponse, params: string[]) => Promise<void>;
const routes: [string, RegExp, Handler][] = [
  ["GET", /^\/health$/, async (_q, r) => json(r, 200, { status: "ok", brain: brain.name })],
  ["POST", /^\/sessions$/, async (q, r) => json(r, 201, await orchestrator.createSession(await readJson(q)))],
  ["GET", /^\/sessions\/([\w-]+)$/, async (_q, r, [id]) => json(r, 200, orchestrator.getSession(id))],
  ["GET", /^\/sessions\/([\w-]+)\/events$/, async (q, r, [id]) => {
    orchestrator.getSession(id); // 404 antes de abrir el stream
    sse(q, r, id);
  }],
  ["POST", /^\/sessions\/([\w-]+)\/messages$/, async (q, r, [id]) => {
    const body = await readJson<{ content: string }>(q);
    await orchestrator.sendMessage(id, body.content);
    json(r, 202, { ok: true });
  }],
  ["PUT", /^\/sessions\/([\w-]+)\/spec$/, async (q, r, [id]) => json(r, 200, await orchestrator.updateSpec(id, await readJson(q)))],
  ["POST", /^\/sessions\/([\w-]+)\/approve$/, async (q, r, [id]) => {
    await orchestrator.approveSpec(id, await readJson(q));
    json(r, 202, { ok: true });
  }],
  ["POST", /^\/sessions\/([\w-]+)\/ocd\/validate$/, async (q, r, [id]) => json(r, 200, await orchestrator.validateOcd(id, await readJson(q)))],
  ["POST", /^\/sessions\/([\w-]+)\/ocd\/transition$/, async (q, r, [id]) => json(r, 200, await orchestrator.transitionOcd(id, await readJson(q)))],
  ["POST", /^\/sessions\/([\w-]+)\/ocd\/approve$/, async (q, r, [id]) => json(r, 200, await orchestrator.approveOcd(id, await readJson(q)))],
  ["GET", /^\/jira\/projects$/, async (_q, r) => json(r, 200, await orchestrator.listJiraProjects())],
  ["GET", /^\/jira\/projects\/([\w-]+)\/active-sprint$/, async (_q, r, [key]) => json(r, 200, await orchestrator.getActiveSprint(key))],
];

const server = createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return json(res, 204);
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  try {
    for (const [method, pattern, handler] of routes) {
      const m = req.method === method ? pattern.exec(path) : null;
      if (m) return await handler(req, res, m.slice(1).map(decodeURIComponent));
    }
    json(res, 404, { error: `No existe ${req.method} ${path}` });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);
    if (status === 500) console.error(e);
    if (!res.headersSent) json(res, status, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`Agente Lanzalo en http://localhost:${PORT} (cerebro: ${brain.name}, mocks: ${process.env.USE_MOCKS !== "false"})`);
});
