// Starts and stops one Chrome, with a fresh profile unless one is given.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectBrowser } from './cdp.mjs';
import { chromePath } from './paths.mjs';

export async function startChrome({ extension, headless = true, profile } = {}) {
  const directory = profile ?? mkdtempSync(join(tmpdir(), 'e2e-chrome-'));
  const portFile = join(directory, 'DevToolsActivePort');
  rmSync(portFile, { force: true });
  const child = spawn(chromePath, [
    `--user-data-dir=${directory}`, '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--window-size=1280,720',
    ...(headless ? ['--headless=new'] : []),
    ...(extension ? [`--load-extension=${extension}`, `--disable-extensions-except=${extension}`] : []),
    'about:blank',
  ], { stdio: 'ignore' });
  const deadline = Date.now() + 20000;
  let port;
  while (!port) {
    if (Date.now() > deadline) throw new Error('Chrome did not open its debugging port');
    await new Promise(resolve => setTimeout(resolve, 50));
    if (existsSync(portFile)) port = Number(readFileSync(portFile, 'utf8').split('\n')[0]) || undefined;
  }
  const stop = async () => {
    const closed = new Promise(resolve => child.once('close', resolve));
    const client = await connectBrowser(port).catch(() => null);
    await client?.send('Browser.close').catch(() => {});
    await Promise.race([closed, new Promise(resolve => setTimeout(resolve, 5000))]);
    if (child.exitCode === null) child.kill();
    if (!profile) rmSync(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  };
  return { port, pid: child.pid, directory, stop };
}
