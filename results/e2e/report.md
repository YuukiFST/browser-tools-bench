# Benchmark determinístico de testes E2E

Medido em 2026-11-24, sem nenhuma chamada a LLM.
Regra de ranking: `harness/e2e/RANKING-RULE.md`, commitada em `c6a618d`, antes das rodadas ranqueadas.
Para refazer: `node harness/e2e/run-all.mjs`.

> Este relatório descreve a primeira execução, com bx 0.2.0.
> O bx 0.3.0 foi medido depois, ao lado do agent-browser, em `bx-0.3.0/tables.md`; a tabela B atual está no `README.md` e as posições combinadas em `bx-0.3.0/combined.md`.

## Recomendação

**A (suíte commitada, CI): Flashwright.**
É 1,45 vez mais rápido que o segundo (Bun) e 1,57 vez mais rápido que o Playwright, com 144/144 testes certos e 5/5 defeitos detectados.
Todas as diferenças entre posições vizinhas de A saem do intervalo de confiança, exceto Selenium e Puppeteer, que empatam em velocidade e são separados pelo custo.
Os cenários foram escolhidos pelos autores do Flashwright, o que pode favorecê-lo.

**B (condução): bx pela regra, com vantagem pequena sobre browser-use.**
bx custa US$ 0,0425 por sessão de 24 cenários; browser-use, US$ 0,0449.
A diferença sai do intervalo, mas vem do tamanho da documentação (406 contra 2.822 tokens): sem contar docs, browser-use custa US$ 0,0398 e bx US$ 0,0417, e a ordem se inverte.
Os dados não sustentam uma vantagem de custo robusta entre os dois.
Se o tempo importa, use **agent-browser**: 8,0 s por rodada contra 48,5 s do bx, por 48% a mais de custo, com a ressalva da falha abaixo.
Entre as duas linhas `code`, 0,0727 e 0,0728 diferem só por 48 tokens de schema: na prática, empate.
Com um passo por chamada, `--adaptive-settle` do flashwright-mcp cortou a mediana de 46,5 s para 16,9 s com o mesmo custo.

**bx é do autor deste benchmark (YuukiFST).**
Os scripts de B foram escritos neste repositório; a idiomática e a documentação contada de cada ferramenta são escolhas declaradas em `RANKING-RULE.md`.

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

## O que aconteceu na execução

- Rodadas completas: A 6 por ferramenta, B 3 por ferramenta.
- A rodada 4 de B foi descartada porque ficou sem surf: o runner caiu com `EBUSY: resource busy or locked, open '...DevToolsActivePort'`, um erro do runner (corrigido depois), não de ferramenta.
- **A rodada 4 descartada tinha uma falha de agent-browser** em `should-filter-active-todos` (`visible: expected false, got true`): ele lê a página antes de ela reagir ao clique do filtro.
  Contando essa rodada, agent-browser tem 95/96 (99,0%), um cenário instável e um falso negativo; a posição não muda pela regra.
- A análise foi rodada à parte sobre os dados, por causa da queda.
- `surf go` travou por 60 s uma vez em cada um dos três smokes e uma vez na verificação do comando único, mas nenhuma vez nas rodadas ranqueadas: o 72/72 do surf está acima do que ele fez fora delas (92/96).
- Depois da correção, `run-all.mjs` rodou inteiro, do setup à análise, com 1 rodada de A e de B e saída 0; esses dados não entram no ranking.
- browser-use ganhou `wait_for_element` depois do filtro, `activate_tab` antes de hover, para passar nos smokes; agent-browser não recebeu espera equivalente.
- Docker com o Supabase local ficou ligado durante as medições.
- Antes das medições desta execução, duas tentativas foram descartadas: o instalador do bun falhava ao rodar pela segunda vez, e o Claude Code interrompeu a outra por falta de memória.

## Defeitos injetados

Cinco builds com um defeito cada (`harness/e2e/defects.mjs`), validados por `oracle.mjs`, que usa CDP e não usa nenhuma ferramenta medida; `oracle.json` traz os cenários que cada um deve reprovar.
Todas as 18 linhas detectaram 5/5, sem falso positivo.

## Limites

- Um app pequeno (TodoMVC), uma máquina, Windows 10 e Chrome headless.
- Os 24 cenários foram escolhidos pelos autores do flashwright, que também é um dos medidos.
- O custo é estimado: tokenizer `o200k_base`, preço do Claude Sonnet 5.5, sem raciocínio, novas tentativas nem releitura do contexto.
- Com 3 rodadas em B, o intervalo reflete sobretudo a diferença entre cenários, e não a variação entre dias.
- O success rate é de scripts fixos: não diz se um agente acertaria sozinho.
- Cinco defeitos por ferramenta é pouco para estimar a taxa de falso positivo.

## Não medidos

- **browse (anomalyco/browse):** não foi pareado (precisa de uma pessoa); `OPENCODE_BROWSER_TOOLS=plain` não foi implementado. Para incluir: `node harness/e2e/pair-browse.mjs` e depois `run-drivers.mjs`. O adaptador `execute` existe e nunca rodou.
- **TestCafe:** excluído, ver Exclusões.
- **Comando `run` de chrome-devtools-axi:** não funciona no Windows (`Only URLs with a scheme in: file, data, and node are supported`), então axi usa um comando por ação.
