import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  BookOpen,
  ClipboardList,
  ChartNoAxesCombined,
  UserRound,
  LogOut,
  Bell,
  Search,
  Flame,
  Zap,
  ChevronDown,
  Menu,
  X,
  GraduationCap,
  ShieldCheck,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import { Badge, Modal, Meter } from '../ui/Kit';
import mascot from '../../assets/images/mascots copy/wave.png';
import ThemeToggle from '../ui/ThemeToggle';
export default function DashboardLayout() {
  const { user, data, logout, notify } = useApp();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [help, setHelp] = useState(false);
  const [search, setSearch] = useState('');
  const sidebarRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => [
      ...sidebarRef.current.querySelectorAll('a[href], button:not(:disabled)'),
    ];
    focusable()[0]?.focus();
    const keys = (event) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key === 'Tab') {
        const items = focusable();
        if (event.shiftKey && document.activeElement === items[0]) {
          event.preventDefault();
          items.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
          event.preventDefault();
          items[0]?.focus();
        }
      }
    };
    document.addEventListener('keydown', keys);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keys);
      previousFocus?.focus();
    };
  }, [open]);
  const location = useLocation();
  const navigate = useNavigate();
  const student = user.role === 'student';
  const menu = student
    ? [
        ['/dashboard', 'Beranda', LayoutGrid],
        ['/katalog', 'Katalog materi', BookOpen],
        ['/kuis', 'Asesmen & latihan', ClipboardList],
        ['/progres', 'Progres belajar', ChartNoAxesCombined],
        ['/profil', 'Profil saya', UserRound],
      ]
    : [
        ...(user.role === 'admin' ? [['/admin', 'Panel admin', ShieldCheck]] : []),
        ['/guru', 'Ruang guru', GraduationCap],
        ['/kelola-materi', 'Kelola materi', BookOpen],
        ['/katalog', 'Katalog materi', BookOpen],
        ['/profil', 'Profil saya', UserRound],
      ];
  const active =
    menu.find(([path]) => location.pathname.startsWith(path))?.[1] ??
    (/^\/(materi|penguatan)\//.test(location.pathname) ? 'Materi penguatan' : 'Asesmen & latihan');
  const pending = student
    ? data.topics.filter((t) => t.state.status !== 'completed' && t.state.pre)
    : [];
  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  async function leave() {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      notify(err.message, 'error');
    }
  }
  return (
    <div className={`app-shell ${student ? 'student-shell' : ''}`}>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Tutup navigasi"
          onClick={() => setOpen(false)}
        />
      )}
      <aside id="main-navigation" ref={sidebarRef} className={`sidebar ${open ? 'open' : ''}`}>
        <Link to="/" className="brand">
          <img src="/assets/images/logo.png" alt="" />
          <span>
            edu<span>bridge</span>
            <small>BRIDGE YOUR LEARNING GAP</small>
          </span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-dot" />
          {student ? 'Matematika · Kelas XI' : 'EduBridge · Pengelolaan'}
        </div>
        <p className="nav-caption">{student ? 'RUANG BELAJARMU' : 'RUANG KERJA'}</p>
        <nav aria-label="Navigasi utama">
          {menu.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={path}
              aria-label={label}
              onClick={() => {
                setOpen(false);
                setNotifications(false);
              }}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className={`nav-glyph nav-glyph-${path.slice(1)}`}>
                <Icon size={24} strokeWidth={student ? 2.5 : 2} />
              </span>
              <span>
                {student
                  ? {
                      '/dashboard': 'Belajar',
                      '/katalog': 'Jelajahi materi',
                      '/kuis': 'Asesmen & latihan',
                      '/progres': 'Progres belajarku',
                      '/profil': 'Profil & lencana',
                    }[path]
                  : label}
              </span>
              {path === '/kuis' && pending.length > 0 && (
                <span className="nav-counter" aria-hidden="true">
                  {pending.length}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {student && (
            <div className="level-card">
              <img src={mascot} alt="Maskot EduBridge menyapa" />
              <div>
                <Badge tone="orange">LEVEL {data.progress.level}</Badge>
                <h3>
                  Langkah kecil,
                  <br />
                  kemajuan besar.
                </h3>
                <div className="level-caption">
                  <span>{data.progress.levelXp} XP</span>
                  <span>{data.progress.nextLevelXp} XP</span>
                </div>
                <Meter
                  value={(data.progress.levelXp / data.progress.nextLevelXp) * 100}
                  tone="orange"
                  label="Kemajuan level"
                />
              </div>
            </div>
          )}
          <button className="nav-item" onClick={() => setHelp(true)}>
            <Info size={20} />
            <span>Tentang diagnosis</span>
            <ArrowUpRight size={15} />
          </button>
          <button className="nav-item logout" onClick={leave}>
            <LogOut size={19} />
            <span>Keluar akun</span>
          </button>
          <span className="sidebar-foot">Dibuat untuk terus bertumbuh.</span>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-start">
            <button
              className="icon-button mobile-menu"
              aria-label="Buka navigasi"
              aria-controls="main-navigation"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu size={23} />
            </button>
            <div className="breadcrumb">
              Ruang {student ? 'belajar' : 'kerja'} <span>/</span> <strong>{active}</strong>
            </div>
          </div>
          <form
            className="global-search"
            onSubmit={(event) => {
              event.preventDefault();
              navigate(`/katalog?q=${encodeURIComponent(search.trim())}`);
            }}
          >
            <Search size={17} />
            <input
              aria-label="Cari materi"
              placeholder="Cari sesuatu untuk dipelajari…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <div className="topbar-actions">
            <ThemeToggle />
            {student && (
              <>
                <span className="header-stat flame">
                  <Flame size={18} />
                  {data.progress.streak}
                  <span>hari</span>
                </span>
                <span className="header-stat xp">
                  <Zap size={17} />
                  {data.progress.xp}
                  <span>XP</span>
                </span>
              </>
            )}
            <div className="notification-wrap">
              <button
                className="icon-button notification-button"
                aria-label="Pemberitahuan"
                aria-expanded={notifications}
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={20} />
                {pending.length > 0 && user.reminders && <span />}
              </button>
              {notifications && (
                <div className="notification-panel">
                  <div className="row-between">
                    <h3>Pengingat belajar</h3>
                    <button
                      className="icon-button"
                      aria-label="Tutup pengingat"
                      onClick={() => setNotifications(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {!student ? (
                    <p>Kelola fase pembelajaran dan pantau hasil siswa di ruang guru.</p>
                  ) : !user.reminders ? (
                    <p>Pengingat sedang dinonaktifkan. Ubah preferensi di profil.</p>
                  ) : pending.length ? (
                    pending.map((t) => (
                      <Link
                        key={t.id}
                        to={`/materi/${t.id}`}
                        onClick={() => setNotifications(false)}
                      >
                        <BookOpen size={17} />
                        <span>
                          <strong>{t.title}</strong>
                          <small>
                            {t.state.status === 'waiting'
                              ? 'Menunggu guru membuka posttest'
                              : 'Lanjutkan siklus belajarmu'}
                          </small>
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p>Belum ada pengingat. Mulai pretest untuk menyusun langkah belajarmu.</p>
                  )}
                </div>
              )}
            </div>
            <Link to="/profil" className="header-profile">
              <span className="avatar">{initials}</span>
              <span>
                <strong>{user.name.split(' ')[0]}</strong>
                <small>
                  {student
                    ? (data.classroom?.name ?? 'Kelas XI')
                    : user.role === 'admin'
                      ? 'Administrator'
                      : 'Guru matematika'}
                </small>
              </span>
              <ChevronDown size={14} />
            </Link>
          </div>
        </header>
        <main className="page-content">
          <div className="context-line">
            <span>
              <span className="live-dot" />
              {student
                ? `${data.classroom?.name ?? 'Kelas XI'} · Matematika`
                : 'Matematika kelas XI · Tahun ajaran berjalan'}
            </span>
            {user.demo && <Badge tone="neutral">Akun demo</Badge>}
          </div>
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} EduBridge</span>
          <span>Setiap siswa punya jalannya sendiri.</span>
          <span>Kenali. Pelajari. Kuasai.</span>
        </footer>
      </div>
      {help && (
        <Modal title="Kenali cara diagnosis bekerja" onClose={() => setHelp(false)}>
          <div className="modal-body prose">
            <Badge tone="blue">CDA · CDM · PDINA</Badge>
            <p>
              EduBridge menggunakan CDA untuk mengumpulkan bukti pemahaman sebelum dan setelah
              pembelajaran kelas. CDM memetakan bukti tersebut ke atribut konsep agar penguatan
              lebih terarah.
            </p>
            <p>
              PDINA memperkirakan probabilitas penguasaan dari pola jawaban dan Q-matrix, dengan
              mempertimbangkan peluang menebak dan kekeliruan. Jawaban kosong tidak dihitung
              sebagai bukti salah. Bukti yang belum cukup tidak diberi label learning gap.
            </p>
            <p>
              Kalibrasi instrumen aplikasi masih menggunakan data sintetis. Estimasi perlu
              ditinjau guru bersama bukti pembelajaran di kelas. Riwayat dari versi simulasi
              tetap ditandai sebagai hasil lama. Gemini hanya membantu menjelaskan materi dan hasil.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
