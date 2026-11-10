#!/usr/bin/env bash
# Real agent per tool via `claude -p`, same task, run in blocks: each block is one random permutation of the tools.
#   bash agents.sh <first-block> <last-block> [tools...]   agent runs
#   bash agents.sh baseline <runs>                          one-turn prompt, no browser task, same flags
#   bash agents.sh pilot [tools...]                         one block (block 0) to $RESULTS/pilot.jsonl, not ranked
# Env: RESULTS (default ../results/v2), CAP_USD (default 25), MODEL (default claude-sonnet-5-5),
#      RAW (default agents-v2): directory of the raw transcripts and, when it is not the default, of the screenshots too,
#      so a later data set does not overwrite the transcripts and screenshots of v2.
# Writes raw transcripts to $RAW/ (git-ignored: they hold client data) and one row per run to $RESULTS/agents.jsonl.
set -u
cd "$(dirname "$0")"
. ./lib.sh
. ./creds.sh
QUERY="${BENCH_QUERY:?set BENCH_QUERY}"
RESULTS="${RESULTS:-../results/v2}"
CAP_USD="${CAP_USD:-25}"
MODEL="${MODEL:-claude-sonnet-5-5}"
RAW="${RAW:-agents-v2}"
PNG_PREFIX=""; [ "$RAW" = agents-v2 ] || PNG_PREFIX="$RAW/"
RUN_TIMEOUT_S=900
mkdir -p "$RAW" "$RESULTS"
EMPTY='{"mcpServers":{}}'
PWCFG='{"mcpServers":{"playwright":{"command":"playwright-mcp","args":["--cdp-endpoint","'$CDP_URL'"]}}}'
DOCS_W=$(cygpath -w "$PWD/agent-docs")
CLAUDE_VERSION=$(claude --version | head -1)
doc_chars() { node -e 'const fs=require("fs");console.log(process.argv.slice(1).reduce((s,f)=>s+fs.readFileSync(f,"utf8").length,0))' "$@"; }

task_prompt() {  # $1 = how to use the tool, $2 = screenshot file name
  cat <<EOF
## TASK
In the SB360-IPTU web app at $APP (the browser is already logged in), using ONLY $1:
1. Open the Inscrições screen, type "$QUERY" in the search box, click Pesquisar, and list every inscrição found with its Unidade, exactly as they appear in the table.
2. Set the viewport to 390x844, open $APP/guias, save a screenshot to $(cygpath -w "$PWD/$2"), and restore the viewport to 1366x768.

## RULES
- Use only that tool to touch the browser. Do not use curl, node, python, psql, other browser tools, and do not read code files.
- Read-only: do not click buttons that change data (Consultar, Atualizar base, Exportar, etc.). Do not clear cookies or close the browser.
- If something fails, diagnose it with the tool itself and try again.

## OUTPUT
Answer with JSON only:
{"registrations":[{"registration":"...","unit":"..."}],"screenshot":"<path>","problems":"<what went wrong and how you worked around it, or empty>"}
EOF
}

# sets USAGE, MCP, ALLOWED, DOCS for one tool; $1 tool, $2 block
tool_setup() {
  case "$1" in
    ab)   USAGE='the `agent-browser` CLI. Always run `cd "'"$PWD"'"` and use `agent-browser --cdp '"$CDP_PORT"' ...`. Before the first use, read the skill file `'"$DOCS_W"'\ab-core.md`. Do not run `agent-browser close`.'
          MCP="$EMPTY"; ALLOWED=(Bash Read); BUILTIN=Bash,Read; DOCS=$(doc_chars agent-docs/ab-core.md) ;;
    axi)  USAGE='the `chrome-devtools-axi` CLI. In every command, first export `export CHROME_DEVTOOLS_AXI_BROWSER_URL='"$CDP_URL"' CHROME_DEVTOOLS_AXI_SESSION=agent CHROME_DEVTOOLS_AXI_MCP_PATH='"'$CHROME_DEVTOOLS_AXI_MCP_PATH'"'`. Before the first use, read `'"$DOCS_W"'\axi\SKILL.md` and `'"$DOCS_W"'\axi\help.txt` (the output of `chrome-devtools-axi --help`). Do not run `chrome-devtools-axi stop`.'
          MCP="$EMPTY"; ALLOWED=(Bash Read); BUILTIN=Bash,Read; DOCS=$(doc_chars agent-docs/axi/SKILL.md agent-docs/axi/help.txt) ;;
    surf) USAGE="the \`surf\` CLI. In every command, \`export SURF_SESSION=agent-$2\`; create the session once with \`surf session.ensure agent-$2 about:blank\`. Before the first use, read \`$DOCS_W\\surf\\SKILL.md\`. Do not use \`semantic.*\`, \`oracle\`, or the AI-site commands."
          MCP="$EMPTY"; ALLOWED=(Bash Read); BUILTIN=Bash,Read; DOCS=$(doc_chars agent-docs/surf/SKILL.md) ;;
    bh)   USAGE='the `browser-harness` CLI. In every command, first export `export BU_NAME=agent BU_CDP_URL='"$CDP_URL"'` (test Chrome, already logged in; you may use it without asking). Before the first use, read the skill file `'"$DOCS_W"'\bh-skill.md`.'
          MCP="$EMPTY"; ALLOWED=(Bash Read); BUILTIN=Bash,Read; DOCS=$(doc_chars agent-docs/bh-skill.md) ;;
    pw)   USAGE='the tools of the `playwright` MCP server (browser_*).'
          MCP="$PWCFG"; ALLOWED=(Read "mcp__playwright"); BUILTIN=Read; DOCS=0 ;;
    bx)   USAGE='the `bx` CLI. Run it as `node "'"$BX_MJS"'" ...`; in every command, first export `export BX_CDP_URL='"$CDP_URL"' BX_SESSION=agent`. Before the first use, read `'"$DOCS_W"'\bx.md`.'
          MCP="$EMPTY"; ALLOWED=(Bash Read); BUILTIN=Bash,Read; DOCS=$(doc_chars agent-docs/bx.md) ;;
    *) echo "unknown tool $1" >&2; exit 2 ;;
  esac
}

