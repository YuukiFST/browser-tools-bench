// Raw CDP, used by the oracle and by the state audit. No measured tool goes through it.
export async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error(`cannot connect to ${wsUrl}`)); });
  let lastId = 0;
  const pending = new Map();
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    if (message.error) call.reject(new Error(message.error.message));
    else call.resolve(message.result);
  };
  ws.onclose = () => { for (const { reject } of pending.values()) reject(new Error('CDP connection closed')); };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    pending.set(++lastId, { resolve, reject });
    ws.send(JSON.stringify({ id: lastId, method, params, ...(sessionId && { sessionId }) }));
  });
  return { send, close: () => ws.close() };
}

export const connectBrowser = async port => connect((await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl);

export async function evaluate(client, sessionId, expression) {
  const { result, exceptionDetails } = await client.send('Runtime.evaluate', { expression, returnByValue: true }, sessionId);
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
}

// What a user can tell from the page after a scenario.
export const pageState = `({
  items: [...document.querySelectorAll('.todo-list li')].map(li => ({ title: li.querySelector('label').textContent, done: li.querySelector('.toggle').checked, editing: li.classList.contains('editing') })),
  counter: document.querySelector('.todo-count')?.textContent ?? null,
  hash: location.hash,
})`;
