## Baseline (one-turn prompt, no browser task, same flags)
runs 3, mean cost US$ 0.012, mean turns 1.0, mean cache write 2830 tokens, mean cache read 2989 tokens

## Agent runs per tool: mean [bootstrap 95% interval over blocks]
| tool | runs | turns | cost above baseline, US$ | cost, US$ | time, s |
|---|---|---|---|---|---|
| agent-browser | 10 | 7.5 [7.0, 8.1] | 0.098 [0.081, 0.113] | 0.109 [0.093, 0.124] | 28.4 [27.0, 30.1] |
| chrome-devtools-axi | 10 | 12.0 [11.5, 12.6] | 0.103 [0.101, 0.105] | 0.114 [0.112, 0.117] | 52.2 [50.3, 54.1] |
| surf-cli | 30 | 6.8 [6.6, 7.0] | 0.072 [0.071, 0.074] | 0.084 [0.083, 0.085] | 27.1 [26.4, 27.8] |
| browser-harness | 10 | 17.5 [15.5, 19.7] | 0.134 [0.121, 0.148] | 0.145 [0.133, 0.159] | 64.8 [57.4, 73.8] |
| playwright-mcp | 30 | 12.8 [12.6, 13.0] | 0.061 [0.058, 0.064] | 0.073 [0.070, 0.075] | 30.5 [29.6, 31.3] |

## Failures (definition: methodology.md, 'Failure definition')
| tool | agent runs failed / runs | of which no valid reply | battery checks failed / checks |
|---|---|---|---|
| agent-browser | 0 / 10 | 0 | 0 / 35 |
| chrome-devtools-axi | 0 / 10 | 0 | 0 / 35 |
| surf-cli | 3 / 30 | 0 | 0 / 35 |
| browser-harness | 0 / 10 | 0 | 5 / 35 |
| playwright-mcp | 0 / 30 | 0 | 1 / 35 |
- failed agent run: surf-cli block 2, 0/7 correct, 7 extra, screenshot 390 px
- failed agent run: surf-cli block 18, 0/7 correct, 7 extra, screenshot 390 px
- failed agent run: surf-cli block 30, 0/7 correct, 7 extra, screenshot 390 px
- failed battery check: browser-harness read iteration 1, 0.6 s, snapshot=2122 interactive=2122 floor=18630
- failed battery check: browser-harness read iteration 2, 0.6 s, snapshot=2122 interactive=2122 floor=18630
- failed battery check: browser-harness read iteration 3, 1.0 s, snapshot=2122 interactive=2122 floor=18630
- failed battery check: playwright-mcp read iteration 3, 19.2 s, snapshot=3946 interactive=3946 floor=23989
- failed battery check: browser-harness read iteration 4, 0.9 s, snapshot=2119 interactive=2119 floor=18630
- failed battery check: browser-harness read iteration 5, 0.8 s, snapshot=2122 interactive=2122 floor=18630

Battery failures by task:
- browser-harness: read 5/5
- playwright-mcp: read 1/5
- Fisher one-sided, surf-cli 3/30 against agent-browser 0/10: p = 0.411
- Fisher one-sided, surf-cli 3/30 against chrome-devtools-axi 0/10: p = 0.411
- Fisher one-sided, surf-cli 3/30 against browser-harness 0/10: p = 0.411
- Fisher one-sided, surf-cli 3/30 against playwright-mcp 0/30: p = 0.119

## Paired per-block differences, adjacent tools (next minus this; mean [bootstrap 95% interval])
| pair | blocks | turns | cost above baseline, US$ | time, s (secondary) | result |
|---|---|---|---|---|---|
| surf-cli minus playwright-mcp | 30 | -6.0 [-6.3, -5.7] | 0.011 [0.009, 0.014] | -3.4 [-4.5, -2.2] | tie |
| agent-browser minus surf-cli | 10 | 0.6 [0.0, 1.2] | 0.025 [0.009, 0.040] | -0.4 [-1.9, 1.4] | separated (primary metric) |
| chrome-devtools-axi minus agent-browser | 10 | 4.5 [3.7, 5.4] | 0.005 [-0.010, 0.021] | 23.8 [21.4, 26.2] | separated (primary metric) |
| browser-harness minus chrome-devtools-axi | 10 | 5.5 [3.4, 7.8] | 0.031 [0.018, 0.044] | 12.6 [4.9, 21.5] | separated (primary metric) |

