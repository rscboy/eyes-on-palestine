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
    "confirmed_live",
    "confirmed_removed",
    "confirmed_changed",
    "likely_removed",
    "changed_substantially",
    "blocked_unknown",
    "needs_manual_review",
}
SCREENSHOT_ACTIONS = {
    "delete_after_review",
    "keep_as_evidence",
    "no_screenshot",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_latest_result(latest_path: Path, article_id: str) -> dict | None:
    if not latest_path.exists():
        return None
    payload = json.loads(latest_path.read_text(encoding="utf-8"))
    for result in payload.get("results", []):
        if str(result.get("id")) == str(article_id) or str(result.get("article_id")) == str(article_id):
            return result
    return None


def handle_reviewed_screenshot(latest_result: dict | None, screenshot_action: str) -> tuple[bool, bool, str | None]:
    if screenshot_action == "no_screenshot":
        return False, False, None

    screenshot_path = None
    if latest_result:
        signals = latest_result.get("signals", {})
        screenshot_path = latest_result.get("screenshot_path") or signals.get("screenshot_path") or signals.get("screenshot")

    if not screenshot_path:
        return False, False, None

    path = Path(screenshot_path)
    if path.is_absolute() or ".." in path.parts or path.suffix.lower() != ".png":
        return True, False, f"Skipped unsafe screenshot path: {screenshot_path}"

    reviewed = True
    keep = screenshot_action == "keep_as_evidence"

    if screenshot_action == "delete_after_review" and path.exists():
        path.unlink()
        return reviewed, keep, f"Deleted reviewed screenshot: {screenshot_path}"

    if screenshot_action == "delete_after_review":
        return reviewed, keep, f"Screenshot already absent: {screenshot_path}"

    return reviewed, keep, f"Kept reviewed screenshot: {screenshot_path}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply a manual integrity override.")
    parser.add_argument("--id", required=True, help="Article integrity id.")
    parser.add_argument("--status", required=True, choices=sorted(ALLOWED_STATUSES))
    parser.add_argument("--verified-by", required=True)
    parser.add_argument("--notes", default="")
    parser.add_argument("--path", default="data/integrity/manual_overrides.json")
    parser.add_argument("--latest", default="data/integrity/latest.json")
    parser.add_argument("--screenshot-action", default="delete_after_review", choices=sorted(SCREENSHOT_ACTIONS))
    args = parser.parse_args()

    path = Path(args.path)
    latest_result = load_latest_result(Path(args.latest), args.id)
    screenshot_reviewed, screenshot_keep, screenshot_note = handle_reviewed_screenshot(latest_result, args.screenshot_action)

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
        "screenshot_reviewed": screenshot_reviewed,
        "screenshot_keep": screenshot_keep,
        "screenshot_action": args.screenshot_action,
    }
    if screenshot_note:
        payload["overrides"][args.id]["screenshot_note"] = screenshot_note

    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Applied override for {args.id}: {args.status}")
    if screenshot_note:
        print(screenshot_note)


if __name__ == "__main__":
    main()
