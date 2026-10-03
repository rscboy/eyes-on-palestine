# Echoes of Gaza timeline: complete design and implementation prompt

Copy the following brief into a design or coding task. It is grounded in the October 3, 2026 local collection audit and a 100-project comparative timeline register. This prompt requests implementation; the research task that produced it did not modify the live website.

## Mission

Design and implement **Threads of Witness**, an interactive archival timeline for Echoes of Gaza. Its purpose is to help people understand documented lives, events and reporting over time; inspect sources; follow later investigations and accountability actions; and assemble useful citations.

Make it distinctive through its information architecture and documentary connections. Use a quiet chronological spine, selectable thematic threads, readable event/source cards and a focused **Follow the record** view. Let the record itself provide the emotional weight.

Deliver a coherent feature that fits the existing website, works on mobile and with assistive technology, and remains honest about uncertainty, incomplete collection coverage and source availability.

## 1. Inspect the project and preserve its conventions

Before implementation, inspect applicable repository instructions, README, index.html, assets/site-tokens.css, assets/archive-experience.css, data/articles.json, the integrity/Wayback data, existing filtering and saved research-packet/citation code, and docs/timeline-research.

Use the existing static HTML/CSS/JavaScript architecture unless a concrete project constraint requires another approach. Do not introduce a framework migration as a prerequisite. Reuse working source cards, publisher aliases where reviewed, archive/source choices, research packets and citation exports. Keep the timeline's state coherent with those existing features.

The current casualty timeline/chart is a different tool. Name and route the archive chronology clearly so users can distinguish the two. Do not silently replace the casualty chart or treat its external casualty series as the chronology dataset.

Preserve unrelated local changes. Produce a reviewable local implementation and validation report. Deployment is outside this prompt unless separately authorized.

## 2. Fixed audit facts and review boundaries

The local main archive contains 1,352 stored records and 1,343 distinct exact source URLs. Imported date values range from 2001-06-02 to 2026-09-30, but the early boundary is not reliable: audit record 203 is dated 2001 and links to a Reuters URL dated June 2, 2026. Record 226's 2006 date also needs review. Do not treat those dates as verified historical coverage.

1,290 entries, or 95.4%, are dated 2025–2026. There are 179 blank summaries, 51 records missing legacy metadata fields, 143 raw publisher labels and 111 raw primary category labels. Sixteen records participate in seven exact repeated-URL groups, creating nine redundant URL copies. Ninety-eight summaries contain machine citation artifacts. There are three summary strings that contain access/scraping errors and one record titled “test.”

The collection stores article titles, summaries and links, not full publisher bodies. A complete metadata audit is not a source-body verification. Treat keyword thread suggestions, URL date hints and extracted historical years as candidates for editorial review.

The local integrity snapshot is dated May 12, 2026 and covers 1,116 records. The checked local Wayback status file contains no capture records. Do not display “Preserved” or “Verified” on every item.

For the audited snapshot, Today is October 3, 2026 and the latest imported article date is September 30, 2026. Show the difference. At runtime, calculate today according to a documented site timezone, and show the collection's actual update/coverage date separately.

## 3. Product concept

Use the title **Threads of Witness** with a short subtitle such as “A chronology of life and the record.”

Suggested introductory copy:

“Explore the lives, events and reporting held in Echoes of Gaza. Follow a thread, open a moment, and trace the sources connected to it.”

Add a concise coverage statement and date-basis explanation. Do not imply the collection is exhaustive, continuous or fully verified.

The thread motif should be restrained: one chronological spine, small labeled thread markers and local relationships around the selected moment. It must not become a fabric animation, a decorative injury treatment, or thousands of connecting lines.

The distinctive interaction, **Follow the record**, connects an earlier event with later reports, investigations, responses, legal actions and documented corrections. A connection must have an explicit reviewed meaning. Sharing a theme or occurring near another event does not establish causality.

## 4. People and core tasks

Serve:

- A first-time reader who needs orientation and plain language.
- A Palestinian reader or family member seeking a record with care and dignity.
- A researcher comparing original and later sources.
- A teacher assembling a chronological source packet.
- A mobile reader using a slow connection.
- A reader using keyboard navigation, magnification or a screen reader.

