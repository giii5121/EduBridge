"""Compare Gemini API models on the narrative task (factual consistency, format, latency, tokens).

    python scripts/eval_narrative.py --models gemini-3.1-flash-lite <other-gemini-model-id> --cases 10

Needs GEMINI_API_KEY in the environment; every case is a billed API request (x2: first-attempt and with-repair).
Each model is called through the same NarrativeGenerator as the app (same prompt, same validator) against
facts from sampled demo classes/students. Reported per model: first-attempt pass rate (validator, no repair),
final pass rate after repairs, fallback rate, violation counts by type (numbers / headings / placeholder /
claims / concepts / length / truncated), latency and token usage. The disk cache is disabled (temp dir).
Writes artifacts/reports/eval/narrative_eval_<timestamp>.csv (+ _summary.csv). Not used by the app.
"""
from __future__ import annotations

import argparse
import logging
import re
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
log = logging.getLogger("eval_narrative")
ERROR_TYPES = {"angka": "numbers", "format": "format", "heading": "headings", "placeholder": "placeholder",
               "klaim": "claims", "konsep": "concepts", "panjang": "length", "output LLM terpotong": "truncated"}


def error_types(reason: str | None) -> list[str]:
    return [v for k, v in ERROR_TYPES.items() if reason and k in reason]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--models", nargs="+", default=["gemini-3.1-flash-lite"])
    ap.add_argument("--thinking-level", default=None, help="override thinking_level from configs/llm.json")
    ap.add_argument("--artifact-dir", default="artifacts")
    ap.add_argument("--cases", type=int, default=10, help="teacher cases; the same number of student cases is added")
    ap.add_argument("--class-size", type=int, default=30)
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    import numpy as np
    import pandas as pd

    from cdacdm.config import resolve_path
    from cdacdm.narrative import NarrativeGenerator, load_narrative_config
    from cdacdm.service import CDMService

    art = resolve_path(a.artifact_dir)
    svc = CDMService.load(art)
    demo = pd.read_csv(next(p for p in [art / "demo/test_split_responses.csv", art / "demo/eedi_test_split_responses.csv"] if p.exists()),
                       dtype={"student_id": str})
    ids = demo["student_id"].drop_duplicates().to_numpy()
    rng = np.random.default_rng(a.seed)
    cases = []
    for i in range(a.cases):
        cls = rng.choice(ids, size=min(a.class_size, len(ids)), replace=False)
        res = svc.diagnose(demo[demo["student_id"].isin(cls)])
        cases.append((f"teacher-{i}", res, "teacher", None))
        cases.append((f"student-{i}", res, "student", str(cls[0])))

    rows = []
    tmp = Path(tempfile.mkdtemp(prefix="narrative_eval_"))
    for model in a.models:
        for retries, mode in [(0, "first_attempt"), (None, "with_repair")]:
            over = {"model": model, "cache_dir": str(tmp / "cache" / re.sub(r"\W", "_", model) / mode),
                    "log_path": str(tmp / "log.jsonl")}
            if a.thinking_level:
                over["thinking_level"] = a.thinking_level
            if retries is not None:
                over["max_retries"] = retries
            gen = NarrativeGenerator(load_narrative_config(overrides=over))
            for name, res, audience, sid in cases:
                t = time.perf_counter()
                out = svc.generate_narrative(res, audience, sid, generator=gen)
                m = out["meta"]
                rows.append({"model": model, "mode": mode, "case": name, "audience": audience, "ok": not out["fallback"],
                             "attempts": m["attempts"], "latency_s": round(time.perf_counter() - t, 2), "reason": m.get("reason"),
                             "error_types": ";".join(error_types(m.get("reason"))),
                             "prompt_tokens": m["usage"].get("prompt_tokens"), "completion_tokens": m["usage"].get("completion_tokens"),
                             "thinking_tokens": m["usage"].get("thinking_tokens")})
                log.info("%s %s %s ok=%s %.1fs %s", model, mode, name, rows[-1]["ok"], rows[-1]["latency_s"], rows[-1]["error_types"])
    df = pd.DataFrame(rows)
    out_dir = resolve_path("artifacts/reports/eval")
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    df.to_csv(out_dir / f"narrative_eval_{stamp}.csv", index=False)
    summ = df.groupby(["model", "mode"]).agg(pass_rate=("ok", "mean"), mean_latency_s=("latency_s", "mean"),
                                             p95_latency_s=("latency_s", lambda s: s.quantile(0.95)),
                                             mean_attempts=("attempts", "mean")).reset_index()
    summ.to_csv(out_dir / f"narrative_eval_{stamp}_summary.csv", index=False)
    print(summ.to_string(index=False))


if __name__ == "__main__":
    main()
