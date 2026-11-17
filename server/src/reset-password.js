import { randomUUID } from 'node:crypto';
import { openDatabase, hashPasswordAsync } from './database.js';
const email = process.env.RESET_EMAIL?.trim().toLowerCase();
const password = process.env.RESET_PASSWORD;
if (!email || !password || password.length < 12 || password.length > 128)
  throw new Error(
    'Set RESET_EMAIL and RESET_PASSWORD (12–128 characters) in the server environment.',
  );
const db = openDatabase();
try {
  const user = db.prepare('SELECT id FROM users WHERE email=?').get(email);
  if (!user) throw new Error('Account not found. No changes made.');
  const hash = await hashPasswordAsync(password);
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, user.id);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
    db.prepare('INSERT INTO audit_log VALUES(?,?,?,?,?)').run(
      randomUUID(),
      null,
      'password.operator_reset',
      user.id,
      new Date().toISOString(),
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  console.log('Password reset completed. All account sessions were revoked.');
} finally {
  db.close();
}
