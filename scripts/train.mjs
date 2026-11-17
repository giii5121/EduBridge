import { spawnSync } from 'node:child_process';
import { pythonBin, mlRoot, root } from './python.mjs';
const exported = spawnSync(process.execPath, ['scripts/export-instrument.mjs'], {
  cwd: root,
  stdio: 'inherit',
});
if (exported.status !== 0) process.exit(exported.status ?? 1);
const trained = spawnSync(pythonBin(), ['scripts/train_edubridge.py'], {
  cwd: mlRoot,
  stdio: 'inherit',
});
process.exitCode = trained.status ?? 1;
