import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { quizTopics } from './quizData';

const STORAGE_KEY = 'edubridge-quiz-attempts';
const QUIZ_DURATION_SECONDS = 15 * 60;
const modeLabels = {
  pretest: 'Pre-Test',
  posttest: 'Post-Test',
  remedial: 'Remedial',
};

function readAttempts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { attempts: {}, lastTopic: 'aljabar', lastMode: 'pretest' };
  } catch (error) {
    console.error('Gagal membaca hasil kuis tersimpan:', error);
    return { attempts: {}, lastTopic: 'aljabar', lastMode: 'pretest' };
  }
}

function createQuiz(topic, mode, incorrectIds = []) {
  const questions = mode === 'remedial' && incorrectIds.length
    ? topic.questions.filter((question) => incorrectIds.includes(question.id))
    : topic.questions;

  return {
    topicId: topic.id,
    mode,
    questions,
    questionIndex: 0,
    answers: [],
    started: false,
    completed: false,
    startedAt: null,
  };
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function getLatestTopicAttempt(attempts, topicId, fallbackMode) {
  const topicAttempts = attempts[topicId] ?? {};
  const entries = Object.entries(topicAttempts);

  if (!entries.length) return null;

  return entries
    .sort((left, right) => {
      const leftTime = left[1].attemptedAt ?? (left[0] === fallbackMode ? 1 : 0);
      const rightTime = right[1].attemptedAt ?? (right[0] === fallbackMode ? 1 : 0);
      return rightTime - leftTime;
    })[0];
}

export default function Kuis() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTopicId = quizTopics.some((topic) => topic.id === searchParams.get('subject'))
    ? searchParams.get('subject')
    : 'aljabar';
  const initialMode = ['pretest', 'posttest', 'remedial'].includes(searchParams.get('mode'))
    ? searchParams.get('mode')
    : 'pretest';
  const [savedResults, setSavedResults] = useState(readAttempts);
  const [selectedTopicId, setSelectedTopicId] = useState(initialTopicId);
  const [selectedMode, setSelectedMode] = useState(initialMode);
  const [timeRemaining, setTimeRemaining] = useState(QUIZ_DURATION_SECONDS);
  const [quiz, setQuiz] = useState(() => {
    const topic = quizTopics.find((item) => item.id === initialTopicId);
    const previous = readAttempts();
    const previousAttempt = getLatestTopicAttempt(previous.attempts, initialTopicId, previous.lastMode)?.[1];
    const incorrectIds = previousAttempt?.incorrectIds ?? [];
    return createQuiz(topic, initialMode, incorrectIds);
  });
  const topic = quizTopics.find((item) => item.id === selectedTopicId) ?? quizTopics[0];
  const currentQuestion = quiz.questions[quiz.questionIndex];
  const selectedAnswer = quiz.answers[quiz.questionIndex];
  const correctCount = quiz.answers.filter((answer, index) => answer === quiz.questions[index]?.answer).length;
  const [latestAttemptMode, latestAttempt] = getLatestTopicAttempt(savedResults.attempts, selectedTopicId, savedResults.lastMode) ?? [];
  const pretestScore = savedResults.attempts[selectedTopicId]?.pretest?.score;
  const posttestScore = savedResults.attempts[selectedTopicId]?.posttest?.score;

  const assessmentSummary = useMemo(() => quizTopics.map((item) => {
    const score = savedResults.attempts[item.id]?.pretest?.score ?? 0;
    return { ...item, score, completed: savedResults.attempts[item.id]?.pretest !== undefined };
  }), [savedResults]);

  useEffect(() => {
    if (!quiz.started || quiz.completed) return undefined;

    const timerId = window.setInterval(() => {
      setTimeRemaining((remaining) => Math.max(remaining - 1, 0));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [quiz.started, quiz.completed, quiz.topicId, quiz.mode]);

  function startQuiz(topicId = selectedTopicId, mode = selectedMode, forceAll = false) {
    const nextTopic = quizTopics.find((item) => item.id === topicId) ?? quizTopics[0];
    const previousAttempt = getLatestTopicAttempt(savedResults.attempts, topicId, savedResults.lastMode)?.[1];
    const incorrectIds = forceAll
      ? []
      : previousAttempt?.incorrectIds ?? [];

    setSelectedTopicId(topicId);
    setSelectedMode(mode);
    setQuiz(createQuiz(nextTopic, mode, incorrectIds));
    setTimeRemaining(QUIZ_DURATION_SECONDS);
    setSearchParams({ subject: topicId, mode });
  }

  function beginQuiz() {
    setTimeRemaining(QUIZ_DURATION_SECONDS);
    setQuiz((current) => ({ ...current, started: true, startedAt: Date.now() }));
  }

  function chooseAnswer(answerIndex) {
    if (!quiz.started || selectedAnswer !== undefined || quiz.completed) return;
    setQuiz((current) => {
      const answers = [...current.answers];
      answers[current.questionIndex] = answerIndex;
      return { ...current, answers };
    });
  }

  const finishQuiz = useCallback(() => {
    const score = Math.round((correctCount / quiz.questions.length) * 100);
    const incorrectIds = quiz.questions
      .filter((question, index) => quiz.answers[index] !== question.answer)
      .map((question) => question.id);
    const nextResults = {
      ...savedResults,
      attempts: {
        ...savedResults.attempts,
        [selectedTopicId]: {
          ...savedResults.attempts[selectedTopicId],
          [selectedMode]: {
            score,
            incorrectIds,
            attemptedAt: Date.now(),
            durationSeconds: Math.min(
              Math.floor((Date.now() - (quiz.startedAt ?? Date.now())) / 1000),
              QUIZ_DURATION_SECONDS,
            ),
          },
        },
      },
      lastTopic: selectedTopicId,
      lastMode: selectedMode,
    };

    setSavedResults(nextResults);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextResults));
    setQuiz((current) => ({ ...current, completed: true }));
  }, [correctCount, quiz.answers, quiz.questions, quiz.startedAt, savedResults, selectedMode, selectedTopicId]);

  useEffect(() => {
    if (timeRemaining !== 0 || !quiz.started || quiz.completed) return undefined;

    const timeoutId = window.setTimeout(finishQuiz, 0);
    return () => window.clearTimeout(timeoutId);
  }, [timeRemaining, quiz.started, quiz.completed, finishQuiz]);

  function advanceQuestion() {
    if (quiz.questionIndex === quiz.questions.length - 1) {
      finishQuiz();
      return;
    }

    setQuiz((current) => ({ ...current, questionIndex: current.questionIndex + 1 }));
  }

  const remedialTopicId = savedResults.lastTopic ?? selectedTopicId;
  const remedialWrongCount = getLatestTopicAttempt(savedResults.attempts, remedialTopicId, savedResults.lastMode)?.[1]?.incorrectIds?.length ?? 0;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1500px] font-poppins text-[#2A42A1]">
        <div className="grid grid-cols-1 items-start gap-5 2xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.9fr)]">
          <section className="min-w-0 space-y-5">
            <header className="relative flex min-h-[170px] items-center overflow-hidden rounded-[26px] bg-gradient-to-r from-[#D8E9FF] via-[#EFF9FF] to-[#C7E9FF] px-6 py-6 shadow-sm sm:px-8">
              <div className="relative z-10 max-w-[78%]">
                <span className="mb-3 inline-flex rounded-full bg-[#78A5EB] px-6 py-2 text-sm font-bold text-white">Kuis</span>
                <h1 className="text-2xl font-extrabold sm:text-3xl">Kuis Matematika</h1>
                <p className="mt-1 text-sm">Latihan berdasarkan materi dan rekomendasi belajar</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {quizTopics.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={quiz.started && !quiz.completed}
                      onClick={() => startQuiz(item.id, 'pretest')}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${selectedTopicId === item.id ? 'border-[#4D78ED] bg-[#4D78ED] text-white' : 'border-gray-300 bg-white text-[#243B7B] hover:bg-blue-50'}`}
                    >
                      {item.icon} {item.name}
                    </button>
                  ))}
                </div>
              </div>
              <img src="/assets/images/object.png" alt="Maskot siap mengerjakan kuis" className="absolute -bottom-1 right-2 h-[120px] w-[100px] object-contain sm:right-5 sm:h-[145px] sm:w-[125px]" />
            </header>

            <div className="rounded-[22px] border border-[#D6E2F0] bg-[#EAF4FF] p-4 shadow-sm sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {Object.entries(modeLabels).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => startQuiz(selectedTopicId, id)}
                      disabled={quiz.started && !quiz.completed}
                      className={`rounded-full px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-70 ${selectedMode === id ? 'bg-[#79A4EA] text-white' : 'bg-white text-[#4C6EBA]'}`}
                    >
                      {label}
                    </button>
                  ))}
                  <h2 className="text-lg font-bold">{selectedMode === 'remedial' ? 'Perbaikan' : 'Latihan'} {topic.name}</h2>
                </div>
                {quiz.started && !quiz.completed && (
                  <span className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#4C6EBA]">
                    Soal {quiz.questionIndex + 1} dari {quiz.questions.length}
                  </span>
                )}
              </div>

              {quiz.completed ? (
                <div className="rounded-2xl bg-white p-5 sm:p-7">
                  <div className="text-center">
                    <p className="text-sm font-bold text-[#5577B7]">Hasil {modeLabels[quiz.mode]} · {topic.name}</p>
                    <p className="mt-2 text-5xl font-extrabold text-[#3A81DA]">{Math.round((correctCount / quiz.questions.length) * 100)}<span className="text-2xl">%</span></p>
                    <p className="mt-2 text-sm">{correctCount} benar dari {quiz.questions.length} soal</p>
                    <p className="mt-3 inline-flex rounded-full bg-[#E4F7F1] px-4 py-2 text-sm font-bold text-[#279A84]">
                      {correctCount === quiz.questions.length ? 'Hebat, semua jawaban benar!' : 'Yuk pelajari pembahasan untuk meningkatkan pemahamanmu.'}
                    </p>
                  </div>
                  <div className="mt-6 space-y-3">
                    {quiz.questions.map((question, index) => {
                      const isCorrect = quiz.answers[index] === question.answer;
                      return (
                        <article key={question.id} className={`rounded-xl border p-4 ${isCorrect ? 'border-[#A8DFD2] bg-[#F0FBF8]' : 'border-[#F2B8C6] bg-[#FFF5F7]'}`}>
                          <p className="font-bold">{index + 1}. {question.question}</p>
                          <p className={`mt-2 text-sm font-bold ${isCorrect ? 'text-[#238D78]' : 'text-[#C74767]'}`}>
                            {isCorrect ? 'Jawabanmu benar.' : `Jawabanmu salah. Jawaban yang benar: ${question.options[question.answer]}.`}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-gray-700">{question.explanation}</p>
                        </article>
                      );
                    })}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" onClick={() => startQuiz(selectedTopicId, selectedMode)} className="rounded-xl bg-[#4D73EC] px-5 py-3 text-sm font-bold text-white hover:bg-[#365DD7]">Ulangi Kuis</button>
                    <button type="button" onClick={() => startQuiz(selectedTopicId, 'remedial')} className="rounded-xl border border-[#4D73EC] bg-white px-5 py-3 text-sm font-bold text-[#3A67D8]">Latihan Remedial</button>
                  </div>
                </div>
              ) : !quiz.started ? (
                <div className="rounded-2xl bg-white p-6 text-center sm:p-10">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F2FF] text-3xl text-[#4D73EC]">✎</div>
                  <h3 className="mt-4 text-xl font-extrabold">Siap mengerjakan {modeLabels[selectedMode]} {topic.name}?</h3>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-gray-600">
                    Kuis ini berisi {quiz.questions.length} soal dengan waktu 15 menit. Timer baru dimulai setelah kamu menekan tombol mulai.
                  </p>
                  <div className="mx-auto mt-5 max-w-sm rounded-xl bg-[#F3F8FF] p-4 text-left text-sm text-[#526B9B]">
                    <p className="font-bold">Sebelum mulai:</p>
                    <ul className="mt-2 list-inside list-disc space-y-1">
                      <li>Pilih satu jawaban pada setiap soal.</li>
                      <li>Pembahasan muncul setelah jawaban dipilih.</li>
                      <li>Kuis otomatis selesai saat waktu habis.</li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={beginQuiz}
                    className="mt-6 rounded-full bg-[#4D73EC] px-8 py-3 font-bold text-white shadow-sm transition hover:bg-[#365DD7]"
                  >
                    Mulai Kuis
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="rounded-xl bg-white px-4 py-3 text-sm font-bold leading-relaxed sm:text-base">{currentQuestion.question}</h2>
                    <div className="flex items-center gap-3">
                      <div role="timer" aria-label={`Waktu tersisa ${formatTime(timeRemaining)}`} className={`rounded-xl bg-white px-3 py-2 text-xs font-bold ${timeRemaining <= 60 ? 'text-[#C74767]' : 'text-[#6081C3]'}`}>
                        <p>Waktu Tersisa</p>
                        <p className="mt-1 text-base tabular-nums">{formatTime(timeRemaining)}</p>
                      </div>
                      <div className="min-w-[110px] rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#6081C3]">
                        <p>Progres kuis</p>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                          <div className="h-full rounded-full bg-[#4D80E8] transition-all" style={{ width: `${((quiz.questionIndex + (selectedAnswer !== undefined ? 1 : 0)) / quiz.questions.length) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {currentQuestion.options.map((option, index) => {
                      const isSelected = selectedAnswer === index;
                      const answered = selectedAnswer !== undefined;
                      const isCorrectOption = index === currentQuestion.answer;
                      const choiceClass = !answered
                        ? 'border-[#DFE7F0] bg-white hover:border-[#76A1E6] hover:bg-blue-50'
                        : isCorrectOption
                          ? 'border-[#73CDB9] bg-[#E9F9F5]'
                          : isSelected
                            ? 'border-[#E99BAE] bg-[#FFF0F3]'
                            : 'border-[#DFE7F0] bg-white';

                      return (
                        <button
                          key={option}
                          type="button"
                          disabled={answered}
                          onClick={() => chooseAnswer(index)}
                          className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition sm:p-4 ${choiceClass}`}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#C7E3F8] text-sm font-bold text-[#3864AD]">{String.fromCharCode(65 + index)}</span>
                          <span className="font-semibold">{option}</span>
                          {answered && isCorrectOption && <span className="ml-auto text-sm font-bold text-[#238D78]">Jawaban benar</span>}
                        </button>
                      );
                    })}
                  </div>
                  {selectedAnswer !== undefined && (
                    <div role="status" className={`mt-4 rounded-xl border p-4 ${selectedAnswer === currentQuestion.answer ? 'border-[#A8DFD2] bg-[#F0FBF8]' : 'border-[#F2B8C6] bg-[#FFF5F7]'}`}>
                      <p className={`font-bold ${selectedAnswer === currentQuestion.answer ? 'text-[#238D78]' : 'text-[#C74767]'}`}>
                        {selectedAnswer === currentQuestion.answer ? 'Benar! Jawabanmu tepat.' : `Jawabanmu belum tepat. Jawaban yang benar: ${currentQuestion.options[currentQuestion.answer]}.`}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-gray-700">{currentQuestion.explanation}</p>
                    </div>
                  )}
                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      disabled={selectedAnswer === undefined}
                      onClick={advanceQuestion}
                      className="rounded-full bg-[#4D73EC] px-6 py-3 text-sm font-bold text-white hover:bg-[#365DD7] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {quiz.questionIndex === quiz.questions.length - 1 ? 'Selesaikan Kuis' : 'Soal Berikutnya →'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-[22px] border border-[#D8E1ED] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-extrabold">Hasil Kuis &amp; Remedial</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#E2F3FA] p-3 text-center">
                  <p className="text-sm font-bold">Pre-Test</p>
                  <p className="mt-1 text-xl font-extrabold">{pretestScore ?? '--'}<span className="text-xs font-medium">/100</span></p>
                </div>
                <div className="rounded-xl bg-[#E2F3FA] p-3 text-center">
                  <p className="text-sm font-bold">Post-Test</p>
                  <p className="mt-1 text-xl font-extrabold">{posttestScore ?? '--'}<span className="text-xs font-medium">/100</span></p>
                </div>
              </div>
              {pretestScore !== undefined && posttestScore !== undefined && (
                <p className="mt-3 rounded-full bg-[#E1F7F2] px-3 py-2 text-center text-sm font-bold text-[#299C87]">
                  {posttestScore >= pretestScore ? `Peningkatan +${posttestScore - pretestScore} poin` : `Perlu latihan ${pretestScore - posttestScore} poin lagi`}
                </p>
              )}
              <p className="mt-3 text-center text-xs text-gray-600">
                {latestAttempt ? `${modeLabels[latestAttemptMode]} terakhir: ${latestAttempt.score}/100` : 'Kerjakan kuis untuk melihat hasilmu.'}
              </p>
              <button
                type="button"
                onClick={() => startQuiz(remedialTopicId, 'remedial')}
                className="mt-4 w-full rounded-full bg-[#4D73EC] px-4 py-3 text-sm font-bold text-white hover:bg-[#365DD7]"
              >
                Mulai Remedial {remedialWrongCount ? `(${remedialWrongCount} soal)` : '→'}
              </button>
              <p className="mt-2 text-center text-xs text-gray-500">
                {remedialWrongCount ? 'Latihan difokuskan pada soal yang sebelumnya salah.' : 'Belum ada jawaban salah tersimpan; latihan semua soal topik remedial.'}
              </p>
            </section>

            <section id="assessment" className="scroll-mt-6 rounded-[22px] border border-[#D8E1ED] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-extrabold">Assessment Diagnostik</h2>
              <p className="mt-1 text-sm text-gray-600">Hasil pre-test memetakan penguasaan awal setiap materi.</p>
              <div className="mt-4 space-y-3">
                {assessmentSummary.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => startQuiz(item.id, 'pretest')}
                    className="w-full rounded-xl border border-[#DBE3EC] bg-[#F8FBFE] p-3 text-left transition hover:border-[#89AFE9]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold">{item.icon} {item.name}</span>
                      <span className="text-xs font-semibold text-gray-500">{item.completed ? `${item.score}%` : 'Belum dinilai'}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full rounded-full transition-all" style={{ width: `${item.score}%`, backgroundColor: item.color }} />
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-gray-500">Pilih materi untuk mengerjakan pre-test dan memperbarui assessment.</p>
            </section>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
