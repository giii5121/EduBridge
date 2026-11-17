"""Narrative layer (cdacdm.narrative): validator, fallback, cache, circuit breaker, privacy, service/app integration.

No test talks to the Gemini API: transports are fakes and every socket connect is blocked. The optional
real-API test runs only when CDACDM_GEMINI_TEST=1 and GEMINI_API_KEY are set (billed request)."""
import inspect
import json
import os
import socket
import subprocess
import sys
from types import SimpleNamespace

import pandas as pd
import pytest

from cdacdm import narrative as nv
from cdacdm.narrative import (GeminiTransport, NarrativeConfig, NarrativeFacts, NarrativeGenerator, TransportError,
                              build_prompt, fallback_narrative, load_narrative_config, to_gemini_request,
                              validate_narrative)
from cdacdm.service import CDMService

from conftest import ROOT

APP = str(ROOT / "app.py")
RAW_ID = "budi-santoso-007"
REAL_API = os.environ.get("CDACDM_GEMINI_TEST") == "1" and bool(NarrativeConfig().api_key)   # env or .env


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Any outgoing TCP connection fails the test (unless the opt-in real-API test runs).

    httpx (used by google-genai) connects through socket.create_connection. socket.socket.connect itself stays
    untouched: asyncio on Windows connects a loopback socketpair internally."""
    calls = []

    def blocked(*a, **k):
        calls.append(a)
        raise AssertionError(f"network access attempted: {a!r}")

    if not REAL_API:
        monkeypatch.setattr(socket, "create_connection", blocked)
    return calls


def teacher_facts(placeholder=True) -> NarrativeFacts:
    return NarrativeFacts(
        audience="teacher", policy={"tau": 0.5, "delta": 0.0, "n_min": 5},
        scope={"n_students": 30, "n_target_concepts": 11, "n_responses": 812, "n_students_with_gap": 12},
        class_summary=[{"concept_name": "Solving Linear Equations", "n_students": 30, "n_mastered": 8, "n_not_mastered": 14,
                        "n_uncertain": 5, "n_insufficient": 3, "gap_share_among_diagnosable": 0.52, "mean_mastery_prob": 0.41}],
        gaps=[{"concept_name": "Solving Linear Equations", "gap_status": "learning_gap", "n_students_with_gap": 14,
               "gap_share_among_diagnosable": 0.52, "mean_mastery_prob": 0.41}],
        recommendations=[{"concept_name": "Solving Linear Equations", "recommended_action": "remediate",
                          "intervention_level": "whole_class", "gap_description": "...", "remedial_activity": "Latihan terbimbing.",
                          "estimated_duration_min": 30, "is_placeholder": placeholder, "n_students": 14}],
        limits={"no_ground_truth": True, "placeholder_present": placeholder, "n_target_concepts_without_items": 1,
                "insufficient_evidence_is_not_gap": True})


FILLER = " ".join(["Estimasi model ini membantu guru merencanakan pembelajaran secara bertahap dan suportif."] * 14)


def grounded_text(extra: str = "", placeholder_note=True) -> str:
    note = "Rekomendasi masih placeholder dan perlu validasi guru." if placeholder_note else "Rekomendasi sudah diisi guru."
    return f"""## Ringkasan kelas
Diagnosis mencakup 30 siswa, 11 konsep target, dan 812 respons; 12 siswa memiliki gap (τ = 0,5). {extra}

## Temuan utama
- **Solving Linear Equations**: 14 siswa dengan gap, yaitu 52% dari yang terdiagnosis; rata-rata 0,41.

## Konsep prioritas
- **Solving Linear Equations** menjadi prioritas utama (sekitar 30 menit per sesi).

## Rekomendasi tindakan
- Latihan terbimbing untuk seluruh kelas. {note}

