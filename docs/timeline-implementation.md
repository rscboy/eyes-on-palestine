# Threads of Witness — implementation and editorial handoff

The interactive route is `timeline.html`. It starts in **2023**, opens in chronological order, and contains **1,331** deduplicated source records dated 2023 onward. The complete reading edition at `timeline-sources.html` retains all **1,342** unique public sources, including the 11 older records. The 1,352 original imports remain unchanged: nine duplicate URL imports are grouped, and one test entry is quarantined.

## Navigation and reading flow

- The initial screen has a small “Timeline · 2023–today” heading, one date navigator, and article cards. The navigator sticks below the header on desktop and becomes a thumb-friendly bottom bar on phones. The large introduction, illustrations, year rail, duplicate period headings, global result count, summaries, topic buttons, and card action rows are removed. The first card begins within the first 300px at tested phone widths.
- The month navigator has previous/next arrows, a month picker, Search, and More. Arrows skip months without matching records. The visible month follows scrolling; the picker contains a year selector, month choices, an archive-date field, and first/latest actions.
- Search expands on request. Desktop search-query links expand the field; phone query links show the filtered feed without opening a sheet. More contains Filters, Saved sources, View options, and About this timeline. Native dialogs keep secondary tools away from the main feed, trap focus, and return to their opener when closed.
- Date navigation **moves within current results**. Search and Filters narrow the collection separately. Active non-date filters are individually removable; a count is shown only for filtered/search results. Clear all filters restores the collection.
- Restricted date links show a brief “January 2024 only” (or “Date range active”) notice with Browse all dates. This action removes only the date restriction and preserves the reading month and other filters. It avoids trapping visitors in a legacy month-filter link.
- Cards contain an available source photo, title, publisher, and labeled archive date. Missing or failed images produce a text card, without decorative image placeholders. Cards and their keyboard-operable title links open the reading drawer. Original article links, saving, summaries, topics, provenance, and related reporting remain inside that drawer.
- The Archive date information button opens About this timeline. Collection/build metadata, date methodology, privacy notes, and the complete static edition also live there rather than in the article feed. Image context remains visibly labeled as unverified.
- The drawer stays separate from the feed layout. Previous/next article controls follow the filtered reading order. Escape, the contextual Back button, and browser Back return to the initial article and exact position, even after reading several sources.
- The URL's `at` parameter records a reading date independently of `from`/`to` filters. Shared links start there; reload restores the current window and position. Private notes never enter URL state.
- Date jumps render a bounded window around the destination. Load earlier articles preserves the visible anchor while prepending records. Manual or automatic loading appends subsequent records. View options holds image visibility, automatic loading, and reading order.
- Once-only card reveals, subtle reading progress, and drawer motion support orientation. Reduced motion removes animation. Wheel and touch scrolling remain native.


## Phone interaction improvements

- At widths up to 720px, or on short landscape touch screens, navigation sits at the bottom with 44–48px targets. The first article appears within 180px in the touch-enabled phone checks. There is no second top navigation bar.
- Date choices, More, and Search use native modal sheets. Existing controls move between desktop and mobile containers, preserving IDs, state, and event handlers. Tool transitions avoid focus returning into a hidden sheet; Escape and Close restore a visible trigger.
- Filter sheets have a persistent Show articles action. Done also applies valid date fields; invalid ranges keep the sheet open for correction. The date-range notice stays in the feed, keeping the bottom bar compact.
- Inputs use 16px text, native date/select controls, a Search keyboard hint, and unrestricted paste/zoom. Search preserves typed spaces and the caret during debounced updates; Show articles or keyboard Enter closes the sheet. Shared search links keep articles visible.
- Sheets follow the visual viewport and include safe-area padding. Short viewport and landscape checks verify that controls remain reachable. These are emulated browser checks, not a physical iPhone keyboard certification.
- Reader text is 16px with generous line spacing. Previous/next article controls remain at the bottom while reading. Content padding keeps the last source action above them, and returning preserves the original feed position.
- Phone image cards, metadata, and headings have larger text and spacing. Footer and feed padding prevent the dock from covering the final controls. Reduced-motion preferences and native scrolling remain supported.

## Research translated into interface decisions

