// Turns one raw `claude -p --output-format stream-json --verbose` transcript into one agents.jsonl row.
//   node score-agent.mjs <raw.jsonl> <meta-json>
// meta: {tool, block, pos, ts, ms, exit_code, png, model_requested, claude_version, tool_version, docs_chars, kind}
// A reply that is not a valid stream-json result is still a row, with ok=false and parse_error set.
import fs from "node:fs";

const [rawFile, metaJson] = process.argv.slice(2);
const meta = JSON.parse(metaJson);

const events = [];
let badLines = 0;
for (const line of (fs.existsSync(rawFile) ? fs.readFileSync(rawFile, "utf8") : "").split("\n")) {
  if (!line.trim()) continue;
  try { events.push(JSON.parse(line)); } catch { badLines += 1; }
}
const result = events.findLast((e) => e.type === "result");
const init = events.find((e) => e.type === "system" && e.subtype === "init");

// one assistant message can arrive as several events that share message.id; the last one carries the final usage
const turnUsage = new Map();
for (const e of events) if (e.type === "assistant" && e.message?.id) turnUsage.set(e.message.id, e.message.usage ?? {});
const perTurn = [...turnUsage.values()].map((u) => ({
  in: u.input_tokens ?? 0, out: u.output_tokens ?? 0,
  cache_read: u.cache_read_input_tokens ?? 0, cache_write: u.cache_creation_input_tokens ?? 0,
}));

const isAgentTask = meta.kind !== "baseline";
let correct = 0, total = 0, extras = 0, problems = "", replyParsed = false;
if (isAgentTask) {
  const truth = fs.readFileSync("ground-truth/agent.txt", "utf8").trim().split("\n").map((l) => l.trim().split("|"));
  total = truth.length;
  let reply = {};
  try { reply = JSON.parse((result?.result?.match(/\{[\s\S]*\}/) ?? ["{}"])[0]); replyParsed = Array.isArray(reply.registrations); } catch {}
  const got = new Map((reply.registrations ?? []).map((x) => [x.registration, x.unit]));
  correct = truth.filter(([reg, unit]) => got.get(reg) === unit).length;
  extras = got.size - correct;
  problems = String(reply.problems ?? "").slice(0, 160);
}
let screenshotPx = 0;
try { screenshotPx = fs.readFileSync(meta.png).readUInt32BE(16); } catch {}

const u = result?.usage ?? {};
const parseError = !result ? `no result event (${events.length} events, ${badLines} non-JSON lines, exit ${meta.exit_code})` : null;
const isError = !result || result.is_error === true;
const ok = isAgentTask
  ? !isError && replyParsed && correct === total && extras === 0 && (screenshotPx === 390 || screenshotPx === 780)
  : !isError;

const row = {
  kind: meta.kind, tool: meta.tool, block: meta.block, pos: meta.pos, ts: meta.ts,
  model_requested: meta.model_requested, models_used: Object.keys(result?.modelUsage ?? {}),
  claude_version: meta.claude_version, tool_version: meta.tool_version, docs_chars: meta.docs_chars,
  init_mcp_servers: (init?.mcp_servers ?? []).map((s) => `${s.name}:${s.status}`), init_tool_count: init?.tools?.length ?? null,
  init_skill_count: init?.skills?.length ?? null, init_plugin_count: init?.plugins?.length ?? null,
  ok, correct, total, extras, screenshot_px: screenshotPx, is_error: isError, parse_error: parseError, exit_code: meta.exit_code,
  cost_usd: result?.total_cost_usd ?? 0, turns: result?.num_turns ?? null, ms: meta.ms, api_ms: result?.duration_api_ms ?? null,
  input_tokens: u.input_tokens ?? null, output_tokens: u.output_tokens ?? null,
  cache_read_tokens: u.cache_read_input_tokens ?? null, cache_creation_tokens: u.cache_creation_input_tokens ?? null,
  per_turn: perTurn, problems,
};
console.log(JSON.stringify(row));
