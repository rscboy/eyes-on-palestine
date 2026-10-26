# Loading investigation — October 26, 2026

## Root causes

Production checks returned the home document in 0.31 seconds to first byte and Submit Evidence in 0.17 seconds. The main bottlenecks were browser startup work and dependency ordering:

- Both documents synchronously loaded Tailwind's browser compiler (407,279 uncompressed bytes for the submission page), then compiled styles on visitors' devices.
- The submission form statically imported Firebase's app, Firestore and Storage modules although article submissions use Google Apps Script. Firestore alone was 455,145 uncompressed bytes. Static imports also delayed DOMContentLoaded.
- Publication suggestions fetched the entire article catalog (~1.23 MB), and the shared welcome story fetched that catalog again. Timestamp query parameters defeated normal caching of several data resources.
- Homepage articles awaited optional integrity, archive-status and packet-identity downloads. The integrity report was 1,883,865 bytes; any delay there also delayed unrelated initialization.
- A homepage scroll guard hid the body, froze scrolling on a timer, repeatedly forced the page to the top, and hid the body during navigation away.
- Chart.js loaded before parsing the homepage despite its chart being hidden; offscreen media images loaded eagerly. Google Translate loaded during startup, with a duplicate initialization path on the homepage.

## Changes

- Replace the compiler with a reproducible, checked-in 39,292-byte stylesheet shared by both pages, about 90% smaller than the submission compiler download, with no runtime compilation.
- Load Firebase only when a valid primary-source upload is submitted. Failed initialization can be retried.
- Generate a ~6.2 KB publication/domain catalog for the form, retain curated domain mappings, and refresh it automatically after archive changes.
- Remove timestamp cache busting from these public data reads and share the homepage article promise with its welcome story. Suppress the welcome story on Submit Evidence, avoiding an unrelated archive download and overlay.
- Render articles after their own data arrives. Populate optional provenance afterward, in place, preserving search, view mode, focus and article detail IDs.
- Remove visibility/scroll timers and navigation-away hiding. Retain manual restoration for plain homepage visits and handling of the existing stale map hash.
- Load Chart.js when its chart is revealed; lazy-load offscreen article, book, video and film images.
- Initialize translation near the footer controls, or immediately for an existing non-English preference.

## Verification

Chrome comparison on localhost, using original tracked files and changed files with the same browser profile:

| Measurement | Before | After |
| --- | ---: | ---: |
| Submit Evidence DOMContentLoaded, first comparison | 690 ms | 111 ms |
| Submit Evidence first contentful paint, first comparison | 468 ms | 128 ms |
| Homepage first contentful paint | 572 ms | 140 ms |
| Homepage first article, with a deliberate 6-second integrity-response delay | 7,055 ms | 497 ms |

These are diagnostic local measurements, not field Core Web Vitals or a promise of identical gains on every connection. Fonts and third-party caches were shared across sequential runs. A later run confirmed one homepage article-catalog download and preserved search and table view across delayed provenance completion.

Checked desktop layout, article search/table view, batch form controls, default dates/categories, source suggestions and primary-source tab. Submission-page startup requests included no Firebase, Tailwind compiler, full-archive or translation downloads. The upload itself was not exercised against production storage. Executable inline scripts and the shared shell parse; the data validator passes.

The existing timeline suite has five unrelated failures; an untouched HEAD snapshot reproduced the same failures. They concern stale generated timeline data/source IDs and a time-dependent future-import fixture. Timeline source data and test expectations were not changed.

The live form separately confirmed successful submission of all 11 user-selected Firefox articles. They entered the normal pending review queue; submission does not approve publication.
