import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { root, runPython } from './python.mjs';
const envFile = join(root, 'server', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const children = [];
let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill());
  process.exitCode = code;
};
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
function track(child) {
  children.push(child);
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code ?? 1);
  });
  return child;
}
track(runPython(['-m', 'web.run']));
const url = process.env.AI_BASE_URL || `http://127.0.0.1:${process.env.AI_PORT || 8000}`;
process.env.AI_BASE_URL = url;
let ready = false;
for (let i = 0; i < 150 && !stopping; i++) {
  try {
    if ((await fetch(url + '/ready', { signal: AbortSignal.timeout(500) })).ok) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 200));
}
if (!ready) {
  console.error('PDINA failed to start. Check Python dependencies and model artifacts.');
  stop(1);
} else {
  const dev = process.argv.includes('--dev');
  track(
    spawn(
      process.execPath,
      [...(dev ? ['--watch'] : []), '--env-file-if-exists=.env', 'src/index.js'],
      { cwd: join(root, 'server'), stdio: 'inherit' },
    ),
  );
  if (dev)
    track(
      spawn(
        process.execPath,
        [join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1'],
        { cwd: join(root, 'client'), stdio: 'inherit' },
      ),
    );
}
