## Baseline (one-turn prompt, no browser task, same flags)
runs 3, mean cost US$ 0.000, mean turns 1.0, mean cache write 794 tokens, mean cache read 5924 tokens

## Agent runs per tool: mean [bootstrap 95% interval over blocks]
| tool | runs | turns | cost above baseline, US$ | cost, US$ | time, s |
|---|---|---|---|---|---|
| agent-browser | 10 | 9.5 [8.6, 10.7] | 0.008 [0.008, 0.009] | 0.008 [0.008, 0.009] | 47.9 [27.8, 70.8] |
| chrome-devtools-axi | 10 | 13.9 [13.1, 14.9] | 0.011 [0.010, 0.012] | 0.011 [0.010, 0.012] | 57.0 [51.0, 64.1] |
| surf-cli | 10 | 8.9 [8.3, 9.6] | 0.006 [0.006, 0.007] | 0.007 [0.006, 0.007] | 40.0 [31.0, 53.5] |
| browser-harness | 10 | 23.8 [22.0, 26.0] | 0.013 [0.012, 0.016] | 0.014 [0.012, 0.016] | 133.7 [67.3, 235.1] |
| playwright-mcp | 10 | 15.5 [14.4, 16.8] | 0.007 [0.006, 0.007] | 0.007 [0.006, 0.008] | 26.2 [24.8, 27.8] |
| bx | 10 | 7.7 [6.7, 8.7] | 0.003 [0.003, 0.004] | 0.004 [0.003, 0.004] | 29.8 [21.8, 42.6] |

## Failures (definition: methodology.md, 'Failure definition')
| tool | agent runs failed / runs | of which no valid reply | battery checks failed / checks |
|---|---|---|---|
| agent-browser | 0 / 10 | 0 | 0 / 0 |
| chrome-devtools-axi | 0 / 10 | 0 | 0 / 0 |
| surf-cli | 0 / 10 | 0 | 0 / 0 |
| browser-harness | 0 / 10 | 0 | 0 / 0 |
| playwright-mcp | 0 / 10 | 0 | 0 / 0 |
| bx | 0 / 10 | 0 | 0 / 0 |

## Paired per-block differences, adjacent tools (next minus this; mean [bootstrap 95% interval])
| pair | blocks | turns | cost above baseline, US$ | time, s (secondary) | result |
|---|---|---|---|---|---|
| surf-cli minus bx | 10 | 1.2 [0.3, 2.1] | 0.003 [0.002, 0.004] | 10.2 [6.3, 14.9] | separated (primary metric) |
| playwright-mcp minus surf-cli | 10 | 6.6 [5.5, 7.9] | 0.000 [-0.000, 0.001] | -13.7 [-26.8, -5.1] | separated (primary metric) |
| agent-browser minus playwright-mcp | 10 | -6.0 [-7.8, -4.4] | 0.001 [0.001, 0.002] | 21.6 [2.6, 44.6] | tie |
| chrome-devtools-axi minus agent-browser | 10 | 4.4 [2.9, 5.7] | 0.003 [0.002, 0.004] | 9.1 [-7.3, 23.3] | separated (primary metric) |
| browser-harness minus chrome-devtools-axi | 10 | 9.9 [8.3, 12.1] | 0.002 [0.000, 0.005] | 76.7 [10.1, 181.9] | separated (primary metric) |

## Ranking (ranking-rule.md)
| rank | tool | failure tier |
|---|---|---|
| 1 | bx | 0 |
| 2 | surf-cli | 0 |
| 3 | playwright-mcp | 0 |
| 3 | agent-browser | 0 |
| 5 | chrome-devtools-axi | 0 |
| 6 | browser-harness | 0 |

Rank 1 is held alone by bx.

## Agent run detail (means over valid runs)
| tool | input+cache tokens | output tokens | cache write tokens | baseline share of cost | cost range per run, US$ | docs read, characters |
|---|---|---|---|---|---|---|
| bx | 84,063 | 2,442 | 8,432 | 6% | 0.002 to 0.006 | 1,444 |
| surf-cli | 152,667 | 2,823 | 18,997 | 3% | 0.006 to 0.007 | 8,317 |
| playwright-mcp | 241,665 | 2,325 | 17,627 | 3% | 0.006 to 0.010 | 0 |
| agent-browser | 194,269 | 2,971 | 25,628 | 3% | 0.007 to 0.010 | 14,709 |
| chrome-devtools-axi | 293,977 | 5,784 | 28,933 | 2% | 0.008 to 0.014 | 8,245 |
| browser-harness | 507,038 | 7,904 | 24,673 | 2% | 0.011 to 0.021 | 10,458 |

## Spend
agent runs US$ 0.505, baseline US$ 0.001, setup checks US$ 0.025, pilot US$ 0.048, total US$ 0.578
models used: claude-haiku-5-5; claude: 2.1.317 (Claude Code); days: 2026-11-10; blocks: 10
