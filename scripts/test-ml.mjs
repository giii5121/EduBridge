import { runPython } from './python.mjs';
const child = runPython(['-m', 'pytest', 'tests', 'web/tests', '-q'], {
  env: { ...process.env, LLM_ENABLED: 'false', GEMINI_API_KEY: '' },
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
