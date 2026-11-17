import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Download,
  GraduationCap,
  Plus,
  Search,
  Target,
  UsersRound,
} from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import NarrativePanel from '../../components/learning/NarrativePanel';
import { api, phaseLabels } from '../../lib/api';
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
} from '../../components/ui/Kit';
export default function Teacher() {
  const { user, notify, refresh } = useApp();
  const [classes, setClasses] = useState(null);
  const [selected, setSelected] = useState('');
  const [classroom, setClassroom] = useState(null);
  const [topicId, setTopicId] = useState('fungsi');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [student, setStudent] = useState(null);
  const [name, setName] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState('');
  const loadClasses = useCallback(async () => {
    const result = await api('/classes');
    setClasses(result.classes);
    setSelected((id) => id || result.classes[0]?.id || '');
  }, []);
  const loadClass = useCallback(async () => {
    if (!selected) return;
    const result = await api(`/classes/${selected}`);
    setClassroom(result);
    setTopicId((id) =>
      result.topics.some((t) => t.id === id) ? id : (result.topics[0]?.id ?? ''),
    );
  }, [selected]);
  useEffect(() => {
    loadClasses().catch((err) => setError(err.message));
  }, [loadClasses]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setClassroom(null);
    setError('');
    api(`/classes/${selected}`, { signal: controller.signal })
      .then((result) => {
        setClassroom(result);
        setTopicId((id) =>
          result.topics.some((t) => t.id === id) ? id : (result.topics[0]?.id ?? ''),
        );
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      });
    return () => controller.abort();
  }, [selected]);
  useEffect(() => {
    if (user.role === 'admin')
      api('/admin/overview')
        .then((r) => {
          const ts = r.users.filter((u) => u.role === 'teacher' && u.active);
          setTeachers(ts);
          setTeacherId(ts[0]?.id ?? '');
        })
        .catch((err) => setError(err.message));
  }, [user.role]);
  async function changePhase(phase) {
    setBusy(true);
    setError('');
    try {
      await api(`/classes/${selected}/phase`, { method: 'PATCH', body: { topicId, phase } });
      await Promise.all([loadClass(), refresh()]);
      notify(`Fase kelas diubah menjadi ${phaseLabels[phase].toLowerCase()}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function createClass(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api('/classes', { method: 'POST', body: { name, teacherId } });
      await loadClasses();
      setSelected(r.classroom.id);
      setName('');
      setModal(false);
      notify('Kelas dibuat. Bagikan kode kelas kepada siswa.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const topic = classroom?.topics.find((t) => t.id === topicId);
  const rows =
    classroom?.students
      .map((s) => ({ student: s, state: s.topics.find((t) => t.id === topicId)?.state }))
      .filter((r) => r.state) ?? [];
  const measured = rows.filter((r) => r.state.pre);
  const completed = rows.filter((r) => r.state.post);
  const pairs = completed.map((r) => r.state.comparison);
  const filtered = rows.filter((r) =>
    `${r.student.name} ${r.student.email}`.toLowerCase().includes(query.toLowerCase()),
  );
  const focus =
    topic?.attributes.map((attribute, index) => ({
      attribute,
      count: measured.filter(
        (r) =>
          (r.state.post ?? r.state.pre).attributes.find((a) => a.id === index)?.status === 'gap',
      ).length,
    })) ?? [];
  async function copy() {
    try {
      await navigator.clipboard.writeText(classroom.code);
      notify('Kode kelas disalin.');
    } catch {
      notify(`Kode kelas: ${classroom.code}`, 'info');
    }
  }
  return (
    <>
      <PageHead
        eyebrow="RUANG GURU · MATEMATIKA XI"
        title="Pahami kebutuhan setiap siswa."
        action={
          <Button
            onClick={() => {
              setError('');
              setModal(true);
            }}
          >
            <Plus size={17} />
            Buat kelas
          </Button>
        }
      >
        Dari diagnosis awal ke penguatan, lalu ukur kembali setelah pembelajaran.
      </PageHead>
      <ErrorNotice>{error}</ErrorNotice>
      {classes === null && !error ? (
        <Loading />
      ) : classes?.length === 0 ? (
        <Empty
          title="Kelas pertamamu menunggu"
          action={<Button onClick={() => setModal(true)}>Buat kelas XI</Button>}
        >
          Buat kelas dan bagikan kode bergabung kepada siswa.
        </Empty>
      ) : (
        <>
          <section className="card class-toolbar">
            <label>
              Kelas yang dikelola
              <select
                aria-label="Pilih kelas"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.studentCount} siswa
                  </option>
                ))}
              </select>
            </label>
            {classroom && (
              <>
                <button className="class-code" onClick={copy}>
                  <span>KODE BERGABUNG</span>
                  <strong>{classroom.code}</strong>
                  <Copy size={16} />
                </button>
                <a className="button secondary" href={`/api/classes/${classroom.id}/export`}>
                  <Download size={16} />
                  Ekspor CSV
                </a>
              </>
            )}
          </section>
          {!classroom && !error && <Loading />}
          {classroom && (
            <>
              <div className="teacher-topic-select">
                <label>
                  Fokus topik
                  <select
                    value={topicId}
                    aria-label="Fokus topik kelas"
                    onChange={(e) => setTopicId(e.target.value)}
                  >
                    {classroom.topics.map((t) => (
                      <option value={t.id} key={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
                <Badge tone="orange">PDINA · Kalibrasi sintetis</Badge>
              </div>
              <div className="stats-grid four">
                <Stat icon={UsersRound} label="Siswa aktif" value={rows.length} tone="blue" />
                <Stat
                  icon={GraduationCap}
                  label="Pretest selesai"
                  value={`${measured.length}/${rows.length}`}
                  tone="purple"
                />
                <Stat
                  icon={Check}
                  label="Posttest selesai"
                  value={`${completed.length}/${rows.length}`}
                  tone="teal"
                />
                <Stat
                  icon={Target}
                  label="Gap tertutup"
                  value={pairs.reduce((sum, p) => sum + (p?.gapsClosed ?? 0), 0)}
                  tone="orange"
                />
              </div>
              {topic && (
                <section className="card phase-control">
                  <div>
                    <h2>Atur fase pembelajaran</h2>
                    <p>
                      Siswa menyelesaikan pretest sebelum belajar, lalu posttest setelah penguatan.
                    </p>
                  </div>
                  <div className="phase-buttons">
                    {Object.entries(phaseLabels).map(([id, label], i) => (
                      <button
                        key={id}
                        className={topic.phase === id ? 'active' : ''}
                        disabled={busy}
                        onClick={() => changePhase(id)}
                      >
                        <span>{i + 1}</span>
                        {label}
                        {topic.phase === id && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {topic && (
                <section className="card">
                  <NarrativePanel
                    key={`${selected}:${topicId}`}
                    classId={selected}
                    topicId={topicId}
                  />
                </section>
              )}
              <div className="teacher-detail-grid">
                <section className="card class-results">
                  <SectionHead
                    title="Peta pemahaman kelas"
                    action={
                      <div className="search-field compact">
                        <Search size={16} />
                        <input
                          aria-label="Cari siswa"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Cari siswa…"
                        />
                      </div>
                    }
                  >
                    Setiap sel menampilkan bukti penguasaan atribut terkini.
                  </SectionHead>
                  {filtered.length ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Siswa</th>
                            <th>Pre</th>
                            <th>Post</th>
                            {topic?.attributes.map((a) => (
                              <th key={a} className="attribute-heading">
                                {a}
                              </th>
                            ))}
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map(({ student: s, state }) => (
                            <tr key={s.id}>
                              <td>
                                <strong>{s.name}</strong>
                                <small className="table-subtitle">
                                  {state.post
                                    ? 'Siklus selesai'
                                    : state.pre
                                      ? state.lessonAt
                                        ? 'Menunggu posttest'
                                        : 'Penguatan konsep'
                                      : 'Belum pretest'}
                                </small>
                              </td>
                              <td>{state.pre?.score ?? '—'}</td>
                              <td>{state.post?.score ?? '—'}</td>
                              {topic?.attributes.map((a, i) => {
                                const attr = (state.post ?? state.pre)?.attributes.find(
                                  (item) => item.id === i,
                                );
                                return (
                                  <td key={a}>
                                    <span className={`heat-cell ${attr?.status ?? 'unknown'}`}>
                                      {attr?.mastery === null || !attr ? '—' : `${attr.mastery}%`}
                                    </span>
                                  </td>
                                );
                              })}
                              <td>
                                <button
                                  className="icon-button"
                                  aria-label={`Detail ${s.name}`}
                                  onClick={() => setStudent(s)}
                                >
                                  <ArrowRight size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty title={rows.length ? 'Siswa tidak ditemukan' : 'Siswa belum bergabung'}>
                      {rows.length
                        ? 'Coba nama atau email lain.'
                        : `Bagikan kode ${classroom.code} agar siswa dapat mendaftar ke kelas ini.`}
                    </Empty>
                  )}
                  <div className="heat-legend">
                    <span>
                      <i className="mastered" />
                      Dikuasai
                    </span>
                    <span>
                      <i className="developing" />
                      Perlu konfirmasi
                    </span>
                    <span>
                      <i className="gap" />
                      Learning gap
                    </span>
                    <span>
                      <i className="unknown" />
                      Bukti belum cukup
                    </span>
                  </div>
                </section>
                <aside className="card focus-card">
                  <SectionHead title="Prioritas penguatan" />
                  <p className="muted">Atribut berlabel learning gap dengan bukti yang cukup.</p>
                  {focus
                    .sort((a, b) => b.count - a.count)
                    .map((f, i) => (
                      <div className="focus-row" key={f.attribute}>
                        <span>0{i + 1}</span>
                        <div>
                          <strong>{f.attribute}</strong>
                          <small>
                            {f.count} dari {measured.length} siswa terukur
                          </small>
                        </div>
                        <Badge tone={f.count ? 'orange' : 'teal'}>{f.count}</Badge>
                      </div>
                    ))}
                  <div className="notice info">
                    <BookOpen size={18} />
                    <p>
                      Gunakan hasil awal untuk penguatan di kelas dan hasil akhir untuk menentukan
                      tindak lanjut.
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}
        </>
      )}
      {modal && (
        <Modal title="Buat kelas XI" onClose={() => setModal(false)}>
          <form className="modal-body form-stack" onSubmit={createClass}>
            <ErrorNotice>{error}</ErrorNotice>
            <label>
              Nama kelas
              <input
                autoFocus
                required
                minLength={4}
                maxLength={50}
                placeholder="XI IPA 2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {user.role === 'admin' && (
              <label>
                Guru penanggung jawab
                <select required value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                  <option value="">Pilih guru</option>
                  {teachers.map((t) => (
                    <option value={t.id} key={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="muted">
              Kode bergabung dibuat otomatis. Kelas baru dimulai pada fase asesmen awal.
            </p>
            <div className="modal-actions">
              <Button variant="secondary" type="button" onClick={() => setModal(false)}>
                Batal
              </Button>
              <Button busy={busy}>Buat kelas</Button>
            </div>
          </form>
        </Modal>
      )}
      {student && (
        <Modal title={`Perjalanan ${student.name}`} onClose={() => setStudent(null)} wide>
          <div className="modal-body">
            <p className="muted">
              {student.email} · {classroom.name}
            </p>
            {student.topics.map((t) => (
              <section className="student-topic-detail" key={t.id}>
                <h3>{t.title}</h3>
                <div className="button-row">
                  <Badge>Pretest: {t.state.pre?.score ?? '—'}</Badge>
                  <Badge tone="teal">Posttest: {t.state.post?.score ?? '—'}</Badge>
                  {t.state.comparison && (
                    <Badge tone="orange">{t.state.comparison.gapsClosed} gap tertutup</Badge>
                  )}
                </div>
                {t.state.pre ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Atribut</th>
                          <th>Sebelum</th>
                          <th>Sesudah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.state.pre.attributes.map((a) => (
                          <tr key={a.id}>
                            <td>{a.name}</td>
                            <td>{a.mastery ?? '—'}%</td>
                            <td>
                              {t.state.post?.attributes.find((b) => b.id === a.id)?.mastery ?? '—'}
                              {t.state.post ? '%' : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted">Belum ada bukti asesmen untuk topik ini.</p>
                )}
              </section>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
