import { useState } from 'react';
import { ArrowRight, Lightbulb, PencilLine, ShieldCheck } from 'lucide-react';
import MathText from './MathText';

function Reflection({ practice, index }) {
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="self-practice">
      <span className="practice-number">COBA SENDIRI · {String(index + 1).padStart(2, '0')}</span>
      <h4>
        <MathText text={practice.question} />
      </h4>
      <label className="reflection-label">
        Tulis jawaban atau langkahmu
        <textarea
          aria-label={`Jawaban latihan mandiri ${practice.id}`}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          maxLength={1500}
          placeholder="Coba ingat konsepnya sebelum membuka pembahasan…"
          rows={2}
        />
      </label>
      {revealed ? (
        <div className="practice-reveal" role="status">
          <strong>
            <MathText text={practice.answer} whole />
          </strong>
          <p>
            <MathText text={practice.explanation} />
          </p>
          <span>Bandingkan langkahmu, lalu perbaiki bagian yang belum tepat.</span>
        </div>
      ) : (
        <button type="button" className="text-button" onClick={() => setRevealed(true)}>
          {answer.trim() ? 'Bandingkan dengan pembahasan' : 'Lihat pembahasan'}
          <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
}

export default function ConceptContent({ block }) {
  return (
    <div className="concept-content">
      <p className="concept-intro">
        <MathText text={block.body} />
      </p>
      {block.sections?.map((section) => (
        <section className="concept-section" key={section.title}>
          <h3>{section.title}</h3>
          <p>
            <MathText text={section.body} />
          </p>
        </section>
      ))}
      {block.worked ? (
        <section className="worked-example">
          <div className="lesson-subheading">
            <Lightbulb size={19} />
            <span>KITA COBA BERSAMA</span>
          </div>
          <h3>
            <MathText text={block.worked.prompt} />
          </h3>
          <ol>
            {block.worked.steps.map((step, index) => (
              <li key={index}>
                <span>{index + 1}</span>
                <p>
                  <MathText text={step} />
                </p>
              </li>
            ))}
          </ol>
          <div className="worked-conclusion">
            <ShieldCheck size={18} />
            <p>
              <MathText text={block.worked.conclusion} />
            </p>
          </div>
        </section>
      ) : (
        <div className="example">
          <span>COBA PAHAMI CONTOH INI</span>
          <p>
            <MathText text={block.example} />
          </p>
        </div>
      )}
      {block.misconception && (
        <section className="concept-caution">
          <span>HATI-HATI DI BAGIAN INI</span>
          <h3>
            <MathText text={block.misconception.mistake} />
          </h3>
          <p>
            <MathText text={block.misconception.correction} />
          </p>
        </section>
      )}
      {block.practice?.length > 0 && (
        <section className="independent-practice">
          <div className="lesson-subheading">
            <PencilLine size={19} />
            <span>SEKARANG GILIRANMU</span>
          </div>
          <p>Latihan mandiri untuk mengingat kembali. Tidak memengaruhi hasil diagnosis atau XP.</p>
          {block.practice.map((practice, index) => (
            <Reflection key={practice.id} practice={practice} index={index} />
          ))}
        </section>
      )}
    </div>
  );
}
