#!/usr/bin/env bash
# Benchmark of the browser tools against the local SB360-IPTU app.
#   bash bench.sh <tool> <iterations> [tasks...]
# tool: ab | axi | surf | bh. Output: one JSON line per (task, iteration) in battery.jsonl.
# Every CLI call goes through `m`, which counts commands, characters returned to the agent, and time.
set -u
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")"
. ./creds.sh
TOOL="$1"; N="$2"; shift 2
TASKS="${*:-login search read screenshot console mobile sweep}"
APP=${BENCH_APP:-http://localhost:3100}
QUERY="${BENCH_QUERY:?set BENCH_QUERY}"
OUT=battery.jsonl
LAST=$(mktemp)
RE_INSC='[0-9]{2}\.[0-9]\.[0-9]{2}\.[0-9]{3}\.[0-9]{4}\.[0-9]{3}'
# Windows path of the screenshot, JSON-escaped, for playwright-mcp
SHOT_JSON=$(cygpath -w "$PWD/shot.png"); SHOT_JSON=${SHOT_JSON//\\/\\\\}

export CHROME_DEVTOOLS_AXI_BROWSER_URL=http://127.0.0.1:9333 CHROME_DEVTOOLS_AXI_SESSION=bench
export SURF_SESSION=bench BU_NAME=bench BU_CDP_URL=http://127.0.0.1:9333

now() { date +%s%N; }
m() {  # runs one tool command and accounts for it
  local out rc
  out=$("$@" 2>&1); rc=$?
  CMDS=$((CMDS + 1)); CHARS=$((CHARS + ${#out}))
  printf '%s' "$out" > "$LAST"
  return $rc
}
last() { cat "$LAST"; }
mask() { sed "s/$BENCH_PASS/***/g"; }

AB() { agent-browser --cdp 9333 "$@"; }
AXI() { chrome-devtools-axi "$@"; }
SURF() { surf "$@"; }
BH() { browser-harness <<< "$1"; }
PW() { node pw.mjs "$@"; }
ref_pw() { last | grep -E "$1 \"$2" | head -1 | grep -oE 'ref=[a-z0-9]+' | sed 's/ref=//'; }

# ---------------------------------------------------------------- playwright-mcp (via MCP HTTP)
pw_login() {
  m PW browser_navigate "{\"url\":\"$APP/login\"}"; m PW browser_snapshot
  local e s b; e=$(ref_pw textbox "E-mail"); s=$(ref_pw textbox "Senha"); b=$(ref_pw button "Entrar")
  m PW browser_fill_form "{\"fields\":[{\"name\":\"E-mail\",\"type\":\"textbox\",\"target\":\"$e\",\"value\":\"$BENCH_EMAIL\"},{\"name\":\"Senha\",\"type\":\"textbox\",\"target\":\"$s\",\"value\":\"$BENCH_PASS\"}]}"
  m PW browser_click "{\"element\":\"Entrar\",\"target\":\"$b\"}"
  m PW browser_wait_for '{"text":"Dashboard"}'; m PW browser_evaluate '{"function":"() => location.pathname"}'; last | grep -q '/dashboard'
}
pw_search() {
  m PW browser_navigate "{\"url\":\"$APP/inscricoes\"}"; m PW browser_snapshot
  local q p; q=$(ref_pw textbox "Buscar"); p=$(ref_pw button "Pesquisar")
  m PW browser_type "{\"element\":\"Buscar\",\"target\":\"$q\",\"text\":\"$QUERY\"}"
  m PW browser_click "{\"element\":\"Pesquisar\",\"target\":\"$p\"}"
  m PW browser_wait_for '{"text":"Cód. empresa"}'; m PW browser_snapshot
  last | grep -oE "$RE_INSC" | sort -u > found.txt
}
pw_read() { m PW browser_navigate "{\"url\":\"$APP/dashboard\"}"; m PW browser_wait_for '{"text":"Dashboard"}'; m PW browser_snapshot; READ_FULL=$(last | wc -c); READ_INT=$READ_FULL; }
pw_screenshot() { m PW browser_navigate "{\"url\":\"$APP/debitos\"}"; rm -f shot.png; m PW browser_take_screenshot "{\"filename\":\"$SHOT_JSON\"}"; [ "$(pngw shot.png)" -gt 0 ]; }
pw_console() { MARK="BENCH-$RANDOM"; m PW browser_evaluate "{\"function\":\"() => console.error('$MARK')\"}"; m PW browser_console_messages '{"level":"error"}'; last | grep -q "$MARK"; }
pw_mobile() { m PW browser_resize '{"width":390,"height":844}'; m PW browser_navigate "{\"url\":\"$APP/guias\"}"; rm -f shot.png; m PW browser_take_screenshot "{\"filename\":\"$SHOT_JSON\"}"; W=$(pngw shot.png); m PW browser_resize '{"width":1366,"height":768}'; [ "$W" -eq 390 ] || [ "$W" -eq 780 ]; }
pw_h1() { m PW browser_navigate "{\"url\":\"$APP$1\"}"; m PW browser_evaluate '{"function":"async () => { for (let i = 0; i < 60; i++) { const h = document.querySelector(\"main h1\"); if (h) return h.innerText; await new Promise(r => setTimeout(r, 250)); } return null }"}'; last | sed -n '/### Result/{n;p}' | head -1; }
pngw() { node -e "const b=require('fs').readFileSync(process.argv[1]);console.log(b.readUInt32BE(16))" "$1" 2>/dev/null || echo 0; }

# ref of an element in a snapshot output, by role and name
ref_ab()   { last | grep -E "$1 \"$2" | head -1 | grep -oE 'ref=e[0-9]+' | sed 's/ref=/@/'; }
ref_axi()  { last | grep -E "$1 \"$2" | head -1 | grep -oE 'uid=[^ ]+' | sed 's/uid=/@/'; }
ref_surf() { last | grep -E "$1 \"$2" | head -1 | grep -oE '\[?e[0-9]+\]?' | head -1 | tr -d '[]'; }

# ---------------------------------------------------------------- agent-browser
ab_login() {
  m AB open "$APP/login"; m AB snapshot -i
  local e s b; e=$(ref_ab textbox "E-mail"); s=$(ref_ab textbox "Senha"); b=$(ref_ab button "Entrar")
  m AB fill "$e" "$BENCH_EMAIL"; m AB fill "$s" "$BENCH_PASS"; m AB click "$b"
  m AB wait --url "**/dashboard"; m AB get url; last | grep -q '/dashboard'
}
ab_search() {
  m AB open "$APP/inscricoes"; m AB snapshot -i
  local q p; q=$(ref_ab textbox "Buscar"); p=$(ref_ab button "Pesquisar")
  m AB fill "$q" "$QUERY"; m AB click "$p"; m AB wait --text "Cód. empresa"; m AB snapshot
  last | grep -oE "$RE_INSC" | sort -u > found.txt
}
ab_read() { m AB open "$APP/dashboard"; m AB wait --text "Dashboard"; m AB snapshot; READ_FULL=$(last | wc -c); m AB snapshot -i; READ_INT=$(last | wc -c); }
ab_screenshot() { m AB open "$APP/debitos"; m AB wait --load networkidle; rm -f shot.png; m AB screenshot "$(cygpath -w "$PWD/shot.png")"; [ "$(pngw shot.png)" -gt 0 ]; }
ab_console() { MARK="BENCH-$RANDOM"; m AB console --clear; m AB eval "console.error('$MARK')"; m AB console; last | grep -q "$MARK"; }
ab_mobile() { m AB set viewport 390 844; m AB open "$APP/guias"; m AB wait --load networkidle; rm -f shot.png; m AB screenshot "$(cygpath -w "$PWD/shot.png")"; W=$(pngw shot.png); m AB set viewport 1366 768; [ "$W" -eq 390 ] || [ "$W" -eq 780 ]; }
ab_h1() { m AB open "$APP$1"; m AB wait "main h1"; m AB get text "main h1"; last; }

# ---------------------------------------------------------------- chrome-devtools-axi
axi_login() {
  m AXI open "$APP/login"
  local e s; e=$(ref_axi textbox "E-mail"); s=$(ref_axi textbox "Senha")
  m AXI fillform "$e=$BENCH_EMAIL" "$s=$BENCH_PASS"
  local b; b=$(ref_axi button "Entrar"); [ -n "$b" ] || { m AXI snapshot; b=$(ref_axi button "Entrar"); }
  m AXI click "$b"
  m AXI wait "Dashboard"; m AXI eval "location.pathname"; last | grep -q '/dashboard'
}
axi_search() {
  m AXI open "$APP/inscricoes"
  local q; q=$(ref_axi textbox "Buscar")
  m AXI fill "$q" "$QUERY"
  local p; p=$(ref_axi button "Pesquisar"); m AXI click "$p"
  m AXI wait "Cód. empresa"; m AXI snapshot
  last | grep -oE "$RE_INSC" | sort -u > found.txt
}
axi_read() { m AXI open "$APP/dashboard"; m AXI wait "Dashboard"; m AXI snapshot; READ_FULL=$(last | wc -c); READ_INT=$READ_FULL; }
axi_screenshot() { m AXI open "$APP/debitos"; rm -f shot.png; m AXI screenshot "$(cygpath -w "$PWD/shot.png")"; [ "$(pngw shot.png)" -gt 0 ]; }
axi_console() { MARK="BENCH-$RANDOM"; m AXI eval "console.error('$MARK')"; m AXI console --type error; last | grep -q "$MARK"; }
axi_mobile() { m AXI emulate --viewport 390x844x1,mobile,touch; m AXI open "$APP/guias"; rm -f shot.png; m AXI screenshot "$(cygpath -w "$PWD/shot.png")"; W=$(pngw shot.png); m AXI emulate --viewport 1366x768x1; [ "$W" -eq 390 ] || [ "$W" -eq 780 ]; }
axi_h1() { m AXI open "$APP$1"; m AXI eval "async () => { for (let i = 0; i < 60; i++) { const h = document.querySelector('main h1'); if (h) return h.innerText; await new Promise(r => setTimeout(r, 250)); } return null }"; last | head -1 | sed -E 's/^result: //; s/^"\\"//; s/\\""$//'; }

# ---------------------------------------------------------------- surf
surf_login() {
  m SURF navigate "$APP/login"; m SURF wait.ready --accept login; m SURF page.read
  local e s b; e=$(ref_surf textbox "E-mail"); s=$(ref_surf textbox "Senha"); b=$(ref_surf button "Entrar")
  m SURF type "$BENCH_EMAIL" --ref "$e"; m SURF type "$BENCH_PASS" --ref "$s"; m SURF click "$b"
  m SURF wait.url /dashboard; m SURF js "return location.pathname"; last | grep -q '/dashboard'
}
surf_search() {
  m SURF navigate "$APP/inscricoes"; m SURF wait.ready; m SURF page.read
  local q p; q=$(ref_surf textbox "Buscar"); p=$(ref_surf button "Pesquisar")
  m SURF type "$QUERY" --ref "$q"; m SURF click "$p"; m SURF wait.ready --text "Cód. empresa"; m SURF page.read
  last | grep -oE "$RE_INSC" | sort -u > found.txt
}
surf_read() { m SURF navigate "$APP/dashboard"; m SURF wait.ready --text "Dashboard"; m SURF page.read; READ_FULL=$(last | wc -c); m SURF page.read --compact; READ_INT=$(last | wc -c); }
surf_screenshot() { m SURF navigate "$APP/debitos"; m SURF wait.ready; rm -f shot.png; m SURF screenshot --output "$(cygpath -w "$PWD/shot.png")"; [ "$(pngw shot.png)" -gt 0 ]; }
surf_console() { MARK="BENCH-$RANDOM"; m SURF console --clear; m SURF js "console.error('$MARK'); return 1"; m SURF console; last | grep -q "$MARK"; }
surf_mobile() { m SURF emulate.viewport --width 390 --height 844 --mobile; m SURF navigate "$APP/guias"; m SURF wait.ready; rm -f shot.png; m SURF screenshot --output "$(cygpath -w "$PWD/shot.png")"; W=$(pngw shot.png); m SURF emulate.viewport --width 1366 --height 768; [ "$W" -eq 390 ] || [ "$W" -eq 780 ]; }
surf_h1() { m SURF navigate "$APP$1"; m SURF wait.ready --selector "main h1"; m SURF js "return document.querySelector('main h1').innerText"; last | grep -v '^\[surf' | tail -1; }

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
  m BH "import time
for _ in range(60):
    if '/dashboard' in page_info()['url']: break
    time.sleep(0.25)
print(page_info()['url'])"
  last | grep -q '/dashboard'
}
bh_search() {
  m BH "goto_url('$APP/inscricoes'); wait_for_load(); wait_for_element('input[placeholder^=Buscar]')"
  m BH "fill_input('input[placeholder^=Buscar]', '$QUERY')
n = next(n for n in cdp('Accessibility.getFullAXTree')['nodes'] if n.get('role',{}).get('value')=='button' and n.get('name',{}).get('value')=='Pesquisar')
q = cdp('DOM.getBoxModel', backendNodeId=n['backendDOMNodeId'])['model']['content']
click_at_xy(sum(q[0::2])/4, sum(q[1::2])/4)"
  m BH "import time
for _ in range(80):
    if ' empresa' in js('document.body.innerText'): break
    time.sleep(0.25)
$BH_AX"
  last | grep -oE "$RE_INSC" | sort -u > found.txt
}
bh_read() { m BH "goto_url('$APP/dashboard'); wait_for_load(); wait_for_element('main h1')
$BH_AX"; READ_FULL=$(last | wc -c); READ_INT=$READ_FULL; }
bh_screenshot() { rm -f shot.png; m BH "goto_url('$APP/debitos'); wait_for_load(); wait_for_network_idle(); capture_screenshot(r'$(cygpath -w "$PWD/shot.png")')"; [ "$(pngw shot.png)" -gt 0 ]; }
bh_console() { MARK="BENCH-$RANDOM"; m BH "cdp('Runtime.enable'); drain_events(); js(\"console.error('$MARK')\"); import time; time.sleep(0.3)
print([e for e in drain_events() if 'consoleAPICalled' in str(e.get('method',''))][-1:])"; last | grep -q "$MARK"; }
bh_mobile() { rm -f shot.png; m BH "cdp('Emulation.setDeviceMetricsOverride', width=390, height=844, deviceScaleFactor=1, mobile=True); goto_url('$APP/guias'); wait_for_load(); wait_for_network_idle(); capture_screenshot(r'$(cygpath -w "$PWD/shot.png")'); cdp('Emulation.clearDeviceMetricsOverride')"; W=$(pngw shot.png); [ "$W" -eq 390 ] || [ "$W" -eq 780 ]; }
bh_h1() { m BH "goto_url('$APP$1'); wait_for_load(); wait_for_element('main h1'); print(js(\"document.querySelector('main h1').innerText\"))"; last | tail -1; }

# ---------------------------------------------------------------- common tasks
t_login() { node cdp.mjs logout >/dev/null; ${TOOL}_login; }
t_search() { : > found.txt; ${TOOL}_search; diff -q <(cut -d'|' -f1 ground-truth/search.txt) found.txt >/dev/null; }
t_read() { ${TOOL}_read; }
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

# setup outside the measurement: clean tab, tool daemon restarted, one warm-up pass
node cdp.mjs reset >/dev/null
case "$TOOL" in
  axi) chrome-devtools-axi stop >/dev/null 2>&1 ;;
  surf) surf session.close bench >/dev/null 2>&1; surf session.ensure bench about:blank >/dev/null 2>&1 ;;
  pw) rm -f pw-session.txt ;;
  bh) browser-harness <<< "new_tab('about:blank'); activate_tab(current_tab())" >/dev/null 2>&1 ;;
esac
OUT_REAL="$OUT"; OUT=/dev/null
for t in $TASKS; do CMDS=0; CHARS=0; t_$t >/dev/null 2>&1 || echo "warm-up: $t failed" >&2; done
OUT="$OUT_REAL"

for i in $(seq 1 "$N"); do
  for t in $TASKS; do
    CMDS=0; CHARS=0; DETAIL=""; READ_FULL=0; READ_INT=0
    t0=$(now); if t_$t; then ok=true; else ok=false; fi; t1=$(now)
    [ "$t" = search ] && DETAIL="$(wc -l < found.txt | tr -d ' ')/7 found"
    [ "$t" = read ] && DETAIL="snapshot=$READ_FULL interactive=$READ_INT"
    line=$(printf '{"tool":"%s","task":"%s","iter":%d,"ms":%d,"cmds":%d,"chars":%d,"ok":%s,"detail":"%s"}' \
      "$TOOL" "$t" "$i" $(((t1 - t0) / 1000000)) "$CMDS" "$CHARS" "$ok" "$DETAIL")
    echo "$line" | tee -a "$OUT"
    [ "$ok" = false ] && { echo "--- last output ($t):" >&2; last | mask | tail -8 >&2; }
  done
done
rm -f "$LAST"
