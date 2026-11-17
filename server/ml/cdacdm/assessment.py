"""Cognitive diagnostic assessment (CDA): item eligibility, fixed forms, parallel pre/post forms
and adaptive item selection.

Adaptive selection criterion. For item j the outcome depends on the mastery profile only through
eta_ij (all required concepts mastered). Under the current posterior P(eta_ij = 1) = rho_ij, so the
expected information the response carries about the profile is the mutual information

    MI_j = H(rho p1 + (1-rho) p0) - rho H(p1) - (1-rho) H(p0),    p1 = 1 - s_j,  p0 = g_j

MI is largest when the concept is still uncertain (rho near 0.5) and the item discriminates
(1 - s - g large); it is NOT largest for the hardest item. The score multiplies MI by a concept
weight 1 + w_unc * H(pi_k) + w_cov * [n_evidence_k < n_min] to favour uncertain and not yet
covered target concepts, and a per-concept cap keeps coverage balanced.
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd

from .diagnosis import DiagnosisPolicy
from .models import EPS, PDINA, bern_entropy


def item_parameter_table(model: PDINA, question_ids, concept_ids, concept_names, train_M, train_X,
                         item_bank: pd.DataFrame | None = None, target_ids=(), min_train_attempts: int = 30,
                         min_discrimination: float = 0.1, train_pi=None) -> pd.DataFrame:
    Q = model.Q.astype(int)
    n_train = train_M.sum(0).astype(int)
    pass_rate = np.where(n_train > 0, (train_X * train_M).sum(0) / np.maximum(n_train, 1), np.nan)
    tset = set(int(t) for t in target_ids)
    cids = np.asarray(concept_ids).astype(int)
    if train_pi is not None:
        mean_rho = np.exp(np.log(np.clip(train_pi, EPS, 1)) @ model.Q.T).mean(0)
        model_p = model.g + (1 - model.s - model.g) * mean_rho
    else:
        model_p = np.full(len(question_ids), np.nan)
    rows = []
    for j, q in enumerate(question_ids):
        ks = np.where(Q[j])[0]
        cs = [int(cids[k]) for k in ks]
        rows.append({"QuestionId": int(q), "item_index": j, "concept_ids": ";".join(map(str, cs)),
                     "concept_names": "; ".join(concept_names[k] for k in ks), "n_concepts": len(ks),
                     "guess": float(model.g[j]), "slip": float(model.s[j]), "discrimination": float(1 - model.s[j] - model.g[j]),
                     "n_train_responses": int(n_train[j]), "train_pass_rate": float(pass_rate[j]),
                     "model_expected_p_correct": float(model_p[j]), "model_difficulty": float(1 - model_p[j]),
                     "all_concepts_target": bool(cs) and all(c in tset for c in cs),
                     "any_concept_target": any(c in tset for c in cs)})
    df = pd.DataFrame(rows)
    df["reliable_params"] = df["n_train_responses"] >= min_train_attempts
    df["diagnostic"] = df["discrimination"] >= min_discrimination
    df["eligible_target_item"] = df["all_concepts_target"] & df["reliable_params"] & df["diagnostic"]
    if item_bank is not None:
        keep = [c for c in ["image_path", "correct_answer", "is_focus", "question_text", "answer_key"] if c in item_bank.columns]
        df = df.merge(item_bank[["QuestionId"] + keep], on="QuestionId", how="left")
    return df


def concept_item_adequacy(items: pd.DataFrame, target_ids, concept_names_by_id: dict, n_min: int, items_per_form: int) -> pd.DataFrame:
    """Does each target concept have enough eligible diagnostic items for pre + post forms?"""
    rows = []
    for c in target_ids:
        has = items["concept_ids"].str.split(";").apply(lambda l: str(c) in l)
        el = items[has & items["eligible_target_item"]]
        el_single = el[el["n_concepts"] == 1]
        need = 2 * max(n_min, items_per_form)
        rows.append({"concept_id": int(c), "concept_name": concept_names_by_id.get(int(c), ""),
                     "n_items_total": int(has.sum()), "n_items_reliable": int((has & items["reliable_params"]).sum()),
                     "n_items_eligible": int(len(el)), "n_items_eligible_single_concept": int(len(el_single)),
                     "mean_discrimination_eligible": float(el["discrimination"].mean()) if len(el) else np.nan,
                     "difficulty_range_eligible": f"{el['model_difficulty'].min():.2f}-{el['model_difficulty'].max():.2f}" if len(el) else "",
                     "items_needed_for_two_forms": need,
                     "adequate_for_parallel_forms": len(el) >= need,
                     "adequate_for_single_form": len(el) >= max(n_min, 1),
                     "diagnosis_limitation": "" if len(el) >= need else ("no eligible items" if len(el) == 0 else "too few eligible items for two parallel forms")})
    return pd.DataFrame(rows)


def _candidates(items, concept_id, exclude):
    has = items["concept_ids"].str.split(";").apply(lambda l: str(concept_id) in l)
    c = items[has & items["eligible_target_item"] & ~items["QuestionId"].isin(exclude)]
    # prefer single-concept items: their evidence attaches to exactly one concept
    return c.sort_values(["n_concepts", "model_difficulty"])


def build_fixed_form(items: pd.DataFrame, target_ids, items_per_concept: int = 3, max_length: int = 30,
                     exclude=(), form_id: str = "FIXED") -> tuple[pd.DataFrame, pd.DataFrame]:
    """Blueprint form: per target concept pick the most discriminating item in each difficulty tercile."""
    per = {}
    for c in target_ids:
        cand = _candidates(items, c, set(exclude))
        cand = cand[cand["n_concepts"] == 1] if (cand["n_concepts"] == 1).sum() >= items_per_concept else cand
        cand = cand.sort_values("model_difficulty").reset_index(drop=True)
        if len(cand) <= items_per_concept:
            per[c] = cand
            continue
        bins = np.array_split(np.arange(len(cand)), min(items_per_concept, len(cand)))
        chosen = [cand.loc[b].sort_values("discrimination", ascending=False).index[0] for b in bins]
        while len(chosen) < items_per_concept:
            rest = cand.drop(index=chosen).sort_values("discrimination", ascending=False)
            chosen.append(rest.index[0])
        per[c] = cand.loc[chosen]
    rows, r = [], 0
    while len(rows) < max_length and any(r < len(v) for v in per.values()):
        for c in target_ids:
            if r < len(per[c]) and len(rows) < max_length:
                it = per[c].iloc[r]
                rows.append({**it.to_dict(), "blueprint_concept_id": int(c)})
        r += 1
    form = pd.DataFrame(rows)
    if len(form):
        form = form.drop_duplicates("QuestionId").reset_index(drop=True)
        form.insert(0, "position", np.arange(1, len(form) + 1))
        form.insert(0, "form_id", form_id)
    cov = (form.groupby("blueprint_concept_id").size().reindex(target_ids, fill_value=0).rename("n_items_selected").reset_index()
           .rename(columns={"blueprint_concept_id": "concept_id"})) if len(form) else pd.DataFrame({"concept_id": target_ids, "n_items_selected": 0})
    cov["n_items_requested"] = items_per_concept
    cov["shortfall"] = cov["n_items_selected"] < items_per_concept
    return form, cov


def build_parallel_forms(items: pd.DataFrame, target_ids, items_per_concept: int = 3, max_length: int = 30,
                         seed: int = 0) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Two disjoint forms (A for pre-test, B for post-test) with matched concept blueprint and
    item difficulty: adjacent items in difficulty order are paired and split across forms."""
    rng = np.random.default_rng(seed)
    A, B, bal = [], [], []
    per_concept_cap = max(1, min(items_per_concept, max_length // max(len(target_ids), 1)))
    used: set = set()  # a multi-concept item may serve only one blueprint slot in one form
    for c in target_ids:
        cand = _candidates(items, c, used)
        # prefer single-concept items only when there are enough of them for every requested pair
        if (cand["n_concepts"] == 1).sum() >= 2 * per_concept_cap:
            cand = cand[cand["n_concepts"] == 1]
        cand = cand.sort_values("model_difficulty").reset_index(drop=True)
        pairs = [(cand.iloc[i], cand.iloc[i + 1]) for i in range(0, len(cand) - 1, 2)]
        pairs.sort(key=lambda p: -(min(p[0]["discrimination"], p[1]["discrimination"]) - abs(p[0]["model_difficulty"] - p[1]["model_difficulty"])))
        pairs = pairs[:per_concept_cap]
        used.update(int(it["QuestionId"]) for pr in pairs for it in pr)
        for a, b in pairs:
            if rng.random() < 0.5:
                a, b = b, a
            A.append({**a.to_dict(), "blueprint_concept_id": int(c)})
            B.append({**b.to_dict(), "blueprint_concept_id": int(c)})
        fa = [p[0] for p in pairs]
        bal.append({"concept_id": int(c), "n_pairs": len(pairs), "requested_pairs": items_per_concept,
                    "shortfall": len(pairs) < items_per_concept})
    fA, fB = pd.DataFrame(A), pd.DataFrame(B)
    for f, name in [(fA, "PARALLEL_A"), (fB, "PARALLEL_B")]:
        if len(f):
            f.insert(0, "position", np.arange(1, len(f) + 1))
            f.insert(0, "form_id", name)
    bal = pd.DataFrame(bal)
    if len(fA):
        ga, gb = fA.groupby("blueprint_concept_id"), fB.groupby("blueprint_concept_id")
        bal = bal.merge(ga["model_difficulty"].mean().rename("mean_difficulty_A"), left_on="concept_id", right_index=True, how="left")
        bal = bal.merge(gb["model_difficulty"].mean().rename("mean_difficulty_B"), left_on="concept_id", right_index=True, how="left")
        bal = bal.merge(ga["discrimination"].mean().rename("mean_discrimination_A"), left_on="concept_id", right_index=True, how="left")
        bal = bal.merge(gb["discrimination"].mean().rename("mean_discrimination_B"), left_on="concept_id", right_index=True, how="left")
        bal["abs_difficulty_diff"] = (bal["mean_difficulty_A"] - bal["mean_difficulty_B"]).abs()
    return fA, fB, bal


def item_information(rho, g, s):
    """Mutual information (bits) between the response and eta, vectorised over items."""
    p1, p0 = 1 - s, g
    pc = rho * p1 + (1 - rho) * p0
    return bern_entropy(pc) - rho * bern_entropy(p1) - (1 - rho) * bern_entropy(p0)


class AdaptiveSession:
    """Stateful adaptive CDA session for one student. Item parameters stay fixed."""

    def __init__(self, model: PDINA, items: pd.DataFrame, policy: DiagnosisPolicy, max_length: int = 20,
                 uncertainty_weight: float = 1.0, coverage_weight: float = 0.5, pool=None, early_stop: bool = True):
        self.model, self.policy = model, policy
        self.early_stop = early_stop
        self.items = items.set_index("QuestionId")
        self.qids = items["QuestionId"].to_numpy()
        self.qpos = {int(q): int(i) for q, i in zip(items["QuestionId"], items["item_index"])}
        self.max_length = max_length
        self.w_unc, self.w_cov = uncertainty_weight, coverage_weight
        self.target_idx = [self._cidx(c) for c in policy.target_concept_ids]
        el = items["eligible_target_item"].to_numpy().copy()
        if pool is not None:
            el &= items["QuestionId"].isin(set(int(p) for p in pool)).to_numpy()
        self.pool = set(items.loc[el, "QuestionId"].astype(int))
        self.X = np.zeros((1, model.J))
        self.M = np.zeros((1, model.J), dtype=bool)
        self.administered: list = []
        self.log: list = []
        self.cap = max(2, math.ceil(2 * max_length / max(len(self.target_idx), 1)))
        self.post = model.infer(self.X, self.M)

    def _cidx(self, cid):
        cols = getattr(self.model, "concept_ids", None)
        if cols is None:
            raise ValueError("model.concept_ids must be set to use AdaptiveSession")
        return int(list(cols).index(int(cid)))

    def resolved(self, k) -> bool:
        p, n = self.post.pi[0, k], self.post.n_evidence[0, k]
        return n >= self.policy.n_min and abs(p - self.policy.tau) >= self.policy.delta

    def finished(self) -> bool:
        return (len(self.administered) >= self.max_length or not (self.pool - set(self.administered))
                or (self.early_stop and all(self.resolved(k) for k in self.target_idx)))

    def scores(self) -> pd.DataFrame:
        cand = sorted(self.pool - set(self.administered))
        if not cand:
            return pd.DataFrame()
        idx = np.array([self.qpos[q] for q in cand])
        pi = self.post.pi[0]
        rho = np.exp(np.log(np.clip(pi, EPS, 1)) @ self.model.Q[idx].T)
        mi = item_information(rho, self.model.g[idx], self.model.s[idx])
        H = bern_entropy(pi)
        n_ev = self.post.n_evidence[0]
        per_c = {k: sum(1 for q in self.administered if self.model.Q[self.qpos[q], k]) for k in self.target_idx}
        w, capped = [], []
        for j in idx:
            ks = [k for k in np.where(self.model.Q[j])[0] if k in per_c]
            w.append(np.mean([1 + self.w_unc * H[k] + self.w_cov * (n_ev[k] < self.policy.n_min) for k in ks]) if ks else 1.0)
            capped.append(any(per_c[k] >= self.cap for k in ks))
        w, capped = np.array(w), np.array(capped)
        df = pd.DataFrame({"QuestionId": cand, "mutual_information_bits": mi, "concept_weight": w,
                           "score": mi * w * np.where(capped, 0.0, 1.0), "p_correct_now": self.model.g[idx] + (1 - self.model.s[idx] - self.model.g[idx]) * rho,
                           "difficulty": self.items.loc[cand, "model_difficulty"].to_numpy(),
                           "concept_names": self.items.loc[cand, "concept_names"].to_numpy()})
        return df.sort_values("score", ascending=False).reset_index(drop=True)

    def next_item(self):
        if self.finished():
            return None
        sc = self.scores()
        if sc.empty or sc["score"].iloc[0] <= 0:
            return None
        return sc.iloc[0].to_dict()

    def record(self, question_id: int, response):
        q = int(question_id)
        if q not in self.qpos:
            raise ValueError(f"QuestionId {q} is not in the item bank")
        self.administered.append(q)
        j = self.qpos[q]
        if response is not None and not (isinstance(response, float) and np.isnan(response)):
            r = int(response)
            if r not in (0, 1):
                raise ValueError("response must be 0, 1 or None (skipped)")
            self.X[0, j], self.M[0, j] = r, True
        self.post = self.model.infer(self.X, self.M)
        self.log.append({"step": len(self.administered), "QuestionId": q, "response": response})

    def run_with_oracle(self, answer_fn):
        """Administer items until a stop rule fires, answering with answer_fn(QuestionId)."""
        while True:
            nxt = self.next_item()
            if nxt is None:
                break
            self.record(nxt["QuestionId"], answer_fn(int(nxt["QuestionId"])))
        return self.post


def simulate_adaptive_replay(model: PDINA, items: pd.DataFrame, X, M, policy: DiagnosisPolicy, lengths,
                             n_students: int = 300, seed: int = 0, uncertainty_weight=1.0, coverage_weight=0.5) -> pd.DataFrame:
    """Replay study on real held-out students: administer only items the student actually answered,
    in adaptive vs random order, and compare the resulting target-concept labels with the labels
    obtained from ALL of the student's target-item responses (agreement, not accuracy)."""
    rng = np.random.default_rng(seed)
    el_idx = items.loc[items["eligible_target_item"], "item_index"].to_numpy()
    cand_students = np.where(M[:, el_idx].sum(1) >= max(lengths))[0]
    if len(cand_students) == 0:
        return pd.DataFrame()
    pick = rng.choice(cand_students, min(n_students, len(cand_students)), replace=False)
    tidx = [list(model.concept_ids).index(int(c)) for c in policy.target_concept_ids]
    Lmax = max(lengths)
    rows = []
    for i in pick:
        pool_idx = el_idx[M[i, el_idx]]
        Mref = np.zeros_like(M[i:i + 1])
        Mref[0, pool_idx] = True
        ref = model.infer(X[i:i + 1], Mref)
        ref_ok = ref.n_evidence[0, tidx] >= policy.n_min
        ref_lab = ref.pi[0, tidx] >= policy.tau
        qids = items.set_index("item_index").loc[pool_idx, "QuestionId"].astype(int).tolist()
        answers = {q: X[i, j] for q, j in zip(qids, pool_idx)}
        # adaptive
        sess = AdaptiveSession(model, items, policy, max_length=Lmax, uncertainty_weight=uncertainty_weight,
                               coverage_weight=coverage_weight, pool=qids, early_stop=False)
        order_ad = []
        for _ in range(Lmax):
            nxt = sess.next_item()
            if nxt is None:
                break
            q = int(nxt["QuestionId"])
            sess.record(q, answers[q])
            order_ad.append(q)
        order_rand = list(rng.permutation(qids)[:Lmax])
        for strategy, order in [("adaptive_MI", order_ad), ("random", order_rand)]:
            for L in lengths:
                sel = order[:L]
                Ms = np.zeros_like(Mref)
                Ms[0, [sess.qpos[q] for q in sel]] = True
                p = model.infer(X[i:i + 1], Ms)
                lab = p.pi[0, tidx] >= policy.tau
                rows.append({"student_row": int(i), "strategy": strategy, "length": L, "n_reference_concepts": int(ref_ok.sum()),
                             "label_agreement": float((lab[ref_ok] == ref_lab[ref_ok]).mean()) if ref_ok.any() else np.nan,
                             "mean_abs_pi_diff": float(np.abs(p.pi[0, tidx] - ref.pi[0, tidx])[ref_ok].mean()) if ref_ok.any() else np.nan,
                             "n_target_concepts_covered": int((p.n_evidence[0, tidx] > 0).sum()),
                             "mean_posterior_entropy_target": float(bern_entropy(p.pi[0, tidx]).mean())})
    return pd.DataFrame(rows)
