# CDA-CDM: deteksi & intervensi learning gap (pengembangan dengan EEDI NeurIPS 2020 Task 3/4)

Implementasi end-to-end yang dapat dijalankan ulang: audit artefak data preparation → Q-matrix & pemetaan konsep target →
**probabilistic DINA (variational EM)** + baseline yang terikat Q-matrix → pemilihan hyperparameter & kebijakan diagnosis di
validation → evaluasi **satu kali** di test → CDA (form tetap, parallel forms, adaptif) → profil mastery, learning gap,
rekomendasi intervensi → analisis pre-test/post-test → aplikasi Streamlit (`README_streamlit.md`) → **laporan naratif
opsional** berbahasa Indonesia untuk guru dan siswa, ditulis oleh LLM **Gemini 3.1 Flash-Lite** lewat Gemini API resmi
(API key Google AI Studio di env `GEMINI_API_KEY`).

> **Peran LLM.** LLM hanya **mengomunikasikan** hasil diagnosis P-DINA dalam bahasa sehari-hari. LLM tidak menghitung,
> mengubah, atau memprediksi mastery, learning gap, rekomendasi, maupun metrik apa pun. Setiap teks LLM diperiksa validator
> (angka harus berasal dari hasil diagnosis); bila gagal, aplikasi menampilkan laporan template deterministik. Aplikasi tetap
> berjalan penuh tanpa API key. Lihat bagian [Lapisan naratif (LLM)](#lapisan-naratif-llm-via-gemini-api-opsional) dan
> `README_llm.md`.

> **Status data.** EEDI Task 3/4 dipakai sebagai **dataset pengembangan dan evaluasi awal**, bukan data pre/post kelas penelitian.
> Populasinya mayoritas siswa sekolah menengah pertama di UK (hanya ±5–6 siswa berusia 16–17 tahun menurut proxy metadata), dan
> tidak ada konsep kalkulus. Tidak ada klaim bahwa model sudah tervalidasi pada kelas SMA penelitian.

## Struktur direktori

```
finalIL/
├── eedi_task34_cda_cdm_pipeline.ipynb   # notebook data preparation yang diaudit (asli, tidak diubah)
├── cda_cdm_model_training.ipynb         # notebook training & evaluasi (dijalankan, berisi output)
├── app.py                               # aplikasi Streamlit
├── requirements.txt
├── README.md / README_pdina.md / README_streamlit.md / README_llm.md
├── configs/
│   ├── experiment.json                  # path, grid hyperparameter, aturan evaluasi/diagnosis/assessment
│   ├── llm.json                         # lapisan naratif opsional: model Gemini, thinking level, batas, cache, log
│   ├── narrative_examples.jsonl         # contoh few-shot laporan guru & siswa
│   ├── target_concept_map.csv           # 57 konsep EEDI → cakupan target (draft, perlu review peneliti)
│   ├── target_curriculum.csv            # topik aljabar & kalkulus SMA (draft) + konsep EEDI yang memetakan
│   ├── focus_item_content_audit.csv     # audit visual sampel 22 soal fokus
│   └── intervention_map.csv             # materi/aktivitas per konsep (PLACEHOLDER sampai divalidasi guru/dosen)
├── cdacdm/                              # paket Python
│   ├── config.py        path & deteksi otomatis artefak
│   ├── data.py          pemuatan, validasi skema, mask missing, alignment npz↔csv, audit leakage
│   ├── reconstruct.py   rekonstruksi artefak lokal dari arsip resmi (bila Drive tidak tersedia)
│   ├── qmatrix.py       analisis Q-matrix, peta konsep target, audit soal fokus, laporan cakupan
│   ├── models.py        PDINA (VEM) + ItemMean / ConceptScore / QLogistic baseline
│   ├── evaluation.py    metrik, kalibrasi, bootstrap, konsistensi split-half, simulasi recovery, pemilihan τ
│   ├── diagnosis.py     profil, label mastery, learning gap, agregasi kelas
│   ├── assessment.py    kelayakan soal, fixed form, parallel forms, sesi adaptif (mutual information), replay
│   ├── intervention.py  rekomendasi berbasis aturan R1–R5, placeholder berlabel
│   ├── prepost.py       perbandingan pre/post (uji berpasangan, effect size, CI, McNemar, Holm)
│   ├── responses.py     parsing & validasi CSV respons (panjang/lebar/answer_option)
│   ├── synthetic.py     data pre/post SINTETIS untuk demo
│   ├── service.py       pemuatan checkpoint & inferensi tanpa retraining (+ generate_narrative)
│   ├── narrative.py     lapisan naratif opsional: fakta, prompt, validator, template, klien Gemini API
│   ├── api.py           train_model, predict_mastery, select_assessment, detect_learning_gaps,
│   │                    recommend_intervention, compare_pre_post
│   ├── pipeline.py      orkestrasi (CLI: python -m cdacdm.pipeline)
│   └── plots.py
├── scripts/
│   ├── build_notebook.py                # membangun ulang notebook training
│   └── eval_narrative.py                # membandingkan model Gemini pada tugas naratif (request berbayar)
├── tests/                               # pytest (+1 uji opsional ke Gemini API sungguhan)
├── artifacts_calculus/                  # checkpoint kalkulus kelas XI (DUMMY sintetis) untuk demo aplikasi
├── artifacts/                           # HASIL (dibuat pipeline)
│   ├── audit/        data_audit.json, leakage_audit.json, q_matrix_analysis.json, concept_item_counts.csv,
│   │                 multi_concept_items.csv, q_matrix_target.csv, focus_item_audit.csv, coverage_report.csv,
│   │                 unmapped_target_topics.csv
│   ├── model/        CHECKPOINT: pdina_params.npz, pdina_config.json, diagnosis_policy.json, item_parameters.csv,
│   │                 concept_metadata.csv, q_matrix.csv, target_concept_map.csv, intervention_map_resolved.csv,
│   │                 item_bank.csv, experiment_config_used.json, model_card.json
│   ├── evaluation/   hp_search_validation.csv, threshold_selection_validation.csv, consistency_*.csv, test_metrics.csv,
│   │                 test_model_differences.csv, calibration_test.csv, per_concept_test_main.csv,
│   │                 simulation_mastery_recovery.csv, adaptive_replay_*.csv, figures/*.png
│   ├── diagnosis/    test_mastery_profiles.csv, test_learning_gaps.csv, test_class_gap_summary.csv, test_student_summary.csv
│   ├── assessment/   fixed_form.csv, parallel_form_A.csv, parallel_form_B.csv, parallel_forms_balance.csv,
│   │                 concept_item_adequacy.csv, response_template_fixed_form.csv
│   ├── intervention/ test_intervention_recommendations.csv
│   ├── prepost/      SYNTHETIC_*.csv, SYNTHETIC_prepost_report.json   (SIMULASI)
│   ├── demo/         test_split_responses.csv (respons nyata siswa test, untuk demo app)
│   ├── reports/      (dibuat saat laporan naratif pertama) cache/ + narrative_log.jsonl
│   └── run_summary.json
└── ILCDA/                               # data lokal (arsip resmi + rekonstruksi); di Colab: MyDrive/ILCDA
```

## Menjalankan

### Ringkas (sudah pernah setup)

```powershell
cd D:\finalIL
.venv\Scripts\activate
streamlit run app.py                  # http://localhost:8501
```

### Setup lengkap di Windows (dari nol)

Diuji pada Windows 11, Python 3.12.10, laptop HP Victus (i5-12450H, RAM 8 GB, RTX 2050 4 GB). Semua perintah di bawah
dijalankan di **PowerShell** dari folder proyek (`D:\finalIL`).

**Langkah 1 — Prasyarat**

| Kebutuhan | Keterangan |
|---|---|
| Python 3.12 (64-bit) | https://www.python.org/downloads/ — centang *Add python.exe to PATH*. Cek: `python --version` |
| Ruang disk | ±1,5 GB untuk `.venv` |
| Gemini API key (opsional) | hanya untuk laporan naratif; lihat Langkah 7 |

> **Smart App Control (Windows 11).** Bila aktif, Windows dapat memblokir file `.pyd` pandas/NumPy hasil `pip` dengan galat
> `ImportError: DLL load failed ... An Application Control policy has blocked this file`. Proyek tidak bisa berjalan sama
> sekali sampai ini diatasi. Cek di *Windows Security → App & browser control → Smart App Control*. Solusi paling andal:
> matikan Smart App Control (di banyak build Windows 11 tidak dapat diaktifkan lagi tanpa reset; Microsoft Defender tetap
> aktif). Alternatif yang tidak dijamin berhasil: `pip install --force-reinstall pandas==2.2.3`, atau memakai Miniforge/conda.

**Langkah 2 — Virtual environment & dependensi**

```powershell
python -m venv .venv
.venv\Scripts\activate                       # prompt berubah menjadi (.venv)
python -m pip install --upgrade pip
pip install -r requirements.txt
python -c "import pandas, numpy, scipy, sklearn, streamlit; from google import genai; print('OK')"
```

Bila `activate` ditolak (*running scripts is disabled*): `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, lalu ulangi.
Tanpa aktivasi pun bisa: ganti `python`/`pytest`/`streamlit` dengan `.venv\Scripts\python.exe -m ...`.

**Langkah 3 — Checkpoint model**

Aplikasi hanya **memuat** checkpoint; tidak pernah melatih ulang. Proyek ini sudah berisi dua checkpoint siap pakai:

| Folder | Isi |
|---|---|
| `artifacts/model/` | P-DINA EEDI Task 3/4 (aljabar SMP, data nyata) |
| `artifacts_calculus/model/` | kalkulus kelas XI (DUMMY sintetis) |

Cek: `Test-Path artifacts\model\pdina_params.npz` → `True`. Bila checkpoint EEDI tidak ada, bangun ulang (sekali saja):

```powershell
# hanya bila artefak data preparation tidak ada: rekonstruksi dari arsip resmi
python -m cdacdm.reconstruct --zip ILCDA/data.zip --out ILCDA/processed_task34_cda_cdm/final_local_reconstruction
python -m cdacdm.pipeline              # ±9 menit CPU; atau jalankan cda_cdm_model_training.ipynb
```

Pipeline mengevaluasi test set **satu kali**; jangan jalankan ulang hanya untuk "memperbarui" angka.

**Langkah 4 — Verifikasi dengan test**

```powershell
pytest -q
```

Hasil yang diharapkan: `62 passed, 1 skipped` (±1 menit). Test memakai checkpoint sintetis kecil yang dibuat di folder
sementara, tidak menyentuh `artifacts/`, dan tidak memakai jaringan. Yang di-*skip* adalah uji opsional ke Gemini API
sungguhan.

**Langkah 5 — Jalankan aplikasi**

```powershell
streamlit run app.py
```

Browser terbuka di http://localhost:8501. Pilih checkpoint di sidebar, lalu ikuti `README_streamlit.md` untuk tiap halaman.
Folder artefak lain: `$env:CDACDM_ARTIFACT_DIR="D:\path\ke\artifacts"` sebelum `streamlit run`.

**Langkah 6 — Pakai aplikasi tanpa LLM (default aman)**

Semua halaman berjalan tanpa API key. Tombol laporan naratif (*Buat ringkasan naratif*, *Buat feedback siswa*,
*Jelaskan rekomendasi*) tetap menghasilkan laporan **template** deterministik dengan peringatan
"Laporan dibuat dengan template karena layanan LLM (Gemini API) tidak tersedia". Untuk mematikan LLM sepenuhnya: set
`"enabled": false` di `configs/llm.json`.

**Langkah 7 — (Opsional) Laporan naratif dengan Gemini 3.1 Flash-Lite**

1. Buat API key di Google AI Studio: https://aistudio.google.com/apikey.
2. Set key di environment (tidak pernah di file config):
   ```powershell
   $env:GEMINI_API_KEY = "<key-anda>"          # sesi ini saja
   setx GEMINI_API_KEY "<key-anda>"            # permanen untuk user; buka terminal baru setelahnya
   ```
3. ID model di `configs/llm.json`: `gemini-3.1-flash-lite` (versi stabil; ada juga `gemini-3.1-flash-lite-preview`).
4. Restart Streamlit (generator di-cache saat aplikasi berjalan), lalu klik tombol laporan naratif.
5. (Opsional) uji ke API sungguhan (request berbayar/berkuota):
   ```powershell
   $env:CDACDM_GEMINI_TEST="1"; pytest -q tests/test_narrative.py -k real_gemini -s
   Remove-Item Env:CDACDM_GEMINI_TEST
   ```

Detail konfigurasi, privasi (data dikirim ke Google; perhatikan tier gratis vs berbayar), dan validator ada di
`README_llm.md`. Laporan yang sama berikutnya diambil dari cache disk (< 1 detik). Bila API tidak dapat dihubungi atau key
belum di-set, template langsung muncul.

### Masalah umum

| Gejala | Solusi |
|---|---|
| `ImportError: DLL load failed ... Application Control policy has blocked this file` | Smart App Control memblokir pandas: lihat Langkah 1 |
| `streamlit` / `pytest` tidak dikenal | venv belum aktif: `.venv\Scripts\activate`, atau pakai `.venv\Scripts\python.exe -m streamlit run app.py` |
| Aplikasi: "Checkpoint model belum tersedia" | folder `artifacts\model` tidak lengkap atau `CDACDM_ARTIFACT_DIR` salah: lihat Langkah 3 |
| Laporan naratif selalu template, alasan *API key Gemini belum di-set* | set `GEMINI_API_KEY` di environment atau di `.env` proyek, restart Streamlit |
| Alasan *Gemini HTTP 404* | ID model salah/tidak tersedia: cek AI Studio, samakan `model` di `configs/llm.json` |
| Alasan *Gemini HTTP 429* | kuota/rate limit habis; tunggu atau aktifkan billing |
| Alasan *output LLM terpotong (MAX_TOKENS)* | naikkan `max_tokens` (termasuk token thinking) atau `thinking_level: "low"` |
| Alasan *validation failed: …* | model menulis angka/format yang tidak sesuai fakta; template ditampilkan (ini perilaku yang disengaja) |
| Perubahan `configs/llm.json` / API key tidak berpengaruh | restart Streamlit |
| Port 8501 dipakai | `streamlit run app.py --server.port 8502` |

### Google Colab

1. Upload folder proyek ini ke `MyDrive/ILCDA/cda_cdm_project/` (tanpa `.venv*`, `ILCDA/`).
2. Pastikan artefak data preparation ada di `MyDrive/ILCDA/processed_task34_cda_cdm/final/` (kandidat path pertama di
   `configs/experiment.json`; bila lain, set `paths.data_dir` atau env `CDACDM_DATA_DIR`; bila tidak diset, pipeline mencari
   `q_matrix.csv` secara rekursif di `MyDrive/ILCDA`).
3. Buka `cda_cdm_model_training.ipynb` di Colab dan *Run all*. Cell pertama me-mount Drive, `cd` ke folder proyek, dan
   `pip install -r requirements.txt`. Output tersimpan di `cda_cdm_project/artifacts/` di Drive.
4. Aplikasi: lihat `README_streamlit.md` (bagian Colab).

## Audit data preparation (temuan)

* `eedi_task34_cda_cdm_pipeline.ipynb` memanggil `run_pipeline()` di cell 4 **tanpa definisinya** (juga `pd`, `np`, `hardest`
  tidak didefinisikan di notebook). Data preparation tidak dapat direproduksi dari notebook saja.
* Artefak Drive tidak dapat diakses dari lingkungan pengembangan ini, sehingga `cdacdm/reconstruct.py` membangun ulang artefak
  dengan nama file dan skema yang terlihat pada output notebook dari arsip resmi (MD5 arsip cocok dengan header Azure). Hasilnya
  cocok dengan output notebook: 4.918 siswa, 948 soal, 1.382.727 interaksi, 57 konsep (SubjectId level-3), 14 soal multi-konsep,
  densitas Q 0,0178, 144 soal fokus (= soal di bawah hierarki *Maths > Algebra*), split 3.934/492/492, dan class weight serta
  train correct rate **identik hingga 16 digit** (indikasi kuat split yang sama). Proxy usia 16–17: 5 (notebook: 6; definisi usia
  berbeda). Semua output menyimpan `artifact_source` sehingga hasil rekonstruksi tidak tertukar dengan artefak Drive.
* **Verifikasi terhadap artefak asli.** Salinan sebagian artefak Drive di `processed_task34_cda_cdm/final/` (q_matrix,
  interactions_train/val, eda_summary; tanpa npz, concept_metadata, item bank, interactions_test) cocok dengan rekonstruksi:
  nilai Q-matrix identik, keanggotaan siswa train/val identik, 1.112.450 + 129.242 interaksi tanpa satu pun selisih `IsCorrect`.
  Q-matrix asli memakai label kolom `c_0…c_56` (indeks konsep); loader mendukungnya.
* Loader **tidak berasumsi**: mendeteksi kunci npz, skema missing (`-1`, NaN, mask eksplisit; bila hanya {0,1} tanpa mask → ditolak
  sebagai ambigu), menyelaraskan kolom dengan `question_ids`, dan membandingkan matriks npz dengan `interactions_*.csv`
  (sumber utama). Q-matrix divalidasi (948 × 57 + QuestionId, biner, unik), kolom konsep dicocokkan ke `concept_metadata.csv`.
* Leakage: hanya `UserId, QuestionId, IsCorrect` yang dibaca untuk model; `question_pass_rate*`, `question_difficulty*`,
  `prior_accuracy*`, `student_mean_confidence`, `student_accuracy`, `question_attempts`, `question_confidence`, `option_entropy` dicatat sebagai *excluded_leakage_prone* (`audit/leakage_audit.json`). Statistik
  `cda_item_bank.csv` diverifikasi berasal dari train saja.

## Konsep target & cakupan materi

* 11 konsep aljabar EEDI menjadi target (`configs/target_concept_map.csv`); 46 konsep lain (Number, Geometry) **tidak dimasukkan**.
* Audit visual 22 soal fokus (2 per konsep): 17 cocok dengan label, 5 parsial — mis. dua soal berlabel *Solving Linear
  Inequalities* sebenarnya membandingkan panjang ruas dengan simbol >/<, bukan menyelesaikan pertidaksamaan; soal *Gradient*
  juga menguji panjang ruas. Semua sampel setara SMP. 122 soal fokus lain berstatus `not_reviewed`.
* Konsep EEDI hanya **prasyarat** aljabar SMA (satu overlap parsial: barisan aritmetika). **Tidak terpetakan**: eksponen &
  logaritma, polinomial, matriks, limit, turunan, integral (`audit/unmapped_target_topics.csv`). *Gradient Between Two
  Co-ordinates* hanya 2 soal → keterbatasan diagnosis.

## Model

> Penjelasan lengkap P-DINA (intuisi, matematika, training variational EM, seleksi hyperparameter, kebijakan diagnosis,
> evaluasi, cara pakai, kapan training ulang, perbandingan dengan deep learning) ada di **`README_pdina.md`**.

Persamaan lengkap ada di docstring `cdacdm/models.py` dan notebook. Ringkasnya:
$P(X_{ij}=1\mid\alpha)=(1-s_j)^{\eta_{ij}}g_j^{1-\eta_{ij}}$, $\eta_{ij}=\prod_k\alpha_{ik}^{q_{jk}}$; keluarga variasional
$q(\alpha_i)=\prod_k\mathrm{Bern}(\pi_{ik})$ memberi ELBO tertutup tanpa enumerasi $2^{57}$; update koordinat eksak untuk soal
satu-konsep; M-step tertutup dengan prior Beta pada $g,s$; prior mastery *independent* atau *higher-order*. Likelihood hanya
menjumlahkan respons teramati (mask). Siswa baru = E-step saja dengan parameter beku. Baseline: item-mean, concept-score
(proporsi benar per konsep, di-smoothing), Q-logistic kompensatori. NeuralCDM tidak diimplementasikan: model yang dipakai sudah
memberi prediksi kompetitif dan setiap parameternya dapat ditafsirkan.

Kebijakan diagnosis (dari validation): τ via log-likelihood held-out prediksi DINA berlabel keras + aturan *one-standard-error*;
n_min dan δ via konsistensi klasifikasi split-half ≥ 0,85. Label: `mastered`, `not_mastered` (= learning gap), `uncertain`,
`insufficient_evidence` (bukan gap — butuh data). Form CDA otomatis memberi tiap konsep ≥ n_min soal.

## Lapisan naratif (LLM via Gemini API, opsional)

**Tujuan.** Tabel profil mastery dan rekomendasi sulit dibaca cepat oleh guru dan siswa. Lapisan naratif mengubah hasil
diagnosis menjadi laporan Markdown berbahasa Indonesia: ringkasan kelas untuk guru, umpan balik suportif untuk siswa, dan
penjelasan rekomendasi intervensi.

**Pembagian peran (tegas).**

| Komponen | Tugas | Tidak boleh |
|---|---|---|
| P-DINA (`models.py`, `diagnosis.py`, `intervention.py`) | menghitung probabilitas mastery, label, learning gap, prioritas, rekomendasi R1–R5 | — |
| LLM (Gemini 3.1 Flash-Lite, Gemini API) | menyusun kalimat dari fakta yang sudah dihitung | menghitung/mengubah angka, memprediksi mastery, menambah konsep, mengklaim intervensi efektif |
| Validator + template (`narrative.py`) | menolak teks LLM yang tidak berdasar; menyediakan laporan cadangan deterministik | menampilkan teks yang tidak lolos validasi |

**Alur.**

```
CDMService.diagnose()  ──►  NarrativeFacts (JSON ringkas, ID siswa dipseudonimkan "Siswa-<hash>")
        ──►  prompt (aturan + heading wajib + 1 contoh)  ──►  Gemini API (SDK resmi google-genai)
        ──►  validator ──lolos──►  laporan + cache disk
                  └──gagal──►  perbaikan (maks. 2×)  ──►  template deterministik (fallback)
```

* **Fakta yang dikirim**: agregat kelas (≤ 11 konsep target, ≤ 5 gap, ≤ 5 rekomendasi) atau profil satu siswa (≤ 12 konsep).
  Tidak ada matriks respons, `UserId` asli, nama, atau sekolah.
* **Validator (hard fail)**: setiap angka harus ada di fakta dan, pada baris yang menyebut konsep, milik konsep itu;
  heading wajib lengkap; rekomendasi placeholder wajib disebut "perlu validasi guru"; klaim terlarang (*terbukti, dijamin,
  efektif meningkatkan, siswa malas*, …) ditolak; konsep di luar fakta ditolak; 120–900 kata; tanpa HTML atau daftar bernomor.
* **Privasi**: fakta (pseudonim, agregat) **dikirim ke Google**. Pada tier gratis Gemini API, data dapat dipakai Google
  untuk meningkatkan produk; untuk data kelas nyata pakai project berbayar dan cek ketentuan terbaru. API key hanya dibaca
  dari env `GEMINI_API_KEY`. Audit log (`artifacts/reports/narrative_log.jsonl`) tidak menyimpan teks laporan, ID siswa,
  maupun key.
* **Ketahanan**: satu request per laporan, cache disk (kunci = hash fakta + model + versi prompt), circuit breaker setelah 3
  kegagalan, timeout 120 s, retry dengan backoff untuk HTTP 429/5xx. Tanpa key/internet, template langsung muncul — aplikasi
  tidak crash.
* **Di aplikasi**: tombol *Buat ringkasan naratif* (Dashboard, Learning Gap Analysis), *Buat feedback siswa* (Student
  Assessment), *Jelaskan rekomendasi* (Intervention Recommendations). Laporan hanya dibuat saat tombol diklik, ditampilkan
  dengan nama model, versi prompt, latensi, disclaimer, dan tombol unduh `.md`.
* **Model**: `gemini-3.1-flash-lite` dengan `thinking_level: "low"` dan `temperature: 1.0` (rekomendasi Google untuk
  Gemini 3). Model berjalan di server Google; aplikasi hanya klien SDK `google-genai`, tanpa `torch`/`transformers`.

Kode: `cdacdm/narrative.py`, `CDMService.generate_narrative()`; konfigurasi: `configs/llm.json`; uji: `tests/test_narrative.py`;
detail lengkap: `README_llm.md`.

## Hasil (dihitung oleh pipeline; lihat `artifacts/`)

Semua angka di bawah berasal dari run notebook `cda_cdm_model_training.ipynb` (24-10-2026, artefak `local_reconstruction`,
510 detik di CPU). Bila notebook dijalankan pada artefak Drive, angkanya dihitung ulang dari data tersebut.

**Seleksi (validation):** P-DINA prior *higher-order*, kekuatan prior Beta g/s = 2, tanpa class weighting (class weighting
memperburuk log-loss validation di semua konfigurasi). Kebijakan: τ = 0,5; n_min = 5 respons per konsep; δ = 0.

**Prediksi respons — test (492 siswa, 28.003 respons held-out, dievaluasi sekali):**

| Model | ROC-AUC [95% CI] | Log-loss | Brier | Accuracy | Precision | Recall | F1 | ECE |
|---|---|---|---|---|---|---|---|---|
| **P-DINA (utama)** | 0,768 [0,759–0,779] | 0,568 | 0,194 | 0,699 | 0,743 | 0,669 | 0,704 | 0,008 |
| P-DINA prior independen (ablasi) | 0,761 [0,751–0,772] | 0,575 | 0,197 | 0,693 | 0,733 | 0,672 | 0,701 | 0,006 |
| Q-logistic (baseline) | 0,775 [0,766–0,786] | 0,567 | 0,193 | 0,704 | 0,721 | 0,731 | 0,726 | 0,036 |
| Concept-score (baseline) | 0,718 [0,707–0,733] | 0,611 | 0,213 | 0,658 | 0,682 | 0,681 | 0,681 | 0,016 |
| Item-mean (baseline) | 0,672 [0,661–0,682] | 0,644 | 0,226 | 0,627 | 0,642 | 0,689 | 0,665 | 0,005 |

Selisih berpasangan (bootstrap per siswa): P-DINA vs Q-logistic AUC −0,007 [−0,011; −0,003], log-loss +0,001 [−0,003; +0,007]
(tidak berbeda bermakna); P-DINA jauh lebih baik dari concept-score dan item-mean. In-sample train (optimistis): AUC 0,800.

**Kualitas diagnosis (proksi; tidak ada ground truth mastery):**
* Konsistensi klasifikasi split-half pada siswa test (konsep target, ≥ 5 respons per paruh): **0,876** (880 sel).
* SIMULASI dari model terlatih: akurasi atribut 0,957 bila ada bukti, 0,851 tanpa bukti; recovery parameter soal r(g) = 0,965,
  r(s) = 0,982. Ini batas atas optimistis (model diasumsikan benar).

**CDA:** 139 soal target layak (≥ 30 respons train, daya beda ≥ 0,1). Fixed form 52 soal (5 per konsep, *Gradient* hanya 2).
Parallel form A/B masing-masing 45 soal dengan selisih difficulty per konsep ≤ 0,025; 6 dari 11 konsep tidak punya cukup soal
untuk dua form penuh (< 10 soal). Replay adaptif pada 300 siswa test: kesepakatan label dengan diagnosis dari semua respons
0,862 (adaptif, 10 soal) vs 0,824 (acak); 0,911 vs 0,871 pada 20 soal.

**Diagnosis siswa test (label model, bukan mastery terbukti):** dari 5.412 sel siswa × konsep target: 727 *mastered*,
1.394 *not_mastered* (gap), 3.291 *insufficient_evidence*; 322 dari 492 siswa punya ≥ 1 gap. Di antara siswa yang dapat
didiagnosis, proporsi gap per konsep 55–80%. *Gradient Between Two Co-ordinates* tidak dapat didiagnosis untuk satu pun siswa.

**Demo pre/post (SIMULASI, 40 siswa sintetis):** korelasi perubahan P(mastery) terestimasi vs perubahan mastery sebenarnya
(diketahui karena disimulasikan) = 0,744.

**Lapisan naratif (Gemini API):** baru satu smoke test (27-10-2026, `gemini-3.1-flash-lite`, laporan guru dari checkpoint
uji sintetis 2 siswa): lolos validator pada percobaan pertama, ±7 detik, 936 token input + 497 output + 121 thinking.
Ini bukan evaluasi; pass rate, latensi, dan token pada data demo EEDI perlu diukur dengan `scripts/eval_narrative.py`. Hasil uji SLM lokal sebelumnya (Qwen3-4B via
Ollama, lihat riwayat git) tidak berlaku untuk model ini.

## Status fitur

| Kategori | Fitur |
|---|---|
| **Berjalan dengan data EEDI** | audit artefak & leakage; analisis Q-matrix; peta konsep target; training P-DINA + 3 baseline; seleksi hyperparameter & kebijakan di validation; evaluasi test (AUC, accuracy, precision, recall, F1, log-loss, Brier, ECE, kalibrasi, per konsep, bootstrap CI); konsistensi split-half; profil mastery, learning gap & agregasi kelas siswa test; fixed/parallel forms; replay adaptif; inferensi siswa baru/parsial; aplikasi Streamlit |
| **Opsional, butuh Gemini API key + internet** | laporan naratif LLM untuk guru, siswa, dan rekomendasi; validator angka/klaim; fallback template; cache & audit log. Tanpa key, tombol yang sama menghasilkan laporan template |
| **Belum dijalankan** | evaluasi antar-model Gemini pada tugas naratif (`scripts/eval_narrative.py`) |
| **Demonstrasi berbasis data sintetis** | analisis pre/post (`artifacts/prepost/SYNTHETIC_*`, halaman Pre/Post mode SIMULASI); simulasi recovery mastery & parameter soal (berlabel *SIMULATION*) |
| **Placeholder yang wajib diisi/divalidasi** | `configs/intervention_map.csv` (sumber materi, aktivitas, durasi); `prerequisite_concept_ids` & `curriculum_order` di peta konsep (draft); `configs/target_curriculum.csv` (draft topik SMA) |
| **Baru dapat dipakai setelah data kelas nyata tersedia** | hasil pre/post penelitian (`compare_pre_post` dengan CSV pre & post, ID siswa sama, opsional `group`); validasi model pada siswa SMA; diagnosis topik SMA yang tidak ada di EEDI (butuh soal baru yang dipetakan ke Q-matrix dan dikalibrasi); evaluasi efektivitas intervensi (butuh desain dengan kelompok pembanding) |

## Keterbatasan

* Tidak ada ground-truth mastery di EEDI: kualitas diagnosis dilaporkan sebagai konsistensi split-half dan simulasi, bukan akurasi.
* Item EEDI berdaya beda sedang (rata-rata g≈0,33, s≈0,24 untuk soal pilihan ganda 4 opsi), sehingga diagnosis per konsep butuh
  ±5 respons; form yang lebih pendek menghasilkan banyak konsep `insufficient_evidence`.
* Q-logistic kompensatori sedikit lebih unggul AUC-nya dibanding P-DINA (lihat hasil); P-DINA dipertahankan karena kalibrasinya
  lebih baik dan parameternya langsung bermakna (guess/slip, probabilitas penguasaan) — trade-off ini dilaporkan, tidak disembunyikan.
* Pre/post tanpa kelompok kontrol = *perubahan yang teramati*, bukan efek kausal.
* **LLM**: validator menjamin angka berasal dari hasil diagnosis dan sesuai konsepnya, tetapi tidak menjamin seluruh makna
  kalimat (mis. konsep ditaruh di bagian yang keliru) maupun ketepatan pedagogis. Laporan naratif adalah draf yang perlu
  ditinjau guru, bukan penilaian resmi.
* **LLM**: kualitas laporan Gemini baru diuji dengan satu smoke test, belum dievaluasi sistematis maupun dinilai guru (`scripts/eval_narrative.py` tersedia
  untuk itu).
* **LLM**: bergantung pada internet, kuota/biaya API, dan ketersediaan model *preview*; fakta (pseudonim) dikirim ke Google.
