import hashlib
import json

import pytest

from backend.app.reports import artifacts


def test_load_run_artifacts_rejects_a_path_escape(tmp_path):
    with pytest.raises(FileNotFoundError):
        artifacts.load_run_artifacts("../outside", tmp_path)


def test_report_uses_the_saved_manifest_snapshot_and_canonical_filename(tmp_path, monkeypatch):
    run_dir = tmp_path / "run_saved"
    run_dir.mkdir()
    (run_dir / "request.json").write_text(
        json.dumps(
            {
                "assets": [{"proj_id": "FUND_A", "weight": 100}],
                "data": {"frequency": "daily"},
            }
        ),
        encoding="utf-8",
    )
    (run_dir / "result.json").write_text(json.dumps({"run_id": "run_saved", "summary": {}}), encoding="utf-8")
    (run_dir / "sec_data_manifest.json").write_text(
        json.dumps({"source": "SEC Open Data", "snapshot": "saved"}),
        encoding="utf-8",
    )
    current_manifest = tmp_path / "current-manifest.json"
    current_manifest.write_text(json.dumps({"source": "SEC Open Data", "snapshot": "current"}), encoding="utf-8")
    monkeypatch.setattr(artifacts, "SEC_MANIFEST_PATH", current_manifest)

    output = artifacts.write_research_report("run_saved", tmp_path)

    assert output.name == "cqf_report.md"
    report = output.read_text(encoding="utf-8")
    assert "saved" in report
    assert "current" not in report
    assert "Daily SEC NAV observations" in report


def test_run_environment_snapshot_records_dependency_and_lockfile_fingerprints(tmp_path):
    artifacts.write_run_snapshots(tmp_path, {"source": "SEC Open Data"})

    snapshot = json.loads((tmp_path / "environment.json").read_text(encoding="utf-8"))

    assert snapshot["python_version"]
    assert snapshot["dependencies"]["pandas"]
    lockfile = artifacts.PROJECT_ROOT / "frontend/package-lock.json"
    expected_hash = hashlib.sha256(lockfile.read_bytes()).hexdigest()
    assert snapshot["lockfiles"]["frontend/package-lock.json"] == expected_hash
