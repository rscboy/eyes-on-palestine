export const THEMES = [
  ['life-culture','Life, culture and survival',/\b(cultur|poet|music|artist|art\b|sport|school|education|classroom|exam|play|kite|swim|beekeep|veterinary|recipe|wedding|heritage|olive|farmer|farming|livelihood|coding)/i],
  ['health-care','Health and care',/\b(health|hospital|medic|doctor|nurs|patient|disease|polio|infection|surg|amput|cancer|dialysis|sanitation|sewage|hearing|incubator)/i],
  ['food-aid','Food, water and aid',/\b(food|water|aid|hunger|starv|famine|malnutri|flour|bread|baker|convoy|humanitarian|flotilla|ghf|wfp|unrwa)/i],
  ['land-home','Land, home and displacement',/\b(displac|evacuat|settler|settlement|annex|expel|expuls|refugee|shelter|tent|home|housing|demol|rubble|rebuild|yellow line|domicide)/i],
  ['policy-military','Policy and military action',/\b(cease.?fire|truce|policy|politic|minister|netanyahu|smotrich|ben.?gvir|trump|biden|arms|weapon|military|bomb|strike|attack|hostage|diploma|recogniz|recognis)/i],
  ['rights-accountability','Rights and accountability',/\b(genocide|war crime|law\b|legal|court|icc|icj|accountab|investigat|inquiry|human rights|amnesty|b.tselem|detain|detainee|prison|torture|abuse|sexual|execution)/i],
  ['witness-record','Witness and the record',/\b(journalis|reporter|press|media|testimon|witness|censor|propaganda|surveillance|algorithm|evidence|document|archive|narrative)/i]
];
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeURL(value) { try { const url = new URL(value); return ['http:','https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
export function civilDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0,10) === value ? value : null;
}
export function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function displayDate(value, precision = 'day') {
  if (!value) return 'Date unknown';
  const date = new Date(value.slice(0,10) + 'T12:00:00Z');
  if (!Number.isFinite(+date)) return 'Date unknown';
  const options = precision === 'year' ? {year:'numeric'} : precision === 'month' ? {month:'long',year:'numeric'} : {day:'numeric',month:'long',year:'numeric'};
  return new Intl.DateTimeFormat('en', {...options, timeZone:'UTC'}).format(date);
}
export function cleanSummary(value) {
  const text = String(value || '').replace(/:?contentReference\[oaicite:\d+\]\{index=\d+\}/g,'').replace(/\[oaicite:\d+\]|\{index=\d+\}/g,'').trim();
  return /^(forbidden|access denied|unable to access|request rejected|403|404)\b/i.test(text) ? '' : text;
}
export function buildSources(articles, registry, integrity = {results:[]}, overrides = {overrides:{}}, captures = {records:{}}, cutoff = today()) {
  const checks = new Map((integrity.results || []).map(result => [String(result.original?.url || '').trim(), result]));
  const grouped = new Map(), excluded = [];
  articles.forEach((a, index) => {
    if (/^test(?:\s|$)/i.test(a.title?.trim() || '')) { excluded.push({index:index+1,reason:'test record'}); return; }
    const date = civilDate(a.date);
    if (date && date > cutoff) { excluded.push({index:index+1,reason:'future archive date'}); return; }
    const url = String(a.link || '').trim(), entry = registry.records.find(r => r.urls.includes(url));
    if (!entry) throw new Error('Missing permanent source ID: ' + url);
    const previous = grouped.get(url);
    if (previous) { previous.importNumbers.push(index+1); return; }
    const check = checks.get(url), override = overrides.overrides?.[check?.id];
    const captured = captures.records?.[url] || Object.values(captures.records || {}).find(record=>record.original_url === url || record.url === url);
    const actualCapture = safeURL(captured?.archived_url || captured?.archive_url || captured?.url || '');
    const captureURL = actualCapture && /\/web\/\d{8,14}\//.test(actualCapture) && new URL(actualCapture).hostname === 'web.archive.org' ? actualCapture : null;
    const text = [a.title,a.summary,...(a.categories || [a.category])].join(' ');
    const themes = THEMES.filter(t => t[2].test(text)).map(t => t[0]);
    const authors = (a.authors?.length ? a.authors : [a.author]).filter(v => v && !/^unknown(?: author)?$/i.test(v));
    const flags = [];
    if (!date) flags.push('Archive date unknown');
    const urlYear = url.match(/(?:\/|[-])(20\d{2})(?:\/|[-])/);
    if (date && urlYear && urlYear[1] !== date.slice(0,4)) flags.push('Date differs from URL year; review needed');
    if (!cleanSummary(a.summary)) flags.push('Summary unavailable');
    if (/contentReference\[|oaicite:/.test(a.summary || '')) flags.push('Import citation artifacts hidden');
    if (/\w\?\w/.test((a.title || '')+' '+(a.summary || ''))) flags.push('Imported text may need an encoding review');
    grouped.set(url, {id:entry.id,packetId:entry.packetId,packetAliases:entry.packetAliases,importNumbers:[index+1],title:a.title || 'Untitled source',summary:cleanSummary(a.summary),source:a.source || 'Unknown publisher',authors,documentType:a.documentType || 'Unspecified',importedDate:date,publicationDate:null,eventTime:null,dateBasis:'Archive date',url:safeURL(url),imageUrl:safeURL(a.imageUrl),themes,reviewStatus:'unreviewed',rights:null,flags,integrity:{status:override?.manual_status || override?.status || check?.effective_status || check?.status || 'unchecked',checkedAt:override?.verified_at || check?.checked_at || check?.last_checked || null,method:override ? 'Manual source review' : check ? 'Automated source check' : null,captureURL,capturedAt:captured?.archived_at || captured?.timestamp || null}});
  });
  return {sources:[...grouped.values()],excluded};
}
export function defaults() { return {mode:'events',q:'',from:'2023-01-01',to:'',themes:[],publishers:[],types:[],status:'',dates:'all',collection:'',granularity:'month',order:'oldest',selected:'',event:'',at:'',limit:30}; }
export function parseState(search) {
  const p = new URLSearchParams(search), state = defaults();
  for (const k of ['q','collection','selected','event']) state[k] = (p.get(k) || '').slice(0,k === 'q' ? 300 : 100);
  for (const k of ['from','to']) state[k] = civilDate(p.get(k)) || (k==='from'?'2023-01-01':'');
  if (state.from && state.to && state.from > state.to) [state.from,state.to] = [state.to,state.from];
  if(state.from && state.from<'2023-01-01')state.from='2023-01-01';
  state.at = civilDate(p.get('at')) || '';
  if(state.at && state.at<'2023-01-01')state.at='2023-01-01';
  state.mode = p.has('mode') ? (p.get('mode')==='events'?'events':'sources') : (p.get('v')==='1'||['at','from','to','q','selected','collection','themes','publishers','types'].some(k=>p.has(k))?'sources':'events');
  state.themes = (p.get('themes') || '').split(',').filter(id => THEMES.some(t=>t[0]===id) || id==='unassigned');
  for (const k of ['publishers','types']) state[k] = (p.get(k) || '').split('|').filter(Boolean).slice(0,160);
  state.status = ['unchecked','available','restricted','removed','changed','preserved'].includes(p.get('status')) ? p.get('status') : '';
  state.dates = ['unknown','review'].includes(p.get('dates')) ? p.get('dates') : 'all';
  state.granularity = ['day','month','year'].includes(p.get('group')) ? p.get('group') : 'month';
  state.order = p.get('order') === 'newest' ? 'newest' : 'oldest';
  state.limit = Math.min(5000,Math.max(30, Number.parseInt(p.get('limit'),10) || 30));
  return state;
}
export function stateURL(state) {
  const p = new URLSearchParams(), base = defaults(); p.set('v','2'); p.set('mode',state.mode);
  for (const k of ['q','from','to','status','dates','collection','selected','event','at','order','limit']) if (state[k] !== base[k] && state[k]) p.set(k,state[k]);
  if (state.granularity !== base.granularity) p.set('group',state.granularity);
  for (const k of ['themes','publishers','types']) if (state[k].length) p.set(k,state[k].join(k==='themes' ? ',' : '|'));
  return '?' + p.toString();
}
export function statusGroup(record) {
  const s = record.integrity?.status || 'unchecked';
  if (s==='live' || s==='redirected' || s==='confirmed_live') return 'available';
  if (/blocked/.test(s)) return 'restricted';
  if (s==='removed_confirmed' || s==='confirmed_removed') return 'removed';
  if (/changed/.test(s)) return 'changed';
  return 'unchecked';
}
export function statusLabel(record) {
  return {available:'Available when checked',restricted:'Access restricted when checked',removed:'Removed with confirmation',changed:'Changed since previous check',unchecked:record.integrity?.status==='unchecked' ? 'Not checked' : 'Under review'}[statusGroup(record)];
}
export function filterSources(records, state, collections = []) {
  const words = state.q.toLowerCase().trim().split(/\s+/).filter(Boolean), route = collections.find(c=>c.id===state.collection);
  return records.filter(r => {
    if (route && !route.sourceIds.includes(r.id)) return false;
    const date = r.publicationDate || r.importedDate;
    if ((state.from || state.to) && (!date || (state.from && date < state.from) || (state.to && date > state.to))) return false;
    if (state.dates==='unknown' && date) return false;
    if (state.dates==='review' && !r.flags.some(x=>/^Date differs|Archive date/.test(x))) return false;
    if (state.themes.length && !state.themes.some(t=>t==='unassigned' ? !r.themes.length : r.themes.includes(t))) return false;
    if (state.publishers.length && !state.publishers.includes(r.source)) return false;
    if (state.types.length && !state.types.includes(r.documentType)) return false;
    if (state.status && (state.status==='preserved' ? !r.integrity.captureURL : statusGroup(r)!==state.status)) return false;
    const text = [r.title,r.summary,r.source,r.searchText||'',...r.authors].join(' ').toLowerCase();
    return words.every(w=>text.includes(w));
  }).sort((a,b) => {
    const ad=a.publicationDate || a.importedDate, bd=b.publicationDate || b.importedDate;
    if (!ad || !bd) return ad ? -1 : bd ? 1 : a.id.localeCompare(b.id);
    return (state.order==='oldest' ? ad.localeCompare(bd) : bd.localeCompare(ad)) || a.id.localeCompare(b.id);
  });
}
export function periodCounts(records, granularity='year') {
  const size = {year:4,month:7,day:10}[granularity], counts = new Map();
  for (const r of records) { const key=(r.publicationDate || r.importedDate)?.slice(0,size) || 'unknown'; counts.set(key,(counts.get(key)||0)+1); }
  return [...counts].sort(([a],[b])=>a.localeCompare(b));
}
export function periodRange(key) {
  if (/^\d{4}$/.test(key)) return [key+'-01-01',key+'-12-31'];
  if (/^\d{4}-\d{2}$/.test(key)) { const [y,m]=key.split('-').map(Number); return [key+'-01',key+'-'+new Date(Date.UTC(y,m,0)).getUTCDate()]; }
  return [civilDate(key) || '',civilDate(key) || ''];
}
export function citation(record, style='plain') {
  const author = record.authors?.length ? record.authors.join(', ') : record.source, date = record.publicationDate || 'n.d.', title=record.title, url=record.integrity.captureURL || record.url;
  const note = record.publicationDate ? '' : `\nArchive date: ${record.importedDate || 'unknown'}; publication date awaiting verification.`;
  if (style==='apa') return `${author}. (${date}). ${title}. ${record.source}. ${url}${note}`;
  if (style==='mla') return `${author}. “${title}.” ${record.source}, ${date}, ${url}.${note}`;
  if (style==='chicago') return `${author}. “${title}.” ${record.source}. ${date}. ${url}.${note}`;
  return `${title}\n${record.source}${record.authors.length ? ' — '+record.authors.join(', ') : ' — Author unknown'}\n${record.publicationDate ? 'Published: '+record.publicationDate : 'Publication date: unverified'}\nArchive date: ${record.importedDate || 'unknown'}\nOriginal: ${record.url}\n${record.integrity.captureURL ? 'Preserved copy: '+record.integrity.captureURL : 'No preserved copy recorded.'}`;
}
export function relatedSources(selected, records, collections) {
  const collection=collections.find(c=>c.sourceIds.includes(selected.id));
  if (collection) return {label:collection.title,kind:'Related by subject',records:records.filter(r=>collection.sourceIds.includes(r.id))};
  const tokens = selected.title.toLowerCase().match(/[a-z]{5,}/g) || [];
  const stop = new Set(['israel','israeli','palestinian','palestinians','gazas','killed','people','against','their','after','about','under','could','would','during','gaza','report','reports']);
  const scored = records.filter(r=>r.id!==selected.id && r.themes.some(t=>selected.themes.includes(t))).map(r=>({r,score:tokens.filter(t=>!stop.has(t) && r.title.toLowerCase().includes(t)).length})).filter(x=>x.score>=2).sort((a,b)=>b.score-a.score || a.r.id.localeCompare(b.r.id)).slice(0,6).map(x=>x.r);
  return {label:'Suggested reading connections',kind:'Related by theme and title',records:[selected,...scored]};
}
export function validateEditorial(editorial, records) {
  const errors=[], archiveIds=new Set(records.map(r=>r.id)), ids=new Set([...archiveIds,...(editorial.references||[]).map(r=>r.id)]), approved=new Set((editorial.events || []).filter(e=>e.status==='approved').map(e=>e.id));
  const entityIds=new Set([...ids,...(editorial.events || []).map(e=>e.id)]);
  const referenceIds=new Set();
  for(const r of editorial.references||[]){
    if(referenceIds.has(r.id)||archiveIds.has(r.id))errors.push(`Duplicate reference ID: ${r.id}`);referenceIds.add(r.id);
    if(!r.id||!r.title||!r.source||!safeURL(r.url)||!civilDate(r.checkedAt)||!r.method)errors.push(`Incomplete reference: ${r.id}`);
    if(r.publicationDate&&(!civilDate(r.publicationDate)||r.publicationDate>today()))errors.push(`Invalid reference publication date: ${r.id}`);
  }
  const seen=new Set();
  for (const e of editorial.events || []) {
    if (seen.has(e.id)) errors.push(`Duplicate event ID: ${e.id}`); seen.add(e.id);
    if (!['draft','in_review','approved'].includes(e.status)) errors.push(`Invalid event status: ${e.id}`);
    if (e.status !== 'approved') continue;
    if(e.kind && !['event','finding'].includes(e.kind))errors.push(`Invalid event kind: ${e.id}`);
    if(e.humanImpact){
      const impact=e.humanImpact;
      if(!impact.text || !impact.locator || !impact.sourceIds?.length || !civilDate(impact.asOf) || impact.asOf>today())errors.push(`Incomplete human impact evidence: ${e.id}`);
      for(const id of impact.sourceIds||[])if(!ids.has(id) || !e.sourceIds?.includes(id))errors.push(`Unknown impact source: ${e.id}/${id}`);
    }
    for(const id of e.archiveSourceIds||[])if(!archiveIds.has(id))errors.push(`Unknown archive reading source: ${id}`);
    if (!e.review?.reviewer || !e.review?.reviewedAt || !e.eventTime?.rationale || !e.sourceIds?.length || !e.title || !e.summary) errors.push(`Incomplete approved event: ${e.id}`);
    if (!['day','month','year','interval','approximate','unknown'].includes(e.eventTime?.precision)) errors.push(`Invalid event precision: ${e.id}`);
    const start=e.eventTime?.start,end=e.eventTime?.end;
    if (start && !civilDate(start) || end && !civilDate(end) || start && end && start>end) errors.push(`Invalid event interval: ${e.id}`);
    if (start && start>today() || end && end>today()) errors.push(`Future event: ${e.id}`);
    if (e.eventTime?.precision!=='unknown' && !start) errors.push(`Missing event bounds: ${e.id}`);
    if (!e.eventTime?.label) errors.push(`Missing event date label: ${e.id}`);
    for (const id of [...(e.sourceIds||[]),...(e.eventTime?.sourceIds||[])]) if (!ids.has(id)) errors.push(`Unknown supporting source: ${id}`);
    if (!e.eventTime?.sourceIds?.length) errors.push(`Missing date evidence: ${e.id}`);
    for (const sourceId of e.sourceIds || []) if (!(editorial.relationships || []).some(r=>r.status==='approved' && r.from===sourceId && r.to===e.id)) errors.push(`Missing approved source relationship: ${e.id}/${sourceId}`);
  }
  for (const r of editorial.relationships || []) {
    if (!entityIds.has(r.from) || !entityIds.has(r.to)) errors.push(`Unknown relationship endpoint: ${r.id}`);
    if (!['reports-on','investigates','revisits','responds-to','cites','updates','corrects'].includes(r.type)) errors.push(`Invalid relationship type: ${r.id}`);
    if (r.status==='approved' && (!r.explanation || !r.evidence?.length || !r.review?.reviewer || !r.review?.reviewedAt)) errors.push(`Incomplete approved relationship: ${r.id}`);
    if (r.status==='approved' && r.evidence?.some(e=>!ids.has(e.sourceId) || !e.locator)) errors.push(`Invalid relationship evidence: ${r.id}`);
  }
  for (const c of editorial.collections || []) for (const id of c.sourceIds) if (!ids.has(id)) errors.push(`Unknown collection source: ${id}`);
  return errors;
}
