import { useCallback, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Save, BookCopy, Search, Sparkles, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { useApp } from '../../lib/AppContext';
import {
  Button,
  ButtonLink,
  Empty,
  ErrorNotice,
  Loading,
  Modal,
  PageHead,
  Symbol,
} from '../../components/ui/Kit';
import MaterialCards from '../../components/learning/MaterialCards';
import LessonEditor from './LessonEditor';
import MaterialBlockPreview from '../../components/learning/MaterialBlockPreview';
import { chooseMaterialIcon } from '../../../../shared/materialIcons.js';

const blankBlock = () => ({ title: '', body: '', example: '' });
const newMaterial = (source, scope, role) => ({
  title: source ? `${source.title} — penguatan kelas` : '',
  summary: source?.summary ?? '',
  minutes: source?.minutes ?? 15,
  published: false,
  reviewConfirmed: false,
  topicId: source?.id ?? scope?.topics[0]?.id ?? '',
  classId: role === 'admin' ? null : scope?.classes.length === 1 ? scope.classes[0].id : '',
  blocks: source ? structuredClone(source.blocks) : [blankBlock()],
});
export default function Materials() {
  const { user, data, notify } = useApp();
  const [params, setParams] = useSearchParams();
  const [catalog, setCatalog] = useState(null),
    [editing, setEditing] = useState(null),
    [deleting, setDeleting] = useState(null),
    [query, setQuery] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(null),
    [instructions, setInstructions] = useState(''),
    [blockCount, setBlockCount] = useState(3),
    [pendingGeneration, setPendingGeneration] = useState(null);
  const generationRequest = useRef(null);
  useEffect(() => () => generationRequest.current?.abort(), []);
  const load = useCallback(async (signal) => {
    const next = await api('/materials', { signal });
    setCatalog(next);
    return next;
  }, []);
  const makeDraft = (source) => newMaterial(source, catalog, user.role);
  useEffect(() => {
    const controller = new AbortController();
    api('/materials', { signal: controller.signal })
      .then((next) => {
        setCatalog(next);
        const topicId = params.get('topik');
        if (topicId) {
          const source = data.topics.find((t) => t.id === topicId);
          if (source) setEditing(newMaterial(source, next, user.role));
          setParams({}, { replace: true });
        }
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, [params, data.topics, user.role, setParams]);
  function update(key, value) {
    setEditing((old) => ({
      ...old,
      [key]: value,
      ...(key === 'published' ? {} : { reviewConfirmed: false, published: false }),
    }));
  }
  function blockUpdate(index, key, value) {
    setEditing((old) => ({
      ...old,
      reviewConfirmed: false,
      published: false,
      blocks: old.blocks.map((b, i) => (i === index ? { ...b, [key]: value } : b)),
    }));
  }
  async function edit(id) {
    setPendingGeneration(null);
    setError('');
    try {
      const material = (await api(`/materials/${id}`)).material;
      setEditing({ ...material, reviewConfirmed: Boolean(material.review) });
    } catch (e) {
      setError(e.message);
    }
  }
  async function save(event) {
    event.preventDefault();
    if (busy || generating !== null) return;
    setBusy(true);
    setError('');
    try {
      await api(editing.id ? `/materials/${editing.id}` : '/materials', {
        method: editing.id ? 'PATCH' : 'POST',
        body: editing,
      });
      setEditing(null);
      notify('Materi berhasil disimpan.');
      await load().catch(() =>
        setError(
          'Materi sudah tersimpan, tetapi daftar belum diperbarui. Muat ulang daftar untuk melihatnya.',
        ),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function cancelGeneration() {
    generationRequest.current?.abort();
    generationRequest.current = null;
    setGenerating(null);
  }
  function prepareGeneration(target) {
    setError('');
    if (user.role === 'teacher' && !editing.classId) {
      setError('Pilih kelas tujuan sebelum membuat draf AI.');
      return;
    }
    const occupied =
      target === 'all'
        ? editing.blocks.some((b) => b.title || b.body || b.example)
        : Object.values(editing.blocks[target]).some(Boolean);
    if (occupied) setPendingGeneration(target);
    else generate(target);
  }
  async function generate(target) {
    if (generationRequest.current || busy) return;
    const controller = new AbortController();
    generationRequest.current = controller;
    setGenerating(target);
    setPendingGeneration(null);
    setError('');
    try {
      const result = await api('/materials/generate', {
        method: 'POST',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(95000)]),
        body: {
          topicId: editing.topicId,
          classId: editing.classId,
          title: editing.title,
          sectionTitle: target === 'all' ? '' : editing.blocks[target].title,
          instructions,
          blockCount: target === 'all' ? blockCount : 1,
        },
      });
      if (controller.signal.aborted) return;
      setEditing((old) =>
        target === 'all'
          ? { ...old, ...result.draft, published: false, reviewConfirmed: false, aiGenerated: true }
          : {
              ...old,
              blocks: old.blocks.map((b, i) => (i === target ? result.draft.blocks[0] : b)),
              published: false,
              reviewConfirmed: false,
              aiGenerated: true,
            },
      );
      notify('Draf AI sudah diisi. Periksa dan validasi seluruh isi sebelum diterbitkan.');
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally {
      if (generationRequest.current === controller) {
        generationRequest.current = null;
        setGenerating(null);
      }
    }
  }
  const replaceConfirmation = (target) =>
    pendingGeneration === target && (
      <div className="material-ai-confirm">
        <p>
          Isi {target === 'all' ? 'seluruh materi' : `bagian ${target + 1}`} akan diganti dengan
          draf baru dari AI.
        </p>
        <div className="button-row">
          <Button type="button" variant="secondary" onClick={() => setPendingGeneration(null)}>
            Pertahankan isi
          </Button>
          <Button type="button" onClick={() => generate(target)}>
            Generate dan ganti isi
          </Button>
        </div>
      </div>
    );
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/materials/${deleting.id}`, {
        method: 'DELETE',
        body: { version: deleting.version },
      });
      setDeleting(null);
      notify('Materi berhasil dihapus dari katalog.');
      await load().catch(() =>
        setError(
          'Materi sudah dihapus, tetapi daftar belum diperbarui. Muat ulang daftar untuk melihatnya.',
        ),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const items =
    catalog?.materials.filter((m) =>
      `${m.title} ${m.summary} ${m.topicTitle} ${m.className}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) ?? [];
  return (
    <>
      <PageHead
        eyebrow="RUANG KREASI PEMBELAJARAN"
        title="Materi yang menguatkan."
        action={
          <Button
            onClick={() => {
              setError('');
              setPendingGeneration(null);
              setEditing(makeDraft());
            }}
            disabled={!catalog || (user.role === 'teacher' && !catalog.classes.length)}
          >
            <Plus size={17} />
            Tambah materi
          </Button>
        }
      >
        Susun penjelasan, contoh, dan latihan untuk kelasmu. Ikon dipilih otomatis mengikuti judul
        dan topik.
      </PageHead>
      {!editing && !deleting && <ErrorNotice>{error}</ErrorNotice>}
      {!editing && !deleting && error && catalog && (
        <Button
          variant="secondary"
          onClick={() => {
            setError('');
            load().catch((e) => setError(e.message));
          }}
        >
          Muat ulang daftar
        </Button>
      )}
      <div className="material-intro">
        <div>
          <BookCopy size={24} />
          <div>
            <strong>Ruang untuk cara mengajarmu.</strong>
            <p>
              Materi penguatan terhubung ke topik asesmen. Materi kelas terlihat oleh siswa kelas
              tersebut; materi umum dikelola admin.
            </p>
          </div>
        </div>
        <ButtonLink to="/katalog" variant="secondary">
          Lihat katalog
        </ButtonLink>
      </div>
      {!catalog ? (
        error ? (
          <Button
            variant="secondary"
            onClick={() => {
              setError('');
              load().catch((e) => setError(e.message));
            }}
          >
            Coba muat kembali
          </Button>
        ) : (
          <Loading />
        )
      ) : (
        <>
          {user.role === 'teacher' && !catalog.classes.length && (
            <Empty
              title="Mulai dari kelasmu"
              action={<ButtonLink to="/guru">Buat kelas</ButtonLink>}
            >
              Buat kelas terlebih dahulu untuk menambahkan materi.
            </Empty>
          )}
          <div className="material-toolbar">
            <span>{items.length} materi penguatan</span>
            <label className="search-field">
              <Search size={17} />
              <input
                aria-label="Cari materi kelolaan"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari judul, topik, atau kelas…"
              />
            </label>
          </div>
          {items.length ? (
            <MaterialCards
              materials={items}
              actions={(m) => (
                <>
                  <Button
                    variant="secondary"
                    aria-label={`Edit ${m.title}`}
                    onClick={() => edit(m.id)}
                  >
                    <Pencil size={15} />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Hapus ${m.title}`}
                    onClick={() => {
                      setError('');
                      setDeleting(m);
                    }}
                  >
                    <Trash2 size={15} />
                    Hapus
                  </Button>
                </>
              )}
            />
          ) : (
            <Empty title={query ? 'Materi tidak ditemukan' : 'Ide penguatanmu dimulai di sini'}>
              {query
                ? 'Coba kata kunci lain.'
                : 'Tambahkan materi baru atau salin materi topik dari katalog untuk menyesuaikannya dengan kebutuhan kelas.'}
            </Empty>
          )}
        </>
      )}
      {editing && (
        <Modal
          wide
          title={editing.id ? 'Edit materi penguatan' : 'Tambah materi penguatan'}
          onClose={() => {
            if (!busy && generating === null) {
              setEditing(null);
              setError('');
            }
          }}
        >
          <form className="modal-body form-stack material-editor" onSubmit={save}>
            <ErrorNotice>{error}</ErrorNotice>
            {generating !== null && (
              <div className="material-ai-progress" role="status">
                <Sparkles size={20} />
                <span>
                  AI sedang menyusun {generating === 'all' ? 'materi' : `bagian ${generating + 1}`}…
                  Isi editor tetap aman sampai draf selesai.
                </span>
                <Button type="button" variant="secondary" onClick={cancelGeneration}>
                  Batalkan pengisian
                </Button>
              </div>
            )}
            <fieldset className="material-edit-fields" disabled={busy || generating !== null}>
              <div className="material-editor-preview">
                <Symbol
                  topic={{
                    id: editing.topicId,
                    ...chooseMaterialIcon(editing.title, editing.topicId),
                  }}
                />
                <div>
                  <strong>Ikon otomatis</strong>
                  <p>Dipilih dari gaya ilustrasi EduBridge saat materi disimpan.</p>
                </div>
              </div>
              <section className="material-ai-panel" aria-label="Generator materi AI">
                <div className="material-ai-title">
                  <Sparkles size={20} />
                  <div>
                    <strong>Mulai dari draf. Sempurnakan dengan caramu.</strong>
                    <p>
                      AI mengisi penjelasan, contoh berlangkah, miskonsepsi, dan latihan. Kamu tetap
                      memeriksa dan memutuskan isi yang layak diterbitkan.
                    </p>
                  </div>
                </div>
                <label>
                  Arahan untuk AI
                  <textarea
                    maxLength={1000}
                    rows={2}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Misalnya: jelaskan perlahan, gunakan konteks sehari-hari, fokus pada miskonsepsi komposisi fungsi."
                  />
                </label>
                <div className="material-ai-controls">
                  <label>
                    Jumlah bagian AI
                    <select
                      aria-label="Jumlah bagian AI"
                      value={blockCount}
                      onChange={(e) => setBlockCount(Number(e.target.value))}
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} bagian
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => prepareGeneration('all')}
                  >
                    <Sparkles size={16} />
                    Isi semua bagian dengan AI
                  </Button>
                </div>
                {replaceConfirmation('all')}
              </section>
              <div className="material-form-grid">
                <label>
                  Judul materi
                  <input
                    required
                    minLength={3}
                    maxLength={100}
                    value={editing.title}
                    onChange={(e) => update('title', e.target.value)}
                  />
                </label>
                <label>
                  Durasi belajar (menit)
                  <input
                    required
                    type="number"
                    min={1}
                    max={180}
                    value={editing.minutes}
                    onChange={(e) => update('minutes', Number(e.target.value))}
                  />
                </label>
              </div>
              <label>
                Deskripsi materi
                <textarea
                  required
                  minLength={10}
                  maxLength={500}
                  value={editing.summary}
                  onChange={(e) => update('summary', e.target.value)}
                />
              </label>
              <div className="material-form-grid">
                <label>
                  Topik penguatan
                  <select
                    required
                    aria-label="Topik penguatan"
                    value={editing.topicId}
                    onChange={(e) => update('topicId', e.target.value)}
                  >
                    {catalog.topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Akses materi
                  <select
                    required
                    aria-label="Akses materi"
                    value={editing.classId ?? 'global'}
                    onChange={(e) =>
                      update('classId', e.target.value === 'global' ? null : e.target.value)
                    }
                  >
                    {user.role === 'teacher' && (
                      <option value="" disabled>
                        Pilih kelas tujuan
                      </option>
                    )}
                    {user.role === 'admin' && <option value="global">Semua kelas</option>}
                    {catalog.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {!editing.id && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const source = data.topics.find((t) => t.id === editing.topicId);
                    if (source) update('blocks', structuredClone(source.blocks));
                  }}
                >
                  <BookCopy size={16} />
                  Salin isi materi topik
                </Button>
              )}
              <p className="field-help">
                Gunakan $...$ untuk rumus dalam kalimat dan $$...$$ untuk rumus tersendiri. Rumus
                akan ditampilkan rapi saat materi dibaca.
              </p>
              {editing.blocks.map((block, index) => (
                <fieldset key={index} className="material-block-editor">
                  <legend>Bagian {index + 1}</legend>
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={`Generate bagian ${index + 1}`}
                    onClick={() => prepareGeneration(index)}
                  >
                    <Sparkles size={16} />
                    Isi bagian ini dengan AI
                  </Button>
                  {replaceConfirmation(index)}
                  <MaterialBlockPreview block={block} />
                  <label>
                    Judul bagian {index + 1}
                    <input
                      required
                      minLength={3}
                      maxLength={100}
                      value={block.title}
                      onChange={(e) => blockUpdate(index, 'title', e.target.value)}
                    />
                  </label>
                  <label>
                    Penjelasan bagian {index + 1}
                    <textarea
                      required
                      rows={5}
                      minLength={10}
                      maxLength={3000}
                      value={block.body}
                      onChange={(e) => blockUpdate(index, 'body', e.target.value)}
                    />
                  </label>
                  <label>
                    Contoh bagian {index + 1}
                    <textarea
                      required
                      minLength={5}
                      maxLength={1000}
                      value={block.example}
                      onChange={(e) => blockUpdate(index, 'example', e.target.value)}
                    />
                  </label>
                  <LessonEditor
                    expandable
                    block={block}
                    onChange={(key, value) => blockUpdate(index, key, value)}
                  />
                  {editing.blocks.length > 1 && (
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() =>
                        update(
                          'blocks',
                          editing.blocks.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Trash2 size={15} />
                      Hapus bagian {index + 1}
                    </Button>
                  )}
                </fieldset>
              ))}
              {editing.blocks.length < 12 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => update('blocks', [...editing.blocks, blankBlock()])}
                >
                  <Plus size={16} />
                  Tambah bagian
                </Button>
              )}
              <section className="material-review-panel">
                <div className="material-ai-title">
                  <ShieldCheck size={21} />
                  <div>
                    <strong>Validasi sebelum terbit</strong>
                    <p>
                      {editing.aiGenerated ? 'Draf ini memuat konten yang dibantu AI. ' : ''}Periksa
                      kesesuaian kelas XI, rumus, langkah contoh, dan kunci latihan. Perubahan isi
                      membatalkan konfirmasi sebelumnya.
                    </p>
                  </div>
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={Boolean(editing.reviewConfirmed)}
                    onChange={(e) =>
                      setEditing((old) => ({
                        ...old,
                        reviewConfirmed: e.target.checked,
                        published: e.target.checked ? old.published : false,
                      }))
                    }
                  />
                  Saya sudah meninjau dan memvalidasi kebenaran seluruh materi.
                </label>
                {editing.review && (
                  <p className="field-help">
                    Terakhir ditinjau oleh {editing.review.reviewerName}.
                  </p>
                )}
              </section>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editing.published}
                  disabled={!editing.reviewConfirmed}
                  onChange={(e) => update('published', e.target.checked)}
                />
                Terbitkan materi agar terlihat oleh siswa
              </label>
              <p className="field-help">
                Materi draf hanya terlihat oleh pengelola. Pengeditan materi ini tidak mengubah
                soal, hasil asesmen, atau parameter PDINA.
              </p>
              <div className="modal-actions">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  Batal
                </Button>
                <Button type="submit" busy={busy}>
                  <Save size={16} />
                  Simpan materi
                </Button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Hapus materi?"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <div className="modal-body">
            <ErrorNotice>{error}</ErrorNotice>
            <p>
              “{deleting.title}” akan dihapus dari katalog. Hasil asesmen dan progres belajar tetap
              tersimpan.
            </p>
            <div className="modal-actions">
              <Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>
                Batal
              </Button>
              <Button busy={busy} onClick={remove}>
                <Trash2 size={16} />
                Hapus materi
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
