"""Generate cda_cdm_model_training.ipynb (run: python scripts/build_notebook.py)."""
from pathlib import Path

import nbformat as nbf

ROOT = Path(__file__).resolve().parent.parent
nb = nbf.v4.new_notebook()
C = []


def md(s):
    C.append(nbf.v4.new_markdown_cell(s.strip()))


def code(s):
    C.append(nbf.v4.new_code_cell(s.strip()))


md(r"""
# CDA-CDM model training & evaluation — learning-gap diagnosis (EEDI Task 3/4 development data)

Notebook ini menjalankan pipeline **end-to-end**: audit artefak data preparation → analisis Q-matrix & pemetaan konsep target →
training **probabilistic DINA (variational EM)** + baseline → pemilihan hyperparameter & kebijakan diagnosis di **validation** →
evaluasi **satu kali** di **test** → CDA (fixed / parallel / adaptif) → profil mastery, learning gap, rekomendasi intervensi →
demo pre/post **sintetis** → penyimpanan checkpoint untuk aplikasi Streamlit.

**Disiplin data**

| Komponen | Dipelajari dari |
|---|---|
| parameter soal (g, s), prior mastery, class weight | train (3.934 siswa) |
| hyperparameter, threshold τ, n_min, δ | validation (492 siswa) |
| metrik akhir | test (492 siswa), sekali, semua parameter dibekukan |

> EEDI NeurIPS 2020 Task 3/4 adalah **dataset pengembangan**: mayoritas siswa sekolah menengah pertama di UK, hanya segelintir
> berusia 16-17 tahun. Hasil di sini **bukan** validasi pada kelas SMA penelitian.
""")

code(r"""
# 0. setup (Colab atau lokal)
import os, sys, json
from pathlib import Path
IN_COLAB = "google.colab" in sys.modules
if IN_COLAB:
    from google.colab import drive
    drive.mount("/content/drive")
    # folder proyek ini (berisi cdacdm/, configs/, app.py) yang sudah di-upload ke Drive
    PROJECT_DIR = Path("/content/drive/MyDrive/ILCDA/cda_cdm_project")
    os.chdir(PROJECT_DIR)
    !pip -q install -r requirements.txt
else:
    PROJECT_DIR = Path.cwd()
sys.path.insert(0, str(PROJECT_DIR))
# opsional: paksa lokasi data / output
# os.environ["CDACDM_DATA_DIR"] = "/content/drive/MyDrive/ILCDA/processed_task34_cda_cdm/final"
# os.environ["CDACDM_OUTPUT_DIR"] = str(PROJECT_DIR / "artifacts")
import numpy as np, pandas as pd
from IPython.display import display, Image, Markdown
pd.set_option("display.max_columns", 40); pd.set_option("display.width", 220)
print("project:", PROJECT_DIR, "| colab:", IN_COLAB)
""")

code(r"""
# 1. konfigurasi + deteksi otomatis lokasi artefak
from cdacdm.config import load_config, resolve_data_dir, check_artifact_presence
cfg = load_config()                        # configs/experiment.json
data_dir = resolve_data_dir(cfg)
print("data_dir:", data_dir)
display(pd.DataFrame(check_artifact_presence(data_dir)).T)
""")

