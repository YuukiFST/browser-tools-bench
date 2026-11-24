// Applies RANKING-RULE.md to the JSONL data.
//   node analyze.mjs     reads results/e2e, writes analysis.json and tables.md there
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { suiteTools, results as defaultResults } from './paths.mjs';
import { usdPerMillion } from './tokens.mjs';

const results = process.env.OUT ?? defaultResults;
const RESAMPLES = 10_000;
const readRows = file => existsSync(join(results, file)) ? readFileSync(join(results, file), 'utf8').trim().split('\n').map(line => JSON.parse(line)) : [];
const exclusions = existsSync(join(results, 'exclusions.json')) ? JSON.parse(readFileSync(join(results, 'exclusions.json'), 'utf8')) : [];
const sum = values => values.reduce((total, value) => total + value, 0);
const mean = values => sum(values) / values.length;
const quantile = (values, q) => {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (sorted.length - 1) * q;
  return sorted[Math.floor(at)] + (sorted[Math.ceil(at)] - sorted[Math.floor(at)]) * (at - Math.floor(at));
};
const unique = values => [...new Set(values)];
const groupCount = values => values.reduce((counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }), {});

// mulberry32
function random(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bootstrap(values, statistic = mean) {
  const next = random(1);
  const estimates = Array.from({ length: RESAMPLES }, () => statistic(values.map(() => values[Math.floor(next() * values.length)])));
  return [quantile(estimates, 0.025), quantile(estimates, 0.975)];
}

// `a` and `b` hold one value per paired cell, in the same order.
function tied(a, b) {
  const [low, high] = bootstrap(a.map((value, index) => value - b[index]));
  return low <= 0 && high >= 0;
}

// Groups tools whose measure ties with the group's first tool.
function groupsBy(tools, measure) {
  const sorted = [...tools].sort((x, y) => mean(measure(x)) - mean(measure(y)));
  const groups = [];
  for (const tool of sorted) {
    const current = groups.at(-1);
    if (current && tied(measure(tool), measure(current[0]))) current.push(tool);
    else groups.push([tool]);
  }
  return groups;
}

function rank(tools, primary, tieBreak) {
  const eligible = tools.filter(tool => !tool.falsePositives.length && tool.successRate >= 0.95);
  const rest = tools.filter(tool => !eligible.includes(tool));
  const order = group => groupsBy(group, primary).flatMap(sameSpeed => groupsBy(sameSpeed, tieBreak).map(members => ({ members, shared: sameSpeed.length > 1 })));
  let position = 1;
  const ranked = [];
  for (const [contenders, contest] of [[eligible, true], [rest, false]]) {
    for (const { members, shared } of order(contenders)) {
      for (const tool of members) ranked.push({ ...tool, position, contest, tiedOnPrimary: shared, tied: members.length > 1 });
      position += members.length;
    }
  }
  return ranked;
}

const completeRounds = (rows, tools) => unique(rows.map(({ round }) => round)).filter(round => tools.every(tool => rows.some(row => row.round === round && row.tool === tool.name && (tool.cells === undefined || rows.filter(other => other.round === round && other.tool === tool.name).length === tool.cells))));

function analyzeSuites() {
  const rows = readRows('suites.jsonl');
  const suites = rows.filter(({ kind }) => kind === 'suite');
  const probes = rows.filter(({ kind }) => kind === 'probe');
  const tools = suiteTools.filter(name => suites.some(({ tool }) => tool === name));
  const rounds = completeRounds(suites, tools.map(name => ({ name })));
  const perTool = tools.map(name => {
    const runs = rounds.map(round => suites.find(row => row.tool === name && row.round === round));
    const toolProbes = probes.filter(({ tool }) => tool === name);
    const failTokens = mean(toolProbes.map(({ tokens }) => tokens));
    const times = runs.map(({ ms }) => ms / 1000);
    return {
      name, rounds: runs.length, times, median: quantile(times, 0.5), p95: quantile(times, 0.95), timeInterval: bootstrap(times, values => quantile(values, 0.5)),
      successRate: sum(runs.map(({ passed }) => passed)) / sum(runs.map(({ expected }) => expected)),
      executed: sum(runs.map(({ expected }) => expected)), passed: sum(runs.map(({ passed }) => passed)),
      failures: groupCount(runs.filter(({ ok }) => !ok).map(({ failure }) => failure)),
      flaky: runs.some(({ ok }) => ok) && runs.some(({ ok }) => !ok) ? 1 : 0,
      falseNegatives: sum(runs.map(({ expected, passed }) => expected - passed)),
      probes: toolProbes.length, detected: toolProbes.filter(({ detected }) => detected).length,
      falsePositives: toolProbes.filter(({ ok }) => ok).map(({ build }) => build),
      inconclusive: toolProbes.filter(({ ok, detected }) => !ok && !detected).map(({ build, failure }) => `${build} (${failure})`),
      tokensPass: mean(runs.map(({ tokens }) => tokens)), tokensFail: failTokens,
      costs: runs.map(({ tokens }) => (tokens + failTokens) * usdPerMillion.input / 1e6),
    };
  });
  return { rounds, ranking: rank(perTool, ({ times }) => times, ({ costs }) => costs) };
}

function analyzeDrivers() {
  const rows = readRows('drivers.jsonl');
  const setups = readRows('drivers-setup.jsonl').filter(({ error }) => !error);
  const cells = rows.filter(({ kind }) => kind === 'scenario');
  const probes = rows.filter(({ kind }) => kind === 'probe');
  const excluded = new Set(exclusions.filter(({ ranking }) => ranking === 'B').map(({ tool }) => tool));
  const tools = unique(cells.map(({ tool }) => tool)).filter(name => !excluded.has(name));
  const perRound = Math.max(...tools.map(name => cells.filter(row => row.tool === name && row.round === 1).length));
  const rounds = completeRounds(cells, tools.map(name => ({ name, cells: perRound })));
  const perTool = tools.map(name => {
    const byCell = (a, b) => a.round - b.round || a.scenario.localeCompare(b.scenario);
    const runs = cells.filter(row => row.tool === name && rounds.includes(row.round)).sort(byCell);
    const setup = rounds.map(round => setups.find(row => row.tool === name && row.round === round));
    const { docs_tokens: docsTokens, setup_tokens: setupTokens } = setup[0];
    // fixed costs are spread over the cells, so that cells stay comparable between tools
    const fixed = (docsTokens * usdPerMillion.input + setupTokens * usdPerMillion.output) / 1e6 / perRound;
    const startSeconds = mean(setup.map(({ start_ms: ms }) => ms)) / 1000 / perRound;
    const roundTimes = rounds.map((round, index) => (sum(runs.filter(row => row.round === round).map(({ ms }) => ms)) + setup[index].start_ms) / 1000);
    const cellTimes = runs.map(({ ms }) => ms / 1000 + startSeconds);
    const cellCosts = runs.map(row => fixed + (row.tokens_in_commands * usdPerMillion.output + row.tokens_outputs * usdPerMillion.input) / 1e6);
    const toolProbes = probes.filter(({ tool }) => tool === name);
    const scaled = interval => interval.map(value => value * perRound);
    return {
      name, version: setup[0].version, rounds: rounds.length, roundTimes, median: quantile(roundTimes, 0.5), p95: quantile(roundTimes, 0.95),
      scenarioMedian: quantile(runs.map(({ ms }) => ms / 1000), 0.5), scenarioP95: quantile(runs.map(({ ms }) => ms / 1000), 0.95),
      cellTimes, cellCosts, timeInterval: scaled(bootstrap(cellTimes)), cost: mean(cellCosts) * perRound, costInterval: scaled(bootstrap(cellCosts)),
      successRate: runs.filter(({ ok }) => ok).length / runs.length, executed: runs.length, passed: runs.filter(({ ok }) => ok).length,
      failures: groupCount(runs.filter(({ ok }) => !ok).map(({ failure }) => failure)),
      failed: runs.filter(({ ok }) => !ok).map(({ round, scenario, failure, detail }) => ({ round, scenario, failure, detail })),
      flaky: unique(runs.map(({ scenario }) => scenario)).filter(id => unique(runs.filter(({ scenario }) => scenario === id).map(({ ok }) => ok)).length > 1).length,
      falseNegatives: runs.filter(({ ok }) => !ok).length,
      auditMismatch: runs.filter(row => row.ok && row.state_matches === false).length, auditMissing: runs.filter(row => row.state_matches === null).length,
      probes: toolProbes.length, detected: toolProbes.filter(({ detected }) => detected).length,
      falsePositives: toolProbes.filter(({ ok }) => ok).map(({ build }) => build),
      inconclusive: toolProbes.filter(({ ok, detected }) => !ok && !detected).map(({ build, failure }) => `${build} (${failure})`),
      calls: mean(runs.map(({ calls }) => calls)), docsTokens, setupTokens,
      commandTokens: sum(runs.map(row => row.tokens_in_commands)) / rounds.length, outputTokens: sum(runs.map(row => row.tokens_outputs)) / rounds.length,
    };
  });
  return { rounds, ranking: rank(perTool, ({ cellCosts }) => cellCosts, ({ cellTimes }) => cellTimes) };
}

const fixed = (value, digits = 1) => value.toFixed(digits);
const interval = ([low, high], digits) => `[${fixed(low, digits)}, ${fixed(high, digits)}]`;
const usd = value => value.toFixed(4);
const listed = counts => Object.entries(counts).map(([kind, n]) => `${kind} ${n}`).join(', ') || '0';
const place = ({ position, tied: shares, contest }) => `${position}${shares ? ' (empate)' : ''}${contest ? '' : ' (fora da disputa)'}`;
const table = (headers, rows) => [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map(row => `| ${row.join(' | ')} |`)].join('\n');
const common = tool => [`${tool.passed}/${tool.executed}`, listed(tool.failures), tool.flaky, tool.falseNegatives, `${tool.falsePositives.length}/${tool.probes}`, tool.inconclusive.join('; ') || '0'];

const suites = analyzeSuites();
const drivers = analyzeDrivers();
const suiteTable = table(
  ['pos.', 'ferramenta', 'n', 'mediana s [IC 95%]', 'p95 s', 'sucesso', 'falhas', 'flaky', 'falso neg.', 'falso pos.', 'inconclusivos', 'tokens ok / falha', 'US$'],
  suites.ranking.map(tool => [place(tool), tool.name, tool.rounds, `${fixed(tool.median)} ${interval(tool.timeInterval, 1)}`, fixed(tool.p95), ...common(tool), `${fixed(tool.tokensPass, 0)} / ${fixed(tool.tokensFail, 0)}`, usd(mean(tool.costs))]));
const driverTable = table(
  ['pos.', 'ferramenta', 'n', 'US$ por sessão [IC 95%]', 'mediana s da rodada [IC 95% da média]', 'p95 s', 'sucesso', 'falhas', 'flaky', 'falso neg.', 'falso pos.', 'inconclusivos', 'chamadas/cenário', 'tokens docs / comandos / saídas'],
  drivers.ranking.map(tool => [place(tool), tool.name, tool.rounds, `${usd(tool.cost)} ${interval(tool.costInterval, 4)}`, `${fixed(tool.median)} ${interval(tool.timeInterval, 1)}`, fixed(tool.p95), ...common(tool), fixed(tool.calls), `${tool.docsTokens + tool.setupTokens} / ${fixed(tool.commandTokens, 0)} / ${fixed(tool.outputTokens, 0)}`]));
const failureRows = drivers.ranking.flatMap(tool => tool.failed.map(({ round, scenario, failure, detail }) => [tool.name, round, scenario, failure, detail.replace(/\s+/g, ' ').replaceAll('|', '/').slice(0, 160)]));
const exclusionTable = table(['ranking', 'ferramenta', 'erro'], exclusions.map(({ ranking, tool, error }) => [ranking, tool, error.replaceAll('|', '/')]));
const versionTable = table(['ferramenta', 'versão', 'mediana s por cenário', 'p95 s por cenário', 'auditoria divergente', 'auditoria sem página'], drivers.ranking.map(tool => [tool.name, tool.version, fixed(tool.scenarioMedian, 2), fixed(tool.scenarioP95, 2), tool.auditMismatch, tool.auditMissing]));

writeFileSync(join(results, 'tables.md'), `${[
  `## Ranking A\n\n${suiteTable}`, `## Ranking B\n\n${driverTable}`, `## B: versões, tempo por cenário e auditoria\n\n${versionTable}`,
  `## B: falhas no build correto\n\n${failureRows.length ? table(['ferramenta', 'rodada', 'cenário', 'tipo', 'detalhe'], failureRows) : 'Nenhuma.'}`,
  `## Exclusões\n\n${exclusionTable}`,
].join('\n\n')}\n`);
const slim = ({ cellTimes, cellCosts, ...tool }) => tool;
writeFileSync(join(results, 'analysis.json'), `${JSON.stringify({ suites, drivers: { ...drivers, ranking: drivers.ranking.map(slim) } }, null, 1)}\n`);
console.log(suiteTable, '\n\n', driverTable);
