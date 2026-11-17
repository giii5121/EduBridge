import numpy as np
import pandas as pd
import pytest

from cdacdm.data import (ArtifactValidationError, check_alignment, interactions_to_matrix, load_artifacts, load_npz_responses,
                         read_interactions_safely, validate_q_matrix)
from cdacdm.intervention import load_intervention_map
from cdacdm.qmatrix import analyze_q_matrix, validate_target_concept_map

from conftest import CONCEPTS, NAMES, make_q


def test_load_artifacts_validates_and_masks(synth_dir):
    b = load_artifacts(synth_dir / "final", {"data": {"expected_splits": {"train": 400, "val": 80, "test": 80}}})
    a = b.audit
    assert a["student_disjoint"]
    for s in ["train", "val", "test"]:
        assert a["splits"][s]["npz_encoding"]["missing_scheme"] == "-1 = missing"
        assert a["splits"][s]["alignment_npz_vs_csv"]["aligned"]
        r = b.splits[s]
        assert r.M.dtype == bool and not r.M.all()          # missing cells exist ...
        assert (r.X[~r.M] == 0).all()                       # ... and are excluded by the mask, not scored
    assert b.Q.shape == (40, 5)


def test_npz_missing_encodings_equivalent(tmp_path):
    qids = np.array([1, 2, 3])
    mat = np.array([[1, -1, 0], [-1, 1, 1]], dtype=np.int8)
    np.savez(tmp_path / "a.npz", matrix=mat, user_ids=np.array([7, 8]), question_ids=qids)
    np.savez(tmp_path / "b.npz", matrix=np.where(mat == -1, np.nan, mat).astype(float), user_ids=np.array([7, 8]))
    np.savez(tmp_path / "c.npz", matrix=np.where(mat == -1, 0, mat), user_ids=np.array([7, 8]))
    ra, ea = load_npz_responses(tmp_path / "a.npz", qids)
    rb, eb = load_npz_responses(tmp_path / "b.npz", qids)
    rc, ec = load_npz_responses(tmp_path / "c.npz", qids)
    assert np.array_equal(ra.M, rb.M) and np.array_equal(ra.X, rb.X)
    assert rc is None and ec["missing_scheme"].startswith("AMBIGUOUS")   # never guesses missing = wrong


def test_alignment_detects_mismatch():
    qids = np.array([1, 2])
    df = pd.DataFrame({"UserId": [1, 1, 2], "QuestionId": [1, 2, 1], "IsCorrect": [1, 0, 1]})
    a = interactions_to_matrix(df, qids)
    b = interactions_to_matrix(df.assign(IsCorrect=[1, 1, 1]), qids)
    rep = check_alignment(a, b)
    assert not rep["aligned"] and rep["value_mismatches"] == 1


def test_leakage_columns_not_read(synth_dir):
    df, roles = read_interactions_safely(synth_dir / "final/interactions_train.csv", ["UserId", "QuestionId", "IsCorrect"],
                                         ["question_pass_rate_z", "prior_accuracy"])
    assert "question_pass_rate_z" not in df.columns and "prior_accuracy" not in df.columns
    assert roles["roles"]["question_pass_rate_z"] == "excluded_leakage_prone"


def test_q_column_naming_variants():
    from cdacdm.data import match_q_columns, standardize_concept_meta
    cm = standardize_concept_meta(pd.DataFrame({"concept_index": range(5), "SubjectId": CONCEPTS, "concept_name": NAMES}))
    assert match_q_columns([f"c_{i}" for i in range(5)], cm) == CONCEPTS      # original Drive artifact naming
    assert match_q_columns([str(c) for c in CONCEPTS], cm) == CONCEPTS
    assert match_q_columns(NAMES, cm) == CONCEPTS
    with pytest.raises(ArtifactValidationError, match="could not be matched"):
        match_q_columns(["c_0", "c_1", "x", "c_3", "c_4"], cm)


def test_invalid_q_matrix():
    q = pd.DataFrame({"QuestionId": [1, 2], "a": [0, 2]})
    with pytest.raises(ArtifactValidationError, match="not binary"):
        validate_q_matrix(q)
    with pytest.raises(ArtifactValidationError, match="not unique"):
        validate_q_matrix(pd.DataFrame({"QuestionId": [1, 1], "a": [0, 1]}))
    with pytest.raises(ArtifactValidationError, match="expected 948"):
        validate_q_matrix(pd.DataFrame({"QuestionId": [1, 2], "a": [0, 1]}), expected_items=948)


def test_concept_without_items_reported():
    s, tab, multi = analyze_q_matrix(make_q(), np.arange(40), CONCEPTS, NAMES)
    assert s["concepts_without_items"] == [105]
    assert tab.loc[tab["concept_id"] == 105, "measurement_flag"].item() == "no_items"
    assert len(multi) == 2


def test_invalid_target_concept_map():
    base = pd.DataFrame({"concept_id": CONCEPTS, "concept_name": NAMES, "in_target_scope": [True] * 5})
    assert validate_target_concept_map(base, CONCEPTS)["in_target_scope"].all()
    with pytest.raises(ArtifactValidationError, match="not in the model"):
        validate_target_concept_map(base.assign(concept_id=[101, 102, 103, 104, 999]), CONCEPTS)
    with pytest.raises(ArtifactValidationError, match="duplicate"):
        validate_target_concept_map(base.assign(concept_id=[101, 101, 103, 104, 105]), CONCEPTS)
    with pytest.raises(ArtifactValidationError, match="not boolean"):
        validate_target_concept_map(base.assign(in_target_scope=["maybe"] * 5), CONCEPTS)
    with pytest.raises(ArtifactValidationError, match="no target"):
        validate_target_concept_map(base.assign(in_target_scope=[False] * 5), CONCEPTS)
    with pytest.raises(ArtifactValidationError, match="missing columns"):
        validate_target_concept_map(base.drop(columns=["in_target_scope"]), CONCEPTS)


def test_intervention_map_validation_and_placeholders(tmp_path):
    tm = pd.DataFrame({"concept_id": CONCEPTS, "concept_name": NAMES, "in_target_scope": [True, True, False, False, False]})
    p = tmp_path / "im.csv"
    pd.DataFrame({"concept_id": [999], "concept_name": ["x"], "remedial_activity": ["y"]}).to_csv(p, index=False)
    with pytest.raises(ArtifactValidationError, match="unknown concept"):
        load_intervention_map(p, tm)
    pd.DataFrame({"concept_id": [101], "concept_name": ["Alpha"], "remedial_activity": ["Worked examples set 3"],
                  "material_source": ["Teacher handout v2"], "status": ["validated"]}).to_csv(p, index=False)
    im, warns = load_intervention_map(p, tm)
    assert not im.set_index("concept_id").loc[101, "is_placeholder"]
    assert im.set_index("concept_id").loc[102, "is_placeholder"]       # missing entry -> labelled placeholder
    assert any("placeholder" in w for w in warns)
