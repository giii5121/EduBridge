import { randomUUID } from 'node:crypto';
import { openDatabase, seedContent, hashPasswordAsync } from './database.js';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || 'Administrator EduBridge';
if (
  !email ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
  email.length > 254 ||
  !password ||
  password.length < 12 ||
  password.length > 128 ||
  name.length < 2 ||
  name.length > 80
) {
  console.error(
    'Isi ADMIN_EMAIL, ADMIN_PASSWORD (12–128 karakter), dan ADMIN_NAME pada server/.env.',
  );
  process.exit(1);
}
const db = openDatabase();
try {
  if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) {
    throw new Error('Email sudah digunakan. Akun yang ada tidak diubah.');
  }
  seedContent(db);
  db.prepare(
    'INSERT INTO users(id,email,password_hash,name,role,created_at) VALUES(?,?,?,?,?,?)',
  ).run(
    randomUUID(),
    email,
    await hashPasswordAsync(password),
    name,
    'admin',
    new Date().toISOString(),
  );
  console.log('Akun administrator berhasil dibuat. Masuk melalui halaman login.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
