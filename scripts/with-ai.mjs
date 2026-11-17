// All integration tests use a fresh service port, throwaway caches, and no live Gemini calls.
import { createServer } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { runPython, root } from './python.mjs';
const reserved = createServer();
await new Promise((resolve) => reserved.listen(0, '127.0.0.1', resolve));
const port = reserved.address().port;
await new Promise((resolve) => reserved.close(resolve));
const env = {
  ...process.env,
  NODE_ENV: 'test',
  AI_PORT: String(port),
  AI_HOST: '127.0.0.1',
  AI_BASE_URL: `http://127.0.0.1:${port}`,
  AI_SERVICE_KEY: randomBytes(32).toString('hex'),
  LLM_ENABLED: 'false',
  GEMINI_API_KEY: '',
  SEED_DEMO: 'true',
  AI_DATA_DIR: mkdtempSync(join(tmpdir(), 'edubridge-ai-')),
};
const ai = runPython(['-m', 'web.run'], { env });
let child,
  stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  child?.kill();
  ai.kill();
};
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop);
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (ai.exitCode !== null) throw new Error('Isolated inference process exited');
    try {
      if ((await fetch(env.AI_BASE_URL + '/ready', { signal: AbortSignal.timeout(500) })).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('Isolated inference service did not become ready');
  const args = process.argv.slice(2);
  const script =
    args[0] === 'e2e'
      ? ['node_modules/@playwright/test/cli.js', 'test', ...args.slice(1)]
      : ['--test', '--test-concurrency=1', 'server/test/*.test.js'];
  child = spawn(process.execPath, script, { cwd: root, env, stdio: 'inherit' });
  process.exitCode = await new Promise((resolve, reject) => {
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', reject);
  });
} finally {
  stop();
}
