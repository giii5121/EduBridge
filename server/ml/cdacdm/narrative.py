"""Optional narrative layer: turns P-DINA diagnosis facts into Indonesian text with an LLM API.

The LLM (default Gemini 3.1 Flash-Lite through the official Gemini API / Google AI Studio key, SDK
``google-genai``) only COMMUNICATES facts that the model already computed. It never computes,
changes or predicts mastery, gaps or metrics.

Safety net (in order):
  * facts      : a small, aggregated JSON (``NarrativeFacts``); no raw responses, no real ids
  * prompt     : strict Indonesian system rules + fixed headings per audience
  * validator  : every number must come from the facts, required headings, placeholder
                 disclaimer, forbidden claims, unknown concepts, length -> hard fail
  * repair     : up to ``max_retries`` re-asks naming the violations
  * fallback   : deterministic template (``fallback_narrative``) - never shows unvalidated text

Nothing is loaded or contacted at import time: ``google.genai`` is imported lazily by the
transport, and the config is read only when a generator is built. The API key is read only from
the environment variable named by ``api_key_env`` (default ``GEMINI_API_KEY``).
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import re
import threading
import uuid
import time
from dataclasses import asdict, dataclass, field, fields
from datetime import datetime, timezone
from pathlib import Path

from .config import PROJECT_ROOT, resolve_path

log = logging.getLogger(__name__)

DEFAULT_CONFIG_PATH = PROJECT_ROOT / "configs" / "llm.json"
AUDIENCES = ("teacher", "student")
REQUIRED_HEADINGS = {
    "teacher": ["Ringkasan kelas", "Temuan utama", "Konsep prioritas", "Rekomendasi tindakan", "Keterbatasan dan catatan"],
    "student": ["Ringkasan", "Yang sudah dikuasai", "Yang perlu dilatih", "Langkah belajar", "Catatan"],
}
DISCLAIMER = "Estimasi model, bukan mastery terverifikasi. Rekomendasi placeholder perlu validasi guru."
THINKING_LEVELS = (None, "minimal", "low", "medium", "high")
FORBIDDEN_CLAIMS = [r"\bterbukti\b", r"\bpasti\s+mastered\b", r"\bdijamin\b", r"\befektif\s+meningkatkan\b", r"\bmenyembuhkan\b",
                    r"\bsiswa\s+malas\b", r"\bguru\s+gagal\b"]
NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)?%?")
THOUSANDS_RE = re.compile(r"\d{1,3}(?:[.,]\d{3})+")
NUMBERED_LIST_RE = re.compile(r"(?m)^\s*(?:[-*]\s+)?\d+[.)]\s")
HTML_RE = re.compile(r"<\s*/?\s*[a-zA-Z][^>]*>")
MIN_WORDS, MAX_WORDS = 120, 900
TEXT_FIELD_MAX_CHARS = 240
ACTION_ID = {"remediate": "remediasi", "reassess_then_decide": "asesmen ulang dulu", "collect_more_evidence": "kumpulkan bukti tambahan"}
LEVEL_ID = {"whole_class": "seluruh kelas", "small_group": "kelompok kecil", "individual": "individual"}


# ============================================================================ config
@dataclass
class NarrativeConfig:
    enabled: bool = True
    model: str = "gemini-3.1-flash-lite"   # Gemini API model id (Google AI Studio)
    api_key_env: str = "GEMINI_API_KEY"
    env_file: str | None = ".env"          # fallback for the key when it is not in the process environment
    temperature: float = 1.0              # Google's recommendation for Gemini 3: lower values can cause looping
    top_p: float | None = None             # None -> API default
    thinking_level: str | None = "low"     # Gemini 3 thinking cannot be switched off; "low" keeps latency/cost down
    max_tokens: int = 8192                 # max_output_tokens; on Gemini 3 this budget includes thinking tokens
    timeout_sec: float = 120
    max_retries: int = 2
    prompt_version: str = "narrative-gemini-v1"
    max_student_concepts: int = 12
    max_class_concepts: int = 11
    max_gaps: int = 5
    max_recommendations: int = 5
    max_examples: int = 1
    examples_path: str = "configs/narrative_examples.jsonl"
    cache_dir: str = "artifacts/reports/cache"
    cache_ttl_hours: float = 168
    log_path: str = "artifacts/reports/narrative_log.jsonl"
    circuit_failures: int = 3
    circuit_cooldown_sec: float = 60
    backoff_sec: list = field(default_factory=lambda: [2.0, 8.0])

    def __post_init__(self):
        self.check()

    def check(self):
        if not str(self.model or "").strip():
            raise ValueError("LLM model id is empty")
        if self.thinking_level not in THINKING_LEVELS:
            raise ValueError(f"thinking_level must be one of {THINKING_LEVELS}")
        if not self.api_key_env:
            raise ValueError("api_key_env must name the environment variable holding the Gemini API key")

    @property
    def api_key(self) -> str | None:
        """Process environment first, then ``env_file`` (KEY=VALUE lines, project-relative)."""
        if not self.api_key_env:
            return None
        return os.environ.get(self.api_key_env) or read_env_file(self.env_file).get(self.api_key_env) or None

    def to_dict(self) -> dict:
        return asdict(self)


def read_env_file(path: str | Path | None) -> dict:
    """Minimal .env parser (no python-dotenv): ``[export ]KEY=VALUE``, # comments, optional quotes."""
    if not path:
        return {}
    p = resolve_path(path)
    try:
        lines = p.read_text(encoding="utf-8-sig").splitlines() if p.is_file() else []
    except OSError as e:
        log.warning("cannot read env file %s: %s", p, e.__class__.__name__)
        return {}
    out = {}
    for line in lines:
        m = re.match(r"^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.*?)\s*$", line)
        if not m:
            continue
        val = m.group(2)
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        else:
            val = re.sub(r"\s+#.*$", "", val)
        out[m.group(1)] = val
    return out


