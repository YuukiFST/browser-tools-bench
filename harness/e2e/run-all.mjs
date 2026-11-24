// The whole benchmark: install, validate the builds, run A and B, analyze.
//   node run-all.mjs            previous rows in results/e2e are replaced
// browse needs a person once, before: node pair-browse.mjs
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { here, results } from './paths.mjs';

const step = (script, ...args) => {
  const { status } = spawnSync(process.execPath, [join(here, script), ...args], { stdio: 'inherit', cwd: here });
  if (status !== 0) throw new Error(`${script} exited with ${status}`);
};
step('setup.mjs');
step('oracle.mjs');
for (const file of ['suites.jsonl', 'drivers.jsonl', 'drivers-setup.jsonl']) rmSync(join(results, file), { force: true });
step('run-suites.mjs', '30', '20');
step('run-drivers.mjs', '30', '40');
step('analyze.mjs');
