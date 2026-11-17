// Documentation-only OpenAPI reference. Route/method/role coverage is checked against source.
import { readFileSync } from 'node:fs';

const text = (min = 1, max = 100) => ({ type: 'string', minLength: min, maxLength: max });
const integer = (minimum, maximum) => ({ type: 'integer', minimum, maximum });
const object = (properties, required = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: true,
});
const array = (items, minItems = 0, maxItems = 100) => ({
  type: 'array',
  items,
  minItems,
  maxItems,
});
const ref = (name) => ({ $ref: '#/components/schemas/' + name });
const boolean = { type: 'boolean' };
const topicId = { ...text(1, 80), example: 'fungsi' };
const answers = array({ type: ['integer', 'null'], minimum: 0, maximum: 3 }, 1, 250);
export const schemas = {
  Error: object({ error: { type: 'string' } }, ['error']),
  Login: object(
    {
      email: { type: 'string', format: 'email' },
      password: { ...text(8, 128), writeOnly: true },
      remember: boolean,
    },
    ['email', 'password'],
  ),
  Registration: object(
    {
      name: text(2, 80),
      email: { type: 'string', format: 'email' },
      password: { ...text(8, 128), writeOnly: true },
      school: text(2, 120),
      classCode: text(1, 80),
      agree: { type: 'boolean', const: true },
    },
    ['name', 'email', 'password', 'school', 'classCode', 'agree'],
  ),
  Profile: object({ name: text(2, 80), school: text(2, 120), reminders: boolean }, [
    'name',
    'school',
    'reminders',
  ]),
  PasswordChange: object(
    {
      current: { type: 'string', writeOnly: true },
      password: { ...text(8, 128), writeOnly: true },
    },
    ['current', 'password'],
  ),
  AssessmentStart: object(
    { topicId, mode: { type: 'string', enum: ['pretest', 'posttest', 'remedial'] } },
    ['topicId', 'mode'],
  ),
  AssessmentResponses: object({ responses: answers }, ['responses']),
  Tutor: object(
    {
      topicId,
      message: text(1, 1000),
      history: array(
        object({ role: { type: 'string', enum: ['user', 'assistant'] }, text: text(1, 2000) }, [
          'role',
          'text',
        ]),
        0,
        6,
      ),
    },
    ['topicId', 'message'],
  ),
  ClassCreate: object(
    {
      name: { ...text(4, 50), description: 'Nama kelas harus diawali XI.' },
      teacherId: text(1, 80),
    },
    ['name'],
  ),
  ClassPhase: object(
    { topicId, phase: { type: 'string', enum: ['pretest', 'learning', 'posttest'] } },
    ['topicId', 'phase'],
  ),
  ClassNarrative: object({ topicId, mode: { type: 'string', enum: ['pretest', 'posttest'] } }, [
    'topicId',
    'mode',
  ]),
  AccountCreate: object(
    {
      name: text(2, 80),
      email: { type: 'string', format: 'email' },
      password: { ...text(8, 128), writeOnly: true },
      role: { type: 'string', enum: ['student', 'teacher', 'admin'] },
      classId: text(1, 80),
    },
    ['name', 'email', 'password', 'role'],
  ),
  AccountStatus: object({ active: boolean }, ['active']),
  Explanation: object({ title: text(3, 100), body: text(5, 3000) }, ['title', 'body']),
  WorkedExample: object(
    { prompt: text(5, 1000), steps: array(text(5, 1000), 2, 8), conclusion: text(5, 1500) },
    ['prompt', 'steps', 'conclusion'],
  ),
  Misconception: object({ mistake: text(5, 1500), correction: text(5, 1500) }, [
    'mistake',
    'correction',
  ]),
  Practice: object(
    { id: text(3, 80), question: text(5, 1500), answer: text(1, 1000), explanation: text(5, 2000) },
    ['id', 'question', 'answer', 'explanation'],
  ),
  LessonBlock: object(
    {
      title: text(3, 100),
      body: text(10, 3000),
      example: text(5, 1000),
      sections: array(ref('Explanation'), 0, 8),
      worked: ref('WorkedExample'),
      misconception: ref('Misconception'),
      practice: array(ref('Practice'), 0, 5),
    },
    ['title', 'body', 'example'],
  ),
  MaterialWrite: object(
    {
      title: text(3, 100),
      summary: text(10, 500),
      minutes: integer(1, 180),
      topicId,
      classId: {
        type: ['string', 'null'],
        description: 'Guru: ID kelas sendiri. Admin: ID kelas atau null untuk umum.',
      },
      published: boolean,
      reviewConfirmed: {
        type: 'boolean',
        description:
          'Konfirmasi peninjauan manusia. Publikasi tanpa peninjauan yang sesuai isi ditolak 422.',
      },
      aiGenerated: boolean,
      version: {
        type: 'integer',
        minimum: 1,
        description: 'Wajib untuk PATCH; diambil dari pembacaan terakhir.',
      },
      blocks: array(ref('LessonBlock'), 1, 12),
    },
    ['title', 'summary', 'minutes', 'topicId', 'classId', 'published', 'blocks'],
  ),
  MaterialGenerate: object(
    {
      topicId,
      classId: { type: ['string', 'null'] },
      title: text(0, 100),
      sectionTitle: text(0, 100),
      instructions: text(0, 1000),
      blockCount: integer(1, 6),
    },
    ['topicId', 'classId', 'title', 'sectionTitle', 'instructions', 'blockCount'],
  ),
  MaterialDelete: object({ version: integer(1) }, ['version']),
  QuestionEdit: object(
    {
      id: text(1, 80),
      text: text(5, 600),
      options: array(text(1, 300), 4, 4),
      answer: integer(0, 3),
      explanation: text(5, 1200),
    },
    ['id', 'text', 'options', 'answer', 'explanation'],
  ),
  TopicEdit: object(
    {
      title: text(3, 100),
      summary: text(5, 300),
      minutes: integer(1, 180),
      published: boolean,
      blocks: array(ref('LessonBlock'), 1, 12),
      pre: array(ref('QuestionEdit'), 1, 250),
      post: array(ref('QuestionEdit'), 1, 250),
    },
    ['title', 'summary', 'minutes', 'published', 'blocks', 'pre', 'post'],
  ),
};

