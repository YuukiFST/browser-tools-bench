// Ranking B: every driver runs the same scenarios, each tool-round in a fresh Chrome and profile.
//   node run-drivers.mjs <rounds> <budget-minutes> [tool,...]     appends to $OUT/drivers.jsonl and drivers-setup.jsonl
// ONLY=<scenario id> limits the scenarios; PROBES=0 skips the defect builds.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startAppServer } from './app-server.mjs';
import { browseExtension, browsePairedMark, browseProfile } from './browse-env.mjs';
import { connectBrowser, evaluate, pageState } from './cdp.mjs';
import { startChrome } from './chrome.mjs';
import { defects } from './defects.mjs';
import { agentBrowser, axi, browserUse, bx, surf, ToolError } from './drive-cli.mjs';
import { browseExecute, flashwrightMcpAdaptive, flashwrightMcpCode, flashwrightMcpSteps, playwrightMcpCode, playwrightMcpSteps } from './drive-mcp.mjs';
import { deps, logs, results } from './paths.mjs';
import { holds, scenarios } from './scenario-model.mjs';
import { countTokens } from './tokens.mjs';

const SCENARIO_TIMEOUT_MS = 60_000;

const drivers = {
  bx: { create: bx },
  'agent-browser': { create: agentBrowser },
  surf: { create: surf, extension: join(deps, 'node_modules/surf-cli/dist') },
  'browser-use': { create: browserUse },
  'chrome-devtools-axi': { create: axi },
  'playwright-mcp:steps': { create: playwrightMcpSteps },
  'playwright-mcp:code': { create: playwrightMcpCode },
  'flashwright-mcp:steps': { create: flashwrightMcpSteps },
  'flashwright-mcp:adaptive': { create: flashwrightMcpAdaptive },
  'flashwright-mcp:code': { create: flashwrightMcpCode },
  ...(existsSync(browsePairedMark) && { 'browse:execute': { create: browseExecute, extension: browseExtension, profile: browseProfile } }),
};

const [roundsArg = '1', budgetArg = '40', toolsArg] = process.argv.slice(2);
const tools = toolsArg?.split(',') ?? Object.keys(drivers);
const deadline = Date.now() + Number(budgetArg) * 60_000;
const out = process.env.OUT ?? results;
mkdirSync(out, { recursive: true });
mkdirSync(logs, { recursive: true });
const append = (file, row) => appendFileSync(join(out, file), `${JSON.stringify(row)}\n`);
const selected = scenarios.filter(({ id }) => !process.env.ONLY || id === process.env.ONLY);
const { finalStates } = JSON.parse(readFileSync(join(results, 'oracle.json'), 'utf8'));
const app = await startAppServer();

function errorKind(error) {
  if (error.name === 'AbortError' || error.message === 'scenario timeout') return 'timeout';
  if (!(error instanceof ToolError)) return 'crash';
  if (/not found|no element|missing ref|does not match|0 elements|could not find/i.test(error.message)) return 'element-not-found';
  if (/timed? ?out|timeout/i.test(error.message)) return 'timeout';
  return 'crash';
}

// The page state after the scenario, read over CDP by origin: an audit, not part of the verdict.
async function auditState(port, url) {
  const client = await connectBrowser(port);
  try {
    const { targetInfos } = await client.send('Target.getTargets');
    const target = targetInfos.find(info => info.type === 'page' && info.url.startsWith(url));
    if (!target) return null;
    const { sessionId } = await client.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    return await evaluate(client, sessionId, pageState);
  } finally {
    client.close();
  }
}

