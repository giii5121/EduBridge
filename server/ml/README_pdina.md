# P-DINA: model diagnosis kognitif proyek CDA-CDM

Dokumen ini menjelaskan **semua tentang model P-DINA** di proyek ini: idenya, matematikanya, cara training, cara memilih
hyperparameter dan kebijakan diagnosis, evaluasi, cara memakai checkpoint, kapan perlu training ulang, bedanya dengan model
deep learning seperti YOLO, dan keterbatasannya. Semua angka berasal dari artefak hasil run (`artifacts/`), bukan perkiraan.

Kode: `cdacdm/models.py` (model), `cdacdm/pipeline.py` (training & evaluasi), `cdacdm/evaluation.py` (metrik & seleksi),
`cdacdm/diagnosis.py` (label & learning gap), `cdacdm/service.py` (memuat checkpoint & inferensi).

---

## 1. Ringkasan

| | |
|---|---|
| **Nama** | P-DINA — *probabilistic DINA* dengan prior *higher-order*, diestimasi dengan **variational EM** |
| **Tugas** | Dari pola jawaban benar/salah siswa, memperkirakan **probabilitas siswa menguasai tiap konsep** |
| **Input** | Respons siswa per soal (`1` benar, `0` salah, kosong = tidak dijawab) + Q-matrix (soal → konsep) |
| **Output** | Per siswa × konsep: P(mastery), label (`mastered` / `not_mastered` / `uncertain` / `insufficient_evidence`), jumlah bukti |
| **Data training** | EEDI NeurIPS 2020 Task 3/4: 3.934 siswa train, 948 soal, 57 konsep (11 konsep aljabar target) |
| **Parameter** | 2 per soal (guess *g*, slip *s*) → 1.896, ditambah 2 per konsep untuk prior (*a*, *b*) → 114 |
| **Training** | CPU, ±30 detik per konfigurasi; seluruh pipeline (12 konfigurasi + baseline + evaluasi) ±9 menit |
| **Kualitas (test, sekali)** | ROC-AUC prediksi respons 0,768; ECE 0,008; konsistensi diagnosis split-half 0,876 |
| **Checkpoint** | `artifacts/model/` (EEDI, data nyata) dan `artifacts_calculus/model/` (kalkulus XI, DUMMY sintetis) |

> P(mastery) adalah **estimasi model**, bukan penguasaan yang terbukti. EEDI tidak memiliki data "mastery sebenarnya".

---

## 2. Intuisi

Bayangkan soal: *"Sederhanakan 3x + 2x"*. Q-matrix menyatakan soal ini menguji satu konsep: **Simplifying Expressions by
Collecting Like Terms**.

* Siswa yang **menguasai** konsep itu hampir selalu benar, kecuali **slip** (ceroboh): peluang salah = *s*.
* Siswa yang **belum menguasai** biasanya salah, kecuali **guess** (menebak benar pilihan ganda): peluang benar = *g*.

Bila sebuah soal menguji dua konsep, siswa dianggap "siap" hanya bila **menguasai keduanya** (aturan *konjungtif* DINA:
*Deterministic Inputs, Noisy "And" gate*).

Dari banyak jawaban, model menimbang bukti: jawaban benar pada soal dengan *g* kecil adalah bukti kuat penguasaan; benar pada
soal yang mudah ditebak (*g* besar) adalah bukti lemah. Hasilnya probabilitas per konsep, lengkap dengan seberapa banyak
bukti yang mendasarinya.

**Q-matrix** (948 × 57, biner) adalah pengetahuan pakar yang **tidak dipelajari** model:

| Soal | Writing Expressions | Linear Equations | Factorising … | … |
|---|---|---|---|---|
| Q-101 | 1 | 0 | 0 | … |
| Q-102 | 0 | 1 | 0 | … |
| Q-103 (multi-konsep) | 1 | 1 | 0 | … |

Di EEDI, 934 dari 948 soal (98,5%) hanya menguji satu konsep; 14 soal menguji dua konsep.

---

## 3. Model formal

Untuk siswa *i*, soal *j*, konsep *k*:

```
α_ik ∈ {0,1}                         penguasaan laten (tidak teramati)
η_ij = Π_k α_ik^q_jk                  1 bila siswa menguasai SEMUA konsep yang dibutuhkan soal j
P(X_ij = 1 | α_i) = (1 − s_j)^η_ij · g_j^(1 − η_ij)
```

