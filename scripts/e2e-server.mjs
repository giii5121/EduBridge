import { openDatabase, seedDatabase } from '../server/src/database.js';
import { createApp } from '../server/src/app.js';
const db = openDatabase(':memory:');
seedDatabase(db);
const server = createApp(db);
server.listen(4173, '127.0.0.1', () =>
  console.log('Isolated browser test server on http://127.0.0.1:4173'),
);
process.on('SIGTERM', () =>
  server.close(() => {
    db.close();
    process.exit(0);
  }),
);
