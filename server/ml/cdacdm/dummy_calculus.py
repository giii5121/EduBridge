"""DUMMY calculus scenario: SMA kelas XI, matematika tingkat lanjut (fokus kalkulus).

Everything this module produces is SYNTHETIC. It exists so the whole CDA -> CDM -> learning-gap ->
intervention -> pre/post workflow can be exercised end-to-end on the research target domain
(limit & turunan) before real classroom data exist. Nothing here is a research finding:

* the item bank is template-generated (stems + answer keys computed by code), not teacher-validated;
* calibration responses and the two classes are simulated from generating parameters chosen here;
* the "intervention effect" in the class data is an assumed simulation parameter (GAIN_*), so any
  treatment-control difference reproduces that assumption.

    python -m cdacdm.dummy_calculus            # generate data + configs, train, build class data, analyse
    python -m cdacdm.dummy_calculus --skip-train   # reuse an existing artifacts_calculus checkpoint
"""
from __future__ import annotations

import argparse
import json
from fractions import Fraction
from pathlib import Path

import numpy as np
import pandas as pd

from .config import PROJECT_ROOT

SEED = 2026
DATA_DIR = PROJECT_ROOT / "dummy_data" / "kalkulus_kelas11"
CFG_DIR = PROJECT_ROOT / "configs" / "calculus"
OUT_DIR = PROJECT_ROOT / "artifacts_calculus"
N_CALIBRATION = 2000
GAIN_TREATMENT, GAIN_CONTROL, RETAIN = 0.55, 0.25, 0.97   # assumed simulation parameters

# id, code, name, role, curriculum order, prerequisite ids, generating difficulty
CONCEPTS = [
    (9001, "KAL-P1", "Fungsi dan notasi fungsi", "prerequisite", 1, "", -1.2),
    (9002, "KAL-P2", "Faktorisasi dan manipulasi bentuk aljabar", "prerequisite", 2, "", -0.8),
    (9003, "KAL-L1", "Limit fungsi aljabar", "core_limit", 3, "9001;9002", -0.3),
    (9004, "KAL-L2", "Limit fungsi di tak hingga", "core_limit", 4, "9003", 0.2),
    (9005, "KAL-L3", "Limit fungsi trigonometri", "core_limit", 5, "9003", 0.4),
    (9006, "KAL-D1", "Turunan sebagai limit (definisi turunan)", "core_derivative", 6, "9003", 0.3),
    (9007, "KAL-D2", "Aturan dasar turunan (pangkat, konstanta, jumlah)", "core_derivative", 7, "9001", -0.4),
    (9008, "KAL-D3", "Aturan perkalian dan pembagian", "core_derivative", 8, "9007", 0.3),
    (9009, "KAL-D4", "Aturan rantai", "core_derivative", 9, "9007", 0.5),
    (9010, "KAL-D5", "Turunan fungsi trigonometri", "core_derivative", 10, "9007", 0.6),
    (9011, "KAL-A1", "Persamaan garis singgung kurva", "application", 11, "9007", 0.4),
    (9012, "KAL-A2", "Fungsi naik/turun dan titik stasioner", "application", 12, "9007", 0.6),
    (9013, "KAL-A3", "Nilai maksimum/minimum dan masalah optimasi", "application", 13, "9012", 1.0),
]
CIDS = [c[0] for c in CONCEPTS]
SUP = str.maketrans("0123456789-", "⁰¹²³⁴⁵⁶⁷⁸⁹⁻")


def fr(x) -> str:
    f = Fraction(x).limit_denominator(1000)
    return str(f.numerator) if f.denominator == 1 else f"{f.numerator}/{f.denominator}"


def poly(terms) -> str:
    """terms: list of (coef, power) -> '3x⁴ − 2x + 5'."""
    out = []
    for c, p in terms:
        if c == 0:
            continue
        sign = "−" if c < 0 else "+"
        a = abs(c)
        coef = "" if (a == 1 and p != 0) else fr(a)
        var = "" if p == 0 else ("x" if p == 1 else "x" + str(p).translate(SUP))
        out.append((sign, f"{coef}{var}"))
    if not out:
        return "0"
    s = ("−" if out[0][0] == "−" else "") + out[0][1]
    for sign, t in out[1:]:
        s += f" {sign} {t}"
    return s


def sgn(v) -> str:
    return f"+ {fr(v)}" if v >= 0 else f"− {fr(-v)}"


