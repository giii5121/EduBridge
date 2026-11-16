import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import bookMascot from '../../assets/images/mascots/book.png';
import starMascot from '../../assets/images/mascots/star.png';
import { readQuizResults } from '../../utils/storage';

const categories = ['Semua Materi', 'Aljabar', 'Geometri', 'Fungsi', 'Statistik', 'Peluang'];

const lessons = [
  { id: 1, title: 'Persamaan Linear', category: 'Aljabar', description: 'Mengenal persamaan linear satu variabel', questions: 10, minutes: 15, status: 'pre', symbol: '∑', tint: '#FFF0C3', icon: '#FFDC77' },
  { id: 2, title: 'Bangun Datar', category: 'Geometri', description: 'Luas dan keliling bangun datar', questions: 12, minutes: 20, status: 'post', symbol: 'π', tint: '#D4DFF5', icon: '#7085CD' },
  { id: 3, title: 'Statistika Dasar', category: 'Statistik', description: 'Rata-rata, median, dan modus', questions: 8, minutes: 15, status: 'locked', symbol: '⌁', tint: '#F5DDEB', icon: '#F58CBB' },
  { id: 4, title: 'Pengenalan Fungsi', category: 'Fungsi', description: 'Memahami fungsi dan grafiknya', questions: 10, minutes: 15, status: 'done', symbol: 'ƒx', tint: '#CBEDEF', icon: '#67CEC6' },
  { id: 5, title: 'Peluang Sederhana', category: 'Peluang', description: 'Menghitung peluang kejadian', questions: 10, minutes: 15, status: 'pre', symbol: '◇', tint: '#E6DDF7', icon: '#B9A0ED' },
];

const todayLessons = lessons.filter(({ category }) => ['Aljabar', 'Geometri', 'Fungsi'].includes(category));

const badge = {
  pre: 'Mulai Pre-Test',
  post: 'Mulai Post-Test',
  locked: '🔒 Terkunci',
  done: '✓ Selesai',
};

function getQuizMode(status) {
  return status === 'post' || status === 'done' ? 'posttest' : 'pretest';
}

