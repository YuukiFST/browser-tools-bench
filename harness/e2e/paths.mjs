// Pinned sources, directories and tool lists shared by every script of the e2e benchmark.
import { homedir } from 'node:os';
import { join } from 'node:path';

export const here = import.meta.dirname;
export const vendor = join(here, 'vendor');
export const deps = join(here, 'deps');
export const logs = join(here, 'logs');
export const results = join(here, '../../results/e2e');

export const pinned = {
  flashwright: { url: 'https://github.com/xcodebeast/flashwright', commit: '12d1c8491f14e7aa6a5a3797435cc40f209b0de1' },
  browse: { url: 'https://github.com/anomalyco/browse', commit: '198414a' },
  bx: { url: 'https://github.com/YuukiFST/bx', commit: 'b436edc8f8afea8ce16c4e65f48277eb65da99ba' },
};

export const suiteTools = ['flashwright', 'playwright', 'cypress', 'webdriverio', 'selenium', 'puppeteer', 'nightwatch', 'bun'];

const competitors = join(vendor, 'flashwright/bench/competitors');
export const competitorsDirectory = competitors;
// Playwright's chromium-1248 build (Chrome for Testing 156), the build the pinned chromedriver matches.
export const chromePath = process.env.CHROME_PATH ?? join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData/Local'), 'ms-playwright/chromium-1248/chrome-win64/chrome.exe');
export const chromedriverPath = process.env.CHROMEDRIVER_PATH ?? join(competitors, 'chromedriver/node_modules/chromedriver/lib/chromedriver/chromedriver.exe');
export const bunPath = join(deps, 'node_modules/bun/bin/bun.exe');