const descriptors = {
  'GET /api/health': ['Health', 'Kesehatan API aplikasi'],
  'GET /api/ready': ['Health', 'Kesiapan database dan layanan diagnosis'],
  'GET /api/config': ['Health', 'Konfigurasi publik aplikasi'],
  'POST /api/auth/login': ['Authentication', 'Masuk dan membuat cookie sesi', 'Login'],
  'POST /api/auth/register': ['Authentication', 'Mendaftarkan siswa ke kelas', 'Registration'],
  'POST /api/auth/logout': ['Authentication', 'Keluar dan mencabut sesi'],
  'GET /api/auth/me': ['Authentication', 'Identitas pengguna yang sedang masuk'],
  'GET /api/bootstrap': ['Learning', 'Data awal, katalog, progres, dan kelas'],
  'PATCH /api/profile': ['Profile', 'Mengubah profil dan preferensi', 'Profile'],
  'POST /api/profile/password': [
    'Profile',
    'Mengganti password dan mencabut sesi lama',
    'PasswordChange',
  ],
  'POST /api/assessments': ['Assessments', 'Memulai atau melanjutkan asesmen', 'AssessmentStart'],
  'GET /api/assessments/{assessmentId}': ['Assessments', 'Membaca asesmen milik siswa'],
  'PATCH /api/assessments/{assessmentId}': [
    'Assessments',
    'Menyimpan jawaban sementara',
    'AssessmentResponses',
  ],
  'POST /api/assessments/{assessmentId}/submit': [
    'Assessments',
    'Mengumpulkan dan mendiagnosis jawaban',
    'AssessmentResponses',
  ],
  'POST /api/assessments/{assessmentId}/narrative': [
    'AI assistance',
    'Ringkasan hasil asesmen dari fakta diagnosis',
  ],
  'POST /api/topics/{topicId}/lesson': [
    'Learning',
    'Menyelesaikan materi dalam siklus pembelajaran',
  ],
  'POST /api/assistant': ['AI assistance', 'Pendamping konsep di luar asesmen aktif', 'Tutor'],
  'GET /api/materials': ['Materials', 'Daftar materi sesuai izin dan kelas'],
  'GET /api/materials/{materialId}': ['Materials', 'Membaca isi materi'],
  'POST /api/materials': ['Materials', 'Membuat materi kelas atau materi umum', 'MaterialWrite'],
  'PATCH /api/materials/{materialId}': [
    'Materials',
    'Mengedit materi dengan pengecekan versi',
    'MaterialWrite',
  ],
  'DELETE /api/materials/{materialId}': [
    'Materials',
    'Menghapus materi secara logis',
    'MaterialDelete',
  ],
  'POST /api/materials/generate': [
    'AI assistance',
    'Menyusun draf AI yang wajib ditinjau manusia',
    'MaterialGenerate',
  ],
  'GET /api/classes': ['Classes', 'Daftar kelas sesuai kepemilikan'],
  'POST /api/classes': ['Classes', 'Membuat kelas XI', 'ClassCreate'],
  'GET /api/classes/{classId}': ['Classes', 'Detail kelas, siswa, dan penguasaan atribut'],
  'PATCH /api/classes/{classId}/phase': [
    'Classes',
    'Mengatur fase pretest, pembelajaran, atau posttest',
    'ClassPhase',
  ],
  'GET /api/classes/{classId}/export': ['Classes', 'Ekspor hasil kelas dalam CSV'],
  'POST /api/classes/{classId}/narrative': [
    'AI assistance',
    'Ringkasan kebutuhan konsep satu kelas',
    'ClassNarrative',
  ],
  'GET /api/admin/overview': [
    'Administration',
    'Pengguna, kelas, materi, audit, dan status layanan',
  ],
  'POST /api/admin/users': [
    'Administration',
    'Membuat akun siswa, guru, atau admin',
    'AccountCreate',
  ],
  'PATCH /api/admin/users/{userId}': [
    'Administration',
    'Mengaktifkan atau menonaktifkan akun',
    'AccountStatus',
  ],
  'PATCH /api/admin/topics/{topicId}': [
    'Administration',
    'Mengedit materi inti dan bank soal terkontrol',
    'TopicEdit',
  ],
};

