// Analysis of the v2 data and the ranking rule of docs/ranking-rule.md, applied as written.
//   node analyze-v2.mjs [results-dir]       default ../results/v2
// Prints markdown and writes <results-dir>/ranking.json. Every number in the published files comes from here.
import fs from "node:fs";
import path from "node:path";

const DIR = process.argv[2] ?? "../results/v2";
const load = (f) => { const p = path.join(DIR, f); return fs.existsSync(p) ? fs.readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []; };
const TOOLS = ["ab", "axi", "surf", "bh", "pw"];
const NAME = { ab: "agent-browser", axi: "chrome-devtools-axi", surf: "surf-cli", bh: "browser-harness", pw: "playwright-mcp" };
const TASK_EN = { busca: "search", leitura: "read", print: "screenshot", varredura: "sweep" };
const RESAMPLES = 10_000;
const SEED = 20261110;
const FISHER_ALPHA = 0.05;
// the percentile bootstrap is far too narrow on a handful of blocks (n=2 gives [8.0, 8.0]), so fewer paired blocks than this is a tie
const MIN_PAIRED_BLOCKS = 8;

// deterministic RNG so the intervals are reproducible (mulberry32)
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const quantile = (sorted, q) => { const i = (sorted.length - 1) * q; const lo = Math.floor(i); return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo); };
// percentile bootstrap of the mean, resampling whole blocks
function bootstrapMean(values, seed) {
  if (values.length < 2) return { mean: values.length ? values[0] : NaN, lo: NaN, hi: NaN, n: values.length };
  const r = rng(seed), means = new Float64Array(RESAMPLES);
  for (let b = 0; b < RESAMPLES; b += 1) { let s = 0; for (let i = 0; i < values.length; i += 1) s += values[Math.floor(r() * values.length)]; means[b] = s / values.length; }
  means.sort();
  return { mean: mean(values), lo: quantile(means, 0.025), hi: quantile(means, 0.975), n: values.length };
}
// one-sided Fisher exact test: P(X >= a) for a failures in tool A (n1 runs) given total failures, vs tool B (n2 runs)
const logFact = (n) => { let s = 0; for (let i = 2; i <= n; i += 1) s += Math.log(i); return s; };
const logC = (n, k) => logFact(n) - logFact(k) - logFact(n - k);
function fisherGreater(a, n1, b, n2) {
  const k = a + b, N = n1 + n2; let p = 0;
  for (let x = a; x <= Math.min(k, n1); x += 1) p += Math.exp(logC(n1, x) + logC(n2, k - x) - logC(N, k));
  return Math.min(1, p);
}

const agents = load("agents.jsonl").filter((r) => r.kind === "agent");
const baseline = load("baseline.jsonl");
const setup = load("setup.jsonl");
const pilot = load("pilot.jsonl");
const battery = load("battery.jsonl").map((r) => ({ ...r, task: TASK_EN[r.task] ?? r.task }));
const out = [];
const p = (s = "") => out.push(s);
const usd = (x) => Number.isFinite(x) ? x.toFixed(3) : "-";
const fmt = (x, d) => Number.isFinite(x) ? x.toFixed(d) : "-";
const ci = (s, d) => `${fmt(s.mean, d)} [${fmt(s.lo, d)}, ${fmt(s.hi, d)}]`;

// ---------------------------------------------------------------- baseline
const baseCost = baseline.length ? mean(baseline.map((r) => r.cost_usd)) : NaN;
const baseTurns = baseline.length ? mean(baseline.map((r) => r.turns)) : NaN;
p("## Baseline (one-turn prompt, no browser task, same flags)");
p(`runs ${baseline.length}, mean cost US$ ${usd(baseCost)}, mean turns ${fmt(baseTurns, 1)}, ` +
  `mean cache write ${fmt(mean(baseline.map((r) => r.cache_creation_tokens ?? 0)), 0)} tokens, mean cache read ${fmt(mean(baseline.map((r) => r.cache_read_tokens ?? 0)), 0)} tokens`);