These implement the principles in [the research dossier](timeline-research/echoes-of-gaza-timeline-research.md) and [the implementation prompt](timeline-research/echoes-of-gaza-timeline-prompt.md), with the user's later request for a 2023 start, stronger visuals, animations, and continuous browsing taking precedence.

| Research principle | Implementation |
| --- | --- |
| Keep time and reading context visible | Synchronized month navigator, minimal reading progress, explicit filter recovery |
| Overview first, detail on demand | Month picker, simple photo/text cards, stable desktop drawer and full mobile reader |
| Support several routes into a collection | Date navigation and on-demand Search, with topics/publishers/collections under More → Filters |
| Avoid forcing a chart interaction | Native year/month buttons, date fields, keyboard-operable details menus, ordinary links |
| Preserve provenance and uncertainty | Archive date labels with an accessible explanation, full provenance in the reader, actual capture URLs only |
| Prevent connected content from implying causality | “Related by subject” / “Related by theme and title” labels; approved relationships are separate |
| Make research portable | Shared saved packet, citation formats, TXT/JSON export, local notes, shareable public URL state |
| Make motion support orientation | One-time card reveals, subtle reading progress, brief drawer entry; no autoplay or scroll capture |
| Provide a durable alternative | Build-generated semantic static source chronology, with a fetch-error recovery link |

## Files and data responsibilities

- `assets/timeline-core.mjs`: civil-date handling, display normalization, filtering, grouping, URL state, provenance, citations, relationship suggestions, and editorial validation. It is independent of the DOM.
- `assets/timeline.mjs`: interface, date navigation, bounded reading windows, scroll effects, saved sources, preferences, native dialogs, and history restoration.
- `assets/timeline.css`: scoped visual design, media queries, motion, reduced-motion and forced-color accommodations.
- `assets/research-packet.js`: packet IDs and compatibility with legacy saved citations. The former 48-character truncated base64 identity caused collisions; full-input fingerprints replace it. Existing ambiguous legacy IDs follow the original first-match policy because the prior saved identifier cannot recover which colliding item was intended.
- `data/timeline/source-registry.json`: permanent UUID source IDs, URL aliases, permanent packet identity, and legacy packet aliases. Commit and retain this registry. Never regenerate it from scratch.
- `data/timeline/packet-identities.json`: generated URL-to-permanent-packet lookup used by the existing archive, so reviewed URL alias changes preserve packet compatibility.
- `data/timeline/sources.json`: generated public metadata index, with safe URLs, grouped imports, review flags, and dated integrity observations. Original import text remains in `data/articles.json`.
- `data/timeline/editorial.json`: separate events, claims, relationships, revisions, and subject reading collections. It currently contains **zero approved events**. Its reading routes are metadata-based collections, not verified event sequences.
- `scripts/build_timeline.mjs`: refreshes the index and complete static reading edition, retains source IDs, validates approved editorial entries, excludes future imports and test records.
- `assets/site-shell.js`: navigation links to the new timeline, current-page state, improved mobile menu focus/inertness, and no random welcome overlay or automatic translation widget in the timeline workspace.
- `index.html`: shared packet identity and cross-tab packet synchronization. Existing casualty and other archive tools remain available.

## Rebuild and test

Run from the repository root:

```sh
node scripts/build_timeline.mjs
node --test tests/timeline.test.mjs
node scripts/validate_data.mjs
git diff --check
python3 -m http.server 8037
```

Open `http://127.0.0.1:8037/timeline.html`.

For the optional browser suite, with Playwright available:

```sh
node tests/timeline.browser.cjs
node tests/timeline.mobile.browser.cjs
```

The browser suite can use the Codex bundled Playwright installation. `EOG_TIMELINE_TEST_URL` overrides the server URL; `EOG_BROWSER_EXECUTABLE` overrides the browser executable. Without a macOS Chrome path it uses Playwright's installed Chromium. Browser screenshots and its result JSON are saved under `/tmp/eog-timeline-*`. Use an isolated browser context; the suite does not modify the user's actual browser packet or notes.

## Verification completed

The focused data suite passes **26 tests**. It exercises corpus accounting, date separation, invalid civil dates, month/year bounds, facet logic, overview counts, unknown dates, tie ordering, URL state, text escaping, unsafe links, citation uncertainty, packet migration, collision checks, stable source IDs, future exclusions, manual integrity overrides, preservation URL validation, reading routes, and approved-event validation.