def load_narrative_config(path: str | Path | None = None, overrides: dict | None = None) -> NarrativeConfig:
    """Read configs/llm.json (or env CDACDM_LLM_CONFIG); a missing file gives the defaults."""
    path = Path(path or os.environ.get("CDACDM_LLM_CONFIG") or DEFAULT_CONFIG_PATH)
    raw = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    if overrides:
        raw.update(overrides)
    if any(k.lower() in ("api_key", "apikey", "token") for k in raw):
        raise ValueError("do not store API keys in the LLM config; set the env variable named by api_key_env")
    known = {f.name for f in fields(NarrativeConfig)}
    unknown = sorted(set(raw) - known)
    if unknown:
        log.warning("ignoring unknown LLM config keys: %s", unknown)
    return NarrativeConfig(**{k: v for k, v in raw.items() if k in known})


# ============================================================================ facts
def _num(v, nd: int = 2):
    """JSON-safe number rounded once, here in code (the LLM must not round)."""
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    if f.is_integer() and not isinstance(v, float):
        return int(f)
    return round(f, nd)


def _int_or_none(v):
    n = _num(v)
    return None if n is None else int(round(n))


def _short(s, n: int = TEXT_FIELD_MAX_CHARS) -> str:
    s = "" if s is None or (isinstance(s, float) and math.isnan(s)) else str(s).strip()
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def pseudonym(student_id) -> str:
    return "Siswa-" + hashlib.sha256(str(student_id).encode("utf-8")).hexdigest()[:8]


@dataclass
class NarrativeFacts:
    audience: str
    policy: dict
    scope: dict
    class_summary: list = field(default_factory=list)
    student: dict | None = None
    gaps: list = field(default_factory=list)
    recommendations: list = field(default_factory=list)
    limits: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        d = asdict(self)
        if d["student"] is None:
            d.pop("student")
        return d

    def canonical_json(self) -> str:
        return json.dumps(self.to_dict(), sort_keys=True, ensure_ascii=False, separators=(",", ":"))

    @classmethod
    def from_dict(cls, d: dict) -> "NarrativeFacts":
        return cls(audience=d["audience"], policy=dict(d.get("policy", {})), scope=dict(d.get("scope", {})),
                   class_summary=list(d.get("class_summary", [])), student=d.get("student"), gaps=list(d.get("gaps", [])),
                   recommendations=list(d.get("recommendations", [])), limits=dict(d.get("limits", {})))

    def concept_names(self) -> set:
        names = {r["concept_name"] for r in self.class_summary + self.gaps + self.recommendations}
        if self.student:
            names |= {c["concept_name"] for c in self.student.get("concepts", [])}
        return names


def build_facts(result: dict, audience: str = "teacher", student_id=None, config: NarrativeConfig | None = None,
                concepts_without_items: int = 0) -> NarrativeFacts:
    """Compact facts from ``CDMService.diagnose()`` output.

    teacher: class aggregates (<= max_class_concepts target concepts, <= max_gaps, <= max_recommendations);
             with ``student_id`` the gaps/recommendations are those of that student.
    student: one student's profile (<= max_student_concepts, gaps first) - no class data, no comparisons.
    Real student ids never leave this function: students are referred to as ``Siswa-<sha256[:8]>``.
    """
    if audience not in AUDIENCES:
        raise ValueError(f"audience must be one of {AUDIENCES}")
    cfg = config or NarrativeConfig()
    prof = result["profiles"]
    t = prof[prof["is_target_concept"]]
    info = result.get("info", {})
    pol = result.get("policy", {})
    policy = {"tau": _num(pol.get("tau")), "delta": _num(pol.get("delta")), "n_min": _int_or_none(pol.get("n_min"))}

    sid = None
    if audience == "student" or student_id is not None:
        ids = t["student_id"].astype(str)
        sid = str(student_id) if student_id is not None else (ids.iloc[0] if len(ids) else None)
        if sid is None or not (ids == sid).any():
            raise ValueError("student_id not found among the diagnosed students")

    rec = result.get("recommendations")
    rec = rec if rec is not None and len(rec) else None
    gaps_df = result.get("gaps")

    if sid is None:
        gap_by_student = (t["mastery_label"] == "not_mastered").groupby(t["student_id"]).any()
        scope = {"n_students": int(t["student_id"].nunique()), "n_target_concepts": int(t["concept_id"].nunique()),
                 "n_responses": int(info.get("n_observed", 0)), "n_students_with_gap": int(gap_by_student.sum())}
    else:
        p = t[t["student_id"].astype(str) == sid]
        scope = {"n_target_concepts": int(p["concept_id"].nunique()), "n_responses": int(p["n_evidence"].sum())}
        if audience == "teacher":
            scope["n_students"] = int(t["student_id"].nunique())

    class_rows = []
    if audience == "teacher":
        for _, r in result["class_summary"].head(cfg.max_class_concepts).iterrows():
            class_rows.append({"concept_name": str(r["concept_name"]), "n_students": int(r["n_students"]),
                               "n_mastered": int(r["n_mastered"]), "n_not_mastered": int(r["n_not_mastered"]),
                               "n_uncertain": int(r["n_uncertain"]), "n_insufficient": int(r["n_insufficient"]),
                               "gap_share_among_diagnosable": _num(r["gap_share_among_diagnosable"]),
                               "mean_mastery_prob": _num(r["mean_mastery_prob"])})

    student = None
    gaps, recs = [], []
    if sid is not None:
        p = t[t["student_id"].astype(str) == sid]
        order = {"not_mastered": 0, "mastered": 1, "insufficient_evidence": 2, "uncertain": 3}
        ps = p.assign(_o=p["mastery_label"].map(order)).sort_values(["_o", "mastery_prob"])
        lab = p["mastery_label"]
        student = {"display_id": pseudonym(sid),
                   "concepts": [{"concept_name": str(r["concept_name"]), "mastery_prob": _num(r["mastery_prob"]),
                                 "mastery_label": str(r["mastery_label"]), "n_evidence": int(r["n_evidence"]),
                                 "n_correct": int(r["n_correct"]), "posterior_sd": _num(r["posterior_sd"])}
                                for _, r in ps.head(cfg.max_student_concepts).iterrows()],
                   "n_gaps": int((lab == "not_mastered").sum()), "n_mastered": int((lab == "mastered").sum()),
                   "n_uncertain": int((lab == "uncertain").sum()), "n_insufficient": int((lab == "insufficient_evidence").sum())}
        if gaps_df is not None and len(gaps_df):
            g = gaps_df[(gaps_df["student_id"].astype(str) == sid) & (gaps_df["gap_status"] != "needs_more_data")]
            gaps = [{"concept_name": str(r["concept_name"]), "mastery_prob": _num(r["mastery_prob"]),
                     "gap_status": str(r["gap_status"]), "priority_score": _num(r["priority_score"])}
                    for _, r in g.head(cfg.max_gaps).iterrows()]
        if rec is not None:
            recs = [_rec_row(r) for _, r in rec[rec["student_id"].astype(str) == sid].head(cfg.max_recommendations).iterrows()]
            if audience == "student":       # class-level grouping is teacher information
                for r in recs:
                    r.pop("intervention_level")
    else:
        cs = result["class_summary"]
        g = cs[cs["n_not_mastered"] > 0].sort_values(["gap_share_among_diagnosable", "n_not_mastered"], ascending=False)
        gaps = [{"concept_name": str(r["concept_name"]), "gap_status": "learning_gap",
                 "n_students_with_gap": int(r["n_not_mastered"]),
                 "gap_share_among_diagnosable": _num(r["gap_share_among_diagnosable"]),
                 "mean_mastery_prob": _num(r["mean_mastery_prob"])} for _, r in g.head(cfg.max_gaps).iterrows()]
        if rec is not None:
            rr = rec[rec["recommended_action"] == "remediate"]
            rr = rr if len(rr) else rec
            counts = rr.groupby("concept_id")["student_id"].nunique().sort_values(ascending=False, kind="stable")
            first = rr.drop_duplicates("concept_id").set_index("concept_id")
            for c in counts.index[: cfg.max_recommendations]:
                row = _rec_row(first.loc[c])
                row["n_students"] = int(counts.loc[c])
                recs.append(row)

    limits = {"no_ground_truth": True, "placeholder_present": any(r["is_placeholder"] for r in recs),
              "n_target_concepts_without_items": int(concepts_without_items),
              "insufficient_evidence_is_not_gap": True}
    return NarrativeFacts(audience, policy, scope, class_rows, student, gaps, recs, limits)