## Ranking (ranking-rule.md)
| rank | tool | failure tier |
|---|---|---|
| 1 | playwright-mcp | 0 |
| 1 | surf-cli | 0 |
| 3 | agent-browser | 0 |
| 4 | chrome-devtools-axi | 0 |
| 5 | browser-harness | 0 |

Rank 1 is tied: playwright-mcp, surf-cli.

## Agent run detail (means over valid runs)
| tool | input+cache tokens | output tokens | cache write tokens | baseline share of cost | cost range per run, US$ | docs read, characters |
|---|---|---|---|---|---|---|
| playwright-mcp | 156,081 | 1,479 | 10,847 | 16% | 0.055 to 0.086 | 0 |
| surf-cli | 96,349 | 1,452 | 15,358 | 14% | 0.078 to 0.091 | 8,201 |
| agent-browser | 138,964 | 1,636 | 20,251 | 11% | 0.074 to 0.138 | 14,457 |
| chrome-devtools-axi | 161,143 | 3,690 | 15,709 | 10% | 0.110 to 0.119 | 8,158 |
| browser-harness | 286,369 | 4,509 | 18,307 | 8% | 0.115 to 0.183 | 10,458 |

## Scripted battery (sum of the 7 task medians; not ranked)
| tool | time, s | calls | characters returned | checks passed |
|---|---|---|---|---|
| agent-browser | 27.1 | 75 | 69,426 | 35/35 |
| chrome-devtools-axi | 62.9 | 54 | 242,776 | 35/35 |
| surf-cli | 46.4 | 77 | 33,958 | 35/35 |
| browser-harness | 40.7 | 26 | 13,847 | 30/35 |
| playwright-mcp | 45.6 | 56 | 82,580 | 34/35 |
read size range, characters: agent-browser 33,501 to 33,501; chrome-devtools-axi 16,607 to 16,607; surf-cli 7,589 to 7,589; browser-harness 2,119 to 2,122; playwright-mcp 3,946 to 47,152

## Latency (ms, median; not ranked)
| tool | cold start | warm trivial call | trivial calls failed |
|---|---|---|---|
| agent-browser | 1603 | 239 | 0 / 25 |
| chrome-devtools-axi | 3542 | 528 | 0 / 25 |
| surf-cli | 534 (new session) | 267.5 | 0 / 25 |
| browser-harness | 1673 | 363.5 | 0 / 25 |
| playwright-mcp | 1256 | 671 | 0 / 25 |

## Read coverage (median over repetitions: % of <main> cells found, characters; not ranked)
| read | /dashboard | /debitos | /inscricoes |
|---|---|---|---|
| ab | 95.3% (27,529, n=3, range 95.3 to 95.3%) | 100% (4,746, n=3, range 100 to 100%) | 100% (3,735, n=3, range 100 to 100%) |
| ab-i | 82% (19,631, n=3, range 82 to 82%) | 80% (2,507, n=3, range 80 to 80%) | 85.7% (1,868, n=3, range 85.7 to 85.7%) |
| axi | 53.5% (14,589, n=3, range 53.5 to 54.8%) | 100% (6,108, n=3, range 100 to 100%) | 100% (4,818, n=3, range 100 to 100%) |
| axi-full | 84.2% (23,291, n=3, range 84.2 to 84.2%) | 100% (6,108, n=3, range 100 to 100%) | 100% (4,818, n=3, range 100 to 100%) |
| surf | 97.5% (7,581, n=3, range 97.5 to 97.5%) | 100% (2,811, n=3, range 100 to 100%) | 100% (2,444, n=3, range 100 to 100%) |
| surf-text | 97.5% (6,033, n=3, range 97.5 to 97.5%) | 100% (641, n=3, range 100 to 100%) | 100% (669, n=3, range 100 to 100%) |
| bh (custom snippet) | 43.5% (35,688, n=3, range 43.5 to 43.5%) | 100% (4,009, n=3, range 100 to 100%) | 100% (3,193, n=3, range 100 to 100%) |
| bh innerText | 97.5% (5,926, n=3, range 97.5 to 97.5%) | 100% (536, n=3, range 100 to 100%) | 100% (561, n=3, range 100 to 100%) |
| pw | 96.1% (29,064, n=3, range 96.1 to 96.1%) | 100% (5,035, n=3, range 100 to 100%) | 100% (4,486, n=3, range 100 to 100%) |

## Spend
agent runs US$ 8.392, baseline US$ 0.035, setup checks US$ 0.049, pilot US$ 0.556, total US$ 9.032
models used: claude-sonnet-5-5; claude: 2.1.317 (Claude Code); days: 2026-11-10; blocks: 30
