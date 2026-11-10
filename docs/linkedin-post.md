# LinkedIn post draft

Not published.
It waits for the methodology review in `docs/review-prompt.md`.
The post will go out in Portuguese; this is the English translation of the current draft.
Every number in it must match `results/benchmark.html` or `docs/methodology.md`.

---

I tested 5 tools that let an AI agent control the browser: surf-cli, agent-browser, playwright-mcp, browser-harness and chrome-devtools-axi. The target was the property tax (IPTU) web app I work on.

All of them ran against the same isolated Chrome for Testing 157 and the same production build, so the measured difference comes from the tool.

I took two measurements.

In the first, a script ran 7 tasks 5 times with each tool: login, search, read, screenshot, console, mobile viewport and a sweep of 16 routes. On each run it recorded time, number of calls and characters returned. The ground truth came from the database: a company's 7 property registrations, each with its unit, and the title of each route.

In the second, a Claude Sonnet agent got the same task twice with each tool. The CLI itself reported the cost in dollars, the time, the turns and the tokens.

On the second day I reran one tool as a control. The environment was 45% slower (33.7 s against 49.0 s). I took that into account when reading the playwright-mcp numbers, which I measured that day.

With the agent, all 5 tools got 14 of 14 right. The difference was in what it cost to get the same answer. surf-cli finished the task for US$ 0.171, in 42 s and 6.5 turns, processing 275k tokens. browser-harness spent US$ 0.267, 113 s, 20.5 turns and 853k tokens.

The final order:
1. surf-cli
2. agent-browser (US$ 0.196, 50 s)
3. playwright-mcp (US$ 0.217, 56 s)
4. browser-harness
5. chrome-devtools-axi (US$ 0.232, 83 s)

chrome-devtools-axi is cheaper than browser-harness but came last. It passed 33 of 35 battery checks, had 1 MCP timeout and 2 silent failures, where fillform and snapshot went wrong without an error. browser-harness had 1 silent failure: it typed into a background tab.

Two numbers only showed up when measuring:
1. playwright-mcp puts about 5.3k tokens of schema into the context before the first action.
2. Reading the dashboard, surf-cli captured 97.5% of the text with 1,890 tokens, and playwright-mcp captured 98.3% with 7,312. browser-harness reached 43.5% and chrome-devtools-axi 53.5%.

surf-cli has two caveats. The extension has to be installed by hand, and the semantic.* commands send page text to third parties. I used none of them.

I ran the benchmark with Claude Code.

#AI #AIAgents #Benchmark #Playwright #ClaudeCode
