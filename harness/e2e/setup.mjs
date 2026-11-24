// Fetches the pinned sources and installs every dependency inside harness/e2e (git-ignored).
//   node setup.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deps, pinned, vendor, suiteTools } from './paths.mjs';

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} exited with ${result.status}`);
};
// npm is a .cmd on Windows, which spawn only runs through a shell; npm-cli.js needs none.
const npmCli = join(process.execPath, '../node_modules/npm/bin/npm-cli.js');
const npm = (args, cwd, env = {}) => run(process.execPath, [npmCli, ...args], { cwd, env: { ...process.env, ...env } });

for (const [name, { url, commit }] of Object.entries(pinned)) {
  const directory = join(vendor, name);
  if (!existsSync(directory)) {
    mkdirSync(vendor, { recursive: true });
    // autocrlf off: provenance.json checks the retained bytes
    run('git', ['clone', '-q', '-c', 'core.autocrlf=false', url, directory]);
  }
  run('git', ['-C', directory, 'checkout', '-q', commit]);
  const head = execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!head.startsWith(commit))
    throw new Error(`${name} is at ${head}, expected ${commit}`);
}

const competitors = join(vendor, 'flashwright/bench/competitors');
for (const tool of [...suiteTools.filter(name => name !== 'bun'), 'chromedriver']) {
  const cwd = join(competitors, tool);
  // install scripts stay off; the two that matter (cypress, chromedriver) run explicitly below
  npm([existsSync(join(cwd, 'package-lock.json')) ? 'ci' : 'install', '--ignore-scripts', '--no-audit', '--no-fund'], cwd);
}
run(process.execPath, ['node_modules/cypress/bin/cypress', 'install'], {
  cwd: join(competitors, 'cypress'),
  env: { ...process.env, CYPRESS_CACHE_FOLDER: join(competitors, 'cypress/node_modules/.cypress-cache') },
});
run(process.execPath, ['node_modules/chromedriver/install.js'], { cwd: join(competitors, 'chromedriver') });

mkdirSync(deps, { recursive: true });
writeFileSync(join(deps, 'package.json'), `${JSON.stringify({
  name: 'e2e-bench-deps',
  private: true,
  dependencies: {
    '@opencode/browse': '0.1.5',
    '@playwright/mcp': '0.0.85',
    'agent-browser': '0.41.2',
    bun: '1.4.4',
    'chrome-devtools-axi': '0.1.46',
    'chrome-devtools-mcp': '1.12.0',
    'js-tiktoken': '1.0.21',
    'surf-cli': '2.26.0',
  },
}, null, 2)}\n`);
npm(['install', '--ignore-scripts', '--no-audit', '--no-fund'], deps);
run(process.execPath, ['node_modules/bun/install.js'], { cwd: deps });

// browse's extension is built from the pinned source: the isolated profile loads it unpacked
const browse = join(vendor, 'browse');
npm(['install', '--ignore-scripts', '--no-audit', '--no-fund'], browse);
run(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { cwd: browse });
run(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '-c', 'vite.content.config.ts'], { cwd: browse });
