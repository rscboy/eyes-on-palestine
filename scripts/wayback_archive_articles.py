#!/usr/bin/env python3
"""Archive article source URLs with the Internet Archive Save Page Now API.

Credentials are read from environment variables. Do not commit Archive.org keys.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SAVE_ENDPOINT = "https://web.archive.org/save/"
STATUS_ENDPOINT = "https://web.archive.org/save/status/{job_id}"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def article_id(article: dict[str, Any]) -> str:
    seed = article.get("link") or f"{article.get('source', '')}:{article.get('title', '')}:{article.get('date', '')}"
    return hashlib.sha256(str(seed).encode("utf-8")).hexdigest()[:16]


def load_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def archive_url_from_payload(url: str, headers: dict[str, str], payload: dict[str, Any]) -> str:
    for header_name in ("Content-Location", "Location"):
        location = headers.get(header_name) or headers.get(header_name.lower())
        if location:
            return urllib.parse.urljoin("https://web.archive.org", location)

    timestamp = payload.get("timestamp") or payload.get("timestamp_url")
    original_url = payload.get("original_url") or payload.get("url") or url
    if timestamp and str(timestamp).isdigit():
        return f"https://web.archive.org/web/{timestamp}/{original_url}"

    web_url = payload.get("web_url") or payload.get("wayback_url") or payload.get("archive_url")
    return str(web_url or "")


def request_json(
    url: str,
    *,
    data: dict[str, str] | None,
    access_key: str,
    secret_key: str,
    timeout: int,
) -> tuple[int, dict[str, str], dict[str, Any], str]:
    encoded_data = urllib.parse.urlencode(data).encode("utf-8") if data is not None else None
    headers = {
        "Accept": "application/json",
        "User-Agent": "EchoesOfGazaWaybackArchiver/1.0",
    }
    if access_key and secret_key:
        headers["Authorization"] = f"LOW {access_key}:{secret_key}"

    request = urllib.request.Request(url, data=encoded_data, headers=headers, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            text = response.read().decode("utf-8", errors="replace")
            response_headers = dict(response.headers.items())
            try:
                payload = json.loads(text) if text.strip() else {}
            except json.JSONDecodeError:
                payload = {"raw": text[:1000]}
            return response.status, response_headers, payload, text
    except urllib.error.HTTPError as error:
        text = error.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(text) if text.strip() else {}
        except json.JSONDecodeError:
            payload = {"raw": text[:1000]}
        return error.code, dict(error.headers.items()), payload, text


def save_page_now(
    url: str,
    *,
    access_key: str,
    secret_key: str,
    capture_outlinks: bool,
    capture_screenshot: bool,
    timeout: int,
) -> dict[str, Any]:
    form = {
        "url": url,
        "capture_all": "1",
        "if_not_archived_within": "1d",
    }
    if capture_outlinks:
        form["capture_outlinks"] = "1"
    if capture_screenshot:
        form["capture_screenshot"] = "1"

    status_code, headers, payload, raw_text = request_json(
        SAVE_ENDPOINT,
        data=form,
        access_key=access_key,
        secret_key=secret_key,
        timeout=timeout,
    )
    archive_url = archive_url_from_payload(url, headers, payload)
    ok = 200 <= status_code < 300
    job_id = payload.get("job_id") or payload.get("jobId")

    return {
        "ok": ok,
        "status_code": status_code,
        "job_id": str(job_id or ""),
        "archive_url": archive_url,
        "response": payload,
        "raw_response": raw_text[:1000],
    }


def poll_status(
    job_id: str,
    original_url: str,
    *,
    access_key: str,
    secret_key: str,
    timeout: int,
) -> dict[str, Any] | None:
    if not job_id:
        return None
    status_code, headers, payload, raw_text = request_json(
        STATUS_ENDPOINT.format(job_id=urllib.parse.quote(job_id)),
        data=None,
        access_key=access_key,
        secret_key=secret_key,
        timeout=timeout,
    )
    archive_url = archive_url_from_payload(original_url, headers, payload)
    return {
        "status_code": status_code,
        "job_id": job_id,
        "archive_url": archive_url,
        "response": payload,
        "raw_response": raw_text[:1000],
    }


def existing_record_for(records: dict[str, Any], aid: str, url: str) -> dict[str, Any]:
    record = records.get(aid)
    if record and record.get("url") == url:
        return record
    return {}


def should_archive(record: dict[str, Any], *, force: bool) -> bool:
    if force:
        return True
    return record.get("status") not in {"archived", "submitted"}


def summarize(records: dict[str, Any], total_articles: int) -> dict[str, int]:
    summary = {
        "total_articles": total_articles,
        "archived": 0,
        "submitted": 0,
        "failed": 0,
        "pending": 0,
    }
    for record in records.values():
        status = record.get("status") or "pending"
        summary[status] = summary.get(status, 0) + 1
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Archive Echoes of Gaza article URLs with Save Page Now.")
    parser.add_argument("--articles", default="data/articles.json")
    parser.add_argument("--status", default="data/wayback/archive_status.json")
    parser.add_argument("--batch-size", type=int, default=6)
    parser.add_argument("--sleep-seconds", type=int, default=65)
    parser.add_argument("--limit", type=int, default=0, help="Maximum URLs to submit in this run. 0 means no cap.")
    parser.add_argument("--force", action="store_true", help="Resubmit URLs even if already archived/submitted.")
    parser.add_argument("--capture-outlinks", action="store_true")
    parser.add_argument("--capture-screenshot", action="store_true")
    parser.add_argument("--allow-anonymous", action="store_true", help="Allow unauthenticated Save Page Now requests.")
    parser.add_argument("--timeout", type=int, default=60)
    args = parser.parse_args()

    if args.batch_size < 1 or args.batch_size > 6:
        raise SystemExit("--batch-size must be between 1 and 6 for authenticated Save Page Now limits.")
    if args.sleep_seconds < 65:
        raise SystemExit("--sleep-seconds must be at least 65 to respect the 6 captures/minute limit.")

    access_key = os.environ.get("IA_S3_ACCESS_KEY", "").strip()
    secret_key = os.environ.get("IA_S3_SECRET_KEY", "").strip()
    if not args.allow_anonymous and (not access_key or not secret_key):
        raise SystemExit("Missing IA_S3_ACCESS_KEY or IA_S3_SECRET_KEY. Store them as GitHub Secrets, not in code.")

    articles = load_json(Path(args.articles), [])
    if not isinstance(articles, list):
        raise SystemExit("data/articles.json must be a JSON array.")

    status_path = Path(args.status)
    state = load_json(status_path, {})
    records: dict[str, Any] = dict(state.get("records") or {})

    candidates: list[tuple[str, dict[str, Any]]] = []
    for article in articles:
        url = str(article.get("link") or "").strip()
        if not url.startswith(("http://", "https://")):
            continue
        aid = article_id(article)
        record = existing_record_for(records, aid, url)
        if should_archive(record, force=args.force):
            candidates.append((aid, article))

    if args.limit > 0:
        candidates = candidates[: args.limit]

    started_at = utc_now()
    attempted = 0
    succeeded = 0
    failed = 0
    skipped = max(0, len(articles) - len(candidates))

    for index, (aid, article) in enumerate(candidates):
        batch_started = time.monotonic() if index % args.batch_size == 0 else None
        url = str(article.get("link") or "").strip()
        now = utc_now()
        base_record = {
            "article_id": aid,
            "title": article.get("title", ""),
            "source": article.get("source", ""),
            "date": article.get("date", ""),
            "url": url,
            "last_attempted_at": now,
            "attempts": int(records.get(aid, {}).get("attempts") or 0) + 1,
        }

        try:
            result = save_page_now(
                url,
                access_key=access_key,
                secret_key=secret_key,
                capture_outlinks=args.capture_outlinks,
                capture_screenshot=args.capture_screenshot,
                timeout=args.timeout,
            )
            attempted += 1
            status = "archived" if result["archive_url"] else "submitted"
            if not result["ok"]:
                status = "failed"
            record = {
                **base_record,
                "status": status,
                "http_status": result["status_code"],
                "job_id": result["job_id"],
                "archive_url": result["archive_url"],
                "archived_at": now if status == "archived" else records.get(aid, {}).get("archived_at"),
                "submitted_at": now if status == "submitted" else records.get(aid, {}).get("submitted_at"),
                "error": "" if result["ok"] else result["raw_response"],
                "last_response": result["response"],
            }
            if result["job_id"] and not result["archive_url"]:
                poll = poll_status(
                    result["job_id"],
                    url,
                    access_key=access_key,
                    secret_key=secret_key,
                    timeout=args.timeout,
                )
                if poll and poll.get("archive_url"):
                    record["status"] = "archived"
                    record["archive_url"] = poll["archive_url"]
                    record["archived_at"] = utc_now()
                    record["last_response"] = poll["response"]
            records[aid] = record
            if record["status"] in {"archived", "submitted"}:
                succeeded += 1
            else:
                failed += 1
            print(f"[{attempted}] {record['status']}: {url}")
        except Exception as error:  # noqa: BLE001 - archive failures should not stop the whole backlog.
            failed += 1
            records[aid] = {
                **base_record,
                "status": "failed",
                "http_status": None,
                "job_id": "",
                "archive_url": records.get(aid, {}).get("archive_url", ""),
                "archived_at": records.get(aid, {}).get("archived_at"),
                "error": str(error),
            }
            print(f"[error] {url}: {error}")

        end_of_batch = (index + 1) % args.batch_size == 0 and index + 1 < len(candidates)
        if end_of_batch and batch_started is not None:
            elapsed = time.monotonic() - batch_started
            remaining = max(0, args.sleep_seconds - elapsed)
            print(f"Rate limit pause: sleeping {remaining:.1f}s before next batch.")
            time.sleep(remaining)

    generated_at = utc_now()
    summary = summarize(records, len(articles))
    state = {
        "generated_at": generated_at,
        "last_run": {
            "started_at": started_at,
            "finished_at": generated_at,
            "attempted": attempted,
            "succeeded_or_submitted": succeeded,
            "failed": failed,
            "skipped_existing": skipped,
            "batch_size": args.batch_size,
            "sleep_seconds": args.sleep_seconds,
            "force": args.force,
            "capture_outlinks": args.capture_outlinks,
            "capture_screenshot": args.capture_screenshot,
        },
        "summary": summary,
        "records": dict(sorted(records.items(), key=lambda item: item[1].get("last_attempted_at") or "")),
    }
    write_json(status_path, state)
    print(json.dumps(state["last_run"], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