Make these tasks work:

1. Find a date or period and understand what the dates represent.
2. Follow a theme without losing chronological orientation.
3. Open a moment and identify its sources.
4. Trace a later investigation back to the event it discusses.
5. Find records whose event date is unknown.
6. Compare a small set of source records without collapsing their differences.
7. Save individual reports or an explicitly selected source bundle.
8. Export citations and share a reproducible filtered URL.
9. Hide images and continue every core research task.
10. Return from detail with the same filters, date context and reading position.

Do not optimize for dwell time on distressing material, graphic-image views or maximum scrolling.

## 5. Information architecture and initial state

Provide two explicit modes:

**Read chronology:** reviewed EventMoment records grouped by time, each opening its supporting sources.

**Browse source records:** all eligible archive records ordered by verified publication date or clearly labeled imported archive date. Unknown event dates must not make a source disappear.

If the event dataset is not editorially ready, default to the source mode. Do not automatically generate a public event chronology from article dates or headlines.

Treat “Explore threads” as a filter and an optional presentation within these modes. Treat “Follow the record” as a selected-moment interaction. All representations must share the same state and show what is included.

The initial viewport should show a modest title/explanation, coverage/date-basis labels, search/date/theme controls, the time overview and the beginning of readable results. Avoid an oversized photographic hero or mandatory onboarding.

Once a reviewed event layer exists, the initial context can emphasize October 2023 through the latest covered date while retaining an obvious Earlier context control. Before that, show the collection's source coverage without assuming imported dates are verified. Do not force a 1948 starting point through empty imported data.

A future historical-context layer may include 1948 and earlier periods, but only with independently curated, cited material and explicit “Curated historical context” labeling. Do not invent historic entries to make an axis look complete.

## 6. Desktop layout

Use a flexible layout with the chronology as the primary reading surface. At spacious widths, show:

- A compact top toolbar with mode/date-basis controls, search and primary filters.
- A small proportional overview of the selected date basis, with explicit counts and selected range.
- A chronological reading list with a date column and one subtle spine.
- A detail aside when a reader selects a moment; provide a durable full-page detail route as well.

Keep the list's comfortable reading width. Do not squeeze it into a narrow card column to accommodate every secondary filter. Collapse advanced filters into a labeled disclosure.

The detail aside is nonmodal: do not trap focus or inert the main page. Opening it should be an explicit user action. It should not expand simply because a record scrolls into view.

Keep the selected event highlighted with text/shape as well as color. Preserve date and list position when detail opens. If a selected record falls outside new filters, explain the state and offer a route to restore its context.

## 7. Mobile layout

Use a single vertical chronology, natural page scrolling, portrait support and a compact filter disclosure. Do not require landscape orientation, horizontal drag, pinch zoom or precision tapping.

Keep the selected range and result count visible without a toolbar taking most of the screen. At 320–430 CSS pixels, dates sit above titles; metadata wraps naturally; cards remain readable; primary actions have usable targets.

Prefer a dedicated detail page for long event/source bundles. “Back to timeline” restores mode, filters, selected period and prior position. Browser Back must also work.

If a modal drawer is used instead, implement correct focus placement, Tab/Shift+Tab containment, Escape, inert background, focus restoration, accessible close control, nested scrolling and safe-area behavior. Do not implement both patterns inconsistently.

The time overview can collapse to a readable period picker plus optional compact graphic. The mobile user must retain equivalent filtering and all sources.

## 8. Time controls and scale rules

Offer a start date, end date, Jump to a date, previous/next period, year/month/day granularity where useful, Latest collected record and Earlier context.

An optional range brush enhances the overview. Explicit controls must produce the same results without dragging. Do not hide them in help text.

The overview uses proportional time. The list uses readable spacing in chronological order. State that card spacing is not elapsed-time distance. If a gap or scale break is shown, label it. Do not use an unlabeled logarithmic or compressed axis.

