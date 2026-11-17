import json

import numpy as np
import pandas as pd
import pytest

from cdacdm.api import compare_pre_post, predict_mastery, select_assessment
from cdacdm.service import CDMService, CheckpointNotFoundError
from cdacdm.synthetic import generate_synthetic_prepost

from conftest import ROOT

APP = ROOT / "app.py"


def test_pipeline_writes_all_artifacts(trained_dir):
    for f in ["model/pdina_params.npz", "model/item_parameters.csv", "model/diagnosis_policy.json", "evaluation/test_metrics.csv",
              "evaluation/hp_search_validation.csv", "diagnosis/test_mastery_profiles.csv", "diagnosis/test_learning_gaps.csv",
              "intervention/test_intervention_recommendations.csv", "assessment/fixed_form.csv", "audit/data_audit.json",
              "audit/coverage_report.csv", "prepost/SYNTHETIC_prepost_report.json", "run_summary.json"]:
        assert (trained_dir / f).exists(), f
    s = json.loads((trained_dir / "run_summary.json").read_text())
    assert s["data"]["student_disjoint"]
    assert "Limits" in s["assessment"]["coverage"]["unmapped_topics"]
    assert 105 in s["q_matrix"]["concepts_without_items"]


def test_checkpoint_loading_and_missing_checkpoint(trained_dir, tmp_path):
    svc = CDMService.load(trained_dir)
    assert len(svc.question_ids) == 40 and svc.policy.target_concept_ids
    with pytest.raises(CheckpointNotFoundError, match="Run the training pipeline"):
        CDMService.load(tmp_path / "nothing_here")


def test_new_student_partial_responses(trained_dir):
    svc = CDMService.load(trained_dir)
    before = svc.model.g.copy()
    resp = pd.DataFrame({"student_id": ["brand-new"] * 3, "QuestionId": [1000, 1004, 1001], "response": [1, 1, ""]})
    prof = predict_mastery(resp, service=svc)
    assert np.array_equal(before, svc.model.g)
    p = prof.set_index("concept_id")
    assert p.loc[101, "n_evidence"] == 2 and p.loc[102, "n_evidence"] == 0
    assert p.loc[102, "mastery_label"] == "insufficient_evidence"
    res = svc.diagnose(resp)
    rep = svc.report_json(res)
    assert "disclaimer" in rep and json.dumps(rep, default=str)


def test_invalid_input_rejected_by_service(trained_dir):
    svc = CDMService.load(trained_dir)
    from cdacdm.responses import ResponseValidationError
    with pytest.raises(ResponseValidationError):
        svc.predict_mastery(pd.DataFrame({"student_id": ["x"], "QuestionId": [1], "response": [1]}))


def test_select_assessment_modes(trained_dir):
    svc = CDMService.load(trained_dir)
    form, cov = select_assessment("fixed", service=svc, items_per_concept=2, max_length=6)
    assert len(form) <= 6
    a, b, bal = select_assessment("parallel", service=svc, items_per_concept=2)
    assert not set(a["QuestionId"]) & set(b["QuestionId"])
    sess = select_assessment("adaptive", service=svc, max_length=3)
    assert sess.next_item() is not None


def test_pre_post_comparison(trained_dir):
    svc = CDMService.load(trained_dir)
    qa = svc.items.loc[svc.items["eligible_target_item"], "QuestionId"].tolist()
    pre, post, truth = generate_synthetic_prepost(svc.model, qa, qa, n_students=60, gain_prob=0.9, seed=3)
    post = post[post["student_id"] != "SIM-060"]                       # one unmatched student
    res = compare_pre_post(pre, post, service=svc)
    s = res["summary"]
    assert s["n_matched"] == 59 and s["unmatched_pre_only"] == ["SIM-060"]
    assert "must not be interpreted" in s["interpretation_guard"]
    assert s["overall_score"]["mean_change"] > 0
    con = res["concepts"]
    assert (con.loc[con["n_both_diagnosable"] > 5, "mean_change"] > 0).all()
    assert s["comparability"]["form_design"].startswith("identical")
    # control group path
    pre2, post2, _ = generate_synthetic_prepost(svc.model, qa, qa, n_students=40, seed=4, with_control=True)
    res2 = compare_pre_post(pre2, post2, service=svc)
    assert res2["summary"]["design"]["has_control_group"]
    assert "quasi-experimental" in res2["summary"]["interpretation_guard"]
    with pytest.raises(ValueError, match="no student identifiers"):
        compare_pre_post(pre, post.assign(student_id="other-" + post["student_id"]), service=svc)


def test_streamlit_app_smoke(trained_dir, monkeypatch):
    from streamlit.testing.v1 import AppTest
    monkeypatch.setenv("CDACDM_ARTIFACT_DIR", str(trained_dir))
    at = AppTest.from_file(str(APP), default_timeout=120)
    at.run()
    assert not at.exception, at.exception
    assert len(at.metric) > 0


def test_streamlit_app_without_checkpoint(tmp_path, monkeypatch):
    from streamlit.testing.v1 import AppTest
    monkeypatch.setenv("CDACDM_ARTIFACT_DIR", str(tmp_path))
    at = AppTest.from_file(str(APP), default_timeout=60)
    at.run()
    assert not at.exception
    txt = " ".join(e.value for e in list(at.error) + list(at.warning) + list(at.info))
    assert "training" in txt.lower()
