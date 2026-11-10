# LinkedIn post draft

Not published.
The post will go out in Portuguese; this is the English translation of the current draft.
Every number in it is printed by `harness/analyze-v2.mjs` (`results/v2/analysis.md`).

---

I tested 5 tools that let an AI agent control the browser: surf-cli, agent-browser, playwright-mcp, browser-harness and chrome-devtools-axi. The target was the property tax (IPTU) web app I work on.

My first version of this benchmark ranked them with 2 agent runs per tool. A review showed that 2 runs could not separate the top 3, so I fixed the harness and ran it again. The ranking rule was written and committed before any paid run.

The setup: one dedicated Chrome, one production build, the model pinned to claude-sonnet-5-5, no user settings, hooks or skills, and every tool started cold before each run. The agent got one task: search a company, list its 7 property registrations with their units, and save a mobile screenshot.

The agent ran in 10 blocks, each block all 5 tools in random order. The two tools tied at the top got 20 more blocks, so they have 30 runs each and the others 10.

The result, ranked on turns and on cost above a no-browser baseline:

1. playwright-mcp, tied: US$ 0.073 per task and 12.8 turns (n=30)
1. surf-cli, tied: US$ 0.084 per task and 6.8 turns (n=30)
3. agent-browser: US$ 0.109 and 7.5 turns (n=10)
4. chrome-devtools-axi: US$ 0.114 and 12.0 turns (n=10)
5. browser-harness: US$ 0.145 and 17.5 turns (n=10)

playwright-mcp and surf-cli tie because they win on different metrics. Over 30 paired blocks, surf-cli took 6.0 fewer turns per task and cost US$ 0.011 more. Both differences are outside their 95% intervals, in opposite directions.

Accuracy decided little. 4 tools got every run right. surf-cli got 3 of 30 runs wrong, always the same way: it read the table from page text where the cells run together and cut the unit name short.

The data changed my first ranking. playwright-mcp moved from third to a tie for first, and chrome-devtools-axi moved above browser-harness.

Three numbers only showed up when measuring:
1. A one-turn prompt with no browser task costs US$ 0.012 in this setup, 8% to 16% of a run (n=3).
2. In a scripted battery with the same wait rule for every tool, browser-harness read the dashboard before its data rendered in 5 of 5 runs.
3. Reading the dashboard, surf-cli captured 97.5% of the visible text with 7,581 characters, and playwright-mcp 96.1% with 29,064 (n=3 each).

Limits: one app, one task, one model, one machine, one day. Agent cost also depends on the prompt cache left by the previous run, which the random order spreads across tools but does not remove.

surf-cli needs its browser extension installed by hand, and its semantic.* commands send page text to third parties. I used none of them.

I ran the benchmark with Claude Code. Harness, raw data and the ranking rule are in the repo.

#AI #AIAgents #Benchmark #Playwright #ClaudeCode
