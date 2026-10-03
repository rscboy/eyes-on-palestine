"""Reproducible metadata audit; no source bodies or editorial claims are inferred."""
from pathlib import Path
import collections, csv, datetime, hashlib, json, re, urllib.parse

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
A = json.loads((ROOT / 'data/articles.json').read_text())
TODAY = datetime.date(2026, 10, 3)
LANES = {
    'Daily life, culture and survival': r'\b(cultur|poet|music|art |artist|football|basketball|sport|school|education|classroom|exam|play|kite|swim|beekeep|veterinary|recipe|wedding|heritage|mosque|church|olive|farmer|farming|livelihood)',
    'Health and care': r'\b(health|hospital|medic|doctor|nurs|patient|disease|polio|infection|surg|amput|cancer|dialysis|sanitation|sewage|hearing|incubator)',
    'Food, water and aid': r'\b(food|water|aid|hunger|starv|famine|malnutri|flour|bread|baker|convoy|humanitarian|flotilla|ghf|wfp|unrwa)',
    'Land, home and displacement': r'\b(displac|evacuat|settler|settlement|annex|expel|expuls|refugee|shelter|tent|home|housing|demol|rubble|rebuild|yellow line|domicide)',
    'Policy, military action and diplomacy': r'\b(cease.?fire|truce|policy|politic|minister|netanyahu|smotrich|ben.?gvir|trump|biden|arms|weapon|military|bomb|strike|attack|hostage|diploma|recogniz|recognis)',
    'Rights, detention and accountability': r'\b(genocide|war crime|law |legal|court|icc|icj|accountab|investigat|inquiry|human rights|amnesty|b.tselem|detain|detainee|prison|torture|abuse|sexual|execution)',
    'Witness, media and the record': r'\b(journalis|reporter|press|media|testimon|witness|censor|propaganda|surveillance|ai |algorithm|evidence|document|archive|narrative)',
}
url_groups = collections.defaultdict(list)
title_groups = collections.defaultdict(list)
for i, x in enumerate(A, 1):
    url_groups[x['link'].strip()].append(i)
    title_groups[re.sub(r'\W+', ' ', x['title'].lower()).strip()].append(i)

