// Pairs the browse extension with the isolated Chrome profile of the benchmark. A person has to enter the code.
//   node pair-browse.mjs
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { browseEnv, browseExe, browseExtension, browsePairedMark, browseProfile } from './browse-env.mjs';
import { connectBrowser } from './cdp.mjs';
import { startChrome } from './chrome.mjs';

mkdirSync(browseProfile, { recursive: true });
const browse = args => spawnSync(browseExe, args, { env: browseEnv, encoding: 'utf8', timeout: 60_000 });
console.log(browse(['install', '--agent', 'none', '--no-open', '--no-wait', '--no-modify-path']).stdout);
const chrome = await startChrome({ extension: browseExtension, profile: browseProfile, headless: false });
const client = await connectBrowser(chrome.port);
await new Promise(resolve => setTimeout(resolve, 2000));
const { targetInfos } = await client.send('Target.getTargets');
const worker = targetInfos.find(({ url }) => url.startsWith('chrome-extension://'));
if (!worker) throw new Error('the browse extension is not loaded');
await client.send('Target.createTarget', { url: new URL('/settings.html', worker.url).href });
client.close();
console.log('In the Chrome window that opened (the benchmark profile, not yours): expand "advanced", enter the code below under "Pairing code" and click Connect.\n');
const pairing = spawn(browseExe, ['pair', '--wait-seconds', '600'], { env: browseEnv, stdio: 'inherit' });
const code = await new Promise(resolve => pairing.on('close', resolve));
if (code === 0) writeFileSync(browsePairedMark, new Date().toISOString());
console.log(code === 0 ? 'Paired.' : `Not paired (exit ${code}).`);
await chrome.stop();
process.exit(code ?? 1);