**Prior parameter soal** (regularisasi soal dengan sedikit respons):
`g_j ~ Beta(1 + κ·0,2 ; 1 + κ·0,8)`, `s_j ~ Beta(1 + κ·0,2 ; 1 + κ·0,8)`. κ (*gs_prior_strength*) dipilih di validation;
model terpilih κ = 2 → Beta(1,4 ; 2,6). Batas: *g*, *s* ∈ [0,001 ; 0,7] dan *g* + *s* ≤ 0,98 (soal harus lebih mudah bagi
yang menguasai).

**Prior penguasaan** (dua pilihan, dipilih di validation):

| Prior | Rumus | Arti |
|---|---|---|
| `independent` | α_ik ~ Bernoulli(λ_k) | tiap konsep punya *base rate* populasi sendiri, antar-konsep independen |
| `higher_order` (**terpilih**) | α_ik ~ Bernoulli(σ(a_k·θ_i − b_k)), θ_i ~ N(0,1) | ada **kemampuan umum** θ_i; siswa yang kuat di banyak konsep cenderung kuat di konsep lain (HO-DINA, de la Torre & Douglas 2004) |

Prior *higher-order* membuat konsep dengan sedikit bukti "meminjam" informasi dari konsep lain milik siswa yang sama.

**Missing ≠ salah.** Likelihood hanya menjumlahkan respons **teramati** (mask *m_ij*). Soal yang tidak dikerjakan tidak
dihitung sebagai salah; konsep tanpa bukti kembali ke prior.

---

## 4. Training: variational EM

### Kenapa tidak EM biasa?

EM DINA klasik menjumlahkan semua profil penguasaan: 2^57 ≈ 1,4 × 10^17 kemungkinan per siswa, mustahil dihitung.
P-DINA memakai **pendekatan variasional mean-field**: `q(α_i) = Π_k Bernoulli(π_ik)`. Karena likelihood hanya bergantung
pada η_ij, dan di bawah *q* berlaku `P(η_ij = 1) = ρ_ij = Π_k π_ik^q_jk`, batas bawah log-likelihood (**ELBO**) punya bentuk
tertutup:

```
ELBO = Σ_ij m_ij [ρ_ij·ℓ1_ij + (1 − ρ_ij)·ℓ0_ij] − Σ_ik KL(Bern(π_ik) ‖ Bern(λ_ik)) + log prior(g, s, θ)
ℓ1_ij = x·log(1 − s_j) + (1 − x)·log s_j        (log-likelihood bila η = 1)
ℓ0_ij = x·log g_j      + (1 − x)·log(1 − g_j)   (log-likelihood bila η = 0)
```

### Satu iterasi EM

1. **E-step** (perbarui π, keyakinan penguasaan tiap siswa):
   `logit π_ik = logit λ_ik + Σ_j m_ij q_jk (ρ_ij / π_ik)(ℓ1_ij − ℓ0_ij)`
   * Untuk soal satu-konsep `ρ_ij/π_ik = 1`, sehingga update **eksak** (Bayes tepat) dan dihitung dengan dua perkalian matriks.
     Bila siswa hanya menjawab soal satu-konsep, posterior mean-field = posterior eksak.
   * Untuk 14 soal multi-konsep: iterasi titik-tetap dengan *damping* 0,5, hanya pada blok siswa × konsep yang terdampak.
   * Prior *higher-order*: θ_i diperbarui dengan Newton (estimasi MAP).
2. **M-step** (perbarui parameter soal, rumus tertutup MAP dengan prior Beta):
   ```
   s_j = (Σ_i m·ρ·(1 − x) + a_s − 1) / (Σ_i m·ρ + a_s + b_s − 2)
   g_j = (Σ_i m·(1 − ρ)·x + a_g − 1) / (Σ_i m·(1 − ρ) + a_g + b_g − 2)
   ```
   lalu *g*, *s* dipotong ke batas di atas; parameter prior (λ, atau *a*, *b* untuk *higher-order*) diperbarui (Newton).
3. Hitung ELBO. **Berhenti** bila perubahan relatif ELBO ≤ 10⁻⁶, atau setelah 150 iterasi.

Model terpilih konvergen dalam **44 iterasi EM** (ELBO akhir −630.546), ±30 detik di CPU laptop.

### Data dan pencegahan kebocoran