PLACEHOLDER_PREFIX_RE = re.compile(r"^\s*PLACEHOLDER(?:\s*\(generik\))?\s*:\s*", re.I)


def _rec_text(s) -> str:
    """Drop the 'PLACEHOLDER (generik):' boilerplate (is_placeholder carries it) to keep the prompt small."""
    return _short(PLACEHOLDER_PREFIX_RE.sub("", _short(s, 10_000)), 160)


def _rec_row(r) -> dict:
    return {"concept_name": str(r["concept_name"]), "recommended_action": str(r.get("recommended_action", "")),
            "intervention_level": str(r.get("intervention_level", "")),
            "gap_description": _rec_text(r.get("gap_description")), "remedial_activity": _rec_text(r.get("remedial_activity")),
            "estimated_duration_min": _int_or_none(r.get("estimated_duration_min")),
            "is_placeholder": bool(r.get("is_placeholder", True))}


# ============================================================================ prompt
SYSTEM_RULES = """Kamu adalah asisten pedagogis untuk guru matematika. Kamu HANYA boleh memakai fakta pada JSON yang diberikan.

Aturan wajib:
- Jangan menambah, mengubah, membulatkan ulang, atau mengarang angka. Salin angka persis seperti di JSON. Proporsi boleh ditulis sebagai persen bulat (contoh: 0.52 menjadi 52%). Jika ragu, sebut 'tidak tersedia'.
- Jangan menyatakan mastery sebagai fakta terverifikasi; sebut 'estimasi model'.
- Jangan menyatakan intervensi terbukti efektif. Jika `is_placeholder=true`, wajib tulis bahwa rekomendasi itu placeholder dan 'perlu validasi guru'.
- `insufficient_evidence` berarti butuh data tambahan, BUKAN learning gap.
- Jangan membandingkan atau memberi label negatif pada siswa. Nada suportif dan netral.
- Sebut konsep hanya dengan nama persis seperti di JSON; jangan menyebut konsep lain.
- Kata 'terbukti', 'dijamin', dan 'pasti' dilarang sama sekali, juga dalam kalimat negatif (misalnya 'belum terbukti'); tulis 'perlu validasi guru'.
- Jawab hanya dalam Bahasa Indonesia, berupa Markdown, tanpa HTML.
- Jangan menulis daftar bernomor; gunakan bullet `-`.
- Setiap angka harus milik konsep yang disebut di baris yang sama.
- Jangan menulis nama field JSON (misalnya mastery_prob, n_evidence); tulis dengan kata-kata biasa.
- Ringkas: sekitar 150 sampai 350 kata, maksimal 5 bullet per bagian, dan SEMUA heading wajib ditulis sampai heading terakhir.
"""
AUDIENCE_RULES = {
    "teacher": "Pembaca: guru. Fokus pada pola kelas, konsep prioritas, dan tindakan yang dapat dilakukan guru.",
    "student": ("Pembaca: siswa. Sapa dengan 'kamu', bahasa sederhana dan memotivasi. Jangan menyebut siswa lain atau "
                "data kelas. Jelaskan bahwa konsep dengan bukti belum cukup perlu dicoba dengan soal tambahan."),
}


def system_prompt(audience: str) -> str:
    heads = "\n".join(f"## {h}" for h in REQUIRED_HEADINGS[audience])
    return (f"{SYSTEM_RULES}\n{AUDIENCE_RULES[audience]}\n\n"
            f"Struktur output (pakai heading ini persis dan berurutan, tanpa heading lain):\n{heads}\n")


