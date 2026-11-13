import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import heroMascot from '../../assets/images/mascots copy/mascot-2-1-2.png';
import progressMascot from '../../assets/images/mascots copy/cheer.png';
import { quizTopics } from './quizData';

const STORAGE_KEY = 'edubridge-quiz-attempts';
const defaultMastery = {
  aljabar: 92,
  geometri: 78,
  fungsi: 70,
  statistik: 64,
  peluang: 58,
  kalkulus: 50,
};

const reminders = [
  { title: 'Aljabar', topicId: 'aljabar', time: '10 menit lagi', color: '#8D7DCB', icon: '⬡' },
  { title: 'Persamaan Kuadrat', topicId: 'aljabar', time: '1 jam lagi', color: '#42C6B0', icon: '◷' },
  { title: 'Geometri', topicId: 'geometri', time: '2 jam lagi', color: '#F56F9B', icon: '△' },
];

function readQuizAttempts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const results = saved ? JSON.parse(saved) : {};
    return { ...results, attempts: results.attempts ?? {} };
  } catch (error) {
    console.error('Gagal membaca hasil kuis untuk dashboard:', error);
    return { attempts: {} };
  }
}

function getMastery(topic, attempts) {
  return attempts[topic.id]?.posttest?.score
    ?? attempts[topic.id]?.pretest?.score
    ?? defaultMastery[topic.id]
    ?? 0;
}

function getMasteryLabel(score) {
  if (score >= 80) return { text: 'Sudah dikuasai', color: '#42C6B0' };
  if (score >= 60) return { text: 'Sedang berkembang', color: '#FFB43A' };
  return { text: 'Perlu penguatan', color: '#F56F9B' };
}

