import { randomUUID, createHash } from 'node:crypto';
import { validLesson, normalizeLesson } from './lessonSchema.js';
import { getTopic, allTopics } from './domain.js';

import { chooseMaterialIcon } from '../../shared/materialIcons.js';
export { chooseMaterialIcon } from '../../shared/materialIcons.js';

export function registerMaterialRoutes({ db, route, readBody, fail, audit, modelClient, aiLimit }) {
  const mutate = (fn) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  const classesFor = (user) =>
    db
      .prepare(
        user.role === 'admin'
          ? 'SELECT id,name FROM classes ORDER BY name'
          : 'SELECT id,name FROM classes WHERE teacher_id=? ORDER BY name',
      )
      .all(...(user.role === 'admin' ? [] : [user.id]));
  const canManage = (user, row) =>
    user.role === 'admin' ||
    (user.role === 'teacher' &&
      row.class_id &&
      db.prepare('SELECT id FROM classes WHERE id=? AND teacher_id=?').get(row.class_id, user.id));
  const visible = (user, row) => {
    if (canManage(user, row)) return true;
    const data = JSON.parse(row.data);
    return (
      data.published &&
      getTopic(db, row.topic_id)?.published &&
      (!row.class_id || (user.role === 'student' && row.class_id === user.class_id))
    );
  };
  const find = (id, user, manage = false) => {
    const row = db.prepare('SELECT * FROM materials WHERE id=? AND deleted_at IS NULL').get(id);
    fail(
      !row || !(manage ? canManage(user, row) : visible(user, row)),
      404,
      'Materi tidak ditemukan atau tidak dapat diakses.',
    );
    return row;
  };
  const view = (row, user, detail = false) => {
    const { blocks, ...data } = JSON.parse(row.data);
    if (data.review && !canManage(user, row)) {
      const { reviewerName, reviewerRole, reviewedAt } = data.review;
      data.review = { reviewerName, reviewerRole, reviewedAt };
    }
    return {
      id: row.id,
      ...data,
      ...(detail ? { blocks } : {}),
      topicId: row.topic_id,
      topicTitle: getTopic(db, row.topic_id)?.title,
      classId: row.class_id,
      className: row.class_id
        ? db.prepare('SELECT name FROM classes WHERE id=?').get(row.class_id)?.name
        : 'Semua kelas',
      canManage: Boolean(canManage(user, row)),
      version: row.revision,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sectionCount: blocks.length,
    };
  };
  const normalize = (body, user, previous = {}) => {
    const text = (v, min, max) =>
      typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
    fail(
      !text(body.title, 3, 100) ||
        !text(body.summary, 10, 500) ||
        !Number.isInteger(body.minutes) ||
        body.minutes < 1 ||
        body.minutes > 180 ||
        typeof body.published !== 'boolean',
      400,
      'Isi judul, deskripsi, durasi, dan status materi dengan benar.',
    );
    fail(
      typeof body.topicId !== 'string' || !getTopic(db, body.topicId)?.published,
      400,
      'Pilih topik asesmen yang tersedia.',
    );
    fail(
      body.classId !== null &&
        (typeof body.classId !== 'string' || !classesFor(user).some((c) => c.id === body.classId)),
      403,
      'Pilih kelas yang berada dalam pengelolaan Anda.',
    );
    fail(
      user.role !== 'admin' && body.classId === null,
      403,
      'Guru hanya dapat menerbitkan materi untuk kelasnya.',
    );
    fail(
      !Array.isArray(body.blocks) ||
        body.blocks.length < 1 ||
        body.blocks.length > 12 ||
        body.blocks.some((b) => !validLesson(b)),
      400,
      'Materi memerlukan 1–12 bagian dengan penjelasan dan contoh yang lengkap.',
    );
    const blocks = body.blocks.map(normalizeLesson);
    fail(
      blocks.reduce((sum, b) => sum + JSON.stringify(b).length, 0) > 60000,
      400,
      'Materi terlalu panjang.',
    );
    const content = {
      title: body.title.trim(),
      summary: body.summary.trim(),
      minutes: body.minutes,
      published: body.published,
      blocks,
      ...chooseMaterialIcon(body.title, body.topicId),
    };
    const contentHash = createHash('sha256')
      .update(
        JSON.stringify({
          title: content.title,
          summary: content.summary,
          minutes: content.minutes,
          blocks: content.blocks,
          topicId: body.topicId,
          classId: body.classId,
        }),
      )
      .digest('hex');
    const review =
      body.reviewConfirmed === true
        ? {
            contentHash,
            reviewerId: user.id,
            reviewerName: user.name,
            reviewerRole: user.role,
            reviewedAt: new Date().toISOString(),
          }
        : body.reviewConfirmed === false
          ? null
          : previous.review?.contentHash === contentHash
            ? previous.review
            : null;
    fail(
      body.published && !review,
      422,
      'Tinjau kebenaran materi dan konfirmasi validasi sebelum menerbitkan. Perubahan isi memerlukan validasi ulang.',
    );
    return {
      ...content,
      aiGenerated: body.aiGenerated === true || previous.aiGenerated === true,
      review,
    };
  };
  route('GET', '/api/materials', [], ({ user }) => ({
    materials: db
      .prepare(
        'SELECT * FROM materials WHERE deleted_at IS NULL ORDER BY updated_at DESC,rowid DESC',
      )
      .all()
      .filter((row) => visible(user, row))
      .map((row) => view(row, user)),
    classes: user.role === 'student' ? [] : classesFor(user),
    topics: allTopics(db)
      .filter((t) => t.published)
      .map(({ id, title }) => ({ id, title })),
  }));
  route('GET', '/api/materials/([^/]+)', [], ({ params, user }) => ({
    material: view(find(params[0], user), user, true),
  }));
  route('POST', '/api/materials/generate', ['teacher', 'admin'], async ({ req, user }) => {
    const body = await readBody(req);
    const topic = typeof body.topicId === 'string' ? getTopic(db, body.topicId) : null;
    fail(!topic?.published, 400, 'Pilih topik asesmen yang tersedia.');
    fail(
      body.classId !== null && !classesFor(user).some((c) => c.id === body.classId),
      403,
      'Pilih kelas yang Anda kelola.',
    );
    fail(
      user.role !== 'admin' && body.classId === null,
      403,
      'Guru hanya dapat membuat materi kelasnya.',
    );
    fail(
      !Number.isInteger(body.blockCount) ||
        body.blockCount < 1 ||
        body.blockCount > 6 ||
        typeof body.title !== 'string' ||
        body.title.length > 100 ||
        typeof body.sectionTitle !== 'string' ||
        body.sectionTitle.length > 100 ||
        typeof body.instructions !== 'string' ||
        body.instructions.length > 1000,
      400,
      'Isi arahan dan jumlah bagian (1–6) dengan benar.',
    );
    aiLimit(user);
    let result;
    try {
      result = await modelClient.generateMaterial(topic, body);
    } catch {
      fail(
        true,
        503,
        'Generator AI belum tersedia atau responsnya belum lengkap. Coba lagi; isi editor Anda tidak berubah.',
      );
    }
    fail(
      result?.provider !== 'gemini' ||
        result?.requiresReview !== true ||
        result?.status !== 'draft' ||
        typeof result?.model !== 'string' ||
        result.model.length > 100 ||
        !result.draft,
      502,
      'Draf AI belum valid. Silakan coba lagi.',
    );
    let draft;
    try {
      draft = normalize(
        {
          ...result.draft,
          topicId: body.topicId,
          classId: body.classId,
          published: false,
          reviewConfirmed: false,
          aiGenerated: true,
        },
        user,
      );
    } catch {
      fail(
        true,
        502,
        'Draf AI belum lengkap atau belum sesuai format. Coba kembali dengan bagian yang lebih sedikit.',
      );
    }
    audit(user.id, 'material.generated', topic.id);
    return {
      draft,
      provider: result.provider,
      model: result.model,
      status: 'draft',
      requiresReview: true,
    };
  });
  route('POST', '/api/materials', ['teacher', 'admin'], async ({ req, user }) => {
    const body = await readBody(req),
      data = normalize(body, user),
      id = randomUUID(),
      date = new Date().toISOString();
    return mutate(() => {
      db.prepare(
        'INSERT INTO materials(id,owner_id,class_id,topic_id,data,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
      ).run(id, user.id, body.classId, body.topicId, JSON.stringify(data), date, date);
      audit(user.id, 'material.created', id);
      return { material: view(find(id, user), user, true) };
    });
  });
  route('PATCH', '/api/materials/([^/]+)', ['teacher', 'admin'], async ({ req, params, user }) => {
    const body = await readBody(req);
    return mutate(() => {
      const row = find(params[0], user, true),
        data = normalize(body, user, JSON.parse(row.data));
      fail(
        !Number.isInteger(body.version) || body.version !== row.revision,
        409,
        'Materi telah diperbarui. Muat ulang agar perubahan tidak tertimpa.',
      );
      db.prepare(
        'UPDATE materials SET class_id=?,topic_id=?,data=?,updated_at=?,revision=revision+1 WHERE id=?',
      ).run(body.classId, body.topicId, JSON.stringify(data), new Date().toISOString(), row.id);
      audit(user.id, 'material.updated', row.id);
      return { material: view(find(row.id, user), user, true) };
    });
  });
  route('DELETE', '/api/materials/([^/]+)', ['teacher', 'admin'], async ({ req, params, user }) => {
    const body = await readBody(req);
    return mutate(() => {
      const row = find(params[0], user, true);
      fail(
        !Number.isInteger(body.version) || body.version !== row.revision,
        409,
        'Materi telah berubah. Muat ulang sebelum menghapus.',
      );
      db.prepare('UPDATE materials SET deleted_at=?,revision=revision+1 WHERE id=?').run(
        new Date().toISOString(),
        row.id,
      );
      audit(user.id, 'material.deleted', row.id);
      return { ok: true };
    });
  });
}