* Split **per siswa** (siswa tidak muncul di dua split): train 3.934, validation 492, test 492.
* Model hanya membaca `UserId, QuestionId, IsCorrect`. Kolom yang bisa membocorkan jawaban (`question_pass_rate`,
  `prior_accuracy`, `question_difficulty`, `student_mean_confidence`, …) dikecualikan dan dicatat di
  `artifacts/audit/leakage_audit.json`.
* Parameter soal (*g*, *s*) **hanya** dipelajari dari train.

---

## 5. Seleksi hyperparameter (validation)

**Protokol held-out.** Pada tiap siswa validation, 20% respons disembunyikan (minimal 5 respons tetap terlihat sebagai
konteks). Model menebak penguasaan dari konteks, lalu memprediksi respons yang disembunyikan. Kriteria: **log-loss**
(makin kecil makin baik).

**Grid:** prior {independent, higher_order} × κ {2, 10, 40} × class weighting {tidak, ya} = 12 konfigurasi P-DINA, ditambah
baseline. Hasil (`artifacts/evaluation/hp_search_validation.csv`):

| Konfigurasi | Iterasi EM | Waktu fit | Log-loss val | AUC val |
|---|---|---|---|---|
| **higher_order, κ=2, tanpa class weight (terpilih)** | 44 | 29,8 s | **0,5721** | 0,7648 |
| higher_order, κ=10, tanpa class weight | 47 | 30,1 s | 0,5721 | 0,7647 |
| higher_order, κ=40, tanpa class weight | 43 | 31,3 s | 0,5726 | 0,7644 |
| higher_order, κ=2, dengan class weight | 43 | 28,5 s | 0,5742 | 0,7646 |
| independent, κ=2, tanpa class weight | 81 | 9,9 s | 0,5788 | 0,7575 |
| independent, κ=10, tanpa class weight | 67 | 8,1 s | 0,5788 | 0,7576 |
| *Q-logistic σ=1 (baseline)* | — | 21,4 s | 0,5735 | 0,7682 |
| *Concept-score k=5 (baseline)* | — | 0,1 s | 0,6233 | 0,7019 |
| *Item-mean (baseline)* | — | 0,1 s | 0,6395 | 0,6784 |

Temuan:
* Prior *higher-order* konsisten lebih baik dari *independent* (log-loss 0,572 vs 0,579).
* Kekuatan prior κ hampir tidak berpengaruh: data per soal sudah cukup banyak.
* Class weighting memperburuk log-loss di semua konfigurasi, sehingga tidak dipakai.

---

## 6. Kebijakan diagnosis (validation)

P(mastery) diubah menjadi label dengan tiga angka, semuanya dipilih dari data validation (`artifacts/model/diagnosis_policy.json`):

| Label | Aturan |
|---|---|
| `insufficient_evidence` | respons pada konsep < **n_min** → **bukan** learning gap, butuh soal tambahan |
| `mastered` | π ≥ τ + δ |
| `not_mastered` (= **learning gap**) | π < τ − δ |
| `uncertain` | |π − τ| < δ |

* **τ = 0,5** (threshold). Dipilih dari log-loss prediksi DINA berlabel keras pada respons held-out. Nilai terbaik mentah
  τ = 0,65, tetapi semua τ ∈ [0,45 ; 0,70] berada dalam satu *standard error* dari yang terbaik, sehingga dipilih nilai
  netral 0,5 (aturan *one-standard-error* ke arah 0,5).
* **n_min = 5** (bukti minimum). Respons tiap siswa dibagi dua secara acak, diagnosis dibuat terpisah dari tiap bagian, lalu
  dicek kesepakatannya. n_min = nilai terkecil yang mencapai konsistensi ≥ 0,85:

  | n_min (per paruh) | 1 | 2 | 3 | 4 | **5** | 6 | 8 |
  |---|---|---|---|---|---|---|---|
  | konsistensi | 0,837 | 0,825 | 0,820 | 0,839 | **0,857** | 0,879 | 0,881 |

* **δ = 0** (pita ketidakpastian). Konsistensi sudah ≥ 0,85 tanpa pita, sehingga label `uncertain` jarang muncul dengan
  kebijakan default.

Di aplikasi, τ/δ/n_min bisa diubah di sidebar hanya untuk analisis sensitivitas; aplikasi memberi peringatan bila berbeda
dari nilai terpilih.

