/**
 * Cliente HTTP del servicio jurektumba/jira-backend (.NET), que guarda las credenciales de Atlassian.
 * Lo usan tools/jira (historias) y tools/jsm (tickets OCD, que viven en Jira Software).
 *   JIRA_GATEWAY_URL      URL del servicio (ej. http://localhost:8080)
 *   JIRA_GATEWAY_API_KEY  clave compartida (header X-Api-Key), si el servicio la exige
 */
export async function gateway<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  const base = process.env.JIRA_GATEWAY_URL;
  if (!base) throw new Error("Falta JIRA_GATEWAY_URL (URL del servicio jira-backend)");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.JIRA_GATEWAY_API_KEY) headers["X-Api-Key"] = process.env.JIRA_GATEWAY_API_KEY;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`jira-backend respondió ${res.status} en ${method} ${path}: ${text.slice(0, 500)}`);
  return (text ? JSON.parse(text) : null) as T;
}
