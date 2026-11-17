import time

import numpy as np

from cdacdm.diagnosis import DiagnosisPolicy, build_profiles, detect_learning_gaps
from cdacdm.models import PDINA

from conftest import CONCEPTS, NAMES, make_q, simulate


def test_missing_response_is_not_wrong(small_model):
    m = small_model
    X = np.zeros((2, m.J))
    M = np.zeros((2, m.J), bool)
    X[1, :] = 1.0                      # values under a False mask must be ignored
    post = m.infer(X, M)
    assert np.allclose(post.pi[0], post.pi[1])
    assert np.allclose(post.pi[0], m.lam)            # no evidence -> prior
    # answering one item wrong lowers mastery; leaving it blank does not
    X2, M2 = np.zeros((1, m.J)), np.zeros((1, m.J), bool)
    M2[0, 0] = True
    wrong = m.infer(X2, M2).pi[0, 0]
    assert wrong < m.lam[0]


def test_concept_without_items_falls_back_to_prior_and_is_flagged(small_model):
    m = small_model
    X, M, _ = simulate(m.Q, 5, seed=3)
    post = m.infer(X, M)
    assert (post.n_evidence[:, 4] == 0).all()
    assert np.allclose(post.pi[:, 4], m.lam[4])
    pol = DiagnosisPolicy(0.5, 0.1, 2, CONCEPTS)
    prof = build_profiles(post, [f"s{i}" for i in range(5)], CONCEPTS, NAMES, pol)
    assert (prof.loc[prof["concept_id"] == 105, "mastery_label"] == "insufficient_evidence").all()
    gaps = detect_learning_gaps(prof, pol)
    assert not (gaps.loc[gaps["concept_id"] == 105, "gap_status"] == "learning_gap").any()


def test_new_student_does_not_change_item_parameters(small_model):
    m = small_model
    g, s, lam = m.g.copy(), m.s.copy(), m.lam.copy()
    X, M, _ = simulate(m.Q, 3, seed=99)
    m.infer(X, M)
    assert np.array_equal(g, m.g) and np.array_equal(s, m.s) and np.array_equal(lam, m.lam)


def test_incomplete_responses(small_model):
    m = small_model
    X = np.zeros((1, m.J))
    M = np.zeros((1, m.J), bool)
    items_c0 = np.where((m.Q[:, 0] == 1) & (m.Q.sum(1) == 1))[0][:4]
    X[0, items_c0], M[0, items_c0] = 1, True
    post = m.infer(X, M)
    assert post.n_evidence[0, 0] == 4 and post.n_evidence[0, 1] == 0
    assert post.pi[0, 0] > 0.9
    pol = DiagnosisPolicy(0.5, 0.1, 2, CONCEPTS)
    prof = build_profiles(post, ["new"], CONCEPTS, NAMES, pol).set_index("concept_id")
    assert prof.loc[101, "mastery_label"] == "mastered"
    assert prof.loc[102, "mastery_label"] == "insufficient_evidence"


def test_recovers_simulated_mastery():
    Q = make_q()
    X, M, alpha = simulate(Q, 800, seed=5, missing=0.2)
    m = PDINA(Q, gs_prior_strength=10, max_em_iter=100).fit(X, M)
    assert abs(m.g[m.Q.sum(1) == 1].mean() - 0.2) < 0.05 and abs(m.s[m.Q.sum(1) == 1].mean() - 0.15) < 0.05
    acc = ((m.infer(X, M).pi[:, :4] >= 0.5) == (alpha[:, :4] == 1)).mean()
    assert acc > 0.9
    assert all(np.diff(m.history[1:]) > -1e-6 * abs(m.history[-1]))   # ELBO non-decreasing (up to tolerance)


def test_higher_order_prior_and_57_concepts_without_enumeration():
    rng = np.random.default_rng(0)
    K, J = 57, 300
    Q = np.zeros((J, K), int)
    Q[np.arange(J), rng.integers(0, K, J)] = 1
    Q[:10, 0] = 1
    X = (rng.random((200, J)) < 0.5).astype(float)
    M = rng.random((200, J)) < 0.3
    t = time.time()
    m = PDINA(Q, prior="higher_order", max_em_iter=20).fit(X, M)
    post = m.infer(X[:3], M[:3])
    assert post.pi.shape == (3, K) and time.time() - t < 60


def test_save_load_roundtrip(small_model, tmp_path):
    small_model.save(tmp_path)
    m2 = PDINA.load(tmp_path)
    X, M, _ = simulate(small_model.Q, 4, seed=2)
    assert np.allclose(small_model.infer(X, M).pi, m2.infer(X, M).pi)
    assert np.array_equal(m2.concept_ids, small_model.concept_ids)
