"""Parse and validate user-supplied response files (CSV / DataFrame / dict).

Accepted layouts
----------------
Long (recommended)::

    student_id,QuestionId,response          response: 1 = correct, 0 = incorrect, blank = not answered
    S01,124,1
    S01,152,

or, instead of ``response``, an ``answer_option`` column (1-4) that is scored against the item
bank's ``correct_answer``. Optional columns: ``form_id``, ``group`` (e.g. treatment/control).

Wide::

    student_id,124,152,859        (column headers are QuestionIds, optionally prefixed with q / Q)
    S01,1,,0

Blank / NaN never counts as incorrect. Unknown QuestionIds, invalid values and conflicting
duplicates raise ``ResponseValidationError`` with an explicit message.
"""
from __future__ import annotations

import re

import numpy as np
import pandas as pd

STUDENT_COLS = ["student_id", "UserId", "StudentId", "user_id"]
ITEM_COLS = ["QuestionId", "question_id", "item_id"]
RESP_COLS = ["response", "IsCorrect", "is_correct", "correct", "score"]
TRUE_VALUES = {"1", "1.0", "true", "benar", "correct", "b"}
FALSE_VALUES = {"0", "0.0", "false", "salah", "incorrect", "s"}
BLANK_VALUES = {"", "nan", "none", "na", "null", "-", "skip"}


class ResponseValidationError(ValueError):
    pass


def _find(cols, cands):
    low = {c.lower(): c for c in cols}
    for c in cands:
        if c.lower() in low:
            return low[c.lower()]
    return None


def _parse_value(v):
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return np.nan
    s = str(v).strip().lower()
    if s in BLANK_VALUES:
        return np.nan
    if s in TRUE_VALUES:
        return 1.0
    if s in FALSE_VALUES:
        return 0.0
    raise ResponseValidationError(f"invalid response value '{v}' (use 1, 0 or blank)")


def to_long(df: pd.DataFrame, item_bank: pd.DataFrame | None = None) -> tuple[pd.DataFrame, list]:
    """Normalise any accepted layout to long format: student_id, QuestionId, response (float / NaN)."""
    warnings = []
    if df is None or len(df) == 0:
        raise ResponseValidationError("the response table is empty")
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    scol = _find(df.columns, STUDENT_COLS)
    if scol is None:
        raise ResponseValidationError(f"no student identifier column (expected one of {STUDENT_COLS})")
    icol = _find(df.columns, ITEM_COLS)
    extra = [c for c in ["form_id", "group"] if c in df.columns]
    if icol is not None:  # long layout
        rcol = _find(df.columns, RESP_COLS)
        if rcol is None and "answer_option" in df.columns:
            if item_bank is None or "correct_answer" not in item_bank.columns:
                raise ResponseValidationError("answer_option given but item bank has no correct_answer to score it")
            key = item_bank.set_index("QuestionId")["correct_answer"]
            opt = pd.to_numeric(df["answer_option"], errors="coerce")
            bad = df["answer_option"].notna() & df["answer_option"].astype(str).str.strip().ne("") & ~opt.isin([1, 2, 3, 4])
            if bad.any():
                raise ResponseValidationError(f"answer_option must be 1-4; invalid rows: {df.index[bad].tolist()[:10]}")
            q = pd.to_numeric(df[icol], errors="coerce")
            df["response"] = np.where(opt.isna(), np.nan, (opt.values == q.map(key).values).astype(float))
            rcol = "response"
            warnings.append("responses scored from answer_option against item-bank correct_answer")
        elif rcol is None:
            raise ResponseValidationError(f"no response column (expected one of {RESP_COLS} or answer_option)")
        out = pd.DataFrame({"student_id": df[scol].astype(str).str.strip(), "QuestionId": df[icol], "response": df[rcol]})
        for c in extra:
            out[c] = df[c].values
    else:  # wide layout
        qcols = [c for c in df.columns if c != scol and c not in extra]
        parsed = {}
        for c in qcols:
            m = re.fullmatch(r"[qQ]?_?(\d+)", c)
            if not m:
                raise ResponseValidationError(f"wide format: column '{c}' is not a QuestionId (use e.g. 124 or q124)")
            parsed[c] = int(m.group(1))
        out = df.melt(id_vars=[scol] + extra, value_vars=qcols, var_name="col", value_name="response")
        out["QuestionId"] = out["col"].map(parsed)
        out = out.rename(columns={scol: "student_id"}).drop(columns=["col"])
        out["student_id"] = out["student_id"].astype(str).str.strip()
    q = pd.to_numeric(out["QuestionId"], errors="coerce")
    if q.isna().any():
        raise ResponseValidationError(f"non-numeric QuestionId values: {out.loc[q.isna(), 'QuestionId'].unique()[:10].tolist()}")
    out["QuestionId"] = q.astype(int)
    if out["student_id"].isin(["", "nan", "None"]).any():
        raise ResponseValidationError("empty student_id in some rows")
    out["response"] = out["response"].apply(_parse_value)
    dup = out.duplicated(["student_id", "QuestionId"], keep=False)
    if dup.any():
        d = out[dup].groupby(["student_id", "QuestionId"])["response"].nunique(dropna=False)
        if (d > 1).any():
            bad = d[d > 1].index.tolist()[:5]
            raise ResponseValidationError(f"conflicting duplicate responses for (student, QuestionId): {bad}")
        warnings.append(f"{int(dup.sum())} identical duplicate rows removed")
        out = out.drop_duplicates(["student_id", "QuestionId"])
    return out.reset_index(drop=True), warnings