**Learning gap dan prioritas.** Konsep target berlabel `not_mastered` adalah *learning gap*. Urutan prioritas:
`priority = need × certainty`, dengan `need = (τ − π)/τ` dan `certainty = 1 − entropi(π)`. Konsep jauh di bawah τ dan
diagnosisnya yakin didahulukan.

---

## 7. Evaluasi (test, dijalankan **sekali**)

**Protokol** sama dengan validation: 20% respons tiap siswa test disembunyikan; parameter soal dibekukan dari train; test
hanya dievaluasi satu kali (pipeline menolak evaluasi ulang dalam run yang sama).

**Prediksi respons** (492 siswa, 28.003 respons held-out):

| Model | ROC-AUC [95% CI] | Log-loss | Brier | Accuracy | F1 | ECE |
|---|---|---|---|---|---|---|
| **P-DINA (utama)** | 0,768 [0,759–0,779] | 0,568 | 0,194 | 0,699 | 0,704 | **0,008** |
| P-DINA prior independen (ablasi) | 0,761 [0,751–0,772] | 0,575 | 0,197 | 0,693 | 0,701 | 0,006 |
| Q-logistic (baseline) | 0,775 [0,766–0,786] | 0,567 | 0,193 | 0,704 | 0,726 | 0,036 |
| Concept-score (baseline) | 0,718 [0,707–0,733] | 0,611 | 0,213 | 0,658 | 0,681 | 0,016 |
| Item-mean (baseline) | 0,672 [0,661–0,682] | 0,644 | 0,226 | 0,627 | 0,665 | 0,005 |

CI dari bootstrap per siswa (200 ulangan). P-DINA vs Q-logistic: AUC −0,007 [−0,011; −0,003], log-loss +0,001
[−0,003; +0,007] → **setara**. P-DINA dipertahankan karena kalibrasinya jauh lebih baik (ECE 0,008 vs 0,036) dan
parameternya bermakna langsung (guess, slip, P(mastery) per konsep), sedangkan Q-logistic adalah model kompensatori tanpa
konsep "menguasai/belum".

**Kualitas diagnosis** (proksi, karena tidak ada mastery sebenarnya):

| Ukuran | Hasil | Catatan |
|---|---|---|
| Konsistensi split-half (siswa test, konsep target, ≥ 5 respons per paruh) | **0,876** (880 sel) | dua diagnosis independen dari data berbeda sepakat |
| Akurasi atribut pada **simulasi** dari model terlatih | 0,957 (ada bukti) / 0,851 (tanpa bukti) | batas atas optimistis: model diasumsikan benar |
| Recovery parameter soal (simulasi) | r(g) = 0,965, r(s) = 0,982 | prosedur estimasi bisa menemukan kembali parameter yang benar |

Prediksi respons yang baik **tidak membuktikan** diagnosis benar; karena itu ketiga ukuran di atas dilaporkan bersama.

---

## 8. Parameter yang dipelajari

Dari `artifacts/model/item_parameters.csv` (948 soal):

| Parameter | Rata-rata | Median | Rentang |
|---|---|---|---|
| guess *g* | 0,338 | 0,317 | 0,017 – 0,700 |
| slip *s* | 0,253 | 0,217 | 0,002 – 0,700 |
| daya beda 1 − *s* − *g* | 0,409 | 0,417 | 0,020 – 0,976 |

* *g* ≈ 0,33 wajar untuk pilihan ganda 4 opsi (tebakan acak = 0,25). Daya beda sedang, sehingga satu konsep butuh ±5
  respons agar diagnosisnya stabil (sesuai n_min).
* 900 dari 948 soal punya parameter andal (≥ 30 respons train). 139 soal target memenuhi syarat untuk form CDA
  (parameter andal dan daya beda ≥ 0,1).
* Prior *higher-order*: rata-rata *a_k* = 3,67, artinya penguasaan antar-konsep sangat terkait dengan kemampuan umum θ.

---

## 9. Inferensi untuk siswa baru (tanpa training ulang)

Untuk siswa yang tidak ada di data training, `PDINA.infer()` hanya menjalankan **E-step** dengan *g*, *s*, dan parameter
prior **dibekukan**:

