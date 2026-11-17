import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, LockKeyhole, Save, ShieldCheck, Trophy, UserRound, Zap } from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import { api, formatDate } from '../../lib/api';
import { Achievement, Badge, Button, ErrorNotice, Meter, PageHead } from '../../components/ui/Kit';
import mascot from '../../assets/images/mascots copy/laptop.png';
export default function Profil() {
  const { user, data, refresh, notify } = useApp();
  const [params, setParams] = useSearchParams();
  const tab =
    params.get('tab') === 'achievements' && user.role === 'student'
      ? 'achievements'
      : params.get('tab') === 'security'
        ? 'security'
        : 'account';
  const [form, setForm] = useState({
    name: user.name,
    school: user.school,
    reminders: user.reminders,
  });
  const [passwords, setPasswords] = useState({ current: '', password: '', confirmation: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/profile', { method: 'PATCH', body: form });
      await refresh();
      notify('Profil dan preferensi berhasil disimpan.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(event) {
    event.preventDefault();
    setError('');
    if (passwords.password !== passwords.confirmation) {
      setError('Konfirmasi kata sandi belum sesuai.');
      return;
    }
    setBusy(true);
    try {
      await api('/profile/password', { method: 'POST', body: passwords });
      setPasswords({ current: '', password: '', confirmation: '' });
      notify('Kata sandi diperbarui. Sesi perangkat lain sudah diakhiri.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const student = user.role === 'student';
  const tabs = [
    ['account', 'Informasi akun', UserRound],
    ...(student ? [['achievements', 'Pencapaian', Trophy]] : []),
    ['security', 'Keamanan', ShieldCheck],
  ];
  return (
    <>
      <PageHead eyebrow="RUANG PERSONALMU" title="Ini perjalananmu.">
        Kelola profil, preferensi, dan rayakan pencapaian belajarmu.
      </PageHead>
      <section className="profile-banner">
        <div className="profile-avatar">
          {user.name
            .split(' ')
            .map((w) => w[0])
            .slice(0, 2)
            .join('')}
        </div>
        <div>
          <Badge tone="blue">
            {student
              ? `PELAJAR · ${data.classroom?.name ?? 'KELAS XI'}`
              : user.role === 'admin'
                ? 'ADMINISTRATOR'
                : 'GURU MATEMATIKA'}
          </Badge>
          <h2>{user.name}</h2>
          <p>
            {user.school} <span>·</span> Bergabung {formatDate(user.createdAt)}
          </p>
          {student && (
            <div className="profile-level">
              <span>
                <Zap size={15} />
                Level {data.progress.level}
              </span>
              <Meter value={data.progress.levelXp / 5} tone="orange" label="Kemajuan level" />
              <small>{data.progress.levelXp}/500 XP</small>
            </div>
          )}
        </div>
        <img src={mascot} alt="Maskot EduBridge menggunakan laptop" />
      </section>
      <nav className="profile-tabs" aria-label="Bagian profil">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            className={tab === id ? 'active' : ''}
            onClick={() => {
              setError('');
              setParams({ tab: id });
            }}
          >
            <Icon size={17} />
            {label}
            {id === 'achievements' && (
              <Badge tone="orange">{data.progress.badges.filter((b) => b.earned).length}</Badge>
            )}
          </button>
        ))}
      </nav>
      {tab === 'account' && (
        <div className="profile-grid">
          <section className="card">
            <h2>Informasi akun</h2>
            <p className="muted">Pastikan guru mengenali profilmu dengan mudah.</p>
            <ErrorNotice>{error}</ErrorNotice>
            <form className="profile-form" onSubmit={save}>
              <label>
                Nama lengkap
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  minLength={2}
                  maxLength={80}
                  required
                />
              </label>
              <label>
                Email
                <input value={user.email} disabled />
                <span className="field-help">Email menjadi identitas masuk akunmu.</span>
              </label>
              <label>
                Asal sekolah
                <input
                  value={form.school}
                  onChange={(e) => setForm({ ...form, school: e.target.value })}
                  minLength={2}
                  maxLength={120}
                  required
                />
              </label>
              {student && (
                <label>
                  Kelas
                  <input value={data.classroom?.name ?? 'Belum ditentukan'} disabled />
                </label>
              )}
              <label className="preference-toggle">
                <span>
                  <strong>Pengingat belajar</strong>
                  <small>Tampilkan pengingat langkah belajarmu pada pemberitahuan.</small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={form.reminders}
                  onChange={(e) => setForm({ ...form, reminders: e.target.checked })}
                />
              </label>
              <div>
                <Button type="submit" busy={busy}>
                  <Save size={16} />
                  Simpan perubahan
                </Button>
              </div>
            </form>
          </section>
          <aside className="card account-summary">
            <div className="summary-icon">
              <UserRound size={25} />
            </div>
            <h3>Akun untuk bertumbuh.</h3>
            <p>
              Profil dan progresmu tersimpan di server. Kamu dapat melanjutkan belajar dari
              perangkat lain dengan akun yang sama.
            </p>
            {student && (
              <>
                <div className="summary-line">
                  <span>Konsep dikuasai</span>
                  <strong>{data.progress.mastered}</strong>
                </div>
                <div className="summary-line">
                  <span>Total XP</span>
                  <strong>{data.progress.xp}</strong>
                </div>
                <div className="summary-line">
                  <span>Siklus selesai</span>
                  <strong>{data.progress.completed}</strong>
                </div>
              </>
            )}
            <p className="field-help">
              <LockKeyhole size={13} />
              Guru kelas dan administrator dapat melihat hasil asesmen untuk membantu pembelajaran.
            </p>
          </aside>
        </div>
      )}
      {tab === 'achievements' && (
        <section className="card">
          <div className="section-head">
            <div>
              <h2>Usaha yang jadi pencapaian.</h2>
              <p className="muted">Lencana terbuka dari aktivitas belajarmu, satu per satu.</p>
            </div>
            <Badge tone="orange">
              <Trophy size={13} />
              {data.progress.badges.filter((b) => b.earned).length}/{data.progress.badges.length}{' '}
              lencana
            </Badge>
          </div>
          <div className="achievement-grid">
            {data.progress.badges.map((b) => (
              <Achievement key={b.id} badge={b} />
            ))}
          </div>
        </section>
      )}
      {tab === 'security' && (
        <section className="card security-card">
          <h2>Jaga akses ke akunmu.</h2>
          <p className="muted">Gunakan kata sandi yang hanya kamu ketahui.</p>
          <ErrorNotice>{error}</ErrorNotice>
          <form onSubmit={changePassword} className="profile-form">
            <label>
              Kata sandi saat ini
              <input
                type="password"
                autoComplete="current-password"
                required
                value={passwords.current}
                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
              />
            </label>
            <label>
              Kata sandi baru
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                value={passwords.password}
                onChange={(e) => setPasswords({ ...passwords, password: e.target.value })}
              />
            </label>
            <label>
              Konfirmasi kata sandi baru
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                value={passwords.confirmation}
                onChange={(e) => setPasswords({ ...passwords, confirmation: e.target.value })}
              />
            </label>
            <p className="field-help">
              Minimal 8 karakter. Mengubah kata sandi akan mengakhiri sesi pada perangkat lain.
            </p>
            <div>
              <Button busy={busy}>
                <Check size={16} />
                Perbarui kata sandi
              </Button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