def user_prompt(facts: NarrativeFacts, audience: str) -> str:
    reader = "guru" if audience == "teacher" else "siswa"
    return ("FAKTA DIAGNOSIS (JSON):\n```json\n" + json.dumps(facts.to_dict(), ensure_ascii=False, separators=(",", ":")) + "\n```\n"
            f"Tulis laporan untuk {reader} dengan struktur yang diminta. Hanya pakai angka dan nama konsep dari JSON di atas.")


_EXAMPLES_CACHE: dict = {}


def load_examples(path: str | Path | None) -> list[dict]:
    """Few-shot examples (JSONL: audience, facts, output). Missing file -> no examples."""
    if not path:
        return []
    p = resolve_path(path)
    key = (str(p), p.stat().st_mtime if p.exists() else None)
    if key not in _EXAMPLES_CACHE:
        rows = []
        if p.exists():
            for line in p.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    rows.append(json.loads(line))
        _EXAMPLES_CACHE[key] = rows
    return _EXAMPLES_CACHE[key]


def build_prompt(facts: NarrativeFacts, audience: str | None = None, examples: list | None = None,
                 max_examples: int = 1) -> list[dict]:
    """System + (<= max_examples matching few-shot pairs) + user messages."""
    audience = audience or facts.audience
    if audience not in AUDIENCES:
        raise ValueError(f"audience must be one of {AUDIENCES}")
    if examples is None:
        examples = load_examples(NarrativeConfig.examples_path)
    msgs = [{"role": "system", "content": system_prompt(audience)}]
    for ex in [e for e in examples if e.get("audience") == audience][: max(0, min(2, max_examples))]:
        msgs.append({"role": "user", "content": user_prompt(NarrativeFacts.from_dict(ex["facts"]), audience)})
        msgs.append({"role": "assistant", "content": ex["output"]})
    msgs.append({"role": "user", "content": user_prompt(facts, audience)})
    return msgs


# ============================================================================ validator
@dataclass
class ValidationResult:
    ok: bool
    errors: list = field(default_factory=list)
    invented_numbers: list = field(default_factory=list)
    word_count: int = 0

    def to_dict(self) -> dict:
        return asdict(self)


def _walk_numbers(obj, out: list, raw: set):
    if isinstance(obj, bool) or obj is None:
        return
    if isinstance(obj, (int, float)):
        out.append(float(obj))
    elif isinstance(obj, str):
        for tok in NUMBER_RE.findall(obj):
            raw.add(tok.rstrip("%").replace(",", "."))
    elif isinstance(obj, dict):
        for v in obj.values():
            _walk_numbers(v, out, raw)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            _walk_numbers(v, out, raw)


def _pct_int(v: float) -> int:
    return int(math.floor(v * 100 + 0.5))


def number_whitelist(facts: NarrativeFacts) -> tuple[set, set, set]:
    """(plain forms, percent forms, integers) allowed in a narrative.

    plain   : integers as-is; any value with 1 or 2 decimals ('.' normalised; ',' accepted in text)
    percent : proportions in [0, 1] as whole / 1-2 decimal percentages (needs '%' or 'persen')
    """
    return _whitelist(facts.to_dict())


def _whitelist(obj) -> tuple[set, set, set]:
    vals, raw = [], set()
    _walk_numbers(obj, vals, raw)
    plain, pct, ints = set(raw), set(), set()
    for v in vals:
        if v.is_integer():
            plain.add(str(int(v)))
            ints.add(int(v))
        for d in (1, 2):
            plain.add(f"{v:.{d}f}")
        if 0 <= v <= 1:
            pct.add(str(_pct_int(v)))
            for d in (1, 2):
                pct.add(f"{v * 100:.{d}f}")
    return plain, pct, ints


def _union(*wls) -> tuple[set, set, set]:
    return tuple(set().union(*parts) for parts in zip(*wls))


def _ungrounded(text: str, wl: tuple[set, set, set]) -> list[str]:
    plain, pct, ints = wl
    bad = []
    for m in NUMBER_RE.finditer(text):
        tok = m.group(0)
        core = tok.rstrip("%")
        is_pct = tok.endswith("%") or re.match(r"\s*persen", text[m.end():], re.I) is not None
        if THOUSANDS_RE.fullmatch(core) and int(re.sub(r"[.,]", "", core)) in ints:
            continue
        norm = core.replace(",", ".")
        if (norm in pct) if is_pct else (norm in plain):
            continue
        bad.append(tok)
    return bad


def _concept_records(facts: NarrativeFacts) -> dict:
    recs: dict = {}
    for r in facts.class_summary + facts.gaps + facts.recommendations + list((facts.student or {}).get("concepts", [])):
        recs.setdefault(r["concept_name"], []).append(r)
    return recs


def _misattributed(text: str, facts: NarrativeFacts, skip: set) -> list[str]:
    """On a line naming fact concept(s), numbers must come from THOSE concepts' records or from the global facts
    (policy, scope, limits, student totals). Catches e.g. a real 60% of one concept written next to another."""
    recs = _concept_records(facts)
    names = sorted(recs, key=len, reverse=True)
    glob = _whitelist({"policy": facts.policy, "scope": facts.scope, "limits": facts.limits,
                       "student": {k: v for k, v in (facts.student or {}).items() if k != "concepts"}})
    out = []
    for line in text.splitlines():
        low, hit = line.lower(), []
        for n in names:
            if n.lower() in low:
                hit.append(n)
                low = low.replace(n.lower(), " ")      # digits inside names ("2D") are not claims
        if hit:
            wl = _union(glob, *(_whitelist(recs[n]) for n in hit))
            out += [f"{b} ({', '.join(hit)})" for b in _ungrounded(low, wl) if b not in skip]
    return out


