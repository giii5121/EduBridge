"""End-to-end training / validation / single test evaluation / inference pipeline.

    python -m cdacdm.pipeline --config configs/experiment.json [--fast]

Data discipline
  * item parameters, priors, class weights      -> train split only
  * hyper-parameters, tau, n_min, delta          -> validation split only
  * test split                                   -> evaluated ONCE with everything frozen
"""
from __future__ import annotations

import argparse
import json
import shutil
import time
from pathlib import Path

import numpy as np
import pandas as pd

from . import plots
from .assessment import (build_fixed_form, build_parallel_forms, concept_item_adequacy, item_parameter_table,
                         simulate_adaptive_replay)
from .config import PROJECT_ROOT, load_config, resolve_data_dir, resolve_output_dir, resolve_path
from .data import load_artifacts
from .diagnosis import DiagnosisPolicy, build_profiles, class_summary, detect_learning_gaps, student_summary
from .evaluation import (binary_metrics, bootstrap_metrics, calibration_table, heldout_split, paired_bootstrap_difference,
                         per_concept_metrics, recover_item_parameters, select_evidence_rules, select_threshold,
                         simulate_recovery, split_half_consistency)
from .intervention import create_placeholder_map, load_intervention_map, recommend_intervention
from .models import ConceptScoreBaseline, ItemMeanBaseline, PDINA, QLogisticBaseline
from .prepost import compare_pre_post
from .qmatrix import (analyze_q_matrix, coverage_report, focus_item_audit, load_target_concept_map, target_concepts,
                      target_q_matrix, write_json)
from .responses import response_template
from .synthetic import generate_synthetic_prepost

PACKAGE_VERSION = "1.0.0"


