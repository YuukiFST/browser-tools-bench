#!/usr/bin/env bash
# Cold start (tool process stopped -> 1st navigation) and the latency of one trivial call once warm.
#   bash latency.sh <repetitions> [tools...]
# The trivial call is the same for every tool: one browser round trip that evaluates `1` (trivial_call in lib.sh).
# surf has no command that stops its native host, so its cold start is a new session on a running host: cold_kind "new session".
set -u
cd "$(dirname "$0")"
. ./lib.sh
N="$1"; shift
TOOLS="${*:-$ALL_TOOLS}"
RESULTS="${RESULTS:-../results/v2}"; mkdir -p "$RESULTS"
now() { date +%s%N; }
ms() { echo $((($2 - $1) / 1000000)); }
# a trivial call counts only if it printed the evaluated 1; a fast error is not a fast call
trivial_ok() { trivial_call "$1" 2>&1 | grep -qE '(^|[^0-9])1([^0-9]|$)'; }

open_login() {
  case "$1" in
    ab) agent-browser --cdp $CDP_PORT open "$APP/login" ;;
    axi) chrome-devtools-axi open "$APP/login" ;;
    surf) surf session.ensure bench "$APP/login" ;;
    bh) browser-harness <<< "goto_url('$APP/login'); wait_for_load()" ;;
    pw) pw_server_start && node pw.mjs browser_navigate '{"url":"'$APP'/login"}' ;;
  esac >/dev/null 2>&1
}

for TOOL in $TOOLS; do
  version=$(tool_version "$TOOL")
  kind="process stopped"; [ "$TOOL" = surf ] && kind="new session"
  for i in $(seq 1 "$N"); do
    node cdp.mjs reset >/dev/null; stop_tool "$TOOL"
    t0=$(now); open_login "$TOOL"; t1=$(now)
    t2=$(now); if trivial_ok "$TOOL"; then ok=true; else ok=false; fi; t3=$(now)
    printf '{"tool":"%s","iter":%d,"ts":"%s","tool_version":"%s","cold_kind":"%s","cold_ms":%d,"trivial_ms":%d,"trivial_ok":%s}\n' \
      "$TOOL" "$i" "$(iso_now)" "$version" "$kind" "$(ms $t0 $t1)" "$(ms $t2 $t3)" "$ok" | tee -a "$RESULTS/latency.jsonl"
  done
  # warm latency: 20 trivial calls in a row; only successful calls are timed, failures are counted
  failed=0; : > "$RESULTS/warm-$TOOL.txt"
  for i in $(seq 1 20); do
    t0=$(now); if trivial_ok "$TOOL"; then t1=$(now); ms "$t0" "$t1" >> "$RESULTS/warm-$TOOL.txt"; else failed=$((failed + 1)); fi
  done
  printf '{"tool":"%s","ts":"%s","warm_calls":20,"warm_failed":%d}\n' "$TOOL" "$(iso_now)" "$failed" | tee -a "$RESULTS/latency.jsonl"
done
