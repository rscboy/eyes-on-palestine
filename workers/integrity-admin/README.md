# Echoes of Gaza Integrity Admin Worker

This Cloudflare Worker is the small backend for the Echoes of Gaza Article Integrity Admin System. It keeps GitHub credentials out of the browser and dispatches GitHub Actions workflows from authenticated admin requests.

## Endpoints

- `GET /health`
- `POST /api/integrity/bulk-override`
- `POST /api/integrity/run-monitor`

All admin endpoints require:

```text
X-Admin-Key: your-admin-api-key
Content-Type: application/json
```

The Worker only allows browser requests from `ALLOWED_ORIGIN`.

## Deploy

Install Wrangler and deploy:

```bash
cd workers/integrity-admin
npm install
npm run deploy
```

Set secrets:

```bash
npx wrangler secret put ADMIN_API_KEY
npx wrangler secret put GITHUB_TOKEN
```

`GITHUB_TOKEN` should be a GitHub token with permission to dispatch workflows in `rscboy/eyes-on-palestine`.

## Configuration

`wrangler.toml` sets:

```text
GITHUB_OWNER=rscboy
GITHUB_REPO=eyes-on-palestine
GITHUB_BRANCH=main
GITHUB_BULK_OVERRIDE_WORKFLOW=article-integrity-bulk-override.yml
GITHUB_MONITOR_WORKFLOW=article-integrity-monitor.yml
ALLOWED_ORIGIN=https://echoesofgaza.org
```

Update `ALLOWED_ORIGIN` if you deploy the public site under a different origin.

## Bulk Verification

The admin page sends up to 25 selected articles to:

```text
POST /api/integrity/bulk-override
```

The Worker dispatches `article-integrity-bulk-override.yml` with one stringified JSON `payload`. The workflow runs `scripts/apply_integrity_bulk_override.py`, which updates `data/integrity/manual_overrides.json`.

Manual verification takes precedence over automated classification.

## Monitor Controls

The admin page can dispatch `article-integrity-monitor.yml` through:

```text
POST /api/integrity/run-monitor
```

Recommended free-tier settings:

- Daily due scan
- 60-day review interval
- Maximum 25 due articles per day
- Screenshots off by default
- Screenshots only for anomalous results when enabled

Due-only scanning means articles are checked only if they have never been checked or if their last automated check is older than the configured review interval. This keeps GitHub Actions runs small and avoids unnecessary source requests.

## Screenshot Policy

Automatic screenshots are temporary evidence. They are deleted after manual review by default. Reviewers may choose `keep_as_evidence` only when a screenshot documents confirmed removal, substantial change, or another historically significant issue.

## Admin Page Use

In `admin.html`, open the `Article Integrity` tab.

1. Enter the Worker backend URL.
2. Enter the Admin API key for the current session.
3. Review flagged articles.
4. Select one or more records.
5. Choose a manual status and submit.
6. Use monitor controls to run due-only or small forced scans.

The Admin API key is not stored in `localStorage`; it remains in the browser field for the current session only.