const Dashboard = () => {
  const [results] = useState(readQuizAttempts);
  const [todayTimestamp] = useState(() => Date.now());
  const attempts = results.attempts;
  const mastery = useMemo(() => quizTopics.map((topic) => ({
    ...topic,
    score: getMastery(topic, attempts),
  })), [attempts]);
  const recommendations = [...mastery].sort((a, b) => a.score - b.score).slice(0, 3);
  const averageMastery = Math.round(mastery.reduce((total, topic) => total + topic.score, 0) / mastery.length);
  const weeklyActivity = useMemo(() => {
    const scoresByDay = Array.from({ length: 7 }, () => []);
    const weekdays = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    const endOfToday = new Date(todayTimestamp);
    endOfToday.setHours(23, 59, 59, 999);
    const firstDay = new Date(endOfToday);
    firstDay.setDate(firstDay.getDate() - 6);
    firstDay.setHours(0, 0, 0, 0);

    Object.values(attempts).forEach((topicAttempts) => {
      Object.values(topicAttempts).forEach((attempt) => {
        if (!attempt.attemptedAt) return;
        const attemptedAt = new Date(attempt.attemptedAt);
        if (attemptedAt < firstDay || attemptedAt > endOfToday) return;
        const dayIndex = Math.floor((attemptedAt - firstDay) / 86400000);
        if (dayIndex >= 0 && dayIndex < scoresByDay.length) scoresByDay[dayIndex].push(attempt.score);
      });
    });

    return scoresByDay.map((scores, index) => {
      const date = new Date(firstDay.getTime());
      date.setDate(date.getDate() + index);
      return {
        day: weekdays[(date.getDay() + 6) % 7],
        score: scores.length
          ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
          : null,
      };
    });
  }, [attempts, todayTimestamp]);
  const chartScores = weeklyActivity
    .map(({ score }) => score)
    .filter((score) => score !== null);
  const chartPoints = weeklyActivity.map(({ score }, index) => {
    const x = 26 + index * 21;
    const y = score === null ? 110 : 110 - score * 0.9;
    return `${x},${y}`;
  }).join(' ');

  const testCards = [
    {
      mode: 'pretest',
      title: 'Pre-Test',
      subtitle: 'Cek Kemampuan Awal',
      description: 'Pemetaan awal untuk mengetahui penguasaan materi dan learning gap-mu',
      gradient: 'from-[#B8E0FF] to-[#7FCBFF]',
      outline: '#53C9FF',
      result: attempts.aljabar?.pretest,
    },
    {
      mode: 'posttest',
      title: 'Post-Test',
      subtitle: 'Uji Penguasaan Materi',
      description: 'Lihat seberapa jauh pemahamanmu setelah belajar.',
      gradient: 'from-[#ECEBFF] to-[#D9D4FF]',
      outline: '#A99AFF',
      result: attempts.aljabar?.posttest,
    },
  ];

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 items-stretch gap-4 font-poppins text-[#2A42A1] xl:grid-cols-12">
        <section className="relative flex min-h-[145px] items-center overflow-hidden rounded-[26px] bg-gradient-to-r from-[#A9DEF3] via-[#C4E8F8] to-[#D9F0FF] px-5 py-5 xl:col-span-7">
          <div className="relative z-10 max-w-[76%]">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[#2A42A1] sm:text-[30px]">
              Halo, Nadia! <span className="text-xl" aria-hidden="true">👋</span>
            </h1>
            <p className="mt-1 text-xs sm:text-sm">Yuk lanjutkan perjalanan matematikamu hari ini!</p>
            <p className="mt-3 inline-flex items-center gap-1 rounded-xl bg-white/80 px-3 py-1.5 text-[10px] font-semibold text-[#3A81DA] sm:text-xs">
              ⭐ Kamu hebat! Setiap langkah kecil adalah kemajuan besar 💗
            </p>
          </div>
          <img src={heroMascot} alt="Maskot EduBridge membaca buku" className="absolute -bottom-2 right-1 h-[130px] w-[120px] object-contain sm:right-4 sm:h-[150px] sm:w-[140px]" />
          <span className="absolute bottom-5 right-[26%] text-2xl text-[#FFD45A]" aria-hidden="true">✦</span>
        </section>

        <section className="rounded-[24px] border border-[#D5DFEC] bg-gradient-to-br from-[#F2F7FC] to-[#E9E2C7] p-4 xl:col-span-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <img src="/assets/images/reminder-icon.png" alt="" className="h-10 w-10 object-contain" />
              <h2 className="text-base font-extrabold">Pengingat Belajar</h2>
            </div>
            <Link to="/katalog" className="rounded-full bg-[#3A81DA] px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-[#2A42A1]">Lihat Semua →</Link>
          </div>
          <p className="mb-2 text-[10px]">Kamu punya 3 materi yang perlu dipelajari hari ini!</p>
          <div className="space-y-1.5">
            {reminders.map((reminder) => (
              <Link key={reminder.title} to={`/kuis?subject=${reminder.topicId}&mode=pretest`} className="flex items-center justify-between gap-2 rounded-lg border border-[#E6E0D3] bg-white/90 px-2.5 py-2 transition hover:border-[#3A81DA] hover:bg-white">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs text-white" style={{ backgroundColor: reminder.color }}>{reminder.icon}</span>
                  <span className="truncate text-[10px] font-bold">{reminder.title}</span>
                </span>
                <span className="shrink-0 text-[9px] font-semibold text-[#5274B4]">◷ {reminder.time}</span>
              </Link>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-7">
          {testCards.map((test) => (
            <section key={test.mode} className={`relative min-h-[130px] overflow-hidden rounded-[22px] border bg-gradient-to-br ${test.gradient} p-4`} style={{ borderColor: test.outline }}>
              <img src="/assets/images/test-icon.png" alt="" className="absolute right-2 top-2 h-11 w-11 object-contain" />
              <h2 className="text-2xl font-extrabold">{test.title}</h2>
              <p className="mt-1 text-[10px] font-bold">{test.subtitle}</p>
              <p className="mt-1 max-w-[230px] text-[9px] leading-relaxed">{test.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-[8px] font-bold text-[#5D9C93]">
                  ● {test.result ? `Nilai ${test.result.score}/100` : test.mode === 'pretest' ? 'Belum dikerjakan' : 'Siap dikerjakan'}
                </span>
                <Link to={`/kuis?subject=aljabar&mode=${test.mode}`} className="rounded-full bg-[#3A81DA] px-3 py-1.5 text-[9px] font-bold text-white transition hover:bg-[#2A42A1]">
                  Mulai {test.title} →
                </Link>
              </div>
            </section>
          ))}
        </div>

        <aside className="row-span-2 flex flex-col gap-3 xl:col-span-5">
          <div className="relative flex min-h-[145px] flex-1 items-center justify-end overflow-hidden rounded-[24px] bg-gradient-to-br from-[#F4F7FC] to-[#E9F2FF] px-4">
            <span className="absolute left-5 top-6 text-3xl text-[#8D7DCB]" aria-hidden="true">✦</span>
            <span className="absolute left-[38%] top-12 text-2xl text-[#FFD45A]" aria-hidden="true">✧</span>
            <img src={progressMascot} alt="Maskot EduBridge menyemangati belajar" className="h-[150px] max-w-[76%] object-contain object-bottom sm:h-[180px]" />
            <span className="absolute bottom-8 left-[38%] text-3xl" aria-hidden="true">🚀</span>
          </div>
          <section className="min-h-[205px] rounded-[22px] border border-[#A9B7CB] bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <img src="/assets/images/chart-icon.png" alt="" className="h-9 w-9 object-contain" />
              <h2 className="text-sm font-extrabold text-[#3A81DA]">Progres Minggu Ini</h2>
            </div>
            <div className="relative h-[130px] pl-7">
              <div className="absolute inset-y-0 left-0 flex flex-col justify-between pb-5 text-[8px] text-[#6680B2]">
                <span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span>
              </div>
              <svg viewBox="0 0 160 120" className="h-[108px] w-full" role="img" aria-label="Grafik rata-rata nilai kuis minggu ini">
                {[20, 42, 64, 86, 110].map((y) => <line key={y} x1="20" y1={y} x2="154" y2={y} stroke="#E8EEF7" strokeWidth="1" />)}
                {chartScores.length > 0 && <>
                  <polygon points={`26,110 ${chartPoints} 152,110`} fill="#D9E7FF" opacity=".8" />
                  <polyline points={chartPoints} fill="none" stroke="#4E82DB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  {weeklyActivity.map(({ score }, index) => score !== null && <circle key={index} cx={26 + index * 21} cy={110 - score * 0.9} r="2.5" fill="#4E82DB" />)}
                </>}
              </svg>
              <div className="absolute bottom-0 left-7 right-0 flex justify-between text-[8px] text-[#526A9C]">
                {weeklyActivity.map(({ day }, index) => <span key={`${day}-${index}`}>{day}</span>)}
              </div>
            </div>
            {chartScores.length === 0 && <p className="mt-1 text-center text-[9px] text-gray-500">Nilai kuis akan tampil setelah kamu menyelesaikan kuis.</p>}
          </section>
        </aside>

        <section className="rounded-[22px] border border-[#A9B7CB] bg-white p-4 sm:p-5 xl:col-span-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <img src="/assets/images/target-icon.png" alt="" className="h-10 w-10 object-contain" />
              <div>
                <h2 className="text-sm font-extrabold">Rekomendasi Belajar Hari Ini</h2>
                <p className="text-[9px]">Topik sesuai penguasaanmu saat ini.</p>
              </div>
            </div>
            <Link to="/katalog" className="shrink-0 rounded-full bg-[#3A81DA] px-3 py-1.5 text-[9px] font-bold text-white transition hover:bg-[#2A42A1]">Lihat Semua</Link>
          </div>
          <div className="space-y-3">
            {recommendations.map((topic) => {
              const status = getMasteryLabel(topic.score);
              return (
                <Link key={topic.id} to={`/kuis?subject=${topic.id}&mode=${topic.score < 60 ? 'remedial' : 'pretest'}`} className="block rounded-[15px] bg-[#DCE8F6] p-3 transition hover:bg-[#C9DEF4]">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm text-white" style={{ backgroundColor: topic.color }}>{topic.icon}</span>
                      <div className="min-w-0">
                        <h3 className="truncate text-[11px] font-extrabold">{topic.name}</h3>
                        <span className="rounded-full bg-white px-1.5 py-0.5 text-[8px] font-bold" style={{ color: status.color }}>● {status.text}</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-semibold">{topic.score}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#D9D9D9]">
                    <div className="h-full rounded-full transition-all" style={{ width: `${topic.score}%`, backgroundColor: status.color }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-[22px] border border-[#A9B7CB] bg-white p-4 sm:p-5 xl:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <img src="/assets/images/level-icon.png" alt="" className="h-10 w-10 object-contain" />
              <h2 className="text-sm font-extrabold">Tingkatkan Penguasaan Materi</h2>
            </div>
            <span className="shrink-0 rounded-full bg-[#3A81DA] px-2.5 py-1.5 text-[8px] font-bold text-white">{averageMastery}% rata-rata</span>
          </div>
          <div className="space-y-2">
            {mastery.filter((topic) => ['aljabar', 'geometri', 'statistik', 'kalkulus'].includes(topic.id)).map((topic) => (
              <Link key={topic.id} to={`/kuis?subject=${topic.id}&mode=pretest`} className="block rounded-[13px] bg-[#DCE8F6] p-2.5 transition hover:bg-[#C9DEF4]">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[11px] font-extrabold">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ backgroundColor: topic.color }}>{topic.icon}</span>
                    {topic.name}
                  </span>
                  <span className="text-[9px] font-semibold">{topic.score}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#D9D9D9]">
                  <div className="h-full rounded-full transition-all" style={{ width: `${topic.score}%`, backgroundColor: topic.color }} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