spent_usd() { cat "$RESULTS"/agents.jsonl "$RESULTS"/baseline.jsonl "$RESULTS"/setup.jsonl "$RESULTS"/pilot.jsonl 2>/dev/null | node -e 'let s=0;for(const l of require("fs").readFileSync(0,"utf8").split("\n"))if(l.trim())s+=JSON.parse(l).cost_usd||0;console.log(s.toFixed(4))'; }
mean_agent_cost() { node -e 'const fs=require("fs");const f=process.argv[1];const r=fs.existsSync(f)?fs.readFileSync(f,"utf8").trim().split("\n").filter(Boolean).map(JSON.parse):[];console.log(r.length?(r.reduce((s,x)=>s+x.cost_usd,0)/r.length).toFixed(4):"0.216")' "$RESULTS/agents.jsonl"; }

# one claude run; $1 kind (agent|baseline) $2 tool $3 block $4 pos $5 prompt $6 png $7 out file
run_one() {
  local kind=$1 tool=$2 block=$3 pos=$4 prompt=$5 png=$6 out=$7 raw="$RAW/$1-$3-$2.jsonl" ts t0 t1 rc
  node cdp.mjs reset >/dev/null; stop_all_tools; rm -f "$png"
  ts=$(iso_now); t0=$(date +%s%N)
  # --setting-sources "": no user/project/local settings, so no user hooks, plugins or permissions.
  # --safe-mode is not used: it also drops the --mcp-config server, which playwright-mcp needs.
  timeout $RUN_TIMEOUT_S claude -p "$prompt" --model "$MODEL" --setting-sources "" --disable-slash-commands \
    --output-format stream-json --verbose --strict-mcp-config --mcp-config "$MCP" \
    --tools "$BUILTIN" --allowedTools "${ALLOWED[@]}" \
    --no-session-persistence --max-budget-usd 1 > "$raw" 2> "${raw%.jsonl}.err"
  rc=$?; t1=$(date +%s%N)
  local meta
  meta=$(printf '{"kind":"%s","tool":"%s","block":%d,"pos":%d,"ts":"%s","ms":%d,"exit_code":%d,"png":"%s","model_requested":"%s","claude_version":"%s","tool_version":"%s","docs_chars":%d}' \
    "$kind" "$tool" "$block" "$pos" "$ts" $(((t1 - t0) / 1000000)) "$rc" "$png" "$MODEL" "$CLAUDE_VERSION" "$(tool_version "$tool")" "$DOCS")
  node score-agent.mjs "$raw" "$meta" | tee -a "$out"
}

if [ "$1" = baseline ]; then
  MCP="$EMPTY"; ALLOWED=(Bash Read); BUILTIN=Bash,Read; DOCS=0
  for n in $(seq 1 "$2"); do
    run_one baseline none 0 "$n" "Reply with the single word OK. Do not use any tool." "${PNG_PREFIX}baseline-$n.png" "$RESULTS/baseline.jsonl"
  done
  exit 0
fi

KIND=agent; OUT_FILE="$RESULTS/agents.jsonl"
if [ "$1" = pilot ]; then KIND=pilot; OUT_FILE="$RESULTS/pilot.jsonl"; FIRST=0; LAST=0; shift; else FIRST=$1; LAST=$2; shift 2; fi
TOOLS="${*:-$ALL_TOOLS}"
for block in $(seq "$FIRST" "$LAST"); do
  order=$(printf '%s\n' $TOOLS | shuf | tr '\n' ' ')
  n_tools=$(echo $order | wc -w)
  spent=$(spent_usd); est=$(node -e "console.log(($(mean_agent_cost) * $n_tools).toFixed(4))")
  if node -e "process.exit($spent + $est > $CAP_USD ? 0 : 1)"; then
    echo "stop: spent US\$ $spent + next block ~US\$ $est would pass the US\$ $CAP_USD cap" >&2; exit 3
  fi
  echo "block $block order: $order (spent US\$ $spent)" >&2
  pos=0
  for tool in $order; do
    pos=$((pos + 1)); tool_setup "$tool" "$block"
    png="${PNG_PREFIX}agent-$tool-$block.png"
    run_one "$KIND" "$tool" "$block" "$pos" "$(task_prompt "$USAGE" "$png")" "$png" "$OUT_FILE"
  done
done
