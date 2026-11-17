# Lapisan naratif (LLM via Gemini API) — opsional

Lapisan ini mengubah **fakta diagnosis P-DINA** menjadi laporan berbahasa Indonesia untuk guru dan siswa, memakai
**Gemini 3.1 Flash-Lite** lewat **Gemini API resmi** (API key dari Google AI Studio, SDK Python resmi `google-genai`).

> LLM **hanya mengomunikasikan** fakta yang sudah dihitung P-DINA. LLM tidak menghitung, mengubah, atau memprediksi
> mastery, learning gap, rekomendasi, maupun metrik. Matematika, checkpoint, dan evaluasi P-DINA tidak disentuh.

## Cara kerja

```
diagnose() ──► NarrativeFacts (ringkas, ID dipseudonimkan) ──► prompt (aturan + heading wajib + 1 contoh)
           ──► Gemini API (1 request/laporan) ──► validator ──ok──► teks + cache
                                                     └─gagal─► repair (≤ max_retries) ──► template deterministik
```

| Komponen | Isi |
|---|---|
| `cdacdm/narrative.py` | `NarrativeConfig`, `NarrativeFacts`/`build_facts`, `build_prompt`, `validate_narrative`, `fallback_narrative`, `GeminiTransport`, `NarrativeGenerator` (cache, audit log, retry, circuit breaker) |
| `CDMService.generate_narrative(result, audience, student_id, generator)` | mengembalikan `{"text", "meta", "validation", "fallback"}`; `report_json()` tidak berubah |
| `configs/llm.json` | konfigurasi (model, thinking level, batas token, cache, log) |
| `configs/narrative_examples.jsonl` | contoh few-shot (1 guru, 1 siswa; hanya contoh yang sesuai audiens yang dikirim) |
| `app.py` | tombol **Buat ringkasan naratif** (Dashboard, Learning Gap Analysis), **Buat feedback siswa** (Student Assessment), **Jelaskan rekomendasi** (Intervention Recommendations) |

Laporan **tidak** dibuat otomatis saat halaman dibuka; hanya lewat tombol (setiap klik yang tidak kena cache = 1 request
berbayar/berkuota, ditambah repair bila validasi gagal).

Pesan sistem dikirim sebagai `system_instruction`; contoh few-shot dikirim sebagai giliran `user`/`model` di `contents`.

## Menjalankan

### 1. API key (diset sendiri di environment)