def to_matrix(long: pd.DataFrame, question_ids) -> tuple[np.ndarray, np.ndarray, np.ndarray, dict]:
    """Long -> (student_ids, X, M). Raises on QuestionIds unknown to the model."""
    qids = np.asarray(question_ids).astype(int)
    pos = pd.Index(qids).get_indexer(long["QuestionId"])
    if (pos < 0).any():
        unknown = sorted(long.loc[pos < 0, "QuestionId"].unique().tolist())
        raise ResponseValidationError(f"{len(unknown)} QuestionId(s) not in the model item bank: {unknown[:20]}")
    students = pd.unique(long["student_id"])
    spos = pd.Index(students).get_indexer(long["student_id"])
    X = np.zeros((len(students), len(qids)))
    M = np.zeros_like(X, dtype=bool)
    obs = long["response"].notna().to_numpy()
    X[spos[obs], pos[obs]] = long.loc[obs, "response"].to_numpy()
    M[spos[obs], pos[obs]] = True
    info = {"n_students": int(len(students)), "n_rows": int(len(long)), "n_observed": int(obs.sum()),
            "n_blank": int((~obs).sum()), "students_with_no_observed_response": [str(s) for s in students[M.sum(1) == 0]]}
    return np.asarray(students, dtype=object), X, M, info


def parse_responses(data, question_ids, item_bank=None):
    """Accepts DataFrame, CSV path / buffer, or dict {student_id: {QuestionId: 0/1/None}}."""
    if isinstance(data, dict):
        rows = [{"student_id": s, "QuestionId": q, "response": r} for s, d in data.items() for q, r in d.items()]
        df = pd.DataFrame(rows)
    elif isinstance(data, pd.DataFrame):
        df = data
    else:
        try:
            df = pd.read_csv(data, dtype=str, keep_default_na=False)
        except Exception as e:  # noqa: BLE001
            raise ResponseValidationError(f"could not read CSV: {e}")
    long, warns = to_long(df, item_bank)
    students, X, M, info = to_matrix(long, question_ids)
    info["warnings"] = warns
    return long, students, X, M, info


def response_template(form: pd.DataFrame, student_ids=("S001", "S002")) -> pd.DataFrame:
    rows = [{"student_id": s, "form_id": r.get("form_id", ""), "QuestionId": int(r["QuestionId"]), "response": ""}
            for s in student_ids for _, r in form.iterrows()]
    return pd.DataFrame(rows)
