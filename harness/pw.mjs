// Minimal MCP client (Streamable HTTP) to call playwright-mcp from the shell, like the other CLIs.
//   node pw.mjs <tool> ['{"arg":"value"}']     prints only the text the model would receive
//   node pw.mjs --list                         tool schemas (fixed context cost of the MCP)
// The MCP session is kept in pw-session.txt so consecutive calls reuse the same browser.
import fs from "node:fs";
import path from "node:path";

const MCP_URL = process.env.PW_MCP_URL ?? "http://localhost:8931/mcp";
const SESSION_FILE = path.join(import.meta.dirname, "pw-session.txt");

async function rpc(body, session) {
  const r = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(session ? { "Mcp-Session-Id": session } : {}),
    },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  const payload = r.headers.get("content-type")?.includes("event-stream")
    ? txt.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5)).pop()
    : txt;
  return { session: r.headers.get("mcp-session-id") ?? session, msg: payload ? JSON.parse(payload) : null };
}

async function getSession() {
  if (fs.existsSync(SESSION_FILE)) return fs.readFileSync(SESSION_FILE, "utf8").trim();
  const { session: s } = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "bench", version: "1" } } });
  await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }, s);
  fs.writeFileSync(SESSION_FILE, s);
  return s;
}

const [name, args] = process.argv.slice(2);
const s = await getSession();
if (name === "--list") {
  const { msg } = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, s);
  console.log(JSON.stringify(msg.result.tools));
  process.exit(0);
}
const { msg } = await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name, arguments: args ? JSON.parse(args) : {} } }, s);
if (msg?.error) { console.log(`error: ${msg.error.message}`); process.exit(1); }
const parts = msg.result.content ?? [];
for (const p of parts) {
  if (p.type === "text") console.log(p.text);
  else console.log(`[${p.type} ${p.mimeType ?? ""} ${p.data ? Math.round(p.data.length * 0.75 / 1024) + " KB" : ""}]`);
}
process.exit(msg.result.isError ? 1 : 0);
