import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILL_DIR = ROOT / "skills" / "chat-reply"
CASES_PATH = SKILL_DIR / "evals" / "cases.json"
EVAL_PATH = SKILL_DIR / "EVAL.md"

VALID_DIMENSIONS = {"material", "action", "expression", "stop", "diversity"}


def test_chat_reply_eval_cases_have_stable_structure():
    payload = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    assert payload["version"] == 1
    cases = payload["cases"]
    assert len(cases) >= 10

    ids = [case["id"] for case in cases]
    assert len(ids) == len(set(ids))

    forbidden_golden_fields = {"answer", "expected", "expected_reply", "golden", "golden_reply"}

    for case in cases:
        assert isinstance(case["context"], list) and case["context"]
        assert isinstance(case["request"], str) and case["request"].strip()
        assert isinstance(case["candidate_count"], int) and case["candidate_count"] >= 1
        assert set(case["focus"]) <= VALID_DIMENSIONS
        assert case["focus"]
        assert not (set(case) & forbidden_golden_fields)

        failures = case["failure_conditions"]
        assert isinstance(failures, list) and failures
        for failure in failures:
            assert set(failure) == {"id", "description", "critical"}
            assert isinstance(failure["id"], str) and failure["id"].strip()
            assert isinstance(failure["description"], str) and failure["description"].strip()
            assert isinstance(failure["critical"], bool)


def test_chat_reply_eval_protocol_requires_real_context_isolation():
    protocol = EVAL_PATH.read_text(encoding="utf-8")

    assert "fork_context=false" in protocol
    assert "Baseline Agent" in protocol
    assert "Skill Agent" in protocol
    assert "Judge Agent" in protocol
    assert "显式加载" in protocol
    assert "Baseline Agent 和 Judge Agent 是唯一例外" in protocol
    assert "主 Agent 只负责调度、匿名化和汇总结果" in protocol
    assert "critical failure" in protocol
    assert "不超过 **2**" in protocol
