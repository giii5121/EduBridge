"""Artifact loading, schema validation, missing-response handling and leakage audit.

Conventions used throughout the package
---------------------------------------
* ``X``  float array (n_students, n_items): 1 = correct, 0 = incorrect, 0 where missing.
* ``M``  bool  array (n_students, n_items): True where a response was OBSERVED.
  Missing responses are never treated as incorrect; every likelihood multiplies by ``M``.
* ``Q``  int array (n_items, n_concepts), binary Q-matrix.
* concept ids are the EEDI ``SubjectId`` values; concept_index is the column in ``Q``.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from .config import REQUIRED_ARTIFACTS, check_artifact_presence

ID_CANDIDATES = ["SubjectId", "concept_id", "subject_id", "ConceptId"]
NAME_CANDIDATES = ["concept_name", "Name", "name", "ConceptName"]
INDEX_CANDIDATES = ["concept_index", "concept_idx", "index", "col_index"]


class ArtifactValidationError(ValueError):
    """Raised when a prepared artifact does not satisfy the expected schema."""


@dataclass
class ResponseData:
    user_ids: np.ndarray
    X: np.ndarray
    M: np.ndarray

    @property
    def n_students(self) -> int:
        return len(self.user_ids)

    def subset(self, idx) -> "ResponseData":
        return ResponseData(self.user_ids[idx], self.X[idx], self.M[idx])


@dataclass
class ArtifactBundle:
    data_dir: Path
    question_ids: np.ndarray
    concept_ids: np.ndarray
    concept_names: list
    Q: np.ndarray
    concept_meta: pd.DataFrame
    item_bank: pd.DataFrame
    manifest: dict
    eda: dict
    splits: dict = field(default_factory=dict)
    audit: dict = field(default_factory=dict)


# ----------------------------------------------------------------------------------
# Q-matrix + concept metadata
# ----------------------------------------------------------------------------------

def _pick(cols, cands):
    for c in cands:
        if c in cols:
            return c
    return None


def standardize_concept_meta(cm: pd.DataFrame) -> pd.DataFrame:
    """Return concept metadata with standard columns concept_index, concept_id, concept_name."""
    cm = cm.copy()
    idc, nmc, ixc = _pick(cm.columns, ID_CANDIDATES), _pick(cm.columns, NAME_CANDIDATES), _pick(cm.columns, INDEX_CANDIDATES)
    if idc is None:
        raise ArtifactValidationError(f"concept_metadata.csv has no concept id column (looked for {ID_CANDIDATES}); columns={list(cm.columns)}")
    if nmc is None:
        raise ArtifactValidationError(f"concept_metadata.csv has no concept name column (looked for {NAME_CANDIDATES})")
    cm = cm.rename(columns={idc: "concept_id", nmc: "concept_name"})
    if ixc is not None and ixc != "concept_index":
        cm = cm.rename(columns={ixc: "concept_index"})
    if "concept_index" not in cm.columns:
        cm["concept_index"] = np.arange(len(cm))
    cm["concept_id"] = pd.to_numeric(cm["concept_id"], errors="raise").astype(int)
    if cm["concept_id"].duplicated().any():
        raise ArtifactValidationError("duplicate concept ids in concept_metadata.csv")
    return cm.sort_values("concept_index").reset_index(drop=True)


def match_q_columns(q_cols, cm: pd.DataFrame) -> list[int]:
    """Map Q-matrix column labels to concept ids (accepts SubjectId, index, name, c<id>, concept_<id>)."""
    by_id = {str(i): i for i in cm["concept_id"]}
    by_idx = {str(ix): i for ix, i in zip(cm["concept_index"], cm["concept_id"])}
    by_name = {str(n).strip().lower(): i for n, i in zip(cm["concept_name"], cm["concept_id"])}

    def strip(c):
        c = str(c).strip().lower()
        for pre in ("concept_", "c_", "c"):
            if c.startswith(pre) and c[len(pre):].isdigit():
                return c[len(pre):]
        return c

    # every column must map under ONE strategy, so mixed interpretations cannot happen silently
    strategies = [
        ("SubjectId", lambda c: by_id.get(str(c).strip())),
        ("concept_name", lambda c: by_name.get(str(c).strip().lower())),
        ("concept_index", lambda c: by_idx.get(str(c).strip())),
        ("prefixed concept_index (e.g. c_0, as written by the original data-preparation notebook)", lambda c: by_idx.get(strip(c))),
        ("prefixed SubjectId (e.g. c_33)", lambda c: by_id.get(strip(c))),
    ]
    for name, f in strategies:
        mapped = [f(c) for c in q_cols]
        if all(m is not None for m in mapped) and len(set(mapped)) == len(mapped):
            return mapped
    raise ArtifactValidationError(
        "Q-matrix concept columns could not be matched to concept_metadata.csv "
        f"(first columns: {list(q_cols)[:5]}). Fix the headers or concept metadata."
    )


def validate_q_matrix(qm: pd.DataFrame, expected_items: int | None = None, expected_concepts: int | None = None) -> dict:
    if "QuestionId" not in qm.columns:
        raise ArtifactValidationError("q_matrix.csv must contain a QuestionId column")
    if not qm["QuestionId"].is_unique:
        raise ArtifactValidationError("QuestionId in q_matrix.csv is not unique")
    vals = qm.drop(columns=["QuestionId"])
    if vals.isna().any().any():
        raise ArtifactValidationError("q_matrix.csv contains missing values")
    uniq = set(np.unique(vals.values).tolist())
    if not uniq.issubset({0, 1}):
        raise ArtifactValidationError(f"q_matrix.csv is not binary; values found: {sorted(uniq)[:10]}")
    report = {"n_items": int(len(qm)), "n_concepts": int(vals.shape[1]), "binary": True}
    if expected_items is not None and len(qm) != expected_items:
        raise ArtifactValidationError(f"q_matrix.csv has {len(qm)} rows, expected {expected_items}")
    if expected_concepts is not None and vals.shape[1] != expected_concepts:
        raise ArtifactValidationError(f"q_matrix.csv has {vals.shape[1]} concept columns, expected {expected_concepts}")
    Q = vals.values.astype(int)
    report["items_without_concept"] = qm.loc[Q.sum(1) == 0, "QuestionId"].astype(int).tolist()
    report["concepts_without_items"] = [str(c) for c, n in zip(vals.columns, Q.sum(0)) if n == 0]
    return report


# ----------------------------------------------------------------------------------
# Responses
# ----------------------------------------------------------------------------------

def detect_npz_encoding(z) -> dict:
    keys = list(z.keys())
    mkey = _pick(keys, ["matrix", "responses", "R", "X", "data"])
    if mkey is None:
        raise ArtifactValidationError(f"npz has no response matrix key; keys={keys}")
    ukey = _pick(keys, ["user_ids", "users", "student_ids", "UserId"])
    qkey = _pick(keys, ["question_ids", "questions", "item_ids", "QuestionId"])
    maskkey = _pick(keys, ["mask", "observed", "M"])
    mat = np.asarray(z[mkey])
    vals = np.unique(mat[~np.isnan(mat)] if mat.dtype.kind == "f" else mat)
    has_nan = bool(mat.dtype.kind == "f" and np.isnan(mat).any())
    if maskkey is not None:
        scheme = f"explicit mask key '{maskkey}'"
    elif has_nan:
        scheme = "NaN = missing"
    elif set(vals.tolist()) <= {-1, 0, 1} and -1 in vals:
        scheme = "-1 = missing"
    elif set(vals.tolist()) <= {0, 1}:
        scheme = "AMBIGUOUS: only {0,1} and no mask -> missing indistinguishable from incorrect"
    else:
        scheme = f"UNKNOWN values {vals[:10].tolist()}"
    return {"keys": keys, "matrix_key": mkey, "user_key": ukey, "question_key": qkey, "mask_key": maskkey,
            "dtype": str(mat.dtype), "shape": list(mat.shape), "unique_values": vals[:10].tolist(), "missing_scheme": scheme}


def load_npz_responses(path: Path, question_ids: np.ndarray) -> tuple[ResponseData | None, dict]:
    with np.load(path, allow_pickle=False) as z:
        enc = detect_npz_encoding(z)
        mat = np.asarray(z[enc["matrix_key"]]).astype(float)
        users = np.asarray(z[enc["user_key"]]) if enc["user_key"] else None
        qids = np.asarray(z[enc["question_key"]]) if enc["question_key"] else None
        if enc["mask_key"]:
            M = np.asarray(z[enc["mask_key"]]).astype(bool)
        elif enc["missing_scheme"].startswith("NaN"):
            M = ~np.isnan(mat)
        elif enc["missing_scheme"].startswith("-1"):
            M = mat != -1
        else:
            return None, enc  # cannot build a trustworthy mask from the npz alone
    if qids is not None and not np.array_equal(qids, question_ids):
        if set(qids.tolist()) != set(question_ids.tolist()):
            raise ArtifactValidationError(f"{path.name}: question_ids differ from q_matrix QuestionId")
        order = pd.Index(qids).get_indexer(question_ids)
        mat, M = mat[:, order], M[:, order]
        enc["column_reordered"] = True
    elif qids is None:
        if mat.shape[1] != len(question_ids):
            raise ArtifactValidationError(f"{path.name}: {mat.shape[1]} columns but q_matrix has {len(question_ids)} items")
        enc["column_order_assumed"] = "same as q_matrix QuestionId order (verified against interactions below)"
    X = np.where(M, np.nan_to_num(mat), 0.0)
    if not set(np.unique(X[M]).tolist()) <= {0.0, 1.0}:
        raise ArtifactValidationError(f"{path.name}: observed responses are not binary")
    if users is None:
        users = np.arange(len(X))
    return ResponseData(users, X, M), enc


def interactions_to_matrix(df: pd.DataFrame, question_ids: np.ndarray, user_col="UserId", item_col="QuestionId",
                           y_col="IsCorrect") -> ResponseData:
    users = np.sort(df[user_col].unique())
    upos = pd.Index(users).get_indexer(df[user_col])
    qpos = pd.Index(question_ids).get_indexer(df[item_col])
    if (qpos < 0).any():
        bad = df.loc[qpos < 0, item_col].unique()[:10]
        raise ArtifactValidationError(f"interactions contain QuestionId not in q_matrix: {bad.tolist()}")
    X = np.zeros((len(users), len(question_ids)))
    M = np.zeros_like(X, dtype=bool)
    X[upos, qpos] = df[y_col].values
    M[upos, qpos] = True
    return ResponseData(users, X, M)


def read_interactions_safely(path: Path, model_columns: list[str], leakage_cols: list[str], extra=("DateAnswered", "AnswerId")):
    """Read only the columns the model needs; record which leakage-prone columns were excluded."""
    header = pd.read_csv(path, nrows=0).columns.tolist()
    missing = [c for c in model_columns if c not in header]
    if missing:
        raise ArtifactValidationError(f"{path.name} lacks required columns {missing}")
    use = list(model_columns) + [c for c in extra if c in header]
    df = pd.read_csv(path, usecols=use)
    roles = {}
    for c in header:
        if c in model_columns:
            roles[c] = "used_by_model"
        elif c in extra:
            roles[c] = "read_for_ordering_only"
        elif c in leakage_cols or any(c.startswith(l) for l in leakage_cols):
            roles[c] = "excluded_leakage_prone"
        else:
            roles[c] = "excluded_not_used"
    return df, {"columns": header, "roles": roles}


def validate_interactions(df: pd.DataFrame, name: str) -> dict:
    rep = {"rows": int(len(df)), "students": int(df["UserId"].nunique()), "questions": int(df["QuestionId"].nunique())}
    if not df["IsCorrect"].isin([0, 1]).all():
        raise ArtifactValidationError(f"{name}: IsCorrect must be 0/1")
    dup = int(df.duplicated(["UserId", "QuestionId"]).sum())
    rep["duplicate_user_question_pairs"] = dup
    rep["correct_rate"] = float(df["IsCorrect"].mean())
    rep["dtypes"] = {c: str(t) for c, t in df.dtypes.items()}
    return rep


def check_alignment(a: ResponseData, b: ResponseData) -> dict:
    """Compare an npz-derived matrix with the interactions-derived one."""
    rep = {"same_users": bool(np.array_equal(np.sort(a.user_ids), np.sort(b.user_ids)))}
    if not rep["same_users"]:
        rep["n_users_npz"], rep["n_users_csv"] = int(len(a.user_ids)), int(len(b.user_ids))
        return rep
    order = pd.Index(a.user_ids).get_indexer(b.user_ids)
    Ma, Xa = a.M[order], a.X[order]
    rep["mask_equal"] = bool(np.array_equal(Ma, b.M))
    both = Ma & b.M
    rep["value_mismatches"] = int((Xa[both] != b.X[both]).sum())
    rep["cells_only_in_npz"] = int((Ma & ~b.M).sum())
    rep["cells_only_in_csv"] = int((~Ma & b.M).sum())
    rep["aligned"] = rep["mask_equal"] and rep["value_mismatches"] == 0
    return rep


# ----------------------------------------------------------------------------------
# Top-level loader
# ----------------------------------------------------------------------------------

def load_artifacts(data_dir: str | Path, cfg: dict | None = None, splits=("train", "val", "test"),
                   strict_counts: bool = True) -> ArtifactBundle:
    cfg = cfg or {}
    dcfg = cfg.get("data", {})
    data_dir = Path(data_dir)
    audit: dict = {"data_dir": str(data_dir), "presence": check_artifact_presence(data_dir)}
    missing = [k for k, v in audit["presence"].items() if not v["exists"]]
    if any(m in missing for m in ["q_matrix.csv", "concept_metadata.csv"]):
        raise FileNotFoundError(f"core artifacts missing in {data_dir}: {missing}")
    audit["missing_files"] = missing

    qm = pd.read_csv(data_dir / "q_matrix.csv")
    exp_items = dcfg.get("expected_n_questions") if strict_counts else None
    exp_conc = dcfg.get("expected_n_concepts") if strict_counts else None
    audit["q_matrix"] = validate_q_matrix(qm, exp_items, exp_conc)
    cm = standardize_concept_meta(pd.read_csv(data_dir / "concept_metadata.csv"))
    q_cols = [c for c in qm.columns if c != "QuestionId"]
    concept_ids = np.array(match_q_columns(q_cols, cm))
    cm = cm.set_index("concept_id").loc[concept_ids].reset_index()
    cm["concept_index"] = np.arange(len(cm))
    qm = qm.sort_values("QuestionId").reset_index(drop=True)
    question_ids = qm["QuestionId"].astype(int).values
    Q = qm[q_cols].values.astype(int)

    item_bank = pd.read_csv(data_dir / "cda_item_bank.csv") if (data_dir / "cda_item_bank.csv").exists() else pd.DataFrame({"QuestionId": question_ids})
    if set(item_bank["QuestionId"]) != set(question_ids):
        raise ArtifactValidationError("cda_item_bank.csv QuestionIds differ from q_matrix.csv")
    item_bank = item_bank.set_index("QuestionId").loc[question_ids].reset_index()

    manifest = json.loads((data_dir / "dataset_manifest.json").read_text(encoding="utf-8")) if (data_dir / "dataset_manifest.json").exists() else {}
    eda = json.loads((data_dir / "eda_summary.json").read_text(encoding="utf-8")) if (data_dir / "eda_summary.json").exists() else {}
    audit["artifact_source"] = manifest.get("artifact_source", "drive_artifacts (original pipeline)")

    bundle = ArtifactBundle(data_dir, question_ids, concept_ids, cm["concept_name"].tolist(), Q, cm, item_bank, manifest, eda)
    model_cols = dcfg.get("model_columns", ["UserId", "QuestionId", "IsCorrect"])
    leak_cols = dcfg.get("leakage_prone_columns", [])
    audit["splits"], audit["leakage"] = {}, {}
    for s in splits:
        rep: dict = {}
        csv_path, npz_path = data_dir / f"interactions_{s}.csv", data_dir / f"responses_{s}.npz"
        csv_resp = npz_resp = None
        if csv_path.exists():
            df, roles = read_interactions_safely(csv_path, model_cols, leak_cols)
            rep["interactions"] = validate_interactions(df, csv_path.name)
            if rep["interactions"]["duplicate_user_question_pairs"]:
                df = df.sort_values([c for c in ["UserId", "QuestionId", "DateAnswered", "AnswerId"] if c in df.columns])
                df = df.drop_duplicates(["UserId", "QuestionId"], keep="last")
            csv_resp = interactions_to_matrix(df, question_ids)
            audit["leakage"][s] = roles
        if npz_path.exists():
            npz_resp, enc = load_npz_responses(npz_path, question_ids)
            rep["npz_encoding"] = enc
        if csv_resp is not None and npz_resp is not None:
            rep["alignment_npz_vs_csv"] = check_alignment(npz_resp, csv_resp)
        # interactions CSV is the primary source of observed interactions
        resp = csv_resp if csv_resp is not None else npz_resp
        if resp is None:
            raise FileNotFoundError(f"no usable responses for split {s}")
        rep["source_used"] = "interactions_csv" if csv_resp is not None else "npz"
        rep["n_students"] = int(resp.n_students)
        rep["observed_cells"] = int(resp.M.sum())
        rep["matrix_density"] = float(resp.M.mean())
        rep["responses_per_student"] = {"min": int(resp.M.sum(1).min()), "median": float(np.median(resp.M.sum(1))), "max": int(resp.M.sum(1).max())}
        exp = dcfg.get("expected_splits", {}).get(s)
        rep["expected_students"] = exp
        rep["count_matches_expected"] = (exp is None) or (exp == resp.n_students)
        bundle.splits[s] = resp
        audit["splits"][s] = rep
    sets = {s: set(r.user_ids.tolist()) for s, r in bundle.splits.items()}
    names = list(sets)
    audit["student_disjoint"] = all(not (sets[a] & sets[b]) for i, a in enumerate(names) for b in names[i + 1:])
    if not audit["student_disjoint"]:
        raise ArtifactValidationError("splits are not student-disjoint")
    audit["item_bank_stats_source"] = _check_item_bank_source(bundle)
    bundle.audit = audit
    return bundle


def _check_item_bank_source(b: ArtifactBundle) -> dict:
    """Verify that item-bank pass_rate was computed from training students only (no test leakage)."""
    if "pass_rate" not in b.item_bank.columns or "train" not in b.splits:
        return {"checked": False}
    tr = b.splits["train"]
    n = tr.M.sum(0)
    pr_train = np.where(n > 0, (tr.X * tr.M).sum(0) / np.maximum(n, 1), np.nan)
    ib = b.item_bank["pass_rate"].values.astype(float)
    ok = ~np.isnan(pr_train) & ~np.isnan(ib)
    max_diff = float(np.max(np.abs(pr_train[ok] - ib[ok]))) if ok.any() else None
    res = {"checked": True, "max_abs_diff_vs_train_pass_rate": max_diff, "matches_train_only": max_diff is not None and max_diff < 1e-9}
    if "n_attempts" in b.item_bank.columns:
        res["n_attempts_matches_train_counts"] = bool(np.array_equal(b.item_bank["n_attempts"].values.astype(int), n.astype(int)))
    return res
