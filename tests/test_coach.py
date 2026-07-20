import json
import pytest
import sys
from datetime import date
from pathlib import Path

# We import the module and override DATA_DIR before running tests
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import coach


@pytest.fixture
def tmp_data_dir(tmp_path):
    """Redirect data dir to a temp directory."""
    coach.DATA_DIR = tmp_path / "contacts"
    return coach.DATA_DIR


def test_add_contact(tmp_data_dir):
    coach.cmd_add("张三")
    p = tmp_data_dir / "张三.json"
    assert p.exists()
    d = json.loads(p.read_text())
    assert d["name"] == "张三"
    assert d["tags"] == []
    assert d["remind_interval_days"] == 7


def test_add_duplicate(tmp_data_dir):
    coach.cmd_add("李四")
    with pytest.raises(SystemExit):
        coach.cmd_add("李四")


def test_tag(tmp_data_dir):
    coach.cmd_add("王五")
    coach.cmd_tag("王五", "朋友", "同事")
    d = json.loads((tmp_data_dir / "王五.json").read_text())
    assert d["tags"] == ["朋友", "同事"]


def test_goal(tmp_data_dir):
    coach.cmd_add("赵六")
    coach.cmd_goal("赵六", "保持联系", "加深关系")
    d = json.loads((tmp_data_dir / "赵六.json").read_text())
    assert "保持联系 加深关系" in d["goal"]


def test_note(tmp_data_dir):
    coach.cmd_add("钱七")
    coach.cmd_note("钱七", "喜欢喝咖啡")
    d = json.loads((tmp_data_dir / "钱七.json").read_text())
    assert d["notes"] == "喜欢喝咖啡"


def test_remind(tmp_data_dir):
    coach.cmd_add("孙八")
    coach.cmd_remind("孙八", "3")
    d = json.loads((tmp_data_dir / "孙八.json").read_text())
    assert d["remind_interval_days"] == 3


def test_log(tmp_data_dir):
    coach.cmd_add("周九")
    coach.cmd_log("周九", "对方: 你好\\n我: 你好呀")
    d = json.loads((tmp_data_dir / "周九.json").read_text())
    assert len(d["history"]) == 2
    assert d["history"][0]["role"] == "them"
    assert d["history"][1]["role"] == "me"
    assert d["last_contact"] == str(date.today())


def test_log_default_role(tmp_data_dir):
    coach.cmd_add("吴十")
    coach.cmd_log("吴十", "随便说点什么")
    d = json.loads((tmp_data_dir / "吴十.json").read_text())
    assert len(d["history"]) == 1
    assert d["history"][0]["role"] == "them"


def test_info(tmp_data_dir, capsys):
    coach.cmd_add("小明")
    coach.cmd_info("小明")
    captured = capsys.readouterr().out
    assert "小明" in captured


def test_list_empty(tmp_data_dir, capsys):
    coach.cmd_list()
    captured = capsys.readouterr().out
    assert "暂无联系人" in captured


def test_list_with_contacts(tmp_data_dir, capsys):
    coach.cmd_add("张三")
    coach.cmd_list()
    captured = capsys.readouterr().out
    assert "张三" in captured


def test_history(tmp_data_dir, capsys):
    coach.cmd_add("小红")
    coach.cmd_log("小红", "对方: 在吗\n我: 在的")
    coach.cmd_history("小红")
    captured = capsys.readouterr().out
    assert "在吗" in captured
    assert "在的" in captured


def test_invalid_command():
    assert "bad_command" not in coach.HANDLERS
