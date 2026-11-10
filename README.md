# browser-tools-bench

Which browser tool should an AI coding agent use?
This repo compares five of them on one real web app, measuring cost, speed, tokens, accuracy and failures.

## Tools

- [surf-cli](https://github.com/nicobailon/surf-cli)
- [agent-browser](https://github.com/vercel-labs/agent-browser)
- [playwright-mcp](https://github.com/microsoft/playwright-mcp)
- [browser-harness](https://github.com/browser-use/browser-harness)
- [chrome-devtools-axi](https://github.com/kunchenguid/chrome-devtools-axi)

## Result (v2, 2026-11-10)

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

## Layout

| path | content |
|---|---|
| `methodology.md` | setup, phases, metrics, failure definition, known limitations |
| `ranking-rule.md` | the v2 ranking rule, committed before the paid runs |
| `results/` | report (`benchmark.html`), v1 report and data as JSONL |
| `results/v2/` | v2 data as JSONL, `analysis.md` and `ranking.json` |
| `harness/` | scripts that produced the data, and how to rerun them |

Client data (credentials, ground truth, screenshots, page dumps, logs) is not published; `methodology.md` §14 lists what was left out.
