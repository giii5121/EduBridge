import { createHash } from 'node:crypto';

export const itemHash = (q) =>
  createHash('sha256')
    .update(JSON.stringify([q.text, q.options, q.answer, q.attributes]))
    .digest('hex');
export class ModelUnavailableError extends Error {
  constructor(
    message = 'Layanan diagnosis belum tersedia. Jawaban Anda sudah tersimpan; coba kumpulkan kembali sebentar lagi.',
  ) {
    super(message);
    this.status = 503;
  }
}
export function createModelClient({
  baseUrl = process.env.AI_BASE_URL || 'http://127.0.0.1:8000',
  key = process.env.AI_SERVICE_KEY || '',
  fetcher = fetch,
} = {}) {
  const url = new URL(baseUrl);
  const llmTimeout = Math.min(
    90000,
    Math.max(25000, Number(process.env.GEMINI_TIMEOUT_SECONDS || 20) * 1000 + 5000),
  );
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Invalid AI_BASE_URL');
  let activeFast = 0;
  const waitingFast = [];
  const releaseFast = () => {
    const next = waitingFast.shift();
    if (next) next();
    else activeFast--;
  };
  const acquireFast = () =>
    new Promise((resolve, reject) => {
      const grant = () => resolve(releaseFast);
      if (activeFast < 4) {
        activeFast++;
        grant();
      } else if (waitingFast.length < 128) waitingFast.push(grant);
      else reject(new Error('inference_queue_full'));
    });
  async function call(path, body, timeout = 10000) {
    let release;
    try {
      const endpoint = new URL(url);
      endpoint.pathname = url.pathname.replace(/\/$/, '') + path;
      const signal = AbortSignal.timeout(timeout);
      const attempts = path === '/v1/diagnose' || path === '/v1/models' ? 3 : 1;
      if (path === '/v1/diagnose') release = await acquireFast();
      signal.throwIfAborted();
      for (let attempt = 0; attempt < attempts; attempt++) {
        const response = await fetcher(endpoint, {
          method: body ? 'POST' : 'GET',
          signal,
          headers: {
            ...(key ? { 'X-Service-Key': key } : {}),
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        if ([429, 503].includes(response.status) && attempt < attempts - 1) {
          await response.arrayBuffer();
          const delay = Math.min(
            2000,
            Math.max(250, Number(response.headers.get('retry-after') || '0') * 1000),
          );
          await new Promise((resolve) => setTimeout(resolve, delay + Math.random() * 100));
          signal.throwIfAborted();
          continue;
        }
        if (!response.ok) throw new Error(`inference_http_${response.status}`);
        return await response.json();
      }
    } catch (error) {
      console.error(JSON.stringify({ event: 'inference_unavailable', kind: error.name, path }));
      throw new ModelUnavailableError();
    } finally {
      release?.();
    }
  }
  const payload = (topic, questions, responses, studentId) => ({
    model_id: 'edubridge',
    topic_id: topic.id,
    student_id: createHash('sha256')
      .update(studentId || 'anonymous')
      .digest('hex')
      .slice(0, 20),
    responses: questions.map((q, i) => ({
      question_id: q.id,
      answer_option: responses[i] ?? null,
      content_hash: itemHash(q),
    })),
  });
  return {
    async generateMaterial(topic, { title, sectionTitle, instructions, blockCount }) {
      return call(
        '/v1/materials/generate',
        {
          topic_id: topic.id,
          title,
          section_title: sectionTitle,
          instructions,
          block_count: blockCount,
          context: {
            title: topic.title,
            attributes: topic.attributes,
            blocks: topic.blocks.map(({ title, body, example }) => ({ title, body, example })),
          },
        },
        85000,
      );
    },
    async diagnose(topic, questions, responses, studentId) {
      const result = await call(
        '/v1/diagnose',
        payload(topic, questions, responses, studentId),
        30000,
      );
      if (
        result.provider !== 'pdina' ||
        !Array.isArray(result.attributes) ||
        result.attributes.length !== topic.attributes.length ||
        result.attributes.some(
          (a, i) =>
            a.id !== i ||
            !['mastered', 'developing', 'gap', 'unknown'].includes(a.status) ||
            (a.mastery !== null &&
              (!Number.isFinite(a.mastery) || a.mastery < 0 || a.mastery > 100)),
        )
      )
        throw new ModelUnavailableError();
      // Score is always determined from the immutable assessment snapshot. Only calibrated evidence enters P-DINA.
      const correctCount = questions.filter((q, i) => responses[i] === q.answer).length;
      return {
        ...result,
        score: Math.round((correctCount / questions.length) * 100),
        correctCount,
        total: questions.length,
      };
    },
    async status() {
      const models = await call('/v1/models');
      if (
        !Array.isArray(models) ||
        !models.some((m) => m.id === 'edubridge' && typeof m.version === 'string')
      )
        throw new ModelUnavailableError();
      return {
        ready: true,
        provider: 'pdina',
        simulated: false,
        models,
        geminiConfigured: undefined,
      };
    },
    async tutor(topic, message, history = []) {
      return call(
        '/v1/tutor',
        {
          topic_id: topic.id,
          message,
          history,
          lesson: {
            title: topic.title,
            blocks: topic.blocks.map(({ title, body, example }) => ({ title, body, example })),
          },
        },
        llmTimeout,
      );
    },
    async narrative(topic, questions, responses, studentId, audience = 'student', expectedVersion) {
      return call(
        '/v1/narrative',
        {
          ...payload(topic, questions, responses, studentId),
          audience,
          expected_model_version: expectedVersion,
        },
        llmTimeout,
      );
    },
    async classNarrative(topic, records) {
      return call(
        '/v1/class-narrative',
        {
          topic_id: topic.id,
          expected_model_version: JSON.parse(records[0].diagnosis).version,
          students: records.map((row) => {
            const p = payload(
              topic,
              JSON.parse(row.questions),
              JSON.parse(row.responses),
              row.user_id,
            );
            return { student_id: p.student_id, responses: p.responses };
          }),
        },
        llmTimeout + 3000,
      );
    },
  };
}