// ---------------------------------------------------------------- per-run metrics
// a run with no result event has unknown cost and turns: it counts as a failure and is left out of the metrics
const measured = agents.filter((r) => r.parse_error === null && Number.isFinite(r.turns));
const metric = {
  turns: (r) => r.turns,
  cost_above_baseline: (r) => r.cost_usd - baseCost,
  time_s: (r) => r.ms / 1000,
};
const perBlock = (tool, m) => measured.filter((r) => r.tool === tool).sort((a, b) => a.block - b.block).map((r) => ({ block: r.block, v: metric[m](r) }));

p("\n## Agent runs per tool: mean [bootstrap 95% interval over blocks]");
p("| tool | runs | turns | cost above baseline, US$ | cost, US$ | time, s |\n|---|---|---|---|---|---|");
const stats = {};
TOOLS.forEach((t, k) => {
  const rs = measured.filter((r) => r.tool === t);
  if (!rs.length) return;
  stats[t] = {
    n: rs.length,
    turns: bootstrapMean(rs.map(metric.turns), SEED + k),
    cost_above_baseline: bootstrapMean(rs.map(metric.cost_above_baseline), SEED + 10 + k),
    cost: bootstrapMean(rs.map((r) => r.cost_usd), SEED + 20 + k),
    time_s: bootstrapMean(rs.map(metric.time_s), SEED + 30 + k),
  };
  const s = stats[t];
  p(`| ${NAME[t]} | ${s.n} | ${ci(s.turns, 1)} | ${ci(s.cost_above_baseline, 3)} | ${ci(s.cost, 3)} | ${ci(s.time_s, 1)} |`);
});

// ---------------------------------------------------------------- failures
p("\n## Failures (definition: docs/methodology.md, 'Failure definition')");
p("| tool | agent runs failed / runs | of which no valid reply | battery checks failed / checks |\n|---|---|---|---|");
const fail = {};
for (const t of TOOLS) {
  const rs = agents.filter((r) => r.tool === t), bs = battery.filter((r) => r.tool === t);
  if (!rs.length && !bs.length) continue;
  fail[t] = { failed: rs.filter((r) => !r.ok).length, runs: rs.length };
  p(`| ${NAME[t]} | ${fail[t].failed} / ${rs.length} | ${rs.filter((r) => r.parse_error !== null).length} | ${bs.filter((r) => !r.ok).length} / ${bs.length} |`);
}
const failedBattery = battery.filter((r) => !r.ok);
if (failedBattery.length) {
  p("\nBattery failures by task:");
  for (const t of TOOLS) {
    const by = {}; for (const r of failedBattery.filter((x) => x.tool === t)) by[r.task] = (by[r.task] ?? 0) + 1;
    if (Object.keys(by).length) p(`- ${NAME[t]}: ${Object.entries(by).map(([k, v]) => `${k} ${v}/${battery.filter((x) => x.tool === t && x.task === k).length}`).join(", ")}`);
  }
}

