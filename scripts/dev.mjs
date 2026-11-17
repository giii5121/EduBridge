import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const children = [
  spawn(process.execPath, ['--watch', '--env-file-if-exists=.env', 'src/index.js'], {
    cwd: `${root}/server`,
    stdio: 'inherit',
  }),
  spawn(process.execPath, [`${root}/node_modules/vite/bin/vite.js`, '--host', '127.0.0.1'], {
    cwd: `${root}/client`,
    stdio: 'inherit',
  }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill());
  process.exitCode = code;
}
for (const child of children) {
  child.on('error', (error) => {
    console.error(error);
    stop(1);
  });
  child.on('exit', (code) => stop(code ?? 0));
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
