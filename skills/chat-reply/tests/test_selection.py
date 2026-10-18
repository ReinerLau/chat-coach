import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "selection.py"
spec = importlib.util.spec_from_file_location("chat_reply_selection", SCRIPT)
selection = importlib.util.module_from_spec(spec)
spec.loader.exec_module(selection)


class SelectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = selection.load_catalog()

    def test_default_and_six_strategies(self):
        self.assertEqual(selection.resolve_selection(self.catalog)["strategy"], "接话")
        self.assertEqual(set(self.catalog["strategies"]), {"接话", "起头", "共情", "轻松共情", "赞美", "邀约"})
        expected = {
            "接话": ("接话", ["先接内容", "事实有据", "尊重边界", "把握分寸", "不评价对方"], []),
            "起头": ("起头", [], []),
            "共情": ("共情", ["非评价式共情", "避免比较转移"], ["行为一致"]),
            "轻松共情": ("共情", ["非评价式共情", "避免比较转移"], ["行为一致", "夸张引申"]),
            "赞美": ("赞美", ["具体赞美"], []),
            "邀约": ("邀约", ["先理解顾虑"], []),
        }
        for name in self.catalog["strategies"]:
            result = selection.resolve_selection(self.catalog, strategy=name)
            self.assertEqual(result["strategy"], name)
            self.assertEqual(
                (result["intent"], result["principles"], result["techniques"]),
                expected[name],
            )
            self.assertTrue(result["intent_path"].endswith("/index.md"))
            self.assertEqual(len(result["rule_paths"]), len(result["principles"]) + len(result["techniques"]))

    def test_intent_only_uses_same_name_strategy(self):
        result = selection.resolve_selection(self.catalog, intent="共情")
        self.assertEqual(result["strategy"], "共情")
        self.assertEqual(result["techniques"], ["行为一致"])

    def test_custom_intent_does_not_expand_strategy(self):
        result = selection.resolve_selection(
            self.catalog, intent="共情", principles=["非评价式共情"], techniques=["夸张引申"]
        )
        self.assertIsNone(result["strategy"])
        self.assertEqual(result["techniques"], ["夸张引申"])
        self.assertEqual(result["principles"], ["非评价式共情"])

    def test_shared_items_follow_intent_allowlist(self):
        result = selection.resolve_selection(
            self.catalog, intent="起头", principles=["事实有据"], techniques=["状态感受切换法", "魔趣法则"]
        )
        self.assertEqual(result["intent"], "起头")
        self.assertEqual(len(result["rule_paths"]), 3)
        with self.assertRaisesRegex(selection.SelectionError, "不适用于“共情”"):
            selection.resolve_selection(self.catalog, intent="共情", techniques=["平衡"])

    def test_only_empathy_technique_does_not_infer_intent(self):
        with self.assertRaisesRegex(selection.SelectionError, "可用于：共情"):
            selection.resolve_selection(self.catalog, techniques=["夸张引申"])
        result = selection.resolve_selection(self.catalog, intent="共情", techniques=["夸张引申"])
        self.assertEqual(result["intent"], "共情")

    def test_strategy_exclusivity_and_duplicate_items(self):
        with self.assertRaisesRegex(selection.SelectionError, "不能与"):
            selection.resolve_selection(self.catalog, strategy="共情", intent="共情")
        with self.assertRaisesRegex(selection.SelectionError, "重复"):
            selection.resolve_selection(self.catalog, techniques=["魔趣法则", "魔趣法则"])
        with self.assertRaisesRegex(selection.SelectionError, "未知策略"):
            selection.resolve_selection(self.catalog, strategy="普通回应")

    def test_catalog_rejects_cross_intent_reference(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            refs = root / "references"
            shutil.copytree(selection.REFERENCES, refs)
            path = refs / "intents" / "reply" / "intent.json"
            config = json.loads(path.read_text())
            config["allowed_techniques"].append("夸张引申")
            path.write_text(json.dumps(config, ensure_ascii=False))
            with patch.object(selection, "ROOT", root), patch.object(selection, "REFERENCES", refs):
                with self.assertRaisesRegex(selection.SelectionError, "跨意图"):
                    selection.load_catalog()

    def test_cli_rejects_duplicate_intent(self):
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--intent", "共情", "--intent", "赞美"],
            capture_output=True, text=True, check=False
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn("--intent 不能重复", result.stderr)


if __name__ == "__main__":
    unittest.main()
