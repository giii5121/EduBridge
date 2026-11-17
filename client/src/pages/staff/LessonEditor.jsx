import { Button } from '../../components/ui/Kit';
export default function LessonEditor({ block, onChange, expandable = false }) {
  return (
    <div className="extended-lesson-editor form-stack">
      {block.sections?.length > 0 && (
        <>
          <h4>Penjelasan bertahap</h4>
          {block.sections.map((section, i) => (
            <div className="form-stack editor-subsection" key={i}>
              {expandable && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    onChange(
                      'sections',
                      block.sections.filter((_, j) => j !== i),
                    )
                  }
                >
                  Hapus subbagian {i + 1}
                </Button>
              )}
              <label>
                Judul subbagian {i + 1}
                <input
                  required
                  minLength={3}
                  maxLength={100}
                  value={section.title}
                  onChange={(e) =>
                    onChange(
                      'sections',
                      block.sections.map((s, j) => (j === i ? { ...s, title: e.target.value } : s)),
                    )
                  }
                />
              </label>
              <label>
                Isi subbagian {i + 1}
                <textarea
                  required
                  minLength={5}
                  maxLength={3000}
                  value={section.body}
                  onChange={(e) =>
                    onChange(
                      'sections',
                      block.sections.map((s, j) => (j === i ? { ...s, body: e.target.value } : s)),
                    )
                  }
                />
              </label>
            </div>
          ))}
        </>
      )}
      {block.worked && (
        <>
          <h4>Contoh berlangkah</h4>
          {expandable && (
            <Button type="button" variant="ghost" onClick={() => onChange('worked', undefined)}>
              Hapus contoh berlangkah
            </Button>
          )}
          <label>
            Soal contoh
            <textarea
              required
              minLength={5}
              maxLength={1000}
              value={block.worked.prompt}
              onChange={(e) => onChange('worked', { ...block.worked, prompt: e.target.value })}
            />
          </label>
          {block.worked.steps.map((step, i) => (
            <label key={i}>
              Langkah {i + 1}
              <textarea
                required
                minLength={5}
                maxLength={1000}
                value={step}
                onChange={(e) =>
                  onChange('worked', {
                    ...block.worked,
                    steps: block.worked.steps.map((s, j) => (j === i ? e.target.value : s)),
                  })
                }
              />
            </label>
          ))}
          <label>
            Kesimpulan contoh
            <textarea
              required
              minLength={5}
              maxLength={1500}
              value={block.worked.conclusion}
              onChange={(e) => onChange('worked', { ...block.worked, conclusion: e.target.value })}
            />
          </label>
        </>
      )}
      {block.misconception && (
        <>
          <h4>Miskonsepsi umum</h4>
          {expandable && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange('misconception', undefined)}
            >
              Hapus miskonsepsi
            </Button>
          )}
          <label>
            Kekeliruan yang perlu dihindari
            <textarea
              required
              minLength={5}
              maxLength={1500}
              value={block.misconception.mistake}
              onChange={(e) =>
                onChange('misconception', { ...block.misconception, mistake: e.target.value })
              }
            />
          </label>
          <label>
            Penjelasan koreksi
            <textarea
              required
              minLength={5}
              maxLength={1500}
              value={block.misconception.correction}
              onChange={(e) =>
                onChange('misconception', { ...block.misconception, correction: e.target.value })
              }
            />
          </label>
        </>
      )}
      {block.practice?.map((practice, i) => {
        const update = (key, value) =>
          onChange(
            'practice',
            block.practice.map((p, j) => (j === i ? { ...p, [key]: value } : p)),
          );
        return (
          <div key={practice.id} className="form-stack editor-subsection">
            <h4>Latihan mandiri {i + 1}</h4>
            {expandable && (
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  onChange(
                    'practice',
                    block.practice.filter((_, j) => j !== i),
                  )
                }
              >
                Hapus latihan {i + 1}
              </Button>
            )}
            <label>
              Pertanyaan latihan
              <textarea
                required
                minLength={5}
                maxLength={1500}
                value={practice.question}
                onChange={(e) => update('question', e.target.value)}
              />
            </label>
            <label>
              Jawaban latihan
              <input
                required
                maxLength={1000}
                value={practice.answer}
                onChange={(e) => update('answer', e.target.value)}
              />
            </label>
            <label>
              Pembahasan latihan
              <textarea
                required
                minLength={5}
                maxLength={2000}
                value={practice.explanation}
                onChange={(e) => update('explanation', e.target.value)}
              />
            </label>
          </div>
        );
      })}
      {expandable && (
        <div className="material-rich-options">
          <span className="field-help">Lengkapi materi (opsional)</span>
          <div className="button-row">
            {(block.sections?.length ?? 0) < 8 && (
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  onChange('sections', [...(block.sections ?? []), { title: '', body: '' }])
                }
              >
                + Penjelasan bertahap
              </Button>
            )}
            {!block.worked && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => onChange('worked', { prompt: '', steps: ['', ''], conclusion: '' })}
              >
                + Contoh berlangkah
              </Button>
            )}
            {!block.misconception && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => onChange('misconception', { mistake: '', correction: '' })}
              >
                + Miskonsepsi
              </Button>
            )}
            {(block.practice?.length ?? 0) < 5 && (
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  onChange('practice', [
                    ...(block.practice ?? []),
                    { id: crypto.randomUUID(), question: '', answer: '', explanation: '' },
                  ])
                }
              >
                + Latihan mandiri
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
