import numpy as np
import pandas as pd
import pytest

from cdacdm.assessment import AdaptiveSession, build_fixed_form, build_parallel_forms, item_information, item_parameter_table
from cdacdm.diagnosis import DiagnosisPolicy
from cdacdm.responses import ResponseValidationError, parse_responses

from conftest import CONCEPTS, NAMES, simulate


@pytest.fixture()
def items(small_model):
    X, M, _ = simulate(small_model.Q, 300, seed=1)
    return item_parameter_table(small_model, small_model.question_ids, CONCEPTS, NAMES, M, X, None, [101, 102, 103, 105], 10, 0.05)


def test_fixed_form_respects_length_and_coverage(items):
    form, cov = build_fixed_form(items, [101, 102, 103, 105], items_per_concept=3, max_length=7)
    assert len(form) <= 7 and form["QuestionId"].is_unique
    assert cov.set_index("concept_id").loc[105, "shortfall"]                  # concept without items is flagged
    assert set(form["blueprint_concept_id"]) <= {101, 102, 103}


def test_parallel_forms_disjoint_and_matched(items):
    a, b, bal = build_parallel_forms(items, [101, 102, 103], items_per_concept=2)
    assert not set(a["QuestionId"]) & set(b["QuestionId"])
    assert a["QuestionId"].is_unique and b["QuestionId"].is_unique      # multi-concept items are not reused
    assert (a.groupby("blueprint_concept_id").size() == b.groupby("blueprint_concept_id").size()).all()
    a2, b2, _ = build_parallel_forms(items, [101, 102, 103], items_per_concept=10)   # forces multi-concept items into the pool
    assert a2["QuestionId"].is_unique and b2["QuestionId"].is_unique and not set(a2["QuestionId"]) & set(b2["QuestionId"])


def test_information_prefers_uncertain_not_hardest():
    # same item parameters: information is maximal for rho near 0.5, not for the lowest success probability
    mi = item_information(np.array([0.05, 0.5, 0.95]), np.array([0.2] * 3), np.array([0.1] * 3))
    assert mi[1] > mi[0] and mi[1] > mi[2]
    # a hard but non-discriminating item (g=s=0.45) carries less information than a discriminating one
    assert item_information(np.array([0.5]), np.array([0.45]), np.array([0.45]))[0] < item_information(np.array([0.5]), np.array([0.2]), np.array([0.1]))[0]


def test_adaptive_session_runs_and_stops(small_model, items):
    pol = DiagnosisPolicy(0.5, 0.1, 2, [101, 102, 103])
    sess = AdaptiveSession(small_model, items, pol, max_length=6)
    first = sess.next_item()
    assert first is not None and first["QuestionId"] in set(items["QuestionId"])
    sess.run_with_oracle(lambda q: 1)
    assert len(sess.administered) <= 6
    assert len({tuple(small_model.Q[sess.qpos[q]]) for q in sess.administered}) >= 2   # covers several concepts


def test_response_parsing_valid_and_blank():
    qids = [1000, 1001, 1002]
    long, students, X, M, info = parse_responses(pd.DataFrame({"student_id": ["a", "a", "b"], "QuestionId": [1000, 1001, 1000],
                                                               "response": ["1", "", "0"]}), qids)
    assert M.sum() == 2 and info["n_blank"] == 1
    wide = pd.DataFrame({"student_id": ["a"], "q1000": ["1"], "1002": ["benar"]})
    _, _, X2, M2, _ = parse_responses(wide, qids)
    assert M2[0].tolist() == [True, False, True] and X2[0, 2] == 1


def test_response_parsing_errors():
    qids = [1000, 1001]
    with pytest.raises(ResponseValidationError, match="not in the model item bank"):
        parse_responses(pd.DataFrame({"student_id": ["a"], "QuestionId": [5], "response": [1]}), qids)
    with pytest.raises(ResponseValidationError, match="invalid response value"):
        parse_responses(pd.DataFrame({"student_id": ["a"], "QuestionId": [1000], "response": ["7"]}), qids)
    with pytest.raises(ResponseValidationError, match="conflicting duplicate"):
        parse_responses(pd.DataFrame({"student_id": ["a", "a"], "QuestionId": [1000, 1000], "response": [1, 0]}), qids)
    with pytest.raises(ResponseValidationError, match="student identifier"):
        parse_responses(pd.DataFrame({"QuestionId": [1000], "response": [1]}), qids)
    with pytest.raises(ResponseValidationError, match="empty"):
        parse_responses(pd.DataFrame(), qids)


def test_answer_option_scoring():
    bank = pd.DataFrame({"QuestionId": [1000, 1001], "correct_answer": [2, 4]})
    _, _, X, M, info = parse_responses(pd.DataFrame({"student_id": ["a", "a"], "QuestionId": [1000, 1001], "answer_option": [2, 1]}),
                                       [1000, 1001], bank)
    assert X[0].tolist() == [1.0, 0.0] and M.all()
