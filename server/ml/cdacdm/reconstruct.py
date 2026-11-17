"""Local re-implementation of the data-preparation artifacts.

WHY THIS EXISTS: the audited notebook ``eedi_task34_cda_cdm_pipeline.ipynb`` calls
``run_pipeline()`` but never defines it, so the preparation cannot be reproduced from
the notebook alone, and the Drive artifacts are not available outside Colab. This module
rebuilds artifacts with the *same file names and the schema visible in the notebook
outputs* from the official public archive, so the modelling code can be developed and
tested end-to-end locally. It is NOT a byte-identical copy of the Drive artifacts, but
against the partial Drive copy (interactions_train/val) the student split and every
(UserId, QuestionId, IsCorrect) row match exactly. Everything it writes is marked
``artifact_source = "local_reconstruction"`` in dataset_manifest.json.

Usage:
    python -m cdacdm.reconstruct --zip ILCDA/data.zip \
        --out ILCDA/processed_task34_cda_cdm/final_local_reconstruction
"""
from __future__ import annotations

import argparse
import json
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

RAW_FILES = {
    "train": "data/train_data/train_task_3_4.csv",
    "answer_meta": "data/metadata/answer_metadata_task_3_4.csv",
    "question_meta": "data/metadata/question_metadata_task_3_4.csv",
    "student_meta": "data/metadata/student_metadata_task_3_4.csv",
    "subject_meta": "data/metadata/subject_metadata.csv",
}


def extract(zip_path: Path, extract_dir: Path) -> Path:
    extract_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist()
        wanted = [n for n in names if n in RAW_FILES.values() or (n.startswith("data/images/") and n.endswith(".jpg"))]
        for n in wanted:
            target = extract_dir / n
            if not target.exists():
                z.extract(n, extract_dir)
    return extract_dir / "data"


def _entropy(p: np.ndarray) -> float:
    p = p[p > 0]
    return float(-(p * np.log2(p)).sum())