md(r"""
## Model: probabilistic DINA dengan variational EM

Untuk siswa $i$, soal $j$, konsep $k$, dan Q-matrix biner $q_{jk}$:

$$\alpha_{ik}\sim\text{Bernoulli}(\lambda_{ik}),\qquad \eta_{ij}=\prod_k \alpha_{ik}^{q_{jk}},\qquad
P(X_{ij}=1\mid\boldsymbol\alpha_i)=(1-s_j)^{\eta_{ij}}\,g_j^{\,1-\eta_{ij}}$$

dengan $g_j\sim\text{Beta}$, $s_j\sim\text{Beta}$ (regularisasi soal yang jarang dijawab) dan kendala $g_j+s_j<1$.
Prior mastery: *independent* ($\lambda_{ik}=\lambda_k$) atau *higher-order* ($\lambda_{ik}=\sigma(a_k\theta_i-b_k)$, $\theta_i\sim N(0,1)$);
pilihan ditentukan di validation.

**Inferensi tanpa enumerasi $2^{57}$.** Keluarga variasional $q(\boldsymbol\alpha_i)=\prod_k\text{Bern}(\pi_{ik})$ memberi
$P_q(\eta_{ij}=1)=\rho_{ij}=\prod_k\pi_{ik}^{q_{jk}}$, sehingga ELBO tertutup:

$$\mathcal L=\sum_{ij} m_{ij}w_{ij}\big[\rho_{ij}\ell^1_{ij}+(1-\rho_{ij})\ell^0_{ij}\big]-\sum_{ik}\text{KL}\big(\text{Bern}(\pi_{ik})\,\|\,\text{Bern}(\lambda_{ik})\big)$$

$\ell^1=x\log(1-s)+(1-x)\log s$, $\ell^0=x\log g+(1-x)\log(1-g)$, **$m_{ij}$ = mask respons teramati** (soal yang tidak
dikerjakan tidak masuk likelihood, tidak dianggap salah), $w_{ij}$ = bobot kelas opsional. Update koordinat:

$$\operatorname{logit}\pi_{ik}=\operatorname{logit}\lambda_{ik}+\sum_j m_{ij}w_{ij}q_{jk}\frac{\rho_{ij}}{\pi_{ik}}\big(\ell^1_{ij}-\ell^0_{ij}\big)$$

Untuk soal satu-konsep ($\rho/\pi=1$) update ini adalah Bayes eksak; M-step $g,s$ tertutup (MAP Beta). **$\pi_{ik}$ adalah probabilitas
penguasaan** yang dilaporkan. Siswa baru: hanya E-step dengan $g,s,\lambda$ dibekukan — tanpa retraining. Konsep tanpa bukti kembali ke prior
dan diberi label *insufficient_evidence*.
""")

code(r"""
# 2. audit artefak: struktur, tipe data, indeks, encoding missing, alignment npz vs csv, leakage
from cdacdm.pipeline import Pipeline
p = Pipeline()
data_summary = p.step_audit()
audit = json.loads((p.out / "audit/data_audit.json").read_text())
display(pd.DataFrame({s: {"n_students": a["n_students"], "expected": a["expected_students"], "observed_cells": a["observed_cells"],
                          "density": round(a["matrix_density"], 4), "source_used": a["source_used"],
                          "npz_missing_scheme": a.get("npz_encoding", {}).get("missing_scheme"),
                          "npz_csv_aligned": a.get("alignment_npz_vs_csv", {}).get("aligned"),
                          "dup_user_question": a["interactions"]["duplicate_user_question_pairs"]}
                      for s, a in audit["splits"].items()}).T)
leak = json.loads((p.out / "audit/leakage_audit.json").read_text())["train"]["roles"]
display(pd.Series(leak, name="role").to_frame())
""")

md("""
**Catatan audit notebook data preparation.** `eedi_task34_cda_cdm_pipeline.ipynb` memanggil `run_pipeline()` (cell 4) tetapi fungsi itu
**tidak didefinisikan** di notebook, sehingga data preparation tidak dapat direproduksi dari notebook saja. Bila artefak Drive tidak
tersedia, `python -m cdacdm.reconstruct` membangun ulang artefak dengan skema yang sama dari arsip resmi (ditandai
`artifact_source = local_reconstruction`). Rekonstruksi lokal mereproduksi class weight & train correct rate notebook hingga 16 digit,
yang mengindikasikan split identik.
""")

