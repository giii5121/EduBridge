import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Flag,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import { api, formatDate, modeLabels, phaseLabels } from '../../lib/api';
import {
  Badge,
  Button,
  ButtonLink,
  Empty,
  ErrorNotice,
  Loading,
  Meter,
  Modal,
  PageHead,
  SectionHead,
  Symbol,
} from '../../components/ui/Kit';
import QuizCompanion from '../../components/learning/QuizCompanion';
import NarrativePanel from '../../components/learning/NarrativePanel';
import MathText from '../../components/learning/MathText';

export default function Kuis() {
  const { data, refresh } = useApp();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const topic = data.topics.find((t) => t.id === params.get('subject')) ?? data.topics[0];
  const mode = ['pretest', 'posttest', 'remedial'].includes(params.get('mode'))
    ? params.get('mode')
    : 'pretest';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setError('');
  }, [params]);
  if (!topic)
    return <Empty title="Belum ada asesmen">Guru akan menyiapkan topik untuk kelasmu.</Empty>;
  const state = topic.state;
  const blocked =
    mode === 'pretest'
      ? state.pre && !state.post
        ? 'Pretest siklus ini sudah selesai. Lanjutkan materi penguatan sebelum posttest.'
        : null
      : !state.pre
        ? 'Selesaikan pretest dahulu untuk memetakan kemampuan awalmu.'
        : mode === 'posttest'
          ? state.post
            ? 'Posttest siklus ini sudah selesai. Kamu bisa melihat hasilnya atau memulai siklus baru dari pretest.'
            : !state.lessonAt
              ? 'Selesaikan materi penguatan setelah pembelajaran kelas sebelum posttest.'
              : state.phase !== 'posttest'
                ? 'Guru belum membuka posttest. Kamu bisa berlatih sambil menunggu.'
                : null
          : state.phase === 'pretest'
            ? 'Latihan terbuka saat guru memulai fase pembelajaran.'
            : null;
  async function start() {
    setBusy(true);
    setError('');
    try {
      const assessment = await api('/assessments', {
        method: 'POST',
        body: { topicId: topic.id, mode },
      });
      await refresh();
      navigate(`/kuis/kerjakan/${assessment.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        eyebrow="KENALI PEMAHAMAN, BUKAN SEKADAR NILAI"
        title="Setiap jawaban punya cerita."
      >
        Asesmen membantu menemukan konsep yang perlu kamu kuatkan.
      </PageHead>
      <div className="assessment-lobby">
        <section className="card assessment-config">
          <SectionHead title="Siapkan langkah belajarmu" />
          <label>
            Pilih topik
            <select
              aria-label="Pilih topik asesmen"
              value={topic.id}
              onChange={(e) => setParams({ subject: e.target.value, mode })}
            >
              {data.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <div className="assessment-modes" aria-label="Jenis asesmen">
            {[
              ['pretest', '01', 'Sebelum pembelajaran', 'Kenali titik awalmu', ClipboardCheck],
              ['posttest', '02', 'Setelah pembelajaran', 'Ukur perubahan pemahaman', Trophy],
              ['remedial', '+', 'Penguatan', 'Latih konsep yang belum kuat', Target],
            ].map(([id, number, title, desc, Icon]) => (
              <button
                key={id}
                onClick={() => setParams({ subject: topic.id, mode: id })}
                className={mode === id ? 'selected' : ''}
              >
                <span className="mode-icon">
                  <Icon size={23} />
                </span>
                <span>
                  <small>
                    {number} · {title}
                  </small>
                  <strong>{modeLabels[id]}</strong>
                  <span>{desc}</span>
                </span>
                <span className="radio-dot" />
              </button>
            ))}
          </div>
          <div className="assessment-detail">
            <Symbol topic={topic} />
            <div>
              <h2>{topic.title}</h2>
              <p>{topic.attributes.join(' · ')}</p>
            </div>
          </div>
          <div className="assessment-facts">
            <span>
              <ClipboardCheck size={18} />
              <strong>{mode === 'remedial' ? 'Sesuai gap' : `${topic.questionCount} soal`}</strong>
              <small>Pilihan ganda</small>
            </span>
            <span>
              <Clock3 size={18} />
              <strong>15 menit</strong>
              <small>Waktu pengerjaan</small>
            </span>
            <span>
              <Zap size={18} />
              <strong>
                +{mode === 'pretest' ? 60 : mode === 'posttest' ? 100 : state.practice ? 0 : 20} XP
              </strong>
              <small>Setelah selesai</small>
            </span>
          </div>
          <ErrorNotice>{error}</ErrorNotice>
          {blocked ? (
            <div className="notice info">
              <LockKeyhole size={20} />
              <div>
                <p>{blocked}</p>
                <div className="button-row">
                  {state.post && mode === 'posttest' ? (
                    <ButtonLink to={`/kuis/hasil/${state.post.id}`} variant="secondary">
                      Lihat hasil
                    </ButtonLink>
                  ) : (
                    state.pre && (
                      <ButtonLink to={`/materi/${topic.id}`} variant="secondary">
                        Buka materi <ArrowRight size={15} />
                      </ButtonLink>
                    )
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="assessment-honesty">
                <ShieldCheck size={18} />
                Kerjakan mandiri. Jawaban benar ditampilkan setelah asesmen dikumpulkan.
              </p>
              {mode === 'pretest' && state.post && (
                <p className="field-help">
                  Ini akan memulai siklus belajar baru. Riwayat siklus sebelumnya tetap tersimpan.
                </p>
              )}
              <Button busy={busy} onClick={start} className="full">
                Mulai / lanjutkan {modeLabels[mode].toLowerCase()}
                <ArrowRight size={18} />
              </Button>
            </>
          )}
        </section>
        <aside>
          <section className="card assessment-guide">
            <QuizCompanion mood="ready" />
            <Badge tone="teal">BELAJAR PUNYA ARAH</Badge>
            <h2>
              Hasilmu adalah
              <br />
              titik berangkat.
            </h2>
            <p>
              Pretest dan posttest mengukur atribut konsep yang sama dengan soal berbeda. Dari sana,
              kita melihat gap yang sudah tertutup dan yang masih perlu dilatih.
            </p>
            <ol>
              <li>
                <span>1</span>Pretest & diagnosis awal
              </li>
              <li>
                <span>2</span>Pembelajaran kelas & penguatan
              </li>
              <li>
                <span>3</span>Posttest & diagnosis akhir
              </li>
            </ol>
            <div className="phase-note">
              <Flag size={17} />
              <span>
                Fase kelas: <strong>{phaseLabels[state.phase]}</strong>
              </span>
            </div>
            <p className="method-note">
              PDINA memperkirakan penguasaan konsep. Kalibrasi instrumen menggunakan data sintetis.
            </p>
          </section>
          {data.progress.history.length > 0 && (
            <section className="card recent-assessments">
              <SectionHead title="Aktivitas terakhir" />
              {data.progress.history.slice(0, 3).map((h) => (
                <Link key={h.id} to={`/kuis/hasil/${h.id}`}>
                  <span className="mini-result">{h.score}</span>
                  <div>
                    <strong>{h.title}</strong>
                    <small>
                      {modeLabels[h.mode]} · {formatDate(h.completedAt)}
                    </small>
                  </div>
                  <ChevronRight size={16} />
                </Link>
              ))}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

function useAssessment(id) {
  const [record, setRecord] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setRecord(null);
    setError('');
    api(`/assessments/${id}`, { signal: controller.signal })
      .then(setRecord)
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      });
    return () => controller.abort();
  }, [id, retry]);
  return { record, setRecord, error, retry: () => setRetry((r) => r + 1) };
}
export function AssessmentRunner() {
  const { assessmentId } = useParams();
  const { record, error: loadError, retry } = useAssessment(assessmentId);
  const { refresh } = useApp();
  const navigate = useNavigate();
  const [responses, setResponses] = useState([]);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [remaining, setRemaining] = useState(900);
  const submitting = useRef(false);
  const responseRef = useRef([]);
  const autoAttempted = useRef(false);
  useEffect(() => {
    if (!record) return;
    if (record.completedAt) {
      navigate(`/kuis/hasil/${record.id}`, { replace: true });
      return;
    }
    setResponses(record.responses);
    autoAttempted.current = false;
    responseRef.current = record.responses;
    setIndex(
      record.responses.findIndex((r) => r === null) >= 0
        ? record.responses.findIndex((r) => r === null)
        : 0,
    );
    setRemaining(Math.ceil(record.remainingSeconds));
  }, [record, navigate]);
  const submitRef = useRef(null);
  async function submit() {
    if (!record || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    setConfirm(false);
    try {
      await api(`/assessments/${record.id}/submit`, {
        method: 'POST',
        body: { responses: responseRef.current },
      });
      await refresh();
      navigate(`/kuis/hasil/${record.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    submitRef.current = submit;
  });
  useEffect(() => {
    if (!record || record.completedAt) return;
    const started = performance.now();
    const timer = setInterval(() => {
      const seconds = Math.max(
        0,
        Math.ceil(record.remainingSeconds - (performance.now() - started) / 1000),
      );
      setRemaining(seconds);
      if (seconds === 0 && !autoAttempted.current) {
        autoAttempted.current = true;
        submitRef.current();
      }
    }, 500);
    return () => clearInterval(timer);
  }, [record]);
  useEffect(() => {
    const leave = (event) => {
      if (!saved) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [saved]);
  async function saveAnswers(next) {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await api(`/assessments/${record.id}`, { method: 'PATCH', body: { responses: next } });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  function choose(option) {
    if (saving || busy || remaining === 0) return;
    const next = responses.map((value, i) => (i === index ? option : value));
    setResponses(next);
    responseRef.current = next;
    saveAnswers(next);
  }
  if (loadError)
    return (
      <>
        <ErrorNotice>{loadError}</ErrorNotice>
        <Button onClick={retry}>Coba lagi</Button>
      </>
    );
  if (!record || responses.length !== record.questions.length)
    return <Loading label="Menyiapkan asesmenmu…" />;
  const question = record.questions[index];
  const answered = responses.filter((r) => r !== null).length;
  return (
    <>
      <div className="runner-top">
        <Link to={`/kuis?subject=${record.topicId}&mode=${record.mode}`} className="back-link">
          <ArrowLeft size={16} />
          Kembali ke asesmen
        </Link>
        <Badge tone="blue">{modeLabels[record.mode]}</Badge>
      </div>
      <div className="runner-heading">
        <div>
          <span className="eyebrow">FOKUS PADA PROSESMU</span>
          <h1>{record.title}</h1>
        </div>
        <div
          className={`timer ${remaining < 120 ? 'urgent' : ''}`}
          role="timer"
          aria-label="Sisa waktu asesmen"
        >
          <Clock3 size={19} />
          {String(Math.floor(remaining / 60)).padStart(2, '0')}:
          {String(remaining % 60).padStart(2, '0')}
        </div>
      </div>
      <div className="runner-progress">
        <Meter value={(answered / record.questions.length) * 100} label="Soal terjawab" />
        <span>
          {answered}/{record.questions.length} terjawab
        </span>
      </div>
      <ErrorNotice>{error}</ErrorNotice>
      {!saved && !saving && (
        <Button variant="secondary" onClick={() => saveAnswers(responses)}>
          Simpan jawaban lagi
        </Button>
      )}
      <div className="runner-grid">
        <section className="card question-card">
          <div className="row-between">
            <Badge tone="neutral">SOAL {String(index + 1).padStart(2, '0')}</Badge>
            <span className="save-status">
              {saving ? (
                'Menyimpan…'
              ) : saved ? (
                <>
                  <Check size={13} />
                  Tersimpan di server
                </>
              ) : (
                'Belum tersimpan'
              )}
            </span>
          </div>
          <QuizCompanion mood="thinking" answered={answered} total={record.questions.length} />
          <h2 className="question-text">
            <MathText text={question.text} />
          </h2>
          <div
            className="answer-options"
            role="radiogroup"
            aria-label={`Jawaban soal ${index + 1}`}
          >
            {question.options.map((option, i) => (
              <button
                key={i}
                role="radio"
                aria-checked={responses[index] === i}
                className={responses[index] === i ? 'selected' : ''}
                disabled={saving || busy || remaining === 0}
                onClick={() => choose(i)}
              >
                <span>{String.fromCharCode(65 + i)}</span>
                <strong>
                  <MathText text={option} whole />
                </strong>
                <i>{responses[index] === i && <Check size={16} />}</i>
              </button>
            ))}
          </div>
          <div className="question-navigation">
            <Button
              variant="secondary"
              disabled={index === 0 || saving || busy}
              onClick={() => setIndex((i) => i - 1)}
            >
              <ChevronLeft size={17} />
              Sebelumnya
            </Button>
            {index < record.questions.length - 1 ? (
              <Button onClick={() => setIndex((i) => i + 1)} disabled={saving || busy}>
                Berikutnya
                <ChevronRight size={17} />
              </Button>
            ) : (
              <Button
                onClick={() => setConfirm(true)}
                disabled={answered !== record.questions.length || saving}
                busy={busy}
              >
                Kumpulkan asesmen
                <CheckCheck size={17} />
              </Button>
            )}
          </div>
        </section>
        <aside className="card question-map">
          <h3>Navigasi soal</h3>
          <p>Pilih nomor untuk meninjau jawaban.</p>
          <div>
            {record.questions.map((q, i) => (
              <button
                key={q.id}
                aria-label={`Ke soal ${i + 1}`}
                aria-current={index === i ? 'step' : undefined}
                className={`${responses[i] !== null ? 'answered' : ''} ${index === i ? 'current' : ''}`}
                onClick={() => setIndex(i)}
                disabled={saving || busy}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <span className="map-key">
            <i />
            Sudah dijawab
          </span>
          <span className="map-key unanswered">
            <i />
            Belum dijawab
          </span>
          <p className="runner-tip">
            Jawaban bisa diubah selama waktu masih tersedia. Pembahasan terbuka setelah dikumpulkan.
          </p>
          {remaining === 0 && (
            <Button busy={busy} onClick={submit}>
              Kumpulkan hasil tersimpan
            </Button>
          )}
        </aside>
      </div>
      {confirm && (
        <Modal title="Siap mengumpulkan?" onClose={() => setConfirm(false)}>
          <div className="modal-body">
            <p>
              Kamu sudah menjawab {answered} dari {record.questions.length} soal. Setelah
              dikumpulkan, jawaban tidak dapat diubah dan hasil diagnosis akan tersedia.
            </p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                Periksa lagi
              </Button>
              <Button busy={busy} onClick={submit}>
                Ya, kumpulkan
                <Check size={16} />
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export function AttributeResults({ attributes, comparison }) {
  return (
    <div className="attribute-results">
      {attributes.map((a) => {
        const paired = comparison?.attributes.find((p) => p.id === a.id);
        return (
          <div className="attribute-result" key={a.id}>
            <div>
              <strong>{a.name}</strong>
              <span>{a.evidence} soal sebagai bukti</span>
            </div>
            <div className="attribute-score">
              <Meter
                value={a.mastery ?? 0}
                tone={a.status === 'mastered' ? 'teal' : 'orange'}
                label={`Bukti penguasaan ${a.name}`}
              />
              <strong>{a.mastery === null ? '—' : `${a.mastery}%`}</strong>
            </div>
            <Badge
              tone={
                a.status === 'mastered' ? 'teal' : a.status === 'unknown' ? 'neutral' : 'orange'
              }
            >
              {a.status === 'mastered'
                ? 'Dikuasai'
                : a.status === 'unknown'
                  ? a.evidence
                    ? 'Bukti belum cukup'
                    : 'Belum diukur'
                  : a.status === 'developing'
                    ? 'Perlu konfirmasi'
                    : 'Perlu penguatan'}
            </Badge>
            {paired && (
              <small className="attribute-change">
                Sebelum {paired.pre ?? '—'}% → Setelah {paired.post ?? '—'}%
              </small>
            )}
          </div>
        );
      })}
    </div>
  );
}
export function AssessmentResult() {
  const { assessmentId } = useParams();
  const { record, error, retry } = useAssessment(assessmentId);
  const { data } = useApp();
  const [review, setReview] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (record && !record.completedAt) navigate(`/kuis/kerjakan/${record.id}`, { replace: true });
  }, [record, navigate]);
  if (error)
    return (
      <>
        <ErrorNotice>{error}</ErrorNotice>
        <Button onClick={retry}>Coba lagi</Button>
      </>
    );
  if (!record?.result) return <Loading label="Menyusun hasil belajarmu…" />;
  const result = record.result;
  const topic = data.topics.find((t) => t.id === record.topicId);
  const comparison = record.comparison;
  return (
    <>
      <Link to="/kuis" className="back-link">
        <ArrowLeft size={16} />
        Kembali ke asesmen
      </Link>
      <div className="result-hero">
        <div>
          <Badge tone="teal">
            <Check size={13} />
            ASESMEN SELESAI
          </Badge>
          <h1>
            {record.mode === 'posttest'
              ? 'Lihat sejauh apa kamu bertumbuh.'
              : record.mode === 'remedial'
                ? 'Latihanmu adalah kemajuan.'
                : 'Titik awalmu sudah terpetakan.'}
          </h1>
          <p>
            {record.title} · {modeLabels[record.mode]} · {formatDate(record.completedAt)}
          </p>
          <div className="result-rewards">
            <span>
              <Zap size={17} />+{record.xp} XP
            </span>
            <span>
              <Target size={17} />
              {result.attributes.filter((a) => a.status === 'mastered').length} konsep dikuasai
            </span>
          </div>
        </div>
        <img
          src="/assets/mascots/quiz-celebrate.png"
          alt="Maskot EduBridge merayakan usaha belajarmu dengan piala bintang"
        />
      </div>
      <div className="result-grid">
        <section className="card result-score-card">
          <span className="eyebrow">NILAI {modeLabels[record.mode].toUpperCase()}</span>
          <div className="result-score">
            {result.score}
            <span>/100</span>
          </div>
          <p>
            {result.correctCount} dari {result.total} jawaban benar
          </p>
          {comparison && (
            <div className="comparison-summary">
              <strong>
                {comparison.scoreChange > 0 ? '+' : ''}
                {comparison.scoreChange} poin
              </strong>
              <span>dibandingkan pretest siklus ini</span>
              <strong>{comparison.gapsClosed} gap tertutup</strong>
              <span>
                {comparison.preGapCount} gap awal → {comparison.postGapCount} gap akhir
              </span>
              {comparison.newGaps > 0 && (
                <span>{comparison.newGaps} atribut memerlukan penguatan baru.</span>
              )}
            </div>
          )}
          <p className="score-note">
            Nilai adalah petunjuk untuk langkah berikutnya. Fokus pada konsep yang perlu dikuatkan.
          </p>
        </section>
        <section className="card">
          <SectionHead
            title="Apa yang sudah kamu pahami?"
            action={
              <Badge tone="orange">
                {result.simulated ? 'Hasil lama · Simulasi' : 'PDINA · Kalibrasi sintetis'}
              </Badge>
            }
          >
            {result.simulated
              ? 'Hasil ini disimpan sebelum integrasi model PDINA.'
              : 'Persentase adalah estimasi probabilitas penguasaan, bukan persentase jawaban benar. Hasil perlu ditinjau bersama guru.'}
          </SectionHead>
          <AttributeResults attributes={result.attributes} comparison={comparison} />
          {result.insufficientCount > 0 && (
            <p className="method-note">
              {result.insufficientCount} atribut belum memiliki cukup bukti untuk disimpulkan.
            </p>
          )}
          {result.unsupportedItemIds?.length > 0 && (
            <p className="method-note">
              Sebagian soal telah berubah sejak kalibrasi dan dikecualikan dari inferensi model.
              Nilai kuis tetap dihitung dari jawabanmu.
            </p>
          )}
          {comparison?.comparable === false && (
            <p className="method-note">
              Versi diagnosis awal dan akhir berbeda; perubahan learning gap belum dapat
              dibandingkan.
            </p>
          )}
          {result.provider === 'pdina' && (
            <NarrativePanel key={record.id} assessmentId={record.id} />
          )}
          <div className="result-next">
            <h3>Langkah berikutnya</h3>
            <p>
              {record.mode === 'pretest'
                ? 'Ikuti pembelajaran di kelas, lalu pelajari materi penguatan sesuai atribut yang belum dikuasai.'
                : result.gapCount
                  ? 'Masih ada konsep untuk dilatih. Ulangi bagian yang direkomendasikan dan bawa pertanyaanmu ke guru.'
                  : result.insufficientCount
                    ? 'Bukti jawaban belum cukup untuk menyimpulkan penguasaan. Diskusikan asesmen tambahan dengan guru.'
                    : result.uncertainCount
                      ? 'Sebagian konsep masih perlu dikonfirmasi melalui latihan dan diskusi dengan guru.'
                      : 'Konsep yang diukur sudah dikuasai. Pertahankan pemahamanmu dan jelajahi topik berikutnya.'}
            </p>
            <div className="button-row">
              {topic && (
                <ButtonLink to={`/materi/${record.topicId}`} arrow>
                  {record.mode === 'pretest' ? 'Ke materi penguatan' : 'Tinjau materi'}
                </ButtonLink>
              )}
              <ButtonLink to="/progres" variant="secondary">
                Lihat progres
                <ArrowRight size={16} />
              </ButtonLink>
            </div>
          </div>
        </section>
      </div>
      <section className="card review-card">
        <SectionHead
          title="Belajar dari setiap jawaban"
          action={
            <Button variant="secondary" onClick={() => setReview(!review)}>
              {review ? 'Tutup pembahasan' : 'Buka pembahasan'}
              <RotateCcw size={15} />
            </Button>
          }
        >
          Tinjau alasan di balik jawaban yang tepat.
        </SectionHead>
        {review && (
          <div className="review-list">
            {record.questions.map((q, i) => (
              <article
                key={q.id}
                className={record.responses[i] === q.answer ? 'correct' : 'incorrect'}
              >
                <div className="row-between">
                  <Badge tone={record.responses[i] === q.answer ? 'teal' : 'orange'}>
                    SOAL {i + 1} · {record.responses[i] === q.answer ? 'Benar' : 'Perlu ditinjau'}
                  </Badge>
                </div>
                <h3>
                  <MathText text={q.text} />
                </h3>
                <p>
                  Jawabanmu:{' '}
                  <strong>
                    {q.options[record.responses[i]] === undefined ? (
                      'Tidak dijawab'
                    ) : (
                      <MathText text={q.options[record.responses[i]]} whole />
                    )}
                  </strong>
                </p>
                <p>
                  Jawaban tepat:{' '}
                  <strong>
                    <MathText text={q.options[q.answer]} whole />
                  </strong>
                </p>
                <div className="review-explanation">
                  <MathText text={q.explanation} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
