import { openDatabase, seedContent, seedDatabase } from './database.js';
import { createApp } from './app.js';
import { createModelClient } from './modelClient.js';
import { validateRuntime, validateProductionDatabase, upgradeDemoDiagnoses } from './runtime.js';
validateRuntime();
const db = openDatabase();
seedContent(db);
const production = process.env.NODE_ENV === 'production';
const demoEnabled =
  process.env.SEED_DEMO === 'true' || (!production && process.env.SEED_DEMO !== 'false');
if (demoEnabled) seedDatabase(db);
try {
  validateProductionDatabase(db);
} catch (error) {
  db.close();
  throw error;
}
const modelClient = createModelClient();
try {
  await modelClient.status();
  if (demoEnabled) await upgradeDemoDiagnoses(db, modelClient);
} catch (error) {
  if (production) {
    db.close();
    throw error;
  }
  console.warn(
    'PDINA service is offline. Saved answers are retained until inference is available.',
  );
}
const server = createApp(db, { modelClient });
const port = Number(process.env.PORT || 4000);
server.listen(port, process.env.HOST || '127.0.0.1', () =>
  console.log(`EduBridge API listening on port ${port}`),
);
let closing = false;
function stop() {
  if (closing) return;
  closing = true;
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
