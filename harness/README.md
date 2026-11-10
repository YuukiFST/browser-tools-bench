# Benchmark harness

Scripts that measure five browser tools for agents (agent-browser, chrome-devtools-axi, surf, browser-harness, playwright-mcp) against one local web app, driving the same Chrome over CDP.

The app under test is in Portuguese, so selectors, wait texts and routes (`E-mail`, `Senha`, `Entrar`, `Buscar`, `Pesquisar`, `Cód. empresa`, `/inscricoes`, `/debitos`, `/guias`) are left as they appear in its UI.
To bench another app, edit those strings in `bench.sh`, `coverage.sh` and `agents.sh`.

Tool codes used everywhere: `ab` agent-browser, `axi` chrome-devtools-axi, `surf` surf, `bh` browser-harness, `pw` playwright-mcp.

## Requirements

- Git Bash on Windows (the scripts use `cygpath`, `powershell` and `MSYS_NO_PATHCONV=1`).
- Node.js with global `fetch` and `WebSocket` (Node 22+).
- A dedicated Chrome started with `--remote-debugging-port=9333`. Every tool and `cdp.mjs` talk to that port.
- The tools under test on `PATH`: `agent-browser`, `chrome-devtools-axi`, `surf`, `browser-harness`, `playwright-mcp`; `claude` for `agents.sh`.
- For `pw` in `bench.sh`: a `playwright-mcp --port 8931 --cdp-endpoint http://127.0.0.1:9333` server already running (`latency.sh` starts its own).

## Environment

| Variable | Used by | Meaning |
|---|---|---|
| `BENCH_QUERY` | `bench.sh`, `agents.sh` (required) | search term typed into the app's search box |
| `BENCH_APP` | `bench.sh`, `cdp.mjs` | app base URL, default `http://localhost:3100` |
| `BENCH_EMAIL`, `BENCH_PASS` | `bench.sh` | login of a test account, read from `creds.sh` |
| `PW_MCP_URL` | `pw.mjs` | playwright-mcp endpoint, default `http://localhost:8931/mcp` |
| `START` | `agents.sh` | first run number, default `1` |

`latency.sh`, `coverage.sh` and the prompt in `agents.sh` use `http://localhost:3100` directly and ignore `BENCH_APP`.

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

### `bench.sh <tool> <iterations> [tasks...]`

Scripted task battery. Tasks: `login search read screenshot console mobile sweep` (all by default).
Resets the browser, restarts the tool daemon and does one unmeasured warm-up pass, then runs each task `iterations` times.
Every tool call goes through the `m` wrapper, which counts commands and characters returned.

Writes one line per (task, iteration) to `battery.jsonl`:
`{"tool","task","iter","ms","cmds","chars","ok","detail"}`.
Also leaves `found.txt`, `h1.txt` and `shot.png` as scratch.

### `latency.sh <tool> <repetitions>`

Cold start (daemon stopped, then first navigation) and one trivial call after it.
Appends `{"tool","iter","cold_ms","trivial_ms"}` to `latency.jsonl`, then writes 20 warm trivial-call timings (ms, one per line) to `warm-<tool>.txt`.

### `agents.sh <repetitions> [tools...]`

Runs a real agent per tool with `claude -p --model sonnet` on the same search + mobile screenshot task.
Writes `agents/<tool>-<n>.json` and `.err` (raw `claude` output), `agent-<tool>-<n>.png`, and appends to `agents.jsonl`:
`{"tool","run","correct","total","extras","screenshot_px","cost_usd","turns","ms","input_tokens","output_tokens","cache_read_tokens","cache_creation_tokens","is_error","problems"}`.

### `coverage.sh <route>...`

For each route, saves the `<main>` visible text from raw CDP as `readings/ground-truth<slug>.txt` and each tool's default reads as `readings/<mode><slug>.txt` (slug is the route with `/` turned into `_`).
Appends `{"route","mode","lines","found","coverage","chars"}` per mode to `coverage.jsonl`.

### `score-coverage.mjs`

Re-scores `readings/` per table cell (lines split on tabs) for `/dashboard`, `/debitos` and `/inscricoes`.
Overwrites `coverage.jsonl` with `{"route","mode","cells","found","coverage","tokens"}` and prints a markdown table.
It also expects `readings/pw<slug>.txt`, which `coverage.sh` does not produce.

### `analyze.mjs [battery-file]`

Prints markdown tables from `battery.jsonl` (or the given file), `latency.jsonl` and `warm-<tool>.txt`.

### `cdp.mjs reset | logout | ground-truth-h1 <routes...> | ground-truth-text <route>`

Neutral controller over raw CDP on port 9333, used by the other scripts so no tool under test does setup work.

### `pw.mjs <tool> ['<json args>'] | --list`

Minimal MCP Streamable HTTP client so playwright-mcp can be called from the shell like the CLIs. Keeps the session id in `pw-session.txt`.
