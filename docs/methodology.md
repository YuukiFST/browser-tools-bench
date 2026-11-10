# Methodology

How the benchmark was run, written on 2026-11-10 from the harness scripts and the raw data in `results/`.
Before this file, the methodology lived only in the chat of the session that ran the benchmark and in the footer of `results/benchmark.html`.

## 1. Goal

Pick the browser tool for AI coding agents on one real app, measuring speed, tokens, cost, accuracy and failures.
The result feeds `results/benchmark.html` and a public LinkedIn post (`docs/linkedin-post.md`).

## 2. Tools and versions

Versions were read with `--version` on 2026-11-10, after the measurements.
No version was pinned before measuring.

| id | tool | version | how it is driven |
|---|---|---|---|
| surf | surf-cli | 2.26.0 | `surf` CLI, plus a Chrome extension installed by hand |
| ab | agent-browser | 0.41.2 | `agent-browser --cdp 9333` CLI |
| pw | playwright-mcp | 0.0.85 | MCP server; in the scripted battery through a minimal Streamable HTTP client (`harness/pw.mjs`, port 8931); for the agent through `--mcp-config` over stdio |
| bh | browser-harness | 0.1.13 | CLI that reads Python from stdin |
| axi | chrome-devtools-axi | 0.1.46 | CLI; downloads `chrome-devtools-mcp@latest` at run time |

## 3. Environment

- One isolated Chrome for Testing 157, dedicated profile, CDP on port 9333, shared by all 5 tools.
- App under test: a production build (`next start -p 3100`) of an internal Next.js 16 app for municipal property tax (IPTU), pinned to one commit, with a local Supabase database. The app UI is in Portuguese.
- Machine: Windows 10, Git Bash. Other agent sessions were running on the same machine during the measurements; background load was not controlled.
- `harness/cdp.mjs` is a neutral raw-CDP controller. It closes tabs (`reset`) and clears cookies and storage (`logout`) without going through any measured tool.

## 4. Ground truth

The ground-truth files hold client data and are not published.
`harness/README.md` describes their format so the benchmark can be rerun on another app.

- `ground-truth/search.txt` and `ground-truth/agent.txt`: the 7 property registrations (inscrições) returned by one company-name search, each with its unit, read from Postgres.
- `ground-truth/h1.json`: the `h1` of 16 authenticated routes, read by `cdp.mjs`.
- `readings/ground-truth_*.txt`: the `innerText` of `<main>` on 3 routes (dashboard, debts, registrations), read by `cdp.mjs`.

## 5. Phase A: scripted battery (`harness/bench.sh`)

- 7 tasks: login, search, read, screenshot, console, mobile and sweep (16 routes).
- 5 iterations per tool, after 1 discarded warm-up pass. Total: 175 rows in `results/battery.jsonl`.
- Every tool call goes through the `m` wrapper, which counts calls, characters returned and wall time.
- Tokens = characters / 4. This is an estimate, not a tokenizer.
- Success is checked per task:
  - login: the URL is `/dashboard`.
  - search: an exact `diff` against the ground truth.
  - mobile: the PNG width is 390 or 780.
  - console: a random marker appears.
  - sweep: an exact `h1` match.
- The read task has no correctness check in the battery; it only measures size. Phase C measures read quality.
- I (the agent of the session) wrote each tool's script in that tool's idiom.
  For example, the bh search and read tasks dump the accessibility tree with a custom Python snippet (`BH_AX`), and the bh sweep prints only the `h1`.
- Table metrics: the sum of the medians of the 7 tasks (time, calls, tokens) and the total successes.
- playwright-mcp was measured on 2026-11-10. The other 4 tools were measured on 2026-11-09.

## 6. Phase B: latency (`harness/latency.sh`)

- Cold start: the tool's daemon is stopped, then the time to the first navigation is measured. 5 repetitions per tool (`results/latency.jsonl`).
- Warm simple command: 20 trivial calls in a row (`results/warm-*.txt`), median and p90.
- The trivial command differs per tool: `get url`, `eval 1`, `js return 1`, `print(1)`, `browser_evaluate`.
- For pw, every call goes through the `pw.mjs` Node client, which adds about 150 ms of Node startup.

## 7. Phase C: read coverage (`harness/coverage.sh`, `harness/score-coverage.mjs`)

- 3 routes. The report table shows only the dashboard.
- Each tool's default read (snapshot, `page.read`, AX tree) is compared with the `innerText` of `<main>`.
  The `innerText` is split into cells, by line and by tab, keeping cells of at least 2 characters.
- Coverage = the percentage of ground-truth cells found as a substring of the normalized output.
- One run per route and tool, with no repetition.
- The pw rows have a different source from the rest.
  - `score-coverage.mjs` overwrites `coverage.jsonl` and expects `readings/pw_*.txt`, which `coverage.sh` never writes.
  - The pw readings on disk were taken while the browser was logged out, so they show the login page and scored 2.5% / 0% / 0%.
  - The published pw values (98.3% and 7,312 tokens on the dashboard) come from an earlier ad-hoc run on 2026-11-10. In that run, ab scored 95.3%, the same as on day 1.
  - Those pw values survive only in the session transcript; the raw reading was not kept.
  - In `results/coverage.jsonl`, the stale pw rows were replaced with the transcript values and a `source` field.

