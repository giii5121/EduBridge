import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const mlRoot = fileURLToPath(new URL('../server/ml/', import.meta.url));
export function pythonBin() {
  const local = fileURLToPath(
    new URL(
      process.platform === 'win32'
        ? '../server/.venv/Scripts/python.exe'
        : '../server/.venv/bin/python',
      import.meta.url,
    ),
  );
  const bin =
    process.env.PYTHON_BIN ||
    (existsSync(local) ? local : process.platform === 'win32' ? 'python' : 'python3');
  return bin;
}
export const runPython = (args, options = {}) =>
  spawn(pythonBin(), args, { cwd: mlRoot, stdio: 'inherit', ...options });
