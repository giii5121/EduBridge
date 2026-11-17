"""Public API.

    from cdacdm.api import (train_model, load_model, predict_mastery, select_assessment,
                            detect_learning_gaps, recommend_intervention, compare_pre_post)
"""
from __future__ import annotations

import pandas as pd

from . import diagnosis as _diag
from . import intervention as _int
from . import prepost as _pp
from .assessment import AdaptiveSession, build_fixed_form, build_parallel_forms
from .diagnosis import DiagnosisPolicy
from .pipeline import Pipeline
from .service import CDMService


def train_model(config_path=None, overrides: dict | None = None, log=print) -> dict:
    """Run the full pipeline (audit -> train -> validate -> single test evaluation -> save checkpoint).
    Returns the run summary; the checkpoint is written to <output_dir>/model."""
    return Pipeline(config_path, overrides, log=log).run_all()


def load_model(artifact_dir=None) -> CDMService:
    return CDMService.load(artifact_dir)


def predict_mastery(responses, service: CDMService | None = None, artifact_dir=None, policy: DiagnosisPolicy | None = None,
                    only_target: bool = False) -> pd.DataFrame:
    """Mastery profile (student_id, concept_id, concept_name, mastery_prob, mastery_label, n_evidence, posterior_sd, ...)
    for new or existing students using frozen item parameters. Partial / incomplete answers are fine:
    blank responses are treated as not observed."""
    service = service or CDMService.load(artifact_dir)
    prof, _, _ = service.predict_mastery(responses, policy, only_target)
    return prof


def select_assessment(mode: str = "fixed", service: CDMService | None = None, artifact_dir=None, items_per_concept: int | None = None,
                      max_length: int | None = None, target_concept_ids=None, exclude_question_ids=(), seed: int = 0, **adaptive_kwargs):
    """mode='fixed'    -> (form DataFrame, coverage DataFrame)
       mode='parallel' -> (form A, form B, balance DataFrame)   for pre-test / post-test
       mode='adaptive' -> AdaptiveSession (call .next_item() / .record(qid, response))

    items_per_concept defaults to the validated n_min (minimum evidence for a diagnosis) and max_length to
    items_per_concept x number of target concepts."""
    service = service or CDMService.load(artifact_dir)
    tids = list(target_concept_ids or service.policy.target_concept_ids)
    items_per_concept = int(items_per_concept or service.policy.n_min)
    max_length = int(max_length or items_per_concept * len(tids))
    if mode == "fixed":
        return build_fixed_form(service.items, tids, items_per_concept, max_length, exclude_question_ids)
    if mode == "parallel":
        return build_parallel_forms(service.items, tids, items_per_concept, max_length, seed)
    if mode == "adaptive":
        pol = service.policy_with()
        pol.target_concept_ids = tids
        return AdaptiveSession(service.model, service.items, pol, max_length=max_length, **adaptive_kwargs)
    raise ValueError("mode must be 'fixed', 'parallel' or 'adaptive'")


def detect_learning_gaps(profiles: pd.DataFrame, policy: DiagnosisPolicy | None = None, service: CDMService | None = None) -> pd.DataFrame:
    policy = policy or (service.policy if service else DiagnosisPolicy(target_concept_ids=profiles.loc[profiles["is_target_concept"], "concept_id"].unique().tolist()))
    return _diag.detect_learning_gaps(profiles, policy)


def recommend_intervention(gaps: pd.DataFrame, service: CDMService | None = None, artifact_dir=None,
                           class_summary: pd.DataFrame | None = None) -> pd.DataFrame:
    service = service or CDMService.load(artifact_dir)
    return _int.recommend_intervention(gaps, service.intervention_map, service.target_map, class_summary, service.items)


def compare_pre_post(pre, post, service: CDMService | None = None, artifact_dir=None, policy: DiagnosisPolicy | None = None,
                     randomized_design: bool = False) -> dict:
    """pre/post: long-format response tables (student_id, QuestionId, response[, group]) or CSV paths."""
    service = service or CDMService.load(artifact_dir)
    return _pp.compare_pre_post(service.model, pre, post, policy or service.policy, service.concept_ids, service.concept_names,
                                items=service.items, item_bank=service.item_bank, randomized_design=randomized_design)
