"""Build portable, self-contained reading copies of the timeline research documents."""
from pathlib import Path
import csv, html, json, re, unicodedata
ROOT=Path(__file__).resolve().parent
A=json.loads((ROOT/'article-audit.json').read_text())
roles={
203:'Imported date conflicts with dated source URL; review before establishing coverage.',
226:'Unusually early date attached to a contemporary policy subject; source review required.',
196:'Test-like record; editorial quarantine.',
318:'Historical event versus later reporting; retain date precision.',
408:'Investigation revisits an earlier event.',
538:'Family account reported much later than the described experience.',
720:'A legal complaint is both a later moment and a source concerning an earlier event.',
71:'Recovery activity linked to an earlier incident.',
482:'Initial account in the Nasser Hospital source bundle.',
484:'Another initial report; compare sources without erasing differences.',
502:'Later visual reporting about the same incident.',
503:'Subsequent visual investigation.',
604:'Further reporting on a specific aspect of the incident.',
44:'Later investigation/revisit in 2026.',
40:'Anniversary reporting; publication is not original event time.',
477:'Food-security classification reporting; distinguish from warnings.',
481:'Multiple reports of a classification; do not count articles as independent assessments.',
994:'Later food-security assessment; retain geographic scope and measurement period.',
363:'NGO assessment; preserve institution and attribution.',
569:'Commission finding; do not label as final court judgment.',
52:'Swimming and disability: agency and rehabilitation within the chronology.',
81:'Beekeeping and livelihood: everyday life merits its own navigational standing.',
153:'Play: document lives beyond a casualty abstraction.',
171:'Veterinary work: professional care and community continuity.',
236:'Digital work and coding: retain people as actors.',
1279:'Education and graduation: a thematic life route.',
1284:'Family reunion after a long separation; multiple relevant times.',
1332:'Wedding/community life: avoid an imposed uplifting conclusion.',
1336:'Residents restoring streets: recovery as an activity.',
1342:'Young artists: cultural expression and named agency.',
1340:'Archive a circulating allegation without converting it into a fact.',
882:'Impact estimate requires definition, period and source; not interchangeable with direct counts.',
884:'Statistical estimate has a defined observation interval.',
885:'A quoted estimate/claim requires careful attribution and verification.',
146:'Scraping error is not a usable summary.',
460:'Access restriction must not appear as an article summary.',
543:'Exact repeated URL group: public consolidation with internal audit preserved.',
1196:'Repeated source URL: review source counts.',
1202:'Stored removal note needs preservation/check evidence and timestamp.'
}
rows=['| Audit # | Stored date | Source record | Design implication |','|---:|---|---|---|']
for n,role in roles.items():
 r=A[n-1]
 title=r['title'].replace('|',' / ').replace('\n',' ')
 rows.append(f"| {n} | {r['stored_date']} | [{title}]({r['source_url']}) | {role} |")
p=ROOT/'echoes-of-gaza-timeline-research.md'
t=p.read_text().replace('<!-- ARTICLE_DOSSIER -->','\n'.join(rows))
p.write_text(t)
updates={20:'https://www.loc.gov/collections/world-war-ii-maps-military-situation-maps-from-1944-to-1945/articles-and-essays/the-battle-of-the-bulge/interactive-timeline/',21:'https://www.loc.gov/collections/songs-of-america/articles-and-essays/timeline/',25:'https://timeandnavigation.si.edu/timeline2',44:'https://www.royalhampshireregiment.org/about-the-museum/timeline/',60:'https://www.civilwaronthewesternborder.org/timeline',80:'https://collections.library.utoronto.ca/explore/insulin/about/timeline',89:'https://fortepan.us/ia/'}
with (ROOT/'research-register.tsv').open() as f: regs=list(csv.DictReader(f,delimiter='\t'))
for i,r in enumerate(regs,1):
 if i in updates:r['url']=updates[i]
