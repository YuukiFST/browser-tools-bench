#!/usr/bin/env bash
# Read coverage: saves each tool's default read of a route next to the visible text of <main> (the ground truth).
#   bash coverage.sh <reps> <route>...        then: node score-coverage.mjs
# Every tool gets the same wait: navigate, wait until `main h1` exists, then 1.5 s more.
# Writes readings/<mode><slug>-r<k>.txt and readings/ground-truth<slug>-r<k>.txt (slug: route with / turned into _).
set -u
cd "$(dirname "$0")"
. ./lib.sh
REPS="$1"; shift
mkdir -p readings
BH_AX=$(sed -n "/^BH_AX='/,/^'/p" bench.sh | sed '1d;$d')
POLL_H1="async () => { for (let i = 0; i < 60; i++) { if (document.querySelector('main h1')) return true; await new Promise(r => setTimeout(r, 250)); } return false }"

node cdp.mjs reset >/dev/null
for t in $ALL_TOOLS; do stop_tool "$t"; start_tool "$t"; done
for k in $(seq 1 "$REPS"); do
  for route in "$@"; do
    s="$(echo "$route" | tr '/' '_')-r$k"
    node cdp.mjs ground-truth-text "$route" > "readings/ground-truth$s.txt"
    agent-browser --cdp $CDP_PORT open "$APP$route" >/dev/null 2>&1; agent-browser --cdp $CDP_PORT wait "main h1" >/dev/null 2>&1; agent-browser --cdp $CDP_PORT wait 1500 >/dev/null 2>&1
    agent-browser --cdp $CDP_PORT snapshot > "readings/ab$s.txt" 2>&1
    agent-browser --cdp $CDP_PORT snapshot -i > "readings/ab-i$s.txt" 2>&1
    chrome-devtools-axi open "$APP$route" >/dev/null 2>&1; chrome-devtools-axi eval "$POLL_H1" >/dev/null 2>&1; chrome-devtools-axi wait 1500 >/dev/null 2>&1
    chrome-devtools-axi snapshot > "readings/axi$s.txt" 2>&1
    chrome-devtools-axi snapshot --full > "readings/axi-full$s.txt" 2>&1
    surf navigate "$APP$route" >/dev/null 2>&1; surf wait.ready --selector "main h1" >/dev/null 2>&1; surf wait 1.5 >/dev/null 2>&1
    surf page.read > "readings/surf$s.txt" 2>&1
    surf page.text > "readings/surf-text$s.txt" 2>&1
    browser-harness <<< "goto_url('$APP$route'); wait_for_load(); wait_for_element('main h1'); wait(1.5)
$BH_AX" > "readings/bh$s.txt" 2>&1
    browser-harness <<< "print(js('document.querySelector(\"main\").innerText'))" > "readings/bh-text$s.txt" 2>&1
    node pw.mjs browser_navigate "{\"url\":\"$APP$route\"}" >/dev/null 2>&1; node pw.mjs browser_evaluate "{\"function\":\"$POLL_H1\"}" >/dev/null 2>&1; node pw.mjs browser_wait_for '{"time":1.5}' >/dev/null 2>&1
    node pw.mjs browser_snapshot > "readings/pw$s.txt" 2>&1
    echo "coverage: $route rep $k saved" >&2
  done
done