code(r"""
# 3. Q-matrix, konsep target, audit soal fokus
qsum, tinfo, fsum = p.step_concepts()
display(pd.read_csv(p.out / "audit/concept_item_counts.csv").sort_values("n_items"))
display(pd.read_csv(p.out / "audit/multi_concept_items.csv"))
fa = pd.read_csv(p.out / "audit/focus_item_audit.csv")
display(fa["label_match"].value_counts().to_frame())
display(fa[fa["content_reviewed"]][["QuestionId", "concept_names", "label_match", "estimated_level", "content_summary"]])
""")

code(r"""
# 4. training di train + pemilihan hyperparameter di validation (P-DINA grid + baseline Q-matrix)
hp = p.step_model_selection()
display(hp.sort_values("val_log_loss")[["model", "n_em_iter", "fit_sec", "val_log_loss", "val_roc_auc", "val_brier", "val_ece"]])
print("model utama:", p.main_key)
""")

code(r"""
# 5. kebijakan diagnosis dari validation: threshold tau (one-SE rule), n_min dan delta (konsistensi split-half)
policy = p.step_policy()
display(pd.read_csv(p.out / "evaluation/threshold_selection_validation.csv"))
display(pd.read_csv(p.out / "evaluation/consistency_by_evidence_validation.csv"))
display(pd.read_csv(p.out / "evaluation/consistency_by_band_validation.csv"))
display(Image(str(p.out / "evaluation/figures/threshold_selection.png")))
""")

code(r"""
# 6. evaluasi test - SEKALI (pemanggilan kedua ditolak oleh pipeline)
tm = p.step_test_evaluation()
display(tm.drop(columns=["config"]))
display(pd.read_csv(p.out / "evaluation/test_model_differences.csv"))
display(Image(str(p.out / "evaluation/figures/calibration_test.png")))
pc = pd.read_csv(p.out / "evaluation/per_concept_test_main.csv")
display(pc[pc["is_target"]])
display(Image(str(p.out / "evaluation/figures/per_concept_auc_target.png")))
""")

code(r"""
# 7. proksi kualitas diagnosis (tidak ada ground-truth mastery di EEDI)
p.step_diagnosis_quality()
display(pd.read_csv(p.out / "evaluation/consistency_by_concept_test.csv"))
display(pd.read_csv(p.out / "evaluation/simulation_mastery_recovery.csv"))
""")

code(r"""
# 8. CDA: kecukupan soal, fixed form, parallel forms, replay adaptif, cakupan kurikulum
p.step_assessment()
display(pd.read_csv(p.out / "assessment/concept_item_adequacy.csv"))
display(pd.read_csv(p.out / "assessment/fixed_form.csv")[["position", "QuestionId", "concept_names", "model_difficulty", "discrimination", "guess", "slip"]])
display(pd.read_csv(p.out / "assessment/parallel_forms_balance.csv"))
rs = p.out / "evaluation/adaptive_replay_summary.csv"
if rs.exists():
    display(pd.read_csv(rs)); display(Image(str(p.out / "evaluation/figures/adaptive_replay.png")))
display(pd.read_csv(p.out / "audit/coverage_report.csv"))
display(pd.read_csv(p.out / "audit/unmapped_target_topics.csv"))
""")

code(r"""
# 9. profil mastery, learning gap, agregasi kelas, rekomendasi intervensi (siswa test, parameter beku)
p.step_diagnose_test()
display(pd.read_csv(p.out / "diagnosis/test_class_gap_summary.csv"))
display(Image(str(p.out / "evaluation/figures/test_mastery_labels_by_concept.png")))
display(pd.read_csv(p.out / "diagnosis/test_learning_gaps.csv").head(10))
display(pd.read_csv(p.out / "intervention/test_intervention_recommendations.csv").head(5).T)
""")

code(r"""
# 10. demo pre/post dengan data SINTETIS (bukan hasil eksperimen, bukan siswa EEDI)
p.step_prepost_demo()
rep = json.loads((p.out / "prepost/SYNTHETIC_prepost_report.json").read_text())
print(rep["LABEL"]); print(rep["summary"]["interpretation_guard"])
display(pd.read_csv(p.out / "prepost/SYNTHETIC_concept_changes.csv"))
print("simulation check:", rep["simulation_check"])
""")

