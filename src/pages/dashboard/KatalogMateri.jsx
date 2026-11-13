import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import bookMascot from '../../assets/images/mascots copy/book.png';
import starMascot from '../../assets/images/mascots copy/star.png';

const categories = ['Semua Materi', 'Aljabar', 'Geometri', 'Fungsi', 'Statistik', 'Peluang'];
const lessons = [
  { id: 1, title: 'Persamaan Linear', category: 'Aljabar', description: 'Mengenal persamaan linear satu variabel', questions: 10, minutes: 15, status: 'pre', symbol: '∑', tint: '#FFF0C3', icon: '#FFDC77' },
  { id: 2, title: 'Bangun Datar', category: 'Geometri', description: 'Luas dan keliling bangun datar', questions: 12, minutes: 20, status: 'post', symbol: 'π', tint: '#D4DFF5', icon: '#7085CD' },
  { id: 3, title: 'Statistika Dasar', category: 'Statistik', description: 'Rata-rata, median, dan modus', questions: 8, minutes: 15, status: 'locked', symbol: '⌁', tint: '#F5DDEB', icon: '#F58CBB' },
  { id: 4, title: 'Pengenalan Fungsi', category: 'Fungsi', description: 'Memahami fungsi dan grafiknya', questions: 10, minutes: 15, status: 'done', symbol: 'ƒx', tint: '#CBEDEF', icon: '#67CEC6' },
  { id: 5, title: 'Peluang Sederhana', category: 'Peluang', description: 'Menghitung peluang kejadian', questions: 10, minutes: 15, status: 'pre', symbol: '◇', tint: '#E6DDF7', icon: '#B9A0ED' },
];
const todayLessons = lessons.filter(({ category }) => ['Aljabar', 'Geometri', 'Fungsi'].includes(category));
const badge = { pre: 'Mulai Pre-Test', post: 'Mulai Post-Test', locked: '🔒 Terkunci', done: '✓ Selesai' };

function readQuizAttempts() {
  try {
    const saved = localStorage.getItem('edubridge-quiz-attempts');
    return saved ? JSON.parse(saved) : { attempts: {} };
  } catch (error) {
    console.error('Gagal membaca hasil assessment:', error);
    return { attempts: {} };
  }
}

