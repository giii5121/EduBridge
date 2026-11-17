"""Pre-test vs post-test comparison.

Input: two long-format response tables (see responses.py) for the same students, scored by the
SAME frozen model (same item-parameter scale). The module matches students by identifier, checks
assessment comparability, infers mastery separately for pre and post, and reports:

  * per student: raw score change, per-concept mastery-probability change and label transitions
  * per concept (class level): mean change with student-bootstrap 95% CI, Wilcoxon signed-rank
    test (Holm-adjusted across concepts), paired effect size d_z and rank-biserial r,
    McNemar exact test on mastered / not-mastered transitions
  * overall raw score: paired t-test and Wilcoxon, d_z, bootstrap CI

Interpretation guard: without a control/comparison group (column ``group``) results are labelled
"observed change after the intervention period", never as a causal effect. With a control group a
gain comparison is added, still labelled non-causal unless the design is declared randomised.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

from .diagnosis import DiagnosisPolicy, mastery_label
from .models import PDINA
from .responses import parse_responses


def _boot_ci(d, reps=2000, seed=0):
    d = np.asarray(d, float)
    d = d[~np.isnan(d)]
    if len(d) < 2:
        return [np.nan, np.nan]
    rng = np.random.default_rng(seed)
    means = rng.choice(d, (reps, len(d)), replace=True).mean(1)
    return [float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))]


def _paired_tests(pre, post):
    d = np.asarray(post, float) - np.asarray(pre, float)
    d = d[~np.isnan(d)]
    out = {"n_pairs": int(len(d)), "mean_pre": float(np.nanmean(pre)) if len(d) else np.nan,
           "mean_post": float(np.nanmean(post)) if len(d) else np.nan, "mean_change": float(d.mean()) if len(d) else np.nan}
    out["mean_change_ci95"] = _boot_ci(d)
    sd = d.std(ddof=1) if len(d) > 1 else np.nan
    out["cohens_dz"] = float(d.mean() / sd) if len(d) > 1 and sd > 0 else np.nan
    nz = d[d != 0]
    if len(nz) >= 1 and len(d) >= 2:
        w = stats.wilcoxon(d, zero_method="wilcox", alternative="two-sided") if len(nz) > 0 else None
        out["wilcoxon_p"] = float(w.pvalue) if w is not None else np.nan
        ranks = stats.rankdata(np.abs(nz))
        rpos, rneg = ranks[nz > 0].sum(), ranks[nz < 0].sum()
        out["rank_biserial_r"] = float((rpos - rneg) / (rpos + rneg))
    else:
        out["wilcoxon_p"], out["rank_biserial_r"] = np.nan, np.nan
    if len(d) >= 2 and sd > 0:
        out["paired_t_p"] = float(stats.ttest_1samp(d, 0).pvalue)
    else:
        out["paired_t_p"] = np.nan
    return out


def _holm(p):
    p = np.asarray(p, float)
    ok = ~np.isnan(p)
    adj = np.full_like(p, np.nan)
    idx = np.where(ok)[0]
    order = idx[np.argsort(p[idx])]
    m = len(order)
    running = 0.0
    for r, i in enumerate(order):
        running = max(running, min(1.0, (m - r) * p[i]))
        adj[i] = running
    return adj


def check_comparability(model: PDINA, pre_long, post_long, items: pd.DataFrame | None, target_ids) -> dict:
    qpre, qpost = set(pre_long["QuestionId"]), set(post_long["QuestionId"])
    rep = {"same_item_set": qpre == qpost, "n_items_pre": len(qpre), "n_items_post": len(qpost),
           "n_shared_items": len(qpre & qpost), "same_model_scale": True,
           "scale_note": "Both tests are scored with the same frozen item parameters, so mastery probabilities are on one scale."}
    warns = []
    if items is not None:
        it = items.set_index("QuestionId")
        rows = []
        for c in target_ids:
            has = lambda qs: [q for q in qs if str(c) in str(it.loc[q, "concept_ids"]).split(";")]
            a, b = has(qpre), has(qpost)
            da = float(it.loc[a, "model_difficulty"].mean()) if a else np.nan
            db = float(it.loc[b, "model_difficulty"].mean()) if b else np.nan
            rows.append({"concept_id": int(c), "n_items_pre": len(a), "n_items_post": len(b),
                         "mean_difficulty_pre": da, "mean_difficulty_post": db})
            if len(a) != len(b):
                warns.append(f"concept {c}: different number of items pre ({len(a)}) vs post ({len(b)})")
            if a and b and abs(da - db) > 0.1:
                warns.append(f"concept {c}: mean model difficulty differs by {abs(da - db):.2f} between forms")
        rep["blueprint"] = rows
    if not rep["same_item_set"] and rep["n_shared_items"] == 0:
        rep["form_design"] = "parallel/different forms"
    elif rep["same_item_set"]:
        rep["form_design"] = "identical form (watch for retest/practice effects)"
    else:
        rep["form_design"] = "partially overlapping forms"
    rep["warnings"] = warns
    return rep


def compare_pre_post(model: PDINA, pre, post, policy: DiagnosisPolicy, concept_ids, concept_names,
                     items: pd.DataFrame | None = None, item_bank: pd.DataFrame | None = None,
                     randomized_design: bool = False, bootstrap_reps: int = 2000) -> dict:
    qids = np.asarray(model.question_ids).astype(int)
    pre_long, s_pre, X_pre, M_pre, info_pre = parse_responses(pre, qids, item_bank)
    post_long, s_post, X_post, M_post, info_post = parse_responses(post, qids, item_bank)
    matched = [s for s in s_pre if s in set(s_post)]
    only_pre = [s for s in s_pre if s not in set(s_post)]
    only_post = [s for s in s_post if s not in set(s_pre)]
    if not matched:
        raise ValueError("no student identifiers are present in both pre-test and post-test data")
    ip = pd.Index(s_pre).get_indexer(matched)
    iq = pd.Index(s_post).get_indexer(matched)
    Xa, Ma, Xb, Mb = X_pre[ip], M_pre[ip], X_post[iq], M_post[iq]
    pa, pb = model.infer(Xa, Ma), model.infer(Xb, Mb)
    cids = np.asarray(concept_ids).astype(int)
    tset = [int(c) for c in policy.target_concept_ids]
    tidx = [int(np.where(cids == c)[0][0]) for c in tset]

    # ---------------- per student
    score_pre = np.where(Ma.sum(1) > 0, (Xa * Ma).sum(1) / np.maximum(Ma.sum(1), 1), np.nan)
    score_post = np.where(Mb.sum(1) > 0, (Xb * Mb).sum(1) / np.maximum(Mb.sum(1), 1), np.nan)
    stud = pd.DataFrame({"student_id": matched, "n_answered_pre": Ma.sum(1), "n_answered_post": Mb.sum(1),
                         "score_pre": score_pre, "score_post": score_post, "score_change": score_post - score_pre})
    rows = []
    for k, c in zip(tidx, tset):
        lab_a = mastery_label(pa.pi[:, k], pa.n_evidence[:, k], policy)
        lab_b = mastery_label(pb.pi[:, k], pb.n_evidence[:, k], policy)
        for i, s in enumerate(matched):
            rows.append({"student_id": s, "concept_id": c, "concept_name": concept_names[k],
                         "mastery_prob_pre": pa.pi[i, k], "mastery_prob_post": pb.pi[i, k],
                         "mastery_change": pb.pi[i, k] - pa.pi[i, k],
                         "n_evidence_pre": int(pa.n_evidence[i, k]), "n_evidence_post": int(pb.n_evidence[i, k]),
                         "label_pre": lab_a[i], "label_post": lab_b[i]})
    sc = pd.DataFrame(rows)
    sc["both_diagnosable"] = (sc["label_pre"] != "insufficient_evidence") & (sc["label_post"] != "insufficient_evidence")
    sc["direction"] = np.where(~sc["both_diagnosable"], "not_comparable",
                               np.where(sc["mastery_change"] > policy.delta, "increase",
                                        np.where(sc["mastery_change"] < -policy.delta, "decrease", "stable")))

    # ---------------- per concept (class level)
    crow = []
    for c in tset:
        d = sc[(sc["concept_id"] == c) & sc["both_diagnosable"]]
        r = {"concept_id": c, "concept_name": sc.loc[sc["concept_id"] == c, "concept_name"].iloc[0],
             "n_students_matched": int((sc["concept_id"] == c).sum()), "n_both_diagnosable": int(len(d))}
        r.update(_paired_tests(d["mastery_prob_pre"].values, d["mastery_prob_post"].values))
        mp, mq = d["label_pre"] == "mastered", d["label_post"] == "mastered"
        b01, b10 = int((~mp & mq).sum()), int((mp & ~mq).sum())
        r.update({"n_not_to_mastered": b01, "n_mastered_to_not": b10,
                  "mcnemar_exact_p": float(stats.binomtest(min(b01, b10), b01 + b10, 0.5).pvalue) if b01 + b10 > 0 else np.nan,
                  "n_increase": int((d["direction"] == "increase").sum()), "n_decrease": int((d["direction"] == "decrease").sum())})
        crow.append(r)
    con = pd.DataFrame(crow)
    con["wilcoxon_p_holm"] = _holm(con["wilcoxon_p"].values)
    con["interpretation"] = np.where(con["n_both_diagnosable"] < 2, "insufficient paired data",
                                     np.where(con["wilcoxon_p_holm"] < 0.05,
                                              np.where(con["mean_change"] > 0, "observed increase (statistically detectable)", "observed decrease (statistically detectable)"),
                                              "no statistically detectable change"))

    overall = _paired_tests(stud["score_pre"].values, stud["score_post"].values)
    comp = check_comparability(model, pre_long, post_long, items, tset)

    # ---------------- design / control group
    groups = None
    if "group" in pre_long.columns:
        gmap = pre_long.drop_duplicates("student_id").set_index("student_id")["group"].astype(str).str.lower()
        stud["group"] = stud["student_id"].map(gmap)
        groups = sorted(stud["group"].dropna().unique().tolist())
    design = {"has_control_group": bool(groups and len(groups) >= 2), "groups": groups, "randomized_design_declared": randomized_design}
    if design["has_control_group"]:
        g0, g1 = groups[0], groups[1]
        a = stud.loc[stud["group"] == g0, "score_change"].dropna()
        b = stud.loc[stud["group"] == g1, "score_change"].dropna()
        design["gain_comparison"] = {"group_a": g0, "group_b": g1, "mean_gain_a": float(a.mean()), "mean_gain_b": float(b.mean()),
                                     "mannwhitney_p": float(stats.mannwhitneyu(a, b).pvalue) if len(a) and len(b) else np.nan}
    if design["has_control_group"] and randomized_design:
        claim = "Randomised comparison: gain differences between groups can support a causal interpretation, subject to design checks."
    elif design["has_control_group"]:
        claim = "Non-randomised comparison group: differences are associations (quasi-experimental), not proof of causation."
    else:
        claim = ("No control/comparison group: results are OBSERVED CHANGES after the intervention period and must not be "
                 "interpreted as evidence that the intervention caused them (maturation, retest and other effects are not ruled out).")
    summary = {"n_students_pre": len(s_pre), "n_students_post": len(s_post), "n_matched": len(matched),
               "unmatched_pre_only": only_pre, "unmatched_post_only": only_post,
               "overall_score": overall, "comparability": comp, "design": design, "interpretation_guard": claim,
               "policy": policy.to_dict(), "input_info": {"pre": info_pre, "post": info_post}}
    return {"summary": summary, "students": stud, "student_concepts": sc, "concepts": con}
