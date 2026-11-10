// Removes client data from the free-text `problems` field of published agent rows, in place.
//   node redact-results.mjs [results-dir]        default ../results/v2; needs ground-truth/ and BENCH_QUERY
// Replaced: the search term, ground-truth registrations and units, any registration-shaped number,
// and runs of 2+ uppercase words (company and development names in this app are written in capitals).
import fs from "node:fs";
import path from "node:path";

const DIR = process.argv[2] ?? "../results/v2";
const query = process.env.BENCH_QUERY;
if (!query) { console.error("set BENCH_QUERY (source creds.sh)"); process.exit(2); }
const terms = new Set([query]);
for (const line of fs.readFileSync("ground-truth/agent.txt", "utf8").trim().split("\n")) for (const x of line.trim().split("|")) if (x.trim()) terms.add(x.trim());
const sorted = [...terms].sort((a, b) => b.length - a.length);
const redact = (s) => {
  let o = s;
  for (const t of sorted) o = o.split(t).join("<CLIENT>");
  return o
    .replace(/\d{2}\.\d\.\d{2}\.\d{3}\.\d{4}\.\d{3}/g, "<REGISTRATION>")
    .replace(/\b[A-ZÀ-Ý0-9]{2,}(?:\s+[A-ZÀ-Ý0-9]{2,})+\b/g, (m) => (/^(JSON|URL|HTTP|API|CDP|MCP)(\s|$)/.test(m) && !/\s[A-ZÀ-Ý]{4,}/.test(m) ? m : "<CLIENT>"));
};
for (const f of ["agents.jsonl", "pilot.jsonl"]) {
  const p = path.join(DIR, f);
  if (!fs.existsSync(p)) continue;
  const rows = fs.readFileSync(p, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  let changed = 0;
  for (const r of rows) { const n = redact(r.problems); if (n !== r.problems) { r.problems = n; changed += 1; } }
  fs.writeFileSync(p, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`${f}: ${changed} of ${rows.length} problems fields redacted`);
}
