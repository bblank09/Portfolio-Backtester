import json
from pathlib import Path

import pandas as pd

NORMALIZED_DIR = Path("data/sec/normalized")


def write_parquet(name: str, rows: list[dict]) -> Path:
    NORMALIZED_DIR.mkdir(parents=True, exist_ok=True)
    path = NORMALIZED_DIR / f"{name}.parquet"
    pd.DataFrame(rows).to_parquet(path, index=False)
    return path


def write_manifest(manifest: dict) -> Path:
    NORMALIZED_DIR.mkdir(parents=True, exist_ok=True)
    path = NORMALIZED_DIR / "sec_data_manifest.json"
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def load_nav_panel(proj_ids: list[str]) -> pd.DataFrame:
    df = pd.read_parquet(NORMALIZED_DIR / "daily_nav.parquet")
    panel = df[df["proj_id"].isin(proj_ids)].pivot_table(
        index="nav_date",
        columns="proj_id",
        values="nav_per_unit",
        aggfunc="last",
    )
    panel.index = pd.to_datetime(panel.index)
    return panel.sort_index().dropna(how="all")