# ------------------------------------------------------------------------------------------------
# Item templates: (concept ids, difficulty tier, stem/key function, parameter sets)
# ------------------------------------------------------------------------------------------------
T = [
    ([9001], 0, lambda a, b, c, d: (f"Diketahui f(x) = {poly([(a, 2), (-b, 1), (c, 0)])}. Nilai f({d}) = …", fr(a * d * d - b * d + c)),
     [(2, 3, 1, 2), (1, 4, 3, -1), (3, 2, -5, 3)]),
    ([9001], 1, lambda a, b, c, d: (f"Diketahui f(x) = {poly([(a, 1), (b, 0)])} dan g(x) = {poly([(1, 2), (c, 0)])}. Nilai (g∘f)({d}) = …",
                                    fr((a * d + b) ** 2 + c)), [(2, 1, 3, 1), (3, -2, 1, 2)]),
    ([9001], 0, lambda a, b: (f"Domain fungsi f(x) = (x {sgn(a)})/(x {sgn(-b)}) adalah …", f"x ∈ ℝ, x ≠ {fr(b)}"), [(1, 2), (3, -4)]),
    ([9002], 0, lambda p, q: (f"Bentuk faktor dari {poly([(1, 2), (p + q, 1), (p * q, 0)])} adalah …", f"(x {sgn(p)})(x {sgn(q)})"),
     [(2, 3), (1, -4), (-2, -5)]),
    ([9002], 0, lambda a: (f"Untuk x ≠ {a}, bentuk sederhana dari ({poly([(1, 2), (-a * a, 0)])})/(x − {a}) adalah …", f"x + {a}"), [(3,), (5,)]),
    ([9002], 1, lambda a: (f"Untuk x ≠ {a * a}, bentuk sederhana dari (√x − {a})/(x − {a * a}) adalah …", f"1/(√x + {a})"), [(2,), (3,)]),
    ([9003], 0, lambda a, m, b: (f"lim_(x→{a}) ({poly([(m, 2), (b, 1)])}) = …", fr(m * a * a + b * a)), [(3, 2, 1), (2, 3, -1)]),
    ([9003, 9002], 1, lambda a: (f"lim_(x→{a}) ({poly([(1, 2), (-a * a, 0)])})/(x − {a}) = …", fr(2 * a)), [(3,), (4,), (5,)]),
    ([9003, 9002], 1, lambda p, q: (f"lim_(x→{p}) ({poly([(1, 2), (-(p + q), 1), (p * q, 0)])})/(x {sgn(-p)}) = …", fr(p - q)),
     [(3, 1), (4, -2), (2, 5)]),
    ([9003, 9002], 2, lambda a: (f"lim_(x→{a * a}) (√x − {a})/(x − {a * a}) = …", fr(Fraction(1, 2 * a))), [(2,), (3,)]),
    ([9003], 0, lambda a, b, c, d: (f"lim_(x→{a}) ({poly([(b, 1), (c, 0)])})/(x {sgn(d)}) = …", fr(Fraction(b * a + c, a + d))),
     [(1, 2, 3, 1), (2, 4, -1, 3)]),
    ([9004], 1, lambda a, b, c, d: (f"lim_(x→∞) ({poly([(a, 2), (b, 1)])})/({poly([(c, 2), (-d, 0)])}) = …", fr(Fraction(a, c))),
     [(6, 1, 3, 2), (4, 3, 8, 1), (5, 2, 2, 7)]),
    ([9004], 1, lambda a, b, c: (f"lim_(x→∞) ({poly([(a, 1), (b, 0)])})/({poly([(c, 2), (1, 0)])}) = …", "0"), [(3, 2, 1), (5, 1, 2)]),
    ([9004], 1, lambda a, b, c: (f"lim_(x→∞) ({poly([(a, 3), (1, 0)])})/({poly([(c, 2), (b, 0)])}) = …", "∞ (tidak ada / divergen)"),
     [(2, 1, 3), (1, 4, 5)]),
    ([9004, 9002], 2, lambda a: (f"lim_(x→∞) (√(x² + {a}x) − x) = …", fr(Fraction(a, 2))), [(4,), (6,)]),
    ([9005], 1, lambda a, b: (f"lim_(x→0) sin({a}x)/({b}x) = …", fr(Fraction(a, b))), [(3, 2), (5, 4), (2, 6)]),
    ([9005], 1, lambda a, b: (f"lim_(x→0) tan({a}x)/sin({b}x) = …", fr(Fraction(a, b))), [(4, 2), (3, 5)]),
    ([9005, 9002], 2, lambda a: (f"lim_(x→0) (1 − cos {a}x)/x² = …", fr(Fraction(a * a, 2))), [(2,), (4,)]),
    ([9006, 9003], 1, lambda a: (f"Dengan definisi f′(x) = lim_(h→0) [f(x+h) − f(x)]/h, turunan f(x) = {a}x² adalah …", f"{2 * a}x"),
     [(3,), (5,)]),
    ([9006, 9002], 1, lambda a: (f"lim_(h→0) [({a} + h)² − {a * a}]/h = …", fr(2 * a)), [(3,), (4,)]),
    ([9006, 9003], 0, lambda a, b: (f"Dengan definisi turunan sebagai limit, turunan f(x) = {poly([(a, 1), (b, 0)])} adalah …", fr(a)), [(4, 1)]),
    ([9006], 1, lambda a: (f"Untuk sebuah fungsi f, nilai lim_(h→0) [f({a}+h) − f({a})]/h menyatakan …",
                           f"f′({a}), yaitu gradien garis singgung kurva di x = {a}"), [(2,)]),
    ([9007], 0, lambda a, n, b, c: (f"Turunan pertama f(x) = {poly([(a, n), (-b, 1), (c, 0)])} adalah f′(x) = …", poly([(n * a, n - 1), (-b, 0)])),
     [(3, 4, 2, 5), (2, 5, 7, 1), (5, 3, 4, 9)]),
    ([9007], 1, lambda a, n: (f"Turunan pertama f(x) = {a}/x{str(n).translate(SUP)} adalah …", f"−{n * a}/x{str(n + 1).translate(SUP)}"), [(4, 2), (6, 3)]),
    ([9007], 1, lambda a: (f"Turunan pertama f(x) = {a}√x adalah …", f"{fr(Fraction(a, 2))}/√x"), [(4,), (6,)]),
    ([9007], 0, lambda a, b, d: (f"Jika f(x) = {poly([(a, 3), (-b, 2)])}, nilai f′({d}) = …", fr(3 * a * d * d - 2 * b * d)), [(2, 3, 2), (1, 4, 3)]),
    ([9008, 9007], 1, lambda a, b, c: (f"Turunan f(x) = ({poly([(a, 1), (b, 0)])})({poly([(1, 2), (-c, 0)])}) adalah …",
                                       poly([(3 * a, 2), (2 * b, 1), (-a * c, 0)])), [(2, 1, 3), (3, -2, 1)]),
    ([9008, 9007], 2, lambda a, b, c: (f"Turunan f(x) = ({poly([(a, 1), (b, 0)])})/(x {sgn(c)}) adalah …", f"{fr(a * c - b)}/(x {sgn(c)})²"),
     [(2, 1, 3), (3, 4, 1)]),
    ([9008], 1, lambda a, b, c, d: (f"Diketahui u(2) = {a}, u′(2) = {b}, v(2) = {c}, v′(2) = {d}. Jika f = u·v, maka f′(2) = …", fr(b * c + a * d)),
     [(3, 1, 4, 2), (2, 5, 1, 3)]),
    ([9009, 9007], 1, lambda a, b, n: (f"Turunan f(x) = ({poly([(a, 1), (b, 0)])}){str(n).translate(SUP)} adalah …",
                                       f"{n * a}({poly([(a, 1), (b, 0)])}){str(n - 1).translate(SUP)}"), [(2, 1, 5), (3, -4, 4)]),
    ([9009, 9007], 2, lambda a, b: (f"Turunan f(x) = √({poly([(a, 2), (b, 0)])}) adalah …", f"{a}x/√({poly([(a, 2), (b, 0)])})"), [(3, 1), (2, 5)]),
    ([9009], 1, lambda a, b, c: (f"f(x) = g(h(x)) dengan h(1) = {a}, h′(1) = {b}, dan g′({a}) = {c}. Nilai f′(1) = …", fr(b * c)), [(2, 3, 4), (5, 2, 3)]),
    ([9010], 0, lambda a, b: (f"Turunan f(x) = {a} sin x + {b} cos x adalah …", f"{a} cos x − {b} sin x"), [(3, 2), (5, 4)]),
    ([9010, 9009], 1, lambda a: (f"Turunan f(x) = sin({a}x) adalah …", f"{a} cos({a}x)"), [(3,), (5,)]),
    ([9010, 9008], 1, lambda: ("Turunan f(x) = x sin x adalah …", "sin x + x cos x"), [()]),
    ([9010, 9009], 2, lambda: ("Turunan f(x) = cos² x adalah …", "−2 sin x cos x (= −sin 2x)"), [()]),
    ([9011, 9007], 1, lambda b, a: (f"Persamaan garis singgung kurva y = {poly([(1, 2), (b, 1)])} di titik berabsis x = {a} adalah …",
                                    f"y = {poly([(2 * a + b, 1), ((a * a + b * a) - (2 * a + b) * a, 0)])}"), [(2, 1), (-3, 1), (2, 3)]),
    ([9011, 9007], 0, lambda a, d: (f"Gradien garis singgung kurva y = {poly([(a, 3)])} di x = {d} adalah …", fr(3 * a * d * d)), [(2, 1), (1, 2)]),
    ([9011, 9007], 1, lambda a, m: (f"Garis singgung kurva y = {poly([(1, 2), (-a, 1)])} memiliki gradien {m}. Absis titik singgungnya x = …",
                                    fr(Fraction(m + a, 2))), [(4, 2), (6, 2)]),
    ([9012, 9007], 1, lambda p: (f"Fungsi f(x) = {poly([(1, 3), (-3 * p * p, 1)])} naik pada interval …", f"x < −{p} atau x > {p}"), [(1,), (2,)]),
    ([9012, 9007], 1, lambda a, c: (f"Titik stasioner fungsi f(x) = {poly([(1, 2), (-2 * a, 1), (c, 0)])} adalah …", f"({a}, {fr(c - a * a)})"),
     [(3, 1), (2, 7)]),
    ([9012], 1, lambda a, b: (f"Diketahui f′(x) = (x {sgn(-a)})(x {sgn(-b)}). Fungsi f turun pada interval …", f"{a} < x < {b}"), [(1, 4), (-2, 3)]),
    ([9013, 9012, 9007], 1, lambda a, c: (f"Nilai maksimum f(x) = {poly([(-1, 2), (2 * a, 1), (c, 0)])} adalah …", fr(a * a + c)), [(3, 1), (4, -2)]),
    ([9013, 9007], 2, lambda a: (f"Dua bilangan positif berjumlah {2 * a}. Hasil kali maksimum kedua bilangan itu adalah …", fr(a * a)), [(10,), (15,)]),
    ([9013, 9012], 2, lambda b: (f"Nilai minimum f(x) = x³ − 3x pada interval 0 ≤ x ≤ {b} adalah …", "−2"), [(2,), (3,)]),
    ([9013, 9012, 9007], 2, lambda s: (f"Selembar karton persegi bersisi {s} cm dipotong persegi kecil di keempat sudutnya lalu dilipat menjadi kotak "
                                       "tanpa tutup. Volume maksimum kotak adalah … cm³", fr(Fraction(2 * s ** 3, 27))), [(12,), (18,)]),
]


