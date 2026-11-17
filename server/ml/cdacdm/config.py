"""Configuration loading and path auto-detection."""
from __future__ import annotations

import copy
import json
import os
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "configs" / "experiment.json"

REQUIRED_ARTIFACTS = [
    "responses_train.npz",
    "responses_val.npz",
    "responses_test.npz",
    "q_matrix.csv",
    "concept_metadata.csv",
    "cda_item_bank.csv",
    "interactions_train.csv",
    "interactions_val.csv",
    "interactions_test.csv",
    "dataset_manifest.json",
    "eda_summary.json",
]


def _deep_update(base: dict, upd: dict) -> dict:
    for k, v in upd.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            _deep_update(base[k], v)
        else:
            base[k] = v
    return base


def load_config(path: str | Path | None = None, overrides: dict | None = None) -> dict:
    path = Path(path) if path else DEFAULT_CONFIG_PATH
    with open(path, encoding="utf-8") as f:
        cfg = json.load(f)
    cfg = copy.deepcopy(cfg)
    if overrides:
        _deep_update(cfg, overrides)
    cfg["_config_path"] = str(path)
    return cfg


def resolve_path(p: str | Path | None) -> Path | None:
    if p is None:
        return None
    p = Path(p)
    return p if p.is_absolute() else PROJECT_ROOT / p


def _has_core_files(d: Path) -> bool:
    return d.is_dir() and (d / "q_matrix.csv").exists()


def resolve_data_dir(cfg: dict) -> Path:
    """Find the directory holding the prepared artifacts.

    Order: env CDACDM_DATA_DIR, cfg.paths.data_dir, cfg.paths.data_dir_candidates,
    then a recursive search for q_matrix.csv below cfg.paths.search_roots.
    """
    paths = cfg.get("paths", {})
    tried = []
    env = os.environ.get("CDACDM_DATA_DIR")
    cands = ([env] if env else []) + ([paths["data_dir"]] if paths.get("data_dir") else [])
    cands += list(paths.get("data_dir_candidates", []))
    for c in cands:
        d = resolve_path(c)
        tried.append(str(d))
        if _has_core_files(d):
            return d
    for root in paths.get("search_roots", []):
        r = resolve_path(root)
        if r is None or not r.is_dir():
            continue
        hits = sorted(r.rglob("q_matrix.csv"))
        if hits:
            return hits[0].parent
        tried.append(f"{r}/**/q_matrix.csv")
    raise FileNotFoundError(
        "Prepared artifacts (q_matrix.csv, responses_*.npz, ...) not found. Tried:\n  "
        + "\n  ".join(tried)
        + "\nSet CDACDM_DATA_DIR or paths.data_dir in configs/experiment.json."
    )


def resolve_output_dir(cfg: dict) -> Path:
    env = os.environ.get("CDACDM_OUTPUT_DIR")
    out = resolve_path(env or cfg.get("paths", {}).get("output_dir", "artifacts"))
    out.mkdir(parents=True, exist_ok=True)
    return out


def check_artifact_presence(data_dir: Path) -> dict[str, Any]:
    status = {}
    for name in REQUIRED_ARTIFACTS:
        p = Path(data_dir) / name
        status[name] = {"exists": p.exists(), "size_bytes": p.stat().st_size if p.exists() else None}
    return status
