import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import { api, formatDate } from '../../lib/api';
import {
  Badge,
  Button,
  Empty,
  ErrorNotice,
  Loading,
  Modal,
  PageHead,
  SectionHead,
  Stat,
  Symbol,
} from '../../components/ui/Kit';
import LessonEditor from './LessonEditor';
import MathText from '../../components/learning/MathText';
const roleLabels = { student: 'Siswa', teacher: 'Guru', admin: 'Admin' };
export default function Admin() {
  const { user, notify, refresh } = useApp();
  const [overview, setOverview] = useState(null);
  const [tab, setTab] = useState('users');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    classId: '',
  });
  const load = useCallback(async () => {
    const result = await api('/admin/overview');
    setOverview(result);
    setForm((f) => ({ ...f, classId: f.classId || result.classes[0]?.id || '' }));
  }, []);
  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [load]);
  async function createUser(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/admin/users', { method: 'POST', body: form });
      await load();
      setCreating(false);
      setForm((f) => ({ ...f, name: '', email: '', password: '' }));
      notify('Akun berhasil dibuat.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function toggleUser() {
    setBusy(true);
    setError('');
    try {
      await api(`/admin/users/${pendingUser.id}`, {
        method: 'PATCH',
        body: { active: !pendingUser.active },
      });
      await load();
      setPendingUser(null);
      notify('Status akun diperbarui.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveTopic(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/admin/topics/${editing.id}`, { method: 'PATCH', body: editing });
      await Promise.all([load(), refresh()]);
      setEditing(null);
      notify('Materi dan bank soal berhasil disimpan.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  function updateBlock(index, key, value) {
    setEditing((t) => ({
      ...t,
      blocks: t.blocks.map((block, i) => (i === index ? { ...block, [key]: value } : block)),
    }));
  }
  function updateQuestion(bank, index, key, value) {
    setEditing((t) => ({
      ...t,
      [bank]: t[bank].map((q, i) => (i === index ? { ...q, [key]: value } : q)),
    }));
  }
  const users =
    overview?.users.filter((u) =>
      `${u.name} ${u.email} ${roleLabels[u.role]}`.toLowerCase().includes(query.toLowerCase()),
    ) ?? [];
  return (
    <>
      <PageHead
        eyebrow="PANEL ADMIN · EDUBRIDGE"
        title="Satu ruang, seluruh ekosistem."
        action={
          <Button
            onClick={() => {
              setError('');
              setCreating(true);
            }}
          >
            <Plus size={16} />
            Tambah akun
          </Button>
        }
      >
        Kelola pengguna, kelas, materi, dan pemetaan asesmen matematika XI.
      </PageHead>
      <ErrorNotice>{error}</ErrorNotice>
      {!overview && !error ? (
        <Loading />
      ) : !overview ? (
        <Button onClick={() => load().catch((err) => setError(err.message))}>Coba lagi</Button>
      ) : (
        <>
          <div className="stats-grid four">
            <Stat
              icon={UsersRound}
              label="Pengguna aktif"
              value={overview.users.filter((u) => u.active).length}
              detail={`${overview.users.length} akun terdaftar`}
              tone="blue"
            />
            <Stat
              icon={GraduationCap}
              label="Kelas XI"
              value={overview.classes.length}
              detail="kelas yang dikelola"
              tone="teal"
            />
            <Stat
              icon={BookOpen}
              label="Topik terpublikasi"
              value={overview.topics.filter((t) => t.published).length}
              detail={`${overview.topics.length} topik dalam katalog`}
              tone="orange"
            />
            <Stat
              icon={ClipboardList}
              label="Asesmen selesai"
              value={overview.assessments}
              detail="pretest, posttest, dan latihan"
              tone="purple"
            />
          </div>
          <div className="profile-tabs admin-tabs">
            {[
              ['users', 'Pengguna', UsersRound],
              ['classes', 'Kelas', GraduationCap],
              ['content', 'Materi & bank soal', BookOpen],
              ['system', 'Layanan diagnosis', ShieldCheck],
            ].map(([id, label, Icon]) => (
              <button
                className={tab === id ? 'active' : ''}
                key={id}
                onClick={() => {
                  setTab(id);
                  setQuery('');
                }}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </div>
          {tab === 'users' && (
            <section className="card">
              <SectionHead
                title="Pengguna EduBridge"
                action={
                  <div className="search-field compact">
                    <Search size={16} />
                    <input
                      aria-label="Cari pengguna"
                      placeholder="Nama, email, atau peran…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                }
              />
              {users.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Nama</th>
                        <th>Peran</th>
                        <th>Kelas</th>
                        <th>Status</th>
                        <th>Bergabung</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <strong>{u.name}</strong>
                            <small className="table-subtitle">{u.email}</small>
                          </td>
                          <td>
                            <Badge
                              tone={
                                u.role === 'admin'
                                  ? 'purple'
                                  : u.role === 'teacher'
                                    ? 'teal'
                                    : 'blue'
                              }
                            >
                              {roleLabels[u.role]}
                            </Badge>
                          </td>
                          <td>{overview.classes.find((c) => c.id === u.classId)?.name ?? '—'}</td>
                          <td>
                            <Badge tone={u.active ? 'teal' : 'neutral'}>
                              {u.active ? 'Aktif' : 'Nonaktif'}
                            </Badge>
                          </td>
                          <td>{formatDate(u.createdAt)}</td>
                          <td>
                            {u.id !== user.id && (
                              <button
                                className={`text-button ${u.active ? 'danger-text' : ''}`}
                                onClick={() => {
                                  setError('');
                                  setPendingUser(u);
                                }}
                              >
                                {u.active ? 'Nonaktifkan' : 'Aktifkan'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty title="Pengguna tidak ditemukan">Coba nama, email, atau peran lain.</Empty>
              )}
            </section>
          )}
          {tab === 'classes' && (
            <section className="card">
              <SectionHead
                title="Kelas & penanggung jawab"
                action={
                  <Link className="button secondary" to="/guru">
                    <Plus size={16} />
                    Kelola kelas
                  </Link>
                }
              >
                Kode kelas digunakan siswa saat mendaftar.
              </SectionHead>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Kelas</th>
                      <th>Kode</th>
                      <th>Guru</th>
                      <th>Siswa aktif</th>
                      <th>Dibuat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.classes.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.name}</strong>
                        </td>
                        <td>
                          <code>{c.code}</code>
                        </td>
                        <td>{c.teacher_name}</td>
                        <td>
                          {
                            overview.users.filter(
                              (u) => u.role === 'student' && u.active && u.classId === c.id,
                            ).length
                          }
                        </td>
                        <td>{formatDate(c.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {tab === 'content' && (
            <section className="card">
              <SectionHead title="Materi, soal & Q-matrix">
                Pretest dan posttest memiliki atribut yang sama. Kunci jawaban disimpan di server.
              </SectionHead>
              <div className="admin-topic-list">
                {overview.topics.map((t) => (
                  <article key={t.id}>
                    <Symbol topic={t} />
                    <div>
                      <h3>{t.title}</h3>
                      <p>
                        {t.category} · {t.attributes.length} atribut ·{' '}
                        {t.pre.length + t.post.length} soal
                      </p>
                    </div>
                    <Badge tone={t.published ? 'teal' : 'neutral'}>
                      {t.published ? 'Terpublikasi' : 'Draf'}
                    </Badge>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setError('');
                        setEditing(structuredClone(t));
                      }}
                    >
                      <Pencil size={15} />
                      Edit
                    </Button>
                  </article>
                ))}
              </div>
            </section>
          )}
          {tab === 'system' && (
            <section className="card system-card">
              <div className="system-mark">
                <ShieldCheck size={29} />
              </div>
              <Badge tone={overview.diagnosis.ready ? 'teal' : 'orange'}>
                {overview.diagnosis.ready ? 'LAYANAN TERHUBUNG' : 'LAYANAN BELUM TERSEDIA'}
              </Badge>
              <h2>Diagnosis lokal, penjelasan terarah.</h2>
              <p>
                PDINA menjalankan inferensi checkpoint lokal melalui FastAPI. Instrumen EduBridge
                mencakup 18 atribut dan 180 soal berbahasa Indonesia. Kalibrasi memakai data
                sintetis; validasi pada siswa nyata tetap diperlukan.
              </p>
              <div className="system-facts">
                <div>
                  <span>Adapter diagnosis</span>
                  <code>
                    {overview.diagnosis.models?.find((m) => m.id === 'edubridge')?.version ??
                      'PDINA tidak terhubung'}
                  </code>
                </div>
                <div>
                  <span>Pendamping belajar</span>
                  <code>
                    {overview.gemini.configured
                      ? overview.gemini.model
                      : 'Materi terkurasi · Gemini belum dikonfigurasi'}
                  </code>
                </div>
                <div>
                  <span>Persistensi</span>
                  <strong>SQLite · Data tersimpan</strong>
                </div>
                <div>
                  <span>Kontrak layanan AI</span>
                  <code>FastAPI · OpenAPI · Swagger UI</code>
                </div>
              </div>
              <p className="field-help">
                Model EEDI dan kalkulus asli tetap tersedia. Pengeditan isi atau kunci soal
                membatalkan kalibrasi soal tersebut sampai ditinjau dan dikalibrasi ulang.
              </p>
              {overview.audit.length > 0 && (
                <details>
                  <summary>Aktivitas administrasi terbaru</summary>
                  <ul>
                    {overview.audit.map((entry, i) => (
                      <li key={i}>
                        {entry.action} · {entry.target_id} · {formatDate(entry.created_at)}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          )}
        </>
      )}
      {creating && (
        <Modal title="Tambah akun" onClose={() => setCreating(false)}>
          <form className="modal-body form-stack" onSubmit={createUser}>
            <ErrorNotice>{error}</ErrorNotice>
            <label>
              Nama lengkap
              <input
                autoFocus
                required
                minLength={2}
                maxLength={80}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label>
              Kata sandi awal
              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <label>
              Peran
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {Object.entries(roleLabels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {form.role === 'student' && (
              <label>
                Kelas
                <select
                  required
                  value={form.classId}
                  onChange={(e) => setForm({ ...form, classId: e.target.value })}
                >
                  <option value="">Pilih kelas XI</option>
                  {overview?.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                Batal
              </Button>
              <Button busy={busy}>
                <Plus size={15} />
                Buat akun
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {pendingUser && (
        <Modal
          title={pendingUser.active ? 'Nonaktifkan akun?' : 'Aktifkan kembali akun?'}
          onClose={() => setPendingUser(null)}
        >
          <div className="modal-body">
            <ErrorNotice>{error}</ErrorNotice>
            <p>
              {pendingUser.active ? (
                <>
                  Akun <strong>{pendingUser.name}</strong> tidak dapat masuk setelah dinonaktifkan.
                  Riwayat belajar tetap tersimpan.
                </>
              ) : (
                <>
                  Akun <strong>{pendingUser.name}</strong> akan dapat masuk dan melanjutkan
                  aktivitasnya.
                </>
              )}
            </p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setPendingUser(null)}>
                Batal
              </Button>
              <Button
                variant={pendingUser.active ? 'danger' : 'primary'}
                busy={busy}
                onClick={toggleUser}
              >
                {pendingUser.active ? 'Nonaktifkan akun' : 'Aktifkan akun'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {editing && (
        <Modal title={`Edit: ${editing.title}`} onClose={() => setEditing(null)} wide>
          <form className="modal-body form-stack content-editor" onSubmit={saveTopic}>
            <ErrorNotice>{error}</ErrorNotice>
            <div className="form-grid">
              <label>
                Judul topik
                <input
                  required
                  minLength={3}
                  maxLength={100}
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </label>
              <label>
                Estimasi menit
                <input
                  type="number"
                  required
                  min={1}
                  max={180}
                  value={editing.minutes}
                  onChange={(e) => setEditing({ ...editing, minutes: Number(e.target.value) })}
                />
              </label>
            </div>
            <label>
              Deskripsi
              <textarea
                required
                minLength={5}
                maxLength={300}
                value={editing.summary}
                onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={editing.published}
                onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
              />
              Publikasikan ke katalog siswa
            </label>
            <h3>Materi penguatan</h3>
            {editing.blocks.map((b, i) => (
              <details key={i} className="editor-section">
                <summary>
                  Konsep {i + 1}: {editing.attributes[i]}
                </summary>
                <div className="form-stack">
                  <label>
                    Judul bagian
                    <input
                      required
                      minLength={3}
                      maxLength={100}
                      value={b.title}
                      onChange={(e) => updateBlock(i, 'title', e.target.value)}
                    />
                  </label>
                  <label>
                    Penjelasan
                    <textarea
                      required
                      minLength={10}
                      maxLength={3000}
                      value={b.body}
                      onChange={(e) => updateBlock(i, 'body', e.target.value)}
                    />
                  </label>
                  <label>
                    Contoh
                    <textarea
                      required
                      minLength={5}
                      maxLength={1000}
                      value={b.example}
                      onChange={(e) => updateBlock(i, 'example', e.target.value)}
                    />
                  </label>
                  <LessonEditor block={b} onChange={(key, value) => updateBlock(i, key, value)} />
                </div>
              </details>
            ))}
            <h3>Bank soal & pemetaan atribut</h3>
            {['pre', 'post'].map((bank) => (
              <section key={bank}>
                <h4>{bank === 'pre' ? 'Pretest' : 'Posttest'}</h4>
                {editing[bank].map((q, i) => (
                  <details key={q.id} className="editor-section">
                    <summary>
                      Soal {i + 1} · {q.attributes.map((a) => editing.attributes[a]).join(', ')}
                    </summary>
                    <div className="form-stack">
                      <label>
                        Pertanyaan
                        <textarea
                          required
                          minLength={5}
                          maxLength={600}
                          value={q.text}
                          onChange={(e) => updateQuestion(bank, i, 'text', e.target.value)}
                        />
                      </label>
                      <div className="math-preview" aria-label={`Pratinjau soal ${i + 1}`}>
                        <small>Pratinjau tampilan siswa</small>
                        <p>
                          <MathText text={q.text} />
                        </p>
                        <ol type="A">
                          {q.options.map((o, j) => (
                            <li key={j}>
                              <MathText text={o} whole />
                            </li>
                          ))}
                        </ol>
                      </div>
                      <div className="form-grid">
                        {q.options.map((o, j) => (
                          <label key={j}>
                            Opsi {String.fromCharCode(65 + j)}
                            <input
                              required
                              maxLength={300}
                              value={o}
                              onChange={(e) =>
                                updateQuestion(
                                  bank,
                                  i,
                                  'options',
                                  q.options.map((value, k) => (k === j ? e.target.value : value)),
                                )
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <label>
                        Kunci jawaban
                        <select
                          value={q.answer}
                          onChange={(e) =>
                            updateQuestion(bank, i, 'answer', Number(e.target.value))
                          }
                        >
                          {q.options.map((o, j) => (
                            <option value={j} key={j}>
                              {String.fromCharCode(65 + j)} · {o}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Pembahasan
                        <textarea
                          required
                          minLength={5}
                          maxLength={1200}
                          value={q.explanation}
                          onChange={(e) => updateQuestion(bank, i, 'explanation', e.target.value)}
                        />
                      </label>
                      <div className="q-matrix">
                        <span>Q-matrix</span>
                        {editing.attributes.map((a, j) => (
                          <span key={j} title={a} className={q.attributes.includes(j) ? 'on' : ''}>
                            {q.attributes.includes(j) ? 1 : 0}
                          </span>
                        ))}
                      </div>
                    </div>
                  </details>
                ))}
              </section>
            ))}
            <p className="field-help">
              Pemetaan atribut dipertahankan agar perbandingan pre–post tetap konsisten. Perubahan
              soal tidak mengubah snapshot asesmen yang sudah dimulai.
            </p>
            <div className="modal-actions sticky">
              <Button variant="secondary" type="button" onClick={() => setEditing(null)}>
                Batal
              </Button>
              <Button busy={busy}>
                <Save size={16} />
                Simpan perubahan
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