def build_item_bank(rng) -> tuple[pd.DataFrame, np.ndarray]:
    rows, Q = [], []
    qid = 5001
    for t_idx, (cids, tier, fn, plist) in enumerate(T):
        for params in plist:
            stem, key = fn(*params)
            g = rng.uniform(0.08, 0.22)
            s = rng.uniform(0.05, 0.15) + 0.04 * tier + 0.02 * (len(cids) - 1)
            rows.append({"QuestionId": qid, "template_id": t_idx, "question_text": stem, "answer_key": key,
                         "concept_codes": ";".join(next(c[1] for c in CONCEPTS if c[0] == i) for i in cids),
                         "true_guess": round(g, 4), "true_slip": round(min(s, 0.35), 4), "difficulty_tier": tier})
            Q.append([1 if c in cids else 0 for c in CIDS])
            qid += 1
    return pd.DataFrame(rows), np.array(Q)


def sample_mastery(rng, theta, prereq_scale=0.25):
    """Higher-order generating model with an attribute hierarchy (prerequisites)."""
    N = len(theta)
    alpha = np.zeros((N, len(CONCEPTS)))
    pos = {c: i for i, c in enumerate(CIDS)}
    for k, (cid, _, _, _, _, pre, beta) in enumerate(CONCEPTS):
        p = 1 / (1 + np.exp(-1.7 * (theta - beta)))
        for q in [int(x) for x in pre.split(";") if x]:
            p = np.where(alpha[:, pos[q]] == 1, p, p * prereq_scale)
        alpha[:, k] = rng.random(N) < p
    return alpha


