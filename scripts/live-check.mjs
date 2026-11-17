// Opt-in live check of the Gemini path through FastAPI (tutor + student/teacher narratives).
// Makes 3 paid provider calls, so it does nothing without --confirm. Uses synthetic data only,
// never prints or stores secrets, and records results in snapshots/live-verification.json.
//   node scripts/live-check.mjs            → dry run: shows readiness, no provider calls
//   node scripts/live-check.mjs --confirm  → performs the 3 live calls and writes the record
// Narrative results may come from the service cache when the same synthetic input was already
// generated; `meta.cache_hit` in the record states this, so a cached answer is not re-billed.
import { readFileSync, writeFileSync } from 'node:fs';

process.loadEnvFile('server/.env');
const base = (process.env.AI_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const secrets = [process.env.GEMINI_API_KEY, process.env.AI_SERVICE_KEY].filter(Boolean);
const headers = { 'content-type': 'application/json' };
if (process.env.AI_SERVICE_KEY) headers['x-service-key'] = process.env.AI_SERVICE_KEY;
const confirm = process.argv.includes('--confirm');
const status = {
  aiBaseUrl: base,
  llmEnabled: process.env.LLM_ENABLED === 'true',
  geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
  model: process.env.GEMINI_MODEL || '(default)',
};
const ready = await fetch(base + '/ready', { headers, signal: AbortSignal.timeout(5000) })
  .then((r) => r.status)
  .catch(() => 'unreachable');
console.log(JSON.stringify({ ...status, ready }, null, 2));
if (!confirm) {
  console.log('Dry run only. Add --confirm to make 3 live Gemini calls (tutor, student, teacher).');
  process.exit(ready === 200 ? 0 : 1);
}
if (ready !== 200 || !status.llmEnabled || !status.geminiKeyConfigured)
  throw new Error('FastAPI must be ready with LLM_ENABLED=true and a Gemini key in server/.env.');

// Synthetic response pattern from the documented diagnosis contract.
const diagnosis = JSON.parse(readFileSync('snapshots/api-contracts.json', 'utf8')).diagnosis.request;
async function call(path, body) {
  const started = performance.now();
  const response = await fetch(base + path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });
  const json = await response.json();
  return {
    http: response.status,
    seconds: Math.round((performance.now() - started) / 10) / 100,
    fallback: json.fallback ?? null,
    provider: json.provider ?? null,
    validation: json.validation ?? null,
    meta: json.meta ?? null,
    text: json.message ?? json.text ?? json.detail ?? null,
  };
}
const record = {
  tutor: await call('/v1/tutor', {
    topic_id: 'fungsi',
    message: 'Jelaskan komposisi fungsi (f ∘ g)(x) dengan satu contoh dan langkah singkat.',
    history: [],
  }),
  student_narrative: await call('/v1/narrative', { ...diagnosis, audience: 'student' }),
  teacher_narrative: await call('/v1/narrative', { ...diagnosis, audience: 'teacher' }),
};
const serialized = JSON.stringify(record, null, 2);
for (const secret of secrets)
  if (serialized.includes(secret)) throw new Error('Secret detected in live record; not written.');
writeFileSync('snapshots/live-verification.json', serialized + '\n');
for (const [name, r] of Object.entries(record))
  console.log(
    `${name}: HTTP ${r.http} · ${r.seconds}s · fallback=${r.fallback}` +
      (r.validation ? ` · validator ${r.validation.ok ? 'ok' : 'gagal'}` : '') +
      (r.meta?.cache_hit ? ' · cache' : ''),
  );
const ok = Object.values(record).every((r) => r.http === 200 && r.fallback === false && (!r.validation || r.validation.ok));
process.exitCode = ok ? 0 : 1;
