// browse, kept apart from the user's own: its state lives in profiles/browse-home and no agent config is touched.
import { join } from 'node:path';
import { deps, here, vendor } from './paths.mjs';

export const browseExe = join(deps, 'node_modules/@opencode/browse-windows-x64/bin/browse.exe');
export const browseExtension = join(vendor, 'browse/dist');
export const browseProfile = join(here, 'profiles/browse');
export const browsePairedMark = join(here, 'profiles/browse-paired');
export const browseEnv = { ...process.env, OPENCODE_BROWSER_HOME: join(here, 'profiles/browse-home'), OPENCODE_BROWSER_AUTO_UPDATE: 'off', OPENCODE_BROWSER_UPDATE_CHECK: 'off' };