The browser suites pass **69 checks**: 46 desktop/responsive checks and 23 touch-enabled phone checks. Its saved result is [timeline-validation.json](timeline-validation.json). It covers:

- 2023 start, bounded reading windows, populated-month arrows, unavailable-month states, date-picker focus, and navigation that preserves filters.
- Search, shareable reading dates, selected-source links, same-position reload, browser Back, drawer sequencing, and exact scroll/focus return.
- Filtered-out selected sources, source reading routes, and approved/draft event separation.
- Save/export/private notes, shared packet compatibility with the existing archive, and cross-tab synchronization.
- Continuous append loading, earlier-article anchor preservation, View options, image preferences, and scroll reveals.
- Minimal initial screen, Search/More focus, missing-image text cards, date-restriction recovery, and on-demand methodology/static reading links.
- 320, 390, 430, 768, 1280, and 1440-pixel layouts without horizontal document overflow; mobile reading and navigation behavior.
- Reduced motion and 200% root text enlargement.
- Dataset failure recovery and all 1,342 sources in the no-JavaScript static edition.
- Synthetic approved-event fixtures for year-level precision and saving source bundles. These fixtures exist only in intercepted browser-test responses and are never published.
- No timeline JavaScript runtime errors.

A separate touch-enabled browser suite covers 320, 375, 390, and 430px portrait screens, an 844px landscape phone, short search viewports, desktop/mobile resizing, typed spaces, modal focus, date filters, reader controls, and unobstructed final actions.

Browser checks use Chrome. VoiceOver, NVDA, field performance, and a physical slower phone have **not** been certified by these tests. This implementation is not a claim of comprehensive WCAG conformance.

The initial timeline JSON totals **371,093 bytes gzip**, below the prompt's proposed **500 KB gzip** budget. The controller, core, shared packet helper, and site shell total **26,171 bytes gzip**, below **150 KB gzip**. Publisher images load lazily and are separate from those budgets. These measurements do not guarantee field Core Web Vitals.

## Editorial workflow

1. Keep the imported record intact. Refresh the generated index after additions.
2. Review flagged dates, encoding issues, author gaps, exact duplicate groups, and source access observations. A URL year is a review hint, not proof of a corrected date.
3. When a source URL changes, locate its existing registry UUID and append the new URL to that registry entry's `urls` array **before rebuilding**. Retain the prior URL. This preserves the permanent source identity. Do not merge merely similar headlines.
4. Retrieve the source body and verify publication time, event time, attributed claims, passages, media context, and rights. Do not infer event dates from imported dates or historical dates mentioned in an article.
5. Draft an `EventMoment` separately. Supply human-readable date precision, date bounds only for sorting, an explicit label, a source-based date rationale, supporting source IDs, and a reviewer/date/version.
6. Attach reviewed relationships. An approved event requires an approved source-to-event relationship for every attached source, supporting passage locators, an explanation, and reviewer/date. Types are `reports-on`, `investigates`, `revisits`, `responds-to`, `cites`, `updates`, or `corrects`.
7. Run the build; validation blocks incomplete approved events, unknown source references, unsupported relationship types, invalid intervals, and future event dates. Drafts do not enter public chronology mode.
8. Record revisions with entity ID, timestamp, actor, reason, and prior version. Rebuild after approved edits. Refresh source checks separately and retain their actual timestamps.

A working URL or a preserved copy does not verify a claim. A blocked or likely-removed page is not labeled a confirmed removal. Unknown publication dates stay `n.d.` in formatted citations, with an explicit archive-date note. Wildcard Wayback search links are never presented as a recorded preserved copy.

## Shared state and preferences

URL state version `v=1` represents mode, date bounds, query, themes, publisher/type facets, source status, date review, collection, grouping, order, selected record, and loaded record count. Search edits replace history; explicit navigation adds useful history entries. Private notes, image visibility, continuous loading, and saved IDs are absent from share URLs.

The shared packet key remains `echoes_research_packet`. Additional local keys are `echoes_timeline_private_notes`, `echoes_timeline_images`, and `echoes_timeline_auto_load`. Storage failures keep reading usable and make persistence limitations explicit.

Production is published through the existing GitHub Pages setup from the repository’s `main` branch. The canonical timeline route is `https://echoesofgaza.org/timeline.html`.
