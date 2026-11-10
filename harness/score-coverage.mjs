// Re-scores coverage per cell: each innerText line is split on tabs.
import fs from "node:fs";
const n = (s) => s.replace(/\\"/g, '"').replace(/\s+/g, " ").trim();
const out = [];
for (const route of ["_dashboard", "_debitos", "_inscricoes"]) {
  const g = [...new Set(fs.readFileSync(`readings/ground-truth${route}.txt`, "utf8").split(/\n|\t/).map(n).filter((x) => x.length >= 2))];
  for (const mode of ["ab", "ab-i", "axi", "axi-full", "surf", "surf-text", "bh", "bh-text", "pw"]) {
    const o = n(fs.readFileSync(`readings/${mode}${route}.txt`, "utf8"));
    const hit = g.filter((l) => o.includes(l)).length;
    out.push({ route, mode, cells: g.length, found: hit, coverage: +(hit / g.length * 100).toFixed(1), tokens: Math.round(o.length / 4) });
  }
}
fs.writeFileSync("coverage.jsonl", out.map((x) => JSON.stringify(x)).join("\n") + "\n");
const modes = [...new Set(out.map((x) => x.mode))];
console.log("| mode | dashboard | debitos | inscricoes |\n|---|---|---|---|");
for (const m of modes) console.log(`| ${m} | ${out.filter((x) => x.mode === m).map((x) => `${x.coverage}% (${x.tokens} tok)`).join(" | ")} |`);