def responses_from(rng, alpha, Q, g, s, mask):
    eta = (alpha @ Q.T) >= Q.sum(1)
    p = np.where(eta, 1 - s, g)
    return (rng.random(p.shape) < p).astype(int), mask


def generate_calibration(rng, bank, Q):
    """Synthetic calibration study with a booklet design (each student gets 2 of 4 blocks)."""
    final = DATA_DIR / "final"
    final.mkdir(parents=True, exist_ok=True)
    J = len(bank)
    theta = rng.standard_normal(N_CALIBRATION)
    alpha = sample_mastery(rng, theta)
    blocks = rng.permutation(J) % 4
    pairs = [(0, 1), (2, 3), (0, 2), (1, 3), (0, 3), (1, 2)]
    M = np.zeros((N_CALIBRATION, J), bool)
    for i in range(N_CALIBRATION):
        b1, b2 = pairs[rng.integers(0, 6)]
        M[i] = (blocks == b1) | (blocks == b2)
    M &= rng.random(M.shape) > 0.02                      # 2% skipped items inside the booklet
    X, _ = responses_from(rng, alpha, Q, bank["true_guess"].values, bank["true_slip"].values, M)
    qids = bank["QuestionId"].values
    users = np.arange(100001, 100001 + N_CALIBRATION)
    perm = rng.permutation(users)
    split = {u: ("train" if i < 1600 else "val" if i < 1800 else "test") for i, u in enumerate(perm)}
    start = pd.Timestamp("2026-08-01 08:00")
    for s_name in ["train", "val", "test"]:
        idx = np.array([i for i, u in enumerate(users) if split[u] == s_name])
        r, c = np.where(M[idx])
        df = pd.DataFrame({"UserId": users[idx][r], "QuestionId": qids[c], "AnswerId": np.arange(len(r)) + 1,
                           "IsCorrect": X[idx][r, c], "DateAnswered": (start + pd.to_timedelta(c, unit="min")).astype(str),
                           "split": s_name})
        df.to_csv(final / f"interactions_{s_name}.csv", index=False)
        mat = np.where(M[idx], X[idx], -1).astype(np.int8)
        np.savez_compressed(final / f"responses_{s_name}.npz", matrix=mat, user_ids=users[idx], question_ids=qids)
    qdf = pd.DataFrame(Q, columns=[str(c) for c in CIDS])
    qdf.insert(0, "QuestionId", qids)
    qdf.to_csv(final / "q_matrix.csv", index=False)
    pd.DataFrame([{"concept_index": i, "SubjectId": c[0], "concept_code": c[1], "concept_name": c[2], "role": c[3],
                   "path": f"Kalkulus kelas XI (DUMMY) > {c[3]} > {c[2]}", "n_questions": int(Q[:, i].sum())}
                  for i, c in enumerate(CONCEPTS)]).to_csv(final / "concept_metadata.csv", index=False)
    tr = np.array([split[u] == "train" for u in users])
    n_att = M[tr].sum(0)
    pr = np.where(n_att > 0, (X[tr] * M[tr]).sum(0) / np.maximum(n_att, 1), np.nan)
    ib = bank[["QuestionId", "question_text", "answer_key", "concept_codes"]].copy()
    ib["is_focus"] = True
    ib["concept_names"] = [json.dumps([CONCEPTS[k][2] for k in np.where(Q[j])[0]], ensure_ascii=False) for j in range(J)]
    ib["concept_count"] = Q.sum(1)
    ib["n_attempts"], ib["pass_rate"], ib["difficulty"] = n_att, pr, 1 - pr
    ib.to_csv(final / "cda_item_bank.csv", index=False)
    manifest = {"artifact_source": "dummy_synthetic_calculus_kelas11",
                "population_note": ("DUMMY: 2.000 siswa SINTETIS untuk kalibrasi bank soal kalkulus kelas XI; dibangkitkan oleh "
                                    "cdacdm/dummy_calculus.py dari parameter yang ditetapkan, bukan data siswa nyata."),
                "observed": {"students": N_CALIBRATION, "questions": J, "interactions": int(M.sum())},
                "npz_encoding": {"matrix": "int8; 1 benar, 0 salah, -1 tidak dijawab/tidak diberikan"}, "seed": SEED}
    (final / "dataset_manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    (final / "eda_summary.json").write_text(json.dumps({"splits": {"train": 1600, "val": 200, "test": 200}}), encoding="utf-8")
    truth = DATA_DIR / "generator_truth"
    truth.mkdir(exist_ok=True)
    bank.to_csv(truth / "item_bank_with_true_parameters.csv", index=False)
    pd.DataFrame([{"concept_id": c[0], "code": c[1], "concept_name": c[2], "prerequisites": c[5], "generating_difficulty": c[6]}
                  for c in CONCEPTS]).to_csv(truth / "concept_generating_parameters.csv", index=False)
    return {"n_items": J, "n_observed": int(M.sum()), "observed_share": float(M.mean())}


def write_configs():
    CFG_DIR.mkdir(parents=True, exist_ok=True)
    base = json.loads((PROJECT_ROOT / "configs/experiment.json").read_text(encoding="utf-8"))
    base["experiment_name"] = "dummy_calculus_kelas11_pdina_vem"
    base["paths"].update({"data_dir": "dummy_data/kalkulus_kelas11/final", "data_dir_candidates": [], "search_roots": [],
                          "output_dir": "artifacts_calculus", "target_concept_map": "configs/calculus/target_concept_map.csv",
                          "target_curriculum": "configs/calculus/target_curriculum.csv",
                          "intervention_map": "configs/calculus/intervention_map.csv", "focus_item_content_audit": None})
    base["data"].update({"expected_splits": {"train": 1600, "val": 200, "test": 200}, "expected_n_questions": len(build_item_bank(np.random.default_rng(SEED))[0]),
                         "expected_n_concepts": len(CONCEPTS)})
    base["assessment"]["replay_students"] = 200
    # test-length DESIGN choice for the kelas XI scenario (researcher decision, not learned): 3 items per concept,
    # 13 concepts -> 39-item pre/post forms (~1 lesson of 90 min). n_min (diagnosability) is still selected on validation.
    base["assessment"]["items_per_concept"] = 3
    base["assessment"]["_comment_dummy"] = "items_per_concept=3 is a test-design choice for the dummy kelas XI scenario."
    (CFG_DIR / "experiment.json").write_text(json.dumps(base, indent=2, ensure_ascii=False), encoding="utf-8")
    pd.DataFrame([{"concept_id": c[0], "concept_code": c[1], "concept_name": c[2], "in_target_scope": True,
                   "target_domain": "calculus" if c[3] != "prerequisite" else "algebra_prerequisite", "relevance_level": c[3],
                   "mapped_target_topics": {"prerequisite": "K0", "core_limit": "K1", "core_derivative": "K2", "application": "K3"}[c[3]],
                   "curriculum_order": c[4], "prerequisite_concept_ids": c[5],
                   "mapping_basis": "DUMMY scenario: concept list drafted for kelas XI kalkulus; align with the syllabus actually used",
                   "review_status": "draft_needs_researcher_review"} for c in CONCEPTS]).to_csv(CFG_DIR / "target_concept_map.csv", index=False)
    pd.DataFrame([
        {"topic_id": "K0", "domain": "algebra", "level": "prasyarat", "topic_name": "Fungsi dan aljabar prasyarat kalkulus",
         "mapped_eedi_concept_ids": "9001;9002", "mapping_type": "direct", "notes": "DUMMY", "status": "draft"},
        {"topic_id": "K1", "domain": "calculus", "level": "kelas XI", "topic_name": "Limit fungsi (aljabar, tak hingga, trigonometri)",
         "mapped_eedi_concept_ids": "9003;9004;9005", "mapping_type": "direct", "notes": "DUMMY", "status": "draft"},
        {"topic_id": "K2", "domain": "calculus", "level": "kelas XI", "topic_name": "Turunan fungsi (definisi, aturan, trigonometri)",
         "mapped_eedi_concept_ids": "9006;9007;9008;9009;9010", "mapping_type": "direct", "notes": "DUMMY", "status": "draft"},
        {"topic_id": "K3", "domain": "calculus", "level": "kelas XI", "topic_name": "Aplikasi turunan (garis singgung, monotonitas, optimasi)",
         "mapped_eedi_concept_ids": "9011;9012;9013", "mapping_type": "direct", "notes": "DUMMY", "status": "draft"},
        {"topic_id": "K4", "domain": "calculus", "level": "kelas XII (di luar skenario)", "topic_name": "Integral",
         "mapped_eedi_concept_ids": "", "mapping_type": "unmapped", "notes": "Tidak ada soal dalam bank dummy", "status": "draft"},
    ]).to_csv(CFG_DIR / "target_curriculum.csv", index=False)
    gaps = {
        9001: "Belum lancar mengevaluasi f(a), komposisi, atau menentukan domain fungsi.",
        9002: "Kesulitan memfaktorkan / menyederhanakan bentuk aljabar (termasuk merasionalkan bentuk akar).",
        9003: "Belum dapat menyelesaikan limit bentuk tak tentu 0/0 (faktorisasi/rasionalisasi) atau substitusi langsung.",
        9004: "Belum memahami perilaku fungsi rasional saat x→∞ (membandingkan pangkat tertinggi).",
        9005: "Belum menguasai limit dasar sin x/x dan turunannya pada bentuk trigonometri.",
        9006: "Belum memaknai turunan sebagai limit hasil bagi selisih / gradien garis singgung.",
        9007: "Kesalahan menerapkan aturan pangkat, konstanta, dan jumlah (termasuk pangkat negatif dan akar).",
        9008: "Kesalahan menerapkan aturan perkalian/pembagian (urutan suku, tanda, kuadrat penyebut).",
        9009: "Lupa mengalikan turunan fungsi dalam (aturan rantai).",
        9010: "Tertukar turunan sin dan cos atau tanda negatif pada turunan cos.",
        9011: "Belum menghubungkan f′(a) dengan gradien lalu menyusun persamaan garis singgung.",
        9012: "Belum menggunakan tanda f′(x) untuk interval naik/turun dan titik stasioner.",
        9013: "Belum memodelkan masalah kontekstual dan memeriksa nilai ekstrem (termasuk ujung interval).",
    }
    pd.DataFrame([{"concept_id": c[0], "concept_name": c[2], "gap_description": gaps[c[0]],
                   "material_source": "PLACEHOLDER: isi dengan bab/halaman buku ajar atau LKPD yang dipakai sekolah (belum ada sumber tervalidasi).",
                   "remedial_activity": (f"PLACEHOLDER (draft): pembelajaran terbimbing konsep '{c[2]}' dengan contoh bertahap, "
                                         "diskusi kesalahan umum, lalu latihan soal setara dari item bank dengan umpan balik langsung."),
                   "enrichment_practice": "PLACEHOLDER (draft): soal lanjutan bertingkat dari item bank (lihat practice_question_ids).",
                   "estimated_duration_min": "", "status": "draft_dummy", "validated_by": "",
                   "notes": "Skenario DUMMY; deskripsi gap adalah draf pedagogis yang wajib ditinjau guru/dosen."}
                  for c in CONCEPTS]).to_csv(CFG_DIR / "intervention_map.csv", index=False)


def generate_class_data(rng, bank, Q, form_a, form_b):
    """Two intact classes (XI-A intervention, XI-B comparison), pre-test = form A, post-test = form B."""
    cls_dir = DATA_DIR / "kelas"
    cls_dir.mkdir(parents=True, exist_ok=True)
    roster = [("XI-A", "treatment", 36), ("XI-B", "control", 35)]
    ids, cls, grp = [], [], []
    for c, g, n in roster:
        for i in range(n):
            ids.append(f"{c}-{i + 1:02d}")
            cls.append(c)
            grp.append(g)
    N = len(ids)
    theta = rng.normal(-0.2, 0.9, N)
    a_pre = sample_mastery(rng, theta)
    pos = {c: i for i, c in enumerate(CIDS)}
    a_post = a_pre.copy()
    for k, cdef in enumerate(CONCEPTS):
        pre_ok = np.ones(N, bool)
        for q in [int(x) for x in cdef[5].split(";") if x]:
            pre_ok &= a_post[:, pos[q]] == 1
        gain = np.where(np.array(grp) == "treatment", GAIN_TREATMENT, GAIN_CONTROL) * np.where(pre_ok, 1.0, 0.3)
        learned = (a_pre[:, k] == 0) & (rng.random(N) < gain)
        forgot = (a_pre[:, k] == 1) & (rng.random(N) > RETAIN)
        a_post[:, k] = np.where(learned, 1, np.where(forgot, 0, a_pre[:, k]))
    g, s = bank.set_index("QuestionId")["true_guess"], bank.set_index("QuestionId")["true_slip"]
    qpos = {q: j for j, q in enumerate(bank["QuestionId"])}

    def test(alpha, form, tag, absent):
        qs = form["QuestionId"].astype(int).tolist()
        idx = [qpos[q] for q in qs]
        eta = (alpha @ Q[idx].T) >= Q[idx].sum(1)
        p = np.where(eta, 1 - s.loc[qs].values, g.loc[qs].values)
        x = (rng.random(p.shape) < p).astype(int)
        blank = rng.random(p.shape) < 0.03
        rows = []
        for i, sid in enumerate(ids):
            if sid in absent:
                continue
            for j, q in enumerate(qs):
                rows.append({"student_id": sid, "class": cls[i], "group": grp[i], "form_id": tag, "QuestionId": q,
                             "response": "" if blank[i, j] else int(x[i, j]), "is_dummy": True})
        return pd.DataFrame(rows)

    pre = test(a_pre, form_a, "PRE_FORM_A", absent={"XI-B-07"})
    post = test(a_post, form_b, "POST_FORM_B", absent={"XI-A-12", "XI-B-30"})
    pre.to_csv(cls_dir / "DUMMY_pretest_kelasXI.csv", index=False)
    post.to_csv(cls_dir / "DUMMY_posttest_kelasXI.csv", index=False)
    pd.DataFrame({"student_id": ids, "class": cls, "group": grp, "is_dummy": True}).to_csv(cls_dir / "DUMMY_roster_kelasXI.csv", index=False)
    truth = pd.DataFrame([{"student_id": sid, "class": cls[i], "group": grp[i], "concept_id": CIDS[k],
                           "alpha_pre": int(a_pre[i, k]), "alpha_post": int(a_post[i, k])} for i, sid in enumerate(ids) for k in range(len(CIDS))])
    truth.to_csv(cls_dir / "DUMMY_true_mastery_kelasXI.csv", index=False)
    (cls_dir / "README_DUMMY.txt").write_text(
        "DATA KELAS DUMMY - bukan siswa nyata.\n"
        f"XI-A (treatment, 36 siswa) dan XI-B (control, 35 siswa). Pre-test = parallel form A, post-test = form B.\n"
        f"Peluang menguasai konsep yang belum dikuasai antara pre dan post: treatment {GAIN_TREATMENT}, control {GAIN_CONTROL} "
        f"(dikali 0.3 bila prasyarat belum dikuasai); retensi {RETAIN}. 3% jawaban kosong; XI-B-07 absen pre-test, "
        "XI-A-12 dan XI-B-30 absen post-test.\nPerbedaan antar kelas DIPASANG oleh parameter simulasi ini.\n", encoding="utf-8")
    return pre, post, truth


def analyse_class(pre, post, truth):
    from .prepost import compare_pre_post
    from .qmatrix import write_json
    from .service import CDMService
    svc = CDMService.load(OUT_DIR)
    out = OUT_DIR / "class_dummy"
    out.mkdir(exist_ok=True)
    pre.to_csv(out / "DUMMY_pretest_kelasXI.csv", index=False)     # copies used by the Streamlit app
    post.to_csv(out / "DUMMY_posttest_kelasXI.csv", index=False)
    report = {"LABEL": "DUMMY kelas XI kalkulus - data sintetis, bukan hasil penelitian", "policy": svc.policy.to_dict()}
    diag = svc.diagnose(pre)
    diag["profiles"].to_csv(out / "DUMMY_pretest_mastery_profiles.csv", index=False)
    diag["gaps"].to_csv(out / "DUMMY_pretest_learning_gaps.csv", index=False)
    diag["recommendations"].to_csv(out / "DUMMY_pretest_intervention_plan.csv", index=False)
    cs_all = []
    for c, d in pre.groupby("class"):
        r = svc.diagnose(d)
        cs_all.append(r["class_summary"].assign(**{"class": c}))
    pd.concat(cs_all).to_csv(out / "DUMMY_pretest_class_gap_summary_by_class.csv", index=False)
    res = compare_pre_post(svc.model, pre, post, svc.policy, svc.concept_ids, svc.concept_names, items=svc.items, item_bank=svc.item_bank)
    res["students"].to_csv(out / "DUMMY_prepost_student_changes.csv", index=False)
    res["student_concepts"].to_csv(out / "DUMMY_prepost_student_concept_changes.csv", index=False)
    res["concepts"].to_csv(out / "DUMMY_prepost_concept_changes_all.csv", index=False)
    by_class = {}
    for c in sorted(pre["class"].unique()):
        r = compare_pre_post(svc.model, pre[pre["class"] == c], post[post["class"] == c], svc.policy, svc.concept_ids,
                             svc.concept_names, items=svc.items, item_bank=svc.item_bank)
        r["concepts"].to_csv(out / f"DUMMY_prepost_concept_changes_{c}.csv", index=False)
        by_class[c] = {"n_matched": r["summary"]["n_matched"], "overall_score": r["summary"]["overall_score"],
                       "n_concepts_detectable_increase": int((r["concepts"]["interpretation"].str.startswith("observed increase")).sum())}
    post_diag = svc.diagnose(post)
    post_diag["recommendations"].to_csv(out / "DUMMY_posttest_remedial_plan.csv", index=False)
    # check against the known simulation truth (possible only because the data are simulated)
    t = truth.copy()
    pp = diag["profiles"].merge(t, on=["student_id", "concept_id"])
    ok = pp["mastery_label"].isin(["mastered", "not_mastered"])
    acc_pre = float(((pp.loc[ok, "mastery_label"] == "mastered") == (pp.loc[ok, "alpha_pre"] == 1)).mean())
    sc = res["student_concepts"].merge(t, on=["student_id", "concept_id"])
    corr = float(np.corrcoef(sc["mastery_change"], sc["alpha_post"] - sc["alpha_pre"])[0, 1])
    report.update({
        "pretest": {"n_students": int(pre["student_id"].nunique()), "label_counts": diag["profiles"]["mastery_label"].value_counts().to_dict(),
                    "n_students_with_gap": int(diag["gaps"].loc[diag["gaps"]["gap_status"] == "learning_gap", "student_id"].nunique())},
        "prepost_all": res["summary"], "prepost_by_class": by_class,
        "simulation_truth_check": {"pretest_label_accuracy_on_diagnosable_cells": acc_pre, "n_diagnosable_cells": int(ok.sum()),
                                   "corr_estimated_vs_true_mastery_change": corr,
                                   "note": "Hanya dapat dihitung karena data disimulasikan; tidak tersedia pada data kelas nyata."},
        "design_note": ("XI-A vs XI-B adalah kelas utuh (tidak diacak): perbandingan bersifat kuasi-eksperimen. Selisih antar kelas pada data "
                        f"ini dipasang oleh parameter simulasi (gain treatment {GAIN_TREATMENT} vs control {GAIN_CONTROL})."),
    })
    write_json(report, out / "DUMMY_class_report.json")
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-train", action="store_true")
    a = ap.parse_args()
    rng = np.random.default_rng(SEED)
    bank, Q = build_item_bank(rng)
    info = generate_calibration(rng, bank, Q)
    write_configs()
    print("dummy calibration data:", info)
    if not a.skip_train:
        from .pipeline import Pipeline
        Pipeline(CFG_DIR / "experiment.json").run_all()
    fa = pd.read_csv(OUT_DIR / "assessment/parallel_form_A.csv")
    fb = pd.read_csv(OUT_DIR / "assessment/parallel_form_B.csv")
    pre, post, truth = generate_class_data(np.random.default_rng(SEED + 1), bank, Q, fa, fb)
    rep = analyse_class(pre, post, truth)
    print(json.dumps({k: rep[k] for k in ["pretest", "prepost_by_class", "simulation_truth_check"]}, indent=1, default=str, ensure_ascii=False))


if __name__ == "__main__":
    main()