At year scale, show period summaries and counts. At month scale, show groups and moments. At day scale, expose individual sources/events. When a group expands, keep its date context visible.

Preserve the selected date or event when changing granularity. Avoid recentering to the newest date after every filter. Show “No collected records in this interval” for a gap; never “Nothing happened.”

Label density graphics as **collected source records** or **reviewed event moments**, matching the current mode. Never interpret a taller bar as more casualties, harm, independent confirmations or historical importance.

## 9. Theme taxonomy and filter behavior

Use seven stable, plain-language themes:

1. Life, culture and survival.
2. Health and care.
3. Food, water and aid.
4. Land, home and displacement.
5. Policy and military action.
6. Rights and accountability.
7. Witness and the record.

Allow multiple themes per event/source where reviewed. Use text labels and distinguishable marker shapes/states, not color alone. Keep the thematic colors muted, accessible and consistent with site tokens.

Keyword mappings in the audit are import suggestions. Do not present them as curator-approved assignments.

Primary facets: date range, theme and text search. Secondary facets: place, publisher, source/document type, date precision, preserved-copy availability and relevant review context. Add people only after identity, privacy and naming review.

Use OR within one facet and AND across facets. State the behavior in tests. Maintain removable active chips, Clear filters and a visible result count. Empty states should explain which constraints are applied and offer reset/expand-range actions.

Do not advertise full article text search unless source bodies are actually indexed. Distinguish searches of reviewed timeline summaries from searches of imported titles/summaries. Handle Unicode, punctuation, apostrophes and reviewed name aliases without rewriting original source metadata.

Keep search/filter state stable while asynchronously loading details. Debounce text input only as needed; committed selection should feel immediate.

## 10. Event cards and source cards

Event cards should show:

- Event date label, including approximate/interval precision if applicable.
- A reviewed descriptive title.
- A short reviewed summary.
- Theme and place labels where recorded.
- Number of associated source records.
- Open moment and Save actions.
- Specific uncertainty/disagreement/retrospective labels where relevant.

Source cards should show:

- Original source title.
- Publisher and author if recorded.
- Verified publication date, or “Archive date” while unverified.
- Document type and the original summary, clearly identified as stored/curated as appropriate.
- Source URL and a preserved-copy choice only when an actual copy exists.
- Capture/check metadata with timestamps.
- Save and citation actions.

Do not create a new synthesis simply by concatenating headlines. Retain the distinction between original metadata and curatorial language.

A missing summary should read “Summary not recorded” with access to source metadata; never show “Forbidden” as an article summary. Clean machine citation artifacts for display through a reviewed normalization step while retaining originals internally.

Do not treat imageUrl as guaranteed event photography: many current images are publisher logos. Display logos as source identifiers, not factual scene evidence. Optional real imagery requires rights, credit, caption and sensitivity review. The experience must work fully without thumbnails.

## 11. Event detail and Follow the record

Detail order:

1. Heading, event interval and explanation of date certainty.
2. Concise reviewed account.
3. Sources supporting the account, with original metadata.
4. Follow the record sequence.
5. Disagreements, uncertainty and limits.
6. Provenance and editorial revision notes.
7. Save/cite/share and correction/report-a-problem route.

Use a text sequence as the canonical relationship view. A small optional diagram can enhance it. Render connections only for the selected moment, initially showing a manageable set. Provide “Show all related sources” and ordinary links.

Allowed reviewed relationships include reports-on, investigates, revisits, responds-to, cites, updates and corrects. Each relationship needs supporting evidence and a short explanation. “Corrects” requires a documented correction; “responds-to” requires a demonstrable response.

Label suggestions based only on themes as “Related by theme,” separate from reviewed relationships. Do not display machine confidence percentages as evidence quality. Do not imply a causal chain through decorative arrows.

A later source remains at its publication date in source mode while linking to the earlier event. A later investigation, complaint or recovery can also be its own event when warranted. One article can link to multiple events.

