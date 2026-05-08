#!/usr/bin/env python3
"""Apply bulk Article Integrity Monitor manual overrides."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ALLOWED_STATUSES = {
    "confirmed_live",
    "confirmed_removed",
    "confirmed_changed",
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


def load_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def result_id(result: dict[str, Any]) -> str:
    return str(result.get("article_id") or result.get("id") or "")


def screenshot_for(result: dict[str, Any]) -> str:
    signals = result.get("signals", {})
    return str(result.get("screenshot_path") or signals.get("screenshot_path") or signals.get("screenshot") or "")


def handle_screenshot(result: dict[str, Any], action: str) -> tuple[bool, bool, str | None]:
    if action == "no_screenshot":
        return False, False, None

    screenshot_path = screenshot_for(result)
    if not screenshot_path:
        return False, False, None

    path = Path(screenshot_path)
    if path.is_absolute() or ".." in path.parts or path.suffix.lower() != ".png":
        return True, False, f"Skipped unsafe screenshot path: {screenshot_path}"

    keep = action == "keep_as_evidence"
    if action == "delete_after_review" and path.exists():
        path.unlink()
        return True, keep, f"Deleted reviewed screenshot: {screenshot_path}"

    if action == "delete_after_review":
        return True, keep, f"Screenshot already absent: {screenshot_path}"

    return True, keep, f"Kept reviewed screenshot: {screenshot_path}"


def validate_payload(payload: dict[str, Any]) -> dict[str, Any]:
    reviewer = str(payload.get("reviewer") or "").strip()
    if not reviewer:
        raise ValueError("reviewer is required")

    notes = str(payload.get("notes") or "").strip()[:500]
    screenshot_action = str(payload.get("screenshot_action") or "delete_after_review").strip()
    if screenshot_action not in SCREENSHOT_ACTIONS:
        raise ValueError(f"Unsupported screenshot_action: {screenshot_action}")

    overrides = payload.get("overrides")
    if not isinstance(overrides, list) or not overrides:
        raise ValueError("overrides must be a non-empty array")
    if len(overrides) > 25:
        raise ValueError("Bulk override payload may include at most 25 overrides")

    normalized = []
    for index, override in enumerate(overrides):
        if not isinstance(override, dict):
            raise ValueError(f"overrides[{index}] must be an object")
        article_id = str(override.get("article_id") or "").strip()
        manual_status = str(override.get("manual_status") or "").strip()
        if not article_id:
            raise ValueError(f"overrides[{index}].article_id is required")
        if manual_status not in ALLOWED_STATUSES:
            raise ValueError(f"Unsupported manual_status for {article_id}: {manual_status}")
        normalized.append({"article_id": article_id, "manual_status": manual_status})

    return {
        "reviewer": reviewer,
        "notes": notes,
        "screenshot_action": screenshot_action,
        "overrides": normalized,
    }


def main() -> None:
    raw_payload = os.environ.get("BULK_OVERRIDE_PAYLOAD", "")
    if not raw_payload:
        raise SystemExit("BULK_OVERRIDE_PAYLOAD is required")

    payload = validate_payload(json.loads(raw_payload))
    latest_path = Path("data/integrity/latest.json")
    overrides_path = Path("data/integrity/manual_overrides.json")

    latest = load_json(latest_path, {"results": []})
    results = latest.get("results", [])
    if not isinstance(results, list):
        raise SystemExit("data/integrity/latest.json must contain a results array")

    result_map = {result_id(result): result for result in results if result_id(result)}
    missing = [override["article_id"] for override in payload["overrides"] if override["article_id"] not in result_map]
    if missing:
        raise SystemExit("Article id not found in latest.json: " + ", ".join(missing))

    manual = load_json(overrides_path, {"updated_at": None, "overrides": {}})
    manual.setdefault("overrides", {})
    verified_at = utc_now()
    screenshot_notes = []

    for override in payload["overrides"]:
        article_id = override["article_id"]
        result = result_map[article_id]
        screenshot_reviewed, screenshot_keep, screenshot_note = handle_screenshot(result, payload["screenshot_action"])
        if screenshot_note:
            screenshot_notes.append(f"{article_id}: {screenshot_note}")

        manual["overrides"][article_id] = {
            "article_id": article_id,
            "manual_status": override["manual_status"],
            "verified_by": payload["reviewer"],
            "verified_at": verified_at,
            "notes": payload["notes"],
            "screenshot_action": payload["screenshot_action"],
            "screenshot_reviewed": screenshot_reviewed,
            "screenshot_keep": screenshot_keep,
        }
        if screenshot_note:
            manual["overrides"][article_id]["screenshot_note"] = screenshot_note

    manual["updated_at"] = verified_at
    overrides_path.parent.mkdir(parents=True, exist_ok=True)
    overrides_path.write_text(json.dumps(manual, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Applied {len(payload['overrides'])} integrity overrides.")
    for note in screenshot_notes:
        print(note)


if __name__ == "__main__":
    main()
