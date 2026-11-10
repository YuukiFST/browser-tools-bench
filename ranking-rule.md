# Ranking rule (pre-registered)

Written and committed on 2026-11-10, before any paid run of the v2 benchmark.
The rule is implemented in `harness/analyze-v2.mjs`, committed together with this file, and it is applied exactly as written.
If the v2 data contradicts the v1 ranking, the v1 ranking loses.

## 1. What is ranked

The ranking covers phase D only: a real agent (`claude -p`) doing one task with each tool (`harness/agents.sh`).
The scripted battery, latency and coverage phases are reported, but they do not change the rank.

## 2. Metrics

Primary metrics, per agent run, lower is better:

1. **Turns**: `num_turns` from the `claude -p` result.
2. **Cost above baseline**: `total_cost_usd` of the run minus the mean `total_cost_usd` of the baseline runs.
   The baseline is a one-turn prompt with no browser task, run with the same flags and model (`agents.sh baseline 3`).
   It removes the fixed session overhead (system prompt and tool definitions written to the prompt cache) that every run pays.

Secondary metric: **agent time** (wall time of the `claude -p` process, in seconds).
It is reported with its intervals and is never used to order tools or to break a tie.

Means are taken over all runs of a tool that returned a valid `claude` result, failed runs included, because a failed run spends what it spends.
A run with no valid result (no `result` event) has unknown cost and turns: it counts as a failure and is left out of the metric means.

## 3. Failures

The failure definition is the one in `methodology.md` ("Failure definition").
For an agent run: the run failed when the reply is not valid, when any of the 7 registrations or units differs from the ground truth, when there is an extra registration, or when the screenshot is not 390 or 780 px wide.

Failures are reported in their own table, as failed runs over total runs, per tool.
They change the ranking only through the failure tier below.

**Failure tier.** For each pair of tools, a one-sided Fisher exact test asks whether tool X has more failed agent runs than tool Y.
A tool's tier is the number of other tools with significantly fewer failures than it (p < 0.05).
Tools in a lower tier always rank above tools in a higher tier.
With no failures, or with failure counts that do not differ significantly, every tool is in tier 0.

## 4. Order and ties

1. Order the tools by failure tier, then by mean cost above baseline, then by mean turns.
2. For each pair of adjacent tools in that order, compute the paired per-block difference (the next tool minus this one) of each primary metric.
   Only blocks where both tools have a valid run are paired.
   The 95% interval is a percentile bootstrap: 10,000 resamples of blocks with replacement, fixed seed 20261110.
3. The pair is **separated** when the tools are in different failure tiers, or when all of these hold:
   - there are at least 8 paired blocks;
   - the interval of at least one primary metric lies entirely above zero (the next tool is worse);
   - the interval of neither primary metric lies entirely below zero (the next tool is not better on the other one).
4. Otherwise the pair is **tied**.
   Two tools tie when the 95% bootstrap interval of their paired per-block difference contains zero on both primary metrics, when the two metrics point in opposite directions, or when they have fewer than 8 paired blocks.
5. Ties chain along the order: a group of tools joined by ties shares one rank.
   The rank of a group is 1 plus the number of tools in better groups (competition ranking: 1, 2, 2, 4).

## 5. Runs, budget and stopping rule

- Model pinned to `claude-sonnet-5-5`. Claude Code version, tool versions and an ISO timestamp are recorded on every row.
- Flags: `--setting-sources "" --disable-slash-commands --strict-mcp-config --tools <Bash,Read | Read> --no-session-persistence --max-budget-usd 1`, so no user settings, hooks, plugins or skills reach the agent.
- Every tool process is stopped before each agent run, so every run starts cold.
- A block is one random permutation of the tools.
- Hard cap: US$ 25 for all of stage 3, counting setup checks, baseline, pilot and blocks.
  Before each block, `agents.sh` adds the running sum of `total_cost_usd` to the estimated cost of the next block (mean cost per run so far, times the tools in the block).
  If that passes US$ 25, it stops before the block.

| step | runs | estimated cost |
|---|---|---|
| baseline | 3 one-turn runs | about US$ 0.05 |
| pilot | 1 block of 5 tools; checks that every row has all fields and that the scoring works | about US$ 1.1 |
| stage 3a | 10 blocks of 5 tools, one session, one day | about US$ 11 |
| stage 3b, only if rank 1 is tied after 3a | 20 more blocks of the tools tied at rank 1 | about US$ 4.3 per tool, about US$ 13 for 3 tools |

Stage 3b blocks are numbered after the stage 3a blocks, and the rule is applied once more to all blocks.
If the cap stops stage 3b early, the rule is applied to the blocks that ran, and the report says so.
The pilot block is not part of the ranking data.

Before the pilot, the rule allows no change to the metrics, the tie test, the failure definition or the thresholds above.
A harness fix found in the pilot is allowed and is listed in the report.
