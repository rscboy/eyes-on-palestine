# Echoes of Gaza timeline research

Start with [the illustrated research brief](echoes-of-gaza-timeline-research.html). It includes the collection audit findings, proposed Threads of Witness concept, UI/UX practices, accessibility and data requirements, a 100-project comparative register and a selected-record design dossier.

Use [the implementation prompt](echoes-of-gaza-timeline-prompt.html) for a later design/coding task. Markdown copies are available alongside both HTML reading copies. The HTML copies support printing; the research register is searchable and the prompt has a copy button.

The article-audit.csv/JSON files contain all 1,352 stored records. The research-register.csv/TSV files contain 100 distinct project URLs, including documented and legacy examples. These are metadata and desk-research deliverables; full publisher-body review and editorial approval remain outstanding before curated events are published. See evidence/README.md for method boundaries.

To refresh the metadata audit from the local archive, run python3 docs/timeline-research/build_archive_audit.py from the repository root. Its review date is fixed to October 3, 2026. To rebuild HTML copies after editing the Markdown, run python3 docs/timeline-research/build_reading_copies.py.

No live website code or article data was modified by this research task.