Buat key di Google AI Studio (https://aistudio.google.com/apikey), lalu set variabel lingkungan **`GEMINI_API_KEY`**.
Key **tidak pernah** ditulis di config (loader menolak kunci `api_key`/`token` di `llm.json`).
Alternatif: tulis `GEMINI_API_KEY=<key>` di file `.env` di root proyek (sudah di-`.gitignore`). Nilai dari environment
proses diutamakan; `.env` hanya dibaca bila variabel itu tidak ada (kunci config `env_file`, `null` untuk mematikan).

```powershell
# sesi PowerShell saat ini
$env:GEMINI_API_KEY = "<key-anda>"
# permanen untuk user (buka terminal baru setelahnya)
setx GEMINI_API_KEY "<key-anda>"
```

Colab: simpan di *Secrets* lalu `os.environ["GEMINI_API_KEY"] = userdata.get("GEMINI_API_KEY")`.

### 2. Dependensi

```bash
pip install -r requirements.txt      # termasuk google-genai>=1.51 (dukungan Gemini 3 + thinking_level)
```

### 3. Aplikasi

```bash
streamlit run app.py
```

Aplikasi tetap berfungsi tanpa API key / tanpa internet: tombol menghasilkan laporan **template** dengan peringatan
"Laporan dibuat dengan template karena layanan LLM (Gemini API) tidak tersedia." dan alasannya (mis.
*API key Gemini belum di-set (env GEMINI_API_KEY atau file .env)*).

### 4. Uji

```bash
pytest -q                                   # semua test, tanpa jaringan dan tanpa API key
# uji opsional ke Gemini API sungguhan (1+ request berbayar/berkuota):
#   PowerShell: $env:CDACDM_GEMINI_TEST="1"; pytest -q tests/test_narrative.py -k real_gemini -s
```

Smoke test manual (Python):

```python
from cdacdm.service import CDMService
import pandas as pd
svc = CDMService.load("artifacts")
demo = pd.read_csv("artifacts/demo/test_split_responses.csv", dtype={"student_id": str})
res = svc.diagnose(demo[demo["student_id"].isin(demo["student_id"].drop_duplicates().head(30))])
out = svc.generate_narrative(res, "teacher")
print(out["fallback"], out["meta"]["latency_ms"], out["meta"]["reason"], out["meta"]["usage"]); print(out["text"])
```

## Konfigurasi (`configs/llm.json`)

| Kunci | Default | Catatan |
|---|---|---|
| `enabled` | `true` | `false` → selalu template, tanpa request |
| `model` | `gemini-3.1-flash-lite` | ID model Gemini API. Cek ID yang aktif di AI Studio / dokumentasi model Gemini; ganti di sini bila berubah |
| `api_key_env` | `GEMINI_API_KEY` | nama env berisi API key |
| `temperature` | `1.0` | rekomendasi Google untuk Gemini 3 (nilai rendah dapat membuat output berulang/menurun) |
| `top_p` | `null` | `null` → default API |
| `thinking_level` | `low` | Gemini 3 selalu "berpikir"; `low` menekan latensi & biaya. `null` → default model |
| `max_tokens` | 8192 | `max_output_tokens`; pada Gemini 3 **termasuk token thinking** — jangan terlalu kecil |
| `timeout_sec` | 120 | batas waktu total per request |
| `max_retries` | 2 | repair setelah gagal validasi; HTTP 408/429/5xx di-retry dengan backoff 2 s / 8 s; koneksi gagal tidak di-retry |
| `prompt_version` | `narrative-gemini-v1` | ikut kunci cache |
| `max_student_concepts` / `max_class_concepts` / `max_gaps` / `max_recommendations` | 12 / 11 / 5 / 5 | batas ukuran fakta |
| `max_examples` | 1 | contoh few-shot per request (maks. 2) |
| `cache_dir` / `cache_ttl_hours` | `artifacts/reports/cache` / 168 | kunci = sha256(fakta + audiens + prompt_version + model) |
| `log_path` | `artifacts/reports/narrative_log.jsonl` | audit log |

Variabel lingkungan: `GEMINI_API_KEY`, `CDACDM_LLM_CONFIG` (path config lain). Kunci lama dari `slm.json`
(`base_url`, `allow_remote`, `connect_timeout_sec`) diabaikan dengan peringatan. Generator di aplikasi di-cache
(`st.cache_resource`): setelah mengubah `llm.json` atau mengisi API key, restart Streamlit.

## Validator (hard fail)

Teks LLM hanya ditampilkan bila lolos semua pemeriksaan; jika tidak, diminta perbaikan (maks. `max_retries`), lalu
jatuh ke template deterministik (`fallback`), yang juga lolos validator.

1. **Angka**: setiap angka di teks harus berasal dari fakta JSON (bilangan bulat apa adanya; 1–2 desimal dengan titik
   atau koma; proporsi 0–1 sebagai persen, dengan `%` atau "persen"; pemisah ribuan `28.003`). Daftar bernomor ditolak.
   **Angka per konsep**: pada baris yang menyebut nama konsep, angkanya harus milik konsep itu (atau fakta global: τ, n_min,
   jumlah siswa/konsep/respons).
2. **Heading wajib** per audiens (guru: Ringkasan kelas, Temuan utama, Konsep prioritas, Rekomendasi tindakan,
   Keterbatasan dan catatan; siswa: Ringkasan, Yang sudah dikuasai, Yang perlu dilatih, Langkah belajar, Catatan).
3. **Placeholder**: jika ada rekomendasi placeholder, teks wajib memuat "placeholder" atau "perlu validasi".
4. **Klaim terlarang**: terbukti, pasti mastered, dijamin, efektif meningkatkan, menyembuhkan, siswa malas, guru gagal.
5. **Konsep**: nama konsep checkpoint yang tidak ada di fakta ditolak.
6. **Panjang** 120–900 kata; tanpa HTML.

Output yang terpotong (`finish_reason=MAX_TOKENS`) atau kosong (mis. `SAFETY`) ditolak seperti gagal validasi.

## Privasi

* Fakta **dikirim ke server Google** (Gemini API). Fakta tidak memuat matriks respons, `UserId` asli, nama, atau sekolah.
  Siswa selalu disebut `Siswa-<sha256[:8]>`; laporan guru hanya memuat agregat kelas (kecuali tombol *Jelaskan
  rekomendasi*, yang memuat satu siswa terpilih dengan ID pseudonim).
* **Perhatikan tier API**: menurut ketentuan Gemini API, data pada tier *gratis* dapat dipakai Google untuk
  meningkatkan produk; tier berbayar tidak. Untuk data kelas nyata, pakai project dengan billing aktif dan cek ketentuan
  terbaru di AI Studio serta kebijakan sekolah/etika penelitian.
* Audit log berisi waktu, audiens, model, prompt_version, hash input, cache_hit, latensi, jumlah percobaan, status
  validasi, fallback, alasan, dan usage token (termasuk `thinking_tokens`). **Tidak** ada teks laporan, ID siswa, maupun
  API key.
* Cache disk menyimpan teks laporan tervalidasi (dengan ID pseudonim) di `artifacts/reports/cache`; hapus folder ini untuk
  membersihkannya.

## Troubleshooting

| Gejala | Penyebab / solusi |
|---|---|
| Alasan *API key Gemini belum di-set* | set `GEMINI_API_KEY` di environment atau di `.env` proyek, lalu restart Streamlit |
| Alasan *paket google-genai belum terinstal* | `pip install -r requirements.txt` |
| Alasan *Gemini HTTP 400/403* | key salah/tidak aktif atau API belum diaktifkan untuk project |
| Alasan *Gemini HTTP 404* | ID model salah/tidak tersedia untuk key ini: cek daftar model di AI Studio, ubah `model` di `llm.json` |
| Alasan *Gemini HTTP 429* | kuota/rate limit habis; tunggu atau aktifkan billing |
| Alasan *Gemini API tidak dapat dihubungi* / *Gemini timeout* | tidak ada internet / proxy; atau naikkan `timeout_sec` |
| Alasan *output LLM terpotong (MAX_TOKENS)* | naikkan `max_tokens` atau set `thinking_level` ke `low` |
| Alasan *unexpected LLM error* | biasanya versi `google-genai` terlalu lama untuk `thinking_level`: `pip install -U google-genai` |
| Alasan *circuit breaker open* | 3 kegagalan berturut-turut; request dilewati 60 detik, lalu dicoba lagi |
| Alasan *validation failed: angka …* | model mengarang/membulatkan angka; template ditampilkan. Pantau dengan `scripts/eval_narrative.py` |
| Ubah config tidak berpengaruh | restart Streamlit (generator di-cache) |

## Batasan

* Baru satu smoke test ke API (27-10-2026, `gemini-3.1-flash-lite`, 2 siswa sintetis): lolos validator pada percobaan
  pertama, ±7 detik. Ini bukan evaluasi kualitas; hasil uji SLM lokal sebelumnya tidak berlaku untuk Gemini. Jalankan `scripts/eval_narrative.py` untuk mengukur pass rate, latensi, dan token.
* Validator mencegah angka/klaim yang tidak berdasar, tetapi tidak menjamin ketepatan pedagogis. Laporan adalah draf
  untuk guru.
* Mastery adalah estimasi model; rekomendasi placeholder perlu validasi guru; tidak ada klaim efektivitas intervensi.
* Bergantung pada internet, kuota, dan ketersediaan model preview (ID model preview dapat berubah/dihentikan).

## Evaluasi antar-model

`scripts/eval_narrative.py --models gemini-3.1-flash-lite <model-lain> --cases 10` memanggil generator yang sama
dengan aplikasi: pass rate percobaan pertama vs setelah repair, jenis pelanggaran, latensi, token (termasuk thinking).
Setiap case = request berbayar/berkuota (×2 mode).
