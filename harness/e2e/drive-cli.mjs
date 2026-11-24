// Ranking B, command-line tools. Each driver turns a scenario into the commands an agent would type,
// in the shape the tool's own docs show. Consecutive assertions are read together, with one page
// expression, and returned as values: the runner compares them with the scenario.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deps, vendor } from './paths.mjs';
import { readExpression } from './scenario-model.mjs';

const modules = join(deps, 'node_modules');
const NEW_FIELD = 'What needs to be done?';
const EDIT_FIELD = '.todo-list li.editing .edit';
const TOGGLE_ALL = 'label[for=toggle-all]';

export class ToolError extends Error {}

// Runs one command and returns its stdout. `signal` kills it when the scenario times out.
function execute(command, args, { env, input = '', signal, allowFailure = false }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, signal, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => stdout += chunk);
    child.stderr.on('data', chunk => stderr += chunk);
    child.on('error', reject);
    child.on('close', code => {
      const output = stderr ? `${stdout}${stderr}` : stdout;
      if (code === 0 || allowFailure) resolve({ stdout, output });
      else reject(Object.assign(new ToolError(`exit ${code}: ${output.trim().slice(0, 600)}`), { output }));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

// Steps with each run of consecutive assertions merged into one { action: 'read', asserts }.
export function mergeAsserts(steps) {
  const merged = [];
  for (const step of steps) {
    const last = merged.at(-1);
    if (step.action !== 'assert') merged.push(step);
    else if (last?.action === 'read') last.asserts.push(step);
    else merged.push({ action: 'read', asserts: [step] });
  }
  return merged;
}

const readAll = asserts => `[${asserts.map(readExpression).join(', ')}]`;
const dispatchDoubleClick = css => `document.querySelector('${css}').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`;
const shellQuote = text => /^[\w@./:=#-]+$/.test(text) ? text : text.includes("'") ? `"${text.replace(/["\\$`]/g, '\\$&')}"` : `'${text}'`;
const commandLine = (name, args) => [name, ...args].map(shellQuote).join(' ');
const heredoc = (command, body) => `${command} <<'EOF'\n${body}\nEOF`;
const arrayLines = text => text.split('\n').filter(line => line.startsWith('[')).map(line => JSON.parse(line));
const cdpUrl = port => `http://127.0.0.1:${port}`;

export const bx = ({ port, session }) => {
  const script = join(vendor, 'bx/bx.mjs');
  const env = { ...process.env, BX_CDP_URL: cdpUrl(port), BX_SESSION: session };
  const targets = { new: NEW_FIELD, clearCompleted: 'Clear completed', filter: 'Active', delete: 'Delete' };
  const named = target => targets[target.kind] ?? `css=${target.kind === 'toggleAll' ? TOGGLE_ALL : target.css}`;
  const chain = step => {
    switch (step.action) {
      case 'add': return [['fill', NEW_FIELD, step.text], ['press', 'Enter']];
      case 'fill': return [['fill', named(step.target), step.text]];
      case 'press': return [['press', step.key]];
      case 'click': return [['click', named(step.target)]];
      case 'dblclick': return [['eval', dispatchDoubleClick(step.target.css)]];
      case 'hover': return [['hover', named(step.target)]];
      case 'read': return [['eval', readAll(step.asserts)]];
      default: throw new Error(`Unknown action ${step.action}`);
    }
  };
  return {
    docs: async () => (await import('node:fs')).readFileSync(join(vendor, 'bx/docs/bx.md'), 'utf8'),
    version: async () => `bx ${(await execute(process.execPath, [script, '--version'], { env })).stdout.trim()}`,
    run: async (url, steps, { record, signal }) => {
      const args = [['open', url], ...mergeAsserts(steps).flatMap(chain)].flatMap((part, index) => index ? ['+', ...part] : part);
      const { stdout } = await record(commandLine('bx', args), () => execute(process.execPath, [script, ...args], { env, signal }));
      return arrayLines(stdout).flat();
    },
    stop: async () => rmSync(join(tmpdir(), `bx-${session}.json`), { force: true }),
  };
};

export const agentBrowser = ({ port, session }) => {
  const exe = join(modules, 'agent-browser/bin/agent-browser-win32-x64.exe');
  const env = { ...process.env, AGENT_BROWSER_SESSION: session };
  const locate = (target, action, ...rest) => ['find', 'role', target.role, action, ...rest, '--name', target.name];
  const commands = step => {
    switch (step.action) {
      case 'add': return [['find', 'role', 'textbox', 'fill', step.text, '--name', NEW_FIELD], ['press', 'Enter']];
      case 'fill': return step.text ? [locate(step.target, 'fill', step.text)] : [['press', 'Control+a'], ['press', 'Backspace']];
      case 'press': return [['press', step.key]];
      case 'click': switch (step.target.kind) {
        case 'toggle': return [['click', step.target.css]];
        case 'toggleAll': return [['find', 'text', 'Mark all as complete', 'click']];
        default: return [locate(step.target, 'click')];
      }
      case 'dblclick': return [['dblclick', step.target.css]];
      case 'hover': return [['hover', step.target.css]];
      case 'read': return [['eval', `JSON.stringify(${readAll(step.asserts)})`]];
      default: throw new Error(`Unknown action ${step.action}`);
    }
  };
  return {
    docs: async () => (await Promise.all([['skills', 'get', 'core'], ['batch', '--help'], ['find', '--help']].map(args => execute(exe, args, { env })))).map(({ stdout }) => stdout).join('\n'),
    version: async () => (await execute(exe, ['--version'], { env })).stdout.trim(),
    run: async (url, steps, { record, signal }) => {
      const batch = `[${[['open', url], ...mergeAsserts(steps).flatMap(commands)].map(command => JSON.stringify(command)).join(',\n')}]`;
      const prefix = `agent-browser --session ${session} --cdp ${port} batch --bail`;
      const { stdout } = await record(heredoc(prefix, batch), () => execute(exe, ['--session', session, '--cdp', String(port), 'batch', '--bail'], { env, input: batch, signal }));
      return stdout.split('\n').filter(line => line.startsWith('"[')).flatMap(line => JSON.parse(JSON.parse(line)));
    },
    stop: async () => execute(exe, ['--session', session, 'close'], { env, allowFailure: true }),
  };
};

export const browserUse = ({ port, session }) => {
  const workspace = mkdtempSync(join(tmpdir(), 'e2e-bu-'));
  // The skill puts task helpers in agent_helpers.py: role and name to the accessibility node's box centre, then real input.
  const helpers = `def at(role, name, nth=0):
    nodes = [n for n in cdp("Accessibility.getFullAXTree")["nodes"] if n.get("role", {}).get("value") == role and n.get("name", {}).get("value", "") == name]
    q = cdp("DOM.getBoxModel", backendNodeId=nodes[nth]["backendDOMNodeId"])["model"]["content"]
    return sum(q[0::2]) / 4, sum(q[1::2]) / 4

def css(sel):
    return js("(() => { const b = document.querySelector(" + repr(sel) + ").getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2] })()")

def click(p, clicks=1):
    for n in range(clicks):
        click_at_xy(*p, clicks=n + 1)

def hover(p):
    cdp("Input.dispatchMouseEvent", type="mouseMoved", x=p[0], y=p[1])

def add(text):
    fill_input(".new-todo", text)
    press_key("Enter")

def read(expr):
    import json
    print(json.dumps(js(expr)))
`;
  writeFileSync(join(workspace, 'agent_helpers.py'), `from browser_harness.helpers import cdp, js, click_at_xy, fill_input, press_key\n\n${helpers}`);
  const env = {
    ...process.env, BU_NAME: session, BU_CDP_URL: cdpUrl(port), BH_AGENT_WORKSPACE: workspace, BH_TAB_MARKER: '0', BH_RECORD: '0',
    ANONYMIZED_TELEMETRY: 'false', BH_TELEMETRY: '0', PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1',
  };
  let opened = false;
  const py = JSON.stringify;
  const point = target => {
    if (target.kind === 'toggle') return `at("checkbox", "Toggle Todo", ${target.position - 1})`;
    if (['clearCompleted', 'heading', 'filter'].includes(target.kind)) return `at(${py(target.role)}, ${py(target.name)})`;
    return `css(${py(target.kind === 'toggleAll' ? TOGGLE_ALL : target.css)})`;
  };
  const line = step => {
    switch (step.action) {
      case 'add': return `add(${py(step.text)})`;
      case 'fill': return `fill_input(${py(step.target.css)}, ${py(step.text)})`;
      case 'press': return `press_key(${py(step.key)})`;
      case 'click': return step.target.kind === 'filter'
        ? `click(${point(step.target)})\nwait_for_element("a.selected[href='#/active']")`
        : `click(${point(step.target)})`;
      case 'dblclick': return `click(${point(step.target)}, 2)`;
      // a hover in a hidden tab times out; the skill says to activate the tab then
      case 'hover': return `activate_tab(current_tab())\nhover(${point(step.target)})`;
      case 'read': return `read(${py(readAll(step.asserts))})`;
      default: throw new Error(`Unknown action ${step.action}`);
    }
  };
  return {
    setupText: heredoc('cat > agent-workspace/agent_helpers.py', helpers),
    docs: async () => (await execute('browser-use', ['skill', 'show'], { env })).stdout,
    version: async () => (await execute('browser-use', ['--version'], { env })).stdout.trim(),
    run: async (url, steps, { record, signal }) => {
      const body = [opened ? `goto_url(${py(url)})` : `new_tab(${py(url)})`, 'wait_for_load()', ...mergeAsserts(steps).map(line)].join('\n');
      opened = true;
      const { stdout } = await record(heredoc('browser-use', body), () => execute('browser-use', [], { env, input: body, signal }));
      return arrayLines(stdout).flat();
    },
    stop: async () => {
      await execute('browser-use', ['--reload'], { env, allowFailure: true });
      rmSync(workspace, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    },
  };
};

export const axi = ({ port, session }) => {
  const script = join(modules, 'chrome-devtools-axi/dist/bin/chrome-devtools-axi.js');
  const env = {
    ...process.env, CHROME_DEVTOOLS_AXI_SESSION: session, CHROME_DEVTOOLS_AXI_BROWSER_URL: cdpUrl(port),
    CHROME_DEVTOOLS_AXI_MCP_PATH: join(modules, 'chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js'),
  };
  // A ref is only good until the page changes: every action prints the new snapshot it comes from.
  const refOf = (snapshot, role, name, nth = 0) => {
    const matches = [...snapshot.matchAll(/uid=(\S+) (\w+) "([^"]*)"/g)].filter(([, , r, n]) => r === role && n === name);
    if (!matches[nth]) throw new ToolError(`element not found in the snapshot: ${role} "${name}" #${nth}`);
    return `@${matches[nth][1].replace(/^@/, '')}`;
  };
  const refOfTarget = (snapshot, target) => {
    if (target.kind === 'toggleAll') return refOf(snapshot, 'checkbox', '❯Mark all as complete');
    if (target.kind === 'toggle') return refOf(snapshot, 'checkbox', 'Toggle Todo', target.position - 1);
    if (target.kind === 'item') return refOf(snapshot, 'checkbox', 'Toggle Todo', target.position - 1);
    return refOf(snapshot, target.role, target.name);
  };
  return {
    docs: async () => (await Promise.all([['--help'], ['eval', '--help']].map(args => execute(process.execPath, [script, ...args], { env })))).map(({ stdout }) => stdout).join('\n'),
    version: async () => `${(await execute(process.execPath, [script, '--version'], { env })).stdout.trim()} (chrome-devtools-mcp 1.12.0)`,
    run: async (url, steps, { record, signal }) => {
      const call = async (...args) => (await record(commandLine('chrome-devtools-axi', args), () => execute(process.execPath, [script, ...args], { env, signal }))).stdout;
      let snapshot = await call('open', url);
      const fresh = async target => {
        if (!snapshot) snapshot = await call('snapshot');
        return refOfTarget(snapshot, target);
      };
      const values = [];
      for (const step of mergeAsserts(steps)) {
        switch (step.action) {
          case 'add':
            snapshot = await call('fill', await fresh({ role: 'textbox', name: NEW_FIELD }), step.text);
            snapshot = await call('press', 'Enter');
            break;
          case 'fill':
            if (step.text) {
              snapshot = await call('fill', await fresh(step.target), step.text);
              break;
            }
            // fill rejects an empty text
            await call('press', 'Control+A');
            snapshot = await call('press', 'Backspace');
            break;
          case 'press': snapshot = await call('press', step.key); break;
          case 'click': snapshot = await call('click', await fresh(step.target)); break;
          case 'hover': snapshot = await call('hover', await fresh(step.target)); break;
          // axi has no double click
          case 'dblclick': await call('eval', dispatchDoubleClick(step.target.css)); snapshot = ''; break;
          case 'read': {
            const output = await call('eval', `JSON.stringify(${readAll(step.asserts)})`);
            // the result line is a string that holds the JSON text of the value
            let value = output.split('\n').find(text => text.startsWith('result: ')).slice('result: '.length);
            while (typeof value === 'string') value = JSON.parse(value);
            values.push(...value);
            break;
          }
          default: throw new Error(`Unknown action ${step.action}`);
        }
        if (snapshot && !snapshot.includes('uid=')) snapshot = '';
      }
      return values;
    },
    stop: async () => execute(process.execPath, [script, 'stop'], { env, allowFailure: true }),
  };
};

export const surf = ({ session }) => {
  const script = join(modules, 'surf-cli/native/cli.cjs');
  const env = { ...process.env, SURF_SESSION: session };
  const surfCommand = (args, signal) => execute(process.execPath, [script, ...args], { env, signal });
  const centre = css => `const b = document.querySelector('${css}').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]`;
  return {
    setupText: `export SURF_SESSION=${session}\nsurf session.ensure ${session} about:blank`,
    start: async () => {
      // the extension starts its native host a moment after Chrome opens
      const deadline = Date.now() + 15_000;
      while (!(await execute(process.execPath, [script, 'tab.list'], { env, allowFailure: true })).stdout.includes('about:blank'))
        if (Date.now() > deadline) throw new ToolError('the surf extension did not connect in 15 s');
      await surfCommand(['session.ensure', session, 'about:blank']);
    },
    docs: async () => [
      (await import('node:fs')).readFileSync(join(modules, 'surf-cli/skills/surf/SKILL.md'), 'utf8'),
      (await surfCommand(['hover', '--help'])).stdout,
    ].join('\n'),
    version: async () => (await surfCommand(['--version'])).stdout.trim(),
    run: async (url, steps, { record, signal }) => {
      const call = async (...args) => (await record(commandLine('surf', args), () => surfCommand(args, signal))).stdout;
      // Todo checkboxes get their refs from the report each action prints.
      const toggles = [];
      const act = async (...args) => {
        const output = await call(...args);
        for (const [, ref] of output.matchAll(/^\s*\+ (e\d+) checkbox "Toggle Todo"/gm)) toggles.push(ref);
        return output;
      };
      const pointOf = async css => JSON.parse(await call('js', centre(css)));
      const clickTarget = async target => {
        if (target.kind === 'toggle') return act('click', toggles[target.position - 1] ?? `missing ref of todo ${target.position}`);
        if (target.kind === 'new') return act('click', '--selector', target.css);
        if (target.kind === 'toggleAll') return act('click', '--selector', TOGGLE_ALL);
        return act('locate.role', target.role, '--name', target.name, '--action', 'click');
      };
      await act('go', url);
      const values = [];
      for (const step of mergeAsserts(steps)) {
        switch (step.action) {
          case 'add': await act('type', step.text, '--into', '.new-todo', '--clear', '--submit'); break;
          case 'fill':
            if (step.text) {
              await act('type', step.text, '--into', step.target.css, '--clear');
              break;
            }
            await act('key', 'ctrl+a');
            await act('key', 'Backspace');
            break;
          case 'press': await act('key', step.key); break;
          case 'click': await clickTarget(step.target); break;
          case 'dblclick': {
            const [x, y] = await pointOf(step.target.css);
            await act('click', '--x', String(x), '--y', String(y), '--button', 'double');
            break;
          }
          case 'hover': {
            const [x, y] = await pointOf(step.target.css);
            await act('hover', '--x', String(x), '--y', String(y));
            break;
          }
          case 'read': values.push(...JSON.parse(await call('js', `return ${readAll(step.asserts)}`))); break;
          default: throw new Error(`Unknown action ${step.action}`);
        }
      }
      return values;
    },
    stop: async () => execute(process.execPath, [script, 'session.close', session], { env, allowFailure: true }),
  };
};
