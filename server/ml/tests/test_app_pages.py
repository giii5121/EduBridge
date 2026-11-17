"""Drive every Streamlit page through streamlit.testing (no browser needed).

By default the app runs on the small synthetic checkpoint trained inside the test session. Set
CDACDM_E2E_ARTIFACT_DIR=artifacts to run the same checks against the real EEDI checkpoint."""
import os

import pytest
from streamlit.testing.v1 import AppTest

from conftest import ROOT

APP = str(ROOT / "app.py")


@pytest.fixture()
def app(request, monkeypatch):
    target = os.environ.get("CDACDM_E2E_ARTIFACT_DIR") or str(request.getfixturevalue("trained_dir"))
    monkeypatch.setenv("CDACDM_ARTIFACT_DIR", target)
    at = AppTest.from_file(APP, default_timeout=180)
    at.run()
    assert not at.exception
    return at


def _goto(at, page):
    at.sidebar.radio[0].set_value(page).run()
    assert not at.exception, at.exception


def _click(at, label):
    btn = next(b for b in at.button if b.label == label)
    btn.click().run()
    assert not at.exception, at.exception


def test_student_assessment_demo_and_downloads(app):
    _goto(app, "Student Assessment")
    _click(app, "Proses diagnosis")
    assert app.session_state["result"] is not None
    assert len(app.metric) >= 5
    _goto(app, "Learning Gap Analysis")
    _goto(app, "Intervention Recommendations")
    _goto(app, "Dashboard")


def test_class_gap_analysis_from_demo(app):
    _goto(app, "Learning Gap Analysis")
    app.radio[0].set_value(next(o for o in app.radio[0].options if o.startswith("Sampel kelas dari"))).run()
    _click(app, "Diagnosis kelas")
    res = app.session_state["result"]
    assert res["profiles"]["student_id"].nunique() > 1


def test_form_entry_with_blank_responses(app):
    _goto(app, "Student Assessment")
    app.radio[0].set_value("Isi form assessment").run()
    assert not app.exception
    _click(app, "Proses diagnosis")       # all blank -> every concept 'insufficient_evidence', no crash
    prof = app.session_state["result"]["profiles"]
    assert (prof["mastery_label"] == "insufficient_evidence").all()


def test_adaptive_session(app):
    _goto(app, "Student Assessment")
    app.radio[0].set_value("Assessment adaptif interaktif").run()
    _click(app, "Mulai / reset sesi adaptif")
    _click(app, "✔ Benar")
    _click(app, "✘ Salah")
    _click(app, "Diagnosis dari jawaban sesi ini")
    assert app.session_state["result"]["info"]["n_observed"] == 2


def test_prepost_simulation_page(app):
    _goto(app, "Pre-test vs Post-test")
    app.radio[0].set_value("Demo SIMULASI (data sintetis)").run()
    _click(app, "Bangkitkan & bandingkan")
    pp = app.session_state["pp"]
    assert pp["summary"]["n_matched"] == 40
    assert any("SIMULASI" in m.value for m in app.markdown)


def test_model_page(app):
    _goto(app, "Model & Data")
