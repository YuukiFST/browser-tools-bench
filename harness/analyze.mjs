// Summarizes a battery file plus latency.jsonl and warm-<tool>.txt into markdown tables.
//   node analyze.mjs [battery-file] [latency-dir]      defaults: battery.jsonl, the battery file's directory
// Accepts the Portuguese task names of the published v1 data (busca, leitura, print, varredura).
import fs from "node:fs";
import path from "node:path";

const load = (f) => fs.existsSync(f)
  ? fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : [];
const batteryFile = process.argv[2] ?? "battery.jsonl";
const latencyDir = process.argv[3] ?? path.dirname(batteryFile);
const TASK_EN = { busca: "search", leitura: "read", print: "screenshot", varredura: "sweep" };
const res = load(batteryFile).map((r) => ({ ...r, task: TASK_EN[r.task] ?? r.task }));
const latAll = load(path.join(latencyDir, "latency.jsonl"));
const lat = latAll.filter((l) => Number.isFinite(l.cold_ms));
const TOOLS = ["ab", "axi", "surf", "bh", "pw"];
const NAME = { ab: "agent-browser", axi: "chrome-devtools-axi", surf: "surf-cli", bh: "browser-harness", pw: "playwright-mcp" };
const TASKS = ["login", "search", "read", "screenshot", "console", "mobile", "sweep"];

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const p90 = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.ceil(0.9 * s.length) - 1)] : NaN; };
const show = (x, fmt) => Number.isFinite(x) ? fmt(x) : "-";

const lines = [];
const table = (title, head, rows) => { lines.push(`\n### ${title}\n`, `| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)); };

const cell = (fn) => TASKS.map((t) => [t, ...TOOLS.map((f) => fn(res.filter((r) => r.tool === f && r.task === t)))]);
table("Time (median / p90, s)", ["task", ...TOOLS.map((f) => NAME[f])],
  cell((rs) => rs.length ? `${(median(rs.map((r) => r.ms)) / 1000).toFixed(1)} / ${(p90(rs.map((r) => r.ms)) / 1000).toFixed(1)}` : "-"));
table("Success (ok / runs)", ["task", ...TOOLS.map((f) => NAME[f])],
  cell((rs) => rs.length ? `${rs.filter((r) => r.ok).length}/${rs.length}` : "-"));
table("CLI calls (median)", ["task", ...TOOLS.map((f) => NAME[f])],
  cell((rs) => rs.length ? String(median(rs.map((r) => r.cmds))) : "-"));
table("Output returned to the agent (median, characters)", ["task", ...TOOLS.map((f) => NAME[f])],
  cell((rs) => rs.length ? median(rs.map((r) => r.chars)).toLocaleString("en-US") : "-"));

// a tool missing a task gets "-" instead of a partial sum
const tot = (f, field) => {
  const meds = TASKS.map((t) => median(res.filter((r) => r.tool === f && r.task === t).map((r) => r[field])));
  return meds.every(Number.isFinite) ? meds.reduce((s, x) => s + x, 0) : NaN;
};
table("Battery total (sum of the medians of the 7 tasks)", ["metric", ...TOOLS.map((f) => NAME[f])], [
  ["time (s)", ...TOOLS.map((f) => show(tot(f, "ms"), (x) => (x / 1000).toFixed(1)))],
  ["calls", ...TOOLS.map((f) => show(tot(f, "cmds"), String))],
  ["characters", ...TOOLS.map((f) => show(tot(f, "chars"), (x) => x.toLocaleString("en-US")))],
  ["success", ...TOOLS.map((f) => { const rs = res.filter((r) => r.tool === f); return rs.length ? `${rs.filter((r) => r.ok).length}/${rs.length}` : "-"; })],
]);

if (lat.length) {
  const warm = (f) => { const p = path.join(latencyDir, `warm-${f}.txt`); return fs.existsSync(p) ? fs.readFileSync(p, "utf8").split("\n").filter(Boolean).map(Number) : []; };
  const kind = (f) => lat.find((l) => l.tool === f)?.cold_kind ?? "process stopped";
  table("Latency (ms)", ["metric", ...TOOLS.map((f) => NAME[f])], [
    ["cold start, median", ...TOOLS.map((f) => show(median(lat.filter((l) => l.tool === f).map((l) => l.cold_ms)), (x) => `${x}${kind(f) === "new session" ? " (new session)" : ""}`))],
    ["warm trivial call, median", ...TOOLS.map((f) => show(median(warm(f)), String))],
    ["warm trivial call, p90", ...TOOLS.map((f) => show(p90(warm(f)), String))],
    ["trivial calls failed", ...TOOLS.map((f) => {
      const ws = latAll.filter((l) => l.tool === f && Number.isFinite(l.warm_failed)), cold = lat.filter((l) => l.tool === f);
      return ws.length ? `${ws.reduce((s, l) => s + l.warm_failed, 0) + cold.filter((l) => l.trivial_ok === false).length} / ${ws.reduce((s, l) => s + l.warm_calls, 0) + cold.length}` : "-";
    })],
  ]);
}
console.log(lines.join("\n"));
