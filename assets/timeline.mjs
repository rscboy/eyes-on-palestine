import {THEMES,escapeHTML as h,displayDate,civilDate,today,defaults,parseState,stateURL,filterSources,periodCounts,periodRange,statusLabel,citation,relatedSources,validateEditorial} from './timeline-core.mjs';
const $=id=>document.getElementById(id), packetAPI=globalThis.EogPacket;
let state=parseState(location.search), snapshot, sources=[], editorial={events:[],relationships:[],collections:[]}, filtered=[], packet=packetAPI.read(), searchTimer, feedbackTimer, loading=true;
const placeholder=$('tw-detail').innerHTML, notesKey='echoes_timeline_private_notes';
let imagePreference=true, autoLoad=true, revealObserver, moreObserver, scrollFrame=false;
try { imagePreference=localStorage.getItem('echoes_timeline_images')!=='hidden'; autoLoad=localStorage.getItem('echoes_timeline_auto_load')!=='off'; } catch {}
const reducedMotion=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
function syncPreferences() {
 document.body.classList.toggle('tw-images-hidden',!imagePreference);
 $('tw-image-toggle').setAttribute('aria-pressed',String(imagePreference));$('tw-image-toggle').textContent=imagePreference?'Images on':'Images hidden';
 $('tw-auto-load').setAttribute('aria-pressed',String(autoLoad));$('tw-auto-load').textContent=autoLoad?'Continuous browsing on':'Load more manually';
}
const monthKeys=()=>{const last=(snapshot?.latest || today()).slice(0,7),keys=[];for(let y=2023;y<=Number(last.slice(0,4));y++)for(let m=1;m<=12;m++){const key=`${y}-${String(m).padStart(2,'0')}`;if(key<=last)keys.push(key);}return keys;};
function updateReadingPosition() {
 if(state.selected && innerWidth<=900)return;
 const cards=[...$('tw-records').children],edge=$('tw-overview').getBoundingClientRect().bottom+30;
 let lo=0,hi=cards.length;
 while(lo<hi){const middle=(lo+hi)>>1;if(cards[middle].getBoundingClientRect().bottom>edge)hi=middle;else lo=middle+1;}
 const visible=cards[lo];
 if(!visible)return;
 const date=visible.dataset.date;
 if(date){$('tw-current-period').textContent=displayDate(date,'month');document.querySelectorAll('#tw-years button').forEach(b=>b.classList.toggle('is-reading',b.dataset.period===date.slice(0,4)));}
 const index=Number(visible.dataset.position||0);
 const listRect=$('tw-records').getBoundingClientRect();
 $('tw-records').style.setProperty('--thread-depth',`${Math.max(0,Math.min(listRect.height,edge-listRect.top))}px`);
 $('tw-scroll-progress').style.setProperty('--read-progress',`${filtered.length ? ((index+1)/filtered.length)*100 : 0}%`);
}
function enhanceCards() {
 if('IntersectionObserver' in window && !reducedMotion()){
  document.body.classList.add('tw-motion-ready');
  revealObserver?.disconnect();revealObserver=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add('is-revealed');revealObserver.unobserve(e.target);}},{rootMargin:'40px',threshold:.03});
  $('tw-records').querySelectorAll('.tw-record:not(.is-revealed)').forEach(el=>revealObserver.observe(el));
 }
 moreObserver?.disconnect();
 if(autoLoad && !state.selected && !$('tw-more').hidden && 'IntersectionObserver' in window){moreObserver=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))loadMore(false);},{rootMargin:'240px'});moreObserver.observe($('tw-more'));}
 requestAnimationFrame(updateReadingPosition);
}
function loadMore(focus=true) {
 const oldCount=Math.min(state.limit,filtered.length);if(oldCount>=filtered.length)return;
 const previous=filtered[oldCount-1],lastDate=previous?.publicationDate||previous?.importedDate;
 let key=lastDate?.slice(0,{day:10,month:7,year:4}[state.granularity])||'unknown';
 state.limit+=30;
 $('tw-records').insertAdjacentHTML('beforeend',filtered.slice(oldCount,state.limit).map((r,i)=>{const result=row(r,oldCount+i,key);key=result.key;return result.html;}).join(''));
 history.replaceState({...history.state,scroll:window.scrollY},'',stateURL(state));
 $('tw-more').hidden=filtered.length<=state.limit;$('tw-shown').textContent=`Showing ${Math.min(state.limit,filtered.length)} of ${filtered.length.toLocaleString()}.`;
 enhanceCards();syncSaveButtons();if(focus&&filtered[oldCount])$('link-'+filtered[oldCount].id)?.focus();
 say(`${Math.min(state.limit,filtered.length)} of ${filtered.length.toLocaleString()} records available in the timeline.`);
}

