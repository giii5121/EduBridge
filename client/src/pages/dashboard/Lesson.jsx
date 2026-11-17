import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
const FormattedMessage = lazy(() => import('../../components/learning/FormattedMessage'));
import {
  ArrowLeft,
  ArrowRight,
  BookCheck,
  Check,
  Clock3,
  Send,
  Sparkles,
  LockKeyhole,
  GraduationCap,
} from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import { api } from '../../lib/api';
import { plainMarkdown } from '../../lib/mathText';
import {
  Badge,
  Button,
  ButtonLink,
  Empty,
  ErrorNotice,
  Meter,
  PageHead,
} from '../../components/ui/Kit';
import { LearningPath } from './Dashboard';
import ConceptContent from '../../components/learning/ConceptContent';
import RelatedMaterials from '../../components/learning/RelatedMaterials';
export default function Lesson() {
  const { topicId } = useParams();
  const [params] = useSearchParams();
  const { data, user, refresh, notify } = useApp();
  const topic = data.topics.find((t) => t.id === topicId);
  const [read, setRead] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [chatBusy, setChatBusy] = useState(false);
  const chatEnd = useRef(null);
  useEffect(() => {
    setRead(new Set());
    setChat([]);
    setError('');
  }, [topicId]);
  useEffect(() => {
    const section = document.getElementById(`bagian-${params.get('bagian')}`);
    section?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [params, topicId]);
  useEffect(() => {
    if (chat.length) chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [chat]);
  if (!topic)
    return (
      <Empty
        title="Materi tidak tersedia"
        action={<ButtonLink to="/katalog">Kembali ke katalog</ButtonLink>}
      >
        Materi mungkin masih disiapkan atau belum dipublikasikan.
      </Empty>
    );
  const student = user.role === 'student';
  const state = topic.state;
  const canLearn = !student || (state.pre && state.phase !== 'pretest');
  const complete = Boolean(state.lessonAt);
  const gaps =
    (state.post ?? state.pre)?.attributes
      .filter((a) => a.status === 'gap' || a.status === 'developing')
      .map((a) => a.id) ?? [];
  async function finish() {
    setBusy(true);
    setError('');
    try {
      await api(`/topics/${topic.id}/lesson`, { method: 'POST' });
      await refresh();
      notify('Materi penguatan selesai. +40 XP untuk usahamu!');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function ask(event) {
    event.preventDefault();
    const question = message.trim();
    if (!question || chatBusy) return;
    setMessage('');
    setChat((c) => [...c, { role: 'user', text: question }]);
    setChatBusy(true);
    try {
      const reply = await api('/assistant', {
        method: 'POST',
        body: {
          topicId: topic.id,
          message: question,
          history: chat
            .filter((c) => c.role !== 'error')
            .slice(-6)
            .map(({ role, text }) => ({ role, text: text.slice(0, 2000) })),
        },
      });
      setChat((c) => [...c, { role: 'assistant', text: reply.message, fallback: reply.fallback }]);
    } catch (err) {
      setChat((c) => [...c, { role: 'error', text: err.message }]);
    } finally {
      setChatBusy(false);
    }
  }
  return (
    <>
      <Link to="/katalog" className="back-link">
        <ArrowLeft size={16} />
        Kembali ke katalog
      </Link>
      <PageHead
        eyebrow={`${topic.category.toUpperCase()} · KELAS XI`}
        title={topic.title}
        action={
          <Badge tone="neutral">
            <Clock3 size={13} />
            {topic.minutes} menit
          </Badge>
        }
      >
        {topic.summary}
      </PageHead>
      {!student && (
        <div className="button-row">
          <ButtonLink to={`/kelola-materi?topik=${topic.id}`} variant="secondary">
            Sesuaikan materi untuk kelas
          </ButtonLink>
          <ButtonLink to="/kelola-materi" variant="ghost">
            Kelola materi tambahan
          </ButtonLink>
        </div>
      )}
      {student && (
        <section className="card lesson-path">
          <LearningPath topic={topic} />
        </section>
      )}
      {!canLearn && (
        <div className="notice info">
          <LockKeyhole size={20} />
          <div>
            <strong>
              {!state.pre ? 'Kenali kemampuan awalmu dahulu.' : 'Fase pembelajaran belum dibuka.'}
            </strong>
            <p>
              {!state.pre
                ? 'Pretest membantu memetakan konsep yang perlu diperkuat. Ikuti asesmen sebelum membaca materi ini.'
                : 'Guru akan membuka materi penguatan setelah asesmen awal di kelas.'}
            </p>
            {!state.pre && (
              <ButtonLink to={`/kuis?subject=${topic.id}&mode=pretest`} variant="secondary" arrow>
                Kerjakan pretest
              </ButtonLink>
            )}
          </div>
        </div>
      )}
      {canLearn && (
        <div className="lesson-grid">
          <div>
            <div className="lesson-class-note">
              <GraduationCap size={22} />
              <div>
                <strong>Lanjutkan yang kamu pelajari di kelas.</strong>
                <p>
                  Materi ini melengkapi pembelajaran bersama guru. Fokuskan penguatan pada konsep
                  yang ditandai.
                </p>
              </div>
            </div>
            {topic.blocks.map((block, index) => (
              <article className="card lesson-block" key={block.title} id={`bagian-${index}`}>
                <div className="row-between">
                  <span className="lesson-number">KONSEP 0{index + 1}</span>
                  {gaps.includes(index) && <Badge tone="orange">Fokus penguatan</Badge>}
                </div>
                <h2>{block.title}</h2>
                <ConceptContent block={block} />
                {student && (
                  <button
                    className={`read-button ${read.has(index) || complete ? 'checked' : ''}`}
                    onClick={() =>
                      setRead((prev) => {
                        const next = new Set(prev);
                        if (next.has(index)) next.delete(index);
                        else next.add(index);
                        return next;
                      })
                    }
                    disabled={complete}
                  >
                    <span>{(read.has(index) || complete) && <Check size={13} />}</span>
                    {read.has(index) || complete
                      ? 'Sudah saya pelajari'
                      : 'Tandai sudah dipelajari'}
                  </button>
                )}
              </article>
            ))}
            {student && (
              <section className="card lesson-finish">
                <ErrorNotice>{error}</ErrorNotice>
                <BookCheck size={27} />
                <h2>
                  {complete
                    ? 'Satu langkah lagi sudah kamu tuntaskan.'
                    : 'Sudah mempelajari semua konsep?'}
                </h2>
                <p>
                  {complete
                    ? state.phase === 'posttest'
                      ? 'Posttest sudah terbuka. Lihat perubahan pemahamanmu setelah pembelajaran.'
                      : 'Kamu bisa berlatih sambil menunggu guru membuka posttest.'
                    : 'Tandai setiap bagian setelah kamu memahaminya, lalu selesaikan materi penguatan.'}
                </p>
                <div className="button-row">
                  {!complete && (
                    <Button
                      busy={busy}
                      disabled={read.size !== topic.blocks.length}
                      onClick={finish}
                    >
                      Selesaikan materi <Badge tone="neutral">+40 XP</Badge>
                    </Button>
                  )}
                  {complete && state.phase === 'posttest' && !state.post && (
                    <ButtonLink to={`/kuis?subject=${topic.id}&mode=posttest`} arrow>
                      Kerjakan posttest
                    </ButtonLink>
                  )}
                  <ButtonLink to={`/kuis?subject=${topic.id}&mode=remedial`} variant="secondary">
                    Latihan penguatan <ArrowRight size={16} />
                  </ButtonLink>
                </div>
              </section>
            )}
          </div>
          <aside className="lesson-rail">
            <section className="card">
              <h3>Langkah penguatanmu</h3>
              <p className="muted">
                {complete ? topic.blocks.length : read.size} dari {topic.blocks.length} konsep
                dipelajari
              </p>
              <Meter
                value={complete ? 100 : (read.size / topic.blocks.length) * 100}
                tone="teal"
                label="Progres membaca"
              />
              <nav className="lesson-index">
                {topic.blocks.map((b, i) => (
                  <a href={`#bagian-${i}`} key={b.title}>
                    <span className={read.has(i) || complete ? 'done' : ''}>
                      {read.has(i) || complete ? <Check size={12} /> : i + 1}
                    </span>
                    {b.title}
                  </a>
                ))}
              </nav>
            </section>
            {student && (
              <section className="card assistant-card">
                <div className="row-between">
                  <h3>
                    <Sparkles size={17} />
                    Teman memahami
                  </h3>
                  <Badge tone="blue">Pendamping konsep</Badge>
                </div>
                <p className="muted">
                  Butuh penjelasan tambahan? Mulai dari konsep yang sedang kamu pelajari.
                </p>
                <div className="chat-messages" aria-live="polite">
                  {!chat.length && (
                    <div className="chat-bubble assistant">
                      Coba tanya, “Bantu jelaskan {topic.attributes[gaps[0] ?? 0].toLowerCase()}.”
                    </div>
                  )}
                  {chat.map((c, i) => (
                    <div key={i} className={`chat-bubble ${c.role}`}>
                      {c.role === 'assistant' ? (
                        <Suspense fallback={plainMarkdown(c.text)}>
                          <FormattedMessage text={c.text} />
                        </Suspense>
                      ) : (
                        c.text
                      )}
                      {c.fallback && (
                        <small className="field-help">
                          Penjelasan dari materi terkurasi; Gemini sedang tidak tersedia.
                        </small>
                      )}
                    </div>
                  ))}
                  {chatBusy && <div className="chat-bubble assistant">Menyiapkan penjelasan…</div>}
                  <div ref={chatEnd} />
                </div>
                <form className="chat-input" onSubmit={ask}>
                  <input
                    aria-label="Pertanyaan pendamping belajar"
                    maxLength={1000}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tanyakan satu konsep…"
                  />
                  <button aria-label="Kirim pertanyaan" disabled={chatBusy || !message.trim()}>
                    <Send size={17} />
                  </button>
                </form>
              </section>
            )}
          </aside>
        </div>
      )}
      <RelatedMaterials key={topic.id} topic={topic} />
    </>
  );
}
