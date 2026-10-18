#!/usr/bin/env python3
"""Resolve a chat-reply selection and validate its local rule catalog."""

import argparse
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REFERENCES = ROOT / "references"
KINDS = ("principles", "techniques")


class SelectionError(ValueError):
    pass


class Once(argparse.Action):
    def __call__(self, parser, namespace, values, option_string=None):
        if getattr(namespace, self.dest, None) is not None:
            parser.error(f"{option_string} 不能重复")
        setattr(namespace, self.dest, values)


def _read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SelectionError(f"无法读取规则清单 {path.relative_to(ROOT)}：{exc}") from exc


def _item_docs(directory):
    result = {}
    if not directory.exists():
        return result
    for path in sorted(directory.glob("*.md")):
        lines = path.read_text(encoding="utf-8").splitlines()
        if not lines or not lines[0].startswith("# "):
            raise SelectionError(f"规则文档缺少正式名称：{path.relative_to(ROOT)}")
        name = lines[0][2:].strip()
        if not name or name in result:
            raise SelectionError(f"重复或空的规则名称：{name}")
        result[name] = path.relative_to(ROOT).as_posix()
    return result


def _unique_names(names, label):
    if not isinstance(names, list) or any(not isinstance(name, str) or not name for name in names):
        raise SelectionError(f"{label}必须是名称列表")
    if len(names) != len(set(names)):
        raise SelectionError(f"{label}含重复名称")


def load_catalog():
    items = {kind: {} for kind in KINDS}
    owners = {kind: {} for kind in KINDS}
    shared = {}
    for kind in KINDS:
        shared[kind] = _item_docs(REFERENCES / "shared" / kind)
        items[kind].update(shared[kind])
        owners[kind].update({name: "公共" for name in shared[kind]})

    intents = {}
    for directory in sorted((REFERENCES / "intents").iterdir()):
        if not directory.is_dir():
            continue
        config = _read_json(directory / "intent.json")
        if not isinstance(config, dict):
            raise SelectionError(f"意图清单必须是对象：{directory.name}")
        name = config.get("name")
        if not isinstance(name, str) or not name or name in intents:
            raise SelectionError(f"意图名称无效或重复：{name}")
        if not (directory / "index.md").is_file():
            raise SelectionError(f"缺少意图说明：{name}")
        local = {}
        for kind in KINDS:
            local[kind] = _item_docs(directory / kind)
            for item, path in local[kind].items():
                if item in items[kind]:
                    raise SelectionError(f"重复{kind}名称：{item}")
                items[kind][item] = path
                owners[kind][item] = name
        intents[name] = {
            "config": config,
            "local": local,
            "path": (directory / "index.md").relative_to(ROOT).as_posix(),
        }

    if not intents:
        raise SelectionError("没有定义意图")
    all_names = list(intents)
    for kind in KINDS:
        all_names.extend(items[kind])
    if len(all_names) != len(set(all_names)):
        raise SelectionError("意图、原则或技巧之间存在重名")

    for name, data in intents.items():
        config = data["config"]
        index = (ROOT / data["path"]).read_text(encoding="utf-8")
        expected_local_links = {
            f"{kind}/{Path(path).name}"
            for kind in KINDS
            for path in data["local"][kind].values()
        }
        actual_local_links = set(re.findall(r"\]\(((?:principles|techniques)/[^)]+)\)", index))
        if actual_local_links != expected_local_links:
            raise SelectionError(f"{name}的专属规则链接与目录不一致")
        for kind in KINDS:
            key = "allowed_" + kind
            allowed = config.get(key)
            _unique_names(allowed, f"{name}的{key}")
            for item in allowed:
                if item not in items[kind]:
                    raise SelectionError(f"{name}允许了不存在的项目：{item}")
                if owners[kind][item] not in ("公共", name):
                    raise SelectionError(f"{name}跨意图引用了{item}")
            if not set(data["local"][kind]).issubset(allowed):
                raise SelectionError(f"{name}未列出全部专属{kind}")
            public = [item for item in allowed if owners[kind][item] == "公共"]
            title = "可选公共原则" if kind == "principles" else "可选公共技巧"
            if f"{title}：{'、'.join(public) or '无'}" not in index.splitlines():
                raise SelectionError(f"{name}的公共规则说明与意图清单不一致")
    for kind in KINDS:
        for item in shared[kind]:
            if not any(item in data["config"]["allowed_" + kind] for data in intents.values()):
                raise SelectionError(f"公共项目没有允许使用的意图：{item}")

    presets = {}
    for intent, data in intents.items():
        raw_presets = data["config"].get("presets")
        if not isinstance(raw_presets, list):
            raise SelectionError(f"{intent}的预设必须是列表")
        for preset in raw_presets:
            if not isinstance(preset, dict):
                raise SelectionError(f"{intent}的每项预设必须是对象")
            name = preset.get("name")
            if not isinstance(name, str) or not name or name in presets:
                raise SelectionError(f"预设名称无效或重复：{name}")
            selected_preset = {"name": name, "intent": intent}
            for kind in KINDS:
                selected = preset.get(kind)
                _unique_names(selected, f"预设{name}的{kind}")
                _check_allowed(intent, kind, selected, intents, items)
                selected_preset[kind] = selected
            if not selected_preset["principles"] and not selected_preset["techniques"]:
                raise SelectionError(f"预设{name}至少包含一项原则或技巧")
            presets[name] = selected_preset
    for intent in intents:
        if intent in presets and presets[intent]["intent"] != intent:
            raise SelectionError(f"意图{intent}的同名预设引用了其他意图")
    for name in presets:
        if any(name in items[kind] for kind in KINDS):
            raise SelectionError(f"预设与原则或技巧重名：{name}")

    _check_preset_docs(intents, presets)
    _check_local_links()
    return {"intents": intents, "items": items, "presets": presets}


