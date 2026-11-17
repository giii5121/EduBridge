"""Streamlit demo & testing UI for the CDA/CDM learning-gap pipeline.

    streamlit run app.py

The app only LOADS the trained checkpoint (artifacts/model); it never retrains. Set
CDACDM_ARTIFACT_DIR to point at another artifacts folder (e.g. on Google Drive).
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import uuid
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from cdacdm.assessment import AdaptiveSession
from cdacdm.config import PROJECT_ROOT
from cdacdm.prepost import compare_pre_post
from cdacdm.responses import ResponseValidationError
from cdacdm.service import CDMService, CheckpointNotFoundError, checkpoint_status, default_artifact_dir
from cdacdm.synthetic import generate_synthetic_prepost

st.set_page_config(page_title="CDA-CDM Learning Gap", page_icon="📐", layout="wide")

STATUS_COLORS = {"mastered": "#0ca30c", "uncertain": "#fab219", "not_mastered": "#d03b3b", "insufficient_evidence": "#b5b3ab"}
LABEL_ID = {"mastered": "Dikuasai", "uncertain": "Belum pasti", "not_mastered": "Belum dikuasai (gap)",
            "insufficient_evidence": "Bukti belum cukup"}
SEQ_BLUE = [[0.0, "#cde2fb"], [0.25, "#86b6ef"], [0.5, "#3987e5"], [0.75, "#1c5cab"], [1.0, "#0d366b"]]
DIVERGING = [[0.0, "#d03b3b"], [0.5, "#f0efec"], [1.0, "#2a78d6"]]
PAGES = ["Dashboard", "Student Assessment", "Learning Gap Analysis", "Intervention Recommendations", "Pre-test vs Post-test", "Model & Data"]

st.markdown("""
<style>
.block-container {padding-top: 1.6rem; max-width: 1350px;}
div[data-testid="stMetricValue"] {font-size: 1.5rem;}
.badge {display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.78rem;font-weight:600;margin-right:4px;}
.sim {background:#fff3d6;color:#5a3d00;border:1px solid #fab219;}
.real {background:#e6f0fc;color:#0d366b;border:1px solid #86b6ef;}
.note {color:#52514e;font-size:0.86rem;}
</style>
""", unsafe_allow_html=True)


# ---------------------------------------------------------------------------- loading (cached)
@st.cache_resource(show_spinner="Memuat checkpoint model ...")
def load_service(artifact_dir: str):
    return CDMService.load(artifact_dir)


@st.cache_data(show_spinner=False)
def read_csv_cached(path: str, mtime: float):
    return pd.read_csv(path)


def art_csv(svc_dir: Path, rel: str):
    p = Path(svc_dir) / rel
    return read_csv_cached(str(p), p.stat().st_mtime) if p.exists() else None


def art_json(svc_dir: Path, rel: str):
    p = Path(svc_dir) / rel
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


# checkpoints shipped with the project; CDACDM_ARTIFACT_DIR overrides the choice (e.g. a Drive folder)
CHECKPOINTS = {"Kalkulus kelas XI (DUMMY sintetis)": PROJECT_ROOT / "artifacts_calculus",
               "EEDI Task 3/4 (aljabar SMP, data nyata)": PROJECT_ROOT / "artifacts"}
ENV_DIR = os.environ.get("CDACDM_ARTIFACT_DIR")

with st.sidebar:
    st.markdown("### 📐 CDA-CDM Learning Gap")
    page = st.radio("Halaman", PAGES, label_visibility="collapsed")
    st.divider()
    if ENV_DIR:
        ARTIFACT_DIR = str(Path(ENV_DIR))
    else:
        ready = {k: str(v) for k, v in CHECKPOINTS.items() if checkpoint_status(v)["ready"]}
        if ready:
            ckpt = st.selectbox("Checkpoint model", list(ready), help="Model dimuat dari checkpoint; tidak ada training ulang.")
            ARTIFACT_DIR = ready[ckpt]
        else:
            ARTIFACT_DIR = str(default_artifact_dir())
    if st.session_state.get("_ckpt") != ARTIFACT_DIR:   # results of another model must not leak into this one
        for k in ["result", "pp", "pp_post", "pp_label", "adaptive"] + [k for k in st.session_state if str(k).startswith("narrative:")]:
            st.session_state.pop(k, None)
        st.session_state["_ckpt"] = ARTIFACT_DIR
    status = checkpoint_status(ARTIFACT_DIR)
    st.caption(f"Artifacts: `{ARTIFACT_DIR}`")

if not status["ready"]:
    st.title("CDA-CDM Learning Gap")
    st.error("Checkpoint model belum tersedia, jadi aplikasi tidak membuat prediksi apa pun.")
    st.warning(f"File yang belum ada di `{status['model_dir']}`: {', '.join(status['missing'])}")
    st.info("Selesaikan training terlebih dahulu: jalankan `python -m cdacdm.pipeline` atau notebook "
            "`cda_cdm_model_training.ipynb`, lalu muat ulang halaman ini. Untuk folder lain, set variabel "
            "lingkungan `CDACDM_ARTIFACT_DIR`.")
    st.stop()

try:
    svc = load_service(ARTIFACT_DIR)
except Exception as e:  # noqa: BLE001
    st.error(f"Checkpoint ditemukan tetapi gagal dimuat: {e}")
    st.stop()

ART = Path(ARTIFACT_DIR)
card = svc.model_card
SRC = str(card.get("data", {}).get("artifact_source", "unknown"))
IS_DUMMY = "dummy" in SRC.lower()
DEMO_LABEL = "Siswa test split (DUMMY sintetis)" if IS_DUMMY else "Siswa demo (EEDI test split)"
DEMO_BADGE = ("Respons SINTETIS siswa test split kalibrasi (bukan siswa nyata)" if IS_DUMMY
              else "Respons nyata siswa EEDI (test split, ID anonim)")
CLASS_PRE, CLASS_POST = ART / "class_dummy/DUMMY_pretest_kelasXI.csv", ART / "class_dummy/DUMMY_posttest_kelasXI.csv"
HAS_CLASS = CLASS_PRE.exists() and CLASS_POST.exists()
CLASS_LABEL = "Kelas dummy XI-A / XI-B"
POP_NOTE = card.get("data", {}).get("population_note") or card.get("data", {}).get("eedi_population_note", "")
ITEMS_BY_Q = svc.items.set_index("QuestionId")
names_by_id = dict(zip(svc.concept_ids.tolist(), svc.concept_names))
target_ids = [int(c) for c in svc.policy.target_concept_ids]

with st.sidebar:
    st.success("Model termuat (tanpa training ulang)")
    st.caption(f"Model: `{card.get('model_selection', {}).get('main_model', 'P-DINA')}`")
    src = card.get("data", {}).get("artifact_source", "unknown")
    st.caption(f"Sumber data training: **{src}**")
    with st.expander("Kebijakan diagnosis", expanded=False):
        st.caption("Nilai default dipilih pada validation set. Mengubahnya hanya untuk analisis sensitivitas.")
        tau = st.slider("Threshold mastery τ", 0.3, 0.8, float(svc.policy.tau), 0.05)
        delta = st.slider("Pita ketidakpastian δ", 0.0, 0.3, float(svc.policy.delta), 0.05)
        n_min = st.number_input("Bukti minimum n_min", 1, 10, int(svc.policy.n_min))
    policy = svc.policy_with(tau, delta, n_min)
    if (tau, delta, n_min) != (svc.policy.tau, svc.policy.delta, svc.policy.n_min):
        st.sidebar.warning("Kebijakan berbeda dari nilai terpilih validation set.")


# ---------------------------------------------------------------------------- helpers
def badge(text, kind="real"):
    return f"<span class='badge {kind}'>{text}</span>"


@st.cache_data(show_spinner=False)
def demo_data(path: str, mtime: float):
    return pd.read_csv(path, dtype={"student_id": str})


def get_demo():
    for name in ["demo/test_split_responses.csv", "demo/eedi_test_split_responses.csv"]:
        p = ART / name
        if p.exists():
            return demo_data(str(p), p.stat().st_mtime)
    return None


@st.cache_data(show_spinner=False)
def class_data(path: str, mtime: float):
    return pd.read_csv(path, dtype=str, keep_default_na=False)


def get_class(which="pre"):
    p = CLASS_PRE if which == "pre" else CLASS_POST
    return class_data(str(p), p.stat().st_mtime)


def run_diagnosis(responses: pd.DataFrame, label: str):
    try:
        res = svc.diagnose(responses, policy)
    except ResponseValidationError as e:
        st.error(f"Input respons tidak valid: {e}")
        return None
    res["source_label"] = label
    res["run_id"] = uuid.uuid4().hex       # identifies this diagnosis for stored narratives
    st.session_state["result"] = res
    return res


def mastery_bar(prof: pd.DataFrame, title: str):
    d = prof[prof["is_target_concept"]].sort_values("mastery_prob")
    fig = go.Figure()
    for lab, color in STATUS_COLORS.items():
        s = d[d["mastery_label"] == lab]
        if len(s):
            fig.add_bar(y=s["concept_name"], x=s["mastery_prob"], orientation="h", name=LABEL_ID[lab], marker_color=color,
                        customdata=np.stack([s["n_evidence"], s["n_correct"], s["posterior_sd"]], axis=1),
                        hovertemplate="%{y}<br>P(mastery)=%{x:.2f}<br>bukti=%{customdata[0]} (benar %{customdata[1]})"
                                      "<br>sd=%{customdata[2]:.2f}<extra></extra>")
    fig.add_vline(x=policy.tau, line_dash="dash", line_color="#898781", annotation_text=f"τ={policy.tau:.2f}")
    fig.update_layout(title=title, barmode="overlay", xaxis=dict(range=[0, 1], title="Probabilitas penguasaan (model)"),
                      height=max(320, 34 * len(d) + 120), margin=dict(l=10, r=10, t=50, b=10), legend=dict(orientation="h", y=-0.15))
    return fig


def download_buttons(res: dict, prefix: str, prepost=None):
    c1, c2, c3 = st.columns(3)
    c1.download_button("⬇ Profil mastery (CSV)", res["profiles"].to_csv(index=False).encode(), f"{prefix}_mastery_profiles.csv", "text/csv")
    c2.download_button("⬇ Learning gap + rekomendasi (CSV)",
                       res["recommendations"].to_csv(index=False).encode() if len(res["recommendations"]) else res["gaps"].to_csv(index=False).encode(),
                       f"{prefix}_gaps_recommendations.csv", "text/csv")
    rep = svc.report_json(res, prepost)
    c3.download_button("⬇ Laporan ringkas (JSON)", json.dumps(rep, indent=2, ensure_ascii=False, default=str).encode(), f"{prefix}_report.json",
                       "application/json")


# ---------------------------------------------------------------------------- optional narrative layer (Gemini API)
NARRATIVE_DISCLAIMER = "Estimasi model, bukan mastery terverifikasi. Rekomendasi placeholder perlu validasi guru."


@st.cache_resource(show_spinner=False)
def get_narrative_generator(config_path: str):
    """One Gemini API client + circuit breaker per config; the model runs at Google, never here."""
    from cdacdm.narrative import NarrativeGenerator, load_narrative_config
    try:
        return NarrativeGenerator(load_narrative_config(config_path or None))
    except (ValueError, OSError):
        return None       # svc.generate_narrative reloads the config and returns the template with the reason


class _NarrativeFallback(Exception):
    """Raised inside the cached call so template results are not cached (the API may be back next click)."""

    def __init__(self, out):
        super().__init__("fallback")
        self.out = out


@st.cache_data(show_spinner=False, max_entries=64)
def narrative_cached(facts_key: str, _result: dict, audience: str, student_id):
    out = svc.generate_narrative(_result, audience, student_id,
                                 generator=get_narrative_generator(os.environ.get("CDACDM_LLM_CONFIG", "")))
    if out["fallback"]:
        raise _NarrativeFallback(out)
    return out


def render_narrative(result: dict, audience: str, student_id=None, key: str = "teacher", label: str = "Buat ringkasan naratif"):
    """Button -> Indonesian narrative of the diagnosis (validated LLM text or deterministic template)."""
    skey = f"narrative:{key}"
    sig = (result.get("run_id", id(result)), audience, None if student_id is None else str(student_id))
    with st.container(border=True):
        st.markdown("**Laporan naratif** (opsional, Gemini API; ID siswa dipseudonimkan)")
        if st.button(label, key=f"btn_{skey}"):
            with st.spinner("Menyusun laporan..."):
                try:
                    facts = svc.narrative_facts(result, audience, student_id)
                    fk = hashlib.sha256((ARTIFACT_DIR + facts.canonical_json()).encode("utf-8")).hexdigest()
                    try:
                        out = narrative_cached(fk, result, audience, student_id)
                    except _NarrativeFallback as e:
                        out = e.out
                    st.session_state[skey] = {"sig": sig, "out": out}
                except Exception as e:  # noqa: BLE001 - the narrative is optional; never break the page
                    st.warning(f"Laporan naratif tidak dapat dibuat: {e}")
        stored = st.session_state.get(skey)
        if stored is not None and stored["sig"] == sig:
            out, meta = stored["out"], stored["out"]["meta"]
            if out["fallback"]:
                st.warning("Laporan dibuat dengan template karena layanan LLM (Gemini API) tidak tersedia.")
                if meta.get("reason"):
                    st.caption(f"Alasan: {meta['reason']}")
            st.markdown(out["text"])
            st.caption(f"Model: {meta['model']} · prompt {meta['prompt_version']} · {meta['latency_ms']} ms"
                       + (" · cache" if meta.get("cache_hit") else ""))
            st.download_button("⬇ Laporan naratif (.md)", out["text"].encode("utf-8"), f"laporan_{key}.md", "text/markdown",
                               key=f"dl_{skey}")
        st.caption(NARRATIVE_DISCLAIMER)


def show_student_result(res: dict, student_id: str):
    prof = res["profiles"]
    p = prof[(prof["student_id"].astype(str) == str(student_id)) & prof["is_target_concept"]]
    counts = p["mastery_label"].value_counts()
    c = st.columns(5)
    c[0].metric("Konsep target", len(p))
    c[1].metric("Dikuasai", int(counts.get("mastered", 0)))
    c[2].metric("Learning gap", int(counts.get("not_mastered", 0)))
    c[3].metric("Belum pasti", int(counts.get("uncertain", 0)))
    c[4].metric("Bukti belum cukup", int(counts.get("insufficient_evidence", 0)))
    st.plotly_chart(mastery_bar(p, f"Profil penguasaan konsep target - {student_id}"), use_container_width=True)
    g = res["gaps"]
    g = g[g["student_id"].astype(str) == str(student_id)]
    l, r = st.columns([3, 2])
    with l:
        st.markdown("**Ranking learning gap** (status → prioritas = kebutuhan × kepastian)")
        gg = g[g["gap_status"] != "needs_more_data"]
        if len(gg):
            st.dataframe(gg[["rank_within_student", "concept_name", "gap_status", "mastery_prob", "n_evidence", "posterior_sd", "priority_score"]]
                         .rename(columns={"rank_within_student": "rank"}), hide_index=True, use_container_width=True)
        else:
            st.info("Tidak ada konsep target dengan bukti cukup yang berada di bawah threshold.")
    with r:
        st.markdown("**Belum dapat didiagnosis** (bukti < n_min)")
        ins = p[p["mastery_label"] == "insufficient_evidence"][["concept_name", "n_evidence", "mastery_prob"]]
        st.dataframe(ins.rename(columns={"mastery_prob": "prior/posterior"}), hide_index=True, use_container_width=True)
        st.caption("Konsep ini butuh soal tambahan; nilainya didominasi prior, bukan bukti siswa.")
    with st.expander("Tabel profil lengkap (semua konsep target)"):
        st.dataframe(p.drop(columns=["is_target_concept"]), hide_index=True, use_container_width=True)


def form_editor(form: pd.DataFrame, key: str, student_label="S001"):
    cols = ["position", "QuestionId"] + (["question_text"] if "question_text" in form.columns else []) + ["concept_names", "model_difficulty"]
    base = form[cols].copy()
    base.insert(0, "student_id", student_label)
    base["response"] = ""
    ed = st.data_editor(base, key=key, hide_index=True, use_container_width=True,
                        column_config={"response": st.column_config.SelectboxColumn("response", options=["", "1", "0"],
                                                                                    help="1 = benar, 0 = salah, kosong = tidak dijawab")},
                        disabled=cols)
    return ed[["student_id", "QuestionId", "response"]]


# ============================================================================ pages
if page == "Dashboard":
    st.title("Dashboard")
    st.markdown(badge("Model: P-DINA variational EM") + badge(f"Data training: {SRC}", "sim" if IS_DUMMY else "real"), unsafe_allow_html=True)
    if IS_DUMMY:
        st.warning("Checkpoint ini dilatih dengan data DUMMY/SINTETIS (skenario kalkulus kelas XI). Semua metrik di bawah hanya "
                   "menguji jalannya pipeline, bukan hasil penelitian.")
    adequacy = art_csv(ART, "assessment/concept_item_adequacy.csv")
    n_diag = int(adequacy["adequate_for_single_form"].sum()) if adequacy is not None else None
    n_par = int(adequacy["adequate_for_parallel_forms"].sum()) if adequacy is not None else None
    c = st.columns(5)
    c[0].metric("Status model", "Siap")
    c[1].metric("Soal di item bank", len(svc.question_ids))
    c[2].metric("Konsep (total / target)", f"{len(svc.concept_ids)} / {len(target_ids)}")
    c[3].metric("Konsep target dapat didiagnosis", f"{n_diag}/{len(target_ids)}" if n_diag is not None else "-")
    c[4].metric("Cukup untuk parallel forms", f"{n_par}/{len(target_ids)}" if n_par is not None else "-")

    st.subheader("Evaluasi prediksi respons (test set, dihitung saat training)")
    tm = art_csv(ART, "evaluation/test_metrics.csv")
    if tm is None:
        st.warning("evaluation/test_metrics.csv tidak ditemukan.")
    else:
        show = tm[["model", "roc_auc", "roc_auc_ci95", "log_loss", "brier", "accuracy", "precision", "recall", "f1", "ece", "n"]]
        st.dataframe(show, hide_index=True, use_container_width=True,
                     column_config={c: st.column_config.NumberColumn(format="%.4f") for c in ["roc_auc", "log_loss", "brier", "accuracy", "precision", "recall", "f1", "ece"]})
        ci = tm["roc_auc_ci95"].apply(lambda s: json.loads(s) if isinstance(s, str) else s)
        fig = go.Figure(go.Bar(x=tm["roc_auc"], y=tm["model"], orientation="h", marker_color="#2a78d6",
                               error_x=dict(type="data", symmetric=False, array=[c_[1] - a for c_, a in zip(ci, tm["roc_auc"])],
                                            arrayminus=[a - c_[0] for c_, a in zip(ci, tm["roc_auc"])], color="#52514e"),
                               hovertemplate="%{y}: AUC %{x:.3f}<extra></extra>"))
        fig.update_layout(title="ROC-AUC held-out (95% CI bootstrap per siswa)", xaxis=dict(range=[0.5, 0.85]), height=300,
                          margin=dict(l=10, r=10, t=50, b=10))
        st.plotly_chart(fig, use_container_width=True)
        st.caption(card.get("test_evaluation", {}).get("protocol", ""))
    dq = card.get("diagnosis_quality", {})
    if dq:
        st.subheader("Proksi kualitas diagnosis (tanpa ground truth mastery)")
        c = st.columns(3)
        sh = dq.get("split_half_consistency_test", {})
        c[0].metric("Konsistensi split-half (test)", f"{sh.get('consistency', float('nan')):.3f}")
        c[1].metric("Konsistensi di luar pita δ", f"{sh.get('consistency_outside_band', float('nan')):.3f}")
        sim = dq.get("simulation_recovery", {})
        c[2].metric("Akurasi atribut (SIMULASI)", f"{sim.get('attribute_accuracy_with_evidence', float('nan')):.3f}")
        st.caption(dq.get("caveat", ""))

    st.subheader("Ringkasan learning gap")
    res = st.session_state.get("result")
    if res is not None and res["profiles"]["student_id"].nunique() >= 1:
        cs, lab = res["class_summary"], res.get("source_label", "data terpilih")
    else:
        cs, lab = art_csv(ART, "diagnosis/test_class_gap_summary.csv"), f"{DEMO_LABEL} - label model"
    if cs is not None and len(cs):
        st.markdown(badge(lab), unsafe_allow_html=True)
        fig = go.Figure()
        d = cs.sort_values("gap_share_among_diagnosable")
        fig.add_bar(y=d["concept_name"], x=d["gap_share_among_diagnosable"], orientation="h", marker_color="#d03b3b", name="gap (di antara yang terdiagnosis)")
        fig.update_layout(xaxis=dict(range=[0, 1], tickformat=".0%", title="proporsi siswa dengan gap"), height=34 * len(d) + 110,
                          margin=dict(l=10, r=10, t=20, b=10))
        st.plotly_chart(fig, use_container_width=True)
        st.caption("Proporsi dihitung hanya di antara siswa yang konsepnya dapat didiagnosis; 'insufficient_share' di tabel Learning Gap Analysis.")
    if res is not None:
        render_narrative(res, "teacher", key="teacher", label="Buat ringkasan naratif")
    st.info(f"{POP_NOTE} Model belum tervalidasi pada kelas SMA penelitian; probabilitas mastery adalah estimasi model, "
            "bukan mastery terbukti.")

elif page == "Student Assessment":
    st.title("Student Assessment")
    sources = [DEMO_LABEL] + ([f"{CLASS_LABEL} (pre-test)"] if HAS_CLASS else []) + ["Unggah CSV", "Isi form assessment",
                                                                                     "Assessment adaptif interaktif"]
    source = st.radio("Sumber respons", sources, horizontal=True)
    if HAS_CLASS and source == f"{CLASS_LABEL} (pre-test)":
        st.markdown(badge("DATA KELAS DUMMY - siswa sintetis, bukan siswa nyata", "sim"), unsafe_allow_html=True)
        cd = get_class("pre")
        c1, c2 = st.columns(2)
        kelas = c1.selectbox("Kelas", sorted(cd["class"].unique()))
        sid = c2.selectbox("Siswa", cd.loc[cd["class"] == kelas, "student_id"].drop_duplicates().tolist())
        r = cd[cd["student_id"] == sid]
        st.caption(f"Pre-test {r['form_id'].iloc[0]}: {int((r['response'] != '').sum())} dijawab, "
                   f"{int((r['response'] == '').sum())} kosong (tidak dihitung salah).")
        if st.button("Proses diagnosis", type="primary"):
            run_diagnosis(r[["student_id", "QuestionId", "response"]], f"Kelas dummy {kelas} - {sid} (pre-test)")
    elif source == DEMO_LABEL:
        demo = get_demo()
        if demo is None:
            st.error("Data demo (artifacts/demo/test_split_responses.csv) tidak ada.")
        else:
            st.markdown(badge(DEMO_BADGE, "sim" if IS_DUMMY else "real"), unsafe_allow_html=True)
            students = demo["student_id"].drop_duplicates().tolist()
            c1, c2 = st.columns([1, 2])
            sid = c1.selectbox("Pilih siswa", students)
            mode = c2.selectbox("Assessment yang dipakai", ["Semua respons yang teramati", "Hanya soal pada fixed form",
                                                             "Hanya soal pada parallel form A", "Hanya soal konsep target"])
            r = demo[demo["student_id"] == sid]
            if mode == "Hanya soal pada fixed form" and "fixed" in svc.forms:
                r = r[r["QuestionId"].isin(svc.forms["fixed"]["QuestionId"])]
            elif mode == "Hanya soal pada parallel form A" and "A" in svc.forms:
                r = r[r["QuestionId"].isin(svc.forms["A"]["QuestionId"])]
            elif mode == "Hanya soal konsep target":
                r = r[r["QuestionId"].isin(svc.items.loc[svc.items["any_concept_target"], "QuestionId"])]
            st.caption(f"{len(r)} respons teramati dipakai. Soal yang tidak dikerjakan diperlakukan sebagai tidak teramati (bukan salah).")
            if st.button("Proses diagnosis", type="primary"):
                if len(r) == 0:
                    st.warning("Siswa ini tidak mengerjakan soal pada assessment terpilih: semua konsep akan berstatus bukti belum cukup.")
                    r = pd.DataFrame({"student_id": [sid], "QuestionId": [int(svc.question_ids[0])], "response": [""]})
                run_diagnosis(r, f"{DEMO_LABEL} {sid}")
    elif source == "Unggah CSV":
        st.markdown("Format panjang: `student_id,QuestionId,response` (1/0/kosong) **atau** `answer_option` (1-4). "
                    "Format lebar: `student_id,<QuestionId>,...`.")
        if "fixed" in svc.forms:
            from cdacdm.responses import response_template
            st.download_button("⬇ Template CSV (fixed form)", response_template(svc.forms["fixed"]).to_csv(index=False).encode(),
                                "response_template_fixed_form.csv", "text/csv")
        up = st.file_uploader("CSV respons siswa", type=["csv"])
        if up is not None and st.button("Proses diagnosis", type="primary"):
            try:
                df = pd.read_csv(io.BytesIO(up.getvalue()), dtype=str, keep_default_na=False)
            except Exception as e:  # noqa: BLE001
                st.error(f"CSV tidak dapat dibaca: {e}")
                df = None
            if df is not None:
                run_diagnosis(df, f"Unggahan: {up.name}")
    elif source == "Isi form assessment":
        opts = {k: v for k, v in {"Fixed form": svc.forms.get("fixed"), "Parallel form A (pre-test)": svc.forms.get("A"),
                                  "Parallel form B (post-test)": svc.forms.get("B")}.items() if v is not None and len(v)}
        if not opts:
            st.error("Form assessment belum dibuat oleh pipeline.")
        else:
            fname = st.selectbox("Form", list(opts))
            sid = st.text_input("ID siswa", "S001")
            responses = form_editor(opts[fname], key=f"ed_{fname}", student_label=sid)
            if st.button("Proses diagnosis", type="primary"):
                responses["student_id"] = sid
                run_diagnosis(responses, f"Form {fname} - {sid}")
    else:
        st.markdown("Model memilih soal berikutnya berdasarkan **mutual information** terhadap profil mastery, dibobot oleh "
                    "ketidakpastian konsep dan cakupan - bukan sekadar soal tersulit.")
        chosen = st.multiselect("Konsep target yang diukur", [names_by_id[c] for c in target_ids],
                                default=[names_by_id[c] for c in target_ids])
        chosen_ids = [c for c in target_ids if names_by_id[c] in chosen] or target_ids
        c1, c2 = st.columns(2)
        maxlen = c1.number_input("Panjang tes maksimum", 3, 120, int(min(120, policy.n_min * len(chosen_ids))),
                                 help=f"Default = n_min ({policy.n_min}) × jumlah konsep: bukti minimum agar tiap konsep dapat didiagnosis.")
        if c2.button("Mulai / reset sesi adaptif"):
            pol = svc.policy_with(policy.tau, policy.delta, policy.n_min)
            pol.target_concept_ids = chosen_ids
            st.session_state["adaptive"] = AdaptiveSession(svc.model, svc.items, pol, max_length=int(maxlen))
        sess = st.session_state.get("adaptive")
        if sess is not None:
            nxt = sess.next_item()
            st.progress(min(1.0, len(sess.administered) / sess.max_length), text=f"{len(sess.administered)}/{sess.max_length} soal")
            if nxt is None:
                st.success("Sesi selesai (panjang maksimum tercapai, semua konsep target terdiagnosis, atau tidak ada soal informatif).")
            else:
                st.markdown(f"**Soal berikutnya: QuestionId {int(nxt['QuestionId'])}** - konsep: {nxt['concept_names']}")
                qrow = ITEMS_BY_Q.loc[int(nxt["QuestionId"])]
                if isinstance(qrow.get("question_text"), str) and qrow.get("question_text"):
                    st.info(qrow["question_text"])
                    with st.expander("Kunci jawaban (untuk guru)"):
                        st.write(qrow.get("answer_key", "-"))
                st.caption(f"MI = {nxt['mutual_information_bits']:.3f} bit · bobot konsep = {nxt['concept_weight']:.2f} · "
                           f"P(benar) saat ini = {nxt['p_correct_now']:.2f} · difficulty = {nxt['difficulty']:.2f}")
                img_root = os.environ.get("CDACDM_IMAGE_ROOT")
                if img_root and (Path(img_root) / f"{int(nxt['QuestionId'])}.jpg").exists():
                    st.image(str(Path(img_root) / f"{int(nxt['QuestionId'])}.jpg"), width=520,
                             caption="Gambar soal EEDI - lisensi: hanya untuk riset/model training, jangan disebarkan.")
                b1, b2, b3 = st.columns(3)
                if b1.button("✔ Benar"):
                    sess.record(nxt["QuestionId"], 1)
                    st.rerun()
                if b2.button("✘ Salah"):
                    sess.record(nxt["QuestionId"], 0)
                    st.rerun()
                if b3.button("Lewati (tidak dijawab)"):
                    sess.record(nxt["QuestionId"], None)
                    st.rerun()
            if sess.administered and st.button("Diagnosis dari jawaban sesi ini", type="primary"):
                log = pd.DataFrame(sess.log)
                run_diagnosis(pd.DataFrame({"student_id": "ADAPTIVE-1", "QuestionId": log["QuestionId"],
                                            "response": log["response"].apply(lambda v: "" if v is None else str(int(v)))}),
                              "Sesi adaptif interaktif")
            if sess.log:
                st.dataframe(pd.DataFrame(sess.log), hide_index=True)

    res = st.session_state.get("result")
    if res is not None:
        st.divider()
        st.markdown(badge(res.get("source_label", "")), unsafe_allow_html=True)
        for w in res["info"].get("warnings", []):
            st.warning(w)
        if res["info"].get("students_with_no_observed_response"):
            st.warning(f"Siswa tanpa respons teramati: {res['info']['students_with_no_observed_response']}")
        sids = res["profiles"]["student_id"].astype(str).unique().tolist()
        sid = st.selectbox("Tampilkan siswa", sids) if len(sids) > 1 else sids[0]
        show_student_result(res, sid)
        render_narrative(res, "student", student_id=sid, key="student", label="Buat feedback siswa")
        download_buttons(res, "diagnosis")

elif page == "Learning Gap Analysis":
    st.title("Learning Gap Analysis")
    opts = (["Hasil diagnosis terakhir"] + ([f"{CLASS_LABEL} (pre-test)", f"{CLASS_LABEL} (post-test)"] if HAS_CLASS else [])
            + [f"Sampel kelas dari {DEMO_LABEL}", "Unggah CSV kelas"])
    src_opt = st.radio("Data", opts, horizontal=True)
    res = None
    if src_opt == "Hasil diagnosis terakhir":
        res = st.session_state.get("result")
        if res is None:
            st.info("Belum ada hasil diagnosis. Jalankan diagnosis di Student Assessment atau pilih sumber data lain.")
    elif HAS_CLASS and src_opt.startswith(CLASS_LABEL):
        which = "pre" if "pre-test" in src_opt else "post"
        cd = get_class(which)
        st.markdown(badge("DATA KELAS DUMMY - siswa sintetis, bukan siswa nyata", "sim"), unsafe_allow_html=True)
        kelas = st.selectbox("Kelas", ["Semua"] + sorted(cd["class"].unique()))
        if st.button("Diagnosis kelas", type="primary"):
            d = cd if kelas == "Semua" else cd[cd["class"] == kelas]
            res = run_diagnosis(d[["student_id", "QuestionId", "response"]], f"Kelas dummy {kelas} ({which}-test)")
        res = res or st.session_state.get("result")
    elif src_opt.startswith("Sampel kelas dari"):
        demo = get_demo()
        n = st.slider("Jumlah siswa", 5, 120, 30)
        if demo is not None and st.button("Diagnosis kelas", type="primary"):
            ids = demo["student_id"].drop_duplicates().head(n)
            res = run_diagnosis(demo[demo["student_id"].isin(ids)], f"Sampel {n} siswa - {DEMO_LABEL}")
        res = res or st.session_state.get("result")
    else:
        up = st.file_uploader("CSV respons kelas (format panjang/lebar)", type=["csv"], key="class_up")
        if up is not None and st.button("Diagnosis kelas", type="primary"):
            res = run_diagnosis(pd.read_csv(io.BytesIO(up.getvalue()), dtype=str, keep_default_na=False), f"Unggahan kelas: {up.name}")
        res = res or st.session_state.get("result")
    if res is not None:
        prof = res["profiles"]
        t = prof[prof["is_target_concept"]].copy()
        st.markdown(badge(res.get("source_label", "")) + f" &nbsp; {t['student_id'].nunique()} siswa", unsafe_allow_html=True)
        piv = t.assign(v=np.where(t["mastery_label"] == "insufficient_evidence", np.nan, t["mastery_prob"])) \
               .pivot_table(index="student_id", columns="concept_name", values="v", aggfunc="first", dropna=False)
        lab = t.pivot_table(index="student_id", columns="concept_name", values="mastery_label", aggfunc="first")
        fig = go.Figure(go.Heatmap(z=piv.values, x=piv.columns, y=piv.index.astype(str), colorscale=SEQ_BLUE, zmin=0, zmax=1,
                                   text=lab.reindex_like(piv).values, xgap=2, ygap=2,
                                   hovertemplate="siswa %{y}<br>%{x}<br>P(mastery)=%{z:.2f}<br>%{text}<extra></extra>",
                                   colorbar=dict(title="P(mastery)")))
        fig.update_layout(title="Heatmap penguasaan konsep antarsiswa (abu-abu = bukti belum cukup)", plot_bgcolor="#d9d8d2",
                          height=min(1400, 22 * len(piv) + 220), margin=dict(l=10, r=10, t=50, b=10), xaxis=dict(tickangle=-35))
        st.plotly_chart(fig, use_container_width=True)
        st.subheader("Agregasi per konsep")
        st.dataframe(res["class_summary"], hide_index=True, use_container_width=True,
                     column_config={"gap_share_among_diagnosable": st.column_config.ProgressColumn("gap share (terdiagnosis)", min_value=0, max_value=1, format="%.2f"),
                                    "insufficient_share": st.column_config.ProgressColumn("bukti belum cukup", min_value=0, max_value=1, format="%.2f")})
        st.subheader("Ranking learning gap seluruh siswa")
        g = res["gaps"]
        st.dataframe(g[g["gap_status"] != "needs_more_data"][["student_id", "rank_within_student", "concept_name", "gap_status", "mastery_prob",
                                                              "n_evidence", "priority_score"]], hide_index=True, use_container_width=True)
        st.caption("Learning gap = konsep target dengan P(mastery) < τ - δ dan bukti ≥ n_min. Konsep dengan bukti kurang "
                   "dilaporkan sebagai 'needs_more_data', bukan gap. Probabilitas adalah estimasi model, bukan mastery terbukti.")
        render_narrative(res, "teacher", key="teacher", label="Buat ringkasan naratif")
        download_buttons(res, "class")

elif page == "Intervention Recommendations":
    st.title("Intervention Recommendations")
    res = st.session_state.get("result")
    ph = int(svc.intervention_map["is_placeholder"].sum())
    if ph:
        st.warning(f"{ph} dari {len(svc.intervention_map)} entri intervention map masih PLACEHOLDER dan wajib divalidasi guru/dosen. "
                   "Edit `configs/intervention_map.csv` (kolom material_source, remedial_activity, ..., status=validated).")
    if res is None or len(res["recommendations"]) == 0:
        st.info("Belum ada learning gap pada hasil diagnosis terakhir. Jalankan diagnosis terlebih dahulu.")
    else:
        rec = res["recommendations"]
        sids = rec["student_id"].astype(str).unique().tolist()
        sid = st.selectbox("Siswa", sids)
        r = rec[rec["student_id"].astype(str) == sid]
        for _, row in r.iterrows():
            with st.container(border=True):
                head = f"**{int(row['recommendation_rank'])}. {row['concept_name']}** · {row['gap_status']} · P(mastery)={row['mastery_prob']:.2f} · bukti={row['n_evidence']}"
                st.markdown(head + "  " + (badge("PLACEHOLDER - perlu validasi guru", "sim") if row["is_placeholder"] else badge("tervalidasi")),
                            unsafe_allow_html=True)
                c1, c2 = st.columns(2)
                c1.markdown(f"**Tindakan:** {row['recommended_action']} · **Level:** {row['intervention_level']}")
                c1.markdown(f"**Aktivitas remedial:** {row['remedial_activity']}")
                c2.markdown(f"**Sumber materi:** {row['material_source']}")
                c2.markdown(f"**Latihan lanjutan:** {row['enrichment_practice']}")
                st.caption(f"Soal latihan dari item bank: {row['practice_question_ids'] or '-'} · Aturan: {row['rule_trace']}")
        st.caption("Prioritas mengikuti aturan transparan R1-R5 (status → prasyarat → prioritas → urutan kurikulum → level kelas). "
                   "Tidak ada klaim efektivitas intervensi: data training tidak memuat data perlakuan maupun hasil intervensi.")
        st.download_button("⬇ Rekomendasi (CSV)", rec.to_csv(index=False).encode(), "intervention_recommendations.csv", "text/csv")
        render_narrative(res, "teacher", student_id=sid, key="intervention", label="Jelaskan rekomendasi")
    with st.expander("Intervention map yang dipakai"):
        st.dataframe(svc.intervention_map, hide_index=True, use_container_width=True)

elif page == "Pre-test vs Post-test":
    st.title("Pre-test vs Post-test")
    modes = ([f"{CLASS_LABEL} (DUMMY)"] if HAS_CLASS else []) + ["Unggah data pre-test & post-test (kelas nyata)",
                                                                "Demo SIMULASI (data sintetis)"]
    mode = st.radio("Sumber data", modes, horizontal=True)
    pre = post = None
    randomized = False
    if HAS_CLASS and mode == f"{CLASS_LABEL} (DUMMY)":
        st.markdown(badge("DATA KELAS DUMMY - efek antar kelas dipasang oleh parameter simulasi", "sim"), unsafe_allow_html=True)
        st.caption("XI-A (treatment) dan XI-B (control) adalah kelas utuh, tidak diacak: perbandingannya kuasi-eksperimen. "
                   "Pre-test = parallel form A, post-test = parallel form B.")
        scope = st.selectbox("Cakupan", ["Kedua kelas (treatment vs control)", "XI-A saja", "XI-B saja"])
        if st.button("Bandingkan", type="primary"):
            pre, post = get_class("pre"), get_class("post")
            if scope != "Kedua kelas (treatment vs control)":
                k = scope.split()[0]
                pre, post = pre[pre["class"] == k], post[post["class"] == k]
            st.session_state["pp_label"] = ("sim", f"Kelas dummy - {scope}")
    elif mode.startswith("Unggah"):
        st.markdown("Dua CSV format panjang `student_id,QuestionId,response` (opsional kolom `group` = treatment/control). "
                    "Siswa dicocokkan berdasarkan `student_id`.")
        c1, c2 = st.columns(2)
        up1 = c1.file_uploader("Pre-test CSV", type=["csv"], key="pre")
        up2 = c2.file_uploader("Post-test CSV", type=["csv"], key="post")
        randomized = st.checkbox("Desain acak dengan kelompok kontrol (randomized)", value=False)
        if up1 is not None and up2 is not None and st.button("Bandingkan", type="primary"):
            pre = pd.read_csv(io.BytesIO(up1.getvalue()), dtype=str, keep_default_na=False)
            post = pd.read_csv(io.BytesIO(up2.getvalue()), dtype=str, keep_default_na=False)
            st.session_state["pp_label"] = ("real", "Data kelas yang diunggah")
    else:
        st.markdown(badge("SIMULASI - bukan hasil eksperimen dan bukan siswa EEDI", "sim"), unsafe_allow_html=True)
        st.caption("Respons dibangkitkan dari parameter model terlatih: mastery awal dari prior, sebagian konsep yang belum dikuasai "
                   "diubah menjadi dikuasai dengan probabilitas 'gain' yang Anda atur. Gunanya hanya menguji alur analisis.")
        c = st.columns(4)
        n = c[0].number_input("Jumlah siswa sintetis", 10, 200, 40)
        gain = c[1].slider("Prob. gain (simulasi)", 0.0, 1.0, 0.4, 0.05)
        design = c[2].selectbox("Desain form", ["Parallel forms A→B", "Form sama (fixed)"])
        ctrl = c[3].checkbox("Tambah kelompok kontrol sintetis")
        seed = st.number_input("Seed", 0, 9999, 7)
        randomized = ctrl
        if st.button("Bangkitkan & bandingkan", type="primary"):
            if design.startswith("Parallel") and "A" in svc.forms and "B" in svc.forms:
                qa, qb = svc.forms["A"]["QuestionId"], svc.forms["B"]["QuestionId"]
            else:
                qa = qb = svc.forms["fixed"]["QuestionId"]
            pre, post, _ = generate_synthetic_prepost(svc.model, qa, qb, int(n), gain, seed=int(seed), with_control=ctrl)
            st.session_state["pp_label"] = ("sim", "SIMULASI")
    if pre is not None:
        try:
            st.session_state["pp"] = compare_pre_post(svc.model, pre, post, policy, svc.concept_ids, svc.concept_names, svc.items,
                                                      svc.item_bank, randomized_design=randomized)
            st.session_state["pp_post"] = post
        except (ResponseValidationError, ValueError) as e:
            st.error(f"Data tidak valid: {e}")
            st.session_state.pop("pp", None)
    pp = st.session_state.get("pp")
    if pp is not None:
        kind, lab = st.session_state.get("pp_label", ("real", ""))
        if kind == "sim":
            st.markdown(badge("HASIL SIMULASI - jangan dilaporkan sebagai temuan penelitian", "sim"), unsafe_allow_html=True)
        s = pp["summary"]
        st.info(s["interpretation_guard"])
        c = st.columns(5)
        o = s["overall_score"]
        c[0].metric("Siswa cocok", s["n_matched"])
        c[1].metric("Hanya pre / hanya post", f"{len(s['unmatched_pre_only'])} / {len(s['unmatched_post_only'])}")
        c[2].metric("Skor rata-rata pre → post", f"{o['mean_pre']:.2f} → {o['mean_post']:.2f}")
        c[3].metric("Perubahan skor (95% CI)", f"{o['mean_change']:+.3f}", f"[{o['mean_change_ci95'][0]:+.3f}, {o['mean_change_ci95'][1]:+.3f}]", delta_color="off")
        c[4].metric("Cohen's d_z · Wilcoxon p", f"{o['cohens_dz']:.2f} · {o['wilcoxon_p']:.3g}")
        gc = s.get("design", {}).get("gain_comparison")
        if gc:
            st.markdown(f"**Perbandingan gain skor antar kelompok:** {gc['group_a']} {gc['mean_gain_a']:+.3f} vs "
                        f"{gc['group_b']} {gc['mean_gain_b']:+.3f} (Mann-Whitney p = {gc['mannwhitney_p']:.3g})")
        comp = s["comparability"]
        st.caption(f"Desain form: {comp['form_design']}. {comp['scale_note']}")
        for w in comp.get("warnings", []):
            st.warning(w)
        con = pp["concepts"].dropna(subset=["mean_change"])
        if len(con):
            fig = go.Figure(go.Bar(x=con["mean_change"], y=con["concept_name"], orientation="h",
                                   marker_color=np.where(con["mean_change"] >= 0, "#2a78d6", "#d03b3b"),
                                   error_x=dict(type="data", symmetric=False,
                                                array=[ci[1] - m for ci, m in zip(con["mean_change_ci95"], con["mean_change"])],
                                                arrayminus=[m - ci[0] for ci, m in zip(con["mean_change_ci95"], con["mean_change"])], color="#52514e"),
                                   hovertemplate="%{y}: Δ=%{x:.3f}<extra></extra>"))
            fig.add_vline(x=0, line_color="#898781")
            fig.update_layout(title="Perubahan rata-rata P(mastery) per konsep (95% CI bootstrap)", height=34 * len(con) + 120,
                              margin=dict(l=10, r=10, t=50, b=10))
            st.plotly_chart(fig, use_container_width=True)
        st.dataframe(pp["concepts"][["concept_name", "n_both_diagnosable", "mean_pre", "mean_post", "mean_change", "mean_change_ci95", "cohens_dz",
                                     "rank_biserial_r", "wilcoxon_p", "wilcoxon_p_holm", "n_not_to_mastered", "n_mastered_to_not", "mcnemar_exact_p",
                                     "n_increase", "n_decrease", "interpretation"]], hide_index=True, use_container_width=True)
        with st.expander("Per siswa"):
            st.dataframe(pp["students"], hide_index=True, use_container_width=True)
            st.dataframe(pp["student_concepts"], hide_index=True, use_container_width=True)
        st.subheader("Rekomendasi remedial berdasarkan diagnosis post-test")
        post_res = svc.diagnose(st.session_state["pp_post"], policy)
        rr = post_res["recommendations"]
        if len(rr):
            st.dataframe(rr[rr["gap_status"] == "learning_gap"][["student_id", "recommendation_rank", "concept_name", "mastery_prob", "intervention_level",
                                                                 "remedial_activity", "is_placeholder"]], hide_index=True, use_container_width=True)
        else:
            st.info("Tidak ada learning gap pada post-test.")
        ppj = {"label": lab, "summary": s, "concepts": json.loads(pp["concepts"].to_json(orient="records")),
               "students": json.loads(pp["students"].to_json(orient="records"))}
        c1, c2, c3 = st.columns(3)
        c1.download_button("⬇ Perubahan per konsep (CSV)", pp["concepts"].to_csv(index=False).encode(), "prepost_concepts.csv", "text/csv")
        c2.download_button("⬇ Perubahan per siswa-konsep (CSV)", pp["student_concepts"].to_csv(index=False).encode(), "prepost_student_concepts.csv", "text/csv")
        c3.download_button("⬇ Laporan pre/post (JSON)", json.dumps(svc.report_json(post_res, ppj), indent=2, default=str, ensure_ascii=False).encode(),
                           "prepost_report.json", "application/json")

else:
    st.title("Model & Data")
    st.markdown("""
**Model utama: probabilistic DINA (variational EM).** Untuk siswa *i*, soal *j*, konsep *k*:

- α<sub>ik</sub> ∈ {0,1} penguasaan laten; η<sub>ij</sub> = Π<sub>k</sub> α<sub>ik</sub><sup>q<sub>jk</sub></sup>
- P(X<sub>ij</sub>=1 | α) = (1−s<sub>j</sub>)<sup>η</sup> g<sub>j</sub><sup>1−η</sup>, dengan prior Beta pada g dan s
- q(α<sub>i</sub>) = Π<sub>k</sub> Bernoulli(π<sub>ik</sub>), sehingga P(η<sub>ij</sub>=1) = Π<sub>k</sub> π<sub>ik</sub><sup>q<sub>jk</sub></sup> - tanpa enumerasi 2<sup>K</sup> profil
- π<sub>ik</sub> = probabilitas penguasaan yang dilaporkan; hanya respons teramati (mask) yang masuk ke likelihood
""", unsafe_allow_html=True)
    st.json(card.get("model_selection", {}), expanded=False)
    st.subheader("Kebijakan diagnosis (dipilih di validation set)")
    st.json(svc.policy.to_dict(), expanded=False)
    st.subheader("Parameter soal")
    st.dataframe(svc.items, hide_index=True, use_container_width=True)
    st.subheader("Kecukupan soal per konsep target")
    ad = art_csv(ART, "assessment/concept_item_adequacy.csv")
    if ad is not None:
        st.dataframe(ad, hide_index=True, use_container_width=True)
    st.subheader("Cakupan kurikulum target")
    cov = art_csv(ART, "audit/coverage_report.csv")
    if cov is not None:
        st.dataframe(cov, hide_index=True, use_container_width=True)
    st.subheader("Data & audit")
    st.json(card.get("data", {}), expanded=False)