code(r"""
# 11. simpan checkpoint + ringkasan
p.step_save()
for f in sorted((p.out / "model").iterdir()):
    print(f"{f.name:40s} {f.stat().st_size/1024:8.1f} KB")
""")

md("""
## Inference API (tanpa retraining)

`predict_mastery()`, `select_assessment()`, `detect_learning_gaps()`, `recommend_intervention()`, `compare_pre_post()` memuat checkpoint
dan hanya menjalankan E-step dengan parameter soal yang dibekukan.
""")

code(r"""
from cdacdm.api import load_model, predict_mastery, select_assessment, detect_learning_gaps, recommend_intervention, compare_pre_post
svc = load_model(p.out)
# siswa baru dengan jawaban parsial: 3 soal dijawab, 1 dikosongkan (tidak dianggap salah)
form = svc.forms["fixed"]
new = {"SISWA-BARU-01": {int(q): r for q, r in zip(form["QuestionId"][:4], [1, 0, 1, None])}}
prof = predict_mastery(new, service=svc, only_target=True)
display(prof[["student_id", "concept_name", "mastery_prob", "mastery_label", "n_evidence", "posterior_sd"]])
gaps = detect_learning_gaps(prof, service=svc)
display(gaps[["concept_name", "gap_status", "mastery_prob", "n_evidence", "priority_score"]])
display(recommend_intervention(gaps, service=svc)[["concept_name", "recommended_action", "is_placeholder", "rule_trace"]])
""")

code(r"""
# sesi adaptif: jawaban disimulasikan dari respons nyata seorang siswa test (hanya soal yang ia kerjakan)
te = p.bundle.splits["test"]
i = int(np.argmax(te.M[:, svc.items["eligible_target_item"].to_numpy()].sum(1)))
answers = {int(q): te.X[i, j] for j, q in enumerate(svc.question_ids) if te.M[i, j]}
sess = select_assessment("adaptive", service=svc, max_length=12)
sess.pool &= set(answers)
sess.run_with_oracle(lambda q: answers[q])
print("soal yang dipilih:", sess.administered)
display(pd.DataFrame({"concept": [svc.concept_names[list(svc.concept_ids).index(c)] for c in svc.policy.target_concept_ids],
                      "pi": [sess.post.pi[0, list(svc.concept_ids).index(c)] for c in svc.policy.target_concept_ids],
                      "n_evidence": [sess.post.n_evidence[0, list(svc.concept_ids).index(c)] for c in svc.policy.target_concept_ids]}))
""")

md("""
## Yang membutuhkan data kelas nyata

`compare_pre_post(pre, post, service=svc)` siap dipakai, tetapi hasil penelitian **baru dapat dihasilkan setelah** tersedia:

1. CSV pre-test dan post-test format panjang `student_id,QuestionId,response` (1/0/kosong) atau `answer_option` (1-4), dengan
   `student_id` yang sama di kedua tes; opsional kolom `group` (treatment/control).
2. Soal yang dipakai harus ada di item bank model (gunakan `assessment/parallel_form_A.csv` & `parallel_form_B.csv`, atau form sama).
   Jika kelas penelitian memakai soal SMA baru (aljabar lanjut / kalkulus), soal tersebut **harus dipetakan ke Q-matrix dan
   parameternya dikalibrasi** dulu — EEDI tidak memiliki konsep kalkulus (lihat `audit/unmapped_target_topics.csv`).
3. Tanpa kelompok kontrol, hasil dilaporkan sebagai *perubahan yang teramati setelah intervensi*, bukan efek kausal.
""")

nb["cells"] = C
nb["metadata"] = {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
                  "language_info": {"name": "python"}, "colab": {"provenance": []}}
nbf.write(nb, ROOT / "cda_cdm_model_training.ipynb")
print("written", ROOT / "cda_cdm_model_training.ipynb")
