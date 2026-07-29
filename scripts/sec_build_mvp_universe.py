import csv
from pathlib import Path

from backend.app.sec.client import SecOpenDataClient
from backend.app.sec.endpoints import FUND_PROFILES
from backend.app.sec.normalizers import normalize_fund_class_record, records

SEARCH_TERMS = ["SET", "ตราสารทุน", "หุ้น", "ตลาดเงิน", "พันธบัตร"]
MAX_FUNDS = 12
PREFERRED_PROJ_IDS = [
    "M0209_2548",
    "M0155_2547",
    "M0005_2565",
    "M0056_2564",
    "M0187_2563",
    "M0089_2545",
    "M0776_2547",
    "M0359_2552",
    "M0430_2556",
    "M0337_2550",
    "M0084_2545",
    "M0306_2552",
]


def main():
    client = SecOpenDataClient()
    candidates = []
    seen = set()
    for term in SEARCH_TERMS:
        payload = client.get(FUND_PROFILES, {"project_info": term, "page_size": 100})
        for record in records(payload):
            if record.get("cancel_date"):
                continue
            if record.get("fund_status") and record["fund_status"] != "Registered":
                continue
            row = normalize_fund_class_record(record)
            combined_name = f'{row["display_name"]} {row["fund_class_name"]}'.upper()
            if "PVD" in combined_name:
                continue
            key = f'{row["proj_id"]}:{row["fund_class_name"]}'
            if key in seen:
                continue
            seen.add(key)
            candidates.append(
                {
                    "proj_id": row["proj_id"],
                    "unique_id": row["unique_id"],
                    "fund_class_name": row["fund_class_name"],
                    "class_abbr_name": row["class_abbr_name"],
                    "display_name": row["display_name"],
                    "search_term": term,
                    "amc_name_th": row["amc_name_th"],
                    "amc_name_en": row["amc_name_en"],
                    "policy_desc": row["policy_desc"],
                }
            )

    rows = []
    used_proj_ids = set()
    for preferred in PREFERRED_PROJ_IDS:
        match = next((row for row in candidates if row["proj_id"] == preferred and row["proj_id"] not in used_proj_ids), None)
        if match:
            rows.append(match)
            used_proj_ids.add(match["proj_id"])
        if len(rows) >= MAX_FUNDS:
            break
    for row in candidates:
        if len(rows) >= MAX_FUNDS:
            break
        if row["proj_id"] in used_proj_ids:
            continue
        rows.append(row)
        used_proj_ids.add(row["proj_id"])
    if not rows:
        raise SystemExit("SEC search returned no normalized fund rows. Revisit Task 2 contract capture and field mapping.")
    out = Path("data/sec/mvp_fund_universe.csv")
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "proj_id",
                "unique_id",
                "fund_class_name",
                "class_abbr_name",
                "display_name",
                "search_term",
                "amc_name_th",
                "amc_name_en",
                "policy_desc",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)
    print({"fund_count": len(rows), "path": str(out)})


if __name__ == "__main__":
    main()
