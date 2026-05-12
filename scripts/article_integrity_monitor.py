#!/usr/bin/env python3
"""
Article Integrity Monitor for Echoes of Gaza.

This checker is intentionally conservative. It only marks an article as
confirmed_removed when the browser-level navigation clearly returns 404/410.
Blocks, timeouts, bot protection, paywalls, and ambiguous failures become
blocked_unknown or needs_manual_review instead of removal.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

try:
    from playwright.async_api import TimeoutError as PlaywrightTimeoutError
    from playwright.async_api import async_playwright
except ModuleNotFoundError:  # Allows --help and argument validation before dependencies are installed.
    PlaywrightTimeoutError = TimeoutError
    async_playwright = None


SCANNER_VERSION = "1.2.0"
REMOVAL_PATTERNS = [
    "404",
    "410",
    "page not found",
    "not found",
    "content unavailable",
    "this content is unavailable",
    "this page is no longer available",
    "article not found",
    "story not found",
    "the page you requested could not be found",
    "we couldn't find that page",
    "this article is no longer available",
]
BLOCK_PATTERNS = [
    "access denied",
    "are you a robot",
    "captcha",
    "cloudflare",
    "enable javascript",
    "unusual traffic",
    "temporarily unavailable",
    "forbidden",
    "subscribe to continue",
    "sign in to continue",
    "region",
    "not available in your region",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def article_id(article: dict[str, Any]) -> str:
    seed = article.get("link") or f"{article.get('source', '')}:{article.get('title', '')}:{article.get('date', '')}"
    return hashlib.sha256(str(seed).encode("utf-8")).hexdigest()[:16]


def normalize_text(value: str) -> str:
    value = re.sub(r"\s+", " ", value or "").strip().lower()
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def similarity(expected_title: str, expected_summary: str, page_title: str, visible_text: str) -> float:
    expected = normalize_text(f"{expected_title} {expected_summary}")
    observed = normalize_text(f"{page_title} {visible_text[:8000]}")
    if not expected or not observed:
        return 0.0

    title_ratio = SequenceMatcher(None, normalize_text(expected_title), normalize_text(page_title)).ratio()
    expected_tokens = set(expected.split())
    observed_tokens = set(observed.split())
    token_overlap = len(expected_tokens & observed_tokens) / max(1, len(expected_tokens))
    return round((title_ratio * 0.45) + (token_overlap * 0.55), 4)


def find_patterns(text: str, patterns: list[str]) -> list[str]:
    normalized = normalize_text(text)
    return [pattern for pattern in patterns if pattern in normalized]


def classify(
    status_code: int | None,
    redirected: bool,
    removal_indicators: list[str],
    block_indicators: list[str],
    similarity_score: float,
    error: str | None,
) -> tuple[str, str]:
    if status_code in (404, 410):
        return "confirmed_removed", f"Browser navigation returned HTTP {status_code}."

    if status_code in (401, 403, 429) or block_indicators:
        return "blocked_unknown", "The page appears blocked, access-controlled, rate-limited, or region/paywall restricted."

    if error:
        return "needs_manual_review", f"The automated browser check could not confidently verify the page: {error}"

    if removal_indicators and status_code and 200 <= status_code < 400:
        return "likely_removed", "The page loaded but contains removal or soft-404 language."

    if status_code and 500 <= status_code < 600:
        return "needs_manual_review", f"The origin returned HTTP {status_code}, which may be temporary."

    if status_code and 300 <= status_code < 400:
        return "needs_manual_review", f"The browser did not fully resolve redirect status HTTP {status_code}."

    if status_code and 200 <= status_code < 300:
        if similarity_score < 0.08:
            return "changed_substantially", "The page loaded, but extracted content has very low similarity to the archived title and summary."
        if redirected:
            return "redirected_live", "The page loaded after redirecting to a different URL."
        return "live", "The page loaded and remains broadly consistent with archived metadata."

    return "needs_manual_review", "The automated check did not collect enough evidence for a confident status."


@dataclass
class CheckConfig:
    articles_path: Path
    output_path: Path
    history_path: Path
    screenshot_dir: Path
    limit: int | None
    offset: int
    timeout_ms: int
    screenshots: bool
    review_interval_days: int
    max_due: int
    force: bool


async def check_article(context: Any, article: dict[str, Any], config: CheckConfig, scan_run_id: str) -> dict[str, Any]:
    checked_at = utc_now()
    aid = article_id(article)
    original_url = article.get("link", "")
    page = await context.new_page()
    status_code = None
    final_url = original_url
    page_title = ""
    visible_text = ""
    error = None
    screenshot_path = None

    try:
        response = await page.goto(original_url, wait_until="domcontentloaded", timeout=config.timeout_ms)
        if response:
            status_code = response.status
        try:
            await page.wait_for_load_state("networkidle", timeout=min(config.timeout_ms, 10000))
        except PlaywrightTimeoutError:
            pass
        final_url = page.url
        page_title = await page.title()
        visible_text = await page.locator("body").inner_text(timeout=5000)
    except Exception as exc:  # noqa: BLE001
        error = f"{type(exc).__name__}: {exc}"
        final_url = page.url or original_url
        try:
            page_title = await page.title()
            visible_text = await page.locator("body").inner_text(timeout=2500)
        except Exception:  # noqa: BLE001
            pass

    redirect_chain_changed = bool(final_url and original_url and final_url.rstrip("/") != original_url.rstrip("/"))
    combined_text = f"{page_title}\n{visible_text}"
    removal_indicators = find_patterns(combined_text, REMOVAL_PATTERNS)
    block_indicators = find_patterns(combined_text, BLOCK_PATTERNS)
    similarity_score = similarity(article.get("title", ""), article.get("summary", ""), page_title, visible_text)
    status, observed_issue = classify(
        status_code,
        redirect_chain_changed,
        removal_indicators,
        block_indicators,
        similarity_score,
        error,
    )

    if config.screenshots and status not in {"live", "redirected_live"}:
        config.screenshot_dir.mkdir(parents=True, exist_ok=True)
        screenshot_stamp = checked_at.replace(":", "").replace("-", "")
        screenshot_file = config.screenshot_dir / f"{aid}__{screenshot_stamp}.png"
        try:
            await page.screenshot(path=str(screenshot_file), full_page=True)
            screenshot_path = str(screenshot_file).replace("\\", "/")
        except Exception:  # noqa: BLE001
            screenshot_path = None

    await page.close()

    return {
        "id": aid,
        "article_id": aid,
        "status": status,
        "effective_status": status,
        "checked_at": checked_at,
        "last_checked": checked_at,
        "last_scan_run_id": scan_run_id,
        "checked_this_run": True,
        "observed_issue": observed_issue,
        "screenshot_path": screenshot_path,
        "screenshot_reviewed": False if screenshot_path else None,
        "screenshot_keep": False if screenshot_path else None,
        "original": {
            "title": article.get("title", ""),
            "date": article.get("date", ""),
            "source": article.get("source", ""),
            "summary": article.get("summary", ""),
            "url": original_url,
        },
        "signals": {
            "status_code": status_code,
            "final_url": final_url,
            "redirected": redirect_chain_changed,
            "page_title": page_title,
            "similarity_score": similarity_score,
            "removal_indicators": removal_indicators,
            "block_indicators": block_indicators,
            "error": error,
            "text_snippet": re.sub(r"\s+", " ", visible_text).strip()[:900],
            "screenshot": screenshot_path,
            "screenshot_path": screenshot_path,
        },
    }


def summarize(results: list[dict[str, Any]]) -> dict[str, int]:
    statuses = [
        "unchecked",
        "live",
        "redirected_live",
        "confirmed_removed",
        "likely_removed",
        "changed_substantially",
        "blocked_unknown",
        "needs_manual_review",
        "confirmed_live",
        "confirmed_changed",
    ]
    summary = {"total": len(results), **{status: 0 for status in statuses}}
    for result in results:
        status = result.get("effective_status") or result.get("status") or "unchecked"
        summary[status] = summary.get(status, 0) + 1
    return summary


def flagged_results(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    flagged_statuses = {
        "likely_removed",
        "blocked_unknown",
        "needs_manual_review",
        "changed_substantially",
        "confirmed_removed",
    }
    flagged = []
    for result in results:
        status = result.get("effective_status") or result.get("status")
        if not result.get("last_checked") and not result.get("checked_at"):
            continue
        if status in flagged_statuses:
            flagged.append(result)
    return flagged


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def load_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def manual_overrides_path(output_path: Path) -> Path:
    return output_path.parent / "manual_overrides.json"


def apply_manual_override(result: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
    aid = str(result.get("article_id") or result.get("id") or "")
    override = overrides.get(aid)
    if not override:
        result["effective_status"] = result.get("status", "needs_manual_review")
        return result
    result["manual_override"] = override
    result["effective_status"] = override.get("manual_status") or result.get("status", "needs_manual_review")
    return result


def article_stub(article: dict[str, Any]) -> dict[str, Any]:
    aid = article_id(article)
    return {
        "id": aid,
        "article_id": aid,
        "status": "unchecked",
        "effective_status": "unchecked",
        "checked_at": None,
        "last_checked": None,
        "last_scan_run_id": None,
        "checked_this_run": False,
        "observed_issue": "This article has not been checked by the integrity monitor yet.",
        "screenshot_path": None,
        "screenshot_reviewed": None,
        "screenshot_keep": None,
        "original": {
            "title": article.get("title", ""),
            "date": article.get("date", ""),
            "source": article.get("source", ""),
            "summary": article.get("summary", ""),
            "url": article.get("link", ""),
        },
        "signals": {
            "status_code": None,
            "final_url": article.get("link", ""),
            "redirected": False,
            "page_title": "",
            "similarity_score": None,
            "removal_indicators": [],
            "block_indicators": [],
            "error": None,
            "text_snippet": "",
            "screenshot": None,
            "screenshot_path": None,
        },
    }


def select_articles(
    articles: list[dict[str, Any]],
    previous_results: dict[str, dict[str, Any]],
    config: CheckConfig,
    now: datetime,
) -> tuple[list[dict[str, Any]], int, int]:
    if config.force:
        selected = articles
        if config.offset:
            selected = selected[config.offset :]
        if config.limit:
            selected = selected[: config.limit]
        return selected, len(selected), 0

    due: list[tuple[datetime | None, dict[str, Any]]] = []
    skipped_recent = 0
    interval_seconds = config.review_interval_days * 24 * 60 * 60

    for article in articles:
        aid = article_id(article)
        previous = previous_results.get(aid)
        last_checked = parse_time(previous.get("last_checked") or previous.get("checked_at")) if previous else None
        if last_checked is None:
            due.append((None, article))
            continue
        if (now - last_checked).total_seconds() >= interval_seconds:
            due.append((last_checked, article))
        else:
            skipped_recent += 1

    due.sort(key=lambda item: (item[0] is not None, item[0] or datetime.min.replace(tzinfo=timezone.utc)))
    cap = config.limit if config.limit is not None else config.max_due
    return [article for _, article in due[:cap]], len(due), skipped_recent


async def run(config: CheckConfig) -> None:
    if async_playwright is None:
        raise RuntimeError("Playwright is required to run the integrity monitor. Install requirements-integrity.txt first.")

    articles = json.loads(config.articles_path.read_text(encoding="utf-8"))
    if not isinstance(articles, list):
        raise ValueError("articles.json must contain a JSON array")
    total_articles = len(articles)
    if config.offset < 0:
        raise ValueError("--offset must be zero or greater")
    if config.review_interval_days < 1:
        raise ValueError("--review-interval-days must be at least 1")
    if config.max_due < 1:
        raise ValueError("--max-due must be at least 1")

    config.output_path.parent.mkdir(parents=True, exist_ok=True)
    config.history_path.parent.mkdir(parents=True, exist_ok=True)
    previous_payload = load_json(config.output_path, {"results": []})
    previous_results = {
        str(result.get("article_id") or result.get("id")): {**result, "checked_this_run": False}
        for result in previous_payload.get("results", [])
        if result.get("article_id") or result.get("id")
    }
    overrides_payload = load_json(manual_overrides_path(config.output_path), {"overrides": {}})
    overrides = overrides_payload.get("overrides", {})
    now = datetime.now(timezone.utc)
    articles_to_scan, due_articles_found, skipped_recent_count = select_articles(articles, previous_results, config, now)
    scan_run_id = utc_now().replace(":", "").replace("-", "")

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1365, "height": 900},
            locale="en-US",
        )

        scanned_results = []
        for index, article in enumerate(articles_to_scan, start=1):
            print(f"[{index}/{len(articles_to_scan)}] {article.get('source', '')}: {article.get('title', '')[:90]}")
            scanned_results.append(await check_article(context, article, config, scan_run_id))

        await context.close()
        await browser.close()

    by_id = dict(previous_results)
    for result in scanned_results:
        by_id[result["article_id"]] = result

    merged_results = []
    for article in articles:
        aid = article_id(article)
        result = by_id.get(aid, article_stub(article))
        result.setdefault("article_id", aid)
        result.setdefault("id", aid)
        result["checked_this_run"] = bool(result.get("last_scan_run_id") == scan_run_id)
        result = apply_manual_override(result, overrides)
        merged_results.append(result)

    generated_at = utc_now()
    summary = summarize(merged_results)
    scanned_this_run = len(scanned_results)
    payload = {
        "generated_at": generated_at,
        "last_scan_at": generated_at,
        "scanner_version": SCANNER_VERSION,
        "total_articles": total_articles,
        "scan_mode": "forced" if config.force else "due",
        "review_interval_days": config.review_interval_days,
        "max_due": config.max_due,
        "due_articles_found": due_articles_found,
        "scanned_this_run": scanned_this_run,
        "skipped_recent_count": skipped_recent_count,
        "forced": config.force,
        "scan": {
            "offset": config.offset,
            "limit": config.limit,
            "checked_articles": scanned_this_run,
            "screenshots_enabled": config.screenshots,
        },
        "summary": summary,
        "counts": {key: value for key, value in summary.items() if key != "total"},
        "flagged_articles": flagged_results(merged_results),
        "results": merged_results,
    }
    config.output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    with config.history_path.open("a", encoding="utf-8") as history:
        for result in scanned_results:
            history.write(json.dumps(result, ensure_ascii=False) + "\n")


def parse_args() -> CheckConfig:
    parser = argparse.ArgumentParser(description="Run Article Integrity Monitor checks.")
    parser.add_argument("--articles", default="data/articles.json")
    parser.add_argument("--output", default="data/integrity/latest.json")
    parser.add_argument("--history", default="data/integrity/history.jsonl")
    parser.add_argument("--screenshots-dir", default="data/integrity/screenshots")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--timeout-ms", type=int, default=25000)
    parser.add_argument("--screenshots", action="store_true")
    parser.add_argument("--review-interval-days", type=int, default=60)
    parser.add_argument("--max-due", type=int, default=25)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    return CheckConfig(
        articles_path=Path(args.articles),
        output_path=Path(args.output),
        history_path=Path(args.history),
        screenshot_dir=Path(args.screenshots_dir),
        limit=args.limit,
        offset=args.offset,
        timeout_ms=args.timeout_ms,
        screenshots=args.screenshots,
        review_interval_days=args.review_interval_days,
        max_due=args.max_due,
        force=args.force,
    )


if __name__ == "__main__":
    asyncio.run(run(parse_args()))
