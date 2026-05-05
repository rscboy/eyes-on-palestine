#!/usr/bin/env python3
"""Apply a manual Article Integrity Monitor override."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


ALLOWED_STATUSES = {
    "live",
    "redirected_live",
    "confirmed_removed",
    "likely_removed",
    "changed_substantially",
    "blocked_unknown",
    "needs_manual_review",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply a manual integrity override.")
    parser.add_argument("--id", required=True, help="Article integrity id.")
    parser.add_argument("--status", required=True, choices=sorted(ALLOWED_STATUSES))
    parser.add_argument("--verified-by", required=True)
    parser.add_argument("--notes", default="")
    parser.add_argument("--path", default="data/integrity/manual_overrides.json")
    args = parser.parse_args()

    path = Path(args.path)
    payload = {"updated_at": None, "overrides": {}}
    if path.exists():
        payload = json.loads(path.read_text(encoding="utf-8"))
    payload.setdefault("overrides", {})

    verified_at = utc_now()
    payload["updated_at"] = verified_at
    payload["overrides"][args.id] = {
        "manual_status": args.status,
        "verified_at": verified_at,
        "verified_by": args.verified_by,
        "notes": args.notes,
    }

    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Applied override for {args.id}: {args.status}")


if __name__ == "__main__":
    main()
