# News article submission update

The public news form is in `collab.html`. Its metadata helpers and intake controller are in `assets/js/news-metadata.js` and `assets/js/news-submission.js`. `admin.html` labels a missing publication date as needing verification.

## Deployment

Production backend updated September 7, 2026: Apps Script version 27, keeping the existing web app URL. Verified `checkArticleLinks` returns a successful response.

1. Update the existing Google Apps Script project with `scripts/secondary-submissions-apps-script.gs` and deploy a new version of its existing web app. Keep the current web app URL and access settings. No spreadsheet column migration is needed.
2. Publish `collab.html`, `admin.html`, and both files in `assets/js/` together.

The new public `checkArticleLinks` POST action accepts up to 100 links and returns only their matching pending/approved statuses, without contributor details or the private queue. The submission action uses a script lock and normalized article links to return the existing receipt on a retry instead of adding another row.

Deploy the Apps Script update first. An old deployment still accepts articles, but cannot check pending links or guarantee safe retry after a lost response. The form reports when pending lookup is unavailable.

Unknown publication dates are submitted as an empty date, with `dateUnknown: true`. The date stays empty in the editorial queue. Existing approval validation requires an editor to supply a publication date before publishing. Today's date is never substituted for the news article date.

Drafts, contributor name, and successful receipts are saved in this browser's local storage. They are not synced across devices. Storage failures show an on-page message; pending receipt states survive a reload and can be retried against the server's duplicate check.

## Verification

Run `node tests/news-submission-server.cjs` for the Apps Script checks.

For the browser checks, serve this repository on `http://127.0.0.1:8765`, make Playwright available to Node, and run `node tests/news-submission.cjs`. The test uses Chrome by default (`TEST_BROWSER_CHANNEL` can override the channel). Article metadata and submission requests are intercepted; no test records are sent to the live service. It checks automatic paste import, archive/pending duplicates, inferred publication, category batch edits, unknown dates, draft restore, partial submission, failure recovery, stable retry IDs, successful metadata extraction, preservation of manual edits, and mobile overflow.
