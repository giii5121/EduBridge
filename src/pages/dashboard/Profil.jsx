import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import laptopMascot from '../../assets/images/mascots copy/laptop.png';
import waveMascot from '../../assets/images/mascots copy/wave.png';
import { quizTopics } from './quizData';

const ATTEMPTS_KEY = 'edubridge-quiz-attempts';
const PROFILE_KEY = 'edubridge-profile';
const EMPTY_ATTEMPTS = {};
const DEFAULT_PROFILE = {
  fullName: 'Nadia Putri',
  username: 'Nadia',
  email: 'nadia123@gmail.com',
  className: 'XI',
  joinedAt: '12 Mei 2025',
};
const TABS = [
  { id: 'account', label: 'Informasi Akun', icon: '▣' },
  { id: 'achievements', label: 'Pencapaian', icon: '♜' },
  { id: 'settings', label: 'Pengaturan', icon: '⚙' },
];

function readStorage(key, fallback, label) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    console.error(`Gagal membaca ${label}:`, error);
    return fallback;
  }
}

function AccountRow({ icon, label, value }) {
  return (
    <div className="grid grid-cols-[26px_minmax(112px,0.65fr)_minmax(0,1.35fr)] items-center gap-2 border-b border-[#8EB9F4] py-2 text-xs last:border-0 sm:grid-cols-[30px_minmax(160px,0.65fr)_minmax(0,1.35fr)] sm:gap-3 sm:text-sm">
      <span className="text-base text-[#3A81DA]" aria-hidden="true">{icon}</span>
      <span>{label}</span>
      <span className="min-w-0 break-words font-semibold">{value || 'Belum diisi'}</span>
    </div>
  );
}

function AchievementCard({ icon, title, description, color, earned, date }) {
  return (
    <article className={`rounded-2xl border p-4 ${earned ? 'border-[#DCE7F4] bg-white' : 'border-dashed border-slate-200 bg-slate-50 opacity-70'}`}>
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ backgroundColor: `${color}25`, color }} aria-hidden="true">{icon}</span>
      <h3 className="text-sm font-extrabold">{title}</h3>
      <p className="mt-1 min-h-8 text-[10px] leading-relaxed text-slate-500">{description}</p>
      <p className="mt-2 text-[9px] font-semibold" style={{ color: earned ? '#3A81DA' : '#94A3B8' }}>
        {earned ? `Diraih ${date}` : 'Belum diraih'}
      </p>
    </article>
  );
}

