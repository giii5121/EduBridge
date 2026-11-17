import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, CheckCheck, Flame, Target, Trophy, Zap } from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import {
  Badge,
  ButtonLink,
  Empty,
  Meter,
  PageHead,
  SectionHead,
  Stat,
  Symbol,
} from '../../components/ui/Kit';
import { formatDate, modeLabels } from '../../lib/api';
export default function Progres() {
  const { data } = useApp();
  const { progress, topics } = data;
  const [mode, setMode] = useState('all');
  const history = progress.history.filter((h) => mode === 'all' || h.mode === mode);
  const paired = topics.filter((t) => t.state.comparison);
  const maxXp = Math.max(100, ...progress.week.map((day) => day.xp));
  return (
    <>
      <PageHead
        eyebrow="BUKTI DARI USAHAMU"
        title="Kemajuanmu, terlihat jelas."
        action={
          <ButtonLink to="/katalog" variant="secondary" arrow>
            Lanjutkan belajar
          </ButtonLink>
        }
      >
        Bandingkan pemahaman sebelum dan setelah pembelajaran di kelas.
      </PageHead>
      <div className="stats-grid four">
        <Stat
          icon={Target}
          label="Konsep dikuasai"
          value={`${progress.mastered}/${progress.totalAttributes}`}
          detail="atribut yang telah diukur"
          tone="teal"
        />
        <Stat
          icon={CheckCheck}
          label="Gap tertutup"
          value={progress.gapsClosed}
          detail="dari pasangan pre–post terkini"
          tone="blue"
        />
        <Stat
          icon={Trophy}
          label="Siklus selesai"
          value={`${progress.completed}/${progress.topicCount}`}
          detail="topik dengan hasil pre–post"
          tone="orange"
        />
        <Stat
          icon={Flame}
          label="Konsistensi"
          value={`${progress.streak} hari`}
          detail="aktivitas berturut-turut"
          tone="pink"
        />
      </div>
      <div className="progress-overview">
        <section className="card">
          <SectionHead
            title="Pemahaman yang bertumbuh"
            action={<Badge tone="blue">Estimasi PDINA</Badge>}
          >
            Perbandingan menggunakan pasangan asesmen dalam siklus yang sama.
          </SectionHead>
          {paired.length ? (
            <>
              <div className="chart-legend">
                <span>
                  <i className="pre" />
                  Pretest
                </span>
                <span>
                  <i className="post" />
                  Posttest
                </span>
              </div>
              <div className="comparison-chart">
                {paired.map((t) => (
                  <div key={t.id} className="comparison-chart-row">
                    <span>{t.title}</span>
                    <div>
                      <div
                        className="comparison-bar pre"
                        style={{ width: `${t.state.pre.score}%` }}
                      >
                        <span>{t.state.pre.score}</span>
                      </div>
                      <div
                        className="comparison-bar post"
                        style={{ width: `${t.state.post.score}%` }}
                      >
                        <span>{t.state.post.score}</span>
                      </div>
                    </div>
                    <strong
                      className={t.state.comparison.scoreChange >= 0 ? 'positive' : 'negative'}
                    >
                      {t.state.comparison.scoreChange > 0 ? '+' : ''}
                      {t.state.comparison.scoreChange}
                      <small>poin</small>
                    </strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <Empty title="Perbandingan akan hadir di sini">
              Selesaikan satu siklus pretest, pembelajaran, dan posttest untuk melihat perubahannya.
            </Empty>
          )}
        </section>
        <section className="card">
          <SectionHead
            title="Ritme belajarmu"
            action={
              <Badge tone="blue">
                <Zap size={12} />
                {progress.week.reduce((s, d) => s + d.xp, 0)} XP
              </Badge>
            }
          >
            Aktivitas tujuh hari terakhir, dalam XP.
          </SectionHead>
          <div
            className="activity-chart"
            role="img"
            aria-label={progress.week.map((d) => `${d.day}: ${d.xp} XP`).join(', ')}
          >
            {progress.week.map((day, i) => (
              <div key={day.date}>
                <span>{day.xp || '—'}</span>
                <div className="activity-track">
                  <i
                    className={i === 6 ? 'today' : ''}
                    style={{ height: `${(day.xp / maxXp) * 100}%` }}
                  />
                </div>
                <small>{day.day}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="card">
        <SectionHead
          title="Detail setiap perjalanan"
          action={
            <Link className="text-link" to="/katalog">
              Jelajahi materi <ArrowUpRight size={15} />
            </Link>
          }
        >
          Atribut baru dihitung setelah tersedia bukti jawaban.
        </SectionHead>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Topik</th>
                <th>Pretest</th>
                <th>Posttest</th>
                <th>Gap awal → akhir</th>
                <th>Konsep dikuasai</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {topics.map((t) => {
                const result = t.state.post ?? t.state.pre;
                return (
                  <tr key={t.id}>
                    <td>
                      <div className="table-topic">
                        <Symbol topic={t} small />
                        <strong>{t.title}</strong>
                      </div>
                    </td>
                    <td>{t.state.pre?.score ?? '—'}</td>
                    <td>{t.state.post?.score ?? '—'}</td>
                    <td>
                      {t.state.pre ? (
                        `${t.state.pre.gapCount} → ${t.state.post?.gapCount ?? '…'}`
                      ) : (
                        <span className="muted">Belum diukur</span>
                      )}
                    </td>
                    <td>
                      {result ? (
                        <div className="table-meter">
                          <Meter
                            value={
                              (result.attributes.filter((a) => a.status === 'mastered').length /
                                result.attributes.length) *
                              100
                            }
                            tone="teal"
                            label={`Konsep ${t.title}`}
                          />
                          <span>
                            {result.attributes.filter((a) => a.status === 'mastered').length}/
                            {result.attributes.length}
                          </span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <Link
                        aria-label={`Lihat ${t.title}`}
                        className="icon-button"
                        to={
                          t.state.post
                            ? `/kuis/hasil/${t.state.post.id}`
                            : t.state.pre
                              ? `/kuis/hasil/${t.state.pre.id}`
                              : `/kuis?subject=${t.id}&mode=pretest`
                        }
                      >
                        <ArrowRight size={17} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="method-note">
          Gap mengikuti label model dan kecukupan bukti, bukan batas nilai kuis. Kalibrasi PDINA
          memakai data sintetis. Perbandingan memakai pretest dan posttest pada siklus yang sama.
        </p>
      </section>
      <section className="card history-card">
        <SectionHead
          title="Jejak usahamu"
          action={
            <select
              aria-label="Filter riwayat"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="all">Semua aktivitas</option>
              <option value="pretest">Pretest</option>
              <option value="posttest">Posttest</option>
              <option value="remedial">Latihan penguatan</option>
            </select>
          }
        />
        {history.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Materi</th>
                  <th>Aktivitas</th>
                  <th>Tanggal</th>
                  <th>Nilai</th>
                  <th>XP</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <strong>{h.title}</strong>
                    </td>
                    <td>
                      <Badge
                        tone={
                          h.mode === 'posttest' ? 'teal' : h.mode === 'remedial' ? 'orange' : 'blue'
                        }
                      >
                        {modeLabels[h.mode]}
                      </Badge>
                    </td>
                    <td>{formatDate(h.completedAt)}</td>
                    <td>{h.score}/100</td>
                    <td className="positive">+{h.xp}</td>
                    <td>
                      <Link className="text-link" to={`/kuis/hasil/${h.id}`}>
                        Detail <ArrowUpRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Belum ada aktivitas di bagian ini"
            action={
              <ButtonLink to="/kuis" variant="secondary">
                Mulai asesmen
              </ButtonLink>
            }
          >
            Setiap langkah yang kamu selesaikan akan tersimpan di sini.
          </Empty>
        )}
      </section>
    </>
  );
}
