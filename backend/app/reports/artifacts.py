from __future__ import annotations

import hashlib
import json
import platform
import sys
from importlib import metadata
from pathlib import Path
from typing import Any

from backend.app.reports.markdown import render_research_report

RUNS_DIR = Path("data/runs")
SEC_MANIFEST_PATH = Path("data/sec/normalized/sec_data_manifest.json")
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEPENDENCY_NAMES = (
    "fastapi",
    "httpx",
    "numpy",
    "pandas",
    "pydantic",
    "pyarrow",
    "scipy",
    "slowapi",
    "uvicorn",
)
LOCKFILE_PATHS = ("frontend/package-lock.json",)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_sec_manifest(path: Path | None = None) -> dict[str, Any]:
    path = path or SEC_MANIFEST_PATH
    if not path.exists():
        return {"source": "SEC Open Data", "manifest_status": "missing", "path": str(path)}
    manifest = load_json(path)
    manifest.setdefault("source", "SEC Open Data")
    return manifest


def load_run_artifacts(run_id: str, runs_dir: Path = RUNS_DIR) -> dict[str, Any]:
    run_dir = safe_run_dir(run_id, runs_dir)
    if not run_dir.exists():
        raise FileNotFoundError(f"Run directory not found: {run_dir}")
    manifest_path = run_dir / "sec_data_manifest.json"
    return {
        "run_dir": run_dir,
        "request": load_json(run_dir / "request.json"),
        "result": load_json(run_dir / "result.json"),
        "manifest": load_sec_manifest(manifest_path) if manifest_path.exists() else load_sec_manifest(),
    }


def write_research_report(run_id: str, runs_dir: Path = RUNS_DIR) -> Path:
    artifacts = load_run_artifacts(run_id, runs_dir)
    report = render_research_report(
        request=artifacts["request"],
        result=artifacts["result"],
        manifest=artifacts["manifest"],
        quality_issues=artifacts["result"].get("quality_issues", []),
    )
    output = artifacts["run_dir"] / "cqf_report.md"
    output.write_text(report, encoding="utf-8")
    return output


def safe_run_dir(run_id: str, runs_dir: Path = RUNS_DIR) -> Path:
    """Resolve one persisted run below ``runs_dir`` and reject traversal."""
    if not run_id or Path(run_id).name != run_id or run_id in {".", ".."}:
        raise FileNotFoundError(f"Run directory not found: {run_id}")
    base_dir = runs_dir.resolve()
    run_dir = (base_dir / run_id).resolve()
    if run_dir.parent != base_dir:
        raise FileNotFoundError(f"Run directory not found: {run_id}")
    return run_dir


def write_run_snapshots(run_dir: Path, manifest: dict[str, Any]) -> None:
    """Persist the immutable inputs needed to explain a historical run."""
    (run_dir / "sec_data_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    (run_dir / "environment.json").write_text(
        json.dumps(
            {
                "python_version": sys.version,
                "python_implementation": platform.python_implementation(),
                "platform": platform.platform(),
                "package_version": "0.1.0",
                "dependencies": dependency_versions(),
                "lockfiles": lockfile_hashes(),
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


def dependency_versions() -> dict[str, str]:
    versions: dict[str, str] = {}
    for name in DEPENDENCY_NAMES:
        try:
            versions[name] = metadata.version(name)
        except metadata.PackageNotFoundError:
            versions[name] = "UNKNOWN"
    return versions


def lockfile_hashes() -> dict[str, str]:
    hashes: dict[str, str] = {}
    for relative_path in LOCKFILE_PATHS:
        path = PROJECT_ROOT / relative_path
        if path.is_file():
            hashes[relative_path] = hashlib.sha256(path.read_bytes()).hexdigest()
    return hashes
