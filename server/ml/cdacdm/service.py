"""Load a trained checkpoint and run inference without retraining (used by the API and the app)."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from .config import PROJECT_ROOT, resolve_path
from .diagnosis import DiagnosisPolicy, build_profiles, class_summary, detect_learning_gaps, student_summary
from .intervention import load_intervention_map, recommend_intervention
from .models import PDINA
from .responses import parse_responses

REQUIRED_CHECKPOINT_FILES = ["pdina_params.npz", "pdina_config.json", "diagnosis_policy.json", "item_parameters.csv",
                             "concept_metadata.csv", "target_concept_map.csv"]


class CheckpointNotFoundError(FileNotFoundError):
    pass


def default_artifact_dir() -> Path:
    import os
    env = os.environ.get("CDACDM_ARTIFACT_DIR") or os.environ.get("CDACDM_OUTPUT_DIR")
    return Path(env) if env else PROJECT_ROOT / "artifacts"


def checkpoint_status(artifact_dir=None) -> dict:
    d = Path(artifact_dir or default_artifact_dir())
    mdir = d / "model"
    missing = [f for f in REQUIRED_CHECKPOINT_FILES if not (mdir / f).exists()]
    return {"artifact_dir": str(d), "model_dir": str(mdir), "ready": not missing, "missing": missing}


@dataclass
class CDMService:
    artifact_dir: Path
    model: PDINA
    policy: DiagnosisPolicy
    concept_meta: pd.DataFrame
    items: pd.DataFrame
    target_map: pd.DataFrame
    intervention_map: pd.DataFrame
    item_bank: pd.DataFrame | None
    model_card: dict
    forms: dict = field(default_factory=dict)
    warnings: list = field(default_factory=list)

    # ------------------------------------------------------------------ loading
    @classmethod
    def load(cls, artifact_dir=None, intervention_map_path=None) -> "CDMService":
        st = checkpoint_status(artifact_dir)
        if not st["ready"]:
            raise CheckpointNotFoundError(
                f"No trained checkpoint in {st['model_dir']} (missing: {', '.join(st['missing'])}). "
                "Run the training pipeline first: `python -m cdacdm.pipeline` or the notebook cda_cdm_model_training.ipynb.")
        d = Path(st["artifact_dir"])
        m = d / "model"
        model = PDINA.load(m)
        policy = DiagnosisPolicy.from_dict(json.loads((m / "diagnosis_policy.json").read_text(encoding="utf-8")))
        cm = pd.read_csv(m / "concept_metadata.csv")
        items = pd.read_csv(m / "item_parameters.csv", dtype={"concept_ids": str})
        tm = pd.read_csv(m / "target_concept_map.csv")
        tm["in_target_scope"] = tm["in_target_scope"].astype(str).str.lower().isin(["true", "1"])
        ib = pd.read_csv(m / "item_bank.csv") if (m / "item_bank.csv").exists() else None
        card = json.loads((m / "model_card.json").read_text(encoding="utf-8")) if (m / "model_card.json").exists() else {}
        warns = []
        if not np.array_equal(np.asarray(model.question_ids).astype(int), items["QuestionId"].to_numpy().astype(int)):
            raise ValueError("checkpoint inconsistent: item_parameters.csv QuestionIds differ from the model")
        if not np.array_equal(np.asarray(model.concept_ids).astype(int), cm["concept_id"].to_numpy().astype(int)):
            raise ValueError("checkpoint inconsistent: concept_metadata.csv differs from the model concept order")
        unknown = set(int(c) for c in policy.target_concept_ids) - set(int(c) for c in model.concept_ids)
        if unknown:
            raise ValueError(f"diagnosis policy references unknown concepts {unknown}")
        im_path = intervention_map_path
        if im_path is None:
            cfgp = m / "experiment_config_used.json"
            if cfgp.exists():
                im_path = resolve_path(json.loads(cfgp.read_text(encoding="utf-8"))["paths"].get("intervention_map"))
        if im_path is None or not Path(im_path).exists():
            im_path = m / "intervention_map_resolved.csv"
        im, w = load_intervention_map(im_path, tm)
        warns += w
        forms = {}
        for key, fn in [("fixed", "fixed_form.csv"), ("A", "parallel_form_A.csv"), ("B", "parallel_form_B.csv")]:
            p = d / "assessment" / fn
            if p.exists() and p.stat().st_size > 5:
                forms[key] = pd.read_csv(p, dtype={"concept_ids": str})
        return cls(d, model, policy, cm, items, tm, im, ib, card, forms, warns)

    # ------------------------------------------------------------------ properties
    @property
    def concept_ids(self):
        return np.asarray(self.model.concept_ids).astype(int)

    @property
    def concept_names(self):
        return self.concept_meta["concept_name"].tolist()

    @property
    def question_ids(self):
        return np.asarray(self.model.question_ids).astype(int)

    def policy_with(self, tau=None, delta=None, n_min=None) -> DiagnosisPolicy:
        p = DiagnosisPolicy.from_dict(self.policy.to_dict())
        if tau is not None:
            p.tau = float(tau)
        if delta is not None:
            p.delta = float(delta)
        if n_min is not None:
            p.n_min = int(n_min)
        return p

    # ------------------------------------------------------------------ inference
    def predict_mastery(self, responses, policy: DiagnosisPolicy | None = None, only_target: bool = False):
        """responses: DataFrame / CSV path / dict. Item parameters stay frozen (no retraining)."""
        policy = policy or self.policy
        long, students, X, M, info = parse_responses(responses, self.question_ids, self.item_bank)
        post = self.model.infer(X, M)
        prof = build_profiles(post, students, self.concept_ids, self.concept_names, policy, only_target=only_target)
        info["n_target_items_observed"] = int(M[:, self.items["any_concept_target"].to_numpy()].sum())
        return prof, info, post

    def diagnose(self, responses, policy: DiagnosisPolicy | None = None) -> dict:
        policy = policy or self.policy
        prof, info, post = self.predict_mastery(responses, policy)
        gaps = detect_learning_gaps(prof, policy)
        cs = class_summary(prof)
        rec = recommend_intervention(gaps, self.intervention_map, self.target_map, cs if prof["student_id"].nunique() > 1 else None,
                                     self.items, exclude_question_ids=[])
        return {"profiles": prof, "gaps": gaps, "class_summary": cs, "student_summary": student_summary(prof),
                "recommendations": rec, "info": info, "policy": policy.to_dict()}

    def report_json(self, result: dict, prepost: dict | None = None) -> dict:
        def recs(df):
            return [] if df is None or len(df) == 0 else json.loads(df.to_json(orient="records"))
        prof = result["profiles"]
        return {
            "generated_by": "cdacdm P-DINA (variational EM)", "model": self.model_card.get("model_selection", {}).get("main_model"),
            "artifact_source": self.model_card.get("data", {}).get("artifact_source"),
            "policy": result["policy"], "input_info": result["info"],
            "mastery_profiles_target": recs(prof[prof["is_target_concept"]]),
            "learning_gaps": recs(result["gaps"]), "intervention_recommendations": recs(result["recommendations"]),
            "class_summary": recs(result["class_summary"]),
            "pre_post": prepost,
            "disclaimer": ("Mastery probabilities are model-based estimates, not verified mastery. Intervention entries marked "
                           "is_placeholder require teacher/lecturer validation. No intervention effectiveness is predicted."),
        }

    # ------------------------------------------------------------------ optional narrative layer (cdacdm.narrative)
    def n_target_concepts_without_items(self) -> int:
        has = set()
        for s in self.items["concept_ids"].astype(str):
            has.update(int(float(c)) for c in s.split(";") if c.strip() not in ("", "nan"))
        return len(set(int(c) for c in self.policy.target_concept_ids) - has)

    def narrative_facts(self, result: dict, audience: str = "teacher", student_id=None, config=None):
        """Compact, pseudonymised facts for the narrative layer (see cdacdm.narrative.build_facts)."""
        from .narrative import build_facts
        return build_facts(result, audience, student_id, config, concepts_without_items=self.n_target_concepts_without_items())

    def generate_narrative(self, result: dict, audience: str = "teacher", student_id=None, generator=None) -> dict:
        """Indonesian narrative of a diagnose() result via the Gemini API: {"text", "meta", "validation", "fallback"}.

        The LLM only phrases the diagnosis; every output is validated against the facts and replaced by a
        deterministic template when the LLM is disabled, unreachable or produces ungrounded text."""
        from .narrative import NarrativeGenerator, fallback_result, load_narrative_config
        if generator is None:
            try:
                generator = NarrativeGenerator(load_narrative_config())
            except (ValueError, OSError) as e:
                return fallback_result(self.narrative_facts(result, audience, student_id), f"LLM config invalid: {e}")
        facts = self.narrative_facts(result, audience, student_id, generator.config)
        return generator.generate(facts, known_concept_names=self.concept_names)