## Keterbatasan dan catatan
- {FILLER}
"""


def fake_response(text, usage=None, finish_reason="STOP"):
    return {"text": text, "finish_reason": finish_reason, "usage": usage or {"total_tokens": 10}}


class FakeTransport:
    def __init__(self, outputs):
        self.outputs = list(outputs)
        self.payloads = []

    def __call__(self, payload):
        self.payloads.append(payload)
        out = self.outputs.pop(0) if len(self.outputs) > 1 else self.outputs[0]
        if isinstance(out, Exception):
            raise out
        return fake_response(out)


def make_gen(tmp_path, transport, **over):
    cfg = NarrativeConfig(**{"cache_dir": str(tmp_path / "cache"), "log_path": str(tmp_path / "log.jsonl"), **over})
    return NarrativeGenerator(cfg, transport=transport, examples=[], sleep=lambda s: None)


# ---------------------------------------------------------------------------- validator
def test_validator_accepts_grounded_numbers():
    f = teacher_facts()
    v = validate_narrative(grounded_text(), f)
    assert v.ok, v.errors
    v2 = validate_narrative(fallback_narrative(f), f)
    assert v2.ok, v2.errors
    # thousands separator and "persen" form of a fact
    f.scope["n_responses_all_items"] = 28003
    assert validate_narrative(grounded_text("Total 28.003 respons, gap 52 persen."), f).ok


def test_validator_rejects_invented_number():
    f = teacher_facts()
    v = validate_narrative(grounded_text("Sebanyak 73% siswa akan naik 0,9 poin."), f)
    assert not v.ok
    assert "73%" in v.invented_numbers and "0,9" in v.invented_numbers
    # a proportion is only accepted as a percentage when written as one
    assert not validate_narrative(grounded_text("Ada 52 kelompok."), f).ok
    # numbered lists are forbidden even with grounded numbers
    assert any("bernomor" in e for e in validate_narrative(grounded_text().replace("- **Solving", "1. **Solving"), f).errors)


def test_validator_requires_placeholder_disclaimer():
    f = teacher_facts(placeholder=True)
    v = validate_narrative(grounded_text(placeholder_note=False), f)
    assert not v.ok and any("placeholder" in e for e in v.errors)
    assert validate_narrative(grounded_text(placeholder_note=False), teacher_facts(placeholder=False)).ok


def test_validator_rejects_forbidden_claims():
    f = teacher_facts()
    for claim in ["Metode ini terbukti berhasil.", "Hasilnya dijamin.", "Latihan ini efektif meningkatkan nilai.",
                  "Beberapa siswa malas belajar."]:
        v = validate_narrative(grounded_text(claim), f)
        assert not v.ok and any("klaim terlarang" in e for e in v.errors), claim


def test_validator_headings_concepts_and_length():
    f = teacher_facts()
    v = validate_narrative(grounded_text().replace("## Konsep prioritas", "## Prioritas"), f)
    assert any("heading" in e for e in v.errors)
    v = validate_narrative(grounded_text("Konsep Pythagoras juga lemah."), f,
                           known_concept_names=["Solving Linear Equations", "Pythagoras"])
    assert any("Pythagoras" in e for e in v.errors)
    assert any("panjang" in e for e in validate_narrative("## Ringkasan kelas\nTerlalu pendek.", f).errors)
    assert any("HTML" in e for e in validate_narrative(grounded_text("<b>x</b>"), f).errors)


def test_validator_rejects_number_attached_to_wrong_concept():
    """Live qwen2.5:3b wrote 'Linear Equations ... 60%' where 60% belonged to another concept (fact: 69%)."""
    f = teacher_facts()
    f.class_summary.append({"concept_name": "Writing Expressions", "n_students": 30, "n_mastered": 8, "n_not_mastered": 12,
                            "n_uncertain": 0, "n_insufficient": 10, "gap_share_among_diagnosable": 0.6, "mean_mastery_prob": 0.42})
    ok = grounded_text("- **Writing Expressions**: 12 siswa dengan gap (60%); τ = 0,5, 30 siswa.")
    assert validate_narrative(ok, f).ok
    bad = grounded_text("- **Solving Linear Equations**: 12 siswa dengan gap (60%).")
    v = validate_narrative(bad, f)
    assert not v.ok and any("tidak sesuai konsepnya" in e and "60%" in e and "Solving Linear Equations" in e for e in v.errors)
    # a line naming both concepts may use numbers of either one
    assert validate_narrative(grounded_text("- **Solving Linear Equations** (52%) dan **Writing Expressions** (60%)."), f).ok


# ---------------------------------------------------------------------------- generator
def test_fallback_when_transport_fails(tmp_path):
    t = FakeTransport([TransportError("Gemini API tidak dapat dihubungi")])
    gen = make_gen(tmp_path, t)
    f = teacher_facts()
    out = gen.generate(f)
    assert out["fallback"] and out["text"] == fallback_narrative(f)
    assert out["validation"]["ok"] and out["meta"]["model"] == "template"
    assert "tidak dapat dihubungi" in out["meta"]["reason"]
    assert len(t.payloads) == 1          # connection errors are not retried (no hanging)
    log = [json.loads(line) for line in (tmp_path / "log.jsonl").read_text(encoding="utf-8").splitlines()]
    assert log[-1]["fallback"] and "text" not in log[-1]


def test_repair_retry_then_success_and_unvalidated_text_never_returned(tmp_path):
    bad = grounded_text("Sebanyak 99% siswa gagal.")
    t = FakeTransport([bad, grounded_text()])
    out = make_gen(tmp_path, t).generate(teacher_facts())
    assert not out["fallback"] and out["meta"]["attempts"] == 2 and "99%" not in out["text"]
    repair = t.payloads[1]["messages"][-1]["content"]
    assert "99%" in repair and "melanggar" in repair
    # repairs do not append the rejected answer: same number of messages, prompt does not grow per attempt
    assert len(t.payloads[1]["messages"]) == len(t.payloads[0]["messages"])
    assert all(m["role"] != "assistant" or "99%" not in m["content"] for m in t.payloads[1]["messages"])
    t2 = FakeTransport([bad])
    out2 = make_gen(tmp_path / "b", t2, max_retries=2).generate(teacher_facts())
    assert out2["fallback"] and len(t2.payloads) == 3 and "99%" not in out2["text"]


def test_truncated_output_is_rejected_not_counted_as_outage(tmp_path):
    cut = fake_response(grounded_text(), finish_reason="MAX_TOKENS")
    calls = []

    def transport(payload):
        calls.append(payload)
        return cut

    gen = make_gen(tmp_path, transport, max_retries=1)
    out = gen.generate(teacher_facts())
    assert out["fallback"] and "terpotong" in out["meta"]["reason"] and len(calls) == 2
    assert gen._failures == 0 and not gen.circuit_open


def test_retryable_http_error_uses_backoff(tmp_path):
    sleeps = []
    t = FakeTransport([TransportError("Gemini HTTP 503", retryable=True), grounded_text()])
    gen = make_gen(tmp_path, t)
    gen._sleep = sleeps.append
    out = gen.generate(teacher_facts())
    assert not out["fallback"] and sleeps == [2.0]


def test_cache_hit_does_not_call_transport(tmp_path):
    t = FakeTransport([grounded_text()])
    gen = make_gen(tmp_path, t)
    first = gen.generate(teacher_facts())
    assert not first["fallback"] and not first["meta"]["cache_hit"] and len(t.payloads) == 1
    t2 = FakeTransport([AssertionError("transport must not be called on a cache hit")])
    second = make_gen(tmp_path, t2).generate(teacher_facts())     # fresh generator, same disk cache
    assert second["meta"]["cache_hit"] and second["text"] == first["text"] and not t2.payloads
    # a different prompt version or model is a different cache entry
    assert make_gen(tmp_path, FakeTransport([grounded_text()]), prompt_version="v2").generate(teacher_facts())["meta"]["cache_hit"] is False
    # expired entries are ignored
    t3 = FakeTransport([grounded_text()])
    assert make_gen(tmp_path, t3, cache_ttl_hours=0).generate(teacher_facts())["meta"]["cache_hit"] is False and t3.payloads


def test_circuit_breaker_opens_after_three_failures(tmp_path):
    now = [1000.0]
    t = FakeTransport([TransportError("down")])
    gen = make_gen(tmp_path, t, max_retries=0)
    gen._clock = lambda: now[0]
    for _ in range(3):
        assert gen.generate(teacher_facts())["fallback"]
    assert len(t.payloads) == 3 and gen.circuit_open
    out = gen.generate(teacher_facts())
    assert out["fallback"] and "circuit" in out["meta"]["reason"] and len(t.payloads) == 3
    now[0] += 61
    t.outputs = [grounded_text()]
    out = gen.generate(teacher_facts())
    assert not out["fallback"] and len(t.payloads) == 4 and not gen.circuit_open and gen._failures == 0


# ---------------------------------------------------------------------------- privacy / config
def _diagnose_named_student(svc):
    resp = pd.DataFrame({"student_id": [RAW_ID] * 8 + ["other-kid"] * 8,
                         "QuestionId": list(range(1000, 1008)) * 2, "response": [1, 0, 1, 1, 0, 1, 1, 0] * 2})
    return svc.diagnose(resp)


def test_api_payload_redacts_student_id(trained_dir, tmp_path):
    svc = CDMService.load(trained_dir)
    res = _diagnose_named_student(svc)
    t = FakeTransport([TransportError("down")])
    gen = make_gen(tmp_path, t)
    for audience in ["student", "teacher"]:
        svc.generate_narrative(res, audience, student_id=RAW_ID, generator=gen)
    sent = json.dumps(t.payloads, ensure_ascii=False)
    assert RAW_ID not in sent and "other-kid" not in sent
    assert nv.pseudonym(RAW_ID) in sent
    log_txt = (tmp_path / "log.jsonl").read_text(encoding="utf-8")
    assert RAW_ID not in log_txt and nv.pseudonym(RAW_ID) not in log_txt


def test_config_defaults_and_key_only_from_env(tmp_path, monkeypatch):
    monkeypatch.delenv("CDACDM_LLM_CONFIG", raising=False)
    cfg = load_narrative_config()
    assert cfg.model == "gemini-3.1-flash-lite" and cfg.api_key_env == "GEMINI_API_KEY"
    assert (cfg.temperature, cfg.top_p, cfg.thinking_level, cfg.max_tokens, cfg.max_retries) == (1.0, None, "low", 8192, 2)
    assert cfg.prompt_version == "narrative-gemini-v1"
    assert load_narrative_config(tmp_path / "missing.json").model == cfg.model
    with pytest.raises(ValueError, match="thinking_level"):
        NarrativeConfig(thinking_level="max")
    with pytest.raises(ValueError, match="model"):
        NarrativeConfig(model=" ")
    p = tmp_path / "llm.json"
    p.write_text(json.dumps({"api_key": "AIza-secret"}))
    with pytest.raises(ValueError, match="API key"):
        load_narrative_config(p)
    p.write_text(json.dumps({"base_url": "http://localhost:11434/v1", "model": "gemini-x"}))   # old SLM keys are ignored
    assert load_narrative_config(p).model == "gemini-x"
    envf = tmp_path / ".env"
    envf.write_text('# comment\nOTHER=1\nexport GEMINI_API_KEY="from-file"\n', encoding="utf-8")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert NarrativeConfig(env_file=str(envf)).api_key == "from-file"
    assert NarrativeConfig(env_file=str(tmp_path / "none.env")).api_key is None
    assert nv.read_env_file(str(envf)) == {"OTHER": "1", "GEMINI_API_KEY": "from-file"}
    monkeypatch.setenv("GEMINI_API_KEY", "from-env")             # the process environment wins over the file
    assert NarrativeConfig(env_file=str(envf)).api_key == "from-env"


def test_gemini_request_mapping_and_missing_key(tmp_path, monkeypatch):
    msgs = [{"role": "system", "content": "aturan"}, {"role": "user", "content": "contoh"},
            {"role": "assistant", "content": "jawaban contoh"}, {"role": "user", "content": "fakta"}]
    system, contents = to_gemini_request(msgs)
    assert system == "aturan"
    assert [c["role"] for c in contents] == ["user", "model", "user"]
    assert contents[-1]["parts"] == [{"text": "fakta"}]
    # a missing API key is a clean template fallback with the reason, before any SDK import or connection
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    cfg = NarrativeConfig(cache_dir=str(tmp_path / "c"), log_path=str(tmp_path / "l.jsonl"), env_file=None)
    out = NarrativeGenerator(cfg, examples=[], sleep=lambda s: None).generate(teacher_facts())
    assert out["fallback"] and "GEMINI_API_KEY" in out["meta"]["reason"]
    with pytest.raises(TransportError, match="GEMINI_API_KEY"):
        GeminiTransport(cfg)({"messages": msgs, "model": cfg.model})


def test_normalise_gemini_response_drops_thoughts_and_maps_usage():
    part = lambda text, thought=None: SimpleNamespace(text=text, thought=thought)  # noqa: E731
    r = SimpleNamespace(
        candidates=[SimpleNamespace(finish_reason=SimpleNamespace(name="MAX_TOKENS"),
                                    content=SimpleNamespace(parts=[part("rencana", True), part("## Ringkasan")]))],
        usage_metadata=SimpleNamespace(prompt_token_count=100, candidates_token_count=20, thoughts_token_count=50,
                                       total_token_count=170))
    out = nv._normalise_response(r)
    assert out == {"text": "## Ringkasan", "finish_reason": "MAX_TOKENS",
                   "usage": {"prompt_tokens": 100, "completion_tokens": 20, "thinking_tokens": 50, "total_tokens": 170}}
    blocked = SimpleNamespace(candidates=[], prompt_feedback=SimpleNamespace(block_reason=SimpleNamespace(name="SAFETY")))
    with pytest.raises(TransportError, match="SAFETY"):
        nv._normalise_response(blocked)
    with pytest.raises(nv.TruncatedOutput, match="kosong"):
        nv._extract_text(fake_response("", finish_reason="SAFETY"))


def test_prompt_contains_required_sections(trained_dir):
    svc = CDMService.load(trained_dir)
    res = _diagnose_named_student(svc)
    examples = [json.loads(line) for line in (ROOT / "configs/narrative_examples.jsonl").read_text(encoding="utf-8").splitlines()]
    for audience, heads in nv.REQUIRED_HEADINGS.items():
        f = svc.narrative_facts(res, audience, RAW_ID if audience == "student" else None)
        msgs = build_prompt(f, audience, examples, max_examples=2)
        assert msgs[0]["role"] == "system" and msgs[-1]["role"] == "user"
        for h in heads:
            assert f"## {h}" in msgs[0]["content"]
        for rule in ["HANYA boleh memakai fakta", "estimasi model", "perlu validasi guru", "BUKAN learning gap", "tanpa HTML",
                     "bullet `-`"]:
            assert rule in msgs[0]["content"], rule
        assert json.dumps(f.to_dict(), ensure_ascii=False, separators=(",", ":")) in msgs[-1]["content"]
        assert "PLACEHOLDER (generik)" not in msgs[-1]["content"]          # boilerplate stripped, flag kept
        assert len(msgs) <= 1 + 2 * 2 + 1
        assert RAW_ID not in json.dumps(msgs, ensure_ascii=False)
    # the shipped examples follow the validator themselves
    for ex in examples:
        assert validate_narrative(ex["output"], NarrativeFacts.from_dict(ex["facts"])).ok


def test_facts_are_compact_and_bounded(trained_dir):
    svc = CDMService.load(trained_dir)
    res = _diagnose_named_student(svc)
    cfg = NarrativeConfig(max_student_concepts=2, max_gaps=1, max_recommendations=1)
    f = svc.narrative_facts(res, "student", RAW_ID, cfg)
    assert len(f.student["concepts"]) == 2 and len(f.gaps) <= 1 and len(f.recommendations) <= 1
    assert not f.class_summary and "n_students" not in f.scope
    t = svc.narrative_facts(res, "teacher")
    assert t.student is None and t.scope["n_students"] == 2 and len(t.class_summary) <= 11
    assert t.limits["n_target_concepts_without_items"] == 1        # concept 105 has no items in the fixture
    for facts in (f, t):
        assert validate_narrative(fallback_narrative(facts), facts, known_concept_names=svc.concept_names).ok


# ---------------------------------------------------------------------------- service / app / isolation
def test_service_generate_narrative_backward_compatible(trained_dir, tmp_path):
    svc = CDMService.load(trained_dir)
    res = _diagnose_named_student(svc)
    assert list(inspect.signature(svc.report_json).parameters) == ["result", "prepost"]
    rep = svc.report_json(res)
    assert set(rep) == {"generated_by", "model", "artifact_source", "policy", "input_info", "mastery_profiles_target",
                        "learning_gaps", "intervention_recommendations", "class_summary", "pre_post", "disclaimer"}
    json.dumps(rep, default=str)
    out = svc.generate_narrative(res, "teacher", generator=make_gen(tmp_path, FakeTransport([TransportError("down")])))
    assert set(out) == {"text", "meta", "validation", "fallback"} and out["fallback"]
    out = svc.generate_narrative(res, "student", student_id=RAW_ID, generator=make_gen(tmp_path, None, enabled=False))
    assert out["fallback"] and "disabled" in out["meta"]["reason"] and "## Langkah belajar" in out["text"]
    with pytest.raises(ValueError, match="student_id"):
        svc.narrative_facts(res, "student", "nobody")


def test_no_network_by_default(trained_dir, tmp_path, no_network):
    code = "import sys, cdacdm.narrative; print(int('google.genai' in sys.modules), int('httpx' in sys.modules))"
    r = subprocess.run([sys.executable, "-c", code], cwd=str(ROOT), capture_output=True, text=True, timeout=120)
    assert r.returncode == 0 and r.stdout.split() == ["0", "0"], r.stderr
    gen = NarrativeGenerator(NarrativeConfig(cache_dir=str(tmp_path), log_path=str(tmp_path / "l.jsonl")))
    assert gen._transport is None                          # nothing created until a request is needed
    svc = CDMService.load(trained_dir)
    out = svc.generate_narrative(_diagnose_named_student(svc), "teacher",
                                 generator=make_gen(tmp_path, FakeTransport([grounded_text()]), enabled=False))
    assert out["fallback"] and not no_network


def test_app_narrative_buttons_fall_back_without_llm(trained_dir, tmp_path, monkeypatch):
    from streamlit.testing.v1 import AppTest
    cfg = tmp_path / "llm.json"
    cfg.write_text(json.dumps({"enabled": False, "cache_dir": str(tmp_path / "c"), "log_path": str(tmp_path / "l.jsonl")}))
    monkeypatch.setenv("CDACDM_LLM_CONFIG", str(cfg))
    monkeypatch.setenv("CDACDM_ARTIFACT_DIR", str(trained_dir))
    at = AppTest.from_file(APP, default_timeout=180)
    at.run()
    at.sidebar.radio[0].set_value("Student Assessment").run()
    next(b for b in at.button if b.label == "Proses diagnosis").click().run()
    next(b for b in at.button if b.label == "Buat feedback siswa").click().run()
    assert not at.exception, at.exception
    assert any("template" in w.value for w in at.warning)
    assert any("## Yang perlu dilatih" in m.value for m in at.markdown)
    assert any("Estimasi model, bukan mastery terverifikasi" in c.value for c in at.caption)
    for page, label in [("Learning Gap Analysis", "Buat ringkasan naratif"), ("Intervention Recommendations", "Jelaskan rekomendasi")]:
        at.sidebar.radio[0].set_value(page).run()
        btn = [b for b in at.button if b.label == label]
        if btn:
            btn[0].click().run()
        assert not at.exception, at.exception


@pytest.mark.skipif(not REAL_API, reason="set CDACDM_GEMINI_TEST=1 and GEMINI_API_KEY to call the real Gemini API")
def test_real_gemini_api(trained_dir, tmp_path):
    svc = CDMService.load(trained_dir)
    gen = make_gen(tmp_path, None, model=os.environ.get("CDACDM_GEMINI_TEST_MODEL", NarrativeConfig.model))
    out = svc.generate_narrative(_diagnose_named_student(svc), "teacher", generator=gen)
    assert out["validation"]["ok"]
    print(out["meta"], "\n", out["text"])
