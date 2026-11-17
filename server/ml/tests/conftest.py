"""Shared fixtures: a small synthetic dataset in the same artifact format as the real pipeline,
plus a trained checkpoint produced by running the real Pipeline on it."""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cdacdm.models import PDINA  # noqa: E402

CONCEPTS = [101, 102, 103, 104, 105]   # 105 has no items on purpose
NAMES = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon (no items)"]


def make_q(n_items=40):
    Q = np.zeros((n_items, len(CONCEPTS)), int)
    for j in range(n_items):
        Q[j, j % 4] = 1
    Q[36, 0] = Q[36, 1] = 1          # a few multi-concept items
    Q[37, 2] = Q[37, 3] = 1
    return Q


def simulate(Q, n, seed, g=0.2, s=0.15, missing=0.3):
    rng = np.random.default_rng(seed)
    alpha = (rng.random((n, Q.shape[1])) < 0.5).astype(float)
    eta = (alpha @ Q.T) >= Q.sum(1)
    p = np.where(eta, 1 - s, g)
    X = (rng.random(p.shape) < p).astype(float)
    M = rng.random(p.shape) > missing
    return X, M, alpha


@pytest.fixture(scope="session")
def synth_dir(tmp_path_factory):
    d = tmp_path_factory.mktemp("synth")
    data = d / "final"
    data.mkdir()
    Q = make_q()
    qids = np.arange(1000, 1000 + Q.shape[0])
    qdf = pd.DataFrame(Q, columns=[str(c) for c in CONCEPTS])
    qdf.insert(0, "QuestionId", qids)
    qdf.to_csv(data / "q_matrix.csv", index=False)
    pd.DataFrame({"concept_index": range(5), "SubjectId": CONCEPTS, "concept_name": NAMES,
                  "path": [f"Maths > Algebra > {n}" for n in NAMES]}).to_csv(data / "concept_metadata.csv", index=False)
    sizes = {"train": 400, "val": 80, "test": 80}
    uid = 0
    all_tr = None
    for k, (split, n) in enumerate(sizes.items()):
        X, M, _ = simulate(Q, n, seed=k)
        users = np.arange(uid, uid + n)
        uid += n
        mat = np.where(M, X, -1).astype(np.int8)
        np.savez_compressed(data / f"responses_{split}.npz", matrix=mat, user_ids=users, question_ids=qids)
        r, c = np.where(M)
        df = pd.DataFrame({"UserId": users[r], "QuestionId": qids[c], "AnswerId": np.arange(len(r)), "IsCorrect": X[r, c].astype(int),
                           "DateAnswered": "2020-01-01 10:00:00", "question_pass_rate_z": 0.0, "prior_accuracy": 0.5, "split": split})
        df.to_csv(data / f"interactions_{split}.csv", index=False)
        if split == "train":
            all_tr = df
    st = all_tr.groupby("QuestionId")["IsCorrect"].agg(["mean", "size"]).reindex(qids)
    pd.DataFrame({"QuestionId": qids, "is_focus": True, "n_attempts": st["size"].values, "pass_rate": st["mean"].values,
                  "correct_answer": 1, "image_path": [f"images/{q}.jpg" for q in qids]}).to_csv(data / "cda_item_bank.csv", index=False)
    (data / "dataset_manifest.json").write_text(json.dumps({"artifact_source": "pytest_synthetic"}))
    (data / "eda_summary.json").write_text(json.dumps({"splits": sizes}))
    cfgd = d / "configs"
    cfgd.mkdir()
    pd.DataFrame({"concept_id": CONCEPTS, "concept_name": NAMES, "in_target_scope": [True, True, True, False, True],
                  "relevance_level": "test", "curriculum_order": [1, 2, 3, None, 4],
                  "prerequisite_concept_ids": ["", "101", "", "", ""]}).to_csv(cfgd / "target_concept_map.csv", index=False)
    pd.DataFrame({"topic_id": ["T1", "T2"], "domain": ["algebra", "calculus"], "level": "x", "topic_name": ["Topic one", "Limits"],
                  "mapped_eedi_concept_ids": ["101;102", ""], "mapping_type": ["partial", "unmapped"], "notes": ""}).to_csv(cfgd / "target_curriculum.csv", index=False)
    return d


@pytest.fixture(scope="session")
def trained_dir(synth_dir):
    from cdacdm.pipeline import Pipeline
    out = synth_dir / "artifacts"
    cfgd = synth_dir / "configs"
    ov = {
        "paths": {"data_dir": str(synth_dir / "final"), "output_dir": str(out),
                  "target_concept_map": str(cfgd / "target_concept_map.csv"), "target_curriculum": str(cfgd / "target_curriculum.csv"),
                  "intervention_map": str(cfgd / "intervention_map.csv"), "focus_item_content_audit": str(cfgd / "none.csv")},
        "data": {"expected_splits": {"train": 400, "val": 80, "test": 80}, "expected_n_questions": 40, "expected_n_concepts": 5},
        "model": {"hp_grid": {"prior": ["independent", "higher_order"], "gs_prior_strength": [10.0], "class_weighting": [False]},
                  "baselines": {"concept_score_strength": [5.0], "q_logistic_sigma": [1.0]}, "max_em_iter": 60},
        "evaluation": {"bootstrap_reps": 20, "simulation_students": 100, "min_items_per_concept_for_eval": 3},
        "assessment": {"min_train_attempts": 10, "replay_students": 10, "replay_lengths": [2, 4], "items_per_concept": None, "max_length": None},
    }
    Pipeline(None, ov, log=lambda *a, **k: None).run_all()
    return out


@pytest.fixture()
def small_model():
    Q = make_q()
    X, M, alpha = simulate(Q, 500, seed=11)
    m = PDINA(Q, prior="independent", gs_prior_strength=10, max_em_iter=80).fit(X, M)
    m.question_ids = np.arange(1000, 1000 + Q.shape[0])
    m.concept_ids = np.array(CONCEPTS)
    return m