## 8. Phase D: real agent (`harness/agents.sh`)

- `claude -p --model sonnet --output-format json --strict-mcp-config --no-session-persistence`.
- One task, the same for all tools:
  1. Search the company name in the Inscrições screen and list each registration with its unit.
  2. Set the viewport to 390x844, save a screenshot of `/guias`, and restore the viewport.
- Each prompt tells the agent to read the tool's skill or `--help` before first use.
  The size of that documentation differs between tools and counts toward the cost.
- Allowed tools: `Bash` and `Read` for the CLIs; `Read` and `mcp__playwright` for pw.
- 2 runs per tool, sequential, in the same Chrome, always already logged in.
  The order was fixed: ab, axi, surf, bh; pw ran on another day.
- Scoring: registrations and units equal to the ground truth (7/7 per run), plus the screenshot width.
- Cost, turns and tokens come from the `claude -p` JSON (`total_cost_usd`, `num_turns`, `usage`). Time is wall time.
- Table: the mean of the 2 runs.

Raw data per run (`results/agents.jsonl`):

| tool | run | correct | US$ | turns | s | total tokens |
|---|---|---|---|---|---|---|
| surf | 1 | 7/7 | 0.168 | 7 | 43.7 | 292,313 |
| surf | 2 | 7/7 | 0.175 | 6 | 40.9 | 257,470 |
| ab | 1 | 7/7 | 0.212 | 8 | 46.2 | 328,842 |
| ab | 2 | 7/7 | 0.181 | 8 | 52.9 | 340,897 |
| pw | 1 | 7/7 | 0.170 | 12 | 61.8 | 360,065 |
| pw | 2 | 7/7 | 0.264 | 14 | 50.2 | 579,539 |
| axi | 1 | 7/7 | 0.252 | 13 | 74.8 | 545,528 |
| axi | 2 | 7/7 | 0.212 | 14 | 91.4 | 535,523 |
| bh | 1 | 7/7 | 0.237 | 18 | 94.0 | 736,936 |
| bh | 2 | 7/7 | 0.296 | 23 | 132.4 | 969,207 |

The `problems` field of each run holds the agent's own note on what went wrong and how it recovered, truncated at 160 characters and translated from Portuguese.
In axi run 1, the agent reported that `resize 390 844` returned 500x844, yet the scored screenshot was 390 px wide; this was not investigated.

## 9. Drift control

- On 2026-11-10, ab ran the full battery again (`results/drift-control-ab.jsonl`, 35 rows).
- ab's total time rose from 33.7 s to 49.0 s, about 45%.
- pw's battery time in the table (49.8 s) is not corrected.
  The "≈ 34 s" note next to it is a proportional rescale by ab's drift.

## 10. Silent failures and timeouts

- These were counted from what surfaced during development and the battery runs, with no fault-injection protocol. The logs are not published, because they contain client data.
- axi: `fillform` in a background tab returned success without filling; a snapshot was taken without waiting for the `h1`. 1 MCP `-32001` timeout.
- bh: typed into a background tab with no error.

## 11. Ranking

- The order did not follow a formula written before measuring.
- The first version put agent-browser first.
  After the author asked why, surf-cli moved to first: it had lower agent cost, time, turns and tokens with the same accuracy.
- The criterion the current version applies in practice: accuracy and failures first, then agent cost and time.

## 12. Known limitations

1. Phase D has n=2. pw ranged from US$ 0.170 to 0.264 across its 2 runs, a spread that covers the whole gap between surf, ab and pw. There is no confidence interval.
2. Phase D used a fixed order, with no randomization or interleaving. Prompt caching (`cache_read_tokens`, `cache_creation_tokens`) may favor whoever runs later.
3. pw was measured on another day, with the environment 45% slower, so time comparisons with it are weak.
4. Phase A measures hand-written scripts. Part of each difference may come from the script, not the tool; the bh sweep token count is one example.
5. Battery tokens are characters / 4, not a real tokenizer.
6. The benchmark covers one agent task, one app, one model (Sonnet) and one machine with uncontrolled load.
7. Coverage comes from one run, and the report shows one route.
8. Silent failures were counted opportunistically.
9. Versions were not pinned; axi downloads `@latest` on every start.
10. surf uses a browser extension, while the other tools connect over CDP directly. That setup cost is in no metric.
11. The pw coverage values cannot be reproduced from published data (see §7).
12. Suspected harness defects were found while porting the scripts and left unfixed, so the code matches the data. None of the 13 has been shown to change a published number.
    - `bench.sh` hardcodes "/7 found".
    - `mask` in `bench.sh` puts the password into a sed pattern unescaped.
    - The warm-up `OUT=/dev/null` swap does nothing.
    - The search check needs a sorted ground-truth file.
    - `score-coverage.mjs` overwrites `coverage.jsonl` and expects pw readings that `coverage.sh` never writes.
    - The coverage scripts divide by zero on an empty ground truth.
    - `agents.sh` drops a run when `claude -p` returns non-JSON.
    - `analyze.mjs` produces NaN when a task is missing.
    - `pw.mjs` throws on an empty server reply.
    - `latency.sh`, `coverage.sh` and the agent prompt ignore `BENCH_APP`.
    - Some comments and usage text are stale.

