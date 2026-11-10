#!/usr/bin/env bash
# Read coverage: % of the visible text lines of <main> that show up in each tool's default read.
#   bash coverage.sh <route>...
set -u
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")"
APP=http://localhost:3100
export CHROME_DEVTOOLS_AXI_BROWSER_URL=http://127.0.0.1:9333 CHROME_DEVTOOLS_AXI_SESSION=bench
export SURF_SESSION=bench BU_NAME=bench BU_CDP_URL=http://127.0.0.1:9333
mkdir -p readings
BH_AX=$(sed -n "/^BH_AX='/,/^'/p" bench.sh | sed '1d;$d')

for route in "$@"; do
  slug=$(echo "$route" | tr '/' '_')
  node cdp.mjs ground-truth-text "$route" > "readings/ground-truth$slug.txt"
  agent-browser --cdp 9333 open "$APP$route" >/dev/null 2>&1; agent-browser --cdp 9333 wait "main h1" >/dev/null 2>&1; agent-browser --cdp 9333 wait 1500 >/dev/null 2>&1
  agent-browser --cdp 9333 snapshot > "readings/ab$slug.txt" 2>&1
  agent-browser --cdp 9333 snapshot -i > "readings/ab-i$slug.txt" 2>&1
  chrome-devtools-axi open "$APP$route" >/dev/null 2>&1; chrome-devtools-axi wait 1500 >/dev/null 2>&1
  chrome-devtools-axi snapshot > "readings/axi$slug.txt" 2>&1
  chrome-devtools-axi snapshot --full > "readings/axi-full$slug.txt" 2>&1
  surf navigate "$APP$route" >/dev/null 2>&1; surf wait.ready --selector "main h1" >/dev/null 2>&1; surf wait 1.5 >/dev/null 2>&1
  surf page.read > "readings/surf$slug.txt" 2>&1
  surf page.text > "readings/surf-text$slug.txt" 2>&1
  browser-harness <<< "goto_url('$APP$route'); wait_for_load(); wait_for_element('main h1'); wait(1.5)
$BH_AX" > "readings/bh$slug.txt" 2>&1
  browser-harness <<< "print(js('document.querySelector(\"main\").innerText'))" > "readings/bh-text$slug.txt" 2>&1
  for f in ab ab-i axi axi-full surf surf-text bh bh-text; do
    node -e '
      const fs = require("fs"), n = (s) => s.replace(/\\u00a0|\s+/g, " ").trim();
      const g = fs.readFileSync(process.argv[1], "utf8").split("\n").filter(Boolean).map(n);
      const o = n(fs.readFileSync(process.argv[2], "utf8").replace(/\\"/g, "\""));
      const hit = g.filter((l) => o.includes(l)).length;
      console.log(JSON.stringify({ route: process.argv[3], mode: process.argv[4], lines: g.length, found: hit, coverage: +(hit / g.length * 100).toFixed(1), chars: o.length }));
    ' "readings/ground-truth$slug.txt" "readings/$f$slug.txt" "$route" "$f" | tee -a coverage.jsonl
  done
done
