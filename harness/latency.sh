#!/usr/bin/env bash
# Cold start (daemon stopped -> 1st navigation) and latency of one trivial call once warm.
#   bash latency.sh <ab|axi|surf|bh> <repetitions>
set -u
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")"
TOOL="$1"; N="$2"; APP=http://localhost:3100
export CHROME_DEVTOOLS_AXI_BROWSER_URL=http://127.0.0.1:9333 CHROME_DEVTOOLS_AXI_SESSION=bench
export SURF_SESSION=bench BU_NAME=bench BU_CDP_URL=http://127.0.0.1:9333
now() { date +%s%N; }
ms() { echo $((($2 - $1) / 1000000)); }

stop_tool() {
  case "$TOOL" in
    ab) powershell -NoProfile -Command "Get-Process agent-browser-win32-x64 -ErrorAction SilentlyContinue | Stop-Process -Force" ;;
    axi) chrome-devtools-axi stop ;;
    surf) surf session.close bench ;;
    bh) browser-harness --reload ;;
    pw) powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.Name -eq 'node.exe' -and \$_.CommandLine -like '*@playwright*mcp*cli.js*--port 8931*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"; rm -f pw-session.txt ;;
  esac >/dev/null 2>&1
}
open_tool() {
  case "$TOOL" in
    ab) agent-browser --cdp 9333 open "$APP/login" ;;
    axi) chrome-devtools-axi open "$APP/login" ;;
    surf) surf session.ensure bench "$APP/login" ;;
    bh) browser-harness <<< "new_tab('$APP/login'); activate_tab(current_tab()); wait_for_load()" ;;
    pw) (playwright-mcp --port 8931 --cdp-endpoint http://127.0.0.1:9333 --output-dir "$(cygpath -w "$PWD/pw-out")" --image-responses omit >> pw-server.log 2>&1 &); until node -e "fetch('http://localhost:8931/mcp').then(()=>process.exit(0),()=>process.exit(1))"; do sleep 0.1; done; node pw.mjs browser_navigate '{"url":"'$APP'/login"}' ;;
  esac >/dev/null 2>&1
}
trivial() {
  case "$TOOL" in
    ab) agent-browser --cdp 9333 get url ;;
    axi) chrome-devtools-axi eval "1" ;;
    surf) surf js "return 1" ;;
    bh) browser-harness <<< "print(1)" ;;
    pw) node pw.mjs browser_evaluate '{"function":"() => 1"}' ;;
  esac >/dev/null 2>&1
}

for i in $(seq 1 "$N"); do
  node cdp.mjs reset >/dev/null; stop_tool
  t0=$(now); open_tool; t1=$(now)
  t2=$(now); trivial; t3=$(now)
  printf '{"tool":"%s","iter":%d,"cold_ms":%d,"trivial_ms":%d}\n' "$TOOL" "$i" "$(ms $t0 $t1)" "$(ms $t2 $t3)" | tee -a latency.jsonl
done
# warm latency: 20 trivial calls in a row
for i in $(seq 1 20); do t0=$(now); trivial; t1=$(now); echo "$(ms $t0 $t1)"; done > "warm-$TOOL.txt"
