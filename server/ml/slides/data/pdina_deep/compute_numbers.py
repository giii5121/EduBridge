"""Collect real numbers from the trained P-DINA for slides/pdina_deep.tex.

Usage (from the project root): .venv/Scripts/python.exe slides/data/pdina_deep/compute_numbers.py .
Refits the selected configuration once on train (~30 s) to record the ELBO history."""
import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(sys.argv[1])
sys.path.insert(0, str(ROOT))
from cdacdm.config import load_config  # noqa: E402
from cdacdm.data import load_artifacts  # noqa: E402
from cdacdm.models import PDINA  # noqa: E402
from cdacdm.service import CDMService  # noqa: E402

OUT = ROOT / "slides" / "data" / "pdina_deep"
OUT.mkdir(parents=True, exist_ok=True)
res = {}
sig = lambda z: 1 / (1 + np.exp(-z))  # noqa: E731
logit = lambda p: np.log(p / (1 - p))  # noqa: E731

svc = CDMService.load(ROOT / "artifacts")
m = svc.model
cids = np.asarray(m.concept_ids).astype(int)
qids = np.asarray(m.question_ids).astype(int)
cmeta = pd.read_csv(ROOT / "artifacts/model/concept_metadata.csv")
name_of = dict(zip(cmeta.iloc[:, 0].astype(int), cmeta["concept_name"] if "concept_name" in cmeta else cmeta.iloc[:, 1]))
target = [int(c) for c in svc.policy.target_concept_ids]
tidx = [int(np.where(cids == c)[0][0]) for c in target]

# ---- Q-matrix stats
Q = m.Q
res["q"] = {"items": int(Q.shape[0]), "concepts": int(Q.shape[1]), "density": float(Q.mean()),
            "single": int((Q.sum(1) == 1).sum()), "multi": int((Q.sum(1) > 1).sum()),
            "items_per_target": {name_of[c]: int(Q[:, k].sum()) for c, k in zip(target, tidx)}}

# ---- higher-order prior per target concept
rows = []
for c, k in zip(target, tidx):
    a, b = float(m.ho_a[k]), float(m.ho_b[k])
    rows.append({"concept": name_of[c], "a": a, "b": b, **{f"p_theta_{t}": float(sig(a * t - b)) for t in (-2, -1, 0, 1, 2)}})
ho = pd.DataFrame(rows).sort_values("p_theta_0")
ho.to_csv(OUT / "ho_prior_target.csv", index=False)
res["ho_mean_a_all"] = float(np.mean(m.ho_a))

# ---- evidence weights per item (log-odds of one answer)
A1, A0 = np.log1p(-m.s) - np.log(m.g), np.log(m.s) - np.log1p(-m.g)
res["evidence"] = {"A1_median": float(np.median(A1)), "A0_median": float(np.median(A0)),
                   "A1_q10": float(np.quantile(A1, .1)), "A1_q90": float(np.quantile(A1, .9)),
                   "A0_q10": float(np.quantile(A0, .1)), "A0_q90": float(np.quantile(A0, .9))}
ex_items = []
for gq, sq in [(0.15, 0.10), (0.34, 0.25), (0.55, 0.35), (0.25, 0.55)]:
    j = int(np.argmin((m.g - gq) ** 2 + (m.s - sq) ** 2))
    ex_items.append({"QuestionId": int(qids[j]), "g": float(m.g[j]), "s": float(m.s[j]), "A1": float(A1[j]), "A0": float(A0[j]),
                     "lr1": float(np.exp(A1[j])), "lr0": float(np.exp(A0[j]))})
res["evidence_examples"] = ex_items

# ---- worked example: Siswa-e7f6c011 on Writing Expressions
demo = pd.read_csv(ROOT / "artifacts/demo/test_split_responses.csv", dtype={"student_id": str})
ids = demo["student_id"].drop_duplicates().head(30)
d30 = demo[demo["student_id"].isin(ids)]
diag = svc.diagnose(d30)
t = diag["profiles"][diag["profiles"]["is_target_concept"]]
sid = t[t["mastery_label"] == "not_mastered"]["student_id"].iloc[0]
X, M, _ = None, None, None
one = d30[d30["student_id"] == sid]
resp_col = "response" if "response" in one else [c for c in one.columns if c.lower() in ("iscorrect", "correct")][0]
X = np.zeros((1, len(qids))); M = np.zeros((1, len(qids)), bool)
pos = {q: i for i, q in enumerate(qids)}
for q, r in zip(one["QuestionId"].astype(int), one[resp_col]):
    if q in pos and str(r) not in ("", "nan"):
        X[0, pos[q]] = float(r); M[0, pos[q]] = True
post = m.infer(X, M)
theta = float(post.theta[0])
we = [c for c in target if name_of[c] == "Writing Expressions"][0]
k = int(np.where(cids == we)[0][0])
items = np.where(M[0] & (Q[:, k] == 1))[0]
single = [j for j in items if Q[j].sum() == 1]
contrib = [(int(qids[j]), int(X[0, j]), float(m.g[j]), float(m.s[j]), float(A1[j] if X[0, j] else A0[j])) for j in single]
prior_p = float(sig(m.ho_a[k] * theta - m.ho_b[k]))
total = logit(prior_p) + sum(c[4] for c in contrib)
res["worked"] = {"student": "Siswa-e7f6c011", "theta": theta, "concept": "Writing Expressions", "n_items": int(len(items)),
                 "n_single": len(single), "n_correct": int(X[0, items].sum()), "prior_p": prior_p, "prior_logit": float(logit(prior_p)),
                 "sum_correct": float(sum(c[4] for c in contrib if c[1] == 1)), "sum_wrong": float(sum(c[4] for c in contrib if c[1] == 0)),
                 "n_correct_single": int(sum(c[1] for c in contrib)), "logit_total": float(total), "pi_formula": float(sig(total)),
                 "pi_model": float(post.pi[0, k]), "a_k": float(m.ho_a[k]), "b_k": float(m.ho_b[k])}
