import {THEMES,escapeHTML as h,displayDate,civilDate,today,defaults,parseState,stateURL,filterSources,periodCounts,periodRange,statusLabel,citation,relatedSources,validateEditorial} from './timeline-core.mjs?v=4';
const $=id=>document.getElementById(id), packetAPI=globalThis.EogPacket;
let state=parseState(location.search), snapshot, sources=[], editorial={events:[],relationships:[],collections:[]}, filtered=[], packet=packetAPI.read(), searchTimer, feedbackTimer, loading=true;
const notesKey='echoes_timeline_private_notes';
let imagePreference=true, autoLoad=true, revealObserver, moreObserver, scrollFrame=false;
let readingMonth='', pickerYear='', windowStart=0, restoring=false;
const recordDate=r=>r.publicationDate||r.importedDate;
const availableMonths=()=>periodCounts(filtered,'month').filter(([key])=>key!=='unknown').map(([key])=>key);
history.scrollRestoration='manual';
try { imagePreference=localStorage.getItem('echoes_timeline_images')!=='hidden'; autoLoad=localStorage.getItem('echoes_timeline_auto_load')!=='off'; } catch {}
const reducedMotion=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
function syncPreferences() {
 document.body.classList.toggle('tw-images-hidden',!imagePreference);
 $('tw-image-toggle').setAttribute('aria-pressed',String(imagePreference));$('tw-image-toggle').textContent='Show images';
 $('tw-auto-load').setAttribute('aria-pressed',String(autoLoad));$('tw-auto-load').textContent='Load articles automatically';
}
function syncReadingMonth(month) {
 readingMonth=month;
 $('tw-current-period').textContent=month?new Intl.DateTimeFormat('en',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z')):'No dated articles';
 $('tw-period-button').setAttribute('aria-label',month?'Choose month: '+displayDate(month+'-01','month'):'Choose a month');
 const keys=availableMonths(),index=keys.indexOf(month);
 $('tw-previous').disabled=index<=0;$('tw-next').disabled=index<0||index>=keys.length-1;
 document.querySelectorAll('#tw-months button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.period===month)));
 if(!$('tw-date-picker').open && month){const nextYear=month.slice(0,4);if(pickerYear!==nextYear){pickerYear=nextYear;$('tw-picker-year').value=pickerYear;renderPicker();}}
}
function updateReadingPosition() {
 if(state.selected||restoring)return;
 const cards=[...$('tw-records').children],edge=$('tw-overview').getBoundingClientRect().bottom+24;
 // Two-column cards can share a row; DOM bottoms are not monotonically increasing.
 const visible=cards.find(card=>card.getBoundingClientRect().bottom>edge);
 if(!visible)return;
 const date=visible.dataset.date;
 if(date){syncReadingMonth(date.slice(0,7));state.at=date;}
 history.replaceState({...history.state,scroll:window.scrollY,windowStart},'',stateURL(state));
 const index=Number(visible.dataset.position||0),listRect=$('tw-records').getBoundingClientRect();
 $('tw-records').style.setProperty('--thread-depth',`${Math.max(0,Math.min(listRect.height,edge-listRect.top))}px`);
 $('tw-scroll-progress').style.setProperty('--read-progress',`${filtered.length ? ((index+1)/filtered.length)*100 : 0}%`);
}
function syncLoadStatus() {
 $('tw-before').hidden=windowStart===0;
 $('tw-more').hidden=filtered.length<=state.limit;
 $('tw-shown').textContent=filtered.length?`Showing ${windowStart+1}–${Math.min(state.limit,filtered.length)} of ${filtered.length.toLocaleString()} articles.`:'';
}
function loadEarlier() {
 const first=$('tw-records').firstElementChild,oldTop=first?.getBoundingClientRect().top;
 windowStart=Math.max(0,windowStart-30);
 renderList();syncSaveButtons();
 // Preserve the visible card when earlier records are prepended, including images.
 const anchor=first&&$(first.id);
 if(anchor&&oldTop!==undefined)window.scrollBy({top:anchor.getBoundingClientRect().top-oldTop,behavior:'instant'});
 $('tw-before').hidden=windowStart===0;
 if($('tw-before').hidden)document.querySelector('#tw-records h3 a')?.focus({preventScroll:true});
 history.replaceState({...history.state,scroll:window.scrollY,windowStart},'',stateURL(state));
 say('Earlier articles loaded. Your reading position is preserved.');
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
 syncLoadStatus();
 enhanceCards();syncSaveButtons();if(focus&&filtered[oldCount])$('link-'+filtered[oldCount].id)?.focus();
 say(`${Math.min(state.limit,filtered.length)} of ${filtered.length.toLocaleString()} records available in the timeline.`);
}

const currentRecord=()=>[...sources,...editorial.events.filter(e=>e.status==='approved')].find(r=>r.id===state.selected);
const recordURL=id=>'timeline.html'+stateURL({...state,selected:id,at:recordDate([...sources,...eventRecords()].find(r=>r.id===id)||{})||state.at});
const saved=r=>packet.includes(r.packetId);
function say(message) {$('tw-announcement').textContent=message;}
function feedback(message) {$('tw-feedback').textContent=message;$('tw-feedback').hidden=false;clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>$('tw-feedback').hidden=true,4500);}
function persistPacket() {const persisted=packetAPI.write(packet);if(!persisted)feedback('Browser storage is unavailable. Your packet lasts for this visit only.');}
function save(r) {if(!r?.packetId)return;packet=saved(r)?packet.filter(id=>id!==r.packetId):[...packet,r.packetId];persistPacket();syncSaveButtons();renderPacket();feedback(saved(r)?'Source saved to your research packet.':'Source removed from your research packet.');}
function syncSaveButtons() {document.querySelectorAll('[data-save]').forEach(button=>{const r=sources.find(s=>s.id===button.dataset.save);const active=r&&saved(r);button.setAttribute('aria-pressed',String(Boolean(active)));button.textContent=active?'Saved ✓':'Save source';});$('tw-packet-count').textContent=sources.filter(saved).length;$('tw-packet-count').hidden=!sources.some(saved);}
function commit(patch,{replace=false,focus='',scroll=null,start=0}={}) {
  const detailOnly=Object.keys(patch).every(key=>key==='selected');
  const origin=patch.selected?(history.state?.readerOrigin||{scroll:window.scrollY,focusId:document.activeElement?.id||'',month:readingMonth}):null;
  history.replaceState({...history.state,scroll:window.scrollY,windowStart,focusId:document.activeElement?.id||''},'',location.href);
  if(!detailOnly){windowStart=start;readingMonth='';patch={at:'',...patch};}
  state={...state,...patch};
  history[replace?'replaceState':'pushState']({scroll:scroll??window.scrollY,windowStart,focusId:focus,opened:Boolean(patch.selected),readerOrigin:origin},'',stateURL(state));
  syncControls();
  if(detailOnly){renderDetail();markSelected();syncSaveButtons();}else render();
  if(focus)requestAnimationFrame(()=>$(focus)?.focus({preventScroll:true}));
  if(scroll!==null)requestAnimationFrame(()=>window.scrollTo({top:scroll,behavior:'instant'}));
}
function markSelected(){document.querySelectorAll('#tw-records>li').forEach(el=>el.classList.toggle('is-selected',el.id==='row-'+state.selected));}
function openRecord(id) {
 const alreadyOpen=Boolean(state.selected);
 commit({selected:id},{replace:alreadyOpen,focus:'tw-detail-title'});
 $('tw-detail').scrollTop=0;
}
function closeDetail() {
 if(history.state?.opened){history.back();return;}
 const id=state.selected,origin=history.state?.readerOrigin;
 commit({selected:''},{replace:true,focus:origin?.focusId||('link-'+id),scroll:origin?.scroll??null});
 if(!origin&&$('row-'+id))requestAnimationFrame(()=>scrollToRecord(id));
 else if(!origin)$('tw-results-title').focus({preventScroll:true});
}
function scrollToRecord(id,animate=false) {
 const card=$('row-'+id);if(!card)return;
 const offset=$('tw-overview').getBoundingClientRect().height+(innerWidth<=720?54:60)+20;
 window.scrollTo({top:Math.max(0,card.getBoundingClientRect().top+scrollY-offset),behavior:animate&&!reducedMotion()?'smooth':'instant'});
}
function showResults() {requestAnimationFrame(()=>{const top=$('tw-records').getBoundingClientRect().top+scrollY-$('tw-overview').getBoundingClientRect().height-(innerWidth<=720?74:80);if(scrollY>top)window.scrollTo({top:Math.max(0,top),behavior:'instant'});});}
function values(name) {return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(i=>i.value);}
function applyForm(replace=false) {
  const from=$('tw-from').value,to=$('tw-to').value;
  if(from&&from<'2023-01-01'){$('tw-from').setCustomValidity('The timeline starts in 2023.');$('tw-from').reportValidity();return;}
  $('tw-from').setCustomValidity('');
  if(from&&to&&from>to) {$('tw-to').setCustomValidity('The end date must be on or after the start date.');$('tw-to').reportValidity();return;}
  $('tw-to').setCustomValidity('');
  commit({q:$('tw-query').value.trim(),from,to,themes:values('theme'),publishers:values('publisher'),types:values('type'),status:$('tw-status').value,dates:$('tw-dates').value,limit:30},{replace});
  showResults();
}
function syncControls() {
  for(const k of ['q','from','to','status','dates'])$(k==='q'?'tw-query':'tw-'+k).value=state[k];
  $('tw-order').value=state.order;
  for(const [name,key] of [['theme','themes'],['publisher','publishers'],['type','types']])document.querySelectorAll(`input[name="${name}"]`).forEach(i=>i.checked=state[key].includes(i.value));
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));
  $('tw-advanced').hidden=state.mode==='events';

}
function renderFacets() {
  $('tw-theme-controls').innerHTML=[...THEMES.map(([id,label])=>[id,label]),['unassigned','Unassigned']].map(([id,label])=>`<label class="tw-theme"><input type="checkbox" name="theme" value="${id}"><span>${h(label)}</span></label>`).join('');
  for(const [target,name,key] of [['tw-publishers','publisher','source'],['tw-types','type','documentType']]) {
    const counts=new Map();sources.forEach(r=>counts.set(r[key],(counts.get(r[key])||0)+1));
    $(target).innerHTML=[...counts].sort(([a],[b])=>a.localeCompare(b)).map(([value,count])=>`<label><input type="checkbox" name="${name}" value="${h(value)}"><span>${h(value)} <small>(${count})</small></span></label>`).join('');
  }
  $('tw-routes').innerHTML=editorial.collections.map(c=>`<a class="tw-route" href="${h('timeline.html'+stateURL({...defaults(),collection:c.id,order:'oldest'}))}" data-route="${h(c.id)}"><h2>${h(c.title)}</h2><p>${h(c.description)}</p></a>`).join('');
}
function renderChips() {
  const chips=[];
  if(state.q)chips.push(['q','Search: '+state.q]);
  state.themes.forEach(id=>chips.push(['theme:'+id,THEMES.find(t=>t[0]===id)?.[1]||'Unassigned']));
  state.publishers.forEach(p=>chips.push(['publisher:'+p,p]));state.types.forEach(t=>chips.push(['type:'+t,t]));
  if(state.collection)chips.push(['collection',editorial.collections.find(c=>c.id===state.collection)?.title||'Unknown topic collection']);
  if(state.status)chips.push(['status','Source status: '+state.status]);if(state.dates!=='all')chips.push(['dates','Date: '+state.dates]);
  $('tw-clear').hidden=!hasFilters();
  $('tw-refine-toggle').textContent='Filters'+(hasFilters()?' · active':'');
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
function renderPicker() {
 const monthly=new Map(periodCounts(filtered,'month'));
 $('tw-months').innerHTML=Array.from({length:12},(_,i)=>{const key=pickerYear+'-'+String(i+1).padStart(2,'0'),count=monthly.get(key)||0,label=new Intl.DateTimeFormat('en',{month:'short',timeZone:'UTC'}).format(new Date(key+'-01T12:00:00Z'));return `<button type="button" id="period-${key}" data-period="${key}" aria-pressed="${readingMonth===key}" ${count?'':'disabled'} aria-label="${displayDate(key+'-01','month')}: ${count} matching articles${count?'':'; unavailable'}"><span>${label}</span></button>`;}).join('');
}
function renderOverview() {
 const years=Array.from({length:Number(snapshot.latest.slice(0,4))-2023+1},(_,i)=>String(2023+i));
 $('tw-picker-year').innerHTML=years.map(year=>`<option value="${year}">${year}</option>`).join('');
 const restricted=Boolean(state.to||(state.from&&state.from!=='2023-01-01'));
 $('tw-date-restriction').hidden=!restricted;
 $('tw-restriction-label').textContent=restricted?(state.from?.slice(0,7)===state.to?.slice(0,7)?displayDate(state.from,'month')+' only':'Date range active'):'';
 const date=recordDate(filtered[windowStart]||{}),month=date?.slice(0,7)||'';
 pickerYear=month.slice(0,4)||years[0];$('tw-picker-year').value=pickerYear;renderPicker();syncReadingMonth(month);
 $('tw-range-label').textContent=`Browsing ${filtered.length.toLocaleString()} matching articles. Date navigation moves through these results without changing filters.`;
 $('tw-earlier').disabled=!availableMonths().length;$('tw-latest').disabled=!availableMonths().length;
 $('tw-jump').max=snapshot.latest;
 requestAnimationFrame(()=>document.documentElement.style.setProperty('--tw-rail-offset',`${$('tw-overview').getBoundingClientRect().height+84}px`));
}
function sourceVisual(r) {
 if(!imagePreference||!r.imageUrl||/logo|logos|t-shirt|shop\/|ogimage/i.test(r.imageUrl))return '';
 return `<div class="tw-card-media"><img src="${h(r.imageUrl)}" alt="" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="tw-photo-note">Archive image · context unverified</span></div>`;
}
function row(r,index) {
 const event=state.mode==='events',date=event?r.eventTime.start:recordDate(r),key=date?.slice(0,7)||'unknown',visual=event?'':sourceVisual(r);
 return {key,html:`<li class="tw-record ${r.id===state.selected?'is-selected':''}" id="row-${r.id}" data-date="${h(date||'')}" data-position="${index}"><article class="tw-record-card ${visual?'has-image':''}" data-card-select="${r.id}">${visual}<div class="tw-card-copy"><div class="tw-record-meta"><span class="tw-source-type">${h(r.source)}</span><span>${event?'Event date':`<button type="button" class="tw-date-help" data-about aria-label="About archive dates">Archive date <span aria-hidden="true">ⓘ</span></button>`} · ${h(event?r.eventTime.label:displayDate(date))}</span></div><h3><a href="${h(recordURL(r.id))}" data-select="${r.id}" id="link-${r.id}">${h(r.title)}</a></h3></div></article></li>`};
}
function hasFilters(){return Boolean(state.q||state.themes.length||state.publishers.length||state.types.length||state.collection||state.to||state.from!=='2023-01-01'||state.status||state.dates!=='all');}
function renderList() {
  filtered=getRecords();
  $('tw-results-eyebrow').textContent=state.mode==='events'?'Reviewed event chronology':'Source chronology';
  $('tw-results-title').textContent=hasFilters()?`${filtered.length.toLocaleString()} ${state.mode==='events'?'reviewed '+(filtered.length===1?'entry':'entries'):(filtered.length===1?'article':'articles')}`:'Articles';
  $('tw-results-title').dataset.count=filtered.length;
  $('tw-results-title').closest('.tw-results-header').classList.toggle('tw-sr-only',!hasFilters());
  let previous='';$('tw-records').innerHTML=filtered.slice(windowStart,state.limit).map((r,i)=>{const result=row(r,windowStart+i,previous);previous=result.key;return result.html;}).join('');
  syncLoadStatus();
  $('tw-empty').hidden=Boolean(filtered.length);
  enhanceCards();
  $('tw-results-context').hidden=true;
  if(!filtered.length)$('tw-empty').innerHTML=state.mode==='events'&&!editorial.events.some(e=>e.status==='approved')?'<p class="tw-kicker">Editorial review comes first</p><h3>The reviewed chronology is being built.</h3><p>The source collection is available now. Event dates, supporting passages and relationships need editorial review before they become a chronology entry.</p><button type="button" data-mode="sources">Browse source records</button>':'<h3>No collected records match these filters.</h3><p>Try a wider date range or remove a filter. Unknown dates appear when no date range is selected.</p><button type="button" data-reset>Clear filters</button>';
}
function sourceDates(r) {return `<dl><dt>Event time</dt><dd>Not assigned to this source record</dd><dt>Publication time</dt><dd>${r.publicationDate?h(displayDate(r.publicationDate)):'Not verified'}</dd><dt>Archive date · imported metadata</dt><dd>${h(displayDate(r.importedDate))}</dd><dt>Source access</dt><dd>${h(statusLabel(r))}${r.integrity.checkedAt?`<br><span class="tw-small">Last check: ${h(displayDate(r.integrity.checkedAt.slice(0,10)))}<br>${h(r.integrity.method)}. This is a dated observation, not a current availability guarantee.</span>`:''}</dd><dt>Preservation</dt><dd>${r.integrity.captureURL?`<a href="${h(r.integrity.captureURL)}" target="_blank" rel="noopener noreferrer">Open recorded preserved copy ↗</a>${r.integrity.capturedAt?'<br>Capture recorded '+h(displayDate(r.integrity.capturedAt.slice(0,10))):''}`:'No preserved copy recorded'}</dd><dt>Author</dt><dd>${h(r.authors.length?r.authors.join(', '):'Unknown author')}</dd><dt>Document type</dt><dd>${h(r.documentType)}</dd><dt>Metadata review</dt><dd>Imported record · source body not verified${r.importNumbers.length>1?`<br>${r.importNumbers.length} exact-URL imports grouped into one source`:''}</dd></dl>`;}
function renderDetail() {
  const r=currentRecord();
  const dialog=$('tw-reader-dialog');
  document.body.classList.toggle('tw-reader-open',Boolean(state.selected));
  if(!state.selected){if(dialog.open)dialog.close();return;}
  if(!dialog.open)dialog.showModal();
  if(!r){$('tw-detail').innerHTML='<div class="tw-detail-body"><h2 id="tw-detail-title" tabindex="-1">Source not found</h2><p>This link may refer to a record outside the current snapshot.</p><button type="button" data-close-detail>Return to the timeline</button></div>';return;}
  const event=Boolean(r.eventTime && r.sourceIds),recordIndex=filtered.findIndex(s=>s.id===r.id),isVisible=recordIndex>=0;
  const origin=history.state?.readerOrigin,backMonth=origin?.month||recordDate(r)?.slice(0,7);
  const backLabel=backMonth?'Back to '+displayDate(backMonth+'-01','month'):'Back to timeline';
  const sequence=`<nav class="tw-reader-sequence" aria-label="Browse articles in your results"><button type="button" data-reader-step="-1" ${recordIndex<=0?'disabled':''}>← Previous article</button><p class="tw-small">${isVisible?(recordIndex+1).toLocaleString()+' of '+filtered.length.toLocaleString():'Outside these results'}</p><button type="button" data-reader-step="1" ${recordIndex<0||recordIndex>=filtered.length-1?'disabled':''}>Next article →</button></nav>`;
  const follow=event?{records:sources.filter(s=>r.sourceIds.includes(s.id)),kind:'Supporting sources',label:'Sources for this reviewed entry'}:relatedSources(r,sources,editorial.collections);
  const related=[...follow.records].sort((a,b)=>(a.importedDate||'').localeCompare(b.importedDate||'')||a.id.localeCompare(b.id));
  const approvedRelations=editorial.relationships.filter(rel=>rel.status==='approved'&&(rel.from===r.id||rel.to===r.id));
  $('tw-detail').innerHTML=`<div class="tw-detail-top"><p class="tw-kicker">${event?'Reviewed entry':'Source record'}</p><button type="button" data-close-detail>← ${h(backLabel)}</button></div><div class="tw-detail-body">${sequence}${!isVisible?'<p class="tw-notice">This selected record is outside the active filters. Your timeline filters are preserved.</p>':''}<p class="tw-small">${h(event?r.eventTime.label:r.source+' · '+displayDate(r.importedDate))}</p><h2 id="tw-detail-title" tabindex="-1">${h(r.title)}</h2><p>${h(r.summary||'No summary stored. Consult the original source for its account.')}</p>${!event&&r.url?`<a class="tw-source-link" href="${h(r.url)}" target="_blank" rel="noopener noreferrer">Open original article ↗ · ${h(r.source)} <span class="tw-small">(opens a new tab)</span></a>`:''}${event?`<dl><dt>Event date</dt><dd>${h(r.eventTime.label)}</dd><dt>Date precision</dt><dd>${h(r.eventTime.precision)}</dd><dt>Date rationale</dt><dd>${h(r.eventTime.rationale)}</dd><dt>Editorial review</dt><dd>${h(r.review.reviewer)} · ${h(displayDate(r.review.reviewedAt.slice(0,10)))}</dd></dl>`:'<details class="tw-detail-context"><summary>Dates, access and source context</summary>'+sourceDates(r)+'</details>'}${!event&&r.flags.length?`<details><summary>Metadata notes (${r.flags.length})</summary><ul class="tw-small">${r.flags.map(f=>`<li>${h(f)}</li>`).join('')}</ul><p class="tw-small">Original imported fields remain in the archive dataset. No date was corrected from a URL alone.</p></details>`:''}<div class="tw-detail-actions">${event?'<button type="button" data-save-event="'+r.id+'">Save all supporting sources</button>':`<button type="button" class="tw-save" data-save="${r.id}" aria-pressed="${saved(r)}">${saved(r)?'Saved ✓':'Save source'}</button><button type="button" data-copy-source="${r.id}">Copy citation</button>`}<button type="button" data-share>Copy this view’s link</button></div>${!event?`<h3>Suggested threads</h3><p class="tw-small">${h(r.themes.map(id=>THEMES.find(t=>t[0]===id)[1]).join(' · ')||'Unassigned; editorial review needed.')}</p>`:''}<h3>Related reporting</h3><p class="tw-small">${h(follow.label)}<br>${h(follow.kind)}. ${event?'Supporting links retained with their own archive dates.':'These connections do not establish cause, agreement or verified event dates.'}</p><ol class="tw-follow">${related.map(s=>`<li${s.id===r.id?' class="is-current"':''}><p>Archive date · ${h(displayDate(s.importedDate))}</p><a href="${h(recordURL(s.id))}" data-select="${s.id}" ${s.id===r.id?'aria-current="true"':''}>${h(s.title)}</a><small>${h(s.source)}${s.id===r.id?' · You are here':''}</small></li>`).join('')}</ol>${related.length<=1&&!event?'<p class="tw-small">No sufficiently specific related reading suggestion is available in this snapshot.</p>':''}${approvedRelations.length?`<h3>Reviewed connections</h3><ul>${approvedRelations.map(rel=>`<li><a data-select="${h(rel.from===r.id?rel.to:rel.from)}" href="${h(recordURL(rel.from===r.id?rel.to:rel.from))}">${h(rel.type)}</a><p class="tw-small">${h(rel.explanation)}</p></li>`).join('')}</ul>`:''}<p class="tw-small">Permanent record ID<br>${h(r.id)}</p><a href="collab.html" class="tw-small">Suggest a metadata correction ↗</a></div>`;
  if(!reducedMotion())$('tw-detail').animate([{opacity:.3,transform:'translateX(14px)'},{opacity:1,transform:'translateX(0)'}],{duration:280,easing:'cubic-bezier(.2,.65,.3,1)'});
}
function render() {
  if(loading)return;
  $('tw-basis').innerHTML=state.mode==='sources'?'Dates shown are <strong>archive dates</strong>, not verified event or publication dates.':'Reviewed entries use <strong>event dates</strong>, with precision, date evidence and editorial review.';
  $('tw-routes').hidden=state.mode==='events';
  $('tw-mode-toolbar').hidden=!editorial.events.some(e=>e.status==='approved')&&state.mode!=='events';
  renderChips();renderList();renderOverview();renderDetail();syncSaveButtons();
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
function jumpToDate(date,focus='tw-period-button') {
 const dated=filtered.filter(r=>recordDate(r)).sort((a,b)=>recordDate(a).localeCompare(recordDate(b))||a.id.localeCompare(b.id));
 const target=dated.find(r=>recordDate(r)>=date)||dated.at(-1);
 if(!target){feedback('No dated articles match these filters. Remove a filter to explore more.');return;}
 const index=filtered.findIndex(r=>r.id===target.id);
 $('tw-date-picker').open=false;
 commit({at:recordDate(target),selected:'',limit:Math.min(filtered.length,index+30)},{start:index,focus});
 syncReadingMonth(recordDate(target).slice(0,7));
 requestAnimationFrame(()=>scrollToRecord(target.id,true));
 say(`Moved to ${displayDate(recordDate(target))}. Your filters are unchanged.`);
}
function selectPeriod(key,focus='tw-period-button') {jumpToDate(periodRange(key)[0],focus);}
function movePeriod(direction) {
 const keys=availableMonths(),index=keys.indexOf(readingMonth),next=keys[index+direction];
 if(next)selectPeriod(next,direction<0?'tw-previous':'tw-next');
}
const modalOpeners=new Map();
function openDialog(id,opener=document.activeElement){modalOpeners.set(id,opener);$('tw-more-menu').open=false;$(id).showModal();document.body.classList.add('tw-modal-open');}
for(const id of ['tw-filter-dialog','tw-options-dialog','tw-about-dialog','tw-packet-dialog'])$(id).addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.classList.remove('tw-modal-open');const opener=modalOpeners.get(id);if(opener?.isConnected&&opener.matches('[data-about]'))opener.focus({preventScroll:true});else $('tw-more-button').focus({preventScroll:true});});
function setSearchOpen(open,focus=true){if(open){$('tw-more-menu').open=false;$('tw-date-picker').open=false;}$('tw-search-panel').hidden=!open;$('tw-search-toggle').setAttribute('aria-expanded',String(open));if(focus)(open?$('tw-query'):$('tw-search-toggle')).focus({preventScroll:true});}
$('tw-search-toggle').addEventListener('click',()=>setSearchOpen($('tw-search-panel').hidden));
$('tw-search-close').addEventListener('click',()=>setSearchOpen(false));
$('tw-search-panel').addEventListener('submit',e=>{e.preventDefault();clearTimeout(searchTimer);applyForm();});
$('tw-refine-toggle').addEventListener('click',()=>openDialog('tw-filter-dialog'));
$('tw-options-open').addEventListener('click',()=>openDialog('tw-options-dialog'));
$('tw-about-open').addEventListener('click',()=>openDialog('tw-about-dialog'));
$('tw-period-button').addEventListener('click',()=>{if(!$('tw-date-picker').open){pickerYear=readingMonth.slice(0,4)||'2023';$('tw-picker-year').value=pickerYear;renderPicker();}});
$('tw-date-picker').addEventListener('toggle',()=>{if($('tw-date-picker').open)$('tw-more-menu').open=false;});
$('tw-picker-year').addEventListener('change',e=>{pickerYear=e.target.value;renderPicker();});
$('tw-more-menu').addEventListener('toggle',()=>{if($('tw-more-menu').open)$('tw-date-picker').open=false;});
$('tw-browse-all').addEventListener('click',()=>{
 const date=state.at||recordDate(filtered[windowStart]||{})||state.from||'2023-01-01';
 const expanded=getRecords(true),dated=expanded.filter(r=>recordDate(r)).sort((a,b)=>recordDate(a).localeCompare(recordDate(b))||a.id.localeCompare(b.id));
 const target=dated.find(r=>recordDate(r)>=date)||dated.at(-1),index=target?expanded.findIndex(r=>r.id===target.id):0;
 commit({from:'2023-01-01',to:'',at:target?recordDate(target):'',limit:Math.min(expanded.length,index+30)},{start:index,focus:'tw-period-button'});
 if(target)requestAnimationFrame(()=>scrollToRecord(target.id,true));
 say('Browsing all dates. Your other filters and reading date are preserved.');
});
$('tw-reader-dialog').addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.classList.remove('tw-modal-open');});
$('tw-reader-dialog').addEventListener('cancel',e=>{e.preventDefault();closeDetail();});
$('tw-reader-dialog').addEventListener('click',e=>{if(e.target===$('tw-reader-dialog')){const box=e.target.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)closeDetail();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')){for(const id of ['tw-date-picker','tw-more-menu'])if($(id).open){$(id).open=false;$(id).querySelector('summary').focus();return;}if(!$('tw-search-panel').hidden)setSearchOpen(false);}});
document.addEventListener('pointerdown',e=>{for(const id of ['tw-date-picker','tw-more-menu'])if($(id).open&&!$(id).contains(e.target))$(id).open=false;});
$('tw-image-toggle').addEventListener('click',()=>{imagePreference=!imagePreference;try{localStorage.setItem('echoes_timeline_images',imagePreference?'show':'hidden');}catch{}syncPreferences();renderList();});
$('tw-auto-load').addEventListener('click',()=>{autoLoad=!autoLoad;try{localStorage.setItem('echoes_timeline_auto_load',autoLoad?'on':'off');}catch{}syncPreferences();enhanceCards();});
document.addEventListener('error',e=>{if(e.target.matches?.('.tw-card-media img')){const card=e.target.closest('.tw-record-card');e.target.closest('.tw-card-media').remove();card?.classList.remove('has-image');}},true);
window.addEventListener('scroll',()=>{if(!scrollFrame){scrollFrame=true;requestAnimationFrame(()=>{updateReadingPosition();scrollFrame=false;});}},{passive:true});
$('tw-filter-form').addEventListener('submit',e=>{e.preventDefault();clearTimeout(searchTimer);applyForm();$('tw-filter-dialog').close();});
$('tw-query').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>applyForm(true),300);});
$('tw-to').addEventListener('input',()=>$('tw-to').setCustomValidity(''));
$('tw-from').addEventListener('input',()=>{$('tw-to').setCustomValidity('');$('tw-from').setCustomValidity('');});
$('tw-filter-form').addEventListener('change',e=>{if(e.target.closest('#tw-refinement')&&(e.target.type==='checkbox'||e.target.tagName==='SELECT'))applyForm();});
$('tw-publisher-search').addEventListener('input',e=>{$('tw-publishers').querySelectorAll('label').forEach(label=>label.hidden=!label.textContent.toLowerCase().includes(e.target.value.toLowerCase()));});
$('tw-clear').addEventListener('click',()=>{commit({...defaults(),mode:state.mode});showResults();});
$('tw-order').addEventListener('change',e=>{commit({order:e.target.value,limit:30});showResults();});
$('tw-more').addEventListener('click',()=>loadMore(true));$('tw-before').addEventListener('click',loadEarlier);
$('tw-earlier').addEventListener('click',()=>{const keys=availableMonths();if(keys.length)selectPeriod(keys[0]);});
$('tw-latest').addEventListener('click',()=>{const dates=filtered.map(recordDate).filter(Boolean).sort();if(dates.length)jumpToDate(dates.at(-1));});
$('tw-previous').addEventListener('click',()=>movePeriod(-1));$('tw-next').addEventListener('click',()=>movePeriod(1));
$('tw-jump-button').addEventListener('click',()=>{const input=$('tw-jump'),date=civilDate(input.value);if(date&&input.checkValidity())jumpToDate(date);else{input.setCustomValidity('Choose an archive date from 2023 through the latest collected date.');input.reportValidity();}});
$('tw-jump').addEventListener('input',()=>$('tw-jump').setCustomValidity(''));
$('tw-packet-open').addEventListener('click',()=>{renderPacket();openDialog('tw-packet-dialog');});$('tw-packet-close').addEventListener('click',()=>$('tw-packet-dialog').close());
$('tw-copy-packet').addEventListener('click',()=>copy(packetText()));$('tw-download-text').addEventListener('click',()=>download(packetText(),'echoes-of-gaza-research-packet.txt','text/plain;charset=utf-8'));
$('tw-download-json').addEventListener('click',()=>download(JSON.stringify({version:1,exportedAt:new Date().toISOString(),privateNotes:$('tw-notes').value,sources:sources.filter(saved)},null,2),'echoes-of-gaza-research-packet.json','application/json'));
$('tw-clear-packet').addEventListener('click',()=>{if(!packet.length&&!$('tw-notes').value)return;packet=[];$('tw-notes').value='';try{localStorage.removeItem(notesKey);}catch{}persistPacket();syncSaveButtons();renderPacket();$('tw-packet-status').textContent='Packet and private notes cleared.';});
$('tw-notes').addEventListener('input',()=>{try{localStorage.setItem(notesKey,$('tw-notes').value);$('tw-packet-status').textContent='Notes saved in this browser.';}catch{$('tw-packet-status').textContent='Storage unavailable. Notes last for this visit only.';}});
for(const dialog of [$('tw-packet-dialog'),$('tw-copy-dialog'),$('tw-filter-dialog'),$('tw-options-dialog'),$('tw-about-dialog')])dialog.addEventListener('click',e=>{if(e.target===dialog){const box=dialog.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)dialog.close();}});
document.addEventListener('click',e=>{
  const b=e.target.closest('button,a');if(!b){const card=e.target.closest('[data-card-select]');if(card&&!window.getSelection()?.toString()&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey)openRecord(card.dataset.cardSelect);return;}
  if(b.dataset.closeDialog){$(b.dataset.closeDialog).close();return;}
  if(b.hasAttribute('data-about')){openDialog('tw-about-dialog',b);return;}
  if(b.dataset.select){if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();openRecord(b.dataset.select);}
  else if(b.dataset.thread){commit({themes:[b.dataset.thread],limit:30});showResults();}
  else if(b.dataset.mode){$('tw-about-dialog').close();commit({mode:b.dataset.mode,selected:'',limit:30});}
  else if(b.dataset.route){if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();$('tw-filter-dialog').close();commit({collection:b.dataset.route,limit:30});showResults();}
  else if(b.hasAttribute('data-reset')){commit({...defaults(),mode:state.mode});showResults();}
  else if(b.dataset.period)selectPeriod(b.dataset.period,b.id);
  else if(b.dataset.readerStep){const index=filtered.findIndex(r=>r.id===state.selected),next=filtered[index+Number(b.dataset.readerStep)];if(next)openRecord(next.id);}
  else if(b.dataset.save)save(sources.find(r=>r.id===b.dataset.save));
  else if(b.hasAttribute('data-close-detail'))closeDetail();
  else if(b.dataset.copySource)copy(citation(sources.find(r=>r.id===b.dataset.copySource),$('tw-citation-style').value));
  else if(b.hasAttribute('data-share'))copy(location.href);
  else if(b.dataset.saveEvent){const event=editorial.events.find(ev=>ev.id===b.dataset.saveEvent);packet=[...new Set([...packet,...sources.filter(r=>event.sourceIds.includes(r.id)).map(r=>r.packetId)])];persistPacket();syncSaveButtons();renderPacket();feedback('Supporting sources saved.');}
  else if(b.dataset.packetRemove){const r=sources.find(r=>r.id===b.dataset.packetRemove);packet=packet.filter(id=>id!==r.packetId);persistPacket();syncSaveButtons();renderPacket();$('tw-packet-close').focus();}
  else if(b.dataset.packetSelect){if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();$('tw-packet-dialog').close();openRecord(b.dataset.packetSelect);}
  else if(b.dataset.removeFilter){const key=b.dataset.removeFilter;let patch={limit:30};if(key==='range')Object.assign(patch,{from:'2023-01-01',to:''});else if(key.startsWith('theme:'))patch.themes=state.themes.filter(v=>v!==key.slice(6));else if(key.startsWith('publisher:'))patch.publishers=state.publishers.filter(v=>v!==key.slice(10));else if(key.startsWith('type:'))patch.types=state.types.filter(v=>v!==key.slice(5));else patch[key]=key==='dates'?'all':'';commit(patch,{focus:'tw-results-title'});showResults();}
});
window.addEventListener('popstate',()=>{
 clearTimeout(searchTimer);const previous=state,next=parseState(location.search);
 const sameFeed=windowStart===(history.state?.windowStart??0)&&['mode','q','from','to','themes','publishers','types','status','dates','collection','granularity','order','limit'].every(k=>JSON.stringify(previous[k])===JSON.stringify(next[k]));
 state=next;windowStart=history.state?.windowStart??0;restoring=true;syncControls();
 if(sameFeed){renderDetail();markSelected();syncSaveButtons();}else render();
 requestAnimationFrame(()=>{const target=$(history.state?.focusId);target?.focus({preventScroll:true});window.scrollTo({top:history.state?.scroll||0,behavior:'instant'});restoring=false;updateReadingPosition();});
});
window.addEventListener('pagehide',()=>history.replaceState({...history.state,scroll:window.scrollY,windowStart},'',location.href));
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
    const eventCount=editorial.events.filter(e=>e.status==='approved').length;
    $('tw-event-count').textContent=eventCount;
    $('tw-mode-toolbar').hidden=!eventCount&&state.mode!=='events';
    $('tw-collection-policy').textContent=`${snapshot.importedCount.toLocaleString()} imported records become ${sources.length.toLocaleString()} unique public sources: ${snapshot.duplicateCount} duplicate imports grouped and ${snapshot.excluded.length} test or future record(s) withheld. The original import remains unchanged. The interactive timeline starts in 2023; earlier records remain in the static reading edition. Draft events are never published automatically.`;
    renderFacets();loading=false;syncPreferences();syncControls();if(state.q)setSearchOpen(true,false);
    filtered=getRecords();
    const savedView=history.state;
    if(savedView?.windowStart!==undefined)windowStart=Math.min(savedView.windowStart,Math.max(0,filtered.length-1));
    else if(state.at){const dated=filtered.filter(r=>recordDate(r)).sort((a,b)=>recordDate(a).localeCompare(recordDate(b))||a.id.localeCompare(b.id)),target=dated.find(r=>recordDate(r)>=state.at)||dated.at(-1);if(target){windowStart=filtered.findIndex(r=>r.id===target.id);state.limit=Math.max(state.limit,Math.min(filtered.length,windowStart+30));}}
    render();renderPacket();document.body.dataset.timelineReady='true';
    history.replaceState({...history.state,windowStart},'',stateURL(state));
    if(state.selected)requestAnimationFrame(()=>{$('tw-detail-title')?.focus({preventScroll:true});});
    else if(savedView?.scroll!==undefined)requestAnimationFrame(()=>window.scrollTo({top:savedView.scroll,behavior:'instant'}));
    else if(state.at)requestAnimationFrame(()=>scrollToRecord(filtered[windowStart]?.id));
  } catch(error) {loading=false;$('tw-results-title').textContent='Timeline temporarily unavailable';$('tw-error').hidden=false;$('tw-error').innerHTML='<h3>The collection could not be loaded.</h3><p>Your saved packet remains in this browser. Try again, or read the complete static chronology.</p><button type="button" id="tw-retry">Try again</button> <a href="timeline-sources.html">Static reading edition ↗</a>';$('tw-retry').addEventListener('click',()=>location.reload());$('tw-snapshot').textContent='Interactive data unavailable. Static reading edition available.';document.querySelectorAll('.tw-filters input,.tw-filters button,.tw-filters select,.tw-overview button,.tw-toolbar button,.tw-view-controls select').forEach(el=>el.disabled=true);console.error('Timeline load failed:',error);say('Collection unavailable. The static reading edition is available.');}
}
if('ResizeObserver' in window)new ResizeObserver(()=>document.documentElement.style.setProperty('--tw-rail-offset',`${$('tw-overview').getBoundingClientRect().height+84}px`)).observe($('tw-overview'));
load();
