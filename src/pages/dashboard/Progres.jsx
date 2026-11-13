import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import progressMascot from '../../assets/images/mascots copy/cheer.png';
import { quizTopics } from './quizData';

const STORAGE_KEY = 'edubridge-quiz-attempts';
const CORE_MODES = ['pretest', 'posttest'];
const CORE_QUIZ_COUNT = quizTopics.length * CORE_MODES.length;
const EMPTY_ATTEMPTS = {};

function readAttempts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { attempts: {} };
  } catch (error) {
    console.error('Gagal membaca hasil kuis untuk halaman progres:', error);
    return { attempts: {} };
  }
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours} jam ${minutes} menit`;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function dayNumber(timestamp) {
  return Math.floor(Date.parse(new Date(timestamp).toISOString().slice(0, 10)) / 86400000);
}

function dateFromDayNumber(day) {
  return day * 86400000;
}

function getAchievements(records, attempts) {
  if (!records.length) return [];

  const earned = [];
  const earliest = records.reduce((oldest, record) => Math.min(oldest, record.attemptedAt), Infinity);
  earned.push({
    icon: '★',
    title: 'Mulai Belajar',
    description: 'Menyelesaikan kuis pertamamu',
    date: earliest,
    color: '#FFD65A',
  });

  const perfectAttempt = records.find((record) => record.score === 100);
  if (perfectAttempt) {
    earned.push({
      icon: '▣',
      title: 'Jago Kuis',
      description: 'Mendapatkan nilai 100 pada kuis',
      date: perfectAttempt.attemptedAt,
      color: '#8D7DCB',
    });
  }

  const studyDays = [...new Set(records.map((record) => dayNumber(record.attemptedAt)))].sort((a, b) => a - b);
  const consistencyDay = studyDays.find((day) => (
    studyDays.includes(day + 1) && studyDays.includes(day + 2)
  ));
  if (consistencyDay !== undefined) {
    earned.push({
      icon: '▱',
      title: 'Konsisten Belajar',
      description: 'Belajar selama 3 hari berturut-turut',
      date: dateFromDayNumber(consistencyDay + 2),
      color: '#45BDAA',
    });
  }

  const improvement = quizTopics.find((topic) => {
    const pretest = attempts[topic.id]?.pretest?.score;
    const posttest = attempts[topic.id]?.posttest?.score;
    return pretest !== undefined && posttest !== undefined && posttest - pretest >= 10;
  });
  if (improvement) {
    earned.push({
      icon: '↗',
      title: 'Progres Cepat',
      description: `Nilai ${improvement.name} meningkat minimal 10 poin`,
      date: attempts[improvement.id].posttest.attemptedAt,
      color: '#F56F9B',
    });
  }

  return earned.sort((a, b) => b.date - a.date);
}

function StatCard({ title, value, caption, color, icon, progress }) {
  return (
    <section className="min-w-0 rounded-[20px] border p-3 sm:p-4" style={{ backgroundColor: `${color}22`, borderColor: `${color}75` }}>
      <div className="flex items-center gap-2 text-xs font-bold sm:text-sm" style={{ color }}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/70 text-base" aria-hidden="true">{icon}</span>
        <span>{title}</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold leading-none text-[#2A42A1] sm:text-3xl">{value}</p>
      <p className="mt-1 text-[10px] font-semibold text-slate-500 sm:text-xs">{caption}</p>
      {progress !== undefined && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80">
          <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: color }} />
        </div>
      )}
    </section>
  );
}

export default function Progres() {
  const [results] = useState(readAttempts);
  const attempts = results.attempts ?? EMPTY_ATTEMPTS;
  const topicProgress = useMemo(() => quizTopics.map((topic) => {
    const topicAttempts = attempts[topic.id] ?? {};
    const completedModes = CORE_MODES.filter((mode) => topicAttempts[mode] !== undefined).length;
    const latestAttempt = Object.values(topicAttempts)
      .filter((attempt) => Number.isFinite(attempt.score))
      .sort((a, b) => (b.attemptedAt ?? 0) - (a.attemptedAt ?? 0))[0];

    return {
      ...topic,
      completedModes,
      percentage: Math.round((completedModes / CORE_MODES.length) * 100),
      score: latestAttempt?.score,
      completedAt: latestAttempt?.attemptedAt,
    };
  }), [attempts]);

  const records = useMemo(() => quizTopics.flatMap((topic) => (
    Object.entries(attempts[topic.id] ?? {})
      .filter(([, attempt]) => Number.isFinite(attempt.score))
      .map(([mode, attempt]) => ({
        topicId: topic.id,
        mode,
        score: attempt.score,
        attemptedAt: attempt.attemptedAt ?? 0,
        durationSeconds: Number.isFinite(attempt.durationSeconds) ? attempt.durationSeconds : 0,
      }))
  )), [attempts]);

  const completedTopics = topicProgress.filter((topic) => topic.completedModes > 0).length;
  const completedCoreQuizzes = quizTopics.reduce((total, topic) => (
    total + CORE_MODES.filter((mode) => attempts[topic.id]?.[mode] !== undefined).length
  ), 0);
  const averageScore = records.length
    ? Math.round(records.reduce((total, record) => total + record.score, 0) / records.length)
    : 0;
  const totalStudySeconds = records.reduce((total, record) => total + record.durationSeconds, 0);
  const overallProgress = Math.round((completedCoreQuizzes / CORE_QUIZ_COUNT) * 100);
  const achievements = useMemo(() => getAchievements(records, attempts), [records, attempts]);
  const latestActivity = records.reduce((latest, record) => Math.max(latest, record.attemptedAt), 0);

  return (
    <DashboardLayout>
      <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 font-poppins text-[#2A42A1] xl:grid-cols-12">
        <section className="relative flex min-h-[145px] items-center overflow-hidden rounded-[26px] bg-gradient-to-r from-[#D6E8FF] via-[#EAF7FF] to-[#C9E9FF] px-5 py-5 xl:col-span-8">
          <div className="relative z-10 max-w-[75%]">
            <h1 className="text-2xl font-extrabold sm:text-[30px]">Progres Belajar</h1>
            <p className="mt-1 text-lg font-extrabold text-[#F56F9B] sm:text-xl">Lihat Perkembanganmu!</p>
            <p className="mt-2 max-w-[520px] text-[10px] leading-relaxed text-[#5274B4] sm:text-xs">
              Di sini kamu bisa melihat pencapaian, materi yang sudah dipelajari, serta perkembangan kemampuanmu dalam belajar matematika.
            </p>
          </div>
          <span className="absolute right-[27%] top-8 text-2xl text-[#FFD45A]" aria-hidden="true">✦</span>
          <span className="absolute right-[22%] bottom-7 text-xl text-[#8D7DCB]" aria-hidden="true">🚀</span>
          <img src={progressMascot} alt="Maskot EduBridge menyemangati belajar" className="absolute -bottom-1 right-2 h-[125px] w-[120px] object-contain sm:right-5 sm:h-[150px] sm:w-[145px]" />
        </section>

        <aside className="row-span-3 flex flex-col gap-4 xl:col-span-4">
          <section className="rounded-[22px] border border-[#C7D3E2] bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-extrabold">
                <span className="text-xl text-[#8D7DCB]" aria-hidden="true">♜</span>
                Pencapaian
              </h2>
              <Link to="/kuis" className="shrink-0 rounded-full bg-[#4C92E8] px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-[#2A42A1]">Lihat Semua →</Link>
            </div>
            {achievements.length ? (
              <div className="space-y-3">
                {achievements.map((achievement) => (
                  <article key={achievement.title} className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: `${achievement.color}35` }}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/75 text-lg" style={{ color: achievement.color }} aria-hidden="true">{achievement.icon}</span>
                    <div className="min-w-0">
                      <h3 className="text-xs font-extrabold">{achievement.title}</h3>
                      <p className="text-[9px] leading-relaxed text-[#5274B4]">{achievement.description}</p>
                      <p className="text-[9px] text-[#5274B4]">{formatDate(achievement.date)}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-[#F0F5FC] p-4 text-center">
                <p className="text-xs font-bold">Pencapaianmu dimulai dari kuis pertama!</p>
                <p className="mt-1 text-[10px] text-slate-500">Selesaikan kuis untuk membuka lencana dan melihat perkembangannya di sini.</p>
                <Link to="/kuis" className="mt-3 inline-flex rounded-full bg-[#4C92E8] px-3 py-1.5 text-[10px] font-bold text-white">Mulai Kuis →</Link>
              </div>
            )}
          </section>

          <section className="relative flex min-h-[230px] flex-1 items-end overflow-hidden rounded-[22px] bg-gradient-to-b from-[#F4F8FF] to-[#DCEEFF] p-5">
            <p className="absolute left-4 top-4 max-w-[60%] text-center text-xs font-semibold italic leading-relaxed text-[#7890C7]">
              {latestActivity
                ? 'Kamu sudah sejauh ini, dan itu luar biasa! Terus belajar, dan raih mimpi-mimpimu!'
                : 'Setiap langkah kecil tetap berarti. Mulai belajar hari ini dan lihat progresmu bertumbuh!'}
            </p>
            <span className="absolute left-[45%] top-[35%] text-xl text-[#FFD45A]" aria-hidden="true">✦</span>
            <img src={progressMascot} alt="" className="ml-auto h-[190px] w-[80%] object-contain object-bottom" />
          </section>
        </aside>

        <div className="grid grid-cols-2 gap-3 xl:col-span-8 xl:gap-4">
          <StatCard title="Materi Selesai" value={`${completedTopics}/${quizTopics.length}`} caption="materi dipelajari" color="#6685D8" icon="▤" progress={Math.round((completedTopics / quizTopics.length) * 100)} />
          <StatCard title="Kuis Diselesaikan" value={`${completedCoreQuizzes}/${CORE_QUIZ_COUNT}`} caption="pre-test & post-test" color="#45BDAA" icon="☑" progress={overallProgress} />
          <StatCard title="Rata-rata Nilai" value={records.length ? averageScore : '—'} caption={records.length ? 'dari 100' : 'belum ada nilai'} color="#F56F9B" icon="♜" />
          <StatCard title="Waktu Belajar" value={records.some((record) => record.durationSeconds > 0) ? formatDuration(totalStudySeconds) : '—'} caption={records.some((record) => record.durationSeconds > 0) ? 'total waktu kuis' : 'tercatat setelah kuis berikutnya'} color="#4C92E8" icon="◷" />
        </div>

        <section className="rounded-[22px] border border-[#C7D3E2] bg-gradient-to-br from-white to-[#F1F6FC] p-4 shadow-sm sm:p-5 xl:col-span-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#4C92E8] text-xl text-white" aria-hidden="true">↗</span>
            <div>
              <h2 className="text-sm font-extrabold text-[#3A81DA]">Progres per Mata Pelajaran</h2>
              <p className="text-[9px] text-slate-500">Perkembangan berdasarkan pre-test dan post-test.</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {topicProgress.map((topic) => (
              <Link key={topic.id} to={`/kuis?subject=${topic.id}&mode=${topic.completedModes ? 'posttest' : 'pretest'}`} className="flex items-center gap-2 rounded-lg bg-[#E4EDF7] px-2.5 py-2.5 transition hover:bg-[#D5E4F4] sm:gap-3 sm:px-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white sm:h-7 sm:w-7" style={{ backgroundColor: topic.color }}>{topic.icon}</span>
                <span className="w-[66px] shrink-0 text-[9px] font-extrabold sm:w-[78px] sm:text-[10px]">{topic.name}</span>
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#D4D4D4]">
                  <span className="block h-full rounded-full" style={{ width: `${topic.percentage}%`, backgroundColor: topic.color }} />
                </span>
                <span className="shrink-0 text-[8px] font-semibold text-[#5274B4] sm:text-[9px]">
                  {topic.completedModes}/{CORE_MODES.length} {topic.percentage}%
                </span>
                <span className="hidden text-[10px] text-slate-400 sm:inline" aria-hidden="true">›</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-[22px] border border-[#C7D3E2] bg-gradient-to-br from-white to-[#F1F6FC] p-4 shadow-sm sm:p-5 xl:col-span-3">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xl text-[#6685D8]" aria-hidden="true">▤</span>
            <h2 className="text-sm font-extrabold">Ringkasan Kemajuan</h2>
          </div>
          <div className="flex flex-col items-center py-1">
            <div className="relative flex h-[112px] w-[112px] items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" role="img" aria-label={`Total progres ${overallProgress}%`}>
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E3EAF3" strokeWidth="10" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="#3A81DA" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${overallProgress * 2.64} 264`} />
              </svg>
              <span className="text-lg font-extrabold">{overallProgress}%</span>
            </div>
            <p className="mt-1 text-[10px] text-[#6685D8]">Total Progres</p>
          </div>
          <div className="mt-3 space-y-2">
            {[
              { label: 'Materi Selesai', value: `${completedTopics} materi`, color: '#45BDAA' },
              { label: 'Kuis Selesai', value: `${completedCoreQuizzes} kuis`, color: '#3A81DA' },
              { label: 'Belum Selesai', value: `${CORE_QUIZ_COUNT - completedCoreQuizzes} kuis`, color: '#F56F9B' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg bg-[#DCEAF8] px-3 py-2 text-[9px]">
                <span className="flex items-center gap-2"><span className="h-4 w-4 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>
                <span className="font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
