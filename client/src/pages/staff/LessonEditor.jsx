export default function LessonEditor({ block, onChange }) {
  return (
    <div className="extended-lesson-editor form-stack">
      {block.sections?.length > 0 && (
        <>
          <h4>Penjelasan bertahap</h4>
          {block.sections.map((section, i) => (
            <div className="form-stack editor-subsection" key={i}>
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
    </div>
  );
}
