// Ranking A: the complete test command of each framework, on the healthy build and on the defect builds.
//   node run-suites.mjs <rounds> <budget-minutes> [tool,...]     appends to $OUT/suites.jsonl
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startAppServer } from './app-server.mjs';
import { defects } from './defects.mjs';
import { failedTests, failureKind } from './failure-kind.mjs';
import { bunPath, chromePath, chromedriverPath, competitorsDirectory, logs, results, suiteTools } from './paths.mjs';
import { countTokens } from './tokens.mjs';
import { scenarios } from './vendor/flashwright/bench/competitors/scenarios.mjs';

const SUITE_TIMEOUT_MS = 180_000;
const [roundsArg = '1', budgetArg = '20', toolsArg] = process.argv.slice(2);
const tools = toolsArg?.split(',') ?? suiteTools;
const deadline = Date.now() + Number(budgetArg) * 60_000;
const out = process.env.OUT ?? results;
const outFile = join(out, 'suites.jsonl');
mkdirSync(out, { recursive: true });
mkdirSync(logs, { recursive: true });

// A coding agent's environment makes some runners switch reporters; CI has none of these.
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(CLAUDE|AI_AGENT|CODEX|CURSOR)/i.test(name)));
const adapters = Object.fromEntries(await Promise.all(tools.map(async tool => [tool, (await import(pathToFileURL(join(competitorsDirectory, tool, 'adapter.mjs')))).default])));

// Grouped layout: each feature's tests in one file, as most hand-written suites do.
const groupedScenarios = only => scenarios.filter(({ file }) => !only || file === only).map(scenario => ({ ...scenario, file: scenario.file.split('/')[0] }));

// Nightwatch restarts ChromeDriver per file on port 9515, which Windows may not have released yet: port 0 picks a free one.
function writeSuite(tool, only) {
  const directory = join(competitorsDirectory, tool);
  rmSync(join(directory, 'tests'), { recursive: true, force: true });
  for (const { path, contents } of adapters[tool].files(groupedScenarios(only))) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), tool === 'nightwatch' ? contents.replace('start_process: true,', 'start_process: true, port: 0,') : contents);
  }
}

function runSuite(tool, appUrl) {
  const env = { CHROME_PATH: chromePath, CHROMEDRIVER_PATH: chromedriverPath, WORKERS: '1', CI: '1', NO_COLOR: '1', FORCE_COLOR: '0', APP_URL: appUrl };
  const { command, args, env: extraEnv } = adapters[tool].command({ workers: 1, node: process.execPath, bun: bunPath, env });
  return new Promise(resolve => {
    const started = performance.now();
    const child = spawn(command, args, { cwd: join(competitorsDirectory, tool), env: { ...cleanEnv, ...env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f']); }, SUITE_TIMEOUT_MS);
    child.stdout.on('data', chunk => output += chunk);
    child.stderr.on('data', chunk => output += chunk);
    child.on('error', error => output += `spawn failed: ${error.message}`);
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ ms: Math.round(performance.now() - started), code, timedOut, output, passed: adapters[tool].passed(tool === 'nightwatch' ? output.replaceAll('√', '✔') : output) });
    });
  });
}

const app = await startAppServer();

async function measure(tool, round, kind, build, only) {
  writeSuite(tool, only);
  const expected = groupedScenarios(only).length;
  const run = await runSuite(tool, app.url(build));
  const failed = failedTests[tool](run.output);
  const row = {
    ts: new Date().toISOString(), tool, round, kind, build, expected, passed: run.passed, failed, exit: run.code, ms: run.ms,
    tokens: countTokens(run.output), ok: run.code === 0 && run.passed === expected,
  };
  if (!row.ok) row.failure = failureKind({ ...run, failed });
  // A run with no test result is not a detected defect.
  if (kind === 'probe') row.detected = run.code !== 0 && run.passed === 0 && failed === expected;
  appendFileSync(outFile, `${JSON.stringify(row)}\n`);
  const unexpected = kind === 'probe' ? !row.detected : !row.ok;
  if (unexpected || kind === 'probe' || round === 0) writeFileSync(join(logs, `suite-${tool}-r${round}-${build}.log`), run.output);
  console.log(`r${round} ${tool.padEnd(12)} ${build.padEnd(26)} ${String(run.ms).padStart(6)} ms ${run.passed}/${expected} exit ${run.code}${row.failure ? ` ${row.failure}` : ''}${kind === 'probe' ? (row.detected ? ' detected' : ' NOT DETECTED') : ''}`);
}

const rotated = round => tools.map((_, index) => tools[(index + round) % tools.length]);
for (const tool of rotated(0))
  for (const { id, probe } of defects)
    if (Date.now() < deadline) await measure(tool, 0, 'probe', id, probe);
for (let round = 1; round <= Number(roundsArg); round++) {
  const roundStart = Date.now();
  for (const tool of rotated(round)) {
    if (Date.now() > deadline) break;
    await measure(tool, round, 'suite', 'healthy');
  }
  if (Date.now() + (Date.now() - roundStart) > deadline) break;
}
app.close();