## 13. Version 2 harness (2026-11-10)

The v1 data above stays as it was published, in `results/`.
The v2 harness writes to `results/v2/` and fixes the defects an independent review found (F1 to F14).
The ranking rule of v2 was written before any paid run: `docs/ranking-rule.md`.

### Failure definition

A check failed, or the output was under 50% of the tool's own median.

- **Agent run:** failed when `claude -p` returned no valid result, when the reply is not the requested JSON, when any of the 7 registrations or units differs from the ground truth, when there is an extra registration, or when the screenshot is not 390 or 780 px wide.
- **Battery task:** failed when its check fails (login URL, exact search `diff`, PNG width, console marker, exact `h1` per route).
  The read task also fails when its output has fewer than half the characters of the median of 3 warm-up reads by the same tool.
  This catches a read of a page that had not rendered yet, which v1 scored as a success for bh (read iteration 2) and counted as a silent failure for axi.
- **Latency:** a trivial call counts only if it printed the evaluated `1`; failed calls are counted, not timed.

Failures come only from these checks, run on every row; v1 counted silent failures from what surfaced during development.

### Same conditions for every tool

- **Agent isolation:** `claude -p --model claude-sonnet-5-5 --setting-sources "" --disable-slash-commands --strict-mcp-config --tools <list>`.
  `--setting-sources ""` loads no user, project or local settings, so no user hooks, plugins, permissions or skills reach the agent.
  `--safe-mode` was tested and not used: it also drops the `--mcp-config` server, so playwright-mcp had no tools (`mcp_servers: []` in the init event).
  The one user mod that still loads, `quiet-tools`, only changes the terminal display; its source says the model context is untouched.
  Each row records the init event's MCP servers, tool count, skill count and plugin count.
- **Docs:** each agent reads a copy of its tool's docs in `harness/agent-docs/`, not the live skill directory; the size of each copy, in characters, is on every row (`docs_chars`).
  The chrome-devtools-axi copy is the skill file installed on this machine, which tells the reader to use browser-harness for browsing; it is copied as the agent saw it.
- **Dedicated browser:** the v2 Chrome listens on port 9444, not 9333.
  During setup, another agent session on the same machine opened a tab of an unrelated local site in the 9333 Chrome, and every `cdp.mjs reset` closed that session's tabs; a separate port keeps the two apart.
  The battery stops every tool process before each tool's turn, so no tool keeps a session or a background tab for the next one.
- **browser-harness tab:** when its daemon starts, browser-harness attaches to a new tab of its own in the background, not to the active tab that `reset` leaves (its skill: "attach ... without changing Chrome's visible tab").
  On this app, typing into that hidden tab lost the values between calls, and the battery login failed twice in smoke tests.
  The battery and coverage scripts therefore call `activate_tab(current_tab())` in their untimed setup, as v1 did, so every tool works in a visible tab there.
  The agent runs do not: the agent gets browser-harness as shipped, and its skill says when to activate the tab.
  This is a known difference between the two phases, kept on purpose: the agent phase measures the tool as an agent meets it.
- **Cold start:** every tool process is stopped before each agent run, so the wall time of every tool includes its start-up (v1 timed playwright-mcp cold and the CLI daemons warm).
- **Pinning:** the model id is pinned, chrome-devtools-axi runs a fixed local `chrome-devtools-mcp` 1.12.0 through `CHROME_DEVTOOLS_AXI_MCP_PATH` instead of `@latest`, and every row records an ISO timestamp, the Claude Code version and the tool version.
- **Order:** agent runs go in blocks, each a random permutation of the 5 tools; the battery rotates the tool order by one per iteration.
- **Waits in the battery:** one rule per task for every tool: after the login submit, poll until the URL contains `/dashboard`; after the search click, wait for the text "Cód. empresa"; after every other navigation, wait until `main h1` exists.
- **Output size:** raw character counts, labeled characters. "Tokens" is used only for the `usage` fields that `claude` reports.
- **Latency:** the trivial call is one browser round trip that evaluates `1`, for every tool. surf has no command that stops its native host (`surf --help-full`), so its cold start row is a new session on a running host, labeled "new session".
- **Coverage:** 3 readings per route and tool, all kept; playwright-mcp is read by `coverage.sh` like the others; the browser-harness accessibility row is labeled "custom snippet", next to its `innerText` row.

## 14. What is not published and why

- Credentials (`creds.sh`), ground-truth files, `readings/`, screenshots, raw agent transcripts and logs. They contain client data: company names, property registrations and financial values.
- In the published JSONL the search term is replaced with `<QUERY>`.
