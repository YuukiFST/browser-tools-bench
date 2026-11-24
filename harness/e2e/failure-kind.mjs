// What a failed suite's own output says: how many tests it reports as failed, and why.
const count = (output, pattern) => [...output.matchAll(pattern)].reduce((sum, [, n]) => sum + Number(n), 0);

// Tests the runner reports as run and failed. A suite that exits with an error and reports none crashed.
export const failedTests = {
  playwright: output => count(output, /^\s*(\d+) failed/gm),
  flashwright: output => count(output, /^\s*(\d+) failed/gm),
  cypress: output => count(output, /^\s*(\d+) failing/gm),
  webdriverio: output => [...output.matchAll(/"dot" Reporter:\s*([.F-]+)/g)].reduce((sum, [, dots]) => sum + dots.replace(/[^F]/g, '').length, 0),
  selenium: output => count(output, /^\s*(\d+) failing/gm),
  puppeteer: output => count(output, /^Tests:.*?(\d+) failed/gm),
  nightwatch: output => (output.match(/^\s*[×✖] (?:default )?\[/gm) ?? []).length,
  bun: output => count(output, /^\s*(\d+) fail\b/gm),
};

export function failureKind({ output, timedOut, failed }) {
  if (timedOut) return 'timeout';
  if (!failed) return 'crash';
  if (/no such element|element\(s\) not found|unable to locate|never found it|waiting for element to be located|no element matched|element could not be located/i.test(output)) return 'element-not-found';
  return 'assertion';
}
