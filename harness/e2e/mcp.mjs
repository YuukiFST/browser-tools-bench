// Minimal MCP stdio client.
import { spawn } from 'node:child_process';

export async function startMcp(command, args, { env = process.env, cwd } = {}) {
  const child = spawn(command, args, { env, cwd, stdio: ['pipe', 'pipe', 'ignore'] });
  let lastId = 0;
  let buffered = '';
  const pending = new Map();
  child.stdout.on('data', chunk => {
    buffered += chunk;
    const lines = buffered.split('\n');
    buffered = lines.pop();
    for (const line of lines.filter(text => text.trim().startsWith('{'))) {
      const message = JSON.parse(line);
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
  });
  child.on('close', code => { for (const settle of pending.values()) settle({ error: { message: `MCP server exited with ${code}` } }); });
  const write = message => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
  const request = async (method, params) => {
    const id = ++lastId;
    const answer = new Promise(resolve => pending.set(id, resolve));
    write({ id, method, params });
    const { result, error } = await answer;
    if (error) throw new Error(`${method}: ${error.message}`);
    return result;
  };
  // Claude Code's client name: browse picks its tool surface by it.
  const { instructions = '', serverInfo } = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude-code', version: '2.1.317' } });
  write({ method: 'notifications/initialized' });
  const { tools } = await request('tools/list', {});
  return {
    instructions, serverInfo, tools, pid: child.pid,
    call: async (name, args) => {
      const { content = [], isError = false } = await request('tools/call', { name, arguments: args });
      return { text: content.map(part => part.text ?? `[${part.type}]`).join('\n'), isError };
    },
    stop: () => new Promise(resolve => { child.once('close', resolve); child.stdin.end(); setTimeout(() => child.kill(), 2000).unref(); }),
  };
}
