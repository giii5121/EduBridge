"""Rule-based intervention recommendations driven by the diagnosis.

The module never invents learning resources: every field comes from the editable
``configs/intervention_map.csv``. Rows that have not been filled and validated by a teacher /
lecturer are marked ``is_placeholder = True`` and ``requires_teacher_validation = True``.
EEDI contains no treatment labels, so nothing here predicts the effectiveness of an intervention.

Transparent rules (applied in this order):
  R1  status:      learning_gap -> remediate; possible_gap_uncertain -> re-assess first;
                   needs_more_data -> administer diagnostic items, no remediation yet
  R2  prerequisite: a gap concept whose prerequisite is also a gap is scheduled after it
  R3  priority:    within the same status, higher priority_score first (need x certainty)
  R4  curriculum:  ties broken by curriculum_order of the target concept map
  R5  grouping:    class gap share >= whole_class_gap_share -> whole-class session;
                   >= small_group_gap_share -> small group; otherwise individual
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from .data import ArtifactValidationError

MAP_COLUMNS = ["concept_id", "concept_name", "gap_description", "material_source", "remedial_activity",
               "enrichment_practice", "estimated_duration_min", "status", "validated_by", "notes"]
PLACEHOLDER = "PLACEHOLDER"


def create_placeholder_map(target_map: pd.DataFrame) -> pd.DataFrame:
    rows = []
    t = target_map[target_map["in_target_scope"]]
    if "curriculum_order" in t.columns:
        t = t.sort_values("curriculum_order")
    for _, r in t.iterrows():
        n = r["concept_name"]
        rows.append({
            "concept_id": int(r["concept_id"]), "concept_name": n,
            "gap_description": f"{PLACEHOLDER} (generik): probabilitas penguasaan model rendah untuk '{n}' berdasarkan respons diagnostik; deskripsi miskonsepsi spesifik perlu diisi guru/dosen.",
            "material_source": f"{PLACEHOLDER}: belum ada sumber materi tervalidasi - isi dengan bahan ajar yang disetujui guru/dosen.",
            "remedial_activity": f"{PLACEHOLDER} (generik): penjelasan ulang konsep '{n}' dengan contoh terbimbing, lalu latihan bertahap dengan umpan balik.",
            "enrichment_practice": f"{PLACEHOLDER} (generik): latihan lanjutan memakai soal item bank yang dipetakan ke konsep ini (lihat practice_question_ids).",
            "estimated_duration_min": "", "status": "placeholder", "validated_by": "",
            "notes": "Dibuat otomatis; wajib divalidasi guru/dosen sebelum dipakai.",
        })
    return pd.DataFrame(rows, columns=MAP_COLUMNS)


def load_intervention_map(path: str | Path, target_map: pd.DataFrame) -> tuple[pd.DataFrame, list]:
    """Load the map, validate ids, and add placeholder rows for target concepts that are missing."""
    warnings = []
    path = Path(path)
    if path.exists():
        im = pd.read_csv(path, dtype={"estimated_duration_min": str})
        miss = [c for c in ["concept_id", "concept_name", "remedial_activity"] if c not in im.columns]
        if miss:
            raise ArtifactValidationError(f"intervention_map is missing columns {miss}")
        for c in MAP_COLUMNS:
            if c not in im.columns:
                im[c] = ""
        im["concept_id"] = pd.to_numeric(im["concept_id"], errors="raise").astype(int)
        unknown = sorted(set(im["concept_id"]) - set(target_map["concept_id"].astype(int)))
        if unknown:
            raise ArtifactValidationError(f"intervention_map references unknown concept ids {unknown}")
    else:
        warnings.append(f"{path} not found: all recommendations are generic placeholders")
        im = pd.DataFrame(columns=MAP_COLUMNS)
    tgt = target_map[target_map["in_target_scope"]]
    absent = tgt[~tgt["concept_id"].isin(im["concept_id"])]
    if len(absent):
        warnings.append(f"no intervention entry for concepts {absent['concept_id'].tolist()}: placeholder added")
        im = pd.concat([im, create_placeholder_map(absent.assign(in_target_scope=True))], ignore_index=True)
    for c in im.columns:
        if c != "concept_id":
            im[c] = im[c].astype(object).where(im[c].notna(), "")
    im["is_placeholder"] = im.apply(lambda r: str(r["status"]).strip().lower() != "validated"
                                    or PLACEHOLDER in str(r["material_source"]) or PLACEHOLDER in str(r["remedial_activity"]), axis=1)
    return im, warnings


def recommend_intervention(gaps: pd.DataFrame, intervention_map: pd.DataFrame, target_map: pd.DataFrame,
                           class_summary: pd.DataFrame | None = None, items: pd.DataFrame | None = None,
                           policy_cfg: dict | None = None, exclude_question_ids=()) -> pd.DataFrame:
    """Return one recommendation row per (student, gap concept) following rules R1-R5."""
    cfg = {"whole_class_gap_share": 0.5, "small_group_gap_share": 0.25, "practice_items_per_concept": 5}
    cfg.update(policy_cfg or {})
    if gaps is None or len(gaps) == 0:
        return pd.DataFrame()
    im = intervention_map.set_index("concept_id")
    tm = target_map.set_index("concept_id")
    share = class_summary.set_index("concept_id")["gap_share_among_diagnosable"].to_dict() if class_summary is not None and len(class_summary) else {}
    practice = {}
    if items is not None:
        excl = set(int(q) for q in exclude_question_ids)
        for c in gaps["concept_id"].unique():
            has = items["concept_ids"].str.split(";").apply(lambda l: str(c) in l)
            cand = items[has & items["reliable_params"] & ~items["QuestionId"].isin(excl)].sort_values("model_difficulty")
            practice[int(c)] = cand["QuestionId"].astype(int).head(int(cfg["practice_items_per_concept"])).tolist()
    rows = []
    for sid, g in gaps.groupby("student_id", sort=False):
        gap_set = set(g.loc[g["gap_status"] == "learning_gap", "concept_id"].astype(int))
        for _, r in g.iterrows():
            c = int(r["concept_id"])
            e = im.loc[c] if c in im.index else None
            prereqs = [int(float(p)) for p in str(tm.loc[c].get("prerequisite_concept_ids", "") if c in tm.index else "").split(";") if p.strip() not in ("", "nan")]
            blocked_by = [p for p in prereqs if p in gap_set]
            trace = []
            if r["gap_status"] == "learning_gap":
                action = "remediate"
                trace.append("R1: learning_gap -> remediation")
            elif r["gap_status"] == "possible_gap_uncertain":
                action = "reassess_then_decide"
                trace.append("R1: uncertain -> re-assess with more items before remediation")
            else:
                action = "collect_more_evidence"
                trace.append("R1: insufficient evidence -> administer diagnostic items; no remediation yet")
            if blocked_by:
                trace.append(f"R2: prerequisite gap(s) {blocked_by} scheduled first")
            cs = share.get(c, np.nan)
            if action == "remediate" and not np.isnan(cs):
                level = ("whole_class" if cs >= cfg["whole_class_gap_share"] else
                         "small_group" if cs >= cfg["small_group_gap_share"] else "individual")
                trace.append(f"R5: class gap share {cs:.2f} -> {level}")
            else:
                level = "individual"
            rows.append({
                "student_id": sid, "concept_id": c, "concept_name": r["concept_name"], "gap_status": r["gap_status"],
                "recommended_action": action, "mastery_prob": r["mastery_prob"], "n_evidence": int(r["n_evidence"]),
                "priority_score": r["priority_score"], "prerequisite_gaps": ";".join(map(str, blocked_by)),
                "curriculum_order": tm.loc[c].get("curriculum_order", np.nan) if c in tm.index else np.nan,
                "class_gap_share": cs, "intervention_level": level,
                "gap_description": e["gap_description"] if e is not None else "",
                "material_source": e["material_source"] if e is not None else "",
                "remedial_activity": e["remedial_activity"] if (e is not None and action == "remediate") else
                    ("Berikan soal diagnostik tambahan untuk konsep ini (lihat practice_question_ids) lalu ulangi diagnosis." if action != "remediate" else ""),
                "enrichment_practice": e["enrichment_practice"] if e is not None else "",
                "estimated_duration_min": e["estimated_duration_min"] if e is not None else "",
                "practice_question_ids": ";".join(map(str, practice.get(c, []))),
                "is_placeholder": bool(e["is_placeholder"]) if e is not None else True,
                "requires_teacher_validation": True if e is None else bool(e["is_placeholder"]),
                "rule_trace": " | ".join(trace),
                "effectiveness_claim": "none (no intervention outcome data available)",
            })
    out = pd.DataFrame(rows)
    status_rank = out["gap_status"].map({"learning_gap": 0, "possible_gap_uncertain": 1, "needs_more_data": 2})
    out["_blocked"] = out["prerequisite_gaps"].ne("").astype(int)
    out["_s"] = status_rank
    out = out.sort_values(["student_id", "_s", "_blocked", "priority_score", "curriculum_order"],
                          ascending=[True, True, True, False, True])
    out["recommendation_rank"] = out.groupby("student_id").cumcount() + 1
    return out.drop(columns=["_blocked", "_s"]).reset_index(drop=True)
