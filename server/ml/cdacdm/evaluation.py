"""Evaluation: response prediction metrics, calibration, per-concept metrics, bootstrap CIs,
split-half classification consistency and simulation-based recovery of mastery.

Response-prediction protocol (no leakage): for validation/test students the observed responses
are split *within each student* into a context set (used to infer mastery with item parameters
frozen from training) and a held-out target set (only used for scoring). The response being
predicted is therefore never used to infer the mastery that predicts it.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import (accuracy_score, brier_score_loss, f1_score, log_loss, precision_score, recall_score,
                             roc_auc_score)

from .models import EPS, PDINA


def heldout_split(M: np.ndarray, frac: float = 0.2, seed: int = 0, min_context: int = 5):
    """Random per-student split of observed cells into context / target masks."""
    rng = np.random.default_rng(seed)
    M = M.astype(bool)
    tgt = np.zeros_like(M)
    for i in range(M.shape[0]):
        obs = np.where(M[i])[0]
        n_t = int(np.floor(frac * len(obs)))
        if len(obs) - n_t < min_context:
            n_t = max(0, len(obs) - min_context)
        if n_t > 0:
            tgt[i, rng.choice(obs, n_t, replace=False)] = True
    return M & ~tgt, tgt


def binary_metrics(y, p, threshold: float = 0.5) -> dict:
    y = np.asarray(y).astype(int)
    p = np.clip(np.asarray(p, float), EPS, 1 - EPS)
    yhat = (p >= threshold).astype(int)
    out = {"n": int(len(y)), "base_rate": float(y.mean()), "log_loss": float(log_loss(y, p, labels=[0, 1])),
           "brier": float(brier_score_loss(y, p)), "accuracy": float(accuracy_score(y, yhat)),
           "precision": float(precision_score(y, yhat, zero_division=0)), "recall": float(recall_score(y, yhat, zero_division=0)),
           "f1": float(f1_score(y, yhat, zero_division=0)), "threshold": threshold}
    out["roc_auc"] = float(roc_auc_score(y, p)) if len(np.unique(y)) == 2 else float("nan")
    out["ece"] = expected_calibration_error(y, p)
    return out


def calibration_table(y, p, n_bins: int = 10) -> pd.DataFrame:
    y, p = np.asarray(y, float), np.asarray(p, float)
    edges = np.linspace(0, 1, n_bins + 1)
    b = np.clip(np.digitize(p, edges[1:-1]), 0, n_bins - 1)
    rows = []
    for k in range(n_bins):
        m = b == k
        rows.append({"bin": k, "p_low": edges[k], "p_high": edges[k + 1], "n": int(m.sum()),
                     "mean_predicted": float(p[m].mean()) if m.any() else np.nan,
                     "observed_rate": float(y[m].mean()) if m.any() else np.nan})
    return pd.DataFrame(rows)


def expected_calibration_error(y, p, n_bins: int = 10) -> float:
    t = calibration_table(y, p, n_bins)
    t = t[t["n"] > 0]
    return float((t["n"] * (t["mean_predicted"] - t["observed_rate"]).abs()).sum() / t["n"].sum())


def per_concept_metrics(y, p, item_idx, Q, concept_ids, concept_names, min_items: int = 5) -> pd.DataFrame:
    """Metrics of held-out predictions grouped by the concepts each item measures."""
    rows = []
    n_items_total = Q.sum(0)
    for k, (cid, name) in enumerate(zip(concept_ids, concept_names)):
        m = Q[item_idx, k] == 1
        r = {"concept_id": int(cid), "concept_name": name, "n_items_in_bank": int(n_items_total[k]),
             "n_heldout_responses": int(m.sum()), "n_items_evaluated": int(len(np.unique(item_idx[m])))}
        if m.sum() >= 2:
            mm = binary_metrics(y[m], p[m])
            r.update({k2: mm[k2] for k2 in ["roc_auc", "log_loss", "brier", "accuracy", "base_rate"]})
        r["limited_items_flag"] = bool(n_items_total[k] < min_items)
        rows.append(r)
    return pd.DataFrame(rows)


def bootstrap_metrics(y, p, student_of_cell, reps: int = 200, seed: int = 0) -> dict:
    """Student-clustered bootstrap CIs for AUC and log-loss."""
    rng = np.random.default_rng(seed)
    students = np.unique(student_of_cell)
    groups = {s: np.where(student_of_cell == s)[0] for s in students}
    aucs, lls = [], []
    for _ in range(reps):
        samp = rng.choice(students, len(students), replace=True)
        idx = np.concatenate([groups[s] for s in samp])
        yy, pp = y[idx], np.clip(p[idx], EPS, 1 - EPS)
        if len(np.unique(yy)) == 2:
            aucs.append(roc_auc_score(yy, pp))
        lls.append(log_loss(yy, pp, labels=[0, 1]))
    q = lambda a: [float(np.percentile(a, 2.5)), float(np.percentile(a, 97.5))]
    return {"roc_auc_ci95": q(aucs), "log_loss_ci95": q(lls), "reps": reps, "cluster": "student"}


def paired_bootstrap_difference(y, p_a, p_b, student_of_cell, reps=200, seed=0) -> dict:
    """CI of AUC(a)-AUC(b) and logloss(a)-logloss(b) with student-clustered resampling."""
    rng = np.random.default_rng(seed)
    students = np.unique(student_of_cell)
    groups = {s: np.where(student_of_cell == s)[0] for s in students}
    da, dl = [], []
    for _ in range(reps):
        idx = np.concatenate([groups[s] for s in rng.choice(students, len(students), replace=True)])
        yy = y[idx]
        if len(np.unique(yy)) == 2:
            da.append(roc_auc_score(yy, p_a[idx]) - roc_auc_score(yy, p_b[idx]))
        dl.append(log_loss(yy, np.clip(p_a[idx], EPS, 1 - EPS), labels=[0, 1]) - log_loss(yy, np.clip(p_b[idx], EPS, 1 - EPS), labels=[0, 1]))
    q = lambda a: [float(np.percentile(a, 2.5)), float(np.percentile(a, 97.5))]
    return {"auc_diff_ci95": q(da), "logloss_diff_ci95": q(dl), "auc_diff_mean": float(np.mean(da)), "logloss_diff_mean": float(np.mean(dl))}


# ------------------------------------------------------------------------------------
# Diagnosis-quality proxies (no ground-truth mastery is available in EEDI)
# ------------------------------------------------------------------------------------

def split_half_consistency(model: PDINA, X, M, concept_subset, tau: float, seed: int = 0) -> pd.DataFrame:
    """Classification consistency: infer mastery separately from two random halves of each student's
    responses and check whether the mastered / not-mastered label agrees. Returns one row per
    (student, concept) with the per-half evidence counts and both posteriors."""
    rng = np.random.default_rng(seed)
    half = rng.random(M.shape) < 0.5
    MA, MB = M & half, M & ~half
    pa, pb = model.infer(X, MA), model.infer(X, MB)
    rows = []
    for k in concept_subset:
        na, nb = pa.n_evidence[:, k], pb.n_evidence[:, k]
        ok = (na > 0) & (nb > 0)
        rows.append(pd.DataFrame({"student": np.where(ok)[0], "concept_index": k, "n_half_min": np.minimum(na, nb)[ok],
                                  "pi_a": pa.pi[ok, k], "pi_b": pb.pi[ok, k]}))
    df = pd.concat(rows, ignore_index=True) if rows else pd.DataFrame()
    if len(df):
        df["agree"] = (df["pi_a"] >= tau) == (df["pi_b"] >= tau)
    return df


def select_evidence_rules(cons: pd.DataFrame, tau: float, n_min_grid, delta_grid, target: float,
                          n_min_fallback: int, delta_fallback: float) -> tuple[dict, pd.DataFrame, pd.DataFrame]:
    """Choose n_min (minimum evidence) and delta (uncertainty band) from split-half consistency."""
    by_n = []
    for n in n_min_grid:
        d = cons[cons["n_half_min"] >= n]
        by_n.append({"n_min": n, "n_cells": int(len(d)), "consistency": float(d["agree"].mean()) if len(d) else np.nan})
    by_n = pd.DataFrame(by_n)
    ok = by_n[(by_n["consistency"] >= target) & (by_n["n_cells"] >= 30)]
    n_min = int(ok["n_min"].iloc[0]) if len(ok) else n_min_fallback
    sub = cons[cons["n_half_min"] >= n_min]
    by_d = []
    for dl in delta_grid:
        outside = sub[(np.abs(sub["pi_a"] - tau) >= dl) & (np.abs(sub["pi_b"] - tau) >= dl)]
        by_d.append({"delta": dl, "n_cells_outside_band": int(len(outside)), "share_outside_band": float(len(outside) / max(len(sub), 1)),
                     "consistency_outside_band": float(outside["agree"].mean()) if len(outside) else np.nan})
    by_d = pd.DataFrame(by_d)
    okd = by_d[(by_d["consistency_outside_band"] >= target) & (by_d["n_cells_outside_band"] >= 30)]
    delta = float(okd["delta"].iloc[0]) if len(okd) else delta_fallback
    rules = {"n_min": n_min, "n_min_selected_from_data": bool(len(ok)), "delta": delta, "delta_selected_from_data": bool(len(okd)),
             "target_consistency": target,
             "note": ("n_min is the per-half evidence at which agreement between two independent half-test classifications reaches "
                     "target_consistency; agreement between two noisy classifications understates the reliability of each, so the rule is conservative.")}
    return rules, by_n, by_d


def select_threshold(model: PDINA, X, M_ctx, M_tgt, tau_grid, target_concepts=None, reps: int = 200,
                     seed: int = 0) -> tuple[float, pd.DataFrame]:
    """Choose tau on validation students.

    Criterion: held-out log-likelihood of the hard-classification DINA prediction (labels = pi >= tau,
    p = 1-s if all required concepts are labelled mastered else g). Because g and s are asymmetric the
    optimum need not be 0.5. The curve is usually flat, so a one-standard-error rule is applied:
    among taus whose loss is within one student-bootstrap SE of the minimum, the tau closest to 0.5
    (the symmetric Bayes decision point for a calibrated posterior) is selected.
    """
    post = model.infer(X, M_ctx)
    rows_idx = np.where(M_tgt)[0]
    y = X[M_tgt]
    students = np.unique(rows_idx)
    per_student = []
    rows = []
    for t in tau_grid:
        labels = (post.pi >= t).astype(float)
        p = np.clip(model.predict_from_labels(labels)[M_tgt], EPS, 1 - EPS)
        nll = -(y * np.log(p) + (1 - y) * np.log(1 - p))
        per_student.append(np.bincount(rows_idx, weights=nll, minlength=X.shape[0])[students])
        m = binary_metrics(y, p)
        share = float((post.pi[:, target_concepts] < t).mean()) if target_concepts is not None else np.nan
        rows.append({"tau": t, "heldout_log_loss_hard": m["log_loss"], "heldout_accuracy_hard": m["accuracy"],
                     "heldout_auc_hard": m["roc_auc"], "share_target_cells_below_tau": share})
    tab = pd.DataFrame(rows)
    ib = int(tab["heldout_log_loss_hard"].idxmin())
    cnt = np.bincount(rows_idx, minlength=X.shape[0])[students]
    S = np.vstack(per_student)  # (n_tau, n_students) summed NLL
    rng = np.random.default_rng(seed)
    boot = np.empty((reps, len(tau_grid)))
    for r in range(reps):
        s = rng.integers(0, len(students), len(students))
        boot[r] = S[:, s].sum(1) / cnt[s].sum()
    se_diff = (boot - boot[:, [ib]]).std(0)
    tab["loss_minus_best"] = tab["heldout_log_loss_hard"] - tab["heldout_log_loss_hard"].iloc[ib]
    tab["se_of_difference"] = se_diff
    tab["within_1se_of_best"] = tab["loss_minus_best"] <= np.maximum(se_diff, 1e-12)
    cand = tab[tab["within_1se_of_best"]]
    chosen = float(cand.loc[(cand["tau"] - 0.5).abs().idxmin(), "tau"])
    tab["selected"] = tab["tau"] == chosen
    tab["argmin_tau"] = float(tab["tau"].iloc[ib])
    return chosen, tab


def simulate_recovery(model: PDINA, M_template, tau: float, concept_subset, seed: int = 0, n_students: int | None = None) -> tuple[dict, pd.DataFrame]:
    """Simulation under the fitted model: draw alpha from the learned prior, generate responses
    on real missingness patterns, re-infer mastery and compare with the known alpha.
    This measures recovery when the model is correctly specified (an optimistic upper bound)."""
    rng = np.random.default_rng(seed)
    M = M_template.astype(bool)
    if n_students is not None and n_students != M.shape[0]:
        M = M[rng.integers(0, M.shape[0], n_students)]
    N = M.shape[0]
    theta = rng.standard_normal(N)
    lam = model._prior_prob(theta)
    alpha = (rng.random((N, model.K)) < lam).astype(float)
    eta = model._rho(np.clip(alpha, EPS, 1)) > 0.5
    p = np.where(eta, 1 - model.s, model.g)
    X = (rng.random(p.shape) < p).astype(float) * M
    post = model.infer(X, M)
    rows = []
    for k in concept_subset:
        a, pi, n = alpha[:, k], post.pi[:, k], post.n_evidence[:, k]
        has = n > 0
        r = {"concept_index": int(k), "n_students_with_evidence": int(has.sum()), "true_mastery_rate": float(a.mean())}
        if has.sum() > 1:
            lab = pi[has] >= tau
            r["accuracy_with_evidence"] = float((lab == (a[has] == 1)).mean())
            r["auc_with_evidence"] = float(roc_auc_score(a[has], pi[has])) if len(np.unique(a[has])) == 2 else np.nan
            r["mean_evidence"] = float(n[has].mean())
        r["accuracy_without_evidence"] = float(((pi[~has] >= tau) == (a[~has] == 1)).mean()) if (~has).any() else np.nan
        rows.append(r)
    tab = pd.DataFrame(rows)
    ks = list(concept_subset)
    has_all = post.n_evidence[:, ks] > 0
    lab_all = post.pi[:, ks] >= tau
    acc_all = (lab_all == (alpha[:, ks] == 1))
    summary = {"n_simulated_students": int(N), "tau": tau,
               "attribute_accuracy_with_evidence": float(acc_all[has_all].mean()) if has_all.any() else None,
               "attribute_accuracy_without_evidence": float(acc_all[~has_all].mean()) if (~has_all).any() else None,
               "label": "SIMULATION under the fitted model (not real ground truth)"}
    return summary, tab


def recover_item_parameters(model: PDINA, M_template, seed: int = 0, **fit_kwargs) -> dict:
    """Parameter recovery: simulate a training set from the fitted model, refit, correlate g/s."""
    rng = np.random.default_rng(seed)
    M = M_template.astype(bool)
    theta = rng.standard_normal(M.shape[0])
    alpha = (rng.random((M.shape[0], model.K)) < model._prior_prob(theta)).astype(float)
    eta = model._rho(np.clip(alpha, EPS, 1)) > 0.5
    X = (rng.random(M.shape) < np.where(eta, 1 - model.s, model.g)).astype(float) * M
    m2 = PDINA(model.Q, prior=model.prior, gs_prior_strength=model.kappa, **fit_kwargs).fit(X, M)
    n = M.sum(0)
    ok = n >= 30
    return {"n_items_with_30plus_responses": int(ok.sum()),
            "guess_corr": float(np.corrcoef(model.g[ok], m2.g[ok])[0, 1]), "slip_corr": float(np.corrcoef(model.s[ok], m2.s[ok])[0, 1]),
            "guess_mae": float(np.abs(model.g[ok] - m2.g[ok]).mean()), "slip_mae": float(np.abs(model.s[ok] - m2.s[ok]).mean()),
            "label": "SIMULATION: item-parameter recovery on train-sized data generated from the fitted model"}
