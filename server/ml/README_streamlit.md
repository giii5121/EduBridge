# Aplikasi Streamlit — CDA-CDM Learning Gap

Antarmuka demonstrasi dan pengujian model untuk peneliti dan guru, tanpa menulis kode Python. Aplikasi **hanya memuat
checkpoint hasil training** (`artifacts/model/`) dengan `st.cache_resource`; aplikasi tidak pernah melatih ulang model. Jika
checkpoint belum ada, aplikasi menampilkan pesan bahwa training perlu diselesaikan dulu dan tidak membuat prediksi.

## 1. Instalasi

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate      Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
```

Sudah diuji pada dua lingkungan: Python 3.12 + NumPy 2.5 / pandas 3.1 / Streamlit 1.66, dan NumPy 1.26 / pandas 2.2 /
Streamlit 1.38 (+ pyarrow 16, karena pyarrow ≥ 18 membutuhkan NumPy 2).

## 2. Checkpoint & konfigurasi path

| Yang dicari aplikasi | Default | Ubah dengan |
|---|---|---|
| folder artefak (checkpoint, evaluasi, form, demo) | `<proyek>/artifacts` | env `CDACDM_ARTIFACT_DIR` |
| intervention map yang dapat diedit | path di `configs/experiment.json` → `paths.intervention_map` | edit `configs/intervention_map.csv` |
| gambar soal EEDI (opsional, mode adaptif) | tidak ditampilkan | env `CDACDM_IMAGE_ROOT=.../data/images` |

Checkpoint minimum (`artifacts/model/`): `pdina_params.npz`, `pdina_config.json`, `diagnosis_policy.json`,
`item_parameters.csv`, `concept_metadata.csv`, `target_concept_map.csv`. File lain (form assessment, metrik test, data demo)
dipakai bila tersedia. Saat dimuat, aplikasi memeriksa bahwa QuestionId, urutan konsep, dan konsep target pada checkpoint
saling konsisten.

> Lisensi EEDI: gambar soal hanya untuk riset/model training. Aplikasi tidak menyalin gambar; gambar hanya ditampilkan bila
> Anda sendiri mengatur `CDACDM_IMAGE_ROOT` ke folder lokal.

## 3. Menjalankan

```bash
python -m cdacdm.pipeline          # sekali saja, menghasilkan artifacts/ (±9 menit pada CPU laptop)
streamlit run app.py
```

### Google Colab

```python
from google.colab import drive; drive.mount('/content/drive')
%cd /content/drive/MyDrive/ILCDA/cda_cdm_project
!pip -q install -r requirements.txt
# jalankan notebook cda_cdm_model_training.ipynb dulu (menghasilkan artifacts/)
!npm install -g localtunnel
!streamlit run app.py --server.port 8501 &>/content/streamlit.log &
!npx localtunnel --port 8501      # buka URL yang muncul; password = IP publik runtime: !curl ipv4.icanhazip.com
```

## 4. Halaman

| Halaman | Isi |
|---|---|
| **Dashboard** | status model, metrik test *yang dihitung saat training* (dibaca dari `evaluation/test_metrics.csv`), jumlah konsep target yang dapat didiagnosis, proksi kualitas diagnosis, ringkasan learning gap data terpilih |
| **Student Assessment** | (a) siswa demo EEDI test split, (b) unggah CSV, (c) isi form fixed / parallel A / parallel B, (d) assessment **adaptif interaktif** (benar / salah / lewati). Menampilkan bar chart P(mastery), label, ranking gap, konsep yang belum dapat didiagnosis, unduhan CSV/JSON |
| **Learning Gap Analysis** | heatmap penguasaan siswa × konsep (abu-abu = bukti belum cukup), agregasi per konsep, ranking gap seluruh siswa |
| **Intervention Recommendations** | rekomendasi per siswa dengan jejak aturan R1–R5; entri PLACEHOLDER diberi badge "perlu validasi guru" |
| **Pre-test vs Post-test** | unggah data nyata, atau demo **SIMULASI** berlabel jelas; perubahan skor & mastery per konsep, CI, effect size, uji berpasangan, rekomendasi remedial dari post-test |
| **Model & Data** | persamaan model, kebijakan diagnosis, parameter soal, kecukupan soal, cakupan kurikulum |

Kebijakan diagnosis (τ, δ, n_min) default berasal dari validation set; slider di sidebar hanya untuk analisis sensitivitas dan
memunculkan peringatan bila diubah.

## 5. Format CSV input

**Format panjang (disarankan)** — satu baris per siswa × soal:

```csv
student_id,QuestionId,response
S001,859,1
S001,279,0
S001,124,
```

* `response`: `1`/`0` (juga `benar`/`salah`, `true`/`false`); **kosong = tidak dijawab** (tidak dihitung salah).
* Alternatif: kolom `answer_option` (1–4) yang dinilai otomatis terhadap kunci `correct_answer` di item bank.
* Opsional: `form_id`, `group` (`treatment`/`control`, untuk pre/post).

**Format lebar** — satu baris per siswa, kolom = QuestionId (boleh berawalan `q`):

```csv
student_id,859,279,q124
S001,1,0,
```

Validasi: kolom ID siswa wajib; QuestionId yang tidak ada di model → error berisi daftar ID; nilai selain 1/0/kosong → error;
duplikat (siswa, soal) dengan jawaban berbeda → error; duplikat identik → dihapus dengan peringatan. Template CSV untuk fixed form
dapat diunduh dari halaman Student Assessment (`artifacts/assessment/response_template_fixed_form.csv`).

Pre/post: dua file format panjang; siswa dicocokkan lewat `student_id`, siswa yang hanya ada di salah satu file dilaporkan.

## 6. Pengujian

```bash
pytest -q                 # 37 test: data/mapping, model, assessment, input, pre/post, pipeline, checkpoint, semua halaman app
```

`tests/test_app_pages.py` menjalankan setiap halaman lewat `streamlit.testing` (diagnosis demo, kelas, form kosong, sesi
adaptif, simulasi pre/post) pada checkpoint kecil yang dilatih dari data sintetis di dalam test.
