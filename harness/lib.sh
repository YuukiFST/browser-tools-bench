# Shared by bench.sh, latency.sh, coverage.sh and agents.sh: tool environment, daemon lifecycle, versions.
#   . ./lib.sh
export MSYS_NO_PATHCONV=1 LC_ALL=C.UTF-8
APP=${BENCH_APP:-http://localhost:3100}
export BENCH_CDP_PORT="${BENCH_CDP_PORT:-9444}"
CDP_PORT=$BENCH_CDP_PORT
CDP_URL=http://127.0.0.1:$CDP_PORT
PW_PORT=8931
ALL_TOOLS="ab axi surf bh pw"

# chrome-devtools-axi otherwise runs `npx -y chrome-devtools-mcp@latest` on every bridge start
AXI_MCP_PKG="${AXI_MCP_PKG:-$(cygpath -w "${LOCALAPPDATA:-}")\\npm-cache\\_npx\\15c61037b1978c83\\node_modules\\chrome-devtools-mcp}"
export CHROME_DEVTOOLS_AXI_MCP_PATH="$AXI_MCP_PKG\\build\\src\\bin\\chrome-devtools-mcp.js"
export CHROME_DEVTOOLS_AXI_BROWSER_URL=$CDP_URL CHROME_DEVTOOLS_AXI_SESSION=bench
export SURF_SESSION=bench BU_NAME=bench BU_CDP_URL=$CDP_URL

# Stops the tool's background process so the next call starts it cold.
# surf has no command that stops its native host (`surf --help-full`), so for surf this only closes the session.
stop_tool() {
  case "$1" in
    ab) powershell -NoProfile -Command "Get-Process agent-browser-win32-x64 -ErrorAction SilentlyContinue | Stop-Process -Force" ;;
    axi) for s in bench agent; do CHROME_DEVTOOLS_AXI_SESSION=$s chrome-devtools-axi stop; done ;;
    surf) for s in $(surf session.list 2>/dev/null | grep -oE '^[[:space:]]*[A-Za-z0-9._-]+' | tr -d ' '); do surf session.close "$s"; done; surf session.close bench ;;
    bh) for n in bench agent; do BU_NAME=$n browser-harness --reload; done ;;
    pw) powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -eq 'node.exe' -and \$_.CommandLine -like '*playwright*mcp*--cdp-endpoint*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"; rm -f pw-session.txt ;;
    *) echo "stop_tool: unknown tool '$1'" >&2; return 2 ;;
  esac >/dev/null 2>&1
  return 0
}
stop_all_tools() { local t; for t in $ALL_TOOLS; do stop_tool "$t"; done; }

# playwright-mcp over HTTP for the scripted phases (agents.sh starts its own over stdio)
pw_server_start() {
  (playwright-mcp --port $PW_PORT --cdp-endpoint $CDP_URL --output-dir "$(cygpath -w "$PWD/pw-out")" --image-responses omit >> pw-server.log 2>&1 &)
  local i; for i in $(seq 1 100); do
    node -e "fetch('http://localhost:$PW_PORT/mcp').then(()=>process.exit(0),()=>process.exit(1))" && return 0
    sleep 0.1
  done
  echo "pw_server_start: playwright-mcp did not answer on port $PW_PORT" >&2; return 1
}

# Brings a stopped tool back: the server or session it needs before its first command.
start_tool() {
  case "$1" in
    pw) pw_server_start ;;
    surf) surf session.ensure bench about:blank >/dev/null 2>&1 ;;
    # browser-harness attaches to a tab of its own in the background (agent-docs/bh-skill.md); input there is unreliable on this app
    bh) browser-harness <<< "activate_tab(current_tab())" >/dev/null 2>&1 ;;
  esac
}

# The trivial command, the same for every tool: one browser round trip that evaluates `1`.
trivial_call() {
  case "$1" in
    ab) agent-browser --cdp $CDP_PORT eval 1 ;;
    axi) chrome-devtools-axi eval "1" ;;
    surf) surf js "return 1" ;;
    bh) browser-harness <<< "print(js('1'))" ;;
    pw) node pw.mjs browser_evaluate '{"function":"() => 1"}' ;;
  esac
}

tool_version() {
  case "$1" in
    ab) agent-browser --version ;;
    axi) echo "$(chrome-devtools-axi --version) mcp=$(node -p "require(process.argv[1]).version" "$AXI_MCP_PKG\\package.json")" ;;
    surf) surf --version ;;
    bh) browser-harness --version ;;
    pw) playwright-mcp --version ;;
    none) echo none ;;
  esac 2>&1 | head -1 | tr -d '\r"'
}

iso_now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
