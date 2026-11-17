import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardCheck,
  Flame,
  GraduationCap,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../lib/AppContext';
import { homeFor } from '../lib/api';
import ThemeToggle from '../components/ui/ThemeToggle';
import TopicIllustration from '../components/ui/TopicIllustration';
import './Home.css';

const steps = [
  [
    ClipboardCheck,
    'Kenali titik awalmu',
    'Kerjakan pretest. CDA mengumpulkan bukti jawaban, lalu PDINA memetakan konsep yang sudah dipahami dan yang masih perlu dikuatkan.',
  ],
  [
    GraduationCap,
    'Belajar bersama guru',
    'Ikuti pembelajaran di kelas. Guru melihat kebutuhan konsep siswa dan mengatur kapan fase pembelajaran dibuka.',
  ],
  [
    BookOpen,
    'Kuatkan satu per satu',
    'Pelajari materi yang direkomendasikan, contoh berlangkah, miskonsepsi, serta latihan penguatan. Tanyakan konsep kepada pendamping belajar.',
  ],
  [
    TrendingUp,
    'Lihat perubahanmu',
    'Kerjakan posttest setelah penguatan. Bandingkan hasil awal dan akhir dalam siklus yang sama, lalu tentukan langkah belajar berikutnya.',
  ],
];
const topics = [
  ['fungsi', 'Komposisi & invers fungsi', 'Hubungkan pemetaan, pahami urutan.'],
  ['geometri', 'Lingkaran & garis singgung', 'Temukan hubungan sudut dan panjang.'],
  ['statistik', 'Statistika', 'Baca data, temukan maknanya.'],
  ['peluang', 'Peluang', 'Pahami kemungkinan sebuah kejadian.'],
  ['aljabar', 'Matriks', 'Susun elemen, kuasai operasinya.'],
  ['transformasi', 'Transformasi geometri', 'Jelajahi pergeseran dan perubahan.'],
];
const questions = [
  [
    'Apa yang dimaksud learning gap?',
    'Learning gap adalah celah antara pemahaman yang diharapkan dan pemahaman yang ditunjukkan siswa. EduBridge membantu memetakannya per atribut konsep agar penguatan lebih terarah, bukan sekadar melihat nilai akhir.',
  ],
  [
    'Bagaimana CDA, CDM, dan PDINA bekerja bersama?',
    'CDA (Cognitive Diagnostic Assessment) mengumpulkan bukti melalui soal yang dipetakan ke atribut konsep dalam Q-matrix. CDM (Cognitive Diagnosis Model) menganalisis pola jawaban. PDINA adalah model yang digunakan untuk memperkirakan probabilitas penguasaan konsep. Persentase penguasaan berbeda dari persentase jawaban benar.',
  ],
  [
    'Bagaimana cara mulai menggunakan EduBridge?',
    'Siswa mendaftar menggunakan kode kelas dari guru. Guru mengatur kelas dan fase pembelajaran melalui akunnya. Akun guru disediakan administrator. Jika sudah memiliki akun, masuk untuk melanjutkan perjalanan belajar.',
  ],
  [
    'Apakah jawaban kosong langsung dianggap learning gap?',
    'Tidak. Jawaban kosong tidak menjadi bukti salah untuk PDINA. Atribut dengan bukti yang belum cukup ditandai sebagai belum cukup bukti, bukan langsung disimpulkan sebagai learning gap. Nilai kuis dan estimasi penguasaan ditampilkan terpisah.',
  ],
  [
    'Apakah AI menentukan nilai siswa?',
    'Tidak. Backend menilai jawaban berdasarkan kunci dan snapshot asesmen. PDINA menjalankan inferensi diagnosis lokal. Gemini membantu menjelaskan materi dan menyusun narasi berdasarkan fakta diagnosis; narasi melewati validator. Jika Gemini tidak tersedia, penjelasan lokal tetap tersedia. Pendamping diblokir selama asesmen aktif.',
  ],
  [
    'Apakah hasilnya sudah menjadi penilaian akademik final?',
    'Belum. Kalibrasi instrumen EduBridge saat ini memakai data sintetis. Estimasi perlu ditinjau guru bersama bukti pembelajaran dan memerlukan validasi pada siswa nyata sebelum menjadi dasar keputusan akademik. Perubahan pretest–posttest juga tidak membuktikan efek kausal pembelajaran.',
  ],
];
export default function Home() {
  const { user } = useApp();
  const [menu, setMenu] = useState(false);
  const destination = user ? homeFor(user.role) : '/register';
  return (
    <div
      className="hp"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setMenu(false);
      }}
    >
      <a className="hp-skip" href="#beranda">
        Lewati navigasi
      </a>
      <header className="hp-header">
        <div className="hp-nav hp-wrap">
          <Link className="hp-brand" to="/" aria-label="EduBridge beranda">
            <img src="/assets/images/logo.png" alt="" />
            <span>
              edu<b>bridge</b>
            </span>
          </Link>
          <nav
            id="homepage-navigation"
            className={`hp-links ${menu ? 'is-open' : ''}`}
            aria-label="Navigasi beranda"
          >
            {[
              ['cara-kerja', 'Cara kerja'],
              ['fitur', 'Fitur'],
              ['materi', 'Materi'],
              ['faq', 'FAQ'],
            ].map(([id, label]) => (
              <a href={`#${id}`} key={id} onClick={() => setMenu(false)}>
                {label}
              </a>
            ))}
          </nav>
          <div className="hp-nav-actions">
            <ThemeToggle />
            <Link className="hp-login" to={user ? homeFor(user.role) : '/login'}>
              {user ? 'Buka aplikasi' : 'Masuk'}
              <ArrowUpRight size={16} />
            </Link>
            <button
              type="button"
              className="hp-menu"
              aria-label={menu ? 'Tutup menu' : 'Buka menu'}
              aria-expanded={menu}
              aria-controls="homepage-navigation"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="beranda" tabIndex={-1}>
        <section className="hp-hero hp-wrap">
          <div className="hp-hero-copy">
            <span className="hp-kicker">
              <span /> MATEMATIKA · KELAS XI SMA
            </span>
            <h1>
              Paham konsepnya.
              <br />
              <em>Percaya langkahmu.</em>
            </h1>
            <p>
              Setiap siswa punya titik awal yang berbeda. Kenali celah pemahamanmu, kuatkan konsep
              bersama guru, dan lihat perkembanganmu setelah belajar.
            </p>
            <div className="hp-actions">
              <Link className="hp-button" to={destination}>
                {user ? 'Lanjutkan perjalanan' : 'Mulai perjalananmu'}
                <ArrowRight size={19} />
              </Link>
              <a className="hp-text-link" href="#cara-kerja">
                Kenali cara kerjanya
                <ChevronDown size={17} />
              </a>
            </div>
            <div className="hp-hero-note">
              <ShieldCheck size={17} />
              <span>Asesmen terarah. Penguatan sesuai kebutuhan.</span>
            </div>
          </div>
          <div className="hp-hero-art" aria-label="Ilustrasi perjalanan belajar EduBridge">
            <div className="hp-art-disc" />
            <span className="hp-art-star one">✦</span>
            <span className="hp-art-star two">✧</span>
            <div className="hp-mascot-label">
              <Sparkles size={17} />
              <span>
                Satu konsep lagi.
                <br />
                <strong>Kamu bisa!</strong>
              </span>
            </div>
            <img
              className="hp-mascot"
              src="/assets/mascots/quiz-ready.png"
              alt="Maskot astronaut EduBridge siap menemani perjalanan belajar"
              fetchPriority="high"
            />
            <div className="hp-mini-path">
              <div className="hp-mini-head">
                <span>LANGKAH KECIL, MAKIN PAHAM</span>
                <Zap size={17} />
              </div>
              <div className="hp-mini-nodes">
                {[Check, GraduationCap, BookOpen, LockKeyhole].map((Icon, i) => (
                  <span className={i < 2 ? 'done' : i === 2 ? 'current' : ''} key={i}>
                    <Icon size={23} />
                  </span>
                ))}
              </div>
              <div className="hp-mini-foot">
                <strong>Kuatkan konsep</strong>
                <span>Ilustrasi perjalanan belajar</span>
              </div>
            </div>
          </div>
        </section>
        <div className="hp-intro-band">
          <div className="hp-wrap">
            <span>BELAJAR DENGAN ARAH YANG JELAS</span>
            <p>
              <b>Kenali gap.</b> Pelajari konsepnya. <b>Ukur perkembangannya.</b>
            </p>
          </div>
        </div>
        <section id="cara-kerja" className="hp-section hp-wrap">
          <div className="hp-section-head">
            <div>
              <span className="hp-kicker">DARI TITIK AWAL KE LANGKAH BERIKUTNYA</span>
              <h2>
                Pemahaman tumbuh
                <br />
                lewat sebuah perjalanan.
              </h2>
            </div>
            <p>
              Asesmen sebelum dan sesudah pembelajaran membantu siswa dan guru melihat perubahan
              pada konsep yang sama.
            </p>
          </div>
          <div className="hp-steps">
            {steps.map(([Icon, title, body], i) => (
              <article key={title}>
                <div className={`hp-step-icon tone-${i}`}>
                  <Icon size={27} />
                </div>
                <span className="hp-step-number">LANGKAH 0{i + 1}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="fitur" className="hp-feature-section">
          <div className="hp-wrap">
            <div className="hp-section-head">
              <div>
                <span className="hp-kicker">LEBIH DARI SEKADAR NILAI</span>
                <h2>
                  Tahu bagian mana
                  <br />
                  yang perlu dikuatkan.
                </h2>
              </div>
              <p>
                Nilai memberikan gambaran umum. Diagnosis konsep membantu menentukan apa yang perlu
                dipelajari selanjutnya.
              </p>
            </div>
            <div className="hp-feature-grid">
              <article className="hp-diagnosis">
                <span className="hp-feature-eyebrow">
                  <Target size={19} />
                  PETA PEMAHAMAN
                </span>
                <h3>
                  Satu topik.
                  <br />
                  Konsep yang lebih terlihat.
                </h3>
                <div className="hp-concept-demo">
                  {[
                    ['Evaluasi fungsi', 86, 'teal'],
                    ['Komposisi fungsi', 42, 'blue'],
                    ['Invers fungsi', 61, 'amber'],
                  ].map(([label, value, color]) => (
                    <div key={label}>
                      <span>
                        {label}
                        <b>{value}%</b>
                      </span>
                      <div className={`hp-bar ${color}`}>
                        <i style={{ width: `${value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <small>Ilustrasi estimasi penguasaan, bukan hasil siswa nyata.</small>
              </article>
              <div className="hp-feature-list">
                {[
                  [
                    BookOpen,
                    'Materi yang menuntun langkahmu',
                    'Penjelasan bertahap, contoh penyelesaian, miskonsepsi umum, dan latihan mandiri untuk menguatkan fondasi.',
                  ],
                  [
                    Sparkles,
                    'Teman memahami, saat dibutuhkan',
                    'Tanyakan konsep kepada pendamping. Penjelasan Gemini didukung materi, dengan penjelasan lokal saat layanan tidak tersedia.',
                  ],
                  [
                    TrendingUp,
                    'Perkembangan yang bisa ditelusuri',
                    'Lihat hasil awal dan akhir, penguasaan atribut, riwayat asesmen, serta konsep yang masih membutuhkan perhatian.',
                  ],
                ].map(([Icon, title, body]) => (
                  <article key={title}>
                    <span>
                      <Icon size={23} />
                    </span>
                    <div>
                      <h3>{title}</h3>
                      <p>{body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="hp-section hp-wrap" id="peran">
          <div className="hp-section-head centered">
            <span className="hp-kicker">SATU EKOSISTEM, SALING MENDUKUNG</span>
            <h2>Belajar adalah kerja bersama.</h2>
            <p>
              Siswa mengambil langkahnya, guru memberi arah, dan admin menjaga ruang belajar tetap
              terkelola.
            </p>
          </div>
          <div className="hp-role-grid">
            {[
              [
                BookOpen,
                'Untuk siswa',
                'Temukan ritme belajarmu.',
                [
                  'Jalur pretest sampai posttest',
                  'Materi dan latihan penguatan',
                  'Profil, progres, dan pencapaian',
                ],
              ],
              [
                GraduationCap,
                'Untuk guru',
                'Kenali kebutuhan di kelasmu.',
                [
                  'Atur kelas dan fase pembelajaran',
                  'Lihat peta konsep dan detail siswa',
                  'Ringkasan kelas dan ekspor hasil',
                ],
              ],
              [
                ShieldCheck,
                'Untuk admin',
                'Kelola ekosistem belajarnya.',
                [
                  'Kelola akun dan akses pengguna',
                  'Tinjau materi serta bank soal',
                  'Pantau status layanan diagnosis',
                ],
              ],
            ].map(([Icon, role, title, items]) => (
              <article key={role}>
                <Icon size={29} />
                <span>{role}</span>
                <h3>{title}</h3>
                <ul>
                  {items.map((item) => (
                    <li key={item}>
                      <Check size={16} />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link to={user ? homeFor(user.role) : '/login'}>
                  {user ? 'Buka ruang belajarmu' : 'Masuk ke EduBridge'}
                  <ArrowRight size={17} />
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section id="materi" className="hp-topics-section">
          <div className="hp-wrap">
            <div className="hp-section-head">
              <div>
                <span className="hp-kicker">RUANG UNTUK MAKIN PAHAM</span>
                <h2>
                  Matematika XI,
                  <br />
                  satu konsep setiap langkah.
                </h2>
              </div>
              <p>
                Enam topik, 18 atribut konsep, dan 180 soal pretest/posttest berbahasa Indonesia
                untuk mendukung asesmen dan penguatan.
              </p>
            </div>
            <div className="hp-topics">
              {topics.map(([id, title, body]) => (
                <Link key={id} to={user ? `/materi/${id}` : '/register'}>
                  <div className={`hp-topic-icon ${id}`}>
                    <TopicIllustration id={id} />
                  </div>
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                  <ArrowUpRight size={20} />
                </Link>
              ))}
            </div>
            <p className="hp-topic-note">Akses materi dan jalur belajar melalui akun kelasmu.</p>
          </div>
        </section>
        <section className="hp-section hp-wrap">
          <div className="hp-motivation">
            <div className="hp-motivation-art">
              <img
                src="/assets/mascots/quiz-celebrate.png"
                alt="Maskot EduBridge merayakan usaha belajar dengan piala bintang"
                loading="lazy"
              />
              <span>
                <Star size={20} fill="currentColor" />
                Rayakan usahamu
              </span>
            </div>
            <div>
              <span className="hp-kicker">USAHA KECIL JUGA BERARTI</span>
              <h2>
                Jaga semangatnya.
                <br />
                Bangun kebiasaannya.
              </h2>
              <p>
                Kumpulkan XP dari aktivitas belajar, bangun streak, naikkan level, dan buka lencana
                pencapaian. Setiap langkah punya tempat untuk dirayakan.
              </p>
              <div className="hp-rewards">
                <span>
                  <Zap />
                  XP & level
                </span>
                <span>
                  <Flame />
                  Streak belajar
                </span>
                <span>
                  <Trophy />
                  Lencana
                </span>
              </div>
              <small>
                Gamifikasi mendukung kebiasaan belajar; diagnosis tetap mengikuti bukti asesmen.
              </small>
            </div>
          </div>
        </section>
        <section id="faq" className="hp-faq hp-wrap">
          <div>
            <span className="hp-kicker">KENALI EDUBRIDGE LEBIH DEKAT</span>
            <h2>Masih penasaran?</h2>
            <p>Beberapa hal yang perlu kamu tahu sebelum memulai.</p>
            <div className="hp-science-note">
              <ShieldCheck size={24} />
              <strong>Estimasi yang transparan.</strong>
              <p>
                PDINA berjalan secara lokal. Kalibrasi instrumen saat ini masih sintetis dan
                hasilnya perlu ditinjau bersama guru.
              </p>
            </div>
          </div>
          <div className="hp-faq-list">
            {questions.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <ChevronDown size={19} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="hp-wrap hp-final">
          <div>
            <span className="hp-kicker">LANGKAH BERIKUTNYA DIMULAI DI SINI</span>
            <h2>
              Siap membangun
              <br />
              pemahamanmu?
            </h2>
            <p>Siapkan kode kelas dari gurumu, lalu mulai perjalanan belajarmu.</p>
          </div>
          <Link className="hp-button" to={destination}>
            {user ? 'Lanjut ke aplikasimu' : 'Mulai belajar'}
            <ArrowRight size={20} />
          </Link>
        </section>
      </main>
      <footer className="hp-footer hp-wrap">
        <div>
          <Link className="hp-brand" to="/">
            <img src="/assets/images/logo.png" alt="" />
            <span>
              edu<b>bridge</b>
            </span>
          </Link>
          <p>
            Kenali. Pelajari. Kuasai.
            <br />
            Matematika kelas XI, bersama EduBridge.
          </p>
        </div>
        <nav aria-label="Navigasi footer">
          <a href="#cara-kerja">Cara kerja</a>
          <a href="#fitur">Fitur</a>
          <a href="#materi">Materi</a>
          <a href="#faq">FAQ</a>
          <Link to="/login">Masuk</Link>
          <Link to="/register">Daftar siswa</Link>
        </nav>
        <small>
          CDA · CDM · P-DINA
          <br />
          Dirancang untuk pembelajaran di kelas.
        </small>
      </footer>
    </div>
  );
}
