## Ranking B

| pos. | ferramenta | n | US$ por sessão [IC 95%] | mediana s da rodada [IC 95% da média] | p95 s | sucesso | falhas | flaky | falso neg. | falso pos. | inconclusivos | chamadas/cenário | tokens docs / comandos / saídas |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | bx:quiet | 6 | 0.0394 [0.0362, 0.0427] | 7.0 [6.8, 7.2] | 7.1 | 144/144 | 0 | 0 | 0 | 0/5 | 0 | 1.0 | 425 / 3788 / 328 |
| 2 | bx | 6 | 0.0425 [0.0393, 0.0459] | 7.0 [6.8, 7.2] | 7.1 | 144/144 | 0 | 0 | 0 | 0/5 | 0 | 1.0 | 425 / 3820 / 1743 |
| 3 | agent-browser | 6 | 0.0628 [0.0590, 0.0667] | 7.2 [6.6, 8.1] | 7.4 | 142/144 | assertion 2 | 1 | 2 | 0/5 | 0 | 1.0 | 4094 / 5190 / 1347 |

## B: versões, tempo por cenário e auditoria

| ferramenta | versão | mediana s por cenário | p95 s por cenário | auditoria divergente | auditoria sem página |
|---|---|---|---|---|---|
| bx:quiet | bx 0.3.0 | 0.29 | 0.36 | 0 | 0 |
| bx | bx 0.3.0 | 0.29 | 0.35 | 0 | 0 |
| agent-browser | agent-browser 0.41.2 | 0.27 | 0.37 | 0 | 0 |

## B: falhas no build correto

| ferramenta | rodada | cenário | tipo | detalhe |
|---|---|---|---|---|
| agent-browser | 5 | filtering-todos/should-filter-active-todos | assertion | visible: expected false, got true |
| agent-browser | 6 | filtering-todos/should-filter-active-todos | assertion | visible: expected false, got true |

