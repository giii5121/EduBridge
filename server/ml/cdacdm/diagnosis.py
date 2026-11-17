"""Mastery profiles, mastery labels, learning-gap detection and class aggregation.

Labels (per student x concept):
  * ``insufficient_evidence`` : fewer than n_min observed responses on the concept
                                (pi is then mostly the prior -> NOT a learning gap)
  * ``uncertain``             : enough evidence but |pi - tau| < delta
  * ``not_mastered``          : pi < tau - delta            -> learning gap
  * ``mastered``              : pi >= tau + delta

A learning gap is a TARGET concept labelled ``not_mastered``. pi is a model-based posterior
probability, not verified ground-truth mastery.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field

import numpy as np
import pandas as pd

from .models import MasteryPosterior, bern_entropy


@dataclass
class DiagnosisPolicy:
    tau: float = 0.5
    delta: float = 0.1
    n_min: int = 2
    target_concept_ids: list = field(default_factory=list)
    provenance: dict = field(default_factory=dict)

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, d):
        return cls(**{k: d[k] for k in ["tau", "delta", "n_min", "target_concept_ids", "provenance"] if k in d})


def mastery_label(pi, n_ev, policy: DiagnosisPolicy):
    pi, n_ev = np.asarray(pi), np.asarray(n_ev)
    lab = np.where(pi >= policy.tau + policy.delta, "mastered",
                   np.where(pi < policy.tau - policy.delta, "not_mastered", "uncertain"))
    return np.where(n_ev < policy.n_min, "insufficient_evidence", lab)


def build_profiles(post: MasteryPosterior, student_ids, concept_ids, concept_names, policy: DiagnosisPolicy,
                   only_target: bool = False) -> pd.DataFrame:
    """Long-format profile: one row per student x concept."""
    N, K = post.pi.shape
    cids = np.asarray(concept_ids)
    tset = set(int(c) for c in policy.target_concept_ids)
    kk = [k for k in range(K) if (int(cids[k]) in tset or not only_target)]
    sid = np.repeat(np.asarray(student_ids), len(kk))
    k_rep = np.tile(kk, N)
    pi = post.pi[:, kk].ravel()
    n_ev = post.n_evidence[:, kk].ravel()
    df = pd.DataFrame({
        "student_id": sid, "concept_id": cids[k_rep].astype(int), "concept_name": np.asarray(concept_names, dtype=object)[k_rep],
        "is_target_concept": [int(c) in tset for c in cids[k_rep]],
        "mastery_prob": pi, "mastery_label": mastery_label(pi, n_ev, policy),
        "n_evidence": n_ev, "n_correct": post.n_correct[:, kk].ravel(),
        "prior_mastery_prob": post.prior[:, kk].ravel(),
        "posterior_sd": np.sqrt(pi * (1 - pi)), "entropy_bits": bern_entropy(pi),
    })
    df["observed_score"] = np.where(df["n_evidence"] > 0, df["n_correct"] / df["n_evidence"].clip(lower=1), np.nan)
    df["tau"] = policy.tau
    return df


def detect_learning_gaps(profiles: pd.DataFrame, policy: DiagnosisPolicy, include_needs_data: bool = True) -> pd.DataFrame:
    """Rank target concepts below tau. Gaps (sufficient evidence) are listed before 'needs more data'.

    priority_score = need * certainty, need = (tau - pi) / tau, certainty = 1 - entropy(pi).
    """
    t = profiles[profiles["is_target_concept"]].copy()
    t["gap_status"] = np.select(
        [t["mastery_label"] == "not_mastered", t["mastery_label"] == "uncertain",
         (t["mastery_label"] == "insufficient_evidence") & (t["mastery_prob"] < policy.tau)],
        ["learning_gap", "possible_gap_uncertain", "needs_more_data"], default="no_gap")
    t = t[t["gap_status"] != "no_gap"]
    if not include_needs_data:
        t = t[t["gap_status"] != "needs_more_data"]
    t = t[(t["gap_status"] != "possible_gap_uncertain") | (t["mastery_prob"] < policy.tau)]
    t["need"] = ((policy.tau - t["mastery_prob"]) / policy.tau).clip(lower=0)
    t["certainty"] = 1 - t["entropy_bits"]
    t["priority_score"] = t["need"] * t["certainty"]
    order = {"learning_gap": 0, "possible_gap_uncertain": 1, "needs_more_data": 2}
    t["status_rank"] = t["gap_status"].map(order)
    t = t.sort_values(["student_id", "status_rank", "priority_score"], ascending=[True, True, False])
    t["rank_within_student"] = t.groupby("student_id").cumcount() + 1
    return t.drop(columns=["status_rank"]).reset_index(drop=True)


def class_summary(profiles: pd.DataFrame) -> pd.DataFrame:
    """Per target concept: share of diagnosable students with a gap, share lacking evidence, mean pi."""
    t = profiles[profiles["is_target_concept"]]
    g = t.groupby(["concept_id", "concept_name"])
    out = g.agg(n_students=("student_id", "nunique"), mean_mastery_prob=("mastery_prob", "mean"),
                n_mastered=("mastery_label", lambda s: int((s == "mastered").sum())),
                n_not_mastered=("mastery_label", lambda s: int((s == "not_mastered").sum())),
                n_uncertain=("mastery_label", lambda s: int((s == "uncertain").sum())),
                n_insufficient=("mastery_label", lambda s: int((s == "insufficient_evidence").sum())),
                mean_evidence=("n_evidence", "mean")).reset_index()
    diag = out["n_mastered"] + out["n_not_mastered"] + out["n_uncertain"]
    out["n_diagnosable"] = diag
    out["gap_share_among_diagnosable"] = np.where(diag > 0, out["n_not_mastered"] / diag.clip(lower=1), np.nan)
    out["insufficient_share"] = out["n_insufficient"] / out["n_students"]
    return out.sort_values("gap_share_among_diagnosable", ascending=False).reset_index(drop=True)


def student_summary(profiles: pd.DataFrame) -> pd.DataFrame:
    t = profiles[profiles["is_target_concept"]]
    return t.groupby("student_id").agg(
        n_target_concepts=("concept_id", "count"),
        n_mastered=("mastery_label", lambda s: int((s == "mastered").sum())),
        n_gaps=("mastery_label", lambda s: int((s == "not_mastered").sum())),
        n_uncertain=("mastery_label", lambda s: int((s == "uncertain").sum())),
        n_insufficient=("mastery_label", lambda s: int((s == "insufficient_evidence").sum())),
        mean_mastery_prob=("mastery_prob", "mean"), total_evidence=("n_evidence", "sum")).reset_index()