def validate_narrative(text: str, facts: NarrativeFacts, audience: str | None = None, allowed_concept_names=None,
                       known_concept_names=None) -> ValidationResult:
    audience = audience or facts.audience
    errors = []
    text = text or ""
    invented = _ungrounded(text, number_whitelist(facts))
    if invented:
        errors.append(f"angka: {', '.join(sorted(set(invented)))} tidak ada di fakta JSON")
    wrong = _misattributed(text, facts, set(invented))
    if wrong:
        errors.append(f"angka tidak sesuai konsepnya: {'; '.join(dict.fromkeys(wrong))}")
        invented = invented + [w.split(" ")[0] for w in wrong]
    if NUMBERED_LIST_RE.search(text):
        errors.append("format: daftar bernomor tidak boleh dipakai; gunakan bullet '-'")
    if HTML_RE.search(text):
        errors.append("format: HTML tidak boleh dipakai")
    found = [h.strip().lower() for h in re.findall(r"(?m)^##\s+(.+?)\s*$", text)]
    missing = [h for h in REQUIRED_HEADINGS[audience] if h.lower() not in found]
    if missing:
        errors.append(f"heading wajib tidak ada: {', '.join(missing)}")
    low = text.lower()
    if facts.limits.get("placeholder_present") and "placeholder" not in low and "perlu validasi" not in low:
        errors.append("placeholder: wajib menyebut 'placeholder' atau 'perlu validasi'")
    claims = [m.group(0) for pat in FORBIDDEN_CLAIMS for m in re.finditer(pat, text, re.I)]
    if claims:
        errors.append(f"klaim terlarang: {', '.join(sorted(set(c.lower() for c in claims)))}")
    if known_concept_names:
        allowed = set(allowed_concept_names) if allowed_concept_names is not None else facts.concept_names()
        rest = low
        for n in sorted(allowed, key=len, reverse=True):
            rest = rest.replace(str(n).lower(), " ")
        extra = sorted({str(n) for n in known_concept_names if str(n) not in allowed and str(n).lower() in rest})
        if extra:
            errors.append(f"konsep di luar fakta: {', '.join(extra)}")
    wc = len(re.findall(r"\w+", text))
    if not MIN_WORDS <= wc <= MAX_WORDS:
        errors.append(f"panjang: {wc} kata (harus {MIN_WORDS}-{MAX_WORDS})")
    return ValidationResult(not errors, errors, sorted(set(invented)), wc)


# ============================================================================ fallback
def _p2(v) -> str:
    return "tidak tersedia" if v is None else f"{v:.2f}"


def _pct(v) -> str:
    return "tidak tersedia" if v is None else f"{_pct_int(v)}%"


def _rec_bullet(r: dict, with_count: bool) -> str:
    s = f"- **{r['concept_name']}** ({ACTION_ID.get(r['recommended_action'], r['recommended_action'])}"
    if r.get("intervention_level"):
        s += f", level {LEVEL_ID.get(r['intervention_level'], r['intervention_level'])}"
    if with_count and r.get("n_students") is not None:
        s += f", {r['n_students']} siswa"
    s += f"): {r['remedial_activity'] or 'aktivitas belum diisi'}"
    if r.get("estimated_duration_min") is not None:
        s += f" Perkiraan durasi {r['estimated_duration_min']} menit."
    if r["is_placeholder"]:
        s += " *(placeholder, perlu validasi guru)*"
    return s