export default function Profil() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(() => ({
    ...DEFAULT_PROFILE,
    ...readStorage(PROFILE_KEY, {}, 'profil'),
  }));
  const [attemptData] = useState(() => readStorage(ATTEMPTS_KEY, { attempts: {} }, 'hasil kuis'));
  const [activeTab, setActiveTab] = useState('account');
  const [savedMessage, setSavedMessage] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => (
    localStorage.getItem('edubridge-notifications') !== 'false'
  ));
  const attempts = attemptData.attempts ?? EMPTY_ATTEMPTS;
  const records = useMemo(() => quizTopics.flatMap((topic) => (
    Object.entries(attempts[topic.id] ?? {}).map(([mode, attempt]) => ({
      topicId: topic.id,
      mode,
      score: attempt.score,
      attemptedAt: attempt.attemptedAt ?? 0,
    }))
  )).filter((record) => Number.isFinite(record.score)), [attempts]);

  const totalXp = records.length * 100;
  const xpPerLevel = 750;
  const level = Math.floor(totalXp / xpPerLevel) + 1;
  const levelXp = totalXp % xpPerLevel;
  const badges = [
    {
      icon: '🏅',
      title: 'Rajin',
      description: 'Selesaikan kuis pada 3 hari yang berbeda.',
      color: '#FFD65A',
      earned: new Set(records.map((record) => new Date(record.attemptedAt).toDateString())).size >= 3,
      date: records.length ? new Date(records[records.length - 1].attemptedAt).toLocaleDateString('id-ID') : '',
    },
    {
      icon: '🥈',
      title: 'Juara Kuis',
      description: 'Raih nilai sempurna dalam salah satu kuis.',
      color: '#A8B4C4',
      earned: records.some((record) => record.score === 100),
      date: records.find((record) => record.score === 100)
        ? new Date(records.find((record) => record.score === 100).attemptedAt).toLocaleDateString('id-ID')
        : '',
    },
    {
      icon: '🏆',
      title: 'Master Aljabar',
      description: 'Raih nilai minimal 80 pada kuis Aljabar.',
      color: '#F59A70',
      earned: Object.values(attempts.aljabar ?? {}).some((attempt) => attempt.score >= 80),
      date: Object.values(attempts.aljabar ?? {}).find((attempt) => attempt.score >= 80)
        ? new Date(Object.values(attempts.aljabar).find((attempt) => attempt.score >= 80).attemptedAt).toLocaleDateString('id-ID')
        : '',
    },
    {
      icon: '🌿',
      title: 'Jago Geometri',
      description: 'Raih nilai minimal 80 pada kuis Geometri.',
      color: '#73B885',
      earned: Object.values(attempts.geometri ?? {}).some((attempt) => attempt.score >= 80),
      date: Object.values(attempts.geometri ?? {}).find((attempt) => attempt.score >= 80)
        ? new Date(Object.values(attempts.geometri).find((attempt) => attempt.score >= 80).attemptedAt).toLocaleDateString('id-ID')
        : '',
    },
  ];

  function updateProfile(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
    setSavedMessage('');
  }

  function saveProfile(event) {
    event.preventDefault();
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setSavedMessage('Informasi akun berhasil disimpan di perangkat ini.');
  }

  function toggleNotifications(event) {
    const enabled = event.target.checked;
    setNotificationsEnabled(enabled);
    localStorage.setItem('edubridge-notifications', String(enabled));
  }

  const inputClass = 'mt-1 w-full rounded-xl border border-[#CFDCEC] bg-white px-3 py-2.5 text-sm text-[#2A42A1] outline-none transition focus:border-[#3A81DA] focus:ring-2 focus:ring-blue-100';

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1500px] font-poppins text-[#2A42A1]">
        <section className="relative mb-4 grid min-h-[205px] overflow-hidden rounded-[24px] border border-[#D9E5F0] bg-gradient-to-r from-[#D8EBFF] via-[#EFF8FF] to-[#DDF5FF] p-5 shadow-sm sm:min-h-[220px] sm:grid-cols-[210px_minmax(0,1fr)] sm:items-center sm:px-8">
          <div className="relative z-10 mx-auto flex h-[155px] w-[170px] items-center justify-center rounded-full bg-[#BCE5FF]/70 sm:h-[165px] sm:w-[180px]">
            <img src={laptopMascot} alt="Maskot EduBridge sedang belajar menggunakan laptop" className="h-[150px] w-[160px] object-contain sm:h-[175px] sm:w-[185px]" />
            <span className="absolute -bottom-1 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-white text-lg shadow" aria-hidden="true">📷</span>
          </div>
          <div className="relative z-10 mt-4 min-w-0 sm:mt-0">
            <h1 className="flex items-center gap-3 text-3xl font-extrabold text-[#3A81DA] sm:text-4xl">
              {profile.username || profile.fullName}
              <span className="text-2xl text-[#FFB43A]" aria-label="Mahkota">♛</span>
            </h1>
            <p className="text-sm font-semibold text-[#6398DB]">Pelajar kelas {profile.className || DEFAULT_PROFILE.className}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/80 bg-white/70 p-2.5 sm:max-w-[490px] sm:gap-3 sm:px-4">
              <span className="rounded-full bg-[#3A81DA] px-4 py-2 text-xs font-bold text-white">★ Level {level}</span>
              <span className="h-3 min-w-[100px] flex-1 overflow-hidden rounded-full bg-[#DCE4EC]">
                <span className="block h-full rounded-full bg-[#FFD45A]" style={{ width: `${Math.round((levelXp / xpPerLevel) * 100)}%` }} />
              </span>
              <span className="text-[10px] font-bold text-[#6398DB]">{levelXp} / {xpPerLevel} XP</span>
            </div>
            <p className="mt-3 text-xs font-medium italic text-[#6398DB]">“Setiap kemajuan kecil adalah langkah besar!”</p>
          </div>
          <span className="pointer-events-none absolute -right-10 -top-14 h-44 w-80 rounded-full bg-white/30" aria-hidden="true" />
        </section>

        <nav className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Bagian profil">
          {TABS.map((tab) => (
            <button key={tab.id} type="button" onClick={() => { setActiveTab(tab.id); setSavedMessage(''); }} className={`flex min-h-[46px] items-center justify-center gap-2 rounded-full border px-4 text-sm font-bold transition ${activeTab === tab.id ? 'border-[#3A81DA] bg-[#3A81DA] text-white shadow-sm' : 'border-[#D7E0E9] bg-white text-slate-600 hover:bg-[#F3F8FF]'}`}>
              <span className="text-lg" aria-hidden="true">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'account' && (
          <section className="rounded-[20px] border border-[#D6E0EA] bg-white p-4 shadow-sm sm:p-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_190px]">
              <div>
                <h2 className="mb-3 flex items-center gap-2 text-xl font-extrabold sm:text-2xl">
                  <span className="text-2xl text-[#3A81DA]" aria-hidden="true">●</span>Informasi Akun
                </h2>
                <AccountRow icon="♙" label="Nama Lengkap" value={profile.fullName} />
                <AccountRow icon="♙" label="Nama Pengguna" value={profile.username} />
                <AccountRow icon="✉" label="Email" value={profile.email} />
                <AccountRow icon="▣" label="Kelas" value={profile.className} />
                <AccountRow icon="◷" label="Tanggal Bergabung" value={profile.joinedAt} />
              </div>
              <div className="relative flex min-h-[150px] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#F5FAFF] to-[#EAF5FF]">
                <img src={waveMascot} alt="Maskot EduBridge menyapa dan menyemangati belajar" className="h-[165px] w-full object-contain" />
                <span className="absolute right-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-bold text-[#3A81DA]">Belajar terus!</span>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'achievements' && (
          <section className="rounded-[20px] border border-[#D6E0EA] bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-extrabold sm:text-2xl">Pencapaianmu</h2>
                <p className="mt-1 text-xs text-slate-500">Lencana terbuka otomatis saat kamu menyelesaikan tantangan belajar.</p>
              </div>
              <span className="rounded-full bg-[#EAF3FF] px-3 py-1.5 text-xs font-bold text-[#3A81DA]">{badges.filter((badge) => badge.earned).length}/{badges.length} lencana</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {badges.map((badge) => <AchievementCard key={badge.title} {...badge} />)}
            </div>
            <Link to="/progres" className="mt-5 inline-flex rounded-full bg-[#3A81DA] px-4 py-2 text-xs font-bold text-white hover:bg-[#2A42A1]">Lihat progres belajar →</Link>
          </section>
        )}

        {activeTab === 'settings' && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
            <section className="rounded-[20px] border border-[#D6E0EA] bg-white p-4 shadow-sm sm:p-6">
              <h2 className="mb-4 text-xl font-extrabold sm:text-2xl">Pengaturan Akun</h2>
              <form onSubmit={saveProfile} className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold">Nama lengkap
                  <input className={inputClass} value={profile.fullName} onChange={(event) => updateProfile('fullName', event.target.value)} required />
                </label>
                <label className="text-xs font-semibold">Nama pengguna
                  <input className={inputClass} value={profile.username} onChange={(event) => updateProfile('username', event.target.value)} required />
                </label>
                <label className="text-xs font-semibold">Email
                  <input className={inputClass} type="email" value={profile.email} onChange={(event) => updateProfile('email', event.target.value)} required />
                </label>
                <label className="text-xs font-semibold">Kelas
                  <input className={inputClass} value={profile.className} onChange={(event) => updateProfile('className', event.target.value)} required />
                </label>
                <div className="sm:col-span-2">
                  <button type="submit" className="rounded-full bg-[#3A81DA] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#2A42A1]">Simpan Perubahan</button>
                  {savedMessage && <p role="status" className="mt-2 text-xs font-semibold text-[#219A85]">{savedMessage}</p>}
                </div>
              </form>
            </section>
            <div className="space-y-4">
              <section className="rounded-[20px] border border-[#D6E0EA] bg-white p-4 shadow-sm sm:p-5">
                <h2 className="mb-3 text-base font-extrabold">Preferensi</h2>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-[#F1F6FC] p-3 text-xs font-semibold">
                  <span><span className="block">Pengingat belajar</span><span className="mt-1 block text-[10px] font-normal text-slate-500">Simpan preferensi pengingat di perangkat ini.</span></span>
                  <input type="checkbox" checked={notificationsEnabled} onChange={toggleNotifications} className="h-4 w-4 accent-[#3A81DA]" />
                </label>
              </section>
              <section className="rounded-[20px] border border-[#D6E0EA] bg-white p-4 shadow-sm sm:p-5">
                <h2 className="mb-2 text-base font-extrabold">Akun & Keamanan</h2>
                <p className="text-[10px] leading-relaxed text-slate-500">Aplikasi saat ini belum menggunakan layanan akun atau server. Perubahan profil dan preferensi disimpan hanya di perangkat ini.</p>
                <button type="button" onClick={() => navigate('/login')} className="mt-4 flex w-full items-center justify-between rounded-xl bg-[#F1F6FC] px-3 py-2.5 text-xs font-bold text-[#3A81DA] transition hover:bg-[#E4EFFC]">
                  Keluar dari Perangkat <span aria-hidden="true">→</span>
                </button>
              </section>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
