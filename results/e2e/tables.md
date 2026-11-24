## Ranking A

| pos. | ferramenta | n | mediana s [IC 95%] | p95 s | sucesso | falhas | flaky | falso neg. | falso pos. | inconclusivos | tokens ok / falha | US$ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | flashwright | 6 | 7.3 [7.2, 7.7] | 7.8 | 144/144 | 0 | 0 | 0 | 0/5 | 0 | 78 / 462 | 0.0011 |
| 2 | bun | 6 | 10.6 [10.5, 10.9] | 11.0 | 144/144 | 0 | 0 | 0 | 0/5 | 0 | 40 / 236 | 0.0006 |
| 3 | playwright | 6 | 11.5 [11.3, 12.3] | 12.4 | 144/144 | 0 | 0 | 0 | 0/5 | 0 | 78 / 428 | 0.0010 |
| 4 | selenium | 6 | 13.9 [13.9, 14.7] | 15.0 | 144/144 | 0 | 0 | 0 | 0/5 | 0 | 13 / 129 | 0.0003 |
| 5 | puppeteer | 6 | 13.9 [13.8, 14.0] | 14.1 | 144/144 | 0 | 0 | 0 | 0/5 | 0 | 110 / 460 | 0.0011 |
| 6 | nightwatch | 6 | 18.6 [18.6, 18.7] | 18.7 | 144/144 | 0 | 0 | 0 | 0/5 | 0 | 645 / 838 | 0.0030 |
| 7 | webdriverio | 6 | 27.5 [27.3, 27.9] | 28.0 | 144/144 | 0 | 0 | 0 | 0/5 | 0 | 741 / 260 | 0.0020 |
| 8 | cypress | 6 | 38.4 [38.1, 38.9] | 39.0 | 144/144 | 0 | 0 | 0 | 0/5 | 0 | 1625 / 503 | 0.0043 |

## Ranking B

| pos. | ferramenta | n | US$ por sessão [IC 95%] | mediana s da rodada [IC 95% da média] | p95 s | sucesso | falhas | flaky | falso neg. | falso pos. | inconclusivos | chamadas/cenário | tokens docs / comandos / saídas |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | bx | 3 | 0.0425 [0.0378, 0.0473] | 48.5 [43.8, 53.1] | 48.5 | 72/72 | 0 | 0 | 0 | 0/5 | 0 | 1.0 | 406 / 3820 / 1743 |
| 2 | browser-use | 3 | 0.0449 [0.0408, 0.0490] | 64.4 [55.7, 69.1] | 65.9 | 72/72 | 0 | 0 | 0 | 0/5 | 0 | 1.0 | 2822 / 3632 / 372 |
| 3 | agent-browser | 3 | 0.0629 [0.0576, 0.0683] | 8.0 [6.7, 10.4] | 8.9 | 72/72 | 0 | 0 | 0 | 0/5 | 0 | 1.0 | 4094 / 5202 / 1347 |
| 4 | surf | 3 | 0.0661 [0.0597, 0.0724] | 101.1 [92.3, 110.4] | 101.5 | 72/72 | 0 | 0 | 0 | 0/5 | 0 | 6.8 | 2240 / 4078 / 10293 |
| 5 | flashwright-mcp:code | 3 | 0.0727 [0.0674, 0.0780] | 19.1 [18.9, 19.3] | 19.2 | 72/72 | 0 | 0 | 0 | 0/5 | 0 | 1.0 | 3887 / 5182 / 6545 |
| 6 | playwright-mcp:code | 3 | 0.0728 [0.0675, 0.0781] | 20.6 [20.5, 21.3] | 21.6 | 72/72 | 0 | 0 | 0 | 0/5 | 0 | 1.0 | 3935 / 5182 / 6545 |
| 7 | flashwright-mcp:adaptive | 3 | 0.1286 [0.1172, 0.1400] | 16.9 [15.7, 18.1] | 16.9 | 72/72 | 0 | 0 | 0 | 0/5 | 0 | 7.8 | 3887 / 3128 / 44753 |
| 8 | flashwright-mcp:steps | 3 | 0.1286 [0.1172, 0.1400] | 46.5 [42.2, 50.8] | 46.9 | 72/72 | 0 | 0 | 0 | 0/5 | 0 | 7.8 | 3887 / 3128 / 44754 |
| 9 | playwright-mcp:steps | 3 | 0.1287 [0.1173, 0.1401] | 47.8 [43.2, 52.1] | 47.9 | 72/72 | 0 | 0 | 0 | 0/5 | 0 | 7.8 | 3935 / 3128 / 44754 |
| 10 | chrome-devtools-axi | 3 | 0.1700 [0.1509, 0.1894] | 153.3 [138.4, 168.3] | 153.5 | 72/72 | 0 | 0 | 0 | 0/5 | 0 | 8.1 | 1458 / 4722 / 59929 |

## B: versões, tempo por cenário e auditoria

| ferramenta | versão | mediana s por cenário | p95 s por cenário | auditoria divergente | auditoria sem página |
|---|---|---|---|---|---|
| bx | bx 0.2.0 | 2.06 | 3.28 | 0 | 0 |
| browser-use | browser-use 1.0.3 (browser-harness 0.1.13) | 2.34 | 4.84 | 0 | 0 |
| agent-browser | agent-browser 0.41.2 | 0.27 | 0.81 | 0 | 0 |
| surf | surf version 2.26.0 | 4.19 | 6.42 | 0 | 0 |
| flashwright-mcp:code | Playwright 1.64.1-flashwright.11 | 0.76 | 0.84 | 0 | 0 |
| playwright-mcp:code | Playwright 1.66.0-alpha-2026-11-09 | 0.82 | 0.98 | 0 | 0 |
| flashwright-mcp:adaptive | Playwright 1.64.1-flashwright.11 | 0.68 | 1.00 | 0 | 0 |
| flashwright-mcp:steps | Playwright 1.64.1-flashwright.11 | 1.88 | 3.03 | 0 | 0 |
| playwright-mcp:steps | Playwright 1.66.0-alpha-2026-11-09 | 1.92 | 3.05 | 0 | 0 |
| chrome-devtools-axi | 0.1.46 (chrome-devtools-mcp 1.12.0) | 6.67 | 10.20 | 0 | 0 |

## B: falhas no build correto

Nenhuma.

## Exclusões

| ranking | ferramenta | erro |
|---|---|---|
| A | testcafe | ERROR Cannot establish one or more browser connections. 1 of 1 browser connections have not been established: - chromium:chrome.exe:headless (duas tentativas de correção: --hostname localhost com --disable-native-automation; stdio próprio para o comando start) |