def _check_allowed(intent, kind, selected, intents, items):
    allowed = intents[intent]["config"]["allowed_" + kind]
    for item in selected:
        label = "原则" if kind == "principles" else "技巧"
        if item not in items[kind]:
            raise SelectionError(f"未知{label}“{item}”")
        if item not in allowed:
            valid = [name for name, data in intents.items() if item in data["config"]["allowed_" + kind]]
            raise SelectionError(
                f"{label}“{item}”不适用于“{intent}”；可用于：{'、'.join(valid)}。"
                "请显式选择对应意图或预设。"
            )


def _check_preset_docs(intents, presets):
    docs = {}
    for intent, data in intents.items():
        directory = (ROOT / data["path"]).parent / "presets"
        paths = sorted(directory.glob("*.md")) if directory.exists() else []
        for path in paths:
            lines = path.read_text(encoding="utf-8").splitlines()
            if not lines or not lines[0].startswith("# "):
                raise SelectionError(f"预设说明缺少正式名称：{path.relative_to(ROOT)}")
            name = lines[0][2:].strip()
            if not name or name in docs:
                raise SelectionError(f"预设说明名称无效或重复：{name}")
            fields = {}
            for kind, label in (("principles", "原则"), ("techniques", "技巧")):
                match = next((line for line in lines if line.startswith(f"- {label}：")), None)
                if match is None:
                    raise SelectionError(f"预设{name}缺少{label}说明")
                value = match.removeprefix(f"- {label}：").strip()
                fields[kind] = re.findall(r"\[([^\]]+)\]\([^)]+\)", value) if value != "无" else []
            owner = next((line.removeprefix("- 意图：").strip() for line in lines if line.startswith("- 意图：")), None)
            if owner != intent:
                raise SelectionError(f"预设{name}的说明与所在意图目录不一致")
            docs[name] = {"intent": owner, **fields}
        expected_links = {f"presets/{path.name}" for path in paths}
        index = (ROOT / data["path"]).read_text(encoding="utf-8")
        actual_links = set(re.findall(r"\]\((presets/[^)]+)\)", index))
        if actual_links != expected_links:
            raise SelectionError(f"{intent}的预设链接与目录不一致")

    expected = {
        name: {"intent": data["intent"], "principles": data["principles"], "techniques": data["techniques"]}
        for name, data in presets.items()
    }
    if docs != expected:
        raise SelectionError("各意图目录中的预设说明与 intent.json 不一致")


def _check_local_links():
    for source in ROOT.rglob("*.md"):
        for target in re.findall(r"(?<!!)\[[^\]]+\]\(([^)]+)\)", source.read_text(encoding="utf-8")):
            if target.startswith(("http:", "https:", "#")):
                continue
            destination = (source.parent / target.split("#", 1)[0]).resolve()
            if not destination.is_relative_to(ROOT) or not destination.exists():
                raise SelectionError(f"无效的 Skill 内部链接：{source.relative_to(ROOT)} -> {target}")


def resolve_selection(catalog, preset=None, intent=None, principles=None, techniques=None):
    principles = [] if principles is None else principles
    techniques = [] if techniques is None else techniques
    _unique_names(principles, "原则参数")
    _unique_names(techniques, "技巧参数")
    presets = catalog["presets"]
    if preset is not None:
        if intent is not None or principles or techniques:
            raise SelectionError("--preset 不能与 --intent、--principle 或 --technique 混用")
        if preset not in presets:
            raise SelectionError(f"未知预设“{preset}”")
        selected = presets[preset]
        selection_type = "preset"
    elif intent is not None:
        if intent not in catalog["intents"]:
            raise SelectionError(f"未知意图“{intent}”")
        if not principles and not techniques and intent in presets:
            selected = presets[intent]
            preset = intent
            selection_type = "preset"
        else:
            selected = {"intent": intent, "principles": principles, "techniques": techniques}
            selection_type = "custom"
    else:
        base = presets["接话"]
        selected = {
            "intent": "接话",
            "principles": list(dict.fromkeys(base["principles"] + principles)),
            "techniques": list(dict.fromkeys(base["techniques"] + techniques)),
        }
        preset = "接话" if not principles and not techniques else None
        selection_type = "preset" if preset else "custom"
    for kind in KINDS:
        _check_allowed(selected["intent"], kind, selected[kind], catalog["intents"], catalog["items"])
    paths = [
        catalog["items"][kind][item]
        for kind in KINDS
        for item in selected[kind]
    ]
    return {
        "selection_type": selection_type,
        "preset": preset if selection_type == "preset" else None,
        "intent": selected["intent"],
        "intent_path": catalog["intents"][selected["intent"]]["path"],
        "principles": selected["principles"],
        "techniques": selected["techniques"],
        "rule_paths": paths,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-catalog", action="store_true")
    parser.add_argument("--preset", action=Once)
    parser.add_argument("--intent", action=Once)
    parser.add_argument("--principle", action="append", default=[])
    parser.add_argument("--technique", action="append", default=[])
    args = parser.parse_args()
    try:
        if args.check_catalog and (args.preset is not None or args.intent is not None or args.principle or args.technique):
            raise SelectionError("--check-catalog 不能与选择参数混用")
        catalog = load_catalog()
        if args.check_catalog:
            print(json.dumps({"ok": True, "intents": len(catalog["intents"]), "presets": len(catalog["presets"])}, ensure_ascii=False))
        else:
            result = resolve_selection(catalog, args.preset, args.intent, args.principle, args.technique)
            print(json.dumps({"ok": True, **result}, ensure_ascii=False))
    except SelectionError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
