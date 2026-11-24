// Independent check of the app builds, over raw CDP input events.
//   node oracle.mjs     checks that each build breaks exactly the scenarios defects.mjs declares
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startAppServer } from './app-server.mjs';
import { connectBrowser, evaluate, pageState } from './cdp.mjs';
import { startChrome } from './chrome.mjs';
import { defects } from './defects.mjs';
import { results } from './paths.mjs';
import { holds, readExpression, scenarios } from './scenario-model.mjs';

const keyCodes = { Enter: 13, Escape: 27, Backspace: 8 };

async function runScenario(client, sessionId, url, scenario) {
  const read = expression => evaluate(client, sessionId, expression);
  const until = async expression => {
    const deadline = Date.now() + 3000;
    while (!await read(expression))
      if (Date.now() > deadline) throw new Error(`not true in 3 s: ${expression}`);
  };
  const mouse = (type, [x, y], clickCount = 0) => client.send('Input.dispatchMouseEvent', { type, x, y, button: clickCount ? 'left' : 'none', clickCount }, sessionId);
  const centerOf = async css => {
    const element = `document.querySelector(${JSON.stringify(css)})`;
    await until(`!!${element}`);
    return read(`(() => { const b = ${element}.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
  };
  const click = async (css, count = 1) => {
    const point = await centerOf(css);
    await mouse('mouseMoved', point);
    for (let n = 1; n <= count; n++) {
      await mouse('mousePressed', point, n);
      await mouse('mouseReleased', point, n);
    }
  };
  const press = async key => {
    const base = { key, code: key, windowsVirtualKeyCode: keyCodes[key] };
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, ...(key === 'Enter' && { text: String.fromCharCode(13) }) }, sessionId);
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base }, sessionId);
  };
  const fill = async (css, text) => {
    await centerOf(css);
    await read(`(() => { const e = document.querySelector(${JSON.stringify(css)}); e.focus(); e.select(); })()`);
    if (text) await client.send('Input.insertText', { text }, sessionId);
    else await press('Backspace');
  };
  const check = async step => {
    const deadline = Date.now() + 1000;
    let actual;
    do actual = await read(readExpression(step)); while (!holds(step, actual) && Date.now() < deadline);
    if (!holds(step, actual)) throw new Error(`${step.read} ${step.target?.css ?? ''}: expected ${JSON.stringify(step.expected)}, got ${JSON.stringify(actual)}`);
  };
  await client.send('Page.navigate', { url }, sessionId);
  await until(`location.href.startsWith(${JSON.stringify(url)}) && !!document.querySelector('.new-todo')`);
  for (const step of scenario.steps) {
    switch (step.action) {
      case 'add': await fill('.new-todo', step.text); await press('Enter'); break;
      case 'fill': await fill(step.target.css, step.text); break;
      case 'press': await press(step.key); break;
      case 'click': await click(step.target.css); break;
      case 'dblclick': await click(step.target.css, 2); break;
      case 'hover': await mouse('mouseMoved', await centerOf(step.target.css)); break;
      case 'assert': await check(step); break;
      default: throw new Error(`Unknown action ${step.action}`);
    }
  }
  return read(pageState);
}

export async function checkBuilds() {
  const app = await startAppServer();
  const chrome = await startChrome();
  const client = await connectBrowser(chrome.port);
  const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });
  const matrix = {};
  const finalStates = {};
  for (const build of ['healthy', ...defects.map(({ id }) => id)]) {
    matrix[build] = {};
    for (const scenario of scenarios) {
      try {
        const state = await runScenario(client, sessionId, app.freshUrl(build), scenario);
        if (build === 'healthy') finalStates[scenario.id] = state;
        matrix[build][scenario.id] = 'pass';
      } catch (error) {
        matrix[build][scenario.id] = error.message;
      }
    }
  }
  client.close();
  await chrome.stop();
  app.close();
  const failing = build => Object.entries(matrix[build]).filter(([, outcome]) => outcome !== 'pass').map(([id]) => id).sort();
  const checks = [{ id: 'healthy', fails: [] }, ...defects].map(({ id, fails }) => {
    const declared = [...fails].sort();
    const observed = failing(id);
    return { build: id, declared, observed, ok: JSON.stringify(declared) === JSON.stringify(observed) };
  });
  mkdirSync(results, { recursive: true });
  writeFileSync(join(results, 'oracle.json'), `${JSON.stringify({ checks, finalStates, matrix }, null, 1)}\n`);
  return checks;
}

if (import.meta.main) {
  const checks = await checkBuilds();
  for (const { build, ok, declared, observed } of checks)
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${build}: ${observed.length} scenarios fail${ok ? '' : `, declared ${declared.join(', ')}; observed ${observed.join(', ')}`}`);
  process.exit(checks.every(({ ok }) => ok) ? 0 : 1);
}
