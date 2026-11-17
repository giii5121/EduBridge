"""Dummy kelas XI calculus scenario: item bank sanity + app pages on the calculus checkpoint (if built)."""
import numpy as np
import pytest
from streamlit.testing.v1 import AppTest

from cdacdm.dummy_calculus import CIDS, OUT_DIR, build_item_bank
from cdacdm.service import checkpoint_status

from conftest import ROOT


def test_item_bank_structure():
    bank, Q = build_item_bank(np.random.default_rng(0))
    assert bank["QuestionId"].is_unique and len(bank) == Q.shape[0]
    assert Q.shape[1] == len(CIDS) and set(np.unique(Q)) <= {0, 1}
    assert (Q.sum(0) >= 6).all()                     # every concept can fill two forms of 3 items
    assert (Q.sum(1) >= 1).all()
    assert bank["question_text"].str.len().min() > 10 and bank["answer_key"].str.len().min() >= 1
    assert ((bank["true_guess"] + bank["true_slip"]) < 1).all()


needs_ckpt = pytest.mark.skipif(not checkpoint_status(OUT_DIR)["ready"] or not (OUT_DIR / "class_dummy").exists(),
                                reason="run `python -m cdacdm.dummy_calculus` first")


@pytest.fixture()
def app(monkeypatch):
    monkeypatch.setenv("CDACDM_ARTIFACT_DIR", str(OUT_DIR))
    at = AppTest.from_file(str(ROOT / "app.py"), default_timeout=180)
    at.run()
    assert not at.exception
    return at


def _go(at, page):
    at.sidebar.radio[0].set_value(page).run()
    assert not at.exception, at.exception


def _click(at, label):
    next(b for b in at.button if b.label == label).click().run()
    assert not at.exception, at.exception


@needs_ckpt
def test_class_student_diagnosis(app):
    _go(app, "Student Assessment")
    app.radio[0].set_value("Kelas dummy XI-A / XI-B (pre-test)").run()
    _click(app, "Proses diagnosis")
    prof = app.session_state["result"]["profiles"]
    assert prof["student_id"].nunique() == 1 and prof["student_id"].iloc[0].startswith("XI-")


@needs_ckpt
def test_class_gap_heatmap(app):
    _go(app, "Learning Gap Analysis")
    app.radio[0].set_value("Kelas dummy XI-A / XI-B (pre-test)").run()
    _click(app, "Diagnosis kelas")
    assert app.session_state["result"]["profiles"]["student_id"].nunique() == 70   # XI-B-07 absent at pre-test
    _go(app, "Intervention Recommendations")


@needs_ckpt
def test_class_prepost(app):
    _go(app, "Pre-test vs Post-test")
    app.radio[0].set_value("Kelas dummy XI-A / XI-B (DUMMY)").run()
    _click(app, "Bandingkan")
    s = app.session_state["pp"]["summary"]
    assert s["n_matched"] == 68 and s["design"]["has_control_group"]
    assert "quasi-experimental" in s["interpretation_guard"]
