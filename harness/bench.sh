#!/usr/bin/env bash
# Scripted task battery of the browser tools against the local SB360-IPTU app.
#   bash bench.sh <iterations> [tools...]        TASKS env picks tasks (default: all 7)
# Tools are interleaved: each iteration runs every tool, in an order rotated by one per iteration.
# Every tool call goes through `m`, which counts commands, characters returned to the agent, and time.
# Output: one JSON line per (tool, task, iteration) in $RESULTS/battery.jsonl.
set -u
cd "$(dirname "$0")"
. ./lib.sh
. ./creds.sh
N="$1"; shift
TOOLS="${*:-$ALL_TOOLS}"
TASKS="${TASKS:-login search read screenshot console mobile sweep}"
QUERY="${BENCH_QUERY:?set BENCH_QUERY}"
RESULTS="${RESULTS:-../results/v2}"; mkdir -p "$RESULTS"
OUT="$RESULTS/battery.jsonl"
LAST=$(mktemp)
RE_INSC='[0-9]{2}\.[0-9]\.[0-9]{2}\.[0-9]{3}\.[0-9]{4}\.[0-9]{3}'
SEARCH_TOTAL=$(grep -c . ground-truth/search.txt)
# Windows path of the screenshot, JSON-escaped, for playwright-mcp
SHOT_JSON=$(cygpath -w "$PWD/shot.png"); SHOT_JSON=${SHOT_JSON//\\/\\\\}

now() { date +%s%N; }
m() {  # runs one tool command and accounts for it
  local out rc
  out=$("$@" 2>&1); rc=$?
  CMDS=$((CMDS + 1)); CHARS=$((CHARS + ${#out})); LAST_CHARS=${#out}
  printf '%s' "$out" > "$LAST"
  return $rc
}
last() { cat "$LAST"; }
mask() { local s; s=$(cat); printf '%s\n' "${s//"$BENCH_PASS"/***}"; }
pngw() { node -e "const b=require('fs').readFileSync(process.argv[1]);console.log(b.readUInt32BE(16))" "$1" 2>/dev/null || echo 0; }

AB() { agent-browser --cdp $CDP_PORT "$@"; }
AXI() { chrome-devtools-axi "$@"; }
SURF() { surf "$@"; }
BH() { browser-harness <<< "$1"; }
PW() { node pw.mjs "$@"; }

# ---------------------------------------------------------------- wait rules, the same for every tool
# W_URL  after the login submit: until location.pathname contains /dashboard (up to 15 s)
# W_H1   after every navigation in read, screenshot, mobile and sweep: until `main h1` exists (up to 15 s)
# W_TEXT after the search click: until the page text contains "Cód. empresa"
POLL_H1="async () => { for (let i = 0; i < 60; i++) { if (document.querySelector('main h1')) return true; await new Promise(r => setTimeout(r, 250)); } return false }"
POLL_URL="async () => { for (let i = 0; i < 60; i++) { if (location.pathname.includes('/dashboard')) return location.pathname; await new Promise(r => setTimeout(r, 250)); } return location.pathname }"
BH_W_H1="wait_for_element('main h1')"
BH_W_URL="import time
for _ in range(60):
    if '/dashboard' in page_info()['url']: break
    time.sleep(0.25)
print(page_info()['url'])"
BH_W_TEXT="import time
for _ in range(60):
    if 'Cód. empresa' in js('document.body.innerText'): break
    time.sleep(0.25)"

ab_wait_h1() { m AB wait "main h1"; }
axi_wait_h1() { m AXI eval "$POLL_H1"; }
surf_wait_h1() { m SURF wait.ready --selector "main h1"; }
pw_wait_h1() { m PW browser_evaluate "{\"function\":\"$POLL_H1\"}"; }

# ---------------------------------------------------------------- playwright-mcp (via MCP HTTP)
ref_pw() { last | grep -E "$1 \"$2" | head -1 | grep -oE 'ref=[a-z0-9]+' | sed 's/ref=//'; }
pw_login() {
  m PW browser_navigate "{\"url\":\"$APP/login\"}"; m PW browser_snapshot
  local e s b; e=$(ref_pw textbox "E-mail"); s=$(ref_pw textbox "Senha"); b=$(ref_pw button "Entrar")
  m PW browser_fill_form "{\"fields\":[{\"name\":\"E-mail\",\"type\":\"textbox\",\"target\":\"$e\",\"value\":\"$BENCH_EMAIL\"},{\"name\":\"Senha\",\"type\":\"textbox\",\"target\":\"$s\",\"value\":\"$BENCH_PASS\"}]}"
  m PW browser_click "{\"element\":\"Entrar\",\"target\":\"$b\"}"
  m PW browser_evaluate "{\"function\":\"$POLL_URL\"}"; last | grep -q '/dashboard'
}
pw_search() {
  m PW browser_navigate "{\"url\":\"$APP/inscricoes\"}"; m PW browser_snapshot
  local q p; q=$(ref_pw textbox "Buscar"); p=$(ref_pw button "Pesquisar")
  m PW browser_type "{\"element\":\"Buscar\",\"target\":\"$q\",\"text\":\"$QUERY\"}"
  m PW browser_click "{\"element\":\"Pesquisar\",\"target\":\"$p\"}"
  m PW browser_wait_for '{"text":"Cód. empresa"}'; m PW browser_snapshot
  last | grep -oE "$RE_INSC" | sort -u > found.txt
}
pw_read() { m PW browser_navigate "{\"url\":\"$APP/dashboard\"}"; pw_wait_h1; m PW browser_snapshot; READ_FULL=$LAST_CHARS; READ_INT=$READ_FULL; }
pw_screenshot() { m PW browser_navigate "{\"url\":\"$APP/debitos\"}"; pw_wait_h1; rm -f shot.png; m PW browser_take_screenshot "{\"filename\":\"$SHOT_JSON\"}"; [ "$(pngw shot.png)" -gt 0 ]; }
pw_console() { MARK="BENCH-$RANDOM"; m PW browser_evaluate "{\"function\":\"() => console.error('$MARK')\"}"; m PW browser_console_messages '{"level":"error"}'; last | grep -q "$MARK"; }
pw_mobile() { m PW browser_resize '{"width":390,"height":844}'; m PW browser_navigate "{\"url\":\"$APP/guias\"}"; pw_wait_h1; rm -f shot.png; m PW browser_take_screenshot "{\"filename\":\"$SHOT_JSON\"}"; W=$(pngw shot.png); m PW browser_resize '{"width":1366,"height":768}'; [ "$W" -eq 390 ] || [ "$W" -eq 780 ]; }
pw_h1() { m PW browser_navigate "{\"url\":\"$APP$1\"}"; m PW browser_evaluate '{"function":"async () => { for (let i = 0; i < 60; i++) { const h = document.querySelector(\"main h1\"); if (h) return h.innerText; await new Promise(r => setTimeout(r, 250)); } return null }"}'; last | sed -n '/### Result/{n;p}' | head -1; }

# ref of an element in a snapshot output, by role and name
ref_ab()   { last | grep -E "$1 \"$2" | head -1 | grep -oE 'ref=e[0-9]+' | sed 's/ref=/@/'; }
ref_axi()  { last | grep -E "$1 \"$2" | head -1 | grep -oE 'uid=[^ ]+' | sed 's/uid=/@/'; }
ref_surf() { last | grep -E "$1 \"$2" | head -1 | grep -oE '\[?e[0-9]+\]?' | head -1 | tr -d '[]'; }

# ---------------------------------------------------------------- agent-browser
ab_login() {
  m AB open "$APP/login"; m AB snapshot -i
  local e s b; e=$(ref_ab textbox "E-mail"); s=$(ref_ab textbox "Senha"); b=$(ref_ab button "Entrar")
  m AB fill "$e" "$BENCH_EMAIL"; m AB fill "$s" "$BENCH_PASS"; m AB click "$b"
  m AB eval "($POLL_URL)()"; last | grep -q '/dashboard'
}
ab_search() {
  m AB open "$APP/inscricoes"; m AB snapshot -i
  local q p; q=$(ref_ab textbox "Buscar"); p=$(ref_ab button "Pesquisar")
  m AB fill "$q" "$QUERY"; m AB click "$p"; m AB wait --text "Cód. empresa"; m AB snapshot
  last | grep -oE "$RE_INSC" | sort -u > found.txt
}
ab_read() { m AB open "$APP/dashboard"; ab_wait_h1; m AB snapshot; READ_FULL=$LAST_CHARS; m AB snapshot -i; READ_INT=$LAST_CHARS; }
ab_screenshot() { m AB open "$APP/debitos"; ab_wait_h1; rm -f shot.png; m AB screenshot "$(cygpath -w "$PWD/shot.png")"; [ "$(pngw shot.png)" -gt 0 ]; }
ab_console() { MARK="BENCH-$RANDOM"; m AB console --clear; m AB eval "console.error('$MARK')"; m AB console; last | grep -q "$MARK"; }
ab_mobile() { m AB set viewport 390 844; m AB open "$APP/guias"; ab_wait_h1; rm -f shot.png; m AB screenshot "$(cygpath -w "$PWD/shot.png")"; W=$(pngw shot.png); m AB set viewport 1366 768; [ "$W" -eq 390 ] || [ "$W" -eq 780 ]; }
ab_h1() { m AB open "$APP$1"; ab_wait_h1; m AB get text "main h1"; last; }

# ---------------------------------------------------------------- chrome-devtools-axi
axi_login() {
  m AXI open "$APP/login"
  local e s; e=$(ref_axi textbox "E-mail"); s=$(ref_axi textbox "Senha")
  m AXI fillform "$e=$BENCH_EMAIL" "$s=$BENCH_PASS"
  local b; b=$(ref_axi button "Entrar"); [ -n "$b" ] || { m AXI snapshot; b=$(ref_axi button "Entrar"); }
  m AXI click "$b"
  m AXI eval "$POLL_URL"; last | grep -q '/dashboard'
}
axi_search() {
  m AXI open "$APP/inscricoes"
  local q; q=$(ref_axi textbox "Buscar")
  m AXI fill "$q" "$QUERY"
  local p; p=$(ref_axi button "Pesquisar"); m AXI click "$p"
  m AXI wait "Cód. empresa"; m AXI snapshot
  last | grep -oE "$RE_INSC" | sort -u > found.txt
}
axi_read() { m AXI open "$APP/dashboard"; axi_wait_h1; m AXI snapshot; READ_FULL=$LAST_CHARS; READ_INT=$READ_FULL; }
axi_screenshot() { m AXI open "$APP/debitos"; axi_wait_h1; rm -f shot.png; m AXI screenshot "$(cygpath -w "$PWD/shot.png")"; [ "$(pngw shot.png)" -gt 0 ]; }
axi_console() { MARK="BENCH-$RANDOM"; m AXI eval "console.error('$MARK')"; m AXI console --type error; last | grep -q "$MARK"; }
axi_mobile() { m AXI emulate --viewport 390x844x1,mobile,touch; m AXI open "$APP/guias"; axi_wait_h1; rm -f shot.png; m AXI screenshot "$(cygpath -w "$PWD/shot.png")"; W=$(pngw shot.png); m AXI emulate --viewport 1366x768x1; [ "$W" -eq 390 ] || [ "$W" -eq 780 ]; }
axi_h1() { m AXI open "$APP$1"; m AXI eval "async () => { for (let i = 0; i < 60; i++) { const h = document.querySelector('main h1'); if (h) return h.innerText; await new Promise(r => setTimeout(r, 250)); } return null }"; last | head -1 | sed -E 's/^result: //; s/^"\\"//; s/\\""$//'; }

# ---------------------------------------------------------------- surf
surf_login() {
  m SURF navigate "$APP/login"; m SURF wait.ready --accept login; m SURF page.read
  local e s b; e=$(ref_surf textbox "E-mail"); s=$(ref_surf textbox "Senha"); b=$(ref_surf button "Entrar")
  m SURF type "$BENCH_EMAIL" --ref "$e"; m SURF type "$BENCH_PASS" --ref "$s"; m SURF click "$b"
  m SURF js "return await ($POLL_URL)()"; last | grep -q '/dashboard'
}
surf_search() {
  m SURF navigate "$APP/inscricoes"; m SURF wait.ready; m SURF page.read
  local q p; q=$(ref_surf textbox "Buscar"); p=$(ref_surf button "Pesquisar")
  m SURF type "$QUERY" --ref "$q"; m SURF click "$p"; m SURF wait.ready --text "Cód. empresa"; m SURF page.read
  last | grep -oE "$RE_INSC" | sort -u > found.txt
}
surf_read() { m SURF navigate "$APP/dashboard"; surf_wait_h1; m SURF page.read; READ_FULL=$LAST_CHARS; m SURF page.read --compact; READ_INT=$LAST_CHARS; }
surf_screenshot() { m SURF navigate "$APP/debitos"; surf_wait_h1; rm -f shot.png; m SURF screenshot --output "$(cygpath -w "$PWD/shot.png")"; [ "$(pngw shot.png)" -gt 0 ]; }
surf_console() { MARK="BENCH-$RANDOM"; m SURF console --clear; m SURF js "console.error('$MARK'); return 1"; m SURF console; last | grep -q "$MARK"; }
surf_mobile() { m SURF emulate.viewport --width 390 --height 844 --mobile; m SURF navigate "$APP/guias"; surf_wait_h1; rm -f shot.png; m SURF screenshot --output "$(cygpath -w "$PWD/shot.png")"; W=$(pngw shot.png); m SURF emulate.viewport --width 1366 --height 768; [ "$W" -eq 390 ] || [ "$W" -eq 780 ]; }
surf_h1() { m SURF navigate "$APP$1"; surf_wait_h1; m SURF js "return document.querySelector('main h1').innerText"; last | grep -v '^\[surf' | tail -1; }

# ---------------------------------------------------------------- browser-harness
BH_AX='
nodes = cdp("Accessibility.getFullAXTree")["nodes"]
for n in nodes:
    if n.get("ignored"): continue
    r = n.get("role", {}).get("value", ""); nm = n.get("name", {}).get("value", "")
    if nm and r not in ("none", "generic", "InlineTextBox"): print(r, repr(nm), n.get("backendDOMNodeId"))
'
bh_login() {
  m BH "goto_url('$APP/login'); wait_for_load(); wait_for_element('input[type=password]')"
  m BH "fill_input('input[type=email]', '$BENCH_EMAIL'); fill_input('input[type=password]', '$BENCH_PASS'); press_key('Enter')"
  m BH "$BH_W_URL"
  last | grep -q '/dashboard'
}
bh_search() {
  m BH "goto_url('$APP/inscricoes'); wait_for_load(); wait_for_element('input[placeholder^=Buscar]')"
  m BH "fill_input('input[placeholder^=Buscar]', '$QUERY')
n = next(n for n in cdp('Accessibility.getFullAXTree')['nodes'] if n.get('role',{}).get('value')=='button' and n.get('name',{}).get('value')=='Pesquisar')
q = cdp('DOM.getBoxModel', backendNodeId=n['backendDOMNodeId'])['model']['content']
click_at_xy(sum(q[0::2])/4, sum(q[1::2])/4)"
  m BH "$BH_W_TEXT
$BH_AX"
  last | grep -oE "$RE_INSC" | sort -u > found.txt
}
bh_read() { m BH "goto_url('$APP/dashboard'); wait_for_load(); $BH_W_H1
$BH_AX"; READ_FULL=$LAST_CHARS; READ_INT=$READ_FULL; }
bh_screenshot() { rm -f shot.png; m BH "goto_url('$APP/debitos'); wait_for_load(); $BH_W_H1; capture_screenshot(r'$(cygpath -w "$PWD/shot.png")')"; [ "$(pngw shot.png)" -gt 0 ]; }
bh_console() { MARK="BENCH-$RANDOM"; m BH "cdp('Runtime.enable'); drain_events(); js(\"console.error('$MARK')\"); import time; time.sleep(0.3)
print([e for e in drain_events() if 'consoleAPICalled' in str(e.get('method',''))][-1:])"; last | grep -q "$MARK"; }
bh_mobile() { rm -f shot.png; m BH "cdp('Emulation.setDeviceMetricsOverride', width=390, height=844, deviceScaleFactor=1, mobile=True); goto_url('$APP/guias'); wait_for_load(); $BH_W_H1; capture_screenshot(r'$(cygpath -w "$PWD/shot.png")'); cdp('Emulation.clearDeviceMetricsOverride')"; W=$(pngw shot.png); [ "$W" -eq 390 ] || [ "$W" -eq 780 ]; }
bh_h1() { m BH "goto_url('$APP$1'); wait_for_load(); $BH_W_H1; print(js(\"document.querySelector('main h1').innerText\"))"; last | tail -1; }

# ---------------------------------------------------------------- common tasks
t_login() { node cdp.mjs logout >/dev/null; ${TOOL}_login; }
t_search() { : > found.txt; ${TOOL}_search; DETAIL="$(grep -c . found.txt)/$SEARCH_TOTAL found"; diff -q <(cut -d'|' -f1 ground-truth/search.txt | sort) found.txt >/dev/null; }
# a read under half of this tool's own warm-up median is a failed read (truncated or empty page)
t_read() {
  ${TOOL}_read
  local floor=$(( ${READ_MEDIAN[$TOOL]:-0} / 2 ))
  DETAIL="snapshot=$READ_FULL interactive=$READ_INT floor=$floor"
  [ "$READ_FULL" -ge "$floor" ]
}
t_screenshot() { ${TOOL}_screenshot; }
t_console() { ${TOOL}_console; }
t_mobile() { ${TOOL}_mobile; }
t_sweep() {
  local ok=0 total=0 r expected got
  for r in $(cat ground-truth/routes.txt); do
    total=$((total + 1))
    expected=$(node -e "console.log(require('./ground-truth/h1.json')[process.argv[1]])" "$r")
    ${TOOL}_h1 "$r" > h1.txt
    got=$(tr -d '\r' < h1.txt | sed 's/^"//; s/"$//')
    [ "$got" = "$expected" ] && ok=$((ok + 1)) || echo "  sweep $r: expected [$expected] got [$got]" >&2
  done
  DETAIL="$ok/$total"; [ "$ok" -eq "$total" ]
}

# Untimed: every tool process stopped (no other tool keeps a session or tab), one active tab, then one trivial call so the timed tasks start warm.
attach_tool() { stop_all_tools; node cdp.mjs reset >/dev/null; start_tool "$1"; trivial_call "$1" >/dev/null 2>&1; }

declare -A READ_MEDIAN VERSION
median() { sort -n | awk '{a[NR]=$1} END {print (NR % 2) ? a[(NR+1)/2] : int((a[NR/2] + a[NR/2+1]) / 2)}'; }

# warm-up, discarded: every task once, read 3 times for the size floor
for TOOL in $TOOLS; do
  VERSION[$TOOL]=$(tool_version "$TOOL")
  attach_tool "$TOOL"
  for t in $TASKS; do CMDS=0; CHARS=0; t_$t >/dev/null 2>&1 || echo "warm-up: $TOOL $t failed" >&2; done
  # a warm-up read of any page other than the dashboard (e.g. the login page) would set a meaningless floor
  sizes=""; for k in 1 2 3; do
    CMDS=0; CHARS=0; READ_FULL=0; ${TOOL}_read >/dev/null 2>&1
    last | grep -q 'Dashboard' && sizes="$sizes $READ_FULL"
  done
  [ -n "$sizes" ] || { echo "warm-up $TOOL: no read showed the dashboard; fix login before measuring" >&2; exit 4; }
  READ_MEDIAN[$TOOL]=$(printf '%s\n' $sizes | median)
  echo "warm-up $TOOL: read sizes$sizes, median ${READ_MEDIAN[$TOOL]}" >&2
done

set -- $TOOLS; n_tools=$#
for i in $(seq 1 "$N"); do
  shift_by=$(((i - 1) % n_tools)); order=$(printf '%s\n' $TOOLS | awk -v s=$shift_by -v n=$n_tools '{a[NR-1]=$0} END {for (k=0;k<n;k++) print a[(k+s)%n]}')
  pos=0
  for TOOL in $order; do
    pos=$((pos + 1)); attach_tool "$TOOL"
    for t in $TASKS; do
      CMDS=0; CHARS=0; DETAIL=""; READ_FULL=0; READ_INT=0; ts=$(iso_now)
      t0=$(now); if t_$t; then ok=true; else ok=false; fi; t1=$(now)
      line=$(printf '{"tool":"%s","task":"%s","iter":%d,"pos":%d,"ts":"%s","tool_version":"%s","ms":%d,"cmds":%d,"chars":%d,"ok":%s,"detail":"%s"}' \
        "$TOOL" "$t" "$i" "$pos" "$ts" "${VERSION[$TOOL]}" $(((t1 - t0) / 1000000)) "$CMDS" "$CHARS" "$ok" "$DETAIL")
      echo "$line" | tee -a "$OUT"
      [ "$ok" = false ] && { echo "--- last output ($TOOL $t):" >&2; last | mask | tail -8 >&2; }
    done
  done
done
rm -f "$LAST"
