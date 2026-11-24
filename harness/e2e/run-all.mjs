// The whole benchmark: install, validate the builds, run A and B, analyze.
//   node run-all.mjs [rounds A] [minutes A] [rounds B] [minutes B]     default 30 20 30 40
// Rows already in $OUT (results/e2e) are replaced; exclusions.json is read from there.
// browse needs a person once, before: node pair-browse.mjs
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { here, results as defaultResults } from './paths.mjs';

const results = process.env.OUT ?? defaultResults;
const [roundsA = '30', minutesA = '20', roundsB = '30', minutesB = '40'] = process.argv.slice(2);

const step = (script, ...args) => {
  const { status } = spawnSync(process.execPath, [join(here, script), ...args], { stdio: 'inherit', cwd: here });
  if (status !== 0) throw new Error(`${script} exited with ${status}`);
};
step('setup.mjs');
step('oracle.mjs');
for (const file of ['suites.jsonl', 'drivers.jsonl', 'drivers-setup.jsonl']) rmSync(join(results, file), { force: true });
step('run-suites.mjs', roundsA, minutesA);
step('run-drivers.mjs', roundsB, minutesB);
step('analyze.mjs');