export default function KatalogMateri() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('Semua Materi');
  const [search, setSearch] = useState('');
  const [showTodayLessons, setShowTodayLessons] = useState(false);
  const [quizResults] = useState(readQuizAttempts);
  const filtered = useMemo(() => lessons.filter(m => (category === 'Semua Materi' || m.category === category) && `${m.title} ${m.description} ${m.category}`.toLowerCase().includes(search.toLowerCase())), [category, search]);
  const geometryAssessment = quizResults.attempts?.geometri?.pretest;
  const geometryScore = geometryAssessment?.score;
  const masteryText = geometryScore === undefined
    ? 'Belum ada hasil assessment'
    : `Penguasaan ${geometryScore}%`;
  const reminderAction = geometryAssessment
    ? 'Remedial'
    : 'Mulai pre-test';

  return <DashboardLayout>
    <div className="font-poppins text-[#2A42A1] max-w-[1600px] mx-auto">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(290px,1fr)] gap-6 items-start">
        <section className="space-y-6 min-w-0">
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#DDF6FF] via-[#EFF9FF] to-[#C6E6FF] shadow-md min-h-[170px] px-8 py-7 flex items-center">
            <div className="relative z-10 max-w-[72%]"><h1 className="text-3xl md:text-4xl font-extrabold mb-4">Katalog Materi</h1><p className="text-sm font-semibold leading-relaxed">Pilih materi yang ingin kamu pelajari. Selesaikan pre-test terlebih dahulu, lalu lanjutkan belajar sesuai rekomendasi sistem.</p></div>
            <img src={bookMascot} alt="Astronaut membaca" className="absolute right-3 bottom-0 h-[145px] md:h-[170px] object-contain" />
          </div>
          <div className="flex flex-wrap gap-2">{categories.map(cat => <button key={cat} onClick={() => setCategory(cat)} className={`rounded-full px-4 py-3 text-xs font-semibold border transition ${category === cat ? 'bg-[#3A81DA] text-white border-[#3A81DA]' : 'bg-white text-[#253E8C] border-gray-300 hover:bg-blue-50'}`}>{cat}</button>)}</div>
          <div className="bg-white rounded-2xl p-3 shadow-sm"><label htmlFor="catalog-search" className="sr-only">Cari materi</label><input id="catalog-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔎 Cari materi, topik, atau kata kunci..." className="w-full p-2 outline-none text-sm text-[#253E8C]" /></div>
          <div className="space-y-4">{filtered.length ? filtered.map(m => <article key={m.id} className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl p-4 shadow-sm" style={{background:m.tint}}>
            <div className="w-20 h-20 shrink-0 rounded-2xl flex items-center justify-center text-4xl font-bold shadow-md" style={{background:m.icon}}>{m.symbol}</div>
            <div className="flex-1 min-w-0"><h2 className="text-xl md:text-2xl font-extrabold">{m.title}</h2><p className="text-xs text-gray-600">{m.description}</p><div className="flex flex-wrap gap-4 text-xs text-gray-600 font-semibold mt-5"><span>▤ {m.questions} soal</span><span>◷ {m.minutes} menit</span><span>{m.category}</span></div></div>
            <button disabled={m.status==='locked'} onClick={()=>navigate(`/kuis?subject=${m.category.toLowerCase()}&mode=${m.status === 'post' || m.status === 'done' ? 'posttest' : 'pretest'}`)} className="sm:w-[170px] bg-white border border-gray-300 rounded-2xl px-4 py-3 text-[#3A81DA] font-bold shadow-md hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-70">{badge[m.status]}</button>
          </article>) : <p className="rounded-2xl bg-white p-8 text-center">Materi tidak ditemukan. Coba kata kunci lain.</p>}</div>
        </section>
        <aside className="space-y-6">
          <div className="rounded-[26px] bg-gradient-to-r from-[#B7E5F7] to-[#DDE9F9] p-6">
            <h2 className="mb-6 text-2xl font-extrabold">▦ Materi Hari Ini</h2>
            <button type="button" aria-expanded={showTodayLessons} onClick={() => setShowTodayLessons((show) => !show)} className="w-full rounded-2xl bg-white p-4 text-left font-bold shadow-md transition hover:bg-blue-50">
              ▤ 3 Materi baru <span className="float-right" aria-hidden="true">{showTodayLessons ? '−' : '+'}</span>
            </button>
            {showTodayLessons && (
              <div className="mt-3 space-y-2">
                {todayLessons.map((lesson) => (
                  <button key={lesson.id} type="button" onClick={() => navigate(`/kuis?subject=${lesson.category.toLowerCase()}&mode=pretest`)} className="flex w-full items-center justify-between rounded-xl bg-white/80 p-3 text-left text-sm font-semibold transition hover:bg-white">
                    <span>{lesson.title}</span><span className="text-xs text-[#3A81DA]">Buka materi →</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-[26px] bg-white p-6 shadow-md">
            <h2 className="text-2xl font-extrabold">🔔 Reminder Belajar</h2>
            <p className="mb-5 text-sm">Kamu masih perlu mengulang materi ini:</p>
            <button type="button" onClick={() => navigate(`/kuis?subject=geometri&mode=${geometryAssessment ? 'remedial' : 'pretest'}`)} className="mb-4 w-full rounded-xl border p-4 text-left text-sm shadow-sm transition hover:border-[#3A81DA] hover:bg-blue-50">
              <b>Geometri</b>
              <p>{masteryText}</p>
              <span className="mt-2 inline-block font-bold text-[#3A81DA]">{reminderAction} →</span>
            </button>
            <button type="button" onClick={() => navigate('/kuis?subject=geometri&mode=posttest')} className="w-full rounded-xl border p-4 text-left text-xs transition hover:border-[#3A81DA] hover:bg-blue-50">
              ⏰ Jangan lupa kerjakan post-test setelah kamu selesai belajar ya!
              <span className="mt-2 block font-bold text-[#3A81DA]">Mulai Post-Test Geometri →</span>
            </button>
          </div>
          <div className="rounded-[26px] bg-white shadow-md p-6 relative overflow-hidden min-h-[270px]"><h2 className="text-xl font-extrabold mb-6">Alur Belajar Materi</h2><div className="space-y-5 text-sm font-semibold relative z-10"><p>📘 Pelajari Materi</p><p>📝 Kerjakan Latihan</p><p>💗 Post-Test</p></div><img src={starMascot} alt="Maskot semangat belajar" className="absolute right-0 bottom-0 h-28" /></div>
        </aside>
      </div>
    </div>
  </DashboardLayout>;
}
