"""Q-matrix analysis, target-concept mapping, focus-item audit and coverage report."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from .data import ArtifactValidationError

TARGET_MAP_REQUIRED = ["concept_id", "concept_name", "in_target_scope"]


def analyze_q_matrix(Q: np.ndarray, question_ids, concept_ids, concept_names, min_items: int = 5) -> tuple[dict, pd.DataFrame, pd.DataFrame]:
    Q = np.asarray(Q)
    per_item = Q.sum(1)
    per_concept = Q.sum(0)
    summary = {
        "n_items": int(Q.shape[0]), "n_concepts": int(Q.shape[1]),
        "density": float(Q.mean()), "avg_concepts_per_item": float(per_item.mean()),
        "items_without_concept": int((per_item == 0).sum()), "multi_concept_items": int((per_item > 1).sum()),
        "concepts_without_items": [int(c) for c, n in zip(concept_ids, per_concept) if n == 0],
        "concepts_below_min_items": [int(c) for c, n in zip(concept_ids, per_concept) if 0 < n < min_items],
        "min_items_threshold": min_items,
        "items_per_concept": {"min": int(per_concept.min()), "median": float(np.median(per_concept)), "max": int(per_concept.max())},
    }
    concept_table = pd.DataFrame({"concept_id": concept_ids, "concept_name": concept_names, "n_items": per_concept,
                                  "n_items_single_concept": (Q[per_item == 1]).sum(0),
                                  "n_items_multi_concept": (Q[per_item > 1]).sum(0)})
    concept_table["measurement_flag"] = np.where(concept_table["n_items"] == 0, "no_items",
                                                 np.where(concept_table["n_items"] < min_items, "few_items", "ok"))
    multi = [{"QuestionId": int(q), "n_concepts": int(per_item[i]),
              "concept_ids": ";".join(str(int(concept_ids[k])) for k in np.where(Q[i])[0]),
              "concept_names": "; ".join(concept_names[k] for k in np.where(Q[i])[0])}
             for i, q in enumerate(question_ids) if per_item[i] > 1]
    return summary, concept_table, pd.DataFrame(multi)


def _to_bool(v):
    if isinstance(v, (bool, np.bool_)):
        return bool(v)
    s = str(v).strip().lower()
    if s in ("true", "1", "yes", "y"):
        return True
    if s in ("false", "0", "no", "n", "", "nan"):
        return False
    raise ArtifactValidationError(f"in_target_scope value '{v}' is not boolean")


def load_target_concept_map(path: str | Path, concept_ids) -> pd.DataFrame:
    """Load and validate the editable target concept map. Raises on unknown/duplicate ids."""
    tm = pd.read_csv(path)
    return validate_target_concept_map(tm, concept_ids)


def validate_target_concept_map(tm: pd.DataFrame, concept_ids) -> pd.DataFrame:
    missing = [c for c in TARGET_MAP_REQUIRED if c not in tm.columns]
    if missing:
        raise ArtifactValidationError(f"target_concept_map is missing columns {missing}")
    tm = tm.copy()
    try:
        tm["concept_id"] = pd.to_numeric(tm["concept_id"], errors="raise").astype(int)
    except (ValueError, TypeError) as e:
        raise ArtifactValidationError(f"target_concept_map concept_id must be integer SubjectIds: {e}")
    if tm["concept_id"].duplicated().any():
        raise ArtifactValidationError(f"duplicate concept_id in target_concept_map: {tm.loc[tm['concept_id'].duplicated(), 'concept_id'].tolist()}")
    known = set(int(c) for c in concept_ids)
    unknown = sorted(set(tm["concept_id"]) - known)
    if unknown:
        raise ArtifactValidationError(f"target_concept_map references concept ids not in the model/Q-matrix: {unknown}")
    tm["in_target_scope"] = tm["in_target_scope"].apply(_to_bool)
    if not tm["in_target_scope"].any():
        raise ArtifactValidationError("target_concept_map selects no target concept")
    if "curriculum_order" in tm.columns:
        tm["curriculum_order"] = pd.to_numeric(tm["curriculum_order"], errors="coerce")
    if "prerequisite_concept_ids" in tm.columns:
        for v in tm["prerequisite_concept_ids"].dropna():
            for p in str(v).split(";"):
                if p.strip() and int(float(p)) not in known:
                    raise ArtifactValidationError(f"prerequisite concept id {p} unknown")
    return tm


def target_concepts(tm: pd.DataFrame) -> list[int]:
    t = tm[tm["in_target_scope"]]
    if "curriculum_order" in t.columns:
        t = t.sort_values("curriculum_order")
    return t["concept_id"].astype(int).tolist()


def target_q_matrix(Q, question_ids, concept_ids, target_ids) -> tuple[pd.DataFrame, dict]:
    cidx = [list(concept_ids).index(c) for c in target_ids]
    Qt = Q[:, cidx]
    has_t = Qt.sum(1) > 0
    other = np.delete(Q, cidx, axis=1).sum(1) > 0
    df = pd.DataFrame(Qt[has_t], columns=[str(c) for c in target_ids])
    df.insert(0, "QuestionId", np.asarray(question_ids)[has_t])
    df["also_requires_non_target_concept"] = other[has_t]
    info = {"n_target_concepts": len(target_ids), "n_items_with_target_concept": int(has_t.sum()),
            "n_items_target_only": int((has_t & ~other).sum()), "n_items_mixed_target_and_non_target": int((has_t & other).sum()),
            "density": float(Qt[has_t].mean()) if has_t.any() else 0.0}
    return df, info


def focus_item_audit(item_bank: pd.DataFrame, Q, question_ids, concept_ids, concept_meta: pd.DataFrame,
                     tm: pd.DataFrame, content_audit: pd.DataFrame | None) -> tuple[pd.DataFrame, dict]:
    """Audit is_focus items: concept labels, hierarchy, target-scope status and (sampled) content review."""
    if "is_focus" not in item_bank.columns:
        return pd.DataFrame(), {"available": False}
    tm_i = tm.set_index("concept_id")
    path_col = "path" if "path" in concept_meta.columns else None
    cm_i = concept_meta.set_index("concept_id")
    qpos = {int(q): i for i, q in enumerate(question_ids)}
    ca = content_audit.set_index("QuestionId") if content_audit is not None and len(content_audit) else None
    rows = []
    focus = item_bank[item_bank["is_focus"].astype(str).str.lower().isin(["true", "1"])]
    for q in focus["QuestionId"].astype(int):
        ks = np.where(Q[qpos[q]])[0]
        cids = [int(concept_ids[k]) for k in ks]
        in_scope = [bool(tm_i.loc[c, "in_target_scope"]) for c in cids]
        row = {"QuestionId": q, "concept_ids": ";".join(map(str, cids)),
               "concept_names": "; ".join(str(cm_i.loc[c, "concept_name"]) for c in cids),
               "eedi_path": " | ".join(str(cm_i.loc[c, path_col]) for c in cids) if path_col else "",
               "all_concepts_in_target_scope": all(in_scope), "any_concept_in_target_scope": any(in_scope),
               "relevance_level": ";".join(str(tm_i.loc[c].get("relevance_level", "")) for c in cids),
               "n_train_attempts": int(item_bank.loc[item_bank["QuestionId"] == q, "n_attempts"].iloc[0]) if "n_attempts" in item_bank else None}
        if ca is not None and q in ca.index:
            row["content_reviewed"] = True
            row["label_match"] = ca.loc[q, "label_match"]
            row["content_summary"] = ca.loc[q, "content_summary"]
            row["estimated_level"] = ca.loc[q, "estimated_level"]
        else:
            row["content_reviewed"] = False
            row["label_match"] = "not_reviewed"
        rows.append(row)
    df = pd.DataFrame(rows)
    rev = df[df["content_reviewed"]]
    summary = {
        "available": True, "n_focus_items": int(len(df)),
        "n_focus_items_all_concepts_in_scope": int(df["all_concepts_in_target_scope"].sum()),
        "n_focus_items_outside_scope": int((~df["any_concept_in_target_scope"]).sum()),
        "n_content_reviewed": int(len(rev)),
        "content_review_label_match_counts": rev["label_match"].value_counts().to_dict() if len(rev) else {},
        "note": ("Content review is a SAMPLE (see configs/focus_item_content_audit.csv); unreviewed focus items keep "
                 "label_match='not_reviewed' and must not be assumed relevant."),
    }
    if "estimated_level" in rev.columns and len(rev):
        summary["reviewed_estimated_levels"] = rev["estimated_level"].value_counts().to_dict()
    return df, summary


def coverage_report(curriculum: pd.DataFrame, concept_table: pd.DataFrame, tm: pd.DataFrame,
                    eligible_counts: dict | None = None, min_items: int = 6) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Per target-curriculum topic: mapped EEDI concepts, item counts and adequacy; plus unmapped topics."""
    ct = concept_table.set_index("concept_id")
    rows = []
    for _, r in curriculum.iterrows():
        ids = [int(float(x)) for x in str(r.get("mapped_eedi_concept_ids", "")).split(";") if str(x).strip() not in ("", "nan")]
        n_items = int(sum(ct.loc[i, "n_items"] for i in ids if i in ct.index))
        n_elig = int(sum(eligible_counts.get(i, 0) for i in ids)) if eligible_counts else None
        status = "unmapped" if not ids else r.get("mapping_type", "mapped")
        rows.append({"topic_id": r["topic_id"], "domain": r["domain"], "level": r.get("level", ""), "topic_name": r["topic_name"],
                     "mapped_eedi_concept_ids": ";".join(map(str, ids)),
                     "mapped_eedi_concept_names": "; ".join(str(ct.loc[i, "concept_name"]) for i in ids if i in ct.index),
                     "mapping_type": status, "n_items_total": n_items, "n_items_eligible": n_elig,
                     "adequate_for_pre_post_forms": bool(ids) and (n_elig if n_elig is not None else n_items) >= min_items,
                     "notes": r.get("notes", "")})
    cov = pd.DataFrame(rows)
    unmapped = cov[cov["mapping_type"] == "unmapped"][["topic_id", "domain", "level", "topic_name", "notes"]]
    return cov, unmapped


def write_json(obj, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False, default=_default), encoding="utf-8")


def _default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if np.isnan(o) else float(o)
    if isinstance(o, (np.bool_,)):
        return bool(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    if isinstance(o, Path):
        return str(o)
    return str(o)