function canonical(pattern) {
  const parameter = pattern.startsWith('/api/assessments/')
    ? 'assessmentId'
    : pattern.startsWith('/api/admin/users/')
      ? 'userId'
      : pattern.startsWith('/api/classes/')
        ? 'classId'
        : pattern.startsWith('/api/materials/')
          ? 'materialId'
          : 'topicId';
  return pattern.replaceAll('([^/]+)', `{${parameter}}`);
}
export function buildApplicationReference(exchanges = []) {
  const routes = [];
  for (const file of ['server/src/app.js', 'server/src/materials.js']) {
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(
      /route\(\s*'(GET|POST|PATCH|DELETE)'\s*,\s*'([^']+)'\s*,\s*(null|\[[^\]]*\])/g,
    )) {
      routes.push({
        method: m[1],
        path: canonical(m[2]),
        roles: m[3] === 'null' ? null : [...m[3].matchAll(/'([^']+)'/g)].map((role) => role[1]),
        source: file,
      });
    }
  }
  if (routes.length !== Object.keys(descriptors).length)
    throw new Error('API documentation coverage differs from registered routes.');
  const paths = {};
  for (const route of routes) {
    const key = route.method + ' ' + route.path,
      descriptor = descriptors[key];
    if (!descriptor) throw new Error('Undocumented route: ' + key);
    const [tag, summary, requestSchema] = descriptor;
    const samples = exchanges.filter((e) => e.operation === key);
    const parameters = [...route.path.matchAll(/\{([^}]+)\}/g)].map((m) => ({
      name: m[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
      example:
        samples[0]?.parameters?.[m[1]] ??
        (m[1] === 'topicId' ? 'fungsi' : m[1] === 'classId' ? 'class-xi1' : 'demo-id'),
    }));
    const operation = {
      tags: [tag],
      summary,
      operationId: route.method.toLowerCase() + '_' + route.path.replace(/[^a-zA-Z0-9]/g, '_'),
      description: `Akses: ${route.roles === null ? 'publik' : route.roles.length ? route.roles.join(', ') : 'pengguna terautentikasi'}. Kepemilikan kelas/asesmen diperiksa kembali di backend.\n\nReferensi dokumentasi dari \`${route.source}\`; bukan endpoint OpenAPI bawaan server Node. Contoh sensitif disamarkan.`,
      parameters,
      security:
        route.roles === null
          ? []
          : [
              !['GET', 'HEAD'].includes(route.method)
                ? { sessionCookie: [], csrfToken: [] }
                : { sessionCookie: [] },
            ],
      responses: {},
    };
    if (requestSchema) {
      const bodySamples = requestSchema === 'TopicEdit' ? [] : samples.filter((e) => e.requestBody);
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema:
              requestSchema === 'MaterialWrite' && route.method === 'PATCH'
                ? { allOf: [ref(requestSchema), { type: 'object', required: ['version'] }] }
                : ref(requestSchema),
            ...(bodySamples.length
              ? {
                  examples: Object.fromEntries(
                    bodySamples.map((e, i) => [
                      'sample' + i,
                      { summary: e.title, value: e.requestBody },
                    ]),
                  ),
                }
              : {}),
          },
        },
      };
    }
    for (const status of new Set([
      200,
      ...(route.roles === null ? [400, 429] : [400, 401, 403, 404, 409, 422, 429, 503]),
      ...samples.map((e) => e.status),
    ])) {
      const statusSamples = samples.filter((e) => e.status === status);
      operation.responses[status] = {
        description:
          status === 200
            ? 'Berhasil.'
            : status === 401
              ? 'Sesi belum tersedia atau kedaluwarsa.'
              : status === 403
                ? 'Izin, origin, atau CSRF ditolak.'
                : status === 409
                  ? 'Konflik versi, status, atau deadline.'
                  : status === 422
                    ? 'Peninjauan materi belum sesuai isi.'
                    : status === 429
                      ? 'Batas permintaan tercapai.'
                      : status === 503
                        ? 'Layanan AI belum tersedia.'
                        : 'Permintaan ditolak sesuai validasi endpoint.',
        content: {
          [route.path.endsWith('/export') ? 'text/csv' : 'application/json']: {
            schema:
              status === 200
                ? { type: route.path.endsWith('/export') ? 'string' : 'object' }
                : ref('Error'),
            ...(statusSamples.length
              ? {
                  examples: Object.fromEntries(
                    statusSamples.map((e, i) => [
                      'sample' + i,
                      { summary: e.title, value: e.responseBody },
                    ]),
                  ),
                }
              : {}),
          },
        },
      };
    }
    paths[route.path] ??= {};
    paths[route.path][route.method.toLowerCase()] = operation;
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'EduBridge Application API',
      version: '1.0.0',
      description:
        'Referensi 33 endpoint backend Node.js: autentikasi, asesmen, pembelajaran, materi, kelas, dan admin. Sumber route dan peran diverifikasi terhadap kode. Batas kondisional dan kepemilikan tetap mengikuti backend. Contoh respons berasal dari database demo terisolasi; cookie, CSRF, password, service key, dan bank soal privat disamarkan. Dokumentasi ini terpisah dari Swagger FastAPI CDA/CDM.',
    },
    servers: [{ url: 'http://127.0.0.1:4000', description: 'API aplikasi lokal' }],
    tags: [...new Set(Object.values(descriptors).map((d) => d[0]))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'edubridge_session',
          description: 'Cookie HttpOnly dari login. Nilainya tidak disertakan dalam dokumentasi.',
        },
        csrfToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-CSRF-Token',
          description:
            'Token terikat sesi dari header respons API; dibutuhkan untuk operasi perubahan.',
        },
      },
      schemas,
    },
  };
}

export function swaggerPage(spec, { interactive = false } = {}) {
  const json = JSON.stringify(spec).replaceAll('<', '\\u003c');
  return `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${spec.info.title} — Swagger UI</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"><div id="swagger-ui"></div><script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>window.ui=SwaggerUIBundle({spec:${json},dom_id:'#swagger-ui',deepLinking:true,docExpansion:'list',defaultModelsExpandDepth:-1,defaultModelExpandDepth:2,displayRequestDuration:true,withCredentials:true,supportedSubmitMethods:${JSON.stringify(interactive ? ['get', 'post', 'patch', 'delete'] : [])},presets:[SwaggerUIBundle.presets.apis],layout:'BaseLayout'});</script></html>`;
}