// ---------------------------------------------------------------- ranking rule (docs/ranking-rule.md)
const ranked = TOOLS.filter((t) => stats[t]);
// step 1: failure tiers. A tool's tier is the number of other tools with significantly fewer failed agent runs.
const tier = Object.fromEntries(ranked.map((t) => [t, ranked.filter((u) => u !== t && fisherGreater(fail[t].failed, fail[t].runs, fail[u].failed, fail[u].runs) < FISHER_ALPHA).length]));
// step 2: within a tier, order by mean cost above baseline, then mean turns
const order = [...ranked].sort((a, b) => tier[a] - tier[b] || stats[a].cost_above_baseline.mean - stats[b].cost_above_baseline.mean || stats[a].turns.mean - stats[b].turns.mean);
// step 3: paired per-block difference (next tool minus this tool) on both primary metrics
function pairedDiff(a, b, m, seed) {
  const A = new Map(perBlock(a, m).map((x) => [x.block, x.v])), B = new Map(perBlock(b, m).map((x) => [x.block, x.v]));
  const diffs = [...A.keys()].filter((k) => B.has(k)).map((k) => B.get(k) - A.get(k));
  return bootstrapMean(diffs, seed);
}
const above = (s) => s.lo > 0, below = (s) => s.hi < 0;
const pairs = [];
for (let i = 0; i + 1 < order.length; i += 1) {
  const a = order[i], b = order[i + 1];
  const turns = pairedDiff(a, b, "turns", SEED + 100 + i), cost = pairedDiff(a, b, "cost_above_baseline", SEED + 200 + i), time = pairedDiff(a, b, "time_s", SEED + 300 + i);
  const byFailures = tier[a] !== tier[b];
  const enoughBlocks = Math.min(turns.n, cost.n) >= MIN_PAIRED_BLOCKS;
  const byMetrics = enoughBlocks && (above(turns) || above(cost)) && !below(turns) && !below(cost);
  const reason = byFailures ? "failure tier" : byMetrics ? "primary metric" : enoughBlocks ? "tie" : `tie (under ${MIN_PAIRED_BLOCKS} paired blocks)`;
  pairs.push({ a, b, turns, cost, time, separated: byFailures || byMetrics, reason });
}
// step 4: ties chain along the order; a group's rank is 1 + the number of tools in better groups
const rank = {}; let groupStart = 0;
order.forEach((t, i) => { if (i > 0 && pairs[i - 1].separated) groupStart = i; rank[t] = groupStart + 1; });

p("\n## Paired per-block differences, adjacent tools (next minus this; mean [bootstrap 95% interval])");
p("| pair | blocks | turns | cost above baseline, US$ | time, s (secondary) | result |\n|---|---|---|---|---|---|");
for (const x of pairs) p(`| ${NAME[x.b]} minus ${NAME[x.a]} | ${x.turns.n} | ${ci(x.turns, 1)} | ${ci(x.cost, 3)} | ${ci(x.time, 1)} | ${x.separated ? `separated (${x.reason})` : x.reason} |`);

p("\n## Ranking (docs/ranking-rule.md)");
p("| rank | tool | failure tier |\n|---|---|---|");
for (const t of order) p(`| ${rank[t]} | ${NAME[t]} | ${tier[t]} |`);
const rankOneTied = order.filter((t) => rank[t] === 1);
p(`\nRank 1 is ${rankOneTied.length > 1 ? `tied: ${rankOneTied.map((t) => NAME[t]).join(", ")}` : `held alone by ${NAME[rankOneTied[0]] ?? "-"}`}.`);

// ---------------------------------------------------------------- spend
const spent = [...agents, ...baseline, ...setup, ...pilot].reduce((s, r) => s + (r.cost_usd ?? 0), 0);
p(`\n## Spend\nagent runs US$ ${usd(agents.reduce((s, r) => s + r.cost_usd, 0))}, baseline US$ ${usd(baseline.reduce((s, r) => s + r.cost_usd, 0))}, setup checks US$ ${usd(setup.reduce((s, r) => s + r.cost_usd, 0))}, pilot US$ ${usd(pilot.reduce((s, r) => s + r.cost_usd, 0))}, total US$ ${usd(spent)}`);
const models = [...new Set(agents.flatMap((r) => r.models_used))], versions = [...new Set(agents.map((r) => r.claude_version))];
const days = [...new Set(agents.map((r) => r.ts.slice(0, 10)))];
p(`models used: ${models.join(", ") || "-"}; claude: ${versions.join(", ") || "-"}; days: ${days.join(", ") || "-"}; blocks: ${new Set(agents.map((r) => r.block)).size}`);

console.log(out.join("\n"));
fs.writeFileSync(path.join(DIR, "ranking.json"), JSON.stringify({ baseline: { runs: baseline.length, cost: baseCost, turns: baseTurns }, stats, fail, tier, order, rank, pairs, spent, models, versions, days }, null, 1) + "\n");
