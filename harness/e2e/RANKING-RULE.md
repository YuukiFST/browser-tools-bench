# Ranking rule of the e2e benchmark

Written and committed before the ranked runs.
`analyze.mjs` applies it; nothing is ranked by hand.

## Rule

1. A false positive, or a success rate under 95%, takes a tool out of the contest for first place: it is listed after every tool that has neither.
2. Among the rest, ranking A sorts by speed and breaks ties by cost. Ranking B sorts by cost and breaks ties by speed.
3. A difference inside the confidence interval is a tie. Tools tied on both measures share a position.

## Definitions

- **A, speed:** wall time of the complete test command, 24 tests, healthy build. One worker, grouped layout (7 files), CI=1.
- **B, speed:** sum of the 24 scenario times of a round, plus the start time of the tool's server or session. The runner's own work is outside the clock.
- **Success rate:** scenarios that passed / scenarios run, healthy build, complete rounds only.
- **False positive:** the probe scenario of a defect build passes. A probe that fails for a reason other than the defect (crash, timeout, missing element) is reported as inconclusive, not as detected; in A, one reported test failure counts as detected.
- **False negative:** a scenario that fails on the healthy build.
- **Flaky:** a scenario (B) or suite (A) that both passes and fails on the healthy build in different rounds.
- **Tokens:** js-tiktoken 1.0.21, `o200k_base`. An estimate: no public tokenizer matches Claude's.
- **Prices:** Claude Sonnet 5.5, US$ 2 per million input tokens and US$ 10 per million output tokens.
- **A, cost:** tokens of the runner's output in a passing run plus the mean over the failing probe runs, at the input price.
- **B, cost:** one session of 24 scenarios: docs and schemas once (input), setup text once (output), commands (output), tool outputs (input). No reasoning, no retries, no re-reading of earlier turns.
- **Interval:** 95% percentile bootstrap, 10,000 resamples, seed 1. A resamples rounds. B resamples (scenario, round) cells. Two tools tie when the interval of the paired difference of their means contains 0. Tools are compared with the first tool of the current group, never through a chain of ties.
- **Complete round:** every ranked tool ran in it. Rounds cut by the cap are dropped.
- **Variants:** a tool measured in two idioms has two rows in B; both are ranked.

## How the B scripts were written

- One fixed script per tool turns the same 24 scenarios into that tool's own commands.
- A tool whose docs offer a multi-step form uses it: the chain of bx, the batch of agent-browser, a Python heredoc of browser-use, `execute` of browse.
  The two Playwright MCP servers run both ways, one call per action (`steps`) and one script per scenario (`code`).
  flashwright-mcp `steps` also runs with `--adaptive-settle`.
- Actions locate by role and accessible name where the tool can, by snapshot ref where the tool asks for it, and by CSS otherwise.
- Consecutive assertions are read together. The command-line tools read them with the same page expression; the Playwright scripts use locators; the `steps` variants read the snapshot.
- The assertion is judged on the value the tool returned. The state audit over CDP never changes a verdict.
- No fixed sleeps. Timeout per scenario: 60 s. Timeout per suite: 180 s.
- Tool order rotates by one per round, and every tool-round gets a new Chrome with a new profile (browse keeps its own isolated, paired profile).

## Known before the ranked runs

- Smoke rounds of every tool were run to debug the scripts; their rows are discarded.
- TestCafe is excluded from A after two failed fix attempts: it launches Chrome and never connects to it.
- Nightwatch runs with ChromeDriver on a free port, because restarts on 9515 raced on Windows; its `√` marks are read as passes.
- The `run` command of chrome-devtools-axi 0.1.46 fails on Windows, so axi uses one command per action.
- `surf go` hung once per round in every smoke round, with and without the state audit; it stays in the ranking.
- A and B caps: 20 and 40 minutes.
- browse enters B only if its extension was paired with the isolated profile before the run.

## Update run for bx 0.3.0 (written before its rounds)

- Only bx changed, so this run measures `bx` (the driver of the first run), `bx:quiet` and `agent-browser`, the one other tool with a comparable time: 6 rounds, cap of 40 minutes, the same runner, scenarios, defect builds, prices and analysis.
- `bx:quiet` is the second idiom of bx: the same steps and assertions, with `-q` (actions that succeed print nothing) and the `dblclick` step, which the first driver replaced by a page expression.
- "Complete round" applies per run: the 8 tools not measured again keep the rows of the first run.
- Times compare only inside one run. Costs compare across runs, because they come from tokens of fixed scripts.
- Positions come from `analyze.mjs` over rounds 1 to 3, with the first-run rows of the 8 tools and the update-run rows of the other three. The speed tie-break applies only between rows of one run.
- bx was changed with these 24 scenarios in view, by the author of this benchmark. Runs made while it was being changed are discarded.
