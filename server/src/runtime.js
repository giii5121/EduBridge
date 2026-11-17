import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

export function validateRuntime(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const errors = [];
  let origin;
  try {
    origin = new URL(env.APP_ORIGIN);
  } catch {}
  if (!origin || origin.protocol !== 'https:' || origin.origin !== env.APP_ORIGIN)
    errors.push('APP_ORIGIN must be an HTTPS origin without a trailing slash');
  if ((env.AI_SERVICE_KEY?.length ?? 0) < 32)
    errors.push('AI_SERVICE_KEY must contain at least 32 characters');
  if (!env.DATABASE_PATH) errors.push('DATABASE_PATH must point to persistent storage');
  if (env.SEED_DEMO === 'true' && env.ALLOW_DEMO_IN_PRODUCTION !== 'true')
    errors.push('Demo accounts require an explicitly isolated demo deployment');
  if (!existsSync(fileURLToPath(new URL('../../client/dist/index.html', import.meta.url))))
    errors.push('Build the frontend before production startup');
  if (errors.length) throw new Error('Invalid production configuration: ' + errors.join('; '));
}

export function validateProductionDatabase(db, env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  if (
    env.ALLOW_DEMO_IN_PRODUCTION !== 'true' &&
    db.prepare('SELECT id FROM users WHERE demo=1 AND active=1 LIMIT 1').get()
  )
    throw new Error(
      'Active demo accounts exist. Use a clean production database or deactivate demo users.',
    );
  if (!db.prepare("SELECT id FROM users WHERE role='admin' AND active=1 LIMIT 1").get())
    throw new Error('No active administrator. Run npm run setup:admin before production startup.');
}

export async function upgradeDemoDiagnoses(db, modelClient) {
  const rows = db
    .prepare(
      'SELECT a.*,t.data FROM assessments a JOIN users u ON u.id=a.user_id JOIN topics t ON t.id=a.topic_id WHERE u.demo=1 AND a.completed_at IS NOT NULL',
    )
    .all();
  for (const row of rows) {
    const old = JSON.parse(row.diagnosis);
    const questions = JSON.parse(row.questions);
    if (old.provider !== 'pdina-dummy' || questions.length < 15) continue;
    const result = await modelClient.diagnose(
      JSON.parse(row.data),
      questions,
      JSON.parse(row.responses),
      row.user_id,
    );
    db.prepare('UPDATE assessments SET diagnosis=? WHERE id=?').run(
      JSON.stringify({ ...result, demo: true }),
      row.id,
    );
  }
}
