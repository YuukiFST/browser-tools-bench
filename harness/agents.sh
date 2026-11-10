#!/usr/bin/env bash
# Real agent per tool via `claude -p` (Sonnet), same task, sequential in the same Chrome.
#   bash agents.sh <repetitions> [tools...]
# Output: agents/<tool>-<n>.json (answer + cost + tokens) and agents.jsonl (summary).
set -u
cd "$(dirname "$0")"
mkdir -p agents
QUERY="${BENCH_QUERY:?set BENCH_QUERY}"
REP="$1"; shift
TOOLS="${*:-ab axi surf bh pw}"
EMPTY='{"mcpServers":{}}'
PWCFG='{"mcpServers":{"playwright":{"command":"playwright-mcp","args":["--cdp-endpoint","http://127.0.0.1:9333"]}}}'
SKILLS_W=$(cygpath -w "$HOME/.claude/skills")

task_prompt() {  # $1 = how to use the tool, $2 = screenshot file name
  cat <<EOF
## TASK
In the SB360-IPTU web app at http://localhost:3100 (the browser is already logged in), using ONLY $1:
1. Open the Inscrições screen, type "$QUERY" in the search box, click Pesquisar, and list every inscrição found with its Unidade, exactly as they appear in the table.
2. Set the viewport to 390x844, open http://localhost:3100/guias, save a screenshot to $(cygpath -w "$PWD/$2"), and restore the viewport to 1366x768.

## RULES
- Use only that tool to touch the browser. Do not use curl, node, python, psql, other browser tools, and do not read code files.
- Read-only: do not click buttons that change data (Consultar, Atualizar base, Exportar, etc.). Do not clear cookies or close the browser.
- If something fails, diagnose it with the tool itself and try again.

## OUTPUT
Answer with JSON only:
{"registrations":[{"registration":"...","unit":"..."}],"screenshot":"<path>","problems":"<what went wrong and how you worked around it, or empty>"}
EOF
}

for n in $(seq ${START:-1} "$REP"); do
  for f in $TOOLS; do
    node cdp.mjs reset >/dev/null
    png="agent-$f-$n.png"; rm -f "$png"
    case "$f" in
      ab)   usage='the `agent-browser` CLI. Always run `cd "'"$PWD"'"` and use `agent-browser --cdp 9333 ...`. Before the first use, read the skill: `agent-browser skills get core`. Do not run `agent-browser close`.'
            mcp="$EMPTY"; tools=(Bash Read) ;;
      axi)  usage='the `chrome-devtools-axi` CLI. In every command, first export `export CHROME_DEVTOOLS_AXI_BROWSER_URL=http://127.0.0.1:9333 CHROME_DEVTOOLS_AXI_SESSION=agent`. Before the first use, read `'"$SKILLS_W"'\chrome-devtools-axi\SKILL.md` and `chrome-devtools-axi --help`. Do not run `chrome-devtools-axi stop`.'
            mcp="$EMPTY"; tools=(Bash Read) ;;
      surf) usage="the \`surf\` CLI. In every command, \`export SURF_SESSION=agent-$n\`; create the session once with \`surf session.ensure agent-$n about:blank\`. Before the first use, read \`$SKILLS_W\\surf\\SKILL.md\`. Do not use \`semantic.*\`, \`oracle\`, or the AI-site commands."
            mcp="$EMPTY"; tools=(Bash Read) ;;
      bh)   usage='the `browser-harness` CLI. In every command, first export `export BU_NAME=agent BU_CDP_URL=http://127.0.0.1:9333` (test Chrome, already logged in; you may use it without asking). Before the first use, read the skill: `browser-harness skill`.'
            mcp="$EMPTY"; tools=(Bash Read) ;;
      pw)   usage='the tools of the `playwright` MCP server (browser_*).'
            mcp="$PWCFG"; tools=(Read "mcp__playwright") ;;
    esac
    t0=$(date +%s%N)
    claude -p "$(task_prompt "$usage" "$png")" --model sonnet --output-format json \
      --strict-mcp-config --mcp-config "$mcp" --allowedTools "${tools[@]}" \
      --no-session-persistence > "agents/$f-$n.json" 2> "agents/$f-$n.err"
    t1=$(date +%s%N)
    node -e '
      const fs = require("fs"); const [f, n, png, ms] = process.argv.slice(1);
      const j = JSON.parse(fs.readFileSync(`agents/${f}-${n}.json`, "utf8"));
      const truth = fs.readFileSync("ground-truth/agent.txt", "utf8").trim().split("\n").map((l) => l.split("|"));
      let resp = {}; try { resp = JSON.parse((j.result.match(/\{[\s\S]*\}/) || ["{}"])[0]); } catch {}
      const got = new Map((resp.registrations || []).map((x) => [x.registration, x.unit]));
      const correct = truth.filter(([i, u]) => got.get(i) === u).length;
      let w = 0; try { w = fs.readFileSync(png).readUInt32BE(16); } catch {}
      const u = j.usage || {};
      console.log(JSON.stringify({ tool: f, run: +n, correct, total: truth.length, extras: got.size - correct, screenshot_px: w,
        cost_usd: j.total_cost_usd, turns: j.num_turns, ms: +ms,
        input_tokens: u.input_tokens, output_tokens: u.output_tokens, cache_read_tokens: u.cache_read_input_tokens, cache_creation_tokens: u.cache_creation_input_tokens,
        is_error: j.is_error, problems: (resp.problems || "").slice(0, 160) }));
    ' "$f" "$n" "$png" $(((t1 - t0) / 1000000)) | tee -a agents.jsonl
  done
done
