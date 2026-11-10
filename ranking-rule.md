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

## Addendum 1: v4, the same rule with a weaker model

Written and committed on 2026-11-10, before the v4 baseline, pilot and ranked runs.
The user asked for it: a weak model shows how much of the accuracy comes from the tool.

- **What runs:** 6 tools, the 5 of v2 plus `bx` 0.2.0 (tag `v0.2.0`, commit `b071bf0` of https://github.com/YuukiFST/bx), on the same task, with the same prompt shape, flags and blocks as v2.
- **Model:** `claude-haiku-5-5` instead of `claude-sonnet-5-5`. Nothing else in section 5 changes; the Claude Code version is recorded on every row.
- **Rule:** sections 1 to 4 apply as written, to the v4 rows only (`results/v4-haiku/agents.jsonl`), with the v4 baseline (`results/v4-haiku/baseline.jsonl`). `harness/analyze-v2.mjs results/v4-haiku` implements it; its only change is that `bx` is in its tool list, and its output on `results/v2` is identical before and after that change.
- **Steps:** baseline, 3 runs; pilot, 1 block of 6 tools, not ranked; stage 4a, 10 blocks of 6 tools; stage 4b, only if rank 1 is tied after 4a, 20 more blocks of the tools tied at rank 1.
- **Cap:** US$ 20 for v4 and v3 together, counting the runs listed under "Before this addendum".
- **Data kept apart:** raw transcripts and screenshots go to `harness/agents-v4-haiku/` (`RAW` in `agents.sh`), so the v2 transcripts are not overwritten.

Before this addendum, and not part of the ranking data:

- 8 unranked Haiku runs of bx alone were made while bx was being changed (`results/v4-haiku/setup.jsonl`, US$ 0.025 in total): 1 with bx 0.1.0 and 7 with work in progress.
  They found a bx defect (a click returned while the screen it opened still showed its loading skeleton), which bx 0.2.0 fixes, and they led to changes in the bx error messages and in `agent-docs/bx.md`.
- So bx 0.2.0 was shaped with this task and this model in view; the 5 other tools and their docs are as in v2. The held-out task of `PLAN.md` in the bx repository is the control for that, and it is not written yet.
- The benchmark author also wrote bx.

## Addendum 2: v3, bx against the v2 rows

Written and committed on 2026-11-10, before any v3 agent run.

- Only bx 0.2.0 runs, with `claude-sonnet-5-5`; the 5 measured tools keep their v2 rows (`results/v2/agents.jsonl`) and are not rerun. This is the user's decision.
- bx rows go to `results/v3/agents.jsonl`, with a new baseline in `results/v3/baseline.jsonl` taken in the same session: baseline 3 runs, pilot 1 run (not ranked), 30 ranked runs.
- The v2 rule pairs tools per block, and bx shares no block with the others. For every pair that includes bx, the paired difference is replaced by the difference of means of two independent samples, with a percentile bootstrap that resamples each tool's runs separately (10,000 resamples, seed 20261110). The separation test, the failure tier and the 8-run minimum are unchanged. Pairs among the 5 old tools keep their v2 result.
- Cost above baseline uses each data set's own baseline (v2 for the old tools, v3 for bx).
- Limits, stated next to any v3 result: bx runs back to back in another session, so the prompt cache, the machine load and the API latency differ from the v2 day; nothing corrects time. If the Claude Code version differs from the v2 one (`2.1.317`), the report says so.
