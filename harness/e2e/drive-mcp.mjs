// Ranking B, MCP tools. Two idioms: one script per scenario, or one tool call per action with refs
// read from the snapshot.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { browseEnv, browseExe } from './browse-env.mjs';
import { ToolError } from './drive-cli.mjs';
import { startMcp } from './mcp.mjs';
import { competitorsDirectory, deps } from './paths.mjs';

const q = JSON.stringify;

// The scenario as Playwright code, with role locators and the app's test ids.
function playwrightLines(url, steps) {
  const locator = target => {
    switch (target.kind) {
      case 'new': return 'field';
      case 'edit': return `page.getByRole('textbox', { name: 'Edit' })`;
      case 'toggle': return `page.getByRole('checkbox', { name: 'Toggle Todo' }).nth(${target.position - 1})`;
      case 'toggleAll': return `page.getByText('Mark all as complete')`;
      case 'item': return `page.getByTestId('todo-item').nth(${target.position - 1})`;
      case 'title': return `page.getByTestId('todo-title')`;
      case 'todo': return `page.getByText(${q(target.text)}, { exact: true })`;
      case 'list': return `page.locator('.todo-list')`;
      default: return `page.getByRole(${q(target.role)}, { name: ${q(target.name)} })`;
    }
  };
  const readers = {
    counter: () => `page.getByTestId('todo-count').innerText()`,
    visible: ({ target }) => `${locator(target)}.isVisible()`,
    value: ({ target }) => `${locator(target)}.inputValue()`,
    checked: ({ target }) => `${locator(target)}.isChecked()`,
    focused: ({ target }) => `${locator(target)}.evaluate(e => e === document.activeElement)`,
    count: () => `page.getByTestId('todo-item').count()`,
    items: () => `page.getByTestId('todo-title').allInnerTexts()`,
  };
  const line = step => {
    switch (step.action) {
      case 'add': return `await field.fill(${q(step.text)}); await field.press('Enter');`;
      case 'fill': return `await ${locator(step.target)}.fill(${q(step.text)});`;
      case 'press': return `await ${locator(step.target)}.press(${q(step.key)});`;
      case 'click': return `await ${locator(step.target)}.click();`;
      case 'dblclick': return `await ${locator(step.target)}.dblclick();`;
      case 'hover': return `await ${locator(step.target)}.hover();`;
      case 'assert': return step.read === 'url' ? `got.push(page.url());` : `got.push(await ${readers[step.read](step)});`;
      default: throw new Error(`Unknown action ${step.action}`);
    }
  };
  return [
    `await page.goto(${q(url)});`,
    `const field = page.getByRole('textbox', { name: 'What needs to be done?' });`,
    `const got = [];`,
    ...steps.map(line),
    `return got;`,
  ];
}

const firstArray = text => {
  const line = text.split('\n').find(candidate => candidate.startsWith('['));
  if (!line) throw new ToolError(`no result in: ${text.slice(0, 400)}`);
  return JSON.parse(line);
};

const servers = {
  playwright: port => ({ args: [join(deps, 'node_modules/@playwright/mcp/cli.js'), '--cdp-endpoint', `http://127.0.0.1:${port}`] }),
  flashwright: port => ({ args: [join(competitorsDirectory, 'flashwright/node_modules/@playwright/test/cli.js'), 'mcp', '--cdp-endpoint', `http://127.0.0.1:${port}`] }),
};

// Shared life cycle of one MCP server per round.
function mcpDriver(launch, runScenario) {
  const cwd = mkdtempSync(join(tmpdir(), 'e2e-mcp-'));
  let server;
  return {
    start: async () => { server = await startMcp(launch.command ?? process.execPath, launch.args, { env: { ...process.env, ...launch.env }, cwd }); },
    docs: async () => [server.instructions, ...server.tools.map(({ name, description, inputSchema }) => q({ name, description, input_schema: inputSchema }))].join('\n'),
    version: async () => `${server.serverInfo.name} ${server.serverInfo.version}`,
    run: (url, steps, { record }) => runScenario(url, steps, async (name, args) => {
      const { stdout } = await record(q({ name, input: args }), async () => {
        const { text, isError } = await server.call(name, args);
        if (isError) throw Object.assign(new ToolError(text.slice(0, 600)), { output: text });
        return { stdout: text, output: text };
      });
      return stdout;
    }),
    stop: async () => {
      await server?.stop();
      rmSync(cwd, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    },
  };
}

const runCode = (url, steps, call) => call('browser_run_code_unsafe', { code: `async (page) => {\n${playwrightLines(url, steps).join('\n')}\n}` }).then(firstArray);

// What a snapshot says, read the way an agent would.
function parseSnapshot(text) {
  const lines = text.split('\n');
  const unquote = value => value.startsWith('"') ? JSON.parse(value) : value;
  const nodes = lines.flatMap(line => {
    const match = /^\s*- (\w+)(?: "((?:[^"\\]|\\.)*)")?((?: \[[^\]]+\])*)(?:: (.*))?:?$/.exec(line);
    if (!match) return [];
    const [, role, name = '', attributes, value] = match;
    return [{ role, name, ref: /\[ref=(\w+)\]/.exec(attributes)?.[1], attributes, value: value === undefined ? undefined : unquote(value) }];
  });
  const items = [];
  nodes.forEach((node, index) => {
    if (node.role !== 'checkbox' || node.name !== 'Toggle Todo') return;
    const before = nodes.slice(0, index).filter(({ role }) => role === 'listitem').at(-1);
    const title = nodes.slice(index + 1).find(({ role, value }) => role === 'generic' && value !== undefined);
    items.push({ ref: before.ref, toggle: node, title });
  });
  const strong = nodes.findIndex(({ role }) => role === 'strong');
  const counter = strong === -1 ? null : `${nodes[strong].value} ${nodes[strong + 1].value}`;
  return { nodes, items, counter, url: /Page URL: (\S+)/.exec(text)?.[1] };
}

