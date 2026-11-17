import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Flame,
  GraduationCap,
  LockKeyhole,
  Star,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import {
  Badge,
  ButtonLink,
  Empty,
  Meter,
  PageHead,
  SectionHead,
  Symbol,
} from '../../components/ui/Kit';
import { statusMeta, topicLink } from '../../lib/api';
import mascot from '../../assets/images/mascots copy/mascot-2-1-2.png';
import cheer from '../../assets/images/mascots copy/cheer.png';

export function LearningPath({ topic, adventure = false }) {
  const state = topic.state;
  const steps = [
    {
      title: 'Kenali kemampuan',
      subtitle: 'Pretest & diagnosis awal',
      reward: '+60 XP',
      done: Boolean(state.pre),
      active: !state.pre,
      Icon: ClipboardCheck,
      to: `/kuis?subject=${topic.id}&mode=pretest`,
    },
    {
      title: 'Belajar di kelas',
      subtitle: 'Pembelajaran bersama guru',
      reward: 'Bersama guru',
      done: state.phase !== 'pretest' && Boolean(state.pre),
      active: Boolean(state.pre) && state.phase === 'pretest' && !state.lessonAt,
      Icon: GraduationCap,
      to: `/materi/${topic.id}`,
    },
    {
      title: 'Kuatkan konsep',
      subtitle: 'Materi sesuai learning gap',
      reward: '+40 XP',
      done: Boolean(state.lessonAt),
      active: Boolean(state.pre) && state.phase !== 'pretest' && !state.lessonAt,
      Icon: BookOpen,
      to: `/materi/${topic.id}`,
    },
    {
      title: 'Lihat kemajuan',
      subtitle:
        state.status === 'waiting' ? 'Menunggu posttest dibuka guru' : 'Posttest & diagnosis akhir',
      reward: '+100 XP',
      done: Boolean(state.post),
      active: Boolean(state.lessonAt) && state.phase === 'posttest' && !state.post,
      Icon: Trophy,
      to: state.post ? `/kuis/hasil/${state.post.id}` : `/kuis?subject=${topic.id}&mode=posttest`,
    },
  ];
  return (
    <div
      className={`learning-path ${adventure ? 'adventure-path' : ''}`}
      aria-label="Jalur belajar topik"
    >
      {adventure && (
        <svg
          className="adventure-track"
          viewBox="0 0 560 480"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M196 60C196 120 336 120 336 180S196 240 196 300 336 360 336 420"
            fill="none"
            stroke="#f0f3f7"
            strokeWidth="25"
            strokeLinecap="round"
          />
          <path
            d="M196 60C196 120 336 120 336 180S196 240 196 300 336 360 336 420"
            fill="none"
            stroke="#dce4ec"
            strokeWidth="3"
            strokeDasharray="2 11"
            strokeLinecap="round"
          />
        </svg>
      )}
      {steps.map(({ title, subtitle, reward, done, active, Icon, to }, i) => (
        <Link
          key={title}
          to={to}
          className={`path-step ${done ? 'done' : active ? 'current' : 'locked'}`}
          style={adventure ? { '--step-x': i % 2 ? '60%' : '35%' } : undefined}
        >
          <span className="path-node">
            {done ? (
              <Check size={adventure ? 33 : 24} strokeWidth={3} />
            ) : active ? (
              <Icon size={adventure ? 33 : 24} strokeWidth={2.5} />
            ) : (
              <LockKeyhole size={adventure ? 26 : 19} />
            )}
          </span>
          <span className="path-copy">
            <span className="path-number">LANGKAH 0{i + 1}</span>
            <strong>{title}</strong>
            <small>{subtitle}</small>
            {adventure && (
              <span className="path-reward">
                {done ? <Check size={12} /> : <Zap size={12} />}
                {done ? 'Selesai' : reward}
              </span>
            )}
          </span>
          {active && (
            <span className="path-here">{adventure ? 'LANJUT DI SINI' : 'Kamu di sini'}</span>
          )}
        </Link>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user, data } = useApp();
  const { topics, progress } = data;
  const current =
    topics.find((t) => t.state.pre && !t.state.post) ??
    topics.find((t) => !t.state.pre) ??
    topics[0];
  const measured = topics.filter((t) => t.state.pre);
  const recommendations = measured
    .flatMap((t) => (t.state.post ?? t.state.pre).recommendations.map((r) => ({ ...r, topic: t })))
    .slice(0, 3);
  const today = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Jakarta',
  }).format(new Date());
  return (
    <>
      <PageHead eyebrow={today} title={`Halo, ${user.name.split(' ')[0]}!`}>
        Siap menaklukkan satu konsep lagi hari ini?
      </PageHead>
      <div className="student-adventure-layout">
        <div className="adventure-main">
          {current ? (
            <>
              <section className="journey-welcome">
                <div>
                  <Badge tone="blue">
                    <Star size={13} />
                    PERJALANAN MATEMATIKAMU
                  </Badge>
                  <h2>
                    Langkah kecil.
                    <br />
                    <em>Pemahaman besar.</em>
                  </h2>
                  <p>
                    {current.state.pre
                      ? `Ayo lanjutkan ${current.title.toLowerCase()}. Kita kuatkan satu konsep, satu per satu.`
                      : 'Kita mulai dengan mengenali kemampuanmu. Lalu, bangun pemahaman lewat pembelajaran di kelas dan penguatan.'}
                  </p>
                  <ButtonLink to={topicLink(current)} arrow>
                    {current.state.status === 'pretest'
                      ? 'Mulai perjalananmu'
                      : current.state.post
                        ? 'Lihat hasil belajarmu'
                        : 'Lanjutkan belajar'}
                  </ButtonLink>
                </div>
                <img src={mascot} alt="Maskot EduBridge siap menemani belajar" />
              </section>
              <div className="learning-milestones" aria-label="Ringkasan perjalanan">
                <span>
                  <Target size={19} />
                  <strong>
                    {progress.mastered}/{progress.totalAttributes}
                  </strong>{' '}
                  konsep dikuasai
                </span>
                <span>
                  <CheckCheck size={19} />
                  <strong>{progress.gapsClosed}</strong> gap tertutup
                </span>
                <span>
                  <Trophy size={19} />
                  <strong>
                    {progress.completed}/{progress.topicCount}
                  </strong>{' '}
                  siklus selesai
                </span>
              </div>
              <section className={`adventure-world ${current.color}`}>
                <div className="world-heading">
                  <Symbol topic={current} />
                  <div>
                    <span className="eyebrow">
                      BAB {String(topics.indexOf(current) + 1).padStart(2, '0')} ·{' '}
                      {current.category.toUpperCase()}
                    </span>
                    <h2>{current.title}</h2>
                    <p>Kenali. Pelajari. Kuasai.</p>
                  </div>
                  <Link to="/katalog" className="world-change" aria-label="Lihat semua materi">
                    <BookOpen size={21} />
                  </Link>
                </div>
                <div className="world-caption">
                  <Badge tone={statusMeta(current.state).tone}>
                    {statusMeta(current.state).label}
                  </Badge>
                  <span>
                    {current.minutes} menit · {current.attributes.length} konsep
                  </span>
                </div>
                <LearningPath topic={current} adventure />
                <div className="world-footer">
                  <span>
                    <Star size={17} />
                    Setiap usaha membuatmu maju.
                  </span>
                  <Link to="/katalog">
                    Semua materi <ArrowRight size={16} />
                  </Link>
                </div>
              </section>
            </>
          ) : (
            <Empty title="Materi sedang disiapkan">
              Guru akan segera membagikan topik belajarmu.
            </Empty>
          )}
          <details className="understanding-fold" open={measured.length === 0}>
            <summary>
              <div>
                <span className="understanding-mark">
                  <Target size={22} />
                </span>
                <div>
                  <h2>Peta pemahamanmu</h2>
                  <small>
                    {measured.length
                      ? `${measured.length} topik sudah terpetakan. Lihat konsep yang sudah kuat.`
                      : 'Mulai pretest untuk menemukan titik awalmu.'}
                  </small>
                </div>
              </div>
              <ChevronDown size={20} />
            </summary>
            <div className="understanding-body">
              {measured.length ? (
                measured.map((topic) => {
                  const result = topic.state.post ?? topic.state.pre;
                  const count = result.attributes.filter((a) => a.status === 'mastered').length;
                  return (
                    <Link to={`/materi/${topic.id}`} className="mastery-row" key={topic.id}>
                      <Symbol topic={topic} small />
                      <div className="mastery-topic">
                        <strong>{topic.title}</strong>
                        <small>
                          {topic.state.post
                            ? 'Diagnosis pascapembelajaran'
                            : 'Diagnosis prapembelajaran'}
                        </small>
                      </div>
                      <div className="mastery-meter">
                        <Meter
                          value={(count / result.attributes.length) * 100}
                          tone="teal"
                          label={`Penguasaan ${topic.title}`}
                        />
                        <span>
                          {count}/{result.attributes.length} konsep
                        </span>
                      </div>
                      <ChevronRight size={17} />
                    </Link>
                  );
                })
              ) : (
                <Empty
                  title="Peta pemahamanmu dimulai di sini"
                  action={
                    <ButtonLink to="/kuis" variant="secondary" arrow>
                      Kerjakan pretest
                    </ButtonLink>
                  }
                >
                  Hasil asesmen menunjukkan konsep yang dikuasai dan yang perlu penguatan.
                </Empty>
              )}
              <div className="row-between">
                <span className="method-note">Diagnosis PDINA · Estimasi berdasarkan bukti jawaban</span>
                <Link className="text-link" to="/progres">
                  Lihat progres <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </details>
        </div>
        <aside className="adventure-companions">
          <section className="card daily-card">
            <div className="row-between">
              <h2>Misi hari ini</h2>
              <span className="mission-icon">
                <Target size={22} />
              </span>
            </div>
            <div
              className="daily-ring"
              style={{ '--progress': `${Math.min(progress.todayXp / 100, 1) * 360}deg` }}
            >
              <div>
                <Zap size={25} />
                <strong>
                  {progress.todayXp}
                  <small>/100</small>
                </strong>
                <span>XP HARI INI</span>
              </div>
            </div>
            <h3>
              {progress.todayXp >= 100
                ? 'Misinya tuntas. Kamu hebat!'
                : 'Kumpulkan 100 XP hari ini.'}
            </h3>
            <p>
              {progress.todayXp >= 100
                ? 'Rayakan usahamu dan jaga ritme belajarmu.'
                : 'Belajar dan selesaikan asesmen untuk menambah XP.'}
            </p>
            <div className="week-dots">
              {progress.week.map((day, i) => (
                <div key={day.date} className={day.xp > 0 ? 'active' : i === 6 ? 'today' : ''}>
                  <span>{day.day.charAt(0)}</span>
                  <i>{day.xp > 0 ? <Check size={13} /> : i === 6 ? <Flame size={13} /> : '·'}</i>
                </div>
              ))}
            </div>
            <div className="streak-note">
              <Flame size={18} />
              <strong>{progress.streak} hari</strong> konsisten belajar
            </div>
          </section>
          <section className="card recommendation-card">
            <SectionHead title="Fokus berikutnya" action={<Target size={19} />} />
            {recommendations.length ? (
              recommendations.map((item) => (
                <Link
                  key={`${item.topic.id}-${item.attributeId}`}
                  to={`/materi/${item.topic.id}?bagian=${item.blockIndex}`}
                  className="recommendation"
                >
                  <Symbol topic={item.topic} small />
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.topic.category} · Penguatan konsep</small>
                  </div>
                  <ArrowUpRight size={17} />
                </Link>
              ))
            ) : (
              <div className="rail-empty">
                <BookOpen size={26} />
                <p>
                  {measured.length
                    ? 'Konsep terukur sudah dikuasai. Jelajahi topik berikutnya!'
                    : 'Selesaikan pretest untuk menemukan fokus belajarmu.'}
                </p>
              </div>
            )}
          </section>
          <section className="achievement-teaser">
            <div>
              <Badge tone="orange">
                <Trophy size={13} />
                KOLEKSI LENCANA
              </Badge>
              <h3>
                Usahamu layak
                <br />
                dirayakan.
              </h3>
              <p>
                {progress.badges.filter((b) => b.earned).length} dari {progress.badges.length}{' '}
                lencana terbuka.
              </p>
              <Link to="/profil?tab=achievements" className="text-link">
                Lihat lencana <ArrowRight size={15} />
              </Link>
            </div>
            <img src={cheer} alt="Maskot EduBridge merayakan kemajuan" />
          </section>
        </aside>
      </div>
    </>
  );
}
