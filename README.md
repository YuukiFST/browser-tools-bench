# browser-tools-bench

Which browser tool should an AI coding agent use?
This repo compares five of them on one real web app, measuring cost, speed, tokens, accuracy and failures.

**Status:** the methodology is under external review (`docs/review-prompt.md`). Treat the ranking as provisional until that review is done.

## Tools

- [surf-cli](https://github.com/nicobailon/surf-cli)
- [agent-browser](https://github.com/vercel-labs/agent-browser)
- [playwright-mcp](https://github.com/microsoft/playwright-mcp)
- [browser-harness](https://github.com/browser-use/browser-harness)
- [chrome-devtools-axi](https://github.com/kunchenguid/chrome-devtools-axi)

## Provisional result

All five tools got the agent task right in 14 of 14 checks.
They differed in what it cost to get there.

| rank | tool | agent US$ | agent time | agent turns | agent tokens | battery success | silent failures |
|---|---|---|---|---|---|---|---|
| 1 | surf-cli | 0.171 | 42 s | 6.5 | 275k | 35/35 | 0 |
| 2 | agent-browser | 0.196 | 50 s | 8 | 335k | 35/35 | 0 |
| 3 | playwright-mcp | 0.217 | 56 s | 13 | 470k | 35/35 | 0 |
| 4 | browser-harness | 0.267 | 113 s | 20.5 | 853k | 35/35 | 1 |
| 5 | chrome-devtools-axi | 0.232 | 83 s | 13.5 | 541k | 33/35 | 2 |

Agent columns are the mean of 2 runs of Claude Sonnet through `claude -p`.
The full table is in `results/benchmark.html`.
How each number was produced, and the known limits, are in `docs/methodology.md`.

## Layout

| path | content |
|---|---|
| `docs/methodology.md` | setup, phases, metrics, ranking rule, known limitations |
| `docs/review-prompt.md` | prompt for an independent methodology review |
| `docs/linkedin-post.md` | draft post, English translation |
| `results/` | report (`benchmark.html`) and raw data as JSONL |
| `harness/` | scripts that produced the data, and how to rerun them |

Client data (credentials, ground truth, screenshots, page dumps, logs) is not published; `docs/methodology.md` §13 lists what was left out.