Optional advanced enhancement after publication dates are verified: a publication cutoff inside Follow the record. Label it “Sources in this collection published by [date].” Moving it forward reveals later reporting while preserving the original event position. Do not call it “What the world knew,” and do not use unverified imported dates for this control. A cutoff cannot reconstruct the earlier body of a subsequently changed source without a real dated capture. Preserve the cutoff in shareable state when enabled.

## 12. Concrete prototype fixtures from the audited collection

Use audit numbers only to locate snapshot records; assign durable production IDs independently. The source bodies and event dates still require review.

**Nasser Hospital reporting sequence:** records 482 and 484 (August 25, 2025), 502 (August 28), 503 (September 1), 604 (September 26), 44 and 40 (August 2026). Demonstrate initial reports, later investigation and revisit without overwriting earlier accounts or presenting a later report's date as the original event date.

**Historical reporting:** record 318 is stored January 20, 2022 and discusses Tantura in 1948. Demonstrate event versus publication time and year-level uncertainty; do not invent a precise historical day.

**Retrospective investigation:** record 408 is stored July 7, 2024 and concerns October 7, 2023. Demonstrate a connection between a report and an earlier event.

**Hind Rajab/accountability:** record 720 is stored October 21, 2025 and describes a complaint about an earlier killing. Distinguish complaint, investigation and court finding. Review dates and procedural terms before publishing.

**Recovery:** record 71 is stored August 4, 2026 and discusses recovery linked to an earlier strike. Give the recovery activity its own time and relation.

**Lives and agency:** use selected records 52, 81, 153, 171, 236, 1279, 1284, 1332, 1336 and 1342 to test accessible routes through swimming, beekeeping, play, veterinary work, coding, education, reunification, weddings, street restoration and art. Do not romanticize hardship or force a “hope” conclusion.

**Claim rather than fact:** record 1340 reports an allegation about “engineered” rats; its stored summary describes conspiracy-claim framing. It must not become an unqualified event assertion. Demonstrate attributed source preservation and editorial review.

**Statistical definitions:** records 882–885 and 913/917 include unlike mortality/impact claims. Demonstrate separate measures, periods, sources and uncertainty. Do not sum or substitute them.

**Data-error states:** use record 203's date mismatch, record 196's test title, one empty summary, a summary containing machine citation artifacts, a missing author, one repeated URL group and one unassigned theme.

Keep fixtures clearly labeled where verification is incomplete. Do not fabricate witnesses, quotes, images, dates or source passages for the prototype.

## 13. Data architecture

Keep the original imported article data intact. Add a normalization adapter and separate reviewed datasets. Use many-to-many relations.

Required entities:

**SourceRecord:** permanent ID; original fields; normalized publisher ID; author(s); document type; verified publication date or null; imported date; date-basis label; source URL; source-body access status; rights; review status; capture/check references.

**EventMoment:** permanent ID; reviewed title/summary; event interval; date precision and human label; themes; place IDs; linked source IDs; source-based date rationale; review status; reviewer/date; version.

**Claim:** attributed statement; source ID; passage locator; claim type; relevant time/measurement period; numerical measure/unit/definition if applicable; uncertainty and editorial notes.

**Relationship:** permanent ID; endpoints; explicit type; explanation; supporting source(s); reviewer/date; status.

**PreservationRecord:** source ID; actual capture URL/time; last check/time; observed status and method; previous observations.

**EditorialRevision:** entity ID; timestamp; reason; actor; prior version reference.

Use null for unknown values. Do not conflate import time, publication time, event time and capture time. Do not use the title/URL research hash as a permanent ID: assign stable IDs that survive metadata corrections.

Illustrative schema, not a verified public event:

~~~json
{
  "id": "moment-assigned-permanent-id",
  "status": "draft",
  "title": "Reviewed descriptive title pending source verification",
  "eventTime": {
    "start": null,
    "end": null,
    "precision": "unknown",
    "label": "Event date not yet verified",
    "rationale": null,
    "sourceIds": []
  },
  "themes": ["health-care", "witness-record"],
  "places": [],
  "sourceIds": ["source-assigned-permanent-id"],
  "review": {"reviewer": null, "reviewedAt": null},
  "version": 1
}
~~~

