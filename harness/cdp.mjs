// Neutral benchmark controller: speaks raw CDP to the dedicated Chrome (BENCH_CDP_PORT, default 9444),
// without going through any of the measured tools.
//   node cdp.mjs reset            closes every tab and leaves one active about:blank
//   node cdp.mjs logout           clears cookies and the storage of BENCH_APP
//   node cdp.mjs ground-truth-h1  h1 of each authenticated route (must be logged in)
const BASE = `http://127.0.0.1:${process.env.BENCH_CDP_PORT ?? "9444"}`;
const APP = process.env.BENCH_APP ?? "http://localhost:3100";

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id).ok(d); pending.delete(d.id); }
  };
  ws.onclose = () => {
    for (const { fail } of pending.values()) fail(new Error(`CDP connection to ${wsUrl} closed (did Chrome exit?)`));
    pending.clear();
  };
  const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
    id += 1; pending.set(id, { ok, fail });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  return { ws, send };
}

const browserWs = async () => (await (await fetch(`${BASE}/json/version`)).json()).webSocketDebuggerUrl;
const pages = async () => (await (await fetch(`${BASE}/json/list`)).json()).filter((t) => t.type === "page");

async function reset() {
  const fresh = await (await fetch(`${BASE}/json/new?about:blank`, { method: "PUT" })).json();
  for (const p of await pages()) if (p.id !== fresh.id) await fetch(`${BASE}/json/close/${p.id}`);
  // a background tab drops input events for some tools, so the one tab left is brought to the front
  const activated = await fetch(`${BASE}/json/activate/${fresh.id}`);
  if (!activated.ok) throw new Error(`reset: could not activate tab ${fresh.id}: HTTP ${activated.status}`);
  console.log("reset: 1 active about:blank tab");
}

async function logout() {
  const { ws, send } = await connect(await browserWs());
  await send("Storage.clearCookies");
  await send("Storage.clearDataForOrigin", { origin: APP, storageTypes: "local_storage,session_storage,indexeddb,cache_storage" });
  ws.close();
  console.log("logout: cookies and storage cleared");
}

async function groundTruthH1(routes) {
  const { ws, send } = await connect(await browserWs());
  const { targetId } = (await send("Target.createTarget", { url: "about:blank" })).result;
  const { sessionId } = (await send("Target.attachToTarget", { targetId, flatten: true })).result;
  const out = {};
  for (const r of routes) {
    await send("Page.navigate", { url: APP + r }, sessionId);
    let h1 = null;
    for (let i = 0; i < 60 && !h1; i += 1) {
      await new Promise((ok) => setTimeout(ok, 250));
      const v = await send("Runtime.evaluate", { expression: "document.querySelector('main h1')?.innerText ?? null", returnByValue: true }, sessionId);
      h1 = v.result?.result?.value ?? null;
    }
    out[r] = h1;
  }
  await send("Target.closeTarget", { targetId });
  ws.close();
  console.log(JSON.stringify(out, null, 1));
}

// visible text lines of a route's <main>: the ground truth for read coverage
async function groundTruthText(route) {
  const { ws, send } = await connect(await browserWs());
  const { targetId } = (await send("Target.createTarget", { url: APP + route })).result;
  const { sessionId } = (await send("Target.attachToTarget", { targetId, flatten: true })).result;
  let txt = "";
  for (let i = 0; i < 60; i += 1) {
    await new Promise((ok) => setTimeout(ok, 500));
    const v = await send("Runtime.evaluate", { expression: "document.querySelector('main h1') && document.querySelector('main').innerText", returnByValue: true }, sessionId);
    const t = v.result?.result?.value;
    if (t && t === txt) break; // stable across two reads
    txt = t || "";
  }
  await send("Target.closeTarget", { targetId });
  ws.close();
  const lines = [...new Set(txt.split("\n").map((l) => l.trim()).filter((l) => l.length >= 2))];
  console.log(lines.join("\n"));
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "ground-truth-text") { await groundTruthText(rest[0]); process.exit(0); }
if (cmd === "reset") await reset();
else if (cmd === "logout") await logout();
else if (cmd === "ground-truth-h1") await groundTruthH1(rest);
else { console.error("usage: reset | logout | ground-truth-h1 <routes...>"); process.exit(2); }
