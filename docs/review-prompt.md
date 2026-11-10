# Methodology review prompt

Paste everything below the line into a fresh session of the strongest model available.
The session needs this repo checked out (`git clone https://github.com/YuukiFST/browser-tools-bench`) and Node.js.

---

## TASK

Review the methodology of a benchmark that ranks 5 browser tools for AI coding agents, before its author publishes the ranking on LinkedIn.
Decide whether each claim in the post is supported by the data, find every flaw that could change the ranking or a published number, and give the cheapest change that fixes each flaw.
The author's goal is the most precise result possible without spending much time or money, so weigh every fix by its cost.

You are a reviewer, not the author: no conclusion in the repo is binding on you, including the ranking and the limitations the author already lists.

## CONTEXT

Read these in full before writing anything:

1. `docs/methodology.md`: setup, the 4 phases, the metrics, the ranking rule and 10 self-reported limitations.
2. `results/benchmark.html`: the published table.
3. `docs/linkedin-post.md`: the post. Every claim in it is in scope.
4. `results/*.jsonl` and `results/warm-*.txt`: the raw data. Key names are explained in `harness/README.md`.
5. `harness/`: the scripts that produced the data. `bench.sh` holds the per-tool scripts of the battery; `agents.sh` holds the agent prompt and the scoring.

Facts the files do not show:

- The data was produced on one Windows machine, with other agent sessions running at the same time.
- Ground truth, page dumps, screenshots and logs hold client data and are not in the repo. The silent-failure counts in methodology §10 rest on logs you cannot see; treat them as the author's testimony.
- Agent cost is the `total_cost_usd` reported by `claude -p` for Claude Sonnet. Agent runs were sequential, with a fixed order.
- The harness was translated from Portuguese and made portable after the data was collected. The data came from the Portuguese originals. If the code and the data disagree, report it as a translation risk, not as a flaw of the measurement.

## INSTRUCTIONS

1. **Recompute before you judge.** Write a small Node script over `results/*.jsonl` that recomputes every number in `results/benchmark.html` and in the post: means, medians, sums, success counts and percentages. List each mismatch with the expected value, the computed value and the source line.
2. **Check each claim in the post** against the data. Classify each one as supported, supported with a needed caveat, or unsupported.
3. **Attack the method.** Cover at least these:
   - sample size and variance in the agent phase, including whether n=2 can separate ranks 1 to 3, with an estimate from the data you have;
   - run order and prompt caching;
   - the cross-day comparison and the way drift is handled;
   - whether hand-written scripts measure the tool or the script writer;
   - token estimation by characters / 4;
   - the coverage metric and its single run;
   - how silent failures were counted;
   - the ranking rule chosen after the data;
   - fairness of the setup, including the per-tool docs the agent reads, MCP schema overhead, the HTTP client added for pw, and the extension for surf.

   Add anything else you find.
4. **For each flaw, give:** severity (changes the ranking / changes a published number / wording only), evidence (`file:line`, or a value you computed), the cheapest fix, and its estimated cost in agent runs, US$ and wall time.
   Use the per-run costs in `results/agents.jsonl` for the estimate.
5. **Propose one minimal rerun plan** that would make the ranking defensible, within a budget you justify. Say how many runs per tool, in what order (randomized or interleaved), what to pin (tool versions, model, day), and which statistic to report (for example mean with a bootstrap interval, or a paired comparison).
   If the current data already supports a weaker claim, write that claim.
6. **Stay read-only.** Run only Node or Python analysis over the files in the repo. Do not run the harness, `claude -p`, or any browser.
7. **State uncertainty.** If a judgment depends on something the files do not show, say what you checked and what is missing, rather than guess.

## OUTPUT

Markdown, in English, with these sections in this order:

1. **Verdict.** One paragraph: publishable as is, publishable with listed changes, or needs a rerun first.
2. **Recomputation.** A table of every checked number: metric, tool, published value, recomputed value, match.
3. **Claims.** A table: post sentence, classification, reason.
4. **Flaws.** A table ordered by severity: id, flaw, severity, evidence, cheapest fix, cost.
5. **Rerun plan.** Steps with budget.
6. **Corrected post wording.** For each unsupported or caveated claim, the replacement sentence, keeping the author's direct, technical tone. Use no dashes.
7. **Analysis script.** The full script you used, so the author can rerun it.