def fallback_narrative(facts: NarrativeFacts, audience: str | None = None) -> str:
    """Deterministic Markdown report from the facts alone (no LLM). Always passes validate_narrative."""
    audience = audience or facts.audience
    pol, sc, lim = facts.policy, facts.scope, facts.limits
    out = []
    if audience == "teacher":
        st = facts.student
        out.append("## Ringkasan kelas")
        if st is None:
            out.append(f"Laporan ini merangkum hasil diagnosis {sc['n_students']} siswa pada {sc['n_target_concepts']} konsep "
                       f"target berdasarkan {sc['n_responses']} respons yang teramati. Menurut estimasi model, "
                       f"{sc['n_students_with_gap']} siswa memiliki setidaknya satu learning gap. Kebijakan diagnosis yang "
                       f"dipakai: threshold τ = {pol['tau']}, pita ketidakpastian δ = {pol['delta']}, dan bukti minimum "
                       f"n_min = {pol['n_min']} respons per konsep.")
        else:
            out.append(f"Laporan ini membahas siswa {st['display_id']} pada {sc['n_target_concepts']} konsep target "
                       f"berdasarkan {sc['n_responses']} respons yang teramati. Menurut estimasi model, ada {st['n_gaps']} "
                       f"konsep dengan learning gap, {st['n_mastered']} konsep yang dikuasai, dan {st['n_insufficient']} "
                       f"konsep yang buktinya belum cukup. Threshold τ = {pol['tau']} dan n_min = {pol['n_min']}.")
        out.append("")
        out.append("## Temuan utama")
        if st is None:
            gap_rows = [r for r in facts.class_summary if r["n_not_mastered"] > 0]
            for r in gap_rows[:3]:
                out.append(f"- **{r['concept_name']}**: {r['n_not_mastered']} siswa terdeteksi memiliki learning gap "
                           f"({_pct(r['gap_share_among_diagnosable'])} dari siswa yang dapat didiagnosis); rata-rata "
                           f"probabilitas penguasaan {_p2(r['mean_mastery_prob'])}.")
            if not gap_rows:
                out.append("- Tidak ada konsep target dengan learning gap pada data ini.")
            ins = [r for r in facts.class_summary if r["n_insufficient"] > 0]
            if ins:
                top = max(ins, key=lambda r: r["n_insufficient"])
                out.append(f"- Konsep dengan bukti paling sedikit: **{top['concept_name']}** ({top['n_insufficient']} siswa "
                           "berstatus bukti belum cukup). Ini berarti butuh data tambahan, bukan learning gap.")
        else:
            for c in st["concepts"][:4]:
                out.append(f"- **{c['concept_name']}**: estimasi probabilitas penguasaan {_p2(c['mastery_prob'])} "
                           f"({c['mastery_label']}, {c['n_evidence']} respons, {c['n_correct']} benar).")
        out.append("")
        out.append("## Konsep prioritas")
        for g in facts.gaps:
            if "n_students_with_gap" in g:
                out.append(f"- **{g['concept_name']}**: proporsi gap {_pct(g['gap_share_among_diagnosable'])}, "
                           f"{g['n_students_with_gap']} siswa.")
            else:
                out.append(f"- **{g['concept_name']}** ({g['gap_status']}): probabilitas penguasaan {_p2(g['mastery_prob'])}, "
                           f"skor prioritas {_p2(g['priority_score'])}.")
        if not facts.gaps:
            out.append("- Belum ada konsep prioritas dengan bukti yang cukup.")
        out.append("")
        out.append("## Rekomendasi tindakan")
        for r in facts.recommendations:
            out.append(_rec_bullet(r, with_count=st is None))
        if not facts.recommendations:
            out.append("- Belum ada rekomendasi karena tidak ada learning gap yang terdeteksi.")
        out.append("")
        out.append("## Keterbatasan dan catatan")
    else:
        st = facts.student or {"display_id": "siswa", "concepts": [], "n_gaps": 0, "n_mastered": 0, "n_insufficient": 0}
        cons = st["concepts"]
        out.append("## Ringkasan")
        out.append(f"Halo {st['display_id']}! Ini ringkasan hasil asesmen diagnostik kamu pada {sc['n_target_concepts']} "
                   f"konsep berdasarkan {sc['n_responses']} jawaban. Menurut estimasi model, kamu sudah menguasai "
                   f"{st['n_mastered']} konsep, masih perlu berlatih pada {st['n_gaps']} konsep, dan ada {st['n_insufficient']} "
                   "konsep yang belum bisa dinilai karena soalnya belum cukup. Setiap hasil di bawah adalah gambaran "
                   "sementara yang bisa berubah ketika kamu terus berlatih.")
        out.append("")
        out.append("## Yang sudah dikuasai")
        good = [c for c in cons if c["mastery_label"] == "mastered"]
        out += [f"- **{c['concept_name']}** (estimasi {_p2(c['mastery_prob'])}). Pertahankan!" for c in good] or \
               ["- Belum ada konsep yang tercatat dikuasai; itu wajar di awal, dan latihan rutin akan membantu."]
        out.append("")
        out.append("## Yang perlu dilatih")
        weak = [c for c in cons if c["mastery_label"] in ("not_mastered", "uncertain")]
        out += [f"- **{c['concept_name']}** (estimasi {_p2(c['mastery_prob'])}, {c['n_correct']} benar dari "
                f"{c['n_evidence']} soal)." for c in weak] or ["- Tidak ada konsep yang tercatat perlu dilatih secara khusus."]
        ins = [c for c in cons if c["mastery_label"] == "insufficient_evidence"]
        if ins:
            out.append("- Belum bisa dinilai (butuh soal tambahan, bukan berarti belum paham): "
                       + ", ".join(f"**{c['concept_name']}**" for c in ins) + ".")
        out.append("")
        out.append("## Langkah belajar")
        for r in facts.recommendations:
            out.append(_rec_bullet(r, with_count=False))
        out.append("- Kerjakan latihan sedikit demi sedikit dan tanyakan bagian yang membingungkan kepada guru.")
        out.append("- Setelah berlatih, ikuti asesmen ulang agar perkembanganmu terlihat.")
        out.append("")
        out.append("## Catatan")
    out.append("- Probabilitas penguasaan adalah estimasi model statistik dari jawaban, bukan penilaian akhir.")
    out.append("- Status 'bukti belum cukup' berarti diperlukan soal tambahan, bukan learning gap.")
    if lim.get("n_target_concepts_without_items"):
        out.append(f"- Sebanyak {lim['n_target_concepts_without_items']} konsep target belum memiliki soal di item bank, "
                   "sehingga belum dapat didiagnosis.")
    if lim.get("placeholder_present"):
        out.append("- Sebagian rekomendasi masih placeholder dan perlu validasi guru sebelum dipakai.")
    out.append("- Laporan ini dibuat dari template otomatis tanpa model bahasa. Tidak ada klaim efektivitas intervensi.")
    out.append(f"- {DISCLAIMER}")
    return "\n".join(out) + "\n"


# ============================================================================ transport
class TransportError(RuntimeError):
    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


class TruncatedOutput(Exception):
    """The API answered, but the text was cut off or empty (treated like a validation failure)."""


