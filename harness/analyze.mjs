// Summarizes battery.jsonl and latency.jsonl into markdown tables.
//   node analyze.mjs [battery-file]
import fs from "node:fs";

const load = (f) => fs.existsSync(f)
  ? fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : [];
const res = load(process.argv[2] ?? "battery.jsonl");
const lat = load("latency.jsonl");
const TOOLS = ["ab", "axi", "surf", "bh", "pw"];
const NAME = { ab: "agent-browser", axi: "chrome-devtools-axi", surf: "surf-cli", bh: "browser-harness", pw: "playwright-mcp" };
const TASKS = ["login", "search", "read", "screenshot", "console", "mobile", "sweep"];

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const p90 = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.ceil(0.9 * s.length) - 1)] : NaN; };
const tok = (c) => Math.round(c / 4); // estimate: ~4 characters per token

const lines = [];
const table = (title, head, rows) => { lines.push(`\n### ${title}\n`, `| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)); };

const cell = (fn) => TASKS.map((t) => [t, ...TOOLS.map((f) => fn(res.filter((r) => r.tool === f && r.task === t)))]);
table("Time (median / p90, s)", ["task", ...TOOLS.map((f) => NAME[f])],
  cell((rs) => rs.length ? `${(median(rs.map((r) => r.ms)) / 1000).toFixed(1)} / ${(p90(rs.map((r) => r.ms)) / 1000).toFixed(1)}` : "-"));
table("Success (ok / runs)", ["task", ...TOOLS.map((f) => NAME[f])],
  cell((rs) => rs.length ? `${rs.filter((r) => r.ok).length}/${rs.length}` : "-"));
table("CLI calls (median)", ["task", ...TOOLS.map((f) => NAME[f])],
  cell((rs) => rs.length ? String(median(rs.map((r) => r.cmds))) : "-"));
table("Output returned to the agent (median, estimated tokens = characters/4)", ["task", ...TOOLS.map((f) => NAME[f])],
  cell((rs) => rs.length ? tok(median(rs.map((r) => r.chars))).toLocaleString("en-US") : "-"));

const tot = (f, field) => TASKS.reduce((s, t) => s + median(res.filter((r) => r.tool === f && r.task === t).map((r) => r[field])), 0);
table("Battery total (sum of the medians of the 7 tasks)", ["metric", ...TOOLS.map((f) => NAME[f])], [
  ["time (s)", ...TOOLS.map((f) => (tot(f, "ms") / 1000).toFixed(1))],
  ["calls", ...TOOLS.map((f) => String(tot(f, "cmds")))],
  ["estimated tokens", ...TOOLS.map((f) => tok(tot(f, "chars")).toLocaleString("en-US"))],
  ["success", ...TOOLS.map((f) => { const rs = res.filter((r) => r.tool === f); return `${rs.filter((r) => r.ok).length}/${rs.length}`; })],
]);

if (lat.length) {
  const warm = (f) => fs.existsSync(`warm-${f}.txt`) ? fs.readFileSync(`warm-${f}.txt`, "utf8").split("\n").filter(Boolean).map(Number) : [];
  table("Latency (ms)", ["metric", ...TOOLS.map((f) => NAME[f])], [
    ["cold start, median", ...TOOLS.map((f) => String(median(lat.filter((l) => l.tool === f).map((l) => l.cold_ms))))],
    ["warm trivial call, median", ...TOOLS.map((f) => String(median(warm(f))))],
    ["warm trivial call, p90", ...TOOLS.map((f) => String(p90(warm(f))))],
  ]);
}
console.log(lines.join("\n"));