with (ROOT/'research-register.tsv').open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=list(regs[0]),delimiter='\t',lineterminator='\n');w.writeheader();w.writerows(regs)
status=json.loads((ROOT/'evidence/comparison-page-review.json').read_text())
for i,r in enumerate(regs,1):
 r['id']=i;r['review_date']='2026-10-03'
 r['evidence_level']='Indexed primary-site evidence; initial fetch failed' if status[i-1]['open_failed'] else 'Page text / project documentation'
 if i in [94,95]:r['evidence_level']='Retired/redirected; legacy reference'
 r['hands_on_scope']={1:'Desktop overview and navigation',3:'Desktop overview and healthcare-theme selection',29:'Desktop overview',41:'About page only'}.get(i,'Not tested interactively')
with (ROOT/'research-register.csv').open('w',newline='',encoding='utf-8-sig') as f:
 w=csv.DictWriter(f,fieldnames=list(regs[0]),lineterminator='\n');w.writeheader();w.writerows(regs)

def inline(s):
 s=html.escape(s)
 s=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',lambda m:'<a href="'+m[2]+'">'+m[1]+'</a>',s)
 s=re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',s)
 return s
def slug(s):
 return re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()).strip('-')
def render(text):
 lines=text.splitlines();out=[];toc=[];i=0
 while i<len(lines):
  line=lines[i]
  if not line.strip():i+=1;continue
  if line.startswith('~~~'):
   lang=line[3:].strip();i+=1;block=[]
   while i<len(lines) and not lines[i].startswith('~~~'):block.append(lines[i]);i+=1
   out.append('<pre><code>'+html.escape('\n'.join(block))+'</code></pre>');i+=1;continue
  m=re.match(r'^(#{1,6})\s+(.+)$',line)
  if m:
   n=len(m[1]);s=m[2];id=slug(s);out.append(f'<h{n} id="{id}">'+inline(s)+f'</h{n}>')
   if n==2:toc.append((id,s))
   i+=1;continue
  if line.startswith('|'):
   tbl=[]
   while i<len(lines) and lines[i].startswith('|'):
    tbl.append([x.strip() for x in lines[i].strip('|').split('|')]);i+=1
   out.append('<div class="table-scroll" tabindex="0" aria-label="Scrollable data table"><table><thead><tr>'+''.join('<th scope="col">'+inline(c)+'</th>' for c in tbl[0])+'</tr></thead><tbody>')
   for row in tbl[2:]:out.append('<tr>'+''.join('<td>'+inline(c)+'</td>' for c in row)+'</tr>')
   out.append('</tbody></table></div>');continue
  if re.match(r'^(?:- |\d+\. )',line):
   ordered=bool(re.match(r'^\d+\. ',line));tag='ol' if ordered else 'ul';out.append('<'+tag+'>')
   while i<len(lines) and re.match(r'^(?:- |\d+\. )',lines[i]):
    out.append('<li>'+inline(re.sub(r'^(?:- |\d+\. )','',lines[i]))+'</li>');i+=1
   out.append('</'+tag+'>');continue
  para=[line];i+=1
  while i<len(lines) and lines[i].strip() and not re.match(r'^(?:#|\||~~~|- |\d+\. )',lines[i]):
   para.append(lines[i]);i+=1
  out.append('<p>'+inline(' '.join(para))+'</p>')
 return '\n'.join(out),toc