Exact days, months, years, approximate dates and intervals need explicit precision. Machine-sort bounds can support navigation but must not be displayed as fabricated exact dates. Represent a known month with month precision rather than showing its first day as an exact occurrence.

For day-level history, use civil dates consistently to avoid timezone shifts. Store instants with explicit offsets only when justified. When same-day ordering is unknown, use a stable neutral tie-break and do not imply minute-level sequence.

Validate foreign keys, required sources, intervals, future dates and status values at build time. An approved event must have approved supporting source relations and a date rationale. Do not silently publish drafts.

## 14. Source integrity, corrections and disagreements

A working URL is not a verified claim. A preserved copy is not a verified claim. A blocked request is not a confirmed removal.

Expose specific states: Not checked, Available when checked, Access restricted, No preserved copy recorded, Preserved copy recorded, Changed since previous check, Removed with confirmation, or Under review. Retain actual timestamps and methods. Do not reuse stale check results as current observations.

Distinguish original publisher corrections from changes to Echoes of Gaza metadata and curator interpretation. Keep a revision trail. Where sources disagree, show the attribution and relevant dates; do not silently select the most dramatic number.

Legal language needs procedural precision: complaint filed, investigation opened, warrant issued, provisional measures ordered, finding by a commission, NGO assessment, scholarly resolution or final court judgment. Preserve attribution. Do not flatten these into an indiscriminate “court proved” badge.

Numerical claims need source, observation interval, unit, geographic scope and definition. Separate direct deaths, indirect/prospective deaths, missing people, injuries and years of life lost. The chronology should link to the existing casualty tool where appropriate, with definitions and snapshot dates; it should not produce a new composite death total.

Provide a clear correction route and a factual explanation of collection/selection policy. Do not expose private reviewer notes or personal correction-request data publicly.

## 15. Visual design and content tone

Use the existing design tokens as the base: charcoal/black, warm off-white, restrained muted metadata, gold for focus/provenance and red only for meaningful emphasis or warning. Measure contrast and adjust within the existing language.

Use Inter or the site's current UI typeface for controls and metadata, with a restrained serif where the site's editorial hierarchy supports it. Body text around 16–18px, comfortable line height, readable line length and generous spacing should work with actual content.

Use a coherent 4/8px spacing rhythm and a small number of surface levels. Dates, titles, sources and actions should be distinguishable without dense borders or excessive card nesting.

Use specific, calm copy. Examples:
- “Event date uncertain.”
- “Report published September 9, 2025.”
- “Archive date awaiting verification.”
- “No collected records match these filters.”
- “No preserved copy recorded.”
- “Last source check: May 12, 2026.”
- “Later investigation of this event.”
- “3 source records saved.”

Do not use celebratory copy, achievement badges or “You unlocked” mechanics. Preserve a person's life and actions rather than treating them as an engagement device.

## 16. Motion, media and dignity

No autoplay audio/video, scroll hijacking, animated casualty counters, cinematic injury reveals, looping thread animation or parallax over evidence. Interaction feedback must remain clear without motion.

Use brief opacity/transform transitions only where they aid orientation. Never use transition: all. Respect prefers-reduced-motion and offer stable equivalent states.

Provide text-first reading and an image visibility preference. Use specific content notices for graphic imagery, sexual violence or distressing testimony where needed. Notices should not prevent access to non-graphic source metadata.

Media requires appropriate captions/transcripts, source credits, rights and uncertainty information. Avoid revealing sensitive personal locations. Do not create AI-generated documentary imagery, invented testimony or composite people.

## 17. Accessibility: implementation requirements

Target WCAG 2.2 AA and verify manually.