async function runSteps(url, steps, call) {
  let page;
  let fieldRef;
  const look = async () => page ??= parseSnapshot(await call('browser_snapshot', {}));
  const act = async (name, args) => { page = undefined; await call(name, args); };
  const node = (role, name) => page.nodes.find(candidate => candidate.role === role && candidate.name === name);
  const find = async target => {
    await look();
    const item = page.items[(target.position ?? 1) - 1];
    switch (target.kind) {
      case 'toggle': return item?.toggle;
      case 'item': return item;
      case 'title': return item?.title;
      case 'todo': return page.items.find(({ title }) => title?.value === target.text);
      case 'list': return page.items[0];
      case 'toggleAll': return page.nodes.find(({ role, value }) => role === 'generic' && value === '❯Mark all as complete');
      default: return node(target.role, target.name);
    }
  };
  const refOf = async target => {
    if (target.kind === 'new' && fieldRef) return fieldRef;
    const found = await find(target);
    if (!found?.ref) throw new ToolError(`element not found in the snapshot: ${q(target)}`);
    if (target.kind === 'new') fieldRef = found.ref;
    return found.ref;
  };
  const read = async step => {
    switch (step.read) {
      case 'counter': return (await look()).counter;
      case 'visible': return Boolean(await find(step.target));
      case 'checked': return (await find(step.target))?.attributes.includes('[checked]') ?? null;
      case 'focused': return (await find(step.target))?.attributes.includes('[active]') ?? null;
      case 'count': return (await look()).items.length;
      case 'items': return (await look()).items.map(({ title }) => title.value);
      case 'url': return (await look()).url;
      // a snapshot trims a field's text
      case 'value': return JSON.parse((await call('browser_evaluate', { target: await refOf(step.target), function: 'e => e.value' })).split('\n').find(line => line.startsWith('"')));
      default: throw new Error(`Unknown read ${step.read}`);
    }
  };
  await act('browser_navigate', { url });
  const values = [];
  for (const step of steps) {
    switch (step.action) {
      case 'add': await act('browser_type', { target: await refOf({ kind: 'new', role: 'textbox', name: 'What needs to be done?' }), text: step.text, submit: true }); break;
      case 'fill': await act('browser_type', { target: await refOf(step.target), text: step.text }); break;
      case 'press': await act('browser_press_key', { key: step.key }); break;
      case 'click': await act('browser_click', { target: await refOf(step.target) }); break;
      case 'dblclick': await act('browser_click', { target: await refOf(step.target), doubleClick: true }); break;
      case 'hover': await act('browser_hover', { target: await refOf(step.target) }); break;
      case 'assert': values.push(await read(step)); break;
      default: throw new Error(`Unknown action ${step.action}`);
    }
  }
  return values;
}

export const playwrightMcpSteps = ({ port }) => mcpDriver(servers.playwright(port), runSteps);
export const playwrightMcpCode = ({ port }) => mcpDriver(servers.playwright(port), runCode);
export const flashwrightMcpSteps = ({ port }) => mcpDriver(servers.flashwright(port), runSteps);
export const flashwrightMcpCode = ({ port }) => mcpDriver(servers.flashwright(port), runCode);
export const flashwrightMcpAdaptive = ({ port }) => {
  const { args } = servers.flashwright(port);
  return mcpDriver({ args: [...args, '--adaptive-settle'] }, runSteps);
};

export const browseExecute = () => {
  const runExecute = async (url, steps, call) => {
    const body = playwrightLines(url, steps).slice(0, -1);
    return firstArray(await call('execute', { code: [...body, 'await page.close();', 'return got;'].join('\n') }));
  };
  return mcpDriver({ command: browseExe, args: ['mcp'], env: browseEnv }, runExecute);
};