def to_gemini_request(messages: list) -> tuple[str | None, list[dict]]:
    """Chat messages (system/user/assistant) -> (system_instruction, Gemini ``contents``); assistant -> role 'model'."""
    system = "\n\n".join(m["content"] for m in messages if m["role"] == "system") or None
    contents = [{"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
                for m in messages if m["role"] != "system"]
    return system, contents


def _normalise_response(r) -> dict:
    """google.genai GenerateContentResponse -> {"text", "finish_reason", "usage"} (thought parts dropped)."""
    cands = getattr(r, "candidates", None) or []
    if not cands:
        fb = getattr(r, "prompt_feedback", None)
        block = getattr(fb, "block_reason", None)
        raise TransportError(f"Gemini tidak mengembalikan jawaban (block_reason={getattr(block, 'name', block)})")
    fr = getattr(cands[0], "finish_reason", None)
    content = getattr(cands[0], "content", None)
    parts = (getattr(content, "parts", None) or []) if content is not None else []
    text = "".join(p.text for p in parts if getattr(p, "text", None) and not getattr(p, "thought", False))
    um = getattr(r, "usage_metadata", None)
    usage = {}
    if um is not None:
        usage = {k: v for k, v in {"prompt_tokens": um.prompt_token_count, "completion_tokens": um.candidates_token_count,
                                   "thinking_tokens": um.thoughts_token_count, "total_tokens": um.total_token_count}.items()
                 if isinstance(v, int)}
    return {"text": text, "finish_reason": None if fr is None else str(getattr(fr, "name", fr)), "usage": usage}


class GeminiTransport:
    """Gemini API through the official Google Gen AI SDK (``google-genai``), imported on first use.

    Returns {"text", "finish_reason", "usage"}; SDK/HTTP problems are raised as TransportError."""

    def __init__(self, config: NarrativeConfig):
        self.config = config
        self._client = None
        self._client_lock = threading.Lock()

    def _get_client(self):
        with self._client_lock:
            return self._create_client()

    def _create_client(self):
        if self._client is None:
            cfg = self.config
            key = cfg.api_key
            if not key:
                raise TransportError(f"API key Gemini belum di-set (env {cfg.api_key_env} atau file {cfg.env_file})")
            try:
                from google import genai  # lazy: importing cdacdm.narrative must not pull in network libraries
                from google.genai import types
            except ImportError as e:
                raise TransportError("paket google-genai belum terinstal: pip install google-genai") from e
            self._client = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=int(cfg.timeout_sec * 1000), retry_options=types.HttpRetryOptions(attempts=1)))
        return self._client

    def __call__(self, payload: dict) -> dict:
        client = self._get_client()
        import httpx
        from google.genai import errors, types

        system, contents = to_gemini_request(payload["messages"])
        gen = {"system_instruction": system, "temperature": payload.get("temperature"), "top_p": payload.get("top_p"),
               "max_output_tokens": payload.get("max_tokens")}
        for key in ('response_mime_type', 'response_json_schema'):
            if payload.get(key) is not None:
                gen[key] = payload[key]
        if payload.get("thinking_level"):
            gen["thinking_config"] = types.ThinkingConfig(thinking_level=payload["thinking_level"].upper())
        config = types.GenerateContentConfig(**{k: v for k, v in gen.items() if v is not None})
        try:
            r = client.models.generate_content(model=payload["model"], contents=contents, config=config)
        except errors.APIError as e:
            code = int(getattr(e, "code", 0) or 0)
            raise TransportError(f"Gemini HTTP {code}", retryable=code in (408, 429) or code >= 500) from e
        except httpx.TimeoutException as e:
            raise TransportError(f"Gemini timeout ({e.__class__.__name__})") from e
        except httpx.TransportError as e:
            raise TransportError("Gemini API tidak dapat dihubungi") from e
        return _normalise_response(r)


def _extract_text(resp: dict) -> tuple[str, dict]:
    if not isinstance(resp, dict) or "text" not in resp:
        raise TransportError("LLM response has no text")
    fr = str(resp.get("finish_reason") or "").upper()
    if fr == "MAX_TOKENS":
        # the max_output_tokens budget (which includes thinking tokens) ran out: not an API failure
        raise TruncatedOutput("output LLM terpotong (finish_reason=MAX_TOKENS): naikkan max_tokens atau turunkan thinking_level")
    text = (resp["text"] or "").strip()
    if not text and fr not in ("", "STOP"):
        raise TruncatedOutput(f"output LLM kosong (finish_reason={fr})")
    m = re.fullmatch(r"(?s)```(?:markdown|md)?\s*\n(.*?)\n```", text)
    if m:
        text = m.group(1).strip()
    return text, resp.get("usage") or {}


