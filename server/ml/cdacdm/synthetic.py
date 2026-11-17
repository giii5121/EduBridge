"""SYNTHETIC pre/post data for demonstrating the comparison pipeline.

Everything produced here is a SIMULATION generated from the fitted model's parameters. It is not
EEDI student data, not a classroom experiment, and says nothing about real learning gains. All
student ids start with 'SIM-' and every row carries ``is_synthetic = True``.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .models import EPS, PDINA


def generate_synthetic_prepost(model: PDINA, pre_question_ids, post_question_ids, n_students: int = 40,
                               gain_prob: float = 0.4, retain_prob: float = 0.95, missing_rate: float = 0.05,
                               seed: int = 0, with_control: bool = False):
    """Simulate mastery alpha_pre from the learned prior, alpha_post by flipping non-mastered
    concepts to mastered with ``gain_prob`` (treatment) and keeping mastered ones with
    ``retain_prob``; responses follow the DINA likelihood with the learned g/s.
    Returns (pre_df, post_df, truth_df)."""
    rng = np.random.default_rng(seed)
    qpos = {int(q): i for i, q in enumerate(model.question_ids)}
    theta = rng.standard_normal(n_students)
    a_pre = (rng.random((n_students, model.K)) < model._prior_prob(theta)).astype(float)
    groups = np.where(np.arange(n_students) % 2 == 0, "treatment", "control") if with_control else np.array(["treatment"] * n_students)
    gp = np.where(groups == "treatment", gain_prob, gain_prob * 0.25)[:, None]
    a_post = np.where(a_pre == 1, (rng.random(a_pre.shape) < retain_prob), (rng.random(a_pre.shape) < gp)).astype(float)
    ids = [f"SIM-{i + 1:03d}" for i in range(n_students)]

    def responses(alpha, qs, tag):
        idx = np.array([qpos[int(q)] for q in qs])
        eta = np.exp(np.log(np.clip(alpha, EPS, 1)) @ model.Q[idx].T) > 0.5
        p = np.where(eta, 1 - model.s[idx], model.g[idx])
        x = (rng.random(p.shape) < p).astype(float)
        miss = rng.random(p.shape) < missing_rate
        rows = []
        for i, s in enumerate(ids):
            for j, q in enumerate(qs):
                rows.append({"student_id": s, "QuestionId": int(q), "response": "" if miss[i, j] else int(x[i, j]),
                             "form_id": tag, "group": groups[i], "is_synthetic": True})
        return pd.DataFrame(rows)

    pre = responses(a_pre, list(pre_question_ids), "PRE")
    post = responses(a_post, list(post_question_ids), "POST")
    truth = pd.DataFrame([{"student_id": s, "concept_id": int(model.concept_ids[k]), "alpha_pre": int(a_pre[i, k]),
                           "alpha_post": int(a_post[i, k]), "group": groups[i], "is_synthetic": True}
                          for i, s in enumerate(ids) for k in range(model.K)])
    return pre, post, truth
