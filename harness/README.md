# Benchmark harness

Scripts that measure five browser tools for agents (agent-browser, chrome-devtools-axi, surf, browser-harness, playwright-mcp) against one local web app, driving the same Chrome over CDP.

The app under test is in Portuguese, so selectors, wait texts and routes (`E-mail`, `Senha`, `Entrar`, `Buscar`, `Pesquisar`, `Cód. empresa`, `/inscricoes`, `/debitos`, `/guias`) are left as they appear in its UI.
To bench another app, edit those strings in `bench.sh`, `coverage.sh` and `agents.sh`.

Tool codes used everywhere: `ab` agent-browser, `axi` chrome-devtools-axi, `surf` surf, `bh` browser-harness, `pw` playwright-mcp.

## Requirements

- Git Bash on Windows (the scripts use `cygpath`, `powershell` and `MSYS_NO_PATHCONV=1`).
- Node.js with global `fetch` and `WebSocket` (Node 22+).
- A dedicated Chrome started with `--remote-debugging-port=$BENCH_CDP_PORT` (default 9444; v1 used 9333) and the surf extension loaded. Every tool and `cdp.mjs` talk to that port. It must be the only Chrome on the machine with the surf extension, because surf reaches its extension through one machine-wide pipe.
- The tools under test on `PATH`: `agent-browser`, `chrome-devtools-axi`, `surf`, `browser-harness`, `playwright-mcp`; `claude` for `agents.sh`.
- `pw` in `bench.sh`, `latency.sh` and `coverage.sh` uses a `playwright-mcp` HTTP server on port 8931 that the scripts start themselves.

## Environment

| Variable | Used by | Meaning |
|---|---|---|
| `BENCH_QUERY` | `bench.sh`, `agents.sh` (required) | search term typed into the app's search box; can live in `creds.sh` |
| `BENCH_APP` | `bench.sh`, `cdp.mjs` | app base URL, default `http://localhost:3100` |
| `BENCH_EMAIL`, `BENCH_PASS` | `bench.sh` | login of a test account, read from `creds.sh` |
| `PW_MCP_URL` | `pw.mjs` | playwright-mcp endpoint, default `http://localhost:8931/mcp` |
| `RESULTS` | all scripts | output directory, default `../results/v2` |
| `BENCH_CDP_PORT` | all scripts | CDP port of the dedicated Chrome, default `9444` |
| `CAP_USD` | `agents.sh` | spend cap for all paid runs, default `25` |


Credentials: `cp creds.example.sh creds.sh` and fill it in. `creds.sh` is git-ignored.

## Ground-truth files (not published)

Create these in `ground-truth/` from your own database or app. They hold client data, so they are git-ignored.

| File | Format | Used by |
|---|---|---|
| `ground-truth/search.txt` | one result per line, `inscricao\|...`, sorted, for the `BENCH_QUERY` search; only the first `\|` field is compared | `bench.sh` task `search` |
| `ground-truth/routes.txt` | one authenticated route per line, e.g. `/dashboard` | `bench.sh` task `sweep` |
| `ground-truth/h1.json` | `{ "<route>": "<main h1 text>" }`; `node cdp.mjs ground-truth-h1 $(cat ground-truth/routes.txt)` prints it while logged in | `bench.sh` task `sweep` |
| `ground-truth/agent.txt` | one line per expected result, `inscricao\|unidade` | `agents.sh` scoring |

The registration regex in `bench.sh` (`NN.N.NN.NNN.NNNN.NNN`) is the app's inscrição format; change it for another app.

## Scripts

All scripts source `lib.sh` (tool environment, `stop_tool`, `start_tool`, `trivial_call`, `tool_version`) and write to `$RESULTS`, default `../results/v2`.
The v1 data in `results/` was produced by the earlier version of these scripts; `git log` has it.

### `agents.sh`

```
bash agents.sh baseline <runs>              one-turn prompt, no browser task, same flags -> baseline.jsonl
bash agents.sh pilot [tools...]             one block, not ranked -> pilot.jsonl
bash agents.sh <first> <last> [tools...]    blocks first..last, each a random permutation of the tools -> agents.jsonl
```

Runs `claude -p --model claude-sonnet-5-5 --setting-sources "" --disable-slash-commands --output-format stream-json --verbose` with each tool's docs copied in `agent-docs/`.
Before each run it resets the browser to one active tab and stops every tool process.
Raw transcripts go to `agents-v2/` (git-ignored, they hold client data); `score-agent.mjs` turns each one into a row with the answer check, cost, turns, per-turn usage, versions and timestamp.
`CAP_USD` (default 25) stops before a block that would pass the cap.

### `bench.sh <iterations> [tools...]`

Scripted task battery: `login search read screenshot console mobile sweep` (`TASKS` env to pick).
One discarded warm-up per tool (the read task 3 times, for the size floor), then every iteration runs every tool, in an order rotated by one per iteration.
Every tool call goes through the `m` wrapper, which counts commands and characters returned.
Writes `{"tool","task","iter","pos","ts","tool_version","ms","cmds","chars","ok","detail"}` per row to `battery.jsonl`.

### `latency.sh <repetitions> [tools...]`

Cold start (tool process stopped, then the first navigation; for surf, a new session) and the trivial call, one browser round trip evaluating `1`, checked for its output.
Writes rows to `latency.jsonl` and 20 warm trivial-call timings to `warm-<tool>.txt`.

### `coverage.sh <reps> <route>...` and `score-coverage.mjs [out-file]`

`coverage.sh` saves, per repetition, the visible text of `<main>` from raw CDP and each tool's default reads (pw included) to `readings/`.
`score-coverage.mjs` scores every reading per table cell and writes `coverage.jsonl` with raw character counts.

### `analyze.mjs [battery-file] [latency-dir]` and `analyze-v2.mjs [results-dir]`

`analyze.mjs` prints battery and latency tables; it reads the Portuguese task names of the v1 data too.
`analyze-v2.mjs` prints the agent tables with bootstrap intervals, the paired differences, the failure table and the ranking of `ranking-rule.md`, and writes `ranking.json`.

### `cdp.mjs reset | logout | ground-truth-h1 <routes...> | ground-truth-text <route>`

Neutral controller over raw CDP on `BENCH_CDP_PORT`, used by the other scripts so no tool under test does setup work.
`reset` leaves one about:blank tab and brings it to the front.
Run it with `MSYS_NO_PATHCONV=1` from Git Bash, or routes like `/dashboard` are rewritten to Windows paths.

### `pw.mjs <tool> ['<json args>'] | --list`

Minimal MCP Streamable HTTP client so playwright-mcp can be called from the shell like the CLIs. Keeps the session id in `pw-session.txt`.

### `redact-results.mjs [results-dir]`

Replaces client data in the free-text `problems` field of `agents.jsonl` and `pilot.jsonl` before they are published. Run it with `BENCH_QUERY` set, from `harness/`.
