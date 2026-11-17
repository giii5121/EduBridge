import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Clock3, BookOpen } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, ButtonLink, ErrorNotice, Loading, Symbol } from '../../components/ui/Kit';
import ConceptContent from '../../components/learning/ConceptContent';
import '../../components/learning/Materials.css';
export default function MaterialReader() {
  const { materialId } = useParams();
  return <Reader key={materialId} materialId={materialId} />;
}
function Reader({ materialId }) {
  const [material, setMaterial] = useState(null),
    [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api(`/materials/${materialId}`, { signal: controller.signal })
      .then((r) => setMaterial(r.material))
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, [materialId]);
  if (error)
    return (
      <>
        <ErrorNotice>{error}</ErrorNotice>
        <ButtonLink to="/katalog">Kembali ke katalog</ButtonLink>
      </>
    );
  if (!material) return <Loading />;
  return (
    <>
      <ButtonLink to="/katalog" variant="ghost">
        <ArrowLeft size={16} />
        Kembali ke katalog
      </ButtonLink>
      <header className="material-reader-head">
        <Symbol topic={material} />
        <div>
          <div className="button-row">
            <Badge tone="teal">PENGUATAN KONSEP</Badge>
            {!material.published && <Badge tone="neutral">Draf · pratinjau pengelola</Badge>}
          </div>
          <h1>{material.title}</h1>
          <p>{material.summary}</p>
          <div className="material-meta">
            <span>
              <Clock3 size={15} />
              {material.minutes} menit
            </span>
            <span>{material.className}</span>
            {material.review && <span>Ditinjau {material.review.reviewerName}</span>}
          </div>
        </div>
      </header>
      <div className="material-reader-layout">
        <div>
          {material.blocks.map((block, index) => (
            <section className="card material-reader-block" key={index}>
              <span className="eyebrow">BAGIAN {String(index + 1).padStart(2, '0')}</span>
              <h2>{block.title}</h2>
              <ConceptContent block={block} />
            </section>
          ))}
        </div>
        <aside className="card material-reader-aside">
          <BookOpen size={26} />
          <h3>Hubungkan dengan perjalananmu.</h3>
          <p>
            Materi ini menguatkan konsep pada topik {material.topicTitle}. Ikuti asesmen dan fase
            pembelajaran bersama gurumu untuk melihat perkembangan pemahaman.
          </p>
          <ButtonLink to={`/materi/${material.topicId}`} arrow>
            Buka topik terkait
          </ButtonLink>
          {material.canManage && (
            <ButtonLink to="/kelola-materi" variant="secondary">
              Kelola materi
            </ButtonLink>
          )}
        </aside>
      </div>
    </>
  );
}
