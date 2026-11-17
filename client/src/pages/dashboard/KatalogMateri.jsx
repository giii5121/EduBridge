import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Clock3, ArrowRight, BookOpen, Check, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../../lib/AppContext';
import { Badge, ButtonLink, Empty, PageHead, Symbol } from '../../components/ui/Kit';
import { statusMeta, topicLink } from '../../lib/api';
import book from '../../assets/images/mascots copy/book.png';
export default function KatalogMateri() {
  const { data, user } = useApp();
  const [params, setParams] = useSearchParams();
  const [category, setCategory] = useState('Semua materi');
  const [filter, setFilter] = useState('all');
  const query = params.get('q') ?? '';
  const categories = ['Semua materi', ...new Set(data.topics.map((t) => t.category))];
  const filtered = data.topics.filter(
    (t) =>
      (category === 'Semua materi' || t.category === category) &&
      `${t.title} ${t.summary} ${t.category}`.toLowerCase().includes(query.toLowerCase()) &&
      (filter === 'all' ||
        (filter === 'progress' && t.state.pre && !t.state.post) ||
        (filter === 'done' && t.state.post)),
  );
  return (
    <>
      <PageHead eyebrow="TEMUKAN LANGKAH BERIKUTNYA" title="Ruang untuk makin paham.">
        Materi matematika XI dengan penguatan sesuai kebutuhan belajarmu.
      </PageHead>
      <section className="catalog-banner">
        <div>
          <Badge tone="teal">KENALI → PELAJARI → KUASAI</Badge>
          <h2>
            Belajar dimulai dari
            <br />
            memahami kebutuhanmu.
          </h2>
          <p>
            Kerjakan pretest, ikuti pembelajaran kelas, kuatkan konsep,
            <br className="desktop-only" /> lalu ukur kemajuanmu lewat posttest.
          </p>
        </div>
        <img src={book} alt="Maskot EduBridge membaca buku matematika" />
        <div className="banner-index">
          <strong>{data.topics.length.toString().padStart(2, '0')}</strong>
          <span>
            topik belajar
            <br />
            untuk dijelajahi
          </span>
        </div>
      </section>
      <div className="catalog-toolbar">
        <div className="filter-tabs" aria-label="Kategori materi">
          {categories.map((c) => (
            <button
              key={c}
              className={category === c ? 'active' : ''}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="catalog-controls">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Cari di katalog"
              placeholder="Cari topik atau konsep…"
              value={query}
              onChange={(e) =>
                setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })
              }
            />
          </div>
          {user.role === 'student' && (
            <label className="select-field">
              <SlidersHorizontal size={16} />
              <select
                aria-label="Filter progres"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">Semua progres</option>
                <option value="progress">Sedang dipelajari</option>
                <option value="done">Siklus selesai</option>
              </select>
            </label>
          )}
        </div>
      </div>
      <div className="results-caption">
        <span>{filtered.length} topik tersedia</span>
        <span>MATEMATIKA · KELAS XI</span>
      </div>
      <div className="topic-grid">
        {filtered.map((topic, index) => {
          const meta = statusMeta(topic.state);
          return (
            <article className={`topic-card ${topic.color}`} key={topic.id}>
              <div className="topic-card-art">
                <span className="topic-card-index">MODUL {String(index + 1).padStart(2, '0')}</span>
                <Symbol topic={topic} />
                <span className="topic-art-orbit" />
                <span className="topic-card-category">{topic.category}</span>
                {topic.state.post && (
                  <span className="completed-mark" aria-label="Siklus selesai">
                    <Check size={18} />
                  </span>
                )}
              </div>
              <div className="topic-card-content">
                <div className="row-between">
                  <span className="eyebrow">KELAS XI</span>
                  <Badge
                    tone={
                      topic.published ? (user.role === 'student' ? meta.tone : 'teal') : 'neutral'
                    }
                  >
                    {topic.published
                      ? user.role === 'student'
                        ? topic.state.status === 'completed'
                          ? 'Selesai'
                          : topic.state.pre
                            ? 'Sedang dipelajari'
                            : 'Siap dimulai'
                        : 'Terpublikasi'
                      : 'Draf'}
                  </Badge>
                </div>
                <h2>
                  <Link to={`/materi/${topic.id}`}>{topic.title}</Link>
                </h2>
                <p>{topic.summary}</p>
                <div className="topic-meta">
                  <span>
                    <Clock3 size={14} />
                    {topic.minutes} menit
                  </span>
                  <span>
                    <BookOpen size={14} />
                    {topic.attributes.length} konsep
                  </span>
                </div>
                <div className="topic-card-action">
                  <ButtonLink
                    to={user.role === 'student' ? topicLink(topic) : `/materi/${topic.id}`}
                    variant="secondary"
                    className="full"
                    arrow
                  >
                    {user.role === 'student' ? meta.label : 'Pratinjau materi'}
                  </ButtonLink>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!filtered.length && (
        <Empty
          title="Topiknya belum ditemukan"
          action={
            <button
              className="text-link"
              onClick={() => {
                setCategory('Semua materi');
                setFilter('all');
                setParams({});
              }}
            >
              Reset pencarian <ArrowRight size={15} />
            </button>
          }
        >
          Coba kata kunci lain atau tampilkan semua kategori.
        </Empty>
      )}
    </>
  );
}