* Bisa untuk tes parsial atau tidak lengkap; soal kosong = tidak teramati.
* Hasil per konsep: `mastery_prob` (π), `mastery_label`, `n_evidence`, `n_correct`, `prior_mastery_prob`, `posterior_sd`
  (= √(π(1−π)), ukuran ketidakpastian Bernoulli, **bukan** interval kepercayaan), `entropy_bits`.
* Konsep tanpa respons mengembalikan prior (dengan prior *higher-order*, prior ini sudah disesuaikan θ siswa) dan berlabel
  `insufficient_evidence`.
* Cepat: diagnosis 30 siswa demo ±0,4 detik.

Soal yang dipakai harus **ada di item bank** checkpoint (QuestionId dikenal); soal yang tidak dikenal ditolak validasi input.

---

## 10. Cara memakai

### Memakai checkpoint (paling umum)

```python
from cdacdm.api import load_model, predict_mastery
import pandas as pd

svc = load_model("artifacts")                       # memuat artifacts/model, tanpa training
resp = pd.DataFrame({"student_id": ["S1"] * 3, "QuestionId": [12, 345, 678], "response": [1, 0, ""]})
prof = predict_mastery(resp, service=svc)           # profil per siswa × konsep
res = svc.diagnose(resp)                            # profil + learning gap + ringkasan kelas + rekomendasi
report = svc.report_json(res)                       # ringkasan JSON (dengan disclaimer)
```

Format CSV lain (lebar, `answer_option` 1–4) dijelaskan di `README_streamlit.md`. Di aplikasi Streamlit, semua ini lewat
halaman *Student Assessment* dan *Learning Gap Analysis*.

### Training ulang

```powershell
python -m cdacdm.pipeline --output-dir artifacts_new     # semua langkah, ±9 menit CPU
python -m cdacdm.pipeline --fast --output-dir tmp_smoke  # grid kecil, untuk uji cepat
python -m cdacdm.dummy_calculus                          # checkpoint kalkulus DUMMY (artifacts_calculus)
```

Atau jalankan `cda_cdm_model_training.ipynb` (lokal / Colab). Pipeline: audit data → Q-matrix & konsep target → seleksi
hyperparameter (train → validation) → kebijakan diagnosis (validation) → **evaluasi test sekali** → kualitas diagnosis
(split-half, simulasi) → form CDA → diagnosis siswa test → demo pre/post → simpan checkpoint.

> Pakai `--output-dir` ke folder baru untuk eksperimen. Menjalankan ulang ke `artifacts/` menimpa checkpoint dan
> menghitung ulang angka test; jangan lakukan hanya untuk "memperbarui" hasil. Konfigurasi ada di `configs/experiment.json`
> (grid, prior, batas iterasi, aturan evaluasi).

### Isi checkpoint (`artifacts/model/`)

| File | Isi |
|---|---|
| `pdina_params.npz` | Q-matrix, *g*, *s*, λ, *a*, *b*, `question_ids`, `concept_ids` |
| `pdina_config.json` | hyperparameter, jumlah iterasi EM, ELBO akhir, konfigurasi asal |
| `diagnosis_policy.json` | τ, δ, n_min, konsep target, dan asal-usul pemilihannya |
| `item_parameters.csv` | parameter per soal (guess, slip, daya beda, kelayakan) |
| `concept_metadata.csv`, `target_concept_map.csv` | nama konsep, cakupan target, prasyarat, urutan kurikulum |
| `item_bank.csv`, `q_matrix.csv` | item bank & Q-matrix yang dipakai |
| `intervention_map_resolved.csv` | peta intervensi (placeholder) |
| `model_card.json`, `experiment_config_used.json` | ringkasan run & konfigurasi lengkap |

Saat dimuat, `CDMService.load()` memeriksa bahwa QuestionId, urutan konsep, dan konsep target saling konsisten.

---

## 11. Kapan perlu training ulang?