# ============================================================================ generator
def cache_key(facts: NarrativeFacts, config: NarrativeConfig) -> str:
    s = facts.canonical_json() + facts.audience + config.prompt_version + config.model
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class NarrativeGenerator:
    """One request per report; disk cache, audit log, repair retries, circuit breaker, template fallback.

    ``transport(payload) -> {"text", "finish_reason", "usage"}`` can be injected (tests); by default a
    ``GeminiTransport`` is created on first use. Thread-safe enough for a Streamlit ``cache_resource``.
    """

    def __init__(self, config: NarrativeConfig | None = None, transport=None, examples: list | None = None,
                 sleep=time.sleep, clock=time.monotonic):
        self.config = config or load_narrative_config()
        self._transport = transport
        self._examples = examples
        self._sleep, self._clock = sleep, clock
        self._failures = 0
        self._open_until = 0.0
        self._lock = threading.Lock()

    # ---------------------------------------------------------------- plumbing
    @property
    def transport(self):
        with self._lock:
            if self._transport is None:
                self._transport = GeminiTransport(self.config)
            return self._transport

    @property
    def examples(self) -> list:
        if self._examples is None:
            self._examples = load_examples(self.config.examples_path)
        return self._examples

    @property
    def circuit_open(self) -> bool:
        return self._clock() < self._open_until

    def _record_failure(self):
        with self._lock:
            self._failures += 1
            if self._failures >= self.config.circuit_failures:
                self._open_until = self._clock() + self.config.circuit_cooldown_sec
                log.warning("LLM circuit breaker open for %ss after %s consecutive failures",
                            self.config.circuit_cooldown_sec, self._failures)

    def _record_success(self):
        with self._lock:
            self._failures = 0
            self._open_until = 0.0

    def _payload(self, messages: list) -> dict:
        c = self.config
        return {"model": c.model, "messages": messages, "temperature": c.temperature, "top_p": c.top_p,
                "max_tokens": c.max_tokens, "thinking_level": c.thinking_level}

    def _cache_path(self, key: str) -> Path:
        return resolve_path(self.config.cache_dir) / f"{key}.json"

    def _cache_get(self, key: str) -> dict | None:
        p = self._cache_path(key)
        try:
            if not p.exists():
                return None
            d = json.loads(p.read_text(encoding="utf-8"))
            if time.time() - float(d.get("created_unix", 0)) > self.config.cache_ttl_hours * 3600:
                return None
            return d
        except (OSError, ValueError) as e:
            log.warning("narrative cache read failed: %s", e)
            return None

    def _cache_put(self, key: str, text: str, usage: dict):
        p = self._cache_path(key)
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
            tmp = p.with_suffix(f".{uuid.uuid4().hex}.tmp")
            tmp.write_text(json.dumps({"created_unix": time.time(), "created_at": _now_iso(), "model": self.config.model,
                                       "prompt_version": self.config.prompt_version, "text": text, "usage": usage},
                                      ensure_ascii=False), encoding="utf-8")
            tmp.replace(p)
        except OSError as e:
            log.warning("narrative cache write failed: %s", e)

    def _audit(self, meta: dict, validation_ok: bool, fallback: bool):
        """JSONL audit line: no narrative text, no student ids (input_hash only)."""
        row = {"timestamp": _now_iso(), "audience": meta["audience"], "model": self.config.model,
               "prompt_version": self.config.prompt_version, "input_hash": meta["input_hash"], "cache_hit": meta["cache_hit"],
               "latency_ms": meta["latency_ms"], "attempts": meta["attempts"], "validation_ok": validation_ok,
               "fallback": fallback, "reason": meta.get("reason"), "usage": meta.get("usage") or {}}
        p = resolve_path(self.config.log_path)
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
            with self._lock:
                if p.exists() and p.stat().st_size > 5_000_000:
                    p.replace(p.with_suffix(p.suffix + '.1'))
                with open(p, "a", encoding="utf-8") as f:
                    f.write(json.dumps(row, ensure_ascii=False) + "\n")
        except OSError as e:
            log.warning("narrative audit log write failed: %s", e)

    def _finish(self, facts, key, t0, text, validation, fallback, attempts, cache_hit, reason=None, usage=None) -> dict:
        meta = {"model": "template" if fallback else self.config.model, "llm_model": self.config.model,
                "prompt_version": self.config.prompt_version, "audience": facts.audience,
                "latency_ms": int(round((time.perf_counter() - t0) * 1000)), "attempts": attempts, "cache_hit": cache_hit,
                "input_hash": key, "reason": reason, "usage": usage or {}, "generated_at": _now_iso()}
        self._audit(meta, validation.ok, fallback)
        return {"text": text, "meta": meta, "validation": validation.to_dict(), "fallback": fallback}

    def _fallback(self, facts, key, t0, attempts, reason, usage=None, known=None) -> dict:
        if reason:
            log.info("narrative fallback (%s): %s", facts.audience, reason)
        text = fallback_narrative(facts)
        v = validate_narrative(text, facts, facts.audience, known_concept_names=known)
        if not v.ok:   # the template must never fail; log loudly if it does but still return it (no LLM text)
            log.error("fallback narrative failed validation: %s", v.errors)
        return self._finish(facts, key, t0, text, v, True, attempts, False, reason, usage)

    # ---------------------------------------------------------------- public
    def generate(self, facts: NarrativeFacts | dict, known_concept_names=None) -> dict:
        """Return {"text", "meta", "validation", "fallback"}; never raises for LLM problems."""
        f = facts if isinstance(facts, NarrativeFacts) else NarrativeFacts.from_dict(facts)
        cfg = self.config
        t0 = time.perf_counter()
        key = cache_key(f, cfg)
        known = list(known_concept_names) if known_concept_names is not None else None
        if not cfg.enabled:
            return self._fallback(f, key, t0, 0, "LLM disabled in config", known=known)
        cached = self._cache_get(key)
        if cached is not None:
            v = validate_narrative(cached["text"], f, f.audience, known_concept_names=known)
            if v.ok:
                return self._finish(f, key, t0, cached["text"], v, False, 0, True, None, cached.get("usage"))
        if self.circuit_open:
            return self._fallback(f, key, t0, 0, "circuit breaker open (LLM API failed recently)", known=known)
        base = build_prompt(f, f.audience, self.examples, cfg.max_examples)
        messages = base
        usage_total: dict = {}
        attempts, reason = 0, None
        for attempt in range(cfg.max_retries + 1):
            attempts += 1
            text, errors = None, []
            try:
                resp = self.transport(self._payload(messages))
                usage = (resp.get("usage") or {}) if isinstance(resp, dict) else {}
                try:
                    text, _ = _extract_text(resp)
                except TruncatedOutput as e:
                    errors = [str(e)]
            except TransportError as e:
                self._record_failure()
                reason = str(e)
                if e.retryable and attempt < cfg.max_retries and not self.circuit_open:
                    self._sleep(cfg.backoff_sec[min(attempt, len(cfg.backoff_sec) - 1)])
                    continue
                break
            except Exception as e:  # noqa: BLE001 - an unexpected transport bug must not crash the app
                self._record_failure()
                reason = f"unexpected LLM error: {e.__class__.__name__}"
                log.exception("unexpected LLM transport error")
                break
            self._record_success()
            for k, v in usage.items():
                if isinstance(v, (int, float)):
                    usage_total[k] = usage_total.get(k, 0) + v
            if text is not None:
                val = validate_narrative(text, f, f.audience, known_concept_names=known)
                if val.ok:
                    self._cache_put(key, text, usage_total)
                    return self._finish(f, key, t0, text, val, False, attempts, False, None, usage_total)
                errors = val.errors
                log.debug("rejected narrative text (attempt %s):\n%s", attempts, text)
            reason = "validation failed: " + "; ".join(errors)
            log.info("narrative attempt %s failed validation: %s", attempts, errors)
            # repair note on the SAME prompt (not the rejected answer appended): the prompt size, and so the
            # input-token cost of each retry, stays constant
            messages = base[:-1] + [{"role": "user", "content": base[-1]["content"]
                                     + "\n\nPERHATIAN: percobaan sebelumnya melanggar aturan berikut, jangan ulangi:\n"
                                     + "\n".join(f"- {e}" for e in errors)
                                     + "\nTulis SELURUH laporan dari awal, ringkas, dengan semua heading wajib."}]
        return self._fallback(f, key, t0, attempts, reason, usage_total, known=known)


def fallback_result(facts: NarrativeFacts, reason: str, config: NarrativeConfig | None = None) -> dict:
    """Template result without any generator (e.g. when the LLM config itself is invalid). No audit/cache."""
    text = fallback_narrative(facts)
    v = validate_narrative(text, facts, facts.audience)
    meta = {"model": "template", "llm_model": config.model if config else None,
            "prompt_version": config.prompt_version if config else NarrativeConfig.prompt_version, "audience": facts.audience,
            "latency_ms": 0, "attempts": 0, "cache_hit": False, "input_hash": None, "reason": reason, "usage": {},
            "generated_at": _now_iso()}
    return {"text": text, "meta": meta, "validation": v.to_dict(), "fallback": True}
