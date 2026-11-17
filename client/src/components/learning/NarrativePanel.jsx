import { lazy, Suspense, useState } from 'react';
const FormattedMessage = lazy(() => import('./FormattedMessage'));
import { Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import { plainMarkdown } from '../../lib/mathText';
import { Badge, Button, ErrorNotice } from '../ui/Kit';

export default function NarrativePanel({ assessmentId, classId, topicId }) {
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('pretest');
  async function generate() {
    setBusy(true);
    setError('');
    try {
      setReport(
        await api(
          classId ? `/classes/${classId}/narrative` : `/assessments/${assessmentId}/narrative`,
          { method: 'POST', ...(classId ? { body: { topicId, mode } } : {}) },
        ),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="diagnosis-narrative">
      <div className="row-between">
        <h3>{classId ? 'Ringkasan kebutuhan kelas' : 'Maknai hasil belajarmu'}</h3>
        {report && (
          <Badge tone="blue">
            {report.fallback ? 'Ringkasan terstruktur' : 'Penjelasan Gemini'}
          </Badge>
        )}
      </div>
      <p className="muted">
        Penjelasan mengikuti fakta diagnosis, tanpa mengubah nilai atau penguasaan konsep.
      </p>
      <ErrorNotice>{error}</ErrorNotice>
      {classId && (
        <label>
          Fase ringkasan
          <select
            value={mode}
            disabled={busy}
            onChange={(event) => {
              setMode(event.target.value);
              setReport(null);
              setError('');
            }}
          >
            <option value="pretest">Pretest</option>
            <option value="posttest">Posttest</option>
          </select>
        </label>
      )}
      {!report && (
        <Button variant="secondary" busy={busy} onClick={generate}>
          <Sparkles size={16} />
          {classId ? 'Buat ringkasan kelas' : 'Buat ringkasan hasil'}
        </Button>
      )}
      {report && (
        <>
          <div className="narrative-copy"><Suspense fallback={plainMarkdown(report.text)}><FormattedMessage text={report.text} /></Suspense></div>
          {report.fallback && (
            <p className="field-help">
              Gemini belum tersedia. Ringkasan ini disusun langsung dari hasil diagnosis.
            </p>
          )}
        </>
      )}
    </section>
  );
}
