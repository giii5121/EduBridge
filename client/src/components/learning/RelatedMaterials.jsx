import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Button, ErrorNotice, SectionHead } from '../ui/Kit';
import MaterialCards from './MaterialCards';

export default function RelatedMaterials({ topic }) {
  const [materials, setMaterials] = useState([]),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api('/materials', { signal: controller.signal })
      .then((r) => setMaterials(r.materials.filter((m) => m.published && m.topicId === topic.id)))
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, [topic.id, retry]);
  if (error)
    return (
      <>
        <ErrorNotice>{error}</ErrorNotice>
        <Button
          variant="secondary"
          onClick={() => {
            setError('');
            setRetry((n) => n + 1);
          }}
        >
          Muat materi tambahan
        </Button>
      </>
    );
  if (!materials.length) return null;
  return (
    <section className="material-catalog-section">
      <SectionHead eyebrow="LANJUTKAN RASA INGIN TAHUMU" title="Penguatan dari gurumu.">
        Penjelasan tambahan untuk topik {topic.title}.
      </SectionHead>
      <MaterialCards materials={materials} />
    </section>
  );
}
