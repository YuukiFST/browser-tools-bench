// Scores readings/ per table cell: each innerText line of <main> is split on tabs, cells of 2+ characters kept.
//   node score-coverage.mjs [out-file] [readings-dir]       defaults: ../results/v2/coverage.jsonl, readings
// Reads every <readings-dir>/<mode><slug>-r<k>.txt that has a matching <readings-dir>/ground-truth<slug>-r<k>.txt.
// `chars` is the raw character count of the tool output, not a token estimate.
import fs from "node:fs";

const OUT = process.argv[2] ?? "../results/v2/coverage.jsonl";
const READINGS = process.argv[3] ?? "readings";
const MODES = ["ab", "ab-i", "axi", "axi-full", "surf", "surf-text", "bh", "bh-text", "pw", "bx"];
const LABEL = { bh: "bh (custom snippet)", "bh-text": "bh innerText" };
const norm = (s) => s.replace(/\\"/g, '"').replace(/\s+/g, " ").trim();

const out = [];
for (const gtFile of fs.readdirSync(READINGS).filter((f) => /^ground-truth.*-r\d+\.txt$/.test(f)).sort()) {
  const [, slug, rep] = gtFile.match(/^ground-truth(.*)-r(\d+)\.txt$/);
  const cells = [...new Set(fs.readFileSync(`${READINGS}/${gtFile}`, "utf8").split(/\n|\t/).map(norm).filter((x) => x.length >= 2))];
  if (cells.length === 0) { console.error(`skip ${gtFile}: empty ground truth`); continue; }
  for (const mode of MODES) {
    const f = `${READINGS}/${mode}${slug}-r${rep}.txt`;
    if (!fs.existsSync(f)) continue;
    const o = norm(fs.readFileSync(f, "utf8"));
    const found = cells.filter((c) => o.includes(c)).length;
    out.push({ route: slug.replaceAll("_", "/"), rep: +rep, mode, label: LABEL[mode] ?? mode, cells: cells.length, found, coverage: +(found / cells.length * 100).toFixed(1), chars: o.length });
  }
}
fs.writeFileSync(OUT, out.map((x) => JSON.stringify(x)).join("\n") + "\n");

const routes = [...new Set(out.map((x) => x.route))];
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
console.log(`| mode | ${routes.join(" | ")} |\n|---|${routes.map(() => "---").join("|")}|`);
for (const m of MODES) {
  const rs = out.filter((x) => x.mode === m);
  if (!rs.length) continue;
  const cell = (r) => { const xs = rs.filter((x) => x.route === r); return xs.length ? `${median(xs.map((x) => x.coverage))}% (${median(xs.map((x) => x.chars)).toLocaleString("en-US")} chars, n=${xs.length})` : "-"; };
  console.log(`| ${LABEL[m] ?? m} | ${routes.map(cell).join(" | ")} |`);
}
