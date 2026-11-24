# browser-tools-bench

Which browser tool should an AI coding agent use?
This repo compares five of them on one real web app, measuring cost, speed, tokens, accuracy and failures.

## Tools

- [surf-cli](https://github.com/nicobailon/surf-cli)
- [agent-browser](https://github.com/vercel-labs/agent-browser)
- [playwright-mcp](https://github.com/microsoft/playwright-mcp)
- [browser-harness](https://github.com/browser-use/browser-harness)
- [chrome-devtools-axi](https://github.com/kunchenguid/chrome-devtools-axi)

## Agent result (v2, 2026-11-10)

Ranked by a rule written before the paid runs (`ranking-rule.md`): agent turns and agent cost above a no-browser baseline, with ties when the 95% bootstrap interval of the paired per-block difference does not separate two tools.

| rank | tool | agent turns | agent US$ | agent time | agent runs failed |
|---|---|---|---|---|---|
| 1 (tied) | playwright-mcp | 12.8 [12.6, 13.0] | 0.073 | 30.5 s | 0 / 30 |
| 1 (tied) | surf-cli | 6.8 [6.6, 7.0] | 0.084 | 27.1 s | 3 / 30 |
| 3 | agent-browser | 7.5 [7.0, 8.1] | 0.109 | 28.4 s | 0 / 10 |
| 4 | chrome-devtools-axi | 12.0 [11.5, 12.6] | 0.114 | 52.2 s | 0 / 10 |
| 5 | browser-harness | 17.5 [15.5, 19.7] | 0.145 | 64.8 s | 0 / 10 |

Means per run of Claude Sonnet (`claude-sonnet-5-5`) through `claude -p`, with bootstrap 95% intervals over blocks.
playwright-mcp and surf-cli tie: playwright-mcp is cheaper and surf-cli takes fewer turns, both outside their intervals.
The full table is in `results/benchmark.html`, every number in `results/v2/analysis.md`, and how each was produced, with its limits, in `methodology.md`.

The v1 ranking (surf-cli, agent-browser, playwright-mcp, browser-harness, chrome-devtools-axi) rested on 2 runs per tool and is superseded; its data stays in `results/` and its report in `results/benchmark-v1.html`.

## E2E result (2026-11-24)

Which tool runs e2e tests most efficiently, measured with fixed scripts and no LLM call.
Both rankings run the same 24 TodoMVC scenarios and 5 builds with one injected defect each, under a rule committed before the ranked runs (`harness/e2e/RANKING-RULE.md`).
How it was run, and its limits, are in `methodology.md` §15; failures and exclusions are in `results/e2e/report.md` (in Portuguese).

**A. Committed suites, sorted by speed.**
Flashwright is the fastest, 1.45 times faster than Bun.
6 complete rounds per tool.

| rank | tool | median s [95% CI] | p95 s | tests passed | defects caught | output US$ |
|---|---|---|---|---|---|---|
| 1 | flashwright | 7.3 [7.2, 7.7] | 7.8 | 144/144 | 5/5 | 0.0011 |
| 2 | bun | 10.6 [10.5, 10.9] | 11.0 | 144/144 | 5/5 | 0.0006 |
| 3 | playwright | 11.5 [11.3, 12.3] | 12.4 | 144/144 | 5/5 | 0.0010 |
| 4 | selenium | 13.9 [13.9, 14.7] | 15.0 | 144/144 | 5/5 | 0.0003 |
| 5 | puppeteer | 13.9 [13.8, 14.0] | 14.1 | 144/144 | 5/5 | 0.0011 |
| 6 | nightwatch | 18.6 [18.6, 18.7] | 18.7 | 144/144 | 5/5 | 0.0030 |
| 7 | webdriverio | 27.5 [27.3, 27.9] | 28.0 | 144/144 | 5/5 | 0.0020 |
| 8 | cypress | 38.4 [38.1, 38.9] | 39.0 | 144/144 | 5/5 | 0.0043 |

**B. Driving tools, sorted by estimated agent cost.**
bx is first under the rule, but the lead over browser-use is not robust: without the docs tokens browser-use is cheaper (US$ 0.0398 against 0.0417).
agent-browser is the fastest, 6 times faster than bx for 48% more cost.
3 complete rounds per tool, 24 scenarios per session.

| rank | tool | US$ per session [95% CI] | median s | p95 s | scenarios passed | defects caught | calls per scenario |
|---|---|---|---|---|---|---|---|
| 1 | bx | 0.0425 [0.0378, 0.0473] | 48.5 | 48.5 | 72/72 | 5/5 | 1.0 |
| 2 | browser-use | 0.0449 [0.0408, 0.0490] | 64.4 | 65.9 | 72/72 | 5/5 | 1.0 |
| 3 | agent-browser | 0.0629 [0.0576, 0.0683] | 8.0 | 8.9 | 72/72 | 5/5 | 1.0 |
| 4 | surf | 0.0661 [0.0597, 0.0724] | 101.1 | 101.5 | 72/72 | 5/5 | 6.8 |
| 5 | flashwright-mcp:code | 0.0727 [0.0674, 0.0780] | 19.1 | 19.2 | 72/72 | 5/5 | 1.0 |
| 6 | playwright-mcp:code | 0.0728 [0.0675, 0.0781] | 20.6 | 21.6 | 72/72 | 5/5 | 1.0 |
| 7 | flashwright-mcp:adaptive | 0.1286 [0.1172, 0.1400] | 16.9 | 16.9 | 72/72 | 5/5 | 7.8 |
| 8 | flashwright-mcp:steps | 0.1286 [0.1172, 0.1400] | 46.5 | 46.9 | 72/72 | 5/5 | 7.8 |
| 9 | playwright-mcp:steps | 0.1287 [0.1173, 0.1401] | 47.8 | 47.9 | 72/72 | 5/5 | 7.8 |
| 10 | chrome-devtools-axi | 0.1700 [0.1509, 0.1894] | 153.3 | 153.5 | 72/72 | 5/5 | 8.1 |

- bx belongs to the author of this repository.
- The scenarios were chosen by the authors of flashwright, which is one of the tools measured.
- agent-browser failed 1 scenario in round 4 of B, which is left out because the runner crashed before every tool finished it.
- surf hung for 60 s once in each of the 4 unranked rounds, and never in the ranked ones.
- Intervals in B overlap; the ranking uses the paired difference per scenario. Ranks 5 and 6 differ by 48 schema tokens.
- Not measured: browse (extension not paired) and TestCafe in A (never connected to Chrome).
- Cost is an estimate that leaves out agent reasoning and retries.

## Layout

| path | content |
|---|---|
| `methodology.md` | setup, phases, metrics, failure definition, known limitations |
| `ranking-rule.md` | the v2 ranking rule, committed before the paid runs |
| `results/` | report (`benchmark.html`), v1 report and data as JSONL |
| `results/v2/` | v2 data as JSONL, `analysis.md` and `ranking.json` |
| `results/e2e/` | e2e suites and driving tools, no LLM: `report.md`, data as JSONL |
| `harness/e2e/` | the e2e benchmark; `node harness/e2e/run-all.mjs` reruns it |
| `harness/` | scripts that produced the data, and how to rerun them |

Client data (credentials, ground truth, screenshots, page dumps, logs) is not published; `methodology.md` §14 lists what was left out.