alias = {'times of israel':'The Times of Israel', 'the times of israel':'The Times of Israel', 'ap':'Associated Press', 'ap news':'Associated Press', 'associated press':'Associated Press', 'new york times':'The New York Times', 'the new york times':'The New York Times', 'bbc news':'BBC', 'bbc':'BBC', 'dropsite news':'Drop Site News', 'dropsitenews':'Drop Site News', 'drop site news':'Drop Site News', '972mag':'+972 Magazine', '972 mag':'+972 Magazine', '972 magazine':'+972 Magazine', '+972 magazine':'+972 Magazine', 'the guardian':'The Guardian'}
rows = []
for i, x in enumerate(A, 1):
    text = (x['title']+' '+x['summary']+' '+' '.join(x.get('categories', [x['category']]))).lower()
    lanes = [k for k, pattern in LANES.items() if re.search(pattern, text)]
    flags = []
    try:
        date = datetime.date.fromisoformat(x['date'])
        if date > TODAY: flags.append('future_stored_date')
    except ValueError: flags.append('invalid_stored_date')
    if not x['summary'].strip(): flags.append('missing_summary')
    if re.fullmatch(r'test(?:\s.*)?',x['title'].strip(),re.I): flags.append('test_title_review')
    if re.search(r'^(forbidden|access denied|unable to access|request rejected|403|404)\b',x['summary'],re.I): flags.append('scraping_error_in_summary')
    if re.search(r'contentReference\[|oaicite:|\{index=\d+\}',x['summary']): flags.append('machine_citation_artifact_review')
    if any(k not in x for k in ['author','authors','categories','documentType']): flags.append('legacy_metadata_fields_missing')
    if not x.get('authors') or all(a.lower().strip() in ['unknown author','unknown',''] for a in x.get('authors',[])): flags.append('author_unknown_or_missing')
    if '?' in x['source']: flags.append('source_text_encoding_review')
    if re.search(r'\w\?\w',x['title']+' '+x['summary']): flags.append('content_text_encoding_review')
    if len(url_groups[x['link'].strip()])>1: flags.append('exact_url_duplicate')
    if len(title_groups[re.sub(r'\W+', ' ',x['title'].lower()).strip()])>1: flags.append('same_title_review_not_automatic_duplicate')
    years = re.findall(r'\b(?:19|20)\d{2}\b',x['title']+' '+x['summary'])
    prior = sorted(set(y for y in years if y < x['date'][:4]))
    if prior: flags.append('earlier_year_mentioned_review_event_time')
    url_date = None
    path = urllib.parse.urlparse(x['link']).path
    match = re.search(r'/(20\d{2})/(\d{1,2})/(\d{1,2})(?:/|$)',path) or re.search(r'(20\d{2})-(\d{2})-(\d{2})(?:/|$)',path)
    if match:
        try: url_date = datetime.date(*map(int,match.groups())).isoformat()
        except ValueError: pass
    if url_date and url_date != x['date']: flags.append('url_date_differs_not_proof_of_error')
    source_key = re.sub(r'\s+',' ',x['source'].replace('?',' ').strip()).lower()
    rows.append(dict(audit_number=i, research_id='eog-'+hashlib.sha256((x['link']+'|'+x['title']).encode()).hexdigest()[:12],stored_date=x['date'],title=x['title'],summary=x['summary'],source_original=x['source'],source_candidate=alias.get(source_key,x['source'].replace('?',' ')),author=x.get('author',''),authors=json.dumps(x.get('authors',[]),ensure_ascii=False),document_type=x.get('documentType','Unspecified'),categories=json.dumps(x.get('categories',[x['category']]),ensure_ascii=False),source_url=x['link'],image_url=x['imageUrl'],suggested_threads='; '.join(lanes or ['Unassigned - editorial review']),flags='; '.join(flags),earlier_years_mentioned='; '.join(prior),url_date_hint=url_date or '',same_url_records='; '.join(map(str,url_groups[x['link'].strip()])) if len(url_groups[x['link'].strip()])>1 else '',review_basis='stored archive record; rules suggest routes, not verified event dates or editorial judgments',event_date_status='not supplied; requires source-based editorial review'))

with (OUT/'article-audit.csv').open('w',newline='',encoding='utf-8-sig') as f:
    writer=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator="\n");writer.writeheader();writer.writerows(rows)
(OUT/'article-audit.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
stats = dict(review_date=str(TODAY),records=len(A),unique_exact_urls=len(url_groups),stored_date_min=min(x['date'] for x in A),stored_date_max=max(x['date'] for x in A),corpus_sha256=hashlib.sha256((ROOT/'data/articles.json').read_bytes()).hexdigest(),years=dict(sorted(collections.Counter(x['date'][:4] for x in A).items())),months=dict(sorted(collections.Counter(x['date'][:7] for x in A).items())),primary_categories=dict(collections.Counter(x['category'] for x in A).most_common()),raw_source_labels=len(set(x['source'] for x in A)),raw_primary_categories=len(set(x['category'] for x in A)),document_types=dict(collections.Counter(x.get('documentType','Unspecified') for x in A)),flags=dict(collections.Counter(flag for r in rows for flag in r['flags'].split('; ') if flag)),thread_candidates=dict(collections.Counter(t for r in rows for t in r['suggested_threads'].split('; '))),duplicate_url_groups=[dict(url=u,records=ids) for u,ids in url_groups.items() if len(ids)>1],same_title_groups=[dict(title=t,records=ids) for t,ids in title_groups.items() if len(ids)>1])
(OUT/'archive-profile.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in stats.items() if k not in ['months','primary_categories','duplicate_url_groups','same_title_groups']},indent=2))