CSS="""*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}body{margin:0;background:#f4f1e9;color:#24251f;font:17px/1.7 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:#6e2634;text-underline-offset:3px;overflow-wrap:anywhere}a:hover{color:#9b1b30}button,input{font:inherit}a:focus-visible,button:focus-visible,input:focus-visible,[tabindex]:focus-visible{outline:3px solid #836500;outline-offset:4px}.skip{position:absolute;top:-100px;left:16px;background:#fff;padding:12px;z-index:20}.skip:focus{top:12px}.masthead{background:#0a0a0a;color:#ece7df;padding:28px max(24px,calc((100vw - 1420px)/2));display:flex;justify-content:space-between;gap:20px;align-items:center}.brand{font-size:13px;letter-spacing:.12em;text-transform:uppercase}.masthead a{color:#c9a84c}.layout{display:grid;grid-template-columns:250px minmax(0,1fr);max-width:1420px;margin:auto;gap:56px;padding:54px 32px}.toc{position:sticky;top:24px;align-self:start;max-height:90vh;overflow:auto;font-size:13px;line-height:1.5}.toc strong{display:block;margin-bottom:18px;letter-spacing:.08em}.toc a{display:block;padding:8px 0;color:#4d5046;text-decoration:none;border-bottom:1px solid #ddd8cc}.toc a:hover{text-decoration:underline}main{min-width:0;max-width:1080px}h1{font-family:Georgia,serif;font-size:clamp(48px,5vw,76px);line-height:1.06;font-weight:400;margin:0 0 22px;letter-spacing:-.035em}h2{font:400 32px/1.25 Georgia,serif;border-top:1px solid #b8b2a8;padding-top:38px;margin:64px 0 24px}h3{font-size:21px;line-height:1.4;margin:32px 0 12px}p{margin:0 0 20px}li{margin:8px 0}strong{font-weight:650}main>p:first-of-type{font-size:14px;color:#626457}.table-scroll{overflow:auto;margin:24px 0 36px;border:1px solid #d5d0c5;border-radius:4px}table{width:100%;border-collapse:collapse;font-size:14px;line-height:1.55}th,td{text-align:left;vertical-align:top;padding:14px 16px;border-bottom:1px solid #ddd8cc}th{background:#e9e4d9;font-weight:650}tr:last-child td{border-bottom:0}tbody tr:nth-child(even){background:#f8f6f0}pre{overflow:auto;background:#e9e4d9;padding:22px;border-radius:4px;font-size:13px;line-height:1.6}figure{margin:34px 0}figure img{width:100%;height:auto;border:1px solid #c9c3b6;border-radius:6px}figcaption{font-size:13px;color:#626457;margin-top:12px}.register-search{padding:18px;background:#e9e4d9;margin:18px 0;border-radius:4px}.register-search label{display:block;font-weight:650;margin-bottom:8px}.register-search input{width:100%;min-height:44px;padding:9px 12px;background:#fffdf8;border:1px solid #999384;border-radius:4px}.register-search output{display:block;font-size:13px;margin-top:8px}.tools{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}.tools a,.tools button{display:inline-block;background:#0a0a0a;color:#ece7df;border:1px solid #0a0a0a;min-height:44px;padding:10px 18px;border-radius:4px;text-decoration:none;cursor:pointer}.footer{border-top:1px solid #d5d0c5;padding:30px;font-size:13px;color:#626457;text-align:center}[hidden]{display:none!important}@media(max-width:1000px){.layout{gap:28px;grid-template-columns:205px minmax(0,1fr)}}@media(max-width:760px){body{font-size:16px}.masthead{padding:20px;align-items:flex-start;flex-direction:column}.layout{display:block;padding:28px 20px}.toc{position:static;max-height:none;margin-bottom:36px}.toc details:not([open]){padding-bottom:12px}.toc a{padding:10px 0}.table-scroll{margin-left:0;margin-right:0}h2{font-size:27px;margin-top:48px}th,td{min-width:120px;padding:12px}figure img{min-width:600px}figure{overflow:auto}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}@media print{body{background:#fff;font:10pt/1.45 Georgia,serif;color:#000}.masthead,.toc,.tools,.register-search,.skip{display:none}.layout{display:block;max-width:none;padding:0}main{max-width:none}h1{font-size:32pt}h2{font-size:19pt;break-after:avoid;margin:28pt 0 10pt;padding-top:12pt}h3{font-size:13pt;break-after:avoid}p,li{orphans:3;widows:3}table{font:8pt/1.4 system-ui}.table-scroll{overflow:visible;border:0}th,td{padding:6pt;min-width:0}thead{display:table-header-group}tr{break-inside:avoid}a{color:#000}figure{break-inside:avoid}figure img{min-width:0}pre{white-space:pre-wrap;break-inside:avoid}.footer{font-size:8pt}}"""
for name in ['echoes-of-gaza-timeline-research','echoes-of-gaza-timeline-prompt']:
 text=(ROOT/(name+'.md')).read_text();body,toc=render(text);isreport=name.endswith('research')
 if isreport:
  hook='<h3 id="2-2-three-separate-clocks">'
  figure='<figure><img src="timeline-concept.svg" alt="Concept wireframe: a shared date range and seven theme filters above a chronological reading list, with a source detail panel showing later reports connected to an earlier event. A separate mobile layout stacks controls, dates and cards."><figcaption>Concept wireframe. Illustrative layout; dates and connections are draft design fixtures, not a verified public event record.</figcaption></figure>'
  body=body.replace(hook,figure+hook)
  start=body.index('<h2 id="10-research-register-100-comparative-timeline-projects">')
  tbl=body.index('<div class="table-scroll"',start)
  form='<div class="register-search"><label for="registerQuery">Search the 100-project register</label><input id="registerQuery" type="search" placeholder="Search project, topic, pattern or lesson"><output id="registerCount" aria-live="polite">100 projects</output></div>'
  body=body[:tbl]+form+body[tbl:]
 tools='<div class="tools"><a href="'+name+'.md" download>Download Markdown</a><button type="button" id="printButton">Print / save PDF</button>'
 if isreport:tools+='<a href="echoes-of-gaza-timeline-prompt.html">Read the implementation prompt</a><a href="article-audit.csv" download>Download article audit</a>'
 else:tools+='<button type="button" id="copyButton">Copy complete prompt</button><span id="copyStatus" role="status"></span>'
 tools+='</div>'
 nav=''.join('<a href="#'+id+'">'+html.escape(label)+'</a>' for id,label in toc)
 script="""document.getElementById('printButton').addEventListener('click',()=>window.print());const query=document.getElementById('registerQuery');if(query){const table=query.parentElement.nextElementSibling.querySelector('table');const rows=[...table.tBodies[0].rows];query.addEventListener('input',()=>{const q=query.value.toLocaleLowerCase().trim();let n=0;rows.forEach(row=>{const match=row.textContent.toLocaleLowerCase().includes(q);row.hidden=!match;if(match)n++;});document.getElementById('registerCount').textContent=n+' of 100 projects';});window.addEventListener('beforeprint',()=>rows.forEach(row=>row.hidden=false));window.addEventListener('afterprint',()=>query.dispatchEvent(new Event('input')));}const copy=document.getElementById('copyButton');if(copy)copy.addEventListener('click',async()=>{const status=document.getElementById('copyStatus');try{await navigator.clipboard.writeText(document.getElementById('promptSource').textContent);status.textContent='Complete prompt copied.';}catch{status.textContent='Clipboard unavailable. Use the Markdown download to copy the prompt.';}});"""
 embedded='<script type="text/plain" id="promptSource">'+text.replace('</script','<\\/script')+'</script>' if not isreport else ''
 title='Threads of Witness — '+('Research brief' if isreport else 'Implementation prompt')
 doc='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><style>'+CSS+'</style></head><body><a class="skip" href="#main">Skip to document</a><header class="masthead"><span class="brand">Echoes of Gaza / Timeline research</span><span>October 3, 2026 · Prepared for review</span></header><div class="layout"><nav class="toc" aria-label="Document contents"><details open><summary><strong>Contents</strong></summary>'+nav+'</details></nav><main id="main">'+tools+body+'</main></div><footer class="footer">Research and design documents only. Source bodies and curated event facts require editorial review.</footer>'+embedded+'<script>'+script+'</script></body></html>'
 (ROOT/(name+'.html')).write_text(doc)
print(json.dumps({'article_audit_rows':len(A),'comparison_rows':len(regs),'documents':[str(ROOT/(n+'.html')) for n in ['echoes-of-gaza-timeline-research','echoes-of-gaza-timeline-prompt']]},indent=2))
