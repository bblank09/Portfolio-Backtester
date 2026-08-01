import subprocess
from pathlib import Path

import yaml

WORKFLOW_PATH = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "backup.yml"


def _load_workflow() -> dict:
    return yaml.safe_load(WORKFLOW_PATH.read_text(encoding="utf-8"))


def _all_run_steps(workflow: dict) -> str:
    return " ".join(
        step["run"]
        for job in workflow["jobs"].values()
        for step in job["steps"]
        if "run" in step
    )


def test_backup_workflow_exists_and_is_valid_yaml():
    assert WORKFLOW_PATH.is_file()
    workflow = _load_workflow()
    assert workflow["jobs"]


def test_backup_workflow_runs_nightly_and_can_be_triggered_manually():
    workflow = _load_workflow()
    triggers = workflow[True]  # bare `on:` key parses as boolean True
    assert triggers["schedule"][0]["cron"] == "0 18 * * *"
    assert "workflow_dispatch" in triggers


def test_backup_workflow_checks_out_the_backup_data_branch():
    workflow = _load_workflow()
    checkout_steps = [
        step
        for job in workflow["jobs"].values()
        for step in job["steps"]
        if step.get("uses", "").startswith("actions/checkout")
    ]
    assert any(step.get("with", {}).get("ref") == "backup-data" for step in checkout_steps)


def test_backup_workflow_calls_the_export_endpoint_and_pushes_the_result():
    workflow = _load_workflow()
    steps = _all_run_steps(workflow)
    assert "export-runs" in steps
    assert "git push origin backup-data" in steps


def test_backup_workflow_fails_loudly_if_required_secrets_are_missing():
    workflow = _load_workflow()
    steps = _all_run_steps(workflow)
    assert "secrets.APP_URL" in steps or "APP_URL" in steps
    assert "secrets.BACKUP_TOKEN" in steps or "BACKUP_TOKEN" in steps
    assert "exit 1" in steps


def test_backup_data_branch_exists_locally_as_an_orphan():
    # The workflow can't push anywhere until this branch already exists.
    result = subprocess.run(
        ["git", "branch", "--list", "backup-data"],
        cwd=Path(__file__).resolve().parents[2],
        capture_output=True,
        text=True,
        check=True,
    )
    assert "backup-data" in result.stdout
