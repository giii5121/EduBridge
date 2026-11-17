export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
let csrfToken = '';
export async function api(path, { method = 'GET', body, signal, retryCsrf = true } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      signal: signal ?? AbortSignal.timeout(path === '/assistant' || path.endsWith('/narrative') ? 95000 : 35000),
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(!['GET', 'HEAD'].includes(method) && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Server belum terhubung. Periksa koneksi lalu coba lagi.', 0);
  }
  let data;
  const nextCsrf = response.headers.get('X-CSRF-Token');
  if (nextCsrf) csrfToken = nextCsrf;
  try {
    data = await response.json();
  } catch {
    throw new ApiError('Respons server belum dapat dibaca. Coba lagi.', response.status);
  }
  if (!response.ok) {
    if (response.status === 403 && data.code === 'csrf_invalid' && nextCsrf && retryCsrf)
      return api(path, { method, body, signal, retryCsrf: false });
    if (response.status === 401 && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('edubridge:session-expired'));
    throw new ApiError(data.error ?? 'Permintaan tidak berhasil.', response.status);
  }
  return data;
}
export const homeFor = (role) =>
  role === 'admin' ? '/admin' : role === 'teacher' ? '/guru' : '/dashboard';
export const modeLabels = {
  pretest: 'Pretest',
  posttest: 'Posttest',
  remedial: 'Latihan penguatan',
};
export const phaseLabels = {
  pretest: 'Asesmen awal',
  learning: 'Pembelajaran kelas',
  posttest: 'Asesmen akhir',
};
export const formatDate = (value) =>
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value));
export const statusMeta = (state) =>
  ({
    pretest: { label: 'Mulai pretest', to: 'pretest', tone: 'blue' },
    learning: {
      label: state.phase === 'pretest' ? 'Menunggu pembelajaran' : 'Pelajari materi',
      to: 'lesson',
      tone: 'teal',
    },
    posttest: { label: 'Kerjakan posttest', to: 'posttest', tone: 'purple' },
    waiting: { label: 'Menunggu posttest', to: 'lesson', tone: 'orange' },
    completed: { label: 'Siklus selesai', to: 'result', tone: 'teal' },
  })[state.status];
export function topicLink(topic) {
  const meta = statusMeta(topic.state);
  return meta.to === 'lesson'
    ? `/materi/${topic.id}`
    : meta.to === 'result'
      ? `/kuis/hasil/${topic.state.post.id}`
      : `/kuis?subject=${topic.id}&mode=${meta.to}`;
}
