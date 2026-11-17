import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openDatabase, seedDatabase, verifyPassword } from '../src/database.js';
import { progress } from '../src/domain.js';

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'edubridge-test-'));
  const path = join(directory, 'app.sqlite');
  return {
    path,
    cleanup() {
      for (const suffix of ['', '-wal', '-shm'])
        if (existsSync(path + suffix)) unlinkSync(path + suffix);
      rmdirSync(directory);
    },
  };
}

test('SQLite records and calculated progress survive database close and reopen', () => {
  const file = fixture();
  let db;
  try {
    db = openDatabase(file.path);
    seedDatabase(db);
    const student = db.prepare('SELECT * FROM users WHERE id=?').get('student-demo');
    const initial = progress(db, student);
    db.close();
    db = openDatabase(file.path);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 6);
    assert.equal(
      progress(db, db.prepare('SELECT * FROM users WHERE id=?').get(student.id)).xp,
      initial.xp,
    );
    assert.equal(progress(db, student).gapsClosed, initial.gapsClosed);
    seedDatabase(db);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 6);
  } finally {
    db?.close();
    file.cleanup();
  }
});

test('fresh admin setup initializes content without demo users and never overwrites an account', () => {
  const file = fixture();
  let db;
  try {
    const command = fileURLToPath(new URL('../src/setup-admin.js', import.meta.url));
    const env = {
      ...process.env,
      DATABASE_PATH: file.path,
      ADMIN_NAME: 'Admin Sekolah',
      ADMIN_EMAIL: 'admin-sekolah@example.id',
      ADMIN_PASSWORD: 'FreshAdmin123!',
    };
    const result = spawnSync(process.execPath, [command], { env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    db = openDatabase(file.path);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM topics').get().n, 6);
    const admin = db.prepare('SELECT * FROM users').get();
    assert.equal(admin.role, 'admin');
    assert.equal(admin.demo, 0);
    assert.equal(verifyPassword('FreshAdmin123!', admin.password_hash), true);
    db.close();
    db = null;
    const duplicate = spawnSync(process.execPath, [command], {
      env: { ...env, ADMIN_PASSWORD: 'Different123!' },
      encoding: 'utf8',
    });
    assert.equal(duplicate.status, 1);
    db = openDatabase(file.path);
    assert.equal(
      verifyPassword('FreshAdmin123!', db.prepare('SELECT * FROM users').get().password_hash),
      true,
    );
  } finally {
    db?.close();
    file.cleanup();
  }
});

test('operator backup restores consistent progress and password recovery revokes all sessions', () => {
  const source = fixture(),
    target = fixture();
  let db, restored;
  try {
    db = openDatabase(source.path);
    seedDatabase(db);
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(
      'test-session',
      'student-demo',
      new Date(Date.now() + 60000).toISOString(),
    );
    const backupScript = fileURLToPath(new URL('../src/backup.js', import.meta.url));
    const backup = spawnSync(process.execPath, [backupScript], {
      env: { ...process.env, DATABASE_PATH: source.path, BACKUP_PATH: target.path },
      encoding: 'utf8',
    });
    assert.equal(backup.status, 0, backup.stderr);
    restored = openDatabase(target.path);
    assert.equal(
      progress(restored, restored.prepare('SELECT * FROM users WHERE id=?').get('student-demo')).xp,
      260,
    );
    assert.equal(
      restored.prepare('SELECT COUNT(*) AS n FROM assessments').get().n,
      db.prepare('SELECT COUNT(*) AS n FROM assessments').get().n,
    );
    const resetScript = fileURLToPath(new URL('../src/reset-password.js', import.meta.url));
    const reset = spawnSync(process.execPath, [resetScript], {
      env: {
        ...process.env,
        DATABASE_PATH: source.path,
        RESET_EMAIL: 'siswa@edubridge.id',
        RESET_PASSWORD: 'RecoveredPassword123!',
      },
      encoding: 'utf8',
    });
    assert.equal(reset.status, 0, reset.stderr);
    assert.equal(
      verifyPassword(
        'RecoveredPassword123!',
        db.prepare('SELECT password_hash FROM users WHERE id=?').get('student-demo').password_hash,
      ),
      true,
    );
    assert.equal(
      db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id=?').get('student-demo').n,
      0,
    );
    assert.equal(
      db
        .prepare('SELECT COUNT(*) AS n FROM audit_log WHERE action=?')
        .get('password.operator_reset').n,
      1,
    );
    assert.equal(
      verifyPassword(
        'EduBridge123!',
        restored.prepare('SELECT password_hash FROM users WHERE id=?').get('student-demo')
          .password_hash,
      ),
      true,
    );
  } finally {
    restored?.close();
    db?.close();
    target.cleanup();
    source.cleanup();
  }
});