async function runScenario(driver, scenario, build, port) {
  const url = app.freshUrl(build);
  const transcript = [];
  const abort = new AbortController();
  const record = async (input, execute) => {
    const entry = { input, output: '' };
    transcript.push(entry);
    try {
      const result = await execute();
      entry.output = result.output;
      return result;
    } catch (error) {
      entry.output = error.output ?? error.message;
      throw error;
    }
  };
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => { reject(new Error('scenario timeout')); abort.abort(); }, SCENARIO_TIMEOUT_MS); });
  const started = performance.now();
  let failure = null;
  let detail = '';
  try {
    const values = await Promise.race([driver.run(url, scenario.steps, { record, signal: abort.signal }), timeout]);
    const asserts = scenario.steps.filter(({ action }) => action === 'assert');
    const wrong = asserts.findIndex((step, index) => !holds(step, values[index]));
    if (values.length !== asserts.length) {
      failure = 'crash';
      detail = `${values.length} values for ${asserts.length} assertions`;
    } else if (wrong !== -1) {
      failure = 'assertion';
      detail = `${asserts[wrong].read}: expected ${JSON.stringify(asserts[wrong].expected)}, got ${JSON.stringify(values[wrong])}`;
    }
  } catch (error) {
    failure = errorKind(error);
    detail = error.message.slice(0, 400);
  }
  const ms = Math.round(performance.now() - started);
  clearTimeout(timer);
  const state = await auditState(port, url).catch(() => null);
  return {
    ms, ok: !failure, failure, detail, calls: transcript.length,
    tokens_in_commands: transcript.reduce((sum, { input }) => sum + countTokens(input), 0),
    tokens_outputs: transcript.reduce((sum, { output }) => sum + countTokens(output), 0),
    state, transcript,
  };
}

async function runToolRound(tool, round) {
  const { create, extension, profile } = drivers[tool];
  const chrome = await startChrome({ extension, profile });
  const session = `e2e${round}x${Date.now().toString(36)}`;
  const driver = create({ port: chrome.port, session });
  const transcripts = [];
  const measure = async (kind, scenario, build) => {
    const { transcript, state, ...row } = await runScenario(driver, scenario, build, chrome.port);
    const common = { ts: new Date().toISOString(), tool, round, kind, build, scenario: scenario.id };
    if (kind === 'probe') row.detected = row.failure === 'assertion';
    else row.state_matches = state ? JSON.stringify(state) === JSON.stringify(finalStates[scenario.id]) : null;
    append('drivers.jsonl', { ...common, ...row });
    transcripts.push({ ...common, ok: row.ok, detail: row.detail, transcript });
    return row;
  };
  try {
    const started = performance.now();
    if (driver.start) await driver.start();
    const startMs = Math.round(performance.now() - started);
    append('drivers-setup.jsonl', {
      ts: new Date().toISOString(), tool, round, start_ms: startMs, version: await driver.version(),
      docs_tokens: countTokens(await driver.docs()), setup_tokens: countTokens(driver.setupText ?? ''),
    });
    const rows = [];
    for (const scenario of selected) rows.push(await measure('scenario', scenario, 'healthy'));
    if (round === 1 && process.env.PROBES !== '0')
      for (const { id, probe } of defects) await measure('probe', scenarios.find(scenario => scenario.id === probe), id);
    const passed = rows.filter(({ ok }) => ok).length;
    console.log(`r${round} ${tool.padEnd(26)} ${passed}/${rows.length} ok, ${rows.reduce((sum, { ms }) => sum + ms, 0)} ms, ${rows.reduce((sum, { calls }) => sum + calls, 0)} calls`);
  } catch (error) {
    append('drivers-setup.jsonl', { ts: new Date().toISOString(), tool, round, error: error.message.slice(0, 600) });
    console.log(`r${round} ${tool} did not start: ${error.message.slice(0, 300)}`);
  } finally {
    await driver.stop().catch(error => console.log(`${tool} stop: ${error.message}`));
    await chrome.stop();
    writeFileSync(join(logs, `driver-${tool.replace(':', '-')}-r${round}.json`), JSON.stringify(transcripts, null, 1));
  }
}

for (let round = 1; round <= Number(roundsArg); round++) {
  const roundStart = Date.now();
  for (const tool of tools.map((_, index) => tools[(index + round - 1) % tools.length])) {
    if (Date.now() > deadline) break;
    await runToolRound(tool, round);
  }
  if (Date.now() + (Date.now() - roundStart) > deadline) break;
}
app.close();
process.exit(0);
