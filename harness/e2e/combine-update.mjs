// Positions of ranking B after the update run: first-run rows of the tools not measured again, update-run rows of the others, rounds 1 to 3.
//   node combine-update.mjs <update directory under results/e2e> <out directory>     then: OUT=<out directory> node analyze.mjs
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { results } from './paths.mjs';

const ROUNDS = 3;
const [update, out] = process.argv.slice(2);
const readRows = file => readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line));
const measuredAgain = new Set(readRows(join(results, update, 'drivers.jsonl')).map(({ tool }) => tool));
mkdirSync(out, { recursive: true });
for (const file of ['drivers.jsonl', 'drivers-setup.jsonl']) {
  const rows = [...readRows(join(results, file)).filter(({ tool }) => !measuredAgain.has(tool)), ...readRows(join(results, update, file))];
  writeFileSync(join(out, file), rows.filter(({ round }) => round <= ROUNDS).map(row => `${JSON.stringify(row)}\n`).join(''));
}
for (const file of ['suites.jsonl', 'exclusions.json']) copyFileSync(join(results, file), join(out, file));