class Pipeline:
    def __init__(self, config_path=None, overrides=None, log=print):
        self.cfg = load_config(config_path, overrides)
        self.log = log
        self.seed = int(self.cfg.get("seed", 42))
        self.data_dir = resolve_data_dir(self.cfg)
        self.out = resolve_output_dir(self.cfg)
        for d in ["audit", "model", "evaluation", "evaluation/figures", "diagnosis", "assessment", "intervention", "prepost", "demo"]:
            (self.out / d).mkdir(parents=True, exist_ok=True)
        self.summary: dict = {"package_version": PACKAGE_VERSION, "experiment": self.cfg.get("experiment_name"),
                              "data_dir": str(self.data_dir), "output_dir": str(self.out), "timings_sec": {}}
        self._test_done = False
        self.log(f"data_dir : {self.data_dir}\noutput   : {self.out}")

    def _t(self, name, t0):
        self.summary["timings_sec"][name] = round(time.time() - t0, 1)

    # ------------------------------------------------------------------ 1. audit
    def step_audit(self):
        t0 = time.time()
        self.bundle = b = load_artifacts(self.data_dir, self.cfg)
        audit = dict(b.audit)
        leakage = audit.pop("leakage")
        write_json(audit, self.out / "audit/data_audit.json")
        write_json(leakage, self.out / "audit/leakage_audit.json")
        tr = b.splits["train"]
        y = tr.X[tr.M]
        self.class_weights = {"0": float(len(y) / (2 * (y == 0).sum())), "1": float(len(y) / (2 * (y == 1).sum()))}
        eda_w = b.eda.get("binary_class_weights")
        self.summary["data"] = {
            "artifact_source": audit["artifact_source"],
            "splits": {s: audit["splits"][s]["n_students"] for s in b.splits},
            "splits_match_expected": all(audit["splits"][s]["count_matches_expected"] for s in b.splits),
            "student_disjoint": audit["student_disjoint"], "n_items": int(len(b.question_ids)), "n_concepts": int(len(b.concept_ids)),
            "missing_encoding": {s: audit["splits"][s].get("npz_encoding", {}).get("missing_scheme") for s in b.splits},
            "npz_csv_alignment": {s: audit["splits"][s].get("alignment_npz_vs_csv", {}).get("aligned") for s in b.splits},
            "train_class_weights": self.class_weights, "eda_class_weights": eda_w,
            "class_weights_match_eda": None if not eda_w else all(abs(self.class_weights[k] - float(eda_w[k])) < 1e-9 for k in ["0", "1"]),
            "item_bank_stats_source": audit["item_bank_stats_source"],
            "leakage_columns_excluded": sorted({c for s in leakage.values() for c, r in s["roles"].items() if r == "excluded_leakage_prone"}),
            "population_note": b.manifest.get("population_note") or (
                "EEDI Task 3/4 is a development dataset (UK learners, mostly lower secondary); "
                f"students aged 16-17 by metadata proxy: {b.eda.get('students_16_17_proxy', 'n/a')}. "
                "It does not represent the target SMA classes."),
        }
        self._t("audit", t0)
        self.log(json.dumps(self.summary["data"], indent=1, default=str))
        return self.summary["data"]

    # ------------------------------------------------------------------ 2. concepts
    def step_concepts(self):
        t0 = time.time()
        b = self.bundle
        paths = self.cfg["paths"]
        min_items = int(self.cfg["evaluation"]["min_items_per_concept_for_eval"])
        qsum, ctab, multi = analyze_q_matrix(b.Q, b.question_ids, b.concept_ids, b.concept_names, min_items)
        self.tm = load_target_concept_map(resolve_path(paths["target_concept_map"]), b.concept_ids)
        self.target_ids = target_concepts(self.tm)
        ctab = ctab.merge(self.tm[["concept_id", "in_target_scope", "relevance_level"]], on="concept_id", how="left")
        ctab.to_csv(self.out / "audit/concept_item_counts.csv", index=False)
        multi.to_csv(self.out / "audit/multi_concept_items.csv", index=False)
        tq, tinfo = target_q_matrix(b.Q, b.question_ids, b.concept_ids, self.target_ids)
        tq.to_csv(self.out / "audit/q_matrix_target.csv", index=False)
        ca_path = resolve_path(paths.get("focus_item_content_audit"))
        ca = pd.read_csv(ca_path) if ca_path and ca_path.exists() else None
        fa, fsum = focus_item_audit(b.item_bank, b.Q, b.question_ids, b.concept_ids, b.concept_meta, self.tm, ca)
        fa.to_csv(self.out / "audit/focus_item_audit.csv", index=False)
        self.concept_table = ctab
        self.summary["q_matrix"] = qsum
        self.summary["target_q_matrix"] = tinfo
        self.summary["focus_audit"] = fsum
        self.summary["target_concepts"] = [{"concept_id": c, "concept_name": b.concept_names[list(b.concept_ids).index(c)],
                                            "n_items": int(b.Q[:, list(b.concept_ids).index(c)].sum())} for c in self.target_ids]
        write_json({"q_matrix": qsum, "target_q_matrix": tinfo, "focus_audit": fsum}, self.out / "audit/q_matrix_analysis.json")
        self._t("concepts", t0)
        self.log(json.dumps({"q_matrix": qsum, "target": tinfo, "focus": fsum}, indent=1, default=str))
        return qsum, tinfo, fsum

    # ------------------------------------------------------------------ 3. model selection (train -> val)
    def _pdina(self, prior, kappa, cw):
        m = self.cfg["model"]
        model = PDINA(self.bundle.Q, prior=prior, gs_prior_strength=kappa, class_weights=self.class_weights if cw else None,
                      guess_prior_mean=m["guess_prior_mean"], slip_prior_mean=m["slip_prior_mean"], max_em_iter=m["max_em_iter"],
                      em_tol=m["em_tol"], e_step_iter=m["e_step_iter"], max_guess_slip_sum=m["max_guess_slip_sum"])
        model.question_ids, model.concept_ids = self.bundle.question_ids, self.bundle.concept_ids
        return model

    def step_model_selection(self):
        t0 = time.time()
        b, ev = self.bundle, self.cfg["evaluation"]
        tr, va = b.splits["train"], b.splits["val"]
        self.val_ctx, self.val_tgt = heldout_split(va.M, ev["heldout_fraction"], self.seed + 1, ev["min_context_responses"])
        grid = self.cfg["model"]["hp_grid"]
        rows, self.models = [], {}
        yv = va.X[self.val_tgt]
        for prior in grid["prior"]:
            for kappa in grid["gs_prior_strength"]:
                for cw in grid["class_weighting"]:
                    t1 = time.time()
                    m = self._pdina(prior, kappa, cw).fit(tr.X, tr.M)
                    P = m.predict_proba(m.infer(va.X, self.val_ctx))
                    met = binary_metrics(yv, P[self.val_tgt])
                    key = f"pdina|{prior}|k={kappa}|cw={cw}"
                    self.models[key] = m
                    rows.append({"model": key, "family": "pdina", "prior": prior, "gs_prior_strength": kappa, "class_weighting": cw,
                                 "n_em_iter": m.n_em_iter, "fit_sec": round(time.time() - t1, 1), **{f"val_{k}": v for k, v in met.items()}})
                    self.log(f"  {key:40s} val logloss={met['log_loss']:.4f} auc={met['roc_auc']:.4f} ({time.time() - t1:.0f}s)")
        bl = self.cfg["model"]["baselines"]
        cands = [("item_mean", ItemMeanBaseline(b.Q), {})]
        cands += [(f"concept_score|k={k}", ConceptScoreBaseline(b.Q, k), {"strength": k}) for k in bl["concept_score_strength"]]
        cands += [(f"q_logistic|sigma={s}", QLogisticBaseline(b.Q, s), {"sigma": s}) for s in bl["q_logistic_sigma"]]
        for key, m, hp in cands:
            t1 = time.time()
            m.fit(tr.X, tr.M)
            P = m.predict_proba(m.infer(va.X, self.val_ctx))
            met = binary_metrics(yv, P[self.val_tgt])
            self.models[key] = m
            rows.append({"model": key, "family": key.split("|")[0], **hp, "fit_sec": round(time.time() - t1, 1),
                         **{f"val_{k}": v for k, v in met.items()}})
            self.log(f"  {key:40s} val logloss={met['log_loss']:.4f} auc={met['roc_auc']:.4f}")
        hp = pd.DataFrame(rows)
        hp.to_csv(self.out / "evaluation/hp_search_validation.csv", index=False)
        best = {}
        for fam, d in hp.groupby("family"):
            best[fam] = d.loc[d["val_log_loss"].idxmin(), "model"]
        pd_ind = hp[(hp["family"] == "pdina") & (hp["prior"] == "independent")]
        if len(pd_ind):
            best["pdina_independent"] = pd_ind.loc[pd_ind["val_log_loss"].idxmin(), "model"]
        self.best = best
        self.main_key = best["pdina"]
        self.model = self.models[self.main_key]
        self.summary["model_selection"] = {"criterion": "validation held-out log-loss (lower is better)", "selected": best,
                                           "main_model": self.main_key, "main_model_hyperparams": self.model.hyperparams()}
        plots.bar_h(hp.assign(name=hp["model"]), "val_log_loss", "name", "Validation held-out log-loss (lower is better)",
                    self.out / "evaluation/figures/hp_search_val_logloss.png")
        self._t("model_selection", t0)
        return hp

    # ------------------------------------------------------------------ 4. diagnosis policy (val)
    def step_policy(self):
        t0 = time.time()
        b, dc = self.bundle, self.cfg["diagnosis"]
        va = b.splits["val"]
        tidx = [list(b.concept_ids).index(c) for c in self.target_ids]
        tau, ttab = select_threshold(self.model, va.X, self.val_ctx, self.val_tgt, dc["tau_grid"], tidx, seed=self.seed)
        ttab.to_csv(self.out / "evaluation/threshold_selection_validation.csv", index=False)
        cons = split_half_consistency(self.model, va.X, va.M, tidx, tau, seed=self.seed + 3)
        rules, by_n, by_d = select_evidence_rules(cons, tau, dc["n_min_grid"], dc["delta_grid"], dc["target_consistency"],
                                                  dc["n_min_fallback"], dc["delta_fallback"])
        by_n.to_csv(self.out / "evaluation/consistency_by_evidence_validation.csv", index=False)
        by_d.to_csv(self.out / "evaluation/consistency_by_band_validation.csv", index=False)
        self.policy = DiagnosisPolicy(tau=tau, delta=rules["delta"], n_min=rules["n_min"], target_concept_ids=self.target_ids,
                                      provenance={"tau": "validation held-out log-loss of hard-label DINA prediction; one-SE rule (student bootstrap) toward 0.5",
                                                  **rules, "tau_grid": dc["tau_grid"]})
        write_json(self.policy.to_dict(), self.out / "model/diagnosis_policy.json")
        plots.line_plot(ttab, "tau", ["heldout_log_loss_hard"], "Threshold selection (validation)", self.out / "evaluation/figures/threshold_selection.png",
                        "tau", "held-out log-loss (hard labels)", vline=tau)
        plots.line_plot(by_n.dropna(), "n_min", ["consistency"], "Split-half classification consistency (validation)",
                        self.out / "evaluation/figures/consistency_by_evidence.png", "min responses per half", "label agreement")
        self.summary["diagnosis_policy"] = self.policy.to_dict()
        self._t("policy", t0)
        self.log(json.dumps(self.policy.to_dict(), indent=1, default=str))
        return self.policy

    # ------------------------------------------------------------------ 5. single test evaluation
    def step_test_evaluation(self):
        if self._test_done:
            raise RuntimeError("test evaluation already run once in this pipeline; refusing to re-evaluate")
        t0 = time.time()
        b, ev = self.bundle, self.cfg["evaluation"]
        te = b.splits["test"]
        self.test_ctx, self.test_tgt = heldout_split(te.M, ev["heldout_fraction"], self.seed + 2, ev["min_context_responses"])
        y = te.X[self.test_tgt]
        stud = np.where(self.test_tgt)[0]
        item_idx = np.where(self.test_tgt)[1]
        order = [("P-DINA (main)", self.main_key)]
        if self.best.get("pdina_independent") and self.best["pdina_independent"] != self.main_key:
            order.append(("P-DINA independent prior (ablation)", self.best["pdina_independent"]))
        order += [("Q-logistic baseline", self.best["q_logistic"]), ("Concept-score baseline", self.best["concept_score"]),
                  ("Item-mean baseline", self.best["item_mean"])]
        rows, preds, calib = [], {}, {}
        for label, key in order:
            m = self.models[key]
            p = m.predict_proba(m.infer(te.X, self.test_ctx))[self.test_tgt]
            preds[label] = p
            met = binary_metrics(y, p)
            ci = bootstrap_metrics(y, p, stud, reps=ev["bootstrap_reps"], seed=self.seed)
            rows.append({"model": label, "config": key, **met, "roc_auc_ci95": ci["roc_auc_ci95"], "log_loss_ci95": ci["log_loss_ci95"]})
            calib[label] = calibration_table(y, p, ev["calibration_bins"]).assign(model=label)
        tm = pd.DataFrame(rows)
        tm.to_csv(self.out / "evaluation/test_metrics.csv", index=False)
        pd.concat(calib.values()).to_csv(self.out / "evaluation/calibration_test.csv", index=False)
        diffs = []
        main = preds["P-DINA (main)"]
        for label in preds:
            if label != "P-DINA (main)":
                d = paired_bootstrap_difference(y, main, preds[label], stud, reps=ev["bootstrap_reps"], seed=self.seed)
                diffs.append({"comparison": f"P-DINA (main) - {label}", **d})
        pd.DataFrame(diffs).to_csv(self.out / "evaluation/test_model_differences.csv", index=False)
        pc = per_concept_metrics(y, main, item_idx, b.Q, b.concept_ids, b.concept_names, ev["min_items_per_concept_for_eval"])
        pc["is_target"] = pc["concept_id"].isin(self.target_ids)
        pc.to_csv(self.out / "evaluation/per_concept_test_main.csv", index=False)
        tr = b.splits["train"]
        insample = binary_metrics(tr.X[tr.M], self.model.predict_proba(self.model.infer(tr.X, tr.M))[tr.M])
        plots.calibration_plot({k: calib[k] for k in list(calib)[:3]}, self.out / "evaluation/figures/calibration_test.png")
        plots.bar_h(pc[pc["is_target"]].dropna(subset=["roc_auc"]), "roc_auc", "concept_name",
                    "Test AUC per target concept (P-DINA main)", self.out / "evaluation/figures/per_concept_auc_target.png", xlim=(0.4, 1.0), ref=0.5)
        self.summary["test_evaluation"] = {
            "protocol": (f"test students: {ev['heldout_fraction']:.0%} of each student's responses held out; mastery inferred from the "
                         "rest with item parameters frozen from train; evaluated once"),
            "n_heldout_responses": int(len(y)), "n_students": int(te.n_students),
            "metrics": tm.drop(columns=["config"]).to_dict(orient="records"), "differences_vs_main": diffs,
            "train_in_sample_main_optimistic": insample,
            "caveat": "Response-prediction quality is not proof of correct mastery diagnosis (no ground-truth mastery in EEDI).",
        }
        self._test_done = True
        self._t("test_evaluation", t0)
        self.log(tm[["model", "roc_auc", "log_loss", "brier", "accuracy", "f1", "ece"]].to_string(index=False))
        return tm

    # ------------------------------------------------------------------ 6. diagnosis-quality proxies
    def step_diagnosis_quality(self):
        t0 = time.time()
        b, ev = self.bundle, self.cfg["evaluation"]
        te, va, tr = b.splits["test"], b.splits["val"], b.splits["train"]
        tidx = [list(b.concept_ids).index(c) for c in self.target_ids]
        cons = split_half_consistency(self.model, te.X, te.M, tidx, self.policy.tau, seed=self.seed + 4)
        c_ok = cons[cons["n_half_min"] >= self.policy.n_min]
        band = c_ok[(np.abs(c_ok["pi_a"] - self.policy.tau) >= self.policy.delta) & (np.abs(c_ok["pi_b"] - self.policy.tau) >= self.policy.delta)]
        cons_by_c = c_ok.groupby("concept_index")["agree"].agg(["mean", "size"]).reset_index()
        cons_by_c["concept_id"] = [int(b.concept_ids[k]) for k in cons_by_c["concept_index"]]
        cons_by_c["concept_name"] = [b.concept_names[k] for k in cons_by_c["concept_index"]]
        cons_by_c.rename(columns={"mean": "consistency", "size": "n_cells"}).to_csv(self.out / "evaluation/consistency_by_concept_test.csv", index=False)
        sim, simtab = simulate_recovery(self.model, va.M, self.policy.tau, tidx, seed=self.seed + 5, n_students=ev["simulation_students"])
        simtab["concept_id"] = [int(b.concept_ids[k]) for k in simtab["concept_index"]]
        simtab["concept_name"] = [b.concept_names[k] for k in simtab["concept_index"]]
        simtab.to_csv(self.out / "evaluation/simulation_mastery_recovery.csv", index=False)
        m = self.cfg["model"]
        rec = recover_item_parameters(self.model, tr.M, seed=self.seed + 6, max_em_iter=m["max_em_iter"], em_tol=m["em_tol"],
                                      class_weights=self.model.class_weights)
        self.summary["diagnosis_quality"] = {
            "split_half_consistency_test": {"n_cells_with_n_min": int(len(c_ok)), "consistency": float(c_ok["agree"].mean()) if len(c_ok) else None,
                                            "n_cells_outside_band": int(len(band)), "consistency_outside_band": float(band["agree"].mean()) if len(band) else None},
            "simulation_recovery": sim, "item_parameter_recovery": rec,
            "caveat": "No ground-truth mastery exists in EEDI; these are reliability / simulation proxies, not diagnostic accuracy.",
        }
        self._t("diagnosis_quality", t0)
        self.log(json.dumps(self.summary["diagnosis_quality"], indent=1, default=str))

    # ------------------------------------------------------------------ 7. CDA
    def step_assessment(self):
        t0 = time.time()
        b, ac = self.bundle, self.cfg["assessment"]
        tr, te = b.splits["train"], b.splits["test"]
        self.items = item_parameter_table(self.model, b.question_ids, b.concept_ids, b.concept_names, tr.M, tr.X, b.item_bank,
                                          self.target_ids, ac["min_train_attempts"], ac["min_discrimination"], train_pi=self.model.train_pi)
        self.items.to_csv(self.out / "model/item_parameters.csv", index=False)
        names = dict(zip(b.concept_ids.astype(int), b.concept_names))
        # a form must give each target concept at least n_min responses, otherwise nothing can be diagnosed
        ipc = int(ac["items_per_concept"] or self.policy.n_min)
        max_len = int(ac["max_length"] or ipc * len(self.target_ids))
        adequacy = concept_item_adequacy(self.items, self.target_ids, names, self.policy.n_min, ipc)
        adequacy.to_csv(self.out / "assessment/concept_item_adequacy.csv", index=False)
        fixed, cov = build_fixed_form(self.items, self.target_ids, ipc, max_len)
        fixed.to_csv(self.out / "assessment/fixed_form.csv", index=False)
        cov.to_csv(self.out / "assessment/fixed_form_coverage.csv", index=False)
        fA, fB, bal = build_parallel_forms(self.items, self.target_ids, ipc, max_len, seed=self.seed)
        fA.to_csv(self.out / "assessment/parallel_form_A.csv", index=False)
        fB.to_csv(self.out / "assessment/parallel_form_B.csv", index=False)
        bal.to_csv(self.out / "assessment/parallel_forms_balance.csv", index=False)
        response_template(fixed).to_csv(self.out / "assessment/response_template_fixed_form.csv", index=False)
        self.forms = {"fixed": fixed, "A": fA, "B": fB}
        lengths = list(ac["replay_lengths"])
        replay = simulate_adaptive_replay(self.model, self.items, te.X, te.M, self.policy, lengths, ac["replay_students"], self.seed + 7,
                                          ac["adaptive_uncertainty_weight"], ac["adaptive_coverage_weight"])
        replay.to_csv(self.out / "evaluation/adaptive_replay_test.csv", index=False)
        rsum = replay.groupby(["strategy", "length"])[["label_agreement", "mean_abs_pi_diff", "n_target_concepts_covered"]].mean().reset_index() if len(replay) else pd.DataFrame()
        if len(rsum):
            rsum.to_csv(self.out / "evaluation/adaptive_replay_summary.csv", index=False)
            plots.grouped_lines(replay, "length", "label_agreement", "strategy", "Adaptive vs random item order (test replay)",
                                self.out / "evaluation/figures/adaptive_replay.png", "test length", "agreement with full-response labels")
        el_counts = {int(r.concept_id): int(r.n_items_eligible) for r in adequacy.itertuples()}
        cur = pd.read_csv(resolve_path(self.cfg["paths"]["target_curriculum"]))
        cov_rep, unmapped = coverage_report(cur, self.concept_table, self.tm, el_counts, 2 * max(self.policy.n_min, ipc))
        cov_rep.to_csv(self.out / "audit/coverage_report.csv", index=False)
        unmapped.to_csv(self.out / "audit/unmapped_target_topics.csv", index=False)
        self.summary["assessment"] = {
            "eligibility": {"min_train_attempts": ac["min_train_attempts"], "min_discrimination": ac["min_discrimination"]},
            "n_eligible_target_items": int(self.items["eligible_target_item"].sum()),
            "items_per_concept": ipc, "max_length": max_len,
            "fixed_form_length": int(len(fixed)), "parallel_form_lengths": [int(len(fA)), int(len(fB))],
            "concepts_below_n_min_in_fixed_form": cov.loc[cov["n_items_selected"] < self.policy.n_min, "concept_id"].tolist(),
            "concepts_inadequate_for_parallel_forms": adequacy.loc[~adequacy["adequate_for_parallel_forms"], "concept_name"].tolist(),
            "adaptive_replay": {"n_students": int(replay["student_row"].nunique()) if len(replay) else 0,
                                "summary": rsum.to_dict(orient="records") if len(rsum) else []},
            "coverage": {"n_curriculum_topics": int(len(cov_rep)), "n_unmapped": int(len(unmapped)), "unmapped_topics": unmapped["topic_name"].tolist()},
        }
        self._t("assessment", t0)
        self.log(adequacy.to_string(index=False))

    # ------------------------------------------------------------------ 8. diagnosis + intervention (test split)
    def step_diagnose_test(self):
        t0 = time.time()
        b = self.bundle
        te = b.splits["test"]
        post = self.model.infer(te.X, te.M)
        prof = build_profiles(post, te.user_ids, b.concept_ids, b.concept_names, self.policy)
        prof.to_csv(self.out / "diagnosis/test_mastery_profiles.csv", index=False)
        gaps = detect_learning_gaps(prof, self.policy)
        gaps.to_csv(self.out / "diagnosis/test_learning_gaps.csv", index=False)
        cs = class_summary(prof)
        cs.to_csv(self.out / "diagnosis/test_class_gap_summary.csv", index=False)
        student_summary(prof).to_csv(self.out / "diagnosis/test_student_summary.csv", index=False)
        im_path = resolve_path(self.cfg["paths"]["intervention_map"])
        if not im_path.exists():
            create_placeholder_map(self.tm).to_csv(im_path, index=False)
            self.log(f"created placeholder intervention map: {im_path}")
        self.im, warns = load_intervention_map(im_path, self.tm)
        rec = recommend_intervention(gaps, self.im, self.tm, cs, self.items, self.cfg["intervention"])
        rec.to_csv(self.out / "intervention/test_intervention_recommendations.csv", index=False)
        plots.stacked_labels(cs.sort_values("concept_name"), self.out / "evaluation/figures/test_mastery_labels_by_concept.png")
        # demo data for the app: test-split responses of the training data source (see artifact_source)
        rows = np.where(te.M)
        pd.DataFrame({"student_id": te.user_ids[rows[0]].astype(str), "QuestionId": b.question_ids[rows[1]],
                      "response": te.X[rows].astype(int)}).to_csv(self.out / "demo/test_split_responses.csv", index=False)
        lab = prof[prof["is_target_concept"]]["mastery_label"].value_counts().to_dict()
        self.summary["test_diagnosis"] = {"n_students": int(te.n_students), "target_label_counts": lab,
                                          "n_students_with_gap": int(gaps.loc[gaps["gap_status"] == "learning_gap", "student_id"].nunique()),
                                          "intervention_map_warnings": warns,
                                          "intervention_entries_placeholder": int(self.im["is_placeholder"].sum()),
                                          "caveat": "Mastery labels are model-based posterior classifications, not verified mastery."}
        self._t("diagnose_test", t0)
        self.log(cs.to_string(index=False))

    # ------------------------------------------------------------------ 9. synthetic pre/post demo
    def step_prepost_demo(self):
        t0 = time.time()
        fA, fB = self.forms["A"], self.forms["B"]
        if not len(fA):
            self.log("no parallel forms -> skip pre/post demo")
            return
        pre, post, truth = generate_synthetic_prepost(self.model, fA["QuestionId"], fB["QuestionId"], n_students=40, seed=self.seed + 8,
                                                      with_control=False)
        pre.to_csv(self.out / "prepost/SYNTHETIC_pretest_responses.csv", index=False)
        post.to_csv(self.out / "prepost/SYNTHETIC_posttest_responses.csv", index=False)
        truth.to_csv(self.out / "prepost/SYNTHETIC_true_mastery.csv", index=False)
        res = compare_pre_post(self.model, pre, post, self.policy, self.bundle.concept_ids, self.bundle.concept_names,
                               items=self.items, item_bank=self.bundle.item_bank)
        res["students"].to_csv(self.out / "prepost/SYNTHETIC_student_changes.csv", index=False)
        res["student_concepts"].to_csv(self.out / "prepost/SYNTHETIC_student_concept_changes.csv", index=False)
        res["concepts"].to_csv(self.out / "prepost/SYNTHETIC_concept_changes.csv", index=False)
        tr = truth[truth["concept_id"].isin(self.target_ids)]
        merged = res["student_concepts"].merge(tr, on=["student_id", "concept_id"])
        flip = merged["alpha_post"] - merged["alpha_pre"]
        check = {"corr_estimated_change_vs_true_change": float(np.corrcoef(merged["mastery_change"], flip)[0, 1]) if flip.std() > 0 else None,
                 "true_gain_rate_target": float((flip > 0).mean())}
        out = {"LABEL": "SIMULATION - synthetic students generated from the fitted model; not EEDI students, not an experiment",
               "summary": res["summary"], "simulation_check": check}
        write_json(out, self.out / "prepost/SYNTHETIC_prepost_report.json")
        self.summary["prepost_demo"] = {"label": out["LABEL"], "n_matched": res["summary"]["n_matched"], "simulation_check": check}
        self._t("prepost_demo", t0)

    # ------------------------------------------------------------------ 10. checkpoint
    def step_save(self):
        b = self.bundle
        mdir = self.out / "model"
        self.model.save(mdir, extra={"selected_from": self.main_key, "data_dir": str(self.data_dir),
                                     "artifact_source": self.summary["data"]["artifact_source"], "package_version": PACKAGE_VERSION})
        cm = b.concept_meta.copy()
        cm = cm.merge(self.tm[["concept_id", "in_target_scope"] + [c for c in ["relevance_level", "curriculum_order"] if c in self.tm.columns]],
                      on="concept_id", how="left")
        cm.to_csv(mdir / "concept_metadata.csv", index=False)
        pd.DataFrame(b.Q, columns=[str(c) for c in b.concept_ids]).assign(QuestionId=b.question_ids)[["QuestionId"] + [str(c) for c in b.concept_ids]].to_csv(mdir / "q_matrix.csv", index=False)
        self.tm.to_csv(mdir / "target_concept_map.csv", index=False)
        self.im.to_csv(mdir / "intervention_map_resolved.csv", index=False)
        b.item_bank.to_csv(mdir / "item_bank.csv", index=False)
        cfg = {k: v for k, v in self.cfg.items() if not k.startswith("_")}
        write_json(cfg, mdir / "experiment_config_used.json")
        for name in ["target_concept_map", "target_curriculum", "intervention_map", "focus_item_content_audit"]:
            p = resolve_path(self.cfg["paths"].get(name))
            if p and p.exists():
                shutil.copy(p, self.out / "audit" / f"config_{p.name}")
        write_json(self.summary, self.out / "run_summary.json")
        write_json(self.summary, mdir / "model_card.json")
        self.log(f"checkpoint written to {mdir}")

    def run_all(self):
        self.step_audit()
        self.step_concepts()
        self.step_model_selection()
        self.step_policy()
        self.step_test_evaluation()
        self.step_diagnosis_quality()
        self.step_assessment()
        self.step_diagnose_test()
        self.step_prepost_demo()
        self.step_save()
        return self.summary


def main():
    ap = argparse.ArgumentParser(description="Train / evaluate the P-DINA CDM pipeline")
    ap.add_argument("--config", default=None)
    ap.add_argument("--data-dir", default=None)
    ap.add_argument("--output-dir", default=None)
    ap.add_argument("--fast", action="store_true", help="tiny hyper-parameter grid (smoke test)")
    a = ap.parse_args()
    ov = {}
    if a.data_dir:
        ov.setdefault("paths", {})["data_dir"] = a.data_dir
    if a.output_dir:
        ov.setdefault("paths", {})["output_dir"] = a.output_dir
    if a.fast:
        ov["model"] = {"hp_grid": {"prior": ["independent"], "gs_prior_strength": [10.0], "class_weighting": [False]},
                       "baselines": {"concept_score_strength": [5.0], "q_logistic_sigma": [1.0]}, "max_em_iter": 40}
        ov["evaluation"] = {"bootstrap_reps": 30, "simulation_students": 200}
        ov["assessment"] = {"replay_students": 40}
    Pipeline(a.config, ov).run_all()


if __name__ == "__main__":
    main()
