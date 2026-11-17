import { compareDiagnoses } from './diagnosis.js';

export const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  classId: user.class_id,
  school: user.school,
  active: Boolean(user.active),
  reminders: Boolean(user.reminders),
  demo: Boolean(user.demo),
  createdAt: user.created_at,
});
export const allTopics = (db) =>
  db
    .prepare('SELECT data FROM topics')
    .all()
    .map((row) => JSON.parse(row.data))
    .sort((a, b) => a.order - b.order);
export const getTopic = (db, id) => {
  if (typeof id !== 'string' || id.length > 80) return null;
  const row = db.prepare('SELECT data FROM topics WHERE id=?').get(id);
  return row ? JSON.parse(row.data) : null;
};
export const latestCycle = (db, userId, topicId) =>
  db
    .prepare(
      'SELECT * FROM cycles WHERE user_id=? AND topic_id=? ORDER BY created_at DESC, rowid DESC LIMIT 1',
    )
    .get(userId, topicId);
export const resultFor = (db, cycleId, mode) => {
  if (!cycleId) return null;
  const row = db
    .prepare(
      'SELECT * FROM assessments WHERE cycle_id=? AND mode=? AND completed_at IS NOT NULL ORDER BY completed_at DESC, rowid DESC LIMIT 1',
    )
    .get(cycleId, mode);
  return row
    ? {
        id: row.id,
        mode: row.mode,
        ...JSON.parse(row.diagnosis),
        completedAt: row.completed_at,
        xp: row.xp,
      }
    : null;
};
export function learningState(db, user, topic) {
  const cycle = latestCycle(db, user.id, topic.id);
  const pre = resultFor(db, cycle?.id, 'pretest');
  const post = resultFor(db, cycle?.id, 'posttest');
  const practice = resultFor(db, cycle?.id, 'remedial');
  const phase =
    db
      .prepare('SELECT phase FROM stages WHERE class_id=? AND topic_id=?')
      .get(user.class_id ?? '', topic.id)?.phase ?? 'pretest';
  const status = post
    ? 'completed'
    : !pre
      ? 'pretest'
      : !cycle?.lesson_at
        ? 'learning'
        : phase === 'posttest'
          ? 'posttest'
          : 'waiting';
  return {
    cycleId: cycle?.id ?? null,
    pre,
    post,
    practice,
    lessonAt: cycle?.lesson_at ?? null,
    phase,
    status,
    comparison: compareDiagnoses(pre, post),
  };
}
export function catalog(db, user) {
  return allTopics(db)
    .filter((t) => t.published || user.role !== 'student')
    .map(({ pre, post, ...topic }) => ({
      ...topic,
      questionCount: pre.length,
      state: learningState(db, user, { ...topic, pre, post }),
    }));
}
const dayKey = (date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));
export function progress(db, user) {
  const topics = catalog(db, user);
  const activity = db
    .prepare('SELECT * FROM activity WHERE user_id=? ORDER BY created_at DESC, rowid DESC')
    .all(user.id);
  const attempts = db
    .prepare(
      'SELECT a.*, t.data AS topic_data FROM assessments a JOIN topics t ON t.id=a.topic_id WHERE user_id=? AND completed_at IS NOT NULL ORDER BY completed_at DESC, a.rowid DESC',
    )
    .all(user.id);
  const xp = activity.reduce((sum, a) => sum + a.xp, 0);
  const dates = new Set(activity.map((a) => dayKey(a.created_at)));
  let cursor = new Date();
  if (!dates.has(dayKey(cursor))) cursor = new Date(cursor.getTime() - 86400000);
  let streak = 0;
  while (dates.has(dayKey(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() - (6 - i) * 86400000);
    const key = dayKey(date);
    return {
      date: key,
      day: new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'Asia/Jakarta' }).format(
        date,
      ),
      xp: activity.filter((a) => dayKey(a.created_at) === key).reduce((sum, a) => sum + a.xp, 0),
    };
  });
  const measured = topics.filter((t) => t.state.pre);
  const mastered = measured.reduce(
    (sum, t) =>
      sum + (t.state.post ?? t.state.pre).attributes.filter((a) => a.status === 'mastered').length,
    0,
  );
  const totalAttributes = measured.reduce(
    (sum, t) =>
      sum + (t.state.post ?? t.state.pre).attributes.filter((a) => a.mastery !== null).length,
    0,
  );
  const badges = [
    {
      id: 'first',
      name: 'Langkah pertama',
      description: 'Selesaikan pretest pertamamu.',
      icon: 'flag',
      earned: attempts.some((a) => a.mode === 'pretest'),
    },
    {
      id: 'cycle',
      name: 'Jembatan pertama',
      description: 'Tuntaskan satu siklus pretest sampai posttest.',
      icon: 'bridge',
      earned: topics.some((t) => t.state.post),
    },
    {
      id: 'perfect',
      name: 'Tepat sempurna',
      description: 'Raih nilai 100 pada asesmen.',
      icon: 'star',
      earned: attempts.some((a) => JSON.parse(a.diagnosis).score === 100),
    },
    {
      id: 'gap',
      name: 'Penutup celah',
      description: 'Kuasai atribut yang belum dikuasai saat pretest.',
      icon: 'target',
      earned: topics.some((t) => t.state.comparison?.gapsClosed > 0),
    },
    {
      id: 'streak',
      name: 'Konsisten belajar',
      description: 'Belajar tiga hari berturut-turut.',
      icon: 'flame',
      earned: streak >= 3,
    },
    {
      id: 'explorer',
      name: 'Penjelajah konsep',
      description: 'Selesaikan pretest di semua topik aktif.',
      icon: 'compass',
      earned: topics.length > 0 && topics.every((t) => t.state.pre),
    },
  ];
  return {
    xp,
    level: Math.floor(xp / 500) + 1,
    levelXp: xp % 500,
    nextLevelXp: 500,
    streak,
    week,
    badges,
    completed: topics.filter((t) => t.state.post).length,
    topicCount: topics.length,
    mastered,
    totalAttributes,
    mastery: totalAttributes ? Math.round((mastered / totalAttributes) * 100) : null,
    gapCount: measured.reduce((sum, t) => sum + (t.state.post ?? t.state.pre).gapCount, 0),
    gapsClosed: measured.reduce((sum, t) => sum + (t.state.comparison?.gapsClosed ?? 0), 0),
    todayXp: week.at(-1).xp,
    history: attempts.map((a) => ({
      id: a.id,
      topicId: a.topic_id,
      title: JSON.parse(a.topic_data).title,
      mode: a.mode,
      score: JSON.parse(a.diagnosis).score,
      completedAt: a.completed_at,
      xp: a.xp,
    })),
  };
}
export function classroomData(db, actor, classId) {
  const classroom = db.prepare('SELECT * FROM classes WHERE id=?').get(classId);
  if (!classroom || (actor.role !== 'admin' && classroom.teacher_id !== actor.id)) return null;
  const students = db
    .prepare("SELECT * FROM users WHERE class_id=? AND role='student' AND active=1 ORDER BY name")
    .all(classId);
  const topics = allTopics(db).filter((t) => t.published);
  return {
    ...classroom,
    students: students.map((student) => ({
      ...publicUser(student),
      topics: topics.map((topic) => ({
        id: topic.id,
        title: topic.title,
        state: learningState(db, student, topic),
      })),
    })),
    topics: topics.map((t) => ({
      id: t.id,
      title: t.title,
      attributes: t.attributes,
      phase:
        db.prepare('SELECT phase FROM stages WHERE class_id=? AND topic_id=?').get(classId, t.id)
          ?.phase ?? 'pretest',
    })),
  };
}