pd.DataFrame(contrib, columns=["QuestionId", "x", "g", "s", "logodds"]).to_csv(OUT / "worked_items.csv", index=False)

# ---- trajectory: pi after n answers on one concept (fresh student, only these answers)
kl = max(tidx, key=lambda k: int(((Q[:, k] == 1) & (Q.sum(1) == 1)).sum()))
res["trajectory_concept"] = name_of[int(cids[kl])]
cand = [j for j in np.where(Q[:, kl] == 1)[0] if Q[j].sum() == 1]
# typical items (closest to median discrimination), not the best ones
disc = 1 - m.g - m.s
med = float(np.median(disc[cand]))
cand = sorted(cand, key=lambda j: abs(disc[j] - med))[:10]
traj = {"n": list(range(0, 11))}
for name, pat in {"semua_benar": [1] * 10, "semua_salah": [0] * 10, "selang_seling": [1, 0] * 5}.items():
    vals = []
    for n in range(0, 11):
        Xn = np.zeros((1, len(qids))); Mn = np.zeros((1, len(qids)), bool)
        for i in range(n):
            Xn[0, cand[i]] = pat[i]; Mn[0, cand[i]] = True
        vals.append(float(m.infer(Xn, Mn).pi[0, kl]))
    traj[name] = vals
pd.DataFrame(traj).to_csv(OUT / "trajectory.csv", index=False)
res["trajectory_items"] = [{"QuestionId": int(qids[j]), "g": float(m.g[j]), "s": float(m.s[j])} for j in cand]

# ---- refit on train to record ELBO history and theta / pi distributions
cfg = load_config()
bundle = load_artifacts(ROOT / "ILCDA/processed_task34_cda_cdm/final_local_reconstruction", cfg, splits=("train",))
tr = bundle.splits["train"]
hp = json.loads((ROOT / "artifacts/model/pdina_config.json").read_text())["hyperparams"]
t0 = time.perf_counter()
fit = PDINA(bundle.Q, prior=hp["prior"], gs_prior_strength=hp["gs_prior_strength"], max_em_iter=hp["max_em_iter"],
            em_tol=hp["em_tol"], e_step_iter=hp["e_step_iter"]).fit(tr.X, tr.M)
res["refit"] = {"seconds": time.perf_counter() - t0, "n_iter": fit.n_em_iter, "final_elbo": fit.history[-1],
                "max_abs_diff_g_vs_checkpoint": float(np.abs(fit.g - m.g).max()),
                "max_abs_diff_s_vs_checkpoint": float(np.abs(fit.s - m.s).max()),
                "train_students": int(tr.X.shape[0]), "train_observed": int(tr.M.sum()),
                "density_train": float(tr.M.mean())}
pd.DataFrame({"iter": np.arange(1, len(fit.history) + 1), "elbo": fit.history}).to_csv(OUT / "elbo_history.csv", index=False)
h, e = np.histogram(fit.train_theta, bins=np.arange(-4, 4.01, 0.5))
pd.DataFrame({"left": e[:-1], "count": h}).to_csv(OUT / "theta_hist.csv", index=False)
pit = fit.train_pi[:, tidx]
ev = (tr.M.astype(float) @ bundle.Q)[:, tidx]
pi_ok = pit[ev >= 5]
h, e = np.histogram(pi_ok, bins=np.linspace(0, 1, 11))
pd.DataFrame({"left": e[:-1], "count": h}).to_csv(OUT / "pi_hist_target.csv", index=False)
res["pi_target_train"] = {"cells_with_5plus": int(pi_ok.size), "share_lt_0.1": float((pi_ok < .1).mean()),
                          "share_gt_0.9": float((pi_ok > .9).mean()), "share_0.4_0.6": float(((pi_ok > .4) & (pi_ok < .6)).mean())}
res["responses_per_student_train"] = {"median": float(np.median(tr.M.sum(1))), "mean": float(tr.M.sum(1).mean())}

(OUT / "numbers.json").write_text(json.dumps(res, indent=1, default=float), encoding="utf-8")
print(json.dumps(res, indent=1, default=float))
print(ho.round(3).to_string(index=False))

# ---- percent correct vs P(mastery) on test, and guess/slip of all items (figures deep_pc_vs_pi, deep_gs_scatter)
prof = pd.read_csv(ROOT / "artifacts/diagnosis/test_mastery_profiles.csv")
tt = prof[(prof["is_target_concept"]) & (prof["n_evidence"] >= 5)].copy()
tt["pc"] = tt["n_correct"] / tt["n_evidence"]
tt[["pc", "mastery_prob", "mastery_label", "n_evidence"]].round(4).to_csv(OUT / "pc_vs_pi_test.csv", index=False)
ip = pd.read_csv(ROOT / "artifacts/model/item_parameters.csv")
ip[["guess", "slip"]].round(4).to_csv(OUT / "item_gs.csv", index=False)