export default function KatalogMateri() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('Semua Materi');
  const [search, setSearch] = useState('');
  const [showTodayLessons, setShowTodayLessons] = useState(false);
  const [quizResults] = useState(readQuizResults);

  const filtered = useMemo(() => lessons.filter((lesson) => (
    (category === 'Semua Materi' || lesson.category === category)
    && `${lesson.title} ${lesson.description} ${lesson.category}`.toLowerCase().includes(search.toLowerCase())
  )), [category, search]);

  const geometryAssessment = quizResults.attempts?.geometri?.pretest;
  const geometryScore = geometryAssessment?.score;
  const masteryText = geometryScore === undefined
    ? 'Belum ada hasil assessment'
    : `Penguasaan ${geometryScore}%`;
  const reminderAction = geometryAssessment ? 'Remedial' : 'Mulai pre-test';

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1600px] font-poppins text-[#2A42A1]">
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(290px,1fr)]">
          <section className="min-w-0 space-y-6">
            <div className="relative flex min-h-[170px] items-center overflow-hidden rounded-[28px] bg-gradient-to-r from-[#DDF6FF] via-[#EFF9FF] to-[#C6E6FF] px-8 py-7 shadow-md">
              <div className="relative z-10 max-w-[72%]">
                <h1 className="mb-4 text-3xl font-extrabold md:text-4xl">Katalog Materi</h1>
                <p className="text-sm font-semibold leading-relaxed">
                  Pilih materi yang ingin kamu pelajari. Selesaikan pre-test terlebih dahulu,
                  lalu lanjutkan belajar sesuai rekomendasi sistem.
                </p>
              </div>
              <img
                src={bookMascot}
                alt="Astronaut membaca"
                className="absolute bottom-0 right-3 h-[145px] object-contain md:h-[170px]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-full border px-4 py-3 text-xs font-semibold transition ${
                    category === cat
                      ? 'border-[#3A81DA] bg-[#3A81DA] text-white'
                      : 'border-gray-300 bg-white text-[#253E8C] hover:bg-blue-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <label htmlFor="catalog-search" className="sr-only">Cari materi</label>
              <input
                id="catalog-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="🔎 Cari materi, topik, atau kata kunci..."
                className="w-full p-2 text-sm text-[#253E8C] outline-none"
              />
            </div>

            <div className="space-y-4">
              {filtered.length ? (
                filtered.map((lesson) => (
                  <article
                    key={lesson.id}
                    className="flex flex-col gap-4 rounded-2xl p-4 shadow-sm sm:flex-row sm:items-center"
                    style={{ background: lesson.tint }}
                  >
                    <div
                      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-4xl font-bold shadow-md"
                      style={{ background: lesson.icon }}
                    >
                      {lesson.symbol}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-extrabold md:text-2xl">{lesson.title}</h2>
                      <p className="text-xs text-gray-600">{lesson.description}</p>
                      <div className="mt-5 flex flex-wrap gap-4 text-xs font-semibold text-gray-600">
                        <span>▤ {lesson.questions} soal</span>
                        <span>◷ {lesson.minutes} menit</span>
                        <span>{lesson.category}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={lesson.status === 'locked'}
                      onClick={() => navigate(`/kuis?subject=${lesson.category.toLowerCase()}&mode=${getQuizMode(lesson.status)}`)}
                      className="rounded-2xl border border-gray-300 bg-white px-4 py-3 font-bold text-[#3A81DA] shadow-md hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-70 sm:w-[170px]"
                    >
                      {badge[lesson.status]}
                    </button>
                  </article>
                ))
              ) : (
                <p className="rounded-2xl bg-white p-8 text-center">
                  Materi tidak ditemukan. Coba kata kunci lain.
                </p>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[26px] bg-gradient-to-r from-[#B7E5F7] to-[#DDE9F9] p-6">
              <h2 className="mb-6 text-2xl font-extrabold">▦ Materi Hari Ini</h2>
              <button
                type="button"
                aria-expanded={showTodayLessons}
                onClick={() => setShowTodayLessons((show) => !show)}
                className="w-full rounded-2xl bg-white p-4 text-left font-bold shadow-md transition hover:bg-blue-50"
              >
                ▤ 3 Materi baru <span className="float-right" aria-hidden="true">{showTodayLessons ? '−' : '+'}</span>
              </button>
              {showTodayLessons && (
                <div className="mt-3 space-y-2">
                  {todayLessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => navigate(`/kuis?subject=${lesson.category.toLowerCase()}&mode=pretest`)}
                      className="flex w-full items-center justify-between rounded-xl bg-white/80 p-3 text-left text-sm font-semibold transition hover:bg-white"
                    >
                      <span>{lesson.title}</span>
                      <span className="text-xs text-[#3A81DA]">Buka materi →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[26px] bg-white p-6 shadow-md">
              <h2 className="text-2xl font-extrabold">🔔 Reminder Belajar</h2>
              <p className="mb-5 text-sm">Kamu masih perlu mengulang materi ini:</p>
              <button
                type="button"
                onClick={() => navigate(`/kuis?subject=geometri&mode=${geometryAssessment ? 'remedial' : 'pretest'}`)}
                className="mb-4 w-full rounded-xl border p-4 text-left text-sm shadow-sm transition hover:border-[#3A81DA] hover:bg-blue-50"
              >
                <b>Geometri</b>
                <p>{masteryText}</p>
                <span className="mt-2 inline-block font-bold text-[#3A81DA]">{reminderAction} →</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/kuis?subject=geometri&mode=posttest')}
                className="w-full rounded-xl border p-4 text-left text-xs transition hover:border-[#3A81DA] hover:bg-blue-50"
              >
                ⏰ Jangan lupa kerjakan post-test setelah kamu selesai belajar ya!
                <span className="mt-2 block font-bold text-[#3A81DA]">Mulai Post-Test Geometri →</span>
              </button>
            </div>

            <div className="relative min-h-[270px] overflow-hidden rounded-[26px] bg-white p-6 shadow-md">
              <h2 className="mb-6 text-xl font-extrabold">Alur Belajar Materi</h2>
              <div className="relative z-10 space-y-5 text-sm font-semibold">
                <p>📘 Pelajari Materi</p>
                <p>📝 Kerjakan Latihan</p>
                <p>💗 Post-Test</p>
              </div>
              <img src={starMascot} alt="Maskot semangat belajar" className="absolute bottom-0 right-0 h-28" />
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