- Use native controls, semantic headings, a main landmark, an ordered chronology and ordinary source links.
- Keep a useful reading order independent of any SVG/canvas visualization.
- Give every icon-only button and every meaningful marker an explicit accessible name.
- Decorative paths are hidden from assistive technology.
- All tasks work by keyboard and without dragging.
- Provide visible skip links and strong focus indicators.
- Sticky regions must not completely obscure focused controls.
- Restore focus after closing a detail/modal to the invoking record or logical fallback.
- Preserve focus during filter updates; announce a concise result count after committed changes through a polite status region.
- Do not announce every marker movement or rerender the entire list into a live region.
- Prefer 44×44 CSS-pixel touch targets. WCAG 2.2 AA's minimum target criterion is 24×24 with exceptions; distinguish the standard from this stronger project design target.
- Meet relevant contrast ratios: 4.5:1 normal text, 3:1 large text and 3:1 essential non-text UI.
- Themes, date certainty and source states must not depend on color alone.
- Reflow the core reading experience at 320 CSS pixels; support 200% text enlargement and 400% zoom.
- The core task must not depend on an exception for a two-dimensional diagram.
- Give the brush visible date-input/button alternatives.
- Implement any modal according to the WAI-ARIA dialog pattern, including Escape, focus containment and background inertness.
- Respect reduced motion; animation from interactions is an AAA criterion, although reduced motion is a project requirement here.
- Prepare logical CSS properties and language attributes. Arabic support requires bilingual editorial work and deliberate RTL design.