const currentRecord=()=>[...sources,...editorial.events.filter(e=>e.status==='approved')].find(r=>r.id===state.selected);
const recordURL=id=>'timeline.html'+stateURL({...state,selected:id});
const saved=r=>packet.includes(r.packetId);
function say(message) {$('tw-announcement').textContent=message;}
function feedback(message) {$('tw-feedback').textContent=message;$('tw-feedback').hidden=false;clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>$('tw-feedback').hidden=true,4500);}
function persistPacket() {const persisted=packetAPI.write(packet);if(!persisted)feedback('Browser storage is unavailable. Your packet lasts for this visit only.');}
function save(r) {if(!r?.packetId)return;packet=saved(r)?packet.filter(id=>id!==r.packetId):[...packet,r.packetId];persistPacket();syncSaveButtons();renderPacket();feedback(saved(r)?'Source saved to your research packet.':'Source removed from your research packet.');}
function syncSaveButtons() {document.querySelectorAll('[data-save]').forEach(button=>{const r=sources.find(s=>s.id===button.dataset.save);const active=r&&saved(r);button.setAttribute('aria-pressed',String(Boolean(active)));button.textContent=active?'Saved ✓':'Save source';});$('tw-packet-count').textContent=sources.filter(saved).length;}
function commit(patch,{replace=false,focus='',scroll=null}={}) {
  history.replaceState({...history.state,scroll:window.scrollY,focusId:document.activeElement?.id || ''},'',location.href);
  state={...state,...patch};
  history[replace?'replaceState':'pushState']({scroll:scroll ?? window.scrollY,focusId:focus,opened:Boolean(patch.selected)},'',stateURL(state));
  syncControls();render();
  if(focus) requestAnimationFrame(()=>$(focus)?.focus({preventScroll:true}));
  if(scroll!==null) requestAnimationFrame(()=>window.scrollTo({top:scroll,behavior:'instant'}));
}
function openRecord(id) {commit({selected:id},{focus:'tw-detail-title'});$('tw-detail').scrollTop=0;if(matchMedia('(max-width:900px)').matches)requestAnimationFrame(()=>$('tw-detail').scrollIntoView({block:'start',behavior:'instant'}));}
function closeDetail() {if(history.state?.opened)history.back();else commit({selected:''},{focus:'tw-results-title'});}
function values(name) {return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(i=>i.value);}
function applyForm(replace=false) {
  const from=$('tw-from').value,to=$('tw-to').value;
  if(from&&from<'2023-01-01'){$('tw-from').setCustomValidity('The timeline starts in 2023.');$('tw-from').reportValidity();return;}
  $('tw-from').setCustomValidity('');
  if(from&&to&&from>to) {$('tw-to').setCustomValidity('The end date must be on or after the start date.');$('tw-to').reportValidity();return;}
  $('tw-to').setCustomValidity('');
  commit({q:$('tw-query').value.trim(),from,to,themes:values('theme'),publishers:values('publisher'),types:values('type'),status:$('tw-status').value,dates:$('tw-dates').value,limit:30},{replace});
}
function syncControls() {
  for(const k of ['q','from','to','status','dates'])$(k==='q'?'tw-query':'tw-'+k).value=state[k];
  $('tw-group').value=state.granularity;$('tw-order').value=state.order;
  for(const [name,key] of [['theme','themes'],['publisher','publishers'],['type','types']])document.querySelectorAll(`input[name="${name}"]`).forEach(i=>i.checked=state[key].includes(i.value));
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));
  $('tw-advanced').hidden=state.mode==='events';
  document.body.classList.toggle('tw-reading-mobile',Boolean(state.selected&&currentRecord()));
  document.body.classList.toggle('tw-has-selection',Boolean(state.selected));
}
function renderFacets() {
  $('tw-theme-controls').innerHTML=[...THEMES.map(([id,label])=>[id,label]),['unassigned','Unassigned']].map(([id,label])=>`<label class="tw-theme"><input type="checkbox" name="theme" value="${id}"><span>${h(label)}</span></label>`).join('');
  for(const [target,name,key] of [['tw-publishers','publisher','source'],['tw-types','type','documentType']]) {
    const counts=new Map();sources.forEach(r=>counts.set(r[key],(counts.get(r[key])||0)+1));
    $(target).innerHTML=[...counts].sort(([a],[b])=>a.localeCompare(b)).map(([value,count])=>`<label><input type="checkbox" name="${name}" value="${h(value)}"><span>${h(value)} <small>(${count})</small></span></label>`).join('');
  }
  $('tw-routes').innerHTML=editorial.collections.map(c=>`<a class="tw-route" href="${h('timeline.html'+stateURL({...defaults(),collection:c.id,order:'oldest'}))}" data-route="${h(c.id)}"><h2>${h(c.title)} ↗</h2><p>${h(c.description)}</p></a>`).join('');
}
function renderChips() {
  const chips=[];
  if(state.q)chips.push(['q','Search: '+state.q]);
  if((state.from&&state.from!=='2023-01-01')||state.to)chips.push(['range',`${state.from?displayDate(state.from):'2023'} → ${state.to?displayDate(state.to):'latest record'}`]);
  state.themes.forEach(id=>chips.push(['theme:'+id,THEMES.find(t=>t[0]===id)?.[1]||'Unassigned']));
  state.publishers.forEach(p=>chips.push(['publisher:'+p,p]));state.types.forEach(t=>chips.push(['type:'+t,t]));
  if(state.collection)chips.push(['collection',editorial.collections.find(c=>c.id===state.collection)?.title||'Unknown reading route']);
  if(state.status)chips.push(['status','Source status: '+state.status]);if(state.dates!=='all')chips.push(['dates','Date: '+state.dates]);
  $('tw-active-filters').innerHTML=chips.map(([key,label])=>`<button type="button" data-remove-filter="${h(key)}" aria-label="${h('Remove filter: '+label)}">${h(label)} <span aria-hidden="true">×</span></button>`).join('');
}
function eventRecords() {
  return editorial.events.filter(e=>e.status==='approved').map(e=>({...e,importedDate:e.eventTime.start,publicationDate:null,authors:[],source:'Reviewed chronology',documentType:'Event',flags:e.eventTime.precision==='unknown'?['Archive date unknown']:[],integrity:{status:'unchecked'},dateBasis:'Event date'}));
}
function getRecords(ignoreRange=false) {
  const s={...state,...(ignoreRange?{from:'',to:''}:{})};
  if(s.dates==='unknown'){s.from='';s.to='';}
  if(state.mode==='events') {s.publishers=[];s.types=[];s.status='';s.collection='';s.dates=state.dates==='unknown'?'unknown':'all';return filterSources(eventRecords(),s);}
  return filterSources(sources.filter(r=>!r.importedDate||r.importedDate>='2023-01-01'),s,editorial.collections);
}
function renderOverview() {
 const records=getRecords(true),countMap=new Map(periodCounts(records,'year')),activeYear=state.from?.slice(0,4)&&state.from.slice(0,4)===state.to?.slice(0,4)?state.from.slice(0,4):'';
 const years=Array.from({length:Number(snapshot.latest.slice(0,4))-2023+1},(_,i)=>String(2023+i));
 const monthly=new Map(periodCounts(records,'month'));
 const sparkline=year=>{const values=Array.from({length:12},(_,i)=>monthly.get(year+'-'+String(i+1).padStart(2,'0'))||0),max=Math.max(1,...values);return `<svg class="tw-year-spark" viewBox="0 0 120 24" aria-hidden="true">${values.map((v,i)=>`<rect x="${i*10}" y="${24-v/max*22}" width="5" height="${v/max*22}" rx="1"/>`).join('')}</svg>`;};
 $('tw-years').innerHTML=years.map(year=>`<button type="button" id="period-${year}" data-period="${year}" aria-pressed="${activeYear===year}" aria-label="${year}: ${countMap.get(year)||0} collected ${state.mode==='events'?'events':'source records'}. Filter this year."><span class="tw-year-number">${year}</span><span class="tw-year-count">${(countMap.get(year)||0).toLocaleString()} records</span>${sparkline(year)}</button>`).join('');
 const months=activeYear?new Map(periodCounts(records.filter(r=>r.importedDate?.startsWith(activeYear)),'month')):new Map();
 $('tw-months').hidden=!activeYear;
 $('tw-months').innerHTML=activeYear?Array.from({length:12},(_,i)=>{const key=activeYear+'-'+String(i+1).padStart(2,'0'),label=new Intl.DateTimeFormat('en',{month:'short',timeZone:'UTC'}).format(new Date(key+'-01T12:00:00Z'));return `<button type="button" id="period-${key}" data-period="${key}" aria-pressed="${state.from.slice(0,7)===key&&state.to.slice(0,7)===key}" aria-label="${displayDate(key+'-01','month')}: ${months.get(key)||0} records"><span>${label}</span><small>${months.get(key)||0}</small></button>`;}).join(''):'';
 const keys=monthKeys(),current=state.from?.slice(0,7)||keys[0],index=Math.max(0,keys.indexOf(current));
 $('tw-scrubber').max=keys.length-1;$('tw-scrubber').value=index;$('tw-scrubber').style.setProperty('--scrub-progress',`${index/Math.max(1,keys.length-1)*100}%`);
 $('tw-scrub-preview').textContent=displayDate(keys[index]+'-01','month');$('tw-scrubber').setAttribute('aria-valuetext',displayDate(keys[index]+'-01','month'));
 $('tw-range-label').textContent=`Archive dates: ${state.from?displayDate(state.from):'January 2023'} – ${state.to?displayDate(state.to):'latest collected record'}`;
 $('tw-previous').disabled=current<=keys[0];$('tw-next').disabled=current>=keys.at(-1);
 $('tw-earlier').disabled=false;$('tw-latest').disabled=!records.length;
 requestAnimationFrame(()=>document.documentElement.style.setProperty('--tw-rail-offset',`${$('tw-overview').getBoundingClientRect().height+84}px`));
}
function sourceVisual(r) {
 const hasSourceImage=Boolean(r.imageUrl&&!/logo|logos|t-shirt|shop\/|ogimage/i.test(r.imageUrl));
 const initials=r.source?.split(/\s+/).slice(0,2).map(w=>w[0]).join('')||'EG';
 return `<a class="tw-card-media" href="${h(recordURL(r.id))}" data-select="${r.id}" tabindex="-1" aria-hidden="true"><div class="tw-card-fallback"><svg viewBox="0 0 640 360" fill="none" preserveAspectRatio="none"><path d="M-40 90H160C340 90 350 290 520 290H700M-40 180H160C340 180 350 90 520 90H700M-40 290H160C340 290 350 180 520 180H700" stroke="currentColor" stroke-width="1"/><circle cx="160" cy="90" r="5" fill="currentColor"/><circle cx="520" cy="180" r="5" fill="currentColor"/></svg><span>${h(initials)}</span></div>${hasSourceImage&&imagePreference?`<img src="${h(r.imageUrl)}" alt="" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:''}<div class="tw-media-credit"><span>${h(r.source)}</span><span>${hasSourceImage?'Archive image · context unverified':'Source record'} ↗</span></div></a>`;
}
function row(r,index,previousKey) {
 const event=state.mode==='events',date=event?r.eventTime.start:r.publicationDate||r.importedDate;
 const key=date?.slice(0,{day:10,month:7,year:4}[state.granularity])||'unknown';
 const periodCount=filtered.filter(item=>(item.publicationDate||item.importedDate)?.slice(0,{day:10,month:7,year:4}[state.granularity])===key).length;
 const group=key!==previousKey?`<p class="tw-period-label">${h(key==='unknown'?'Date unknown':displayDate(key.length===4?key+'-01-01':key.length===7?key+'-01':key,state.granularity))}<small>${periodCount} records</small></p>`:'';
 return {key,html:`<li class="tw-record ${r.id===state.selected?'is-selected':''}" id="row-${r.id}" data-date="${h(date||'')}" data-position="${index}">${group}<article class="tw-record-card">${event?'':sourceVisual(r)}<div class="tw-card-copy"><div class="tw-record-meta"><span>${event?'Event date':r.dateBasis} · ${h(event?r.eventTime.label:displayDate(date))}</span><span class="tw-source-type">${h(r.source)}</span></div><h3><a href="${h(recordURL(r.id))}" data-select="${r.id}" id="link-${r.id}">${h(r.title)}</a></h3><p class="tw-record-summary">${h(r.summary||'Open the source record for its original link and metadata.')}</p>${!event&&r.themes.length?`<button type="button" class="tw-card-thread" data-thread="${r.themes[0]}" aria-label="${h('Filter by suggested thread: '+THEMES.find(t=>t[0]===r.themes[0])[1])}"><span aria-hidden="true">⌁</span> ${h(THEMES.find(t=>t[0]===r.themes[0])[1])}</button>`:''}<div class="tw-record-actions"><a class="tw-open" href="${h(recordURL(r.id))}" data-select="${r.id}">${event?'Read reviewed entry':'Follow the record'} <span aria-hidden="true">↗</span></a>${event?'':`<button type="button" class="tw-save" data-save="${r.id}" aria-pressed="${saved(r)}">${saved(r)?'Saved ✓':'+ Save source'}</button>`}</div></div></article></li>`};
}
function renderList() {
  filtered=getRecords();
  $('tw-results-eyebrow').textContent=state.mode==='events'?'Reviewed event chronology':'Source chronology';
  $('tw-results-title').textContent=`${filtered.length.toLocaleString()} ${state.mode==='events'?'reviewed events':'source records'}`;
  let previous='';$('tw-records').innerHTML=filtered.slice(0,state.limit).map((r,i)=>{const result=row(r,i,previous);previous=result.key;return result.html;}).join('');
  $('tw-more').hidden=filtered.length<=state.limit;$('tw-shown').textContent=filtered.length?`Showing ${Math.min(state.limit,filtered.length)} of ${filtered.length.toLocaleString()}.` : '';
  $('tw-empty').hidden=Boolean(filtered.length);
  enhanceCards();
  if(!filtered.length)$('tw-empty').innerHTML=state.mode==='events'&&!editorial.events.some(e=>e.status==='approved')?'<p class="tw-kicker">Editorial review comes first</p><h3>The reviewed chronology is being built.</h3><p>The source collection is available now. Event dates, supporting passages and relationships need editorial review before they become a chronology entry.</p><button type="button" data-mode="sources">Browse source records</button>':'<h3>No collected records match these filters.</h3><p>Try a wider date range or remove a filter. Unknown dates appear when no date range is selected.</p><button type="button" data-reset>Clear filters</button>';
}
function sourceDates(r) {return `<dl><dt>Event time</dt><dd>Not assigned to this source record</dd><dt>Publication time</dt><dd>${r.publicationDate?h(displayDate(r.publicationDate)):'Not verified'}</dd><dt>Archive date · imported metadata</dt><dd>${h(displayDate(r.importedDate))}</dd><dt>Source access</dt><dd>${h(statusLabel(r))}${r.integrity.checkedAt?`<br><span class="tw-small">Last check: ${h(displayDate(r.integrity.checkedAt.slice(0,10)))}<br>${h(r.integrity.method)}. This is a dated observation, not a current availability guarantee.</span>`:''}</dd><dt>Preservation</dt><dd>${r.integrity.captureURL?`<a href="${h(r.integrity.captureURL)}" target="_blank" rel="noopener noreferrer">Open recorded preserved copy ↗</a>${r.integrity.capturedAt?'<br>Capture recorded '+h(displayDate(r.integrity.capturedAt.slice(0,10))):''}`:'No preserved copy recorded'}</dd><dt>Author</dt><dd>${h(r.authors.length?r.authors.join(', '):'Unknown author')}</dd><dt>Document type</dt><dd>${h(r.documentType)}</dd><dt>Metadata review</dt><dd>Imported record · source body not verified${r.importNumbers.length>1?`<br>${r.importNumbers.length} exact-URL imports grouped into one source`:''}</dd></dl>`;}
function renderDetail() {
  const r=currentRecord();
  if(!state.selected){$('tw-detail').innerHTML=placeholder;document.body.classList.remove('tw-reading-mobile');return;}
  if(!r){$('tw-detail').innerHTML='<div class="tw-detail-body"><h2 id="tw-detail-title" tabindex="-1">Source not found</h2><p>This link may refer to a record outside the current snapshot.</p><button type="button" data-close-detail>Return to the timeline</button></div>';return;}
  const event=Boolean(r.eventTime && r.sourceIds),isVisible=filtered.some(s=>s.id===r.id);
  const follow=event?{records:sources.filter(s=>r.sourceIds.includes(s.id)),kind:'Supporting sources',label:'Sources for this reviewed entry'}:relatedSources(r,sources,editorial.collections);
  const related=[...follow.records].sort((a,b)=>(a.importedDate||'').localeCompare(b.importedDate||'')||a.id.localeCompare(b.id));
  const approvedRelations=editorial.relationships.filter(rel=>rel.status==='approved'&&(rel.from===r.id||rel.to===r.id));
  $('tw-detail').innerHTML=`<div class="tw-detail-top"><p class="tw-kicker">${event?'Reviewed entry':'Source record'}</p><button type="button" data-close-detail>← Back to timeline</button></div><div class="tw-detail-body">${!isVisible?'<p class="tw-notice">This selected record is outside the active filters. Your timeline filters are preserved.</p>':''}<p class="tw-small">${h(event?r.eventTime.label:r.source+' · '+displayDate(r.importedDate))}</p><h2 id="tw-detail-title" tabindex="-1">${h(r.title)}</h2><p>${h(r.summary||'No summary stored. Consult the original source for its account.')}</p>${event?`<dl><dt>Event date</dt><dd>${h(r.eventTime.label)}</dd><dt>Date precision</dt><dd>${h(r.eventTime.precision)}</dd><dt>Date rationale</dt><dd>${h(r.eventTime.rationale)}</dd><dt>Editorial review</dt><dd>${h(r.review.reviewer)} · ${h(displayDate(r.review.reviewedAt.slice(0,10)))}</dd></dl>`:'<details class="tw-detail-context"><summary>Dates, access and source context</summary>'+sourceDates(r)+'</details>'}${!event&&r.flags.length?`<details><summary>Metadata notes (${r.flags.length})</summary><ul class="tw-small">${r.flags.map(f=>`<li>${h(f)}</li>`).join('')}</ul><p class="tw-small">Original imported fields remain in the archive dataset. No date was corrected from a URL alone.</p></details>`:''}${!event&&r.url?`<a class="tw-source-link" href="${h(r.url)}" target="_blank" rel="noopener noreferrer">Read at ${h(r.source)} ↗ <span class="tw-small">(opens a new tab)</span></a>`:''}<div class="tw-detail-actions">${event?'<button type="button" data-save-event="'+r.id+'">Save all supporting sources</button>':`<button type="button" class="tw-save" data-save="${r.id}" aria-pressed="${saved(r)}">${saved(r)?'Saved ✓':'Save source'}</button><button type="button" data-copy-source="${r.id}">Copy citation</button>`}<button type="button" data-share>Copy this view’s link</button></div>${!event?`<h3>Suggested threads</h3><p class="tw-small">${h(r.themes.map(id=>THEMES.find(t=>t[0]===id)[1]).join(' · ')||'Unassigned; editorial review needed.')}</p>`:''}<h3>Follow the record</h3><p class="tw-small">${h(follow.label)}<br>${h(follow.kind)}. ${event?'Supporting links retained with their own archive dates.':'These connections do not establish cause, agreement or verified event dates.'}</p><ol class="tw-follow">${related.map(s=>`<li${s.id===r.id?' class="is-current"':''}><p>Archive date · ${h(displayDate(s.importedDate))}</p><a href="${h(recordURL(s.id))}" data-select="${s.id}" ${s.id===r.id?'aria-current="true"':''}>${h(s.title)}</a><small>${h(s.source)}${s.id===r.id?' · You are here':''}</small></li>`).join('')}</ol>${related.length<=1&&!event?'<p class="tw-small">No sufficiently specific related reading suggestion is available in this snapshot.</p>':''}${approvedRelations.length?`<h3>Reviewed connections</h3><ul>${approvedRelations.map(rel=>`<li><a data-select="${h(rel.from===r.id?rel.to:rel.from)}" href="${h(recordURL(rel.from===r.id?rel.to:rel.from))}">${h(rel.type)}</a><p class="tw-small">${h(rel.explanation)}</p></li>`).join('')}</ul>`:''}<p class="tw-small">Permanent record ID<br>${h(r.id)}</p><a href="collab.html" class="tw-small">Suggest a metadata correction ↗</a></div>`;
  document.body.classList.add('tw-reading-mobile');
  if(!reducedMotion())$('tw-detail').animate([{opacity:.3,transform:'translateX(14px)'},{opacity:1,transform:'translateX(0)'}],{duration:280,easing:'cubic-bezier(.2,.65,.3,1)'});
}
function render() {
  if(loading)return;
  $('tw-basis').innerHTML=state.mode==='sources'?'2023 — today · Dates shown are <strong>archive dates</strong>. Open a record for source context.':'Reviewed entries use <strong>event dates</strong>, with precision, date evidence and editorial review.';
  $('tw-routes').hidden=state.mode==='events';
  renderChips();renderOverview();renderList();renderDetail();syncSaveButtons();
  say(`${filtered.length.toLocaleString()} ${state.mode==='events'?'reviewed events':'source records'} match your filters.`);
}
function renderPacket() {
  const records=sources.filter(saved),unresolved=packet.length-records.length;
  $('tw-packet-count').textContent=records.length;
  $('tw-packet-list').innerHTML=records.length?records.map(r=>`<div class="tw-packet-entry"><div><a href="${h(recordURL(r.id))}" data-packet-select="${r.id}">${h(r.title)}</a><p>${h(r.source)} · Archive date ${h(displayDate(r.importedDate))}</p></div><button type="button" data-packet-remove="${r.id}" aria-label="${h('Remove saved source: '+r.title)}">Remove</button></div>`).join(''):'<p>No source records saved yet. Open a source and choose “Save source.”</p>';
  if(unresolved>0)$('tw-packet-list').insertAdjacentHTML('beforeend',`<p class="tw-small">${unresolved} saved identifier(s) belong to another or unavailable record. They are retained in your packet.</p>`);
}
async function copy(text) {
  try {await navigator.clipboard.writeText(text);feedback('Copied to clipboard.');}
  catch {$('tw-copy-text').value=text;$('tw-copy-dialog').showModal();$('tw-copy-text').focus();$('tw-copy-text').select();}
}
function packetText() {const style=$('tw-citation-style').value;return `Echoes of Gaza — Threads of Witness\nExported ${today()}\nDates labeled Archive date are unverified imported dates.\n\n`+sources.filter(saved).map(r=>citation(r,style)).join('\n\n---\n\n')+($('tw-notes').value?'\n\nPrivate notes\n'+$('tw-notes').value:'');}
function download(text,name,type) {const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback('Research packet downloaded.');}
function selectPeriod(key,focus='') {const [from,to]=periodRange(key);commit({from,to,limit:30,dates:'all'},{focus});}
function movePeriod(direction) {
 const keys=monthKeys(),current=state.from?.slice(0,7)||keys[0],next=keys[Math.max(0,Math.min(keys.length-1,keys.indexOf(current)+direction))];if(next)selectPeriod(next);
}
$('tw-enter').addEventListener('click',e=>{e.preventDefault();const top=$('tw-records').getBoundingClientRect().top+window.scrollY-$('tw-overview').getBoundingClientRect().height-88;window.scrollTo({top,behavior:reducedMotion()?'instant':'smooth'});});
$('tw-refine-toggle').addEventListener('click',()=>{const open=$('tw-refinement').hidden;$('tw-refinement').hidden=!open;$('tw-refine-toggle').setAttribute('aria-expanded',String(open));$('tw-refine-toggle').innerHTML=open?'Refine view <span aria-hidden="true">−</span>':'Refine view <span aria-hidden="true">+</span>';});
$('tw-image-toggle').addEventListener('click',()=>{imagePreference=!imagePreference;try{localStorage.setItem('echoes_timeline_images',imagePreference?'show':'hidden');}catch{}syncPreferences();renderList();});
$('tw-auto-load').addEventListener('click',()=>{autoLoad=!autoLoad;try{localStorage.setItem('echoes_timeline_auto_load',autoLoad?'on':'off');}catch{}syncPreferences();enhanceCards();});
$('tw-scrubber').addEventListener('input',e=>{const keys=monthKeys(),index=Number(e.target.value);$('tw-scrub-preview').textContent=displayDate(keys[index]+'-01','month');e.target.setAttribute('aria-valuetext',displayDate(keys[index]+'-01','month'));e.target.style.setProperty('--scrub-progress',`${index/Math.max(1,keys.length-1)*100}%`);});
$('tw-scrubber').addEventListener('change',e=>selectPeriod(monthKeys()[Number(e.target.value)]));
document.addEventListener('error',e=>{if(e.target.matches?.('.tw-card-media img')){e.target.remove();}},true);
window.addEventListener('scroll',()=>{if(!scrollFrame){scrollFrame=true;requestAnimationFrame(()=>{updateReadingPosition();scrollFrame=false;});}},{passive:true});
$('tw-filter-form').addEventListener('submit',e=>{e.preventDefault();clearTimeout(searchTimer);applyForm();});
$('tw-query').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>applyForm(true),300);});
$('tw-to').addEventListener('input',()=>$('tw-to').setCustomValidity(''));
$('tw-from').addEventListener('input',()=>{$('tw-to').setCustomValidity('');$('tw-from').setCustomValidity('');});
$('tw-filter-form').addEventListener('change',e=>{if(e.target.type==='checkbox'||e.target.tagName==='SELECT')applyForm();});
$('tw-publisher-search').addEventListener('input',e=>{$('tw-publishers').querySelectorAll('label').forEach(label=>label.hidden=!label.textContent.toLowerCase().includes(e.target.value.toLowerCase()));});
$('tw-clear').addEventListener('click',()=>commit({...defaults(),selected:state.selected}));
$('tw-group').addEventListener('change',e=>commit({granularity:e.target.value}));$('tw-order').addEventListener('change',e=>commit({order:e.target.value,limit:30}));
$('tw-more').addEventListener('click',()=>loadMore(true));
$('tw-earlier').addEventListener('click',()=>commit({from:'2023-01-01',to:'2023-12-31',order:'oldest',limit:30,dates:'all',selected:''},{focus:'period-2023'}));
$('tw-latest').addEventListener('click',()=>{const dates=getRecords(true).map(r=>r.importedDate).filter(Boolean).sort();if(dates.length){selectPeriod(dates.at(-1).slice(0,7));feedback(`Latest collected ${state.mode==='events'?'event':'source'}: ${displayDate(dates.at(-1))}. Today is ${displayDate(today())}.`);}});
$('tw-all-dates').addEventListener('click',()=>commit({from:'2023-01-01',to:'',dates:'all',limit:30}));
$('tw-previous').addEventListener('click',()=>movePeriod(-1));$('tw-next').addEventListener('click',()=>movePeriod(1));
$('tw-jump-button').addEventListener('click',()=>{const date=civilDate($('tw-jump').value);if(date)commit({from:date,to:'',order:'oldest',limit:30,dates:'all'});else{$('tw-jump').setCustomValidity('Choose a date to jump to.');$('tw-jump').reportValidity();}});
$('tw-jump').addEventListener('input',()=>$('tw-jump').setCustomValidity(''));
$('tw-packet-open').addEventListener('click',()=>{renderPacket();$('tw-packet-dialog').showModal();});$('tw-packet-close').addEventListener('click',()=>$('tw-packet-dialog').close());
$('tw-copy-packet').addEventListener('click',()=>copy(packetText()));$('tw-download-text').addEventListener('click',()=>download(packetText(),'echoes-of-gaza-research-packet.txt','text/plain;charset=utf-8'));
$('tw-download-json').addEventListener('click',()=>download(JSON.stringify({version:1,exportedAt:new Date().toISOString(),privateNotes:$('tw-notes').value,sources:sources.filter(saved)},null,2),'echoes-of-gaza-research-packet.json','application/json'));
$('tw-clear-packet').addEventListener('click',()=>{if(!packet.length&&!$('tw-notes').value)return;packet=[];$('tw-notes').value='';try{localStorage.removeItem(notesKey);}catch{}persistPacket();syncSaveButtons();renderPacket();$('tw-packet-status').textContent='Packet and private notes cleared.';});
$('tw-notes').addEventListener('input',()=>{try{localStorage.setItem(notesKey,$('tw-notes').value);$('tw-packet-status').textContent='Notes saved in this browser.';}catch{$('tw-packet-status').textContent='Storage unavailable. Notes last for this visit only.';}});
for(const dialog of [$('tw-packet-dialog'),$('tw-copy-dialog')])dialog.addEventListener('click',e=>{if(e.target===dialog){const box=dialog.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)dialog.close();}});
document.addEventListener('click',e=>{
  const b=e.target.closest('button,a');if(!b)return;
  if(b.dataset.select){if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();openRecord(b.dataset.select);}
  else if(b.dataset.thread){commit({themes:[b.dataset.thread],limit:30});}
  else if(b.dataset.mode){commit({mode:b.dataset.mode,selected:'',limit:30});}
  else if(b.dataset.route){if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();commit({...defaults(),collection:b.dataset.route,order:'oldest'});}
  else if(b.hasAttribute('data-reset'))commit({...defaults(),selected:state.selected});
  else if(b.dataset.period)selectPeriod(b.dataset.period,b.id);
  else if(b.dataset.save)save(sources.find(r=>r.id===b.dataset.save));
  else if(b.hasAttribute('data-close-detail'))closeDetail();
  else if(b.dataset.copySource)copy(citation(sources.find(r=>r.id===b.dataset.copySource),$('tw-citation-style').value));
  else if(b.hasAttribute('data-share'))copy(location.href);
  else if(b.dataset.saveEvent){const event=editorial.events.find(ev=>ev.id===b.dataset.saveEvent);packet=[...new Set([...packet,...sources.filter(r=>event.sourceIds.includes(r.id)).map(r=>r.packetId)])];persistPacket();syncSaveButtons();renderPacket();feedback('Supporting sources saved.');}
  else if(b.dataset.packetRemove){const r=sources.find(r=>r.id===b.dataset.packetRemove);packet=packet.filter(id=>id!==r.packetId);persistPacket();syncSaveButtons();renderPacket();$('tw-packet-close').focus();}
  else if(b.dataset.packetSelect){if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();$('tw-packet-dialog').close();openRecord(b.dataset.packetSelect);}
  else if(b.dataset.removeFilter){const key=b.dataset.removeFilter;let patch={limit:30};if(key==='range')Object.assign(patch,{from:'2023-01-01',to:''});else if(key.startsWith('theme:'))patch.themes=state.themes.filter(v=>v!==key.slice(6));else if(key.startsWith('publisher:'))patch.publishers=state.publishers.filter(v=>v!==key.slice(10));else if(key.startsWith('type:'))patch.types=state.types.filter(v=>v!==key.slice(5));else patch[key]=key==='dates'?'all':'';commit(patch,{focus:'tw-results-title'});}
});
window.addEventListener('popstate',()=>{clearTimeout(searchTimer);state=parseState(location.search);syncControls();render();requestAnimationFrame(()=>{const target=$(history.state?.focusId);target?.focus({preventScroll:true});window.scrollTo({top:history.state?.scroll||0,behavior:'instant'});});});
window.addEventListener('storage',e=>{if(e.key===packetAPI.key){packet=packetAPI.read();syncSaveButtons();renderPacket();}if(e.key===notesKey)$('tw-notes').value=e.newValue||'';});
async function load() {
  try {
    const data=await Promise.all(['data/timeline/sources.json','data/timeline/editorial.json'].map(async url=>{const r=await fetch(url);if(!r.ok)throw new Error('Dataset request failed');return r.json();}));
    snapshot=data[0];sources=snapshot.sources.filter(r=>!r.importedDate||r.importedDate<=today());editorial=data[1];
    if(!Array.isArray(sources)||!sources.length)throw new Error('No valid source records');
    const errors=validateEditorial(editorial,sources);if(errors.length)throw new Error('Editorial validation failed');
    const aliasMap=new Map();sources.forEach(r=>r.packetAliases.forEach(alias=>{if(!aliasMap.has(alias))aliasMap.set(alias,r.packetId);}));
    packet=[...new Set(packet.map(id=>aliasMap.get(id)||id))];persistPacket();
    if(state.collection&&!editorial.collections.some(c=>c.id===state.collection))state.collection='';
    try{$('tw-notes').value=localStorage.getItem(notesKey)||'';}catch{}
    $('tw-snapshot').textContent=`${sources.filter(r=>r.importedDate>='2023-01-01').length.toLocaleString()} sources since 2023 · ${sources.length.toLocaleString()} in the full archive · Latest archive date ${displayDate(snapshot.latest)} · Built ${displayDate(snapshot.generatedAt.slice(0,10))}`;
    $('tw-event-count').textContent=editorial.events.filter(e=>e.status==='approved').length;
    $('tw-collection-policy').textContent=`${snapshot.importedCount.toLocaleString()} imported records become ${sources.length.toLocaleString()} unique public sources: ${snapshot.duplicateCount} duplicate imports grouped and ${snapshot.excluded.length} test or future record(s) withheld. The original import remains unchanged. The interactive timeline starts in 2023; earlier records remain in the static reading edition. Draft events are never published automatically.`;
    $('tw-hero-records').innerHTML=[sources.filter(r=>r.importedDate?.startsWith('2023')).sort((a,b)=>a.importedDate.localeCompare(b.importedDate))[0],sources.find(r=>r.importNumbers.includes(482)),sources.find(r=>r.importNumbers.includes(171))].filter(Boolean).map((r,i)=>`<a class="tw-hero-record tw-hero-record-${i}" data-select="${r.id}" href="${h(recordURL(r.id))}"><span>${h(r.importedDate.slice(0,4))}</span><strong>${h(r.source)}</strong><small>${h(r.title)}</small></a>`).join('');
    renderFacets();loading=false;syncPreferences();syncControls();render();renderPacket();
    if(state.selected&&matchMedia('(max-width:900px)').matches)requestAnimationFrame(()=>{$('tw-detail').scrollIntoView({block:'start'});$('tw-detail-title')?.focus({preventScroll:true});});
  } catch(error) {loading=false;$('tw-results-title').textContent='Timeline temporarily unavailable';$('tw-error').hidden=false;$('tw-error').innerHTML='<h3>The collection could not be loaded.</h3><p>Your saved packet remains in this browser. Try again, or read the complete static chronology.</p><button type="button" id="tw-retry">Try again</button> <a href="timeline-sources.html">Static reading edition ↗</a>';$('tw-retry').addEventListener('click',()=>location.reload());$('tw-snapshot').textContent='Interactive data unavailable. Static reading edition available.';document.querySelectorAll('.tw-filters input,.tw-filters button,.tw-filters select,.tw-overview button,.tw-toolbar button,.tw-view-controls select').forEach(el=>el.disabled=true);console.error('Timeline load failed:',error);say('Collection unavailable. The static reading edition is available.');}
}
if('ResizeObserver' in window)new ResizeObserver(()=>document.documentElement.style.setProperty('--tw-rail-offset',`${$('tw-overview').getBoundingClientRect().height+84}px`)).observe($('tw-overview'));
load();
