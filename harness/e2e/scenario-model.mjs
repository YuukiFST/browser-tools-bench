// The pinned scenarios, with every target resolved to what a fixed script can know: its accessible
// role and name, and a CSS selector. Todos are addressed by their position, known from the steps.
import { scenarios as pinnedScenarios, selectors, parseTarget } from './vendor/flashwright/bench/competitors/scenarios.mjs';

const roles = {
  new: { role: 'textbox', name: 'What needs to be done?' },
  edit: { role: 'textbox', name: 'Edit' },
  toggle: { role: 'checkbox', name: 'Toggle Todo' },
  toggleAll: { role: 'checkbox', name: 'Mark all as complete' },
  clearCompleted: { role: 'button', name: 'Clear completed' },
  heading: { role: 'heading', name: 'todos' },
  filter: { role: 'link', name: 'Active' },
  delete: { role: 'button', name: 'Delete' },
};
const inItem = { toggle: ' .toggle', delete: ' .destroy', item: '', title: ' label' };

function resolveScenario(scenario) {
  const titles = [];
  let draft = '';
  let hoveredPosition = 1;
  const target = name => {
    const { kind, text } = parseTarget(name);
    const base = { kind, text, ...roles[kind] };
    if (kind === 'todo') return { ...base, css: selectors.todoTitle };
    if (kind === 'counter') return { ...base, css: selectors.counter };
    if (kind === 'filter') return { ...base, css: selectors[name] };
    if (kind === 'edit') return { ...base, css: '.todo-list li.editing .edit' };
    if (inItem[kind] === undefined) return { ...base, css: selectors[kind] };
    const named = text === undefined ? 1 : titles.indexOf(text) + 1;
    const position = kind === 'delete' ? hoveredPosition : named;
    return { ...base, position, css: `.todo-list li:nth-child(${position})${inItem[kind]}` };
  };
  const resolveStep = ([action, name, value]) => {
    switch (action) {
      case 'add':
        if (name.trim()) titles.push(name.trim());
        return { action, text: name };
      case 'fill':
        if (name === 'new') draft = value;
        return { action, target: target(name), text: value };
      case 'press':
        if (name === 'new' && draft.trim()) titles.push(draft.trim());
        if (name === 'new') draft = '';
        return { action, target: target(name), key: value };
      case 'hover': {
        const hovered = target(name);
        hoveredPosition = hovered.position;
        return { action, target: hovered };
      }
      case 'click':
      case 'dblclick': return { action, target: target(name) };
      case 'visible':
      case 'hidden': {
        const resolved = target(name);
        if (resolved.kind === 'counter') return { action: 'assert', read: 'counter', expected: resolved.text };
        return { action: 'assert', read: 'visible', target: resolved, expected: action === 'visible' };
      }
      case 'value': return { action: 'assert', read: 'value', target: target(name), expected: value };
      case 'checked':
      case 'unchecked': return { action: 'assert', read: 'checked', target: target(name), expected: action === 'checked' };
      case 'focused': return { action: 'assert', read: 'focused', target: target(name), expected: true };
      case 'count': return { action: 'assert', read: 'count', expected: name };
      case 'items': return { action: 'assert', read: 'items', expected: name };
      case 'url': return { action: 'assert', read: 'url', expected: name };
      default: throw new Error(`Unknown step ${action}`);
    }
  };
  return { id: scenario.file, title: scenario.title, steps: scenario.steps.map(resolveStep) };
}

export const scenarios = pinnedScenarios.map(resolveScenario);

const query = css => `document.querySelector(${JSON.stringify(css)})`;

// A page-side expression for an assertion's value, for tools whose scripts read the page with JavaScript.
export function readExpression({ read, target }) {
  switch (read) {
    case 'counter': return `${query('.todo-count')}?.textContent`;
    case 'visible': return target.kind === 'todo'
      ? `[...document.querySelectorAll('.todo-list label')].some(e => e.textContent === ${JSON.stringify(target.text)} && e.checkVisibility())`
      : `!!${query(target.css)}?.checkVisibility()`;
    case 'value': return `${query(target.css)}?.value`;
    case 'checked': return `${query(target.css)}?.checked`;
    case 'focused': return `document.activeElement === ${query(target.css)}`;
    case 'count': return `document.querySelectorAll('.todo-list li').length`;
    case 'items': return `[...document.querySelectorAll('.todo-list label')].map(e => e.textContent)`;
    case 'url': return 'location.href';
    default: throw new Error(`Unknown read ${read}`);
  }
}

export const holds = ({ read, expected }, actual) => read === 'url' ? String(actual).endsWith(expected) : JSON.stringify(actual) === JSON.stringify(expected);