Reference:
[Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html),
[Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html),
[Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html),
[Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html),
[Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html),
[Modal dialogs](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Do not claim accessibility compliance based only on an automated scanner.

## 18. URL state, research packets and privacy

Use a canonical route for the chronology and stable moment/source URLs. Encode mode, date basis, range, selected themes and selected item in URL state. Use a documented state version if future changes could invalidate links.

History rules:
- Explicit navigation and selection create useful history entries.
- Rapid search edits can replace state rather than flooding history.
- Back restores the preceding useful state.
- Reload restores the same state.
- Invalid parameters produce a helpful reset state, not a crash.

Reuse the existing saved research packet and citation formats. Distinguish Save source from Save all sources in this moment. Export source metadata accurately and retain unknown authors/dates as unknown.

Keep private notes, image preferences and saved reading history out of shared URLs. Avoid third-party tracking and request-free external embeds in the basic view. Explain local storage, allow clearing it and keep reading available without an account.

## 19. Performance and resilience

Use ordinary DOM rendering and lightweight SVG first. Introduce canvas, WebGL, a chart engine or map library only when a measured need justifies it. Preserve a semantic equivalent.

Build a period/search index for metadata. Render a bounded set of cards with accessible pagination or Load more. If virtualizing, verify focus, screen-reader order, browser Find limitations and discoverability; do not remove focused content.

Do not load every publisher page, image or article body at startup. Lazy-load authorized media with explicit dimensions. Load source details on demand, cache versioned public data and show snapshot/update information.

Proposed engineering budgets, to measure and adjust openly:
- Timeline-specific JavaScript below 150KB compressed.
- Initial non-media dataset below 500KB compressed where practical.
- No eager image wall or network graph.
- Filter feedback generally within 100–200ms on the agreed slower test device.
- Field goals at the 75th percentile: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1. Laboratory results do not establish field percentiles.

[Current Core Web Vitals guidance](https://web.dev/articles/vitals).

Support clear states for loading, empty results, failed dataset fetch, partial detail load, unavailable image, stale checks, missing capture, malformed URL parameters, unknown date and no JavaScript enhancement. A build-generated static reading route should remain usable if the visualization fails.

Escape text, sanitize any rich-text boundary, validate safe source URL protocols and use appropriate security attributes for new tabs. Do not rely on third-party embeds for essential source access.

## 20. Editorial workflow

Implement and document:

1. Immutable import.
2. Validation and flagged review queue.
3. Publisher alias review and duplicate reconciliation.
4. Source retrieval/metadata verification where lawful and available.
5. Date, claims, rights and sensitive-content review.
6. Moment drafting and source attachment.
7. Relationship review.
8. Publication of approved moments.
9. Versioned revisions and refreshed integrity checks.

Do not publish record 196 as a historical event. Do not silently correct record 203 to 2026 based only on its URL; flag it and obtain source-based metadata. Do not replace source text with invented summaries when access fails.

Unreviewed source access is an explicit editorial policy choice. The implementation must make that status representable and avoid automatically promoting imported records into approved event narration.

## 21. Validation and acceptance criteria

Test with real corpus edge cases and the entire 1,352-record source dataset. Use focused tests for consequential behavior, not snapshots that merely mirror markup.

Required functional tests:
- Publication/import/event date separation and unknown/interval precision.
- Exact duplicate URL grouping and correct source counts.
- OR within facet/AND across facets.
- Consistent period counts between overview and list.
- Stable same-day ordering without fabricated intraday sequence.
- URL reload and Browser Back restoration.
- Deep links to selected records.
- Filtered-out selected item behavior.
- Save source versus bundle, citation export and unknown metadata.
- Missing summaries, artifacts, unassigned themes and source-access states.
- Today versus latest collection date; scheduled/future entries excluded according to publishing policy.
- HTML/text and safe-link handling.

Manual verification:
- Keyboard-only completion of every core task.
- VoiceOver plus Safari; NVDA plus a supported browser where available.
- At least one slower phone/device or realistic throttled environment.
- Portrait widths 320, 390 and 430px; tablet; 1280/1440px desktop.
- 200% text enlargement and 400% zoom.
- Reduced motion, high contrast/forced colors where supported, images disabled and long translated text.
- Modal/aside focus behavior if implemented.
- No layout jumps while media or detail loads.

Report what was actually tested and any unavailable environment. Do not invent pass results.

Usability tasks:
- Ask a reader whether the displayed date is event or reporting time.
- Ask what a density bar measures.
- Find a health-related source in a specific month.
- Trace a later investigation.
- Find a source with unknown event date.
- Save/export two sources and reopen a shared view.
- Hide imagery and continue.

Use observed misunderstandings to revise labels and defaults. Do not require participants to view graphic content.

Release conditions:
- No unsupported event dates or fabricated historical gaps.
- No source/claim verification implied by a successful URL.
- Every eligible source remains discoverable.
- Every curated moment and relationship is supported by reviewed sources.
- Accessible equivalents preserve the same research capability.
- Empty, loading, error and unknown states are complete.
- Existing archive and research-packet functions remain coherent.
- Measured performance and manual checks are documented.
- Known editorial gaps are clearly represented rather than hidden.

## 22. Deliverables and implementation order

Deliver:
1. A concise final design rationale and route/state map.
2. Desktop and mobile wireframes using real reviewed or clearly labeled draft content.
3. A data adapter and schema validation with durable IDs.
4. A working source chronology with accessible overview, filters and deep links.
5. Reviewed event bundles where content is actually ready.
6. Follow the record for approved relationships.
7. Shared research-packet/citation integration.
8. Documentation of date semantics, editorial workflow and source availability.
9. Focused functional tests and a manual verification report.

Implement progressively:
- First make the source chronology trustworthy and usable.
- Then add approved event moments.
- Then add focused documentary connections and optional visual exploration.
- Finally consider maps, Arabic editorial translation and moderated contributions.

Make routine design/engineering choices independently within this brief. Resolve uncertain factual content through the review model rather than inventing it. Finish the authorized local work and present the concrete result for review.

## 23. Comparative design references

Study the linked register in docs/timeline-research/echoes-of-gaza-timeline-research.md. Key references:

- [PalQuest](https://www.palquest.org/): overall and thematic chronologies with documents, people and place context.
- [MSF Gaza, inside the war](https://www.gazainsidethewar.com/): themed event and location exploration with explicit compilation scope.
- [New Museum Digital Archive](https://archive.newmuseum.org/chronology): dated records linked to collection objects and record types.
- [Marine Institute archive](https://marine.ie/site-area/areas-activity/fisheries-ecosystems/interactive-marine-archive/interactive-marine-archive): curated annual highlights alongside original reports and catch trends.
- [Carnegie Hall African American Music timeline](https://timeline.carnegiehall.org/about): scholarly chronology with editorial credits and optional audio.
- [WAI guidance](https://www.w3.org/WAI/WCAG22/): authoritative accessibility criteria.

Borrow useful mechanics and adapt them to the existing archive. Do not copy branding or assume an attractive example meets accessibility requirements.