def build(data_root: Path, out_dir: Path, seed: int = 42) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    root = data_root
    tr = pd.read_csv(root / "train_data/train_task_3_4.csv")
    am = pd.read_csv(root / "metadata/answer_metadata_task_3_4.csv")
    qm = pd.read_csv(root / "metadata/question_metadata_task_3_4.csv")
    sm = pd.read_csv(root / "metadata/student_metadata_task_3_4.csv")
    subj = pd.read_csv(root / "metadata/subject_metadata.csv", encoding="utf-8-sig")
    subj["ParentId"] = pd.to_numeric(subj["ParentId"], errors="coerce")

    # ---- clean + merge -----------------------------------------------------------
    df = tr.merge(am, on="AnswerId", how="left").merge(sm, on="UserId", how="left")
    df["DateAnswered"] = pd.to_datetime(df["DateAnswered"], errors="coerce")
    assert df["IsCorrect"].isin([0, 1]).all()
    df = df[df["AnswerValue"].isin([1, 2, 3, 4]) & df["CorrectAnswer"].isin([1, 2, 3, 4])]
    # latest response per (student, question)
    df = df.sort_values(["UserId", "QuestionId", "DateAnswered", "AnswerId"])
    n_before = len(df)
    df = df.drop_duplicates(["UserId", "QuestionId"], keep="last")
    n_dups = n_before - len(df)

    # ---- concepts: level-3 SubjectIds ----------------------------------------------
    sid2 = subj.set_index("SubjectId")
    qm["subjects"] = qm["SubjectId"].apply(json.loads)
    qm["level3"] = qm["subjects"].apply(lambda s: [x for x in s if sid2.loc[x, "Level"] == 3])
    concepts = sorted({c for l in qm["level3"] for c in l})
    cidx = {c: i for i, c in enumerate(concepts)}

    def chain(x):
        out = []
        while not pd.isna(x):
            out.append(sid2.loc[int(x), "Name"])
            x = sid2.loc[int(x), "ParentId"]
        return out[::-1]

    qm["all_topics"] = qm["subjects"].apply(lambda s: [sid2.loc[x, "Name"] for x in s])
    qm["is_focus"] = qm["all_topics"].apply(lambda t: "Algebra" in t)
    qids = np.sort(qm["QuestionId"].unique())
    Q = np.zeros((len(qids), len(concepts)), dtype=int)
    qpos = {q: i for i, q in enumerate(qids)}
    for q, l in zip(qm["QuestionId"], qm["level3"]):
        for c in l:
            Q[qpos[q], cidx[c]] = 1
    qdf = pd.DataFrame(Q, columns=[str(c) for c in concepts])
    qdf.insert(0, "QuestionId", qids)
    qdf.to_csv(out_dir / "q_matrix.csv", index=False)

    focus_q = set(qm.loc[qm["is_focus"], "QuestionId"])
    cm = []
    for c in concepts:
        ch = chain(c)
        n_items = int(Q[:, cidx[c]].sum())
        n_focus = int(sum(Q[qpos[q], cidx[c]] for q in focus_q))
        cm.append({"concept_index": cidx[c], "SubjectId": c, "concept_name": sid2.loc[c, "Name"],
                   "level1": ch[1] if len(ch) > 1 else None, "level2": ch[2] if len(ch) > 2 else None,
                   "path": " > ".join(ch), "n_questions": n_items, "n_focus_questions": n_focus,
                   "is_focus_concept": n_focus > 0})
    pd.DataFrame(cm).to_csv(out_dir / "concept_metadata.csv", index=False)

    # ---- student-disjoint split 80/10/10 ------------------------------------------
    users = np.sort(df["UserId"].unique())
    rng = np.random.default_rng(seed)
    perm = rng.permutation(users)
    n = len(perm)
    n_val = int(round(0.1 * n))
    n_test = int(round(0.1 * n))
    split_of = {}
    for u in perm[:n - n_val - n_test]:
        split_of[u] = "train"
    for u in perm[n - n_val - n_test:n - n_test]:
        split_of[u] = "val"
    for u in perm[n - n_test:]:
        split_of[u] = "test"
    df["split"] = df["UserId"].map(split_of)

    # ---- features (written to mimic the original schema; several are leakage-prone) --
    df = df.sort_values(["UserId", "DateAnswered", "AnswerId"]).reset_index(drop=True)
    g = df.groupby("UserId")
    df["prior_accuracy"] = (g["IsCorrect"].cumsum() - df["IsCorrect"]) / g.cumcount().replace(0, np.nan)
    df["student_mean_confidence"] = g["Confidence"].transform("mean")
    df["time_since_prev_sec"] = g["DateAnswered"].diff().dt.total_seconds()
    t0 = df["DateAnswered"].min()
    df["elapsed_days"] = (df["DateAnswered"] - t0).dt.total_seconds() / 86400
    dob = pd.to_datetime(df["DateOfBirth"], errors="coerce")
    df["age_years"] = (df["DateAnswered"] - dob).dt.days / 365.25
    trn = df[df["split"] == "train"]
    qstat = trn.groupby("QuestionId")["IsCorrect"].mean()
    df["question_pass_rate"] = df["QuestionId"].map(qstat)
    df["question_difficulty"] = 1 - df["question_pass_rate"]
    for col, src in [("confidence_norm_z", "Confidence"), ("time_since_prev_sec_log1p_z", "time_since_prev_sec"),
                     ("elapsed_days_log1p_z", "elapsed_days"), ("question_pass_rate_z", "question_pass_rate"),
                     ("question_difficulty_z", "question_difficulty"), ("prior_accuracy_z", "prior_accuracy"),
                     ("age_years_z", "age_years")]:
        v = df[src].astype(float)
        if "log1p" in col:
            v = np.log1p(v.clip(lower=0))
        mu, sd = v[df["split"] == "train"].mean(), v[df["split"] == "train"].std()
        df[col] = (v - mu) / (sd if sd > 0 else 1.0)
    cols = ["UserId", "QuestionId", "AnswerId", "IsCorrect", "CorrectAnswer", "AnswerValue", "DateAnswered",
            "Confidence", "GroupId", "QuizId", "SchemeOfWorkId", "Gender", "DateOfBirth", "PremiumPupil",
            "student_mean_confidence", "prior_accuracy", "age_years", "question_pass_rate", "question_difficulty",
            "confidence_norm_z", "time_since_prev_sec_log1p_z", "elapsed_days_log1p_z", "question_pass_rate_z",
            "question_difficulty_z", "prior_accuracy_z", "age_years_z", "split"]
    for s in ["train", "val", "test"]:
        part = df[df["split"] == s]
        part[cols].to_csv(out_dir / f"interactions_{s}.csv", index=False)
        su = np.sort(part["UserId"].unique())
        upos = {u: i for i, u in enumerate(su)}
        mat = np.full((len(su), len(qids)), -1, dtype=np.int8)  # -1 = not answered
        mat[part["UserId"].map(upos).values, part["QuestionId"].map(qpos).values] = part["IsCorrect"].values
        np.savez_compressed(out_dir / f"responses_{s}.npz", matrix=mat, user_ids=su, question_ids=qids)

    # ---- item bank (statistics from TRAIN only) ------------------------------------
    rows = []
    for q in qids:
        t = trn[trn["QuestionId"] == q]
        opts = t["AnswerValue"].value_counts(normalize=True).reindex([1, 2, 3, 4], fill_value=0.0)
        ca = df.loc[df["QuestionId"] == q, "CorrectAnswer"]
        c_names = [sid2.loc[c, "Name"] for c in qm.loc[qm["QuestionId"] == q, "level3"].iloc[0]]
        rows.append({"QuestionId": q, "is_focus": q in focus_q, "concept_names": json.dumps(c_names),
                     "concept_count": len(c_names), "image_path": f"images/{q}.jpg", "n_attempts": len(t),
                     "pass_rate": t["IsCorrect"].mean() if len(t) else np.nan,
                     "mean_confidence": t["Confidence"].mean(), "option_entropy": _entropy(opts.values),
                     "correct_answer_nunique": ca.nunique(), "correct_answer": int(ca.mode().iloc[0]),
                     "option_1_rate": opts[1], "option_2_rate": opts[2], "option_3_rate": opts[3], "option_4_rate": opts[4],
                     "difficulty": 1 - t["IsCorrect"].mean() if len(t) else np.nan,
                     "correct_answer_consistent": ca.nunique() == 1,
                     "has_image": (root / "images" / f"{q}.jpg").exists()})
    pd.DataFrame(rows).to_csv(out_dir / "cda_item_bank.csv", index=False)

    ytr = trn["IsCorrect"]
    cw = {str(k): float(len(ytr) / (2 * (ytr == k).sum())) for k in [0, 1]}
    age_last = df.groupby("UserId")["age_years"].last()
    manifest = {
        "artifact_source": "local_reconstruction",
        "note": "Rebuilt by cdacdm.reconstruct from the official public archive; not the Drive artifacts.",
        "data_root": str(root),
        "observed": {"students": int(df["UserId"].nunique()), "questions": int(len(qids)), "interactions": int(len(df))},
        "duplicates_removed": int(n_dups),
        "split_seed": seed,
        "npz_encoding": {"matrix": "int8; 1=correct, 0=incorrect, -1=not answered", "rows": "user_ids", "cols": "question_ids"},
    }
    eda = {
        "splits": {s: int((pd.Series(split_of) == s).sum()) for s in ["train", "val", "test"]},
        "binary_class_weights": cw,
        "train_correct_rate": float(ytr.mean()),
        "students_16_17_proxy": int(((age_last >= 16) & (age_last < 18)).sum()),
        "focus_questions": int(len(focus_q)),
        "multi_concept_questions": int((Q.sum(1) > 1).sum()),
        "q_matrix_density": float(Q.mean()),
        "concepts": {"n_concepts": len(concepts), "concept_map": {str(c): i for c, i in cidx.items()}},
    }
    (out_dir / "dataset_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (out_dir / "eda_summary.json").write_text(json.dumps(eda, indent=2), encoding="utf-8")
    return {"manifest": manifest, "eda": eda}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", default="ILCDA/data.zip")
    ap.add_argument("--extract-dir", default="ILCDA/processed_task34_cda_cdm/eedi_task34_extracted")
    ap.add_argument("--out", default="ILCDA/processed_task34_cda_cdm/final_local_reconstruction")
    ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args()
    ex = Path(a.extract_dir)
    data_root = ex / "data"
    if not (data_root / RAW_FILES["train"].replace("data/", "")).exists():
        data_root = extract(Path(a.zip), ex)
    res = build(data_root, Path(a.out), seed=a.seed)
    print(json.dumps(res, indent=2, default=str))


if __name__ == "__main__":
    main()
