// Serves the retained TodoMVC build, healthy or with one injected defect.
// Every path is under /todomvc/<build>/, and any *.localhost host works: one host per scenario run
// gives each one an empty localStorage without touching the browser.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { defects } from './defects.mjs';
import { vendor } from './paths.mjs';

const directory = join(vendor, 'flashwright/bench/apps/todomvc');
const manifest = JSON.parse(readFileSync(join(directory, 'provenance.json'), 'utf8'));
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function replaceOnce(text, before, after) {
  if (text.split(before).length !== 2)
    throw new Error(`Expected exactly one match of: ${before}`);
  return text.replace(before, () => after);
}

const { path: bundlePath, replacements, servedSha256 } = manifest.adaptations.bundle;
const healthyBundle = replacements.reduce((text, [before, after]) => replaceOnce(text, before, after), readFileSync(join(directory, bundlePath), 'utf8'));
if (sha256(healthyBundle) !== servedSha256)
  throw new Error('The adapted TodoMVC bundle does not match provenance.json');

export function bundleOf(build) {
  if (build === 'healthy')
    return healthyBundle;
  const defect = defects.find(({ id }) => id === build);
  if (!defect)
    throw new Error(`Unknown build ${build}`);
  return replaceOnce(healthyBundle, defect.before, defect.after);
}

export async function startAppServer() {
  const assets = new Map(manifest.files.filter(({ role }) => role === 'asset').map(entry => [entry.requestPath.replace(manifest.documentPath, ''), entry]));
  const bundles = new Map(['healthy', ...defects.map(({ id }) => id)].map(build => [build, bundleOf(build)]));
  const server = createServer((request, response) => {
    const [, root, build, ...rest] = new URL(request.url, 'http://localhost').pathname.split('/');
    const entry = root === 'todomvc' && bundles.has(build) && assets.get(rest.join('/'));
    if (!entry) {
      response.writeHead(request.url === '/favicon.ico' ? 204 : 404).end();
      return;
    }
    const body = entry.path === bundlePath ? bundles.get(build) : readFileSync(join(directory, entry.path));
    response.writeHead(200, { 'Content-Type': contentTypes[extname(entry.path)], 'Cache-Control': 'no-store' }).end(body);
  });
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  let visits = 0;
  return {
    url: (build = 'healthy') => `http://127.0.0.1:${port}/todomvc/${build}/`,
    freshUrl: (build = 'healthy') => `http://s${++visits}.localhost:${port}/todomvc/${build}/`,
    close: () => { server.closeAllConnections(); server.close(); },
  };
}