| Situasi | Training ulang? | Alasan |
|---|---|---|
| Siswa baru mengerjakan soal yang sudah ada di item bank | **Tidak** | cukup inferensi (E-step) |
| Mengubah τ / δ / n_min | Tidak | hanya kebijakan label; idealnya dipilih ulang di validation |
| Mengubah intervention map | Tidak | bukan bagian model |
| Menambah **soal baru** | **Ya** | *g*/*s* soal baru harus dikalibrasi dari respons (≥ 30 respons/soal) |
| Mengubah **Q-matrix** atau daftar konsep (mis. topik SMA baru) | **Ya** | struktur model berubah |
| Memakai **populasi lain** (kelas SMA penelitian) | **Ya / validasi ulang** | parameter EEDI berasal dari siswa SMP UK |
| Checkpoint kalkulus untuk penelitian sungguhan | **Ya** | saat ini dilatih dengan data DUMMY sintetis |

---

## 12. P-DINA vs model deep learning (mis. YOLO)

| Aspek | YOLO (deteksi objek) | P-DINA |
|---|---|---|
| Jenis belajar | *Supervised*: ribuan gambar berlabel kotak | **Variabel laten**: mastery tidak pernah diamati, disimpulkan dari jawaban benar/salah |
| Yang dipelajari | Jutaan bobot jaringan saraf | ±2.000 parameter bermakna (*g*, *s* per soal; *a*, *b* per konsep) |
| Struktur | Dipelajari dari data | Ditentukan teori dan pakar (Q-matrix + aturan konjungtif DINA) |
| Algoritme | Gradient descent + backprop, banyak epoch | Variational EM dengan update tertutup, ±44 iterasi |
| Komputasi | GPU, jam–hari | CPU, ±30 detik per fit |
| Evaluasi | Dibandingkan dengan label (mAP, IoU) | Tidak ada label mastery → prediksi respons held-out, split-half, simulasi |
| Interpretasi | *Black box* | Langsung: "soal ini mudah ditebak (*g* = 0,6)", "P(mastery) = 0,23 dari 7 respons" |
| Data baru | *Forward pass* | E-step kecil per siswa, parameter tetap |

Konsekuensinya, P-DINA ringan, transparan, dan cocok untuk keputusan pendidikan, tetapi kualitasnya bergantung pada
ketepatan Q-matrix dan asumsi DINA, serta tidak bisa diverifikasi terhadap "jawaban benar" seperti YOLO.

---

## 13. Asumsi dan keterbatasan

* **Konjungtif**: soal multi-konsep dianggap butuh *semua* konsepnya. Bila sebenarnya kompensatori, model terlalu ketat
  (hanya 14 soal EEDI yang terdampak).
* **Q-matrix dianggap benar.** Audit visual 22 soal fokus: 17 cocok, 5 hanya parsial (README utama). Kesalahan Q-matrix
  langsung menjadi kesalahan diagnosis.
* **Mastery statis**: model tidak memodelkan belajar selama tes; perubahan antar-waktu dianalisis terpisah (pre/post).
* **Independensi lokal**: jawaban dianggap independen bila mastery diketahui.
* **Pendekatan mean-field**: eksak untuk soal satu-konsep, aproksimasi untuk soal multi-konsep; θ adalah estimasi titik
  (MAP), sehingga ketidakpastian θ tidak ikut dihitung.
* **`posterior_sd` bukan interval kepercayaan**; ketidakpastian parameter soal tidak dirambatkan ke π.
* **Tidak ada ground truth mastery** di EEDI; kualitas diagnosis hanya proksi (bagian 7).
* **Populasi**: EEDI mayoritas siswa SMP di UK dan tidak memuat kalkulus. Belum ada validasi pada kelas SMA penelitian.
* **Konsep dengan sedikit soal** (mis. *Gradient Between Two Co-ordinates*, 2 soal) tidak dapat didiagnosis dengan n_min = 5.
* Q-logistic sedikit lebih unggul AUC-nya; trade-off ini sengaja dilaporkan (bagian 7).

---

## 14. Referensi

* Junker, B. W., & Sijtsma, K. (2001). Cognitive assessment models with few assumptions, and connections with
  nonparametric item response theory. *Applied Psychological Measurement*, 25(3), 258–272. (model DINA)
* de la Torre, J., & Douglas, J. A. (2004). Higher-order latent trait models for cognitive diagnosis. *Psychometrika*,
  69(3), 333–353. (prior *higher-order*)
* Blei, D. M., Kucukelbir, A., & McAuliffe, J. D. (2017). Variational inference: A review for statisticians. *Journal of
  the American Statistical Association*, 112(518), 859–877. (inferensi variasional)
* Wang, Z., et al. (2020). Instructions and guide for diagnostic questions: The NeurIPS 2020 Education Challenge.
  arXiv:2007.12061. (data EEDI)

Lihat juga: `README.md` (gambaran proyek & setup), `README_streamlit.md` (aplikasi), `README_llm.md` (laporan naratif).
