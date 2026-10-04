import {THEMES,escapeHTML as h,displayDate,civilDate,today,defaults,parseState,stateURL,filterSources,periodCounts,periodRange,statusLabel,citation,relatedSources,validateEditorial} from './timeline-core.mjs?v=8';
const $=id=>document.getElementById(id), packetAPI=globalThis.EogPacket;
let state=parseState(location.search), snapshot, sources=[], editorial={events:[],relationships:[],collections:[]}, filtered=[], packet=packetAPI.read(), searchTimer, feedbackTimer, loading=true;
const notesKey='echoes_timeline_private_notes';
let imagePreference=true, autoLoad=true, revealObserver, moreObserver, scrollFrame=false;
let readingMonth='', pickerYear='', windowStart=0, restoring=false, inlineCloseOrigin=null;
const mobileLayout=matchMedia('(max-width:720px), (max-height:500px) and (pointer:coarse)');
const isMobile=()=>mobileLayout.matches;
const headerBottom=()=>document.querySelector('.site-shell-header')?.getBoundingClientRect().bottom||(isMobile()?54:60);
const recordDate=r=>r.publicationDate||r.importedDate||r.eventTime?.start;
const eventLabel=r=>(r.kind==='finding'?'Report published · ':'')+(civilDate(r.eventTime.label)?displayDate(r.eventTime.label):r.eventTime.label);
const itemWord=()=>state.mode==='events'?'events':'articles';
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
 $('tw-current-period').textContent=month?new Intl.DateTimeFormat('en',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z')):'No dated '+itemWord();
 $('tw-period-button').setAttribute('aria-label',month?'Choose month: '+displayDate(month+'-01','month'):'Choose a month');
 const keys=availableMonths(),index=keys.indexOf(month);
 $('tw-previous').disabled=index<=0;$('tw-next').disabled=index<0||index>=keys.length-1;
 document.querySelectorAll('#tw-years a').forEach(a=>{if(a.dataset.year===month.slice(0,4))a.setAttribute('aria-current','date');else a.removeAttribute('aria-current');});
 document.querySelectorAll('#tw-months button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.period===month)));
 if(!$('tw-date-picker').open && !$('tw-mobile-date-dialog').open && month){const nextYear=month.slice(0,4);if(pickerYear!==nextYear){pickerYear=nextYear;$('tw-picker-year').value=pickerYear;renderPicker();}}
}
function updateReadingPosition() {
 if(state.selected||restoring||document.querySelector('dialog[open]'))return;
 const cards=[...$('tw-records').children],edge=(isMobile()?headerBottom():$('tw-overview').getBoundingClientRect().bottom)+24;
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
 $('tw-shown').textContent=filtered.length?`Showing ${windowStart+1}–${Math.min(state.limit,filtered.length)} of ${filtered.length.toLocaleString()} ${itemWord()}.`:'';
 $('tw-events-tail').hidden=state.mode!=='events'||hasFilters()||!filtered.length||state.limit<filtered.length;
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
const recordURL=id=>{
 const parent=state.mode==='events'?(currentRecord()?.eventTime?state.selected:state.event):'',nextIsEvent=editorial.events.some(e=>e.id===id);
 const date=parent&&!nextIsEvent?recordDate(editorial.events.find(e=>e.id===parent)||{}):recordDate([...sources,...eventRecords()].find(r=>r.id===id)||{});
 return 'timeline.html'+stateURL({...state,selected:id,event:nextIsEvent?'':parent,at:date||state.at});
};
const saved=r=>packet.includes(r.packetId);
function say(message) {$('tw-announcement').textContent=message;}
function feedback(message) {$('tw-feedback').textContent=message;$('tw-feedback').hidden=false;clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>$('tw-feedback').hidden=true,4500);}
function persistPacket() {const persisted=packetAPI.write(packet);if(!persisted)feedback('Browser storage is unavailable. Your packet lasts for this visit only.');}
function save(r) {if(!r?.packetId)return;packet=saved(r)?packet.filter(id=>id!==r.packetId):[...packet,r.packetId];persistPacket();syncSaveButtons();renderPacket();feedback(saved(r)?'Source saved to your research packet.':'Source removed from your research packet.');}
function syncSaveButtons() {document.querySelectorAll('[data-save]').forEach(button=>{const r=sources.find(s=>s.id===button.dataset.save);const active=r&&saved(r);button.setAttribute('aria-pressed',String(Boolean(active)));button.textContent=active?'Saved ✓':'Save source';});$('tw-packet-count').textContent=sources.filter(saved).length;$('tw-packet-count').hidden=!sources.some(saved);}
function commit(patch,{replace=false,focus='',scroll=null,start=0}={}) {
  const detailOnly=Object.keys(patch).every(key=>key==='selected'||key==='event');
  const origin=patch.selected?(history.state?.readerOrigin||{scroll:window.scrollY,focusId:document.activeElement?.id||'',month:readingMonth}):null;
  history.replaceState({...history.state,scroll:window.scrollY,windowStart,focusId:document.activeElement?.id||''},'',location.href);
  if(!detailOnly){windowStart=start;readingMonth='';patch={at:'',...patch};}
  state={...state,...patch};
  history[replace?'replaceState':'pushState']({scroll:scroll??window.scrollY,windowStart,focusId:focus,opened:Boolean(patch.selected)&&(!replace||Boolean(history.state?.opened)),readerOrigin:origin},'',stateURL(state));
  syncControls();
  if(detailOnly){renderDetail();markSelected();syncSaveButtons();}else render();
  if(focus)requestAnimationFrame(()=>$(focus)?.focus({preventScroll:true}));
  if(scroll!==null)requestAnimationFrame(()=>window.scrollTo({top:scroll,behavior:'instant'}));
}
function markSelected(){
 const active=state.event||state.selected;
 document.querySelectorAll('#tw-records>li').forEach(el=>el.classList.toggle('is-selected',el.id==='row-'+active));
 document.querySelectorAll('.tw-event-card [data-select]').forEach(a=>a.setAttribute('aria-expanded',String(Boolean($('inline-'+a.dataset.select)))));
}
function openRecord(id) {
 const current=currentRecord(),nextIsEvent=editorial.events.some(e=>e.id===id),inline=state.mode==='events'&&nextIsEvent;
 if(inline&&state.selected===id){closeDetail();return;}
 const anchor=$('link-'+id),oldTop=anchor?.getBoundingClientRect().top;
 const parent=state.mode==='events'?(current?.eventTime?state.selected:state.event):'';
 // Archive articles get their own history step, so Back returns to the expanded event.
 const child=Boolean(parent&&!nextIsEvent),alreadyOpen=Boolean(state.selected);
 commit({selected:id,event:nextIsEvent?'':parent},{replace:alreadyOpen&&!child,focus:inline?'tw-inline-title':'tw-detail-title'});
 if(inline&&oldTop!==undefined)requestAnimationFrame(()=>{const nextTop=$('link-'+id)?.getBoundingClientRect().top;if(nextTop!==undefined)window.scrollBy({top:nextTop-oldTop,behavior:'instant'});history.replaceState({...history.state,readerOrigin:{scroll:scrollY,focusId:'link-'+id,month:recordDate(currentRecord())?.slice(0,7)||readingMonth}},'',location.href);});
 if(!inline)$('tw-detail').scrollTop=0;
}
function closeDetail() {
 if(history.state?.opened){if(state.mode==='events'&&currentRecord()?.eventTime)inlineCloseOrigin=history.state.readerOrigin;history.back();return;}
 if(state.event&&state.mode==='events'){openRecord(state.event);return;}
 const id=state.event||state.selected,origin=history.state?.readerOrigin;
 commit({selected:'',event:''},{replace:true,focus:origin?.focusId||('link-'+id),scroll:origin?.scroll??null});
 if(!origin&&$('row-'+id))requestAnimationFrame(()=>scrollToRecord(id));
 else if(!origin)$('tw-results-title').focus({preventScroll:true});
}
function scrollToRecord(id,animate=false) {
 const card=$('row-'+id);if(!card)return;
 const offset=(isMobile()?0:$('tw-overview').getBoundingClientRect().height)+headerBottom()+20;
 window.scrollTo({top:Math.max(0,card.getBoundingClientRect().top+scrollY-offset),behavior:animate&&!reducedMotion()?'smooth':'instant'});
}
function showResults() {requestAnimationFrame(()=>{const top=$('tw-records').getBoundingClientRect().top+scrollY-((isMobile()?0:$('tw-overview').getBoundingClientRect().height)+headerBottom()+20);if(scrollY>top)window.scrollTo({top:Math.max(0,top),behavior:'instant'});});}
function values(name) {return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(i=>i.value);}
function applyForm(replace=false) {
  const from=$('tw-from').value,to=$('tw-to').value;
  if(from&&from<'2023-01-01'){$('tw-from').setCustomValidity('The timeline starts in 2023.');$('tw-from').reportValidity();return;}
  $('tw-from').setCustomValidity('');
  if(from&&to&&from>to) {$('tw-to').setCustomValidity('The end date must be on or after the start date.');$('tw-to').reportValidity();return;}
  $('tw-to').setCustomValidity('');
  commit({...(state.mode==='events'?{selected:'',event:''}:{}),q:$('tw-query').value.trim(),from,to,themes:values('theme'),publishers:values('publisher'),types:values('type'),status:$('tw-status').value,dates:$('tw-dates').value,limit:30},{replace});
  $('tw-search-status').textContent=state.q?`${filtered.length.toLocaleString()} matching ${itemWord()}`:'';$('tw-search-status').hidden=!state.q;
  showResults();return true;
}
function syncControls(force=false) {
  for(const k of ['q','from','to','status','dates']){const input=$(k==='q'?'tw-query':'tw-'+k);if(k!=='q'||force||document.activeElement!==input)input.value=state[k];}
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
  $('tw-routes').innerHTML=editorial.collections.map(c=>`<a class="tw-route" href="${h('timeline.html'+stateURL({...defaults(),collection:c.id,mode:'sources',order:'oldest'}))}" data-route="${h(c.id)}"><h2>${h(c.title)}</h2><p>${h(c.description)}</p></a>`).join('');
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
  return editorial.events.filter(e=>e.status==='approved').map(e=>({...e,importedDate:e.eventTime.start,publicationDate:null,authors:[],source:'Key events',searchText:[e.shortSummary||'',e.context||'',e.humanImpact?.text||'',...(e.sourceIds||[]).map(id=>(editorial.references||[]).find(r=>r.id===id)?.source||sources.find(r=>r.id===id)?.title||'')].join(' '),documentType:'Event',flags:e.eventTime.precision==='unknown'?['Archive date unknown']:[],integrity:{status:'unchecked'},dateBasis:'Event date'}));
}
function getRecords(ignoreRange=false) {
  const s={...state,...(ignoreRange?{from:'',to:''}:{})};
  if(s.dates==='unknown'){s.from='';s.to='';}
  if(state.mode==='events') {s.publishers=[];s.types=[];s.status='';s.collection='';s.dates=state.dates==='unknown'?'unknown':'all';return filterSources(eventRecords(),s);}
  return filterSources(sources.filter(r=>!r.importedDate||r.importedDate>='2023-01-01'),s,editorial.collections);
}
function renderPicker() {
 const monthly=new Map(periodCounts(filtered,'month'));
 $('tw-months').innerHTML=Array.from({length:12},(_,i)=>{const key=pickerYear+'-'+String(i+1).padStart(2,'0'),count=monthly.get(key)||0,label=new Intl.DateTimeFormat('en',{month:'short',timeZone:'UTC'}).format(new Date(key+'-01T12:00:00Z'));return `<button type="button" id="period-${key}" data-period="${key}" aria-pressed="${readingMonth===key}" ${count?'':'disabled'} aria-label="${displayDate(key+'-01','month')}: ${count} matching ${itemWord()}${count?'':'; unavailable'}"><span>${label}</span></button>`;}).join('');
}
function renderOverview() {
 const years=Array.from({length:Number(snapshot.latest.slice(0,4))-2023+1},(_,i)=>String(2023+i));
 $('tw-years').hidden=state.mode!=='events';
 const eventYears=new Set(filtered.map(r=>recordDate(r)?.slice(0,4)));
 $('tw-years').innerHTML=years.map(year=>eventYears.has(year)?`<a id="year-${year}" href="${h('timeline.html'+stateURL({...state,selected:'',event:'',at:year+'-01-01'}))}" data-year="${year}">${year}</a>`:`<span class="tw-year-unavailable" aria-label="${year}: no matching events">${year}</span>`).join('');
 $('tw-picker-year').innerHTML=years.map(year=>`<option value="${year}">${year}</option>`).join('');
 const restricted=Boolean(state.to||(state.from&&state.from!=='2023-01-01'));
 $('tw-date-restriction').hidden=!restricted;
 $('tw-restriction-label').textContent=restricted?(state.from?.slice(0,7)===state.to?.slice(0,7)?displayDate(state.from,'month')+' only':'Date range active'):'';
 const date=recordDate(filtered[windowStart]||{}),month=date?.slice(0,7)||'';
 pickerYear=month.slice(0,4)||years[0];$('tw-picker-year').value=pickerYear;renderPicker();syncReadingMonth(month);
 $('tw-range-label').textContent=`Browsing ${filtered.length.toLocaleString()} matching ${itemWord()}. Date navigation moves through these results without changing filters.`;
 $('tw-earlier').disabled=!availableMonths().length;$('tw-latest').disabled=!availableMonths().length;
 $('tw-jump').max=snapshot.latest;
 requestAnimationFrame(()=>document.documentElement.style.setProperty('--tw-rail-offset',`${$('tw-overview').getBoundingClientRect().height+84}px`));
}
function sourceVisual(r) {
 if(!imagePreference||!r.imageUrl||/logo|logos|t-shirt|shop\/|ogimage/i.test(r.imageUrl))return '';
 return `<div class="tw-card-media"><img src="${h(r.imageUrl)}" alt="" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="tw-photo-note">Archive image · context unverified</span></div>`;
}
function row(r,index,previous='') {
 const event=state.mode==='events',date=event?r.eventTime.start:recordDate(r),key=date?.slice(0,7)||'unknown',visual=event?'':sourceVisual(r);
 if(event){
  const year=date?.slice(0,4),startsYear=year&&year!==previous.slice(0,4);
  return {key,html:`<li class="tw-record tw-event-record ${startsYear?'tw-year-start':''} ${r.id===state.selected?'is-selected':''}" id="row-${r.id}" data-date="${h(date||'')}" data-position="${index}">${startsYear?`<h2 class="tw-year-heading">${h(year)}</h2>`:''}<article class="tw-record-card tw-event-card" data-card-select="${r.id}"><div class="tw-card-copy"><p class="tw-event-date">${h(eventLabel(r))}</p><h3><a href="${h(recordURL(r.id))}" data-select="${r.id}" id="link-${r.id}" aria-expanded="false" aria-controls="inline-${r.id}">${h(r.title)}</a></h3><p class="tw-event-summary">${h(r.shortSummary||r.summary)}</p><span class="tw-event-source-link" aria-hidden="true">Read sources <span>⌄</span></span></div></article></li>`};
 }


 return {key,html:`<li class="tw-record ${r.id===state.selected?'is-selected':''}" id="row-${r.id}" data-date="${h(date||'')}" data-position="${index}"><article class="tw-record-card ${visual?'has-image':''}" data-card-select="${r.id}">${visual}<div class="tw-card-copy"><div class="tw-record-meta"><span class="tw-source-type">${h(r.source)}</span><span>${event?'Event date':`<button type="button" class="tw-date-help" data-about aria-label="About archive dates">Archive date <span aria-hidden="true">ⓘ</span></button>`} · ${h(event?r.eventTime.label:displayDate(date))}</span></div><h3><a href="${h(recordURL(r.id))}" data-select="${r.id}" id="link-${r.id}">${h(r.title)}</a></h3></div></article></li>`};
}
function hasFilters(){return Boolean(state.q||state.themes.length||state.publishers.length||state.types.length||state.collection||state.to||state.from!=='2023-01-01'||state.status||state.dates!=='all');}
function renderList() {
  filtered=getRecords();
  if(state.mode==='events'){windowStart=0;state.limit=Math.max(30,filtered.length);}
  $('tw-results-eyebrow').textContent=state.mode==='events'?'Key events':'Source chronology';
  $('tw-results-title').textContent=hasFilters()?`${filtered.length.toLocaleString()} ${state.mode==='events'?(filtered.length===1?'event':'events'):(filtered.length===1?'article':'articles')}`:(state.mode==='events'?'Key events':'Articles');
  $('tw-results-title').dataset.count=filtered.length;
  $('tw-results-title').closest('.tw-results-header').classList.toggle('tw-sr-only',!hasFilters());
  let previous='';$('tw-records').innerHTML=filtered.slice(windowStart,state.limit).map((r,i)=>{const result=row(r,windowStart+i,previous);previous=result.key;return result.html;}).join('');
  syncLoadStatus();
  $('tw-empty').hidden=Boolean(filtered.length);
  enhanceCards();
  $('tw-results-context').hidden=true;
  $('tw-events-tail').hidden=state.mode!=='events'||hasFilters()||!filtered.length||state.limit<filtered.length;
 if(!filtered.length)$('tw-empty').innerHTML=state.mode==='events'&&!editorial.events.some(e=>e.status==='approved')?'<p class="tw-kicker">Editorial review comes first</p><h3>The reviewed chronology is being built.</h3><p>The source collection is available now. Event dates, supporting passages and relationships need editorial review before they become a chronology entry.</p><button type="button" data-mode="sources">Browse source records</button>':'<h3>No collected records match these filters.</h3><p>Try a wider date range or remove a filter. Unknown dates appear when no date range is selected.</p><button type="button" data-reset>Clear filters</button>';
}
function sourceDates(r) {return `<dl><dt>Event time</dt><dd>Not assigned to this source record</dd><dt>Publication time</dt><dd>${r.publicationDate?h(displayDate(r.publicationDate)):'Not verified'}</dd><dt>Archive date · imported metadata</dt><dd>${h(displayDate(r.importedDate))}</dd><dt>Source access</dt><dd>${h(statusLabel(r))}${r.integrity.checkedAt?`<br><span class="tw-small">Last check: ${h(displayDate(r.integrity.checkedAt.slice(0,10)))}<br>${h(r.integrity.method)}. This is a dated observation, not a current availability guarantee.</span>`:''}</dd><dt>Preservation</dt><dd>${r.integrity.captureURL?`<a href="${h(r.integrity.captureURL)}" target="_blank" rel="noopener noreferrer">Open recorded preserved copy ↗</a>${r.integrity.capturedAt?'<br>Capture recorded '+h(displayDate(r.integrity.capturedAt.slice(0,10))):''}`:'No preserved copy recorded'}</dd><dt>Author</dt><dd>${h(r.authors.length?r.authors.join(', '):'Unknown author')}</dd><dt>Document type</dt><dd>${h(r.documentType)}</dd><dt>Metadata review</dt><dd>Imported record · source body not verified${r.importNumbers.length>1?`<br>${r.importNumbers.length} exact-URL imports grouped into one source`:''}</dd></dl>`;}
function readerSequence(r){
 const index=filtered.findIndex(s=>s.id===r.id),event=Boolean(r.eventTime),word=event?'event':'article';
 return `<nav class="tw-reader-sequence" aria-label="Browse ${event?'events':'articles'} in your results"><button type="button" data-reader-step="-1" ${index<=0?'disabled':''}>← Previous ${word}</button><p class="tw-small">${index>=0?(index+1)+' of '+filtered.length:'Outside these results'}</p><button type="button" data-reader-step="1" ${index<0||index>=filtered.length-1?'disabled':''}>Next ${word} →</button></nav>`;
}
function renderImpact(r,references){
 if(!r.humanImpact)return '';
 const impact=r.humanImpact,links=references.filter(s=>impact.sourceIds.includes(s.id));
 return `<section class="tw-human-impact" aria-labelledby="tw-impact-heading"><h3 id="tw-impact-heading">What this meant for people</h3><p>${h(impact.text)}</p><p class="tw-small">Figures reported as of ${h(displayDate(impact.asOf))}. ${links.map(s=>`<a href="${h(s.url)}" target="_blank" rel="noopener noreferrer">${h(s.source)} <span aria-hidden="true">↗</span><span class="tw-sr-only"> (opens a new tab)</span></a>`).join(' · ')}</p></section>`;
}
function renderEventDetail(r){
 const references=(editorial.references||[]).filter(s=>r.sourceIds.includes(s.id)),archive=sources.filter(s=>[...(r.archiveSourceIds||[]),...r.sourceIds].includes(s.id));
 const rows=references.map(s=>`<li class="tw-evidence-source"><p class="tw-small">${h(s.source)}${s.publicationDate?' · Published '+h(displayDate(s.publicationDate)):''}</p><a href="${h(s.url)}" target="_blank" rel="noopener noreferrer">${h(s.title)} <span aria-hidden="true">↗</span><span class="tw-sr-only"> (opens a new tab)</span></a></li>`).join('');
 $('tw-detail').innerHTML=`<div class="tw-detail-top"><p class="tw-kicker">${r.kind==='finding'?'Documented finding':'Key event'}</p><button type="button" data-close-detail>← Back to events</button></div><div class="tw-detail-body tw-event-detail">${readerSequence(r)}<p class="tw-event-date">${h(eventLabel(r))}</p><h2 id="tw-detail-title" tabindex="-1">${h(r.title)}</h2><p>${h(r.summary)}</p>${r.context?'<p>'+h(r.context)+'</p>':''}${renderImpact(r,references)}<section aria-labelledby="tw-evidence-heading"><h3 id="tw-evidence-heading">Supporting sources</h3><p class="tw-small">Reports and documents behind this entry. Report dates and assessment periods may differ from incident dates.</p><ol class="tw-evidence-list">${rows}</ol></section>${archive.length?`<section aria-labelledby="tw-event-archive-heading"><h3 id="tw-event-archive-heading">${references.length?'Related archive reading':'Supporting archive articles'}</h3>${references.length?'<p class="tw-small">Further reading, including later reporting. Archive dates are not event dates.</p>':''}<ol class="tw-event-archive-list">${archive.map(s=>`<li><p class="tw-small">${h(s.source)} · Archive date ${h(displayDate(s.importedDate))}</p><a href="${h(recordURL(s.id))}" data-select="${s.id}">${h(s.title)} <span aria-hidden="true">→</span></a></li>`).join('')}</ol><button type="button" data-save-event="${r.id}">Save archive articles</button></section>`:''}<div class="tw-detail-actions"><button type="button" data-share>Copy this event’s link</button></div><details class="tw-event-method"><summary>How this event was sourced</summary><p class="tw-small">${h(r.eventTime.rationale)}</p><p class="tw-small">${h(r.review.method||'')}</p><p class="tw-small">${h(r.eventTime.precision)} date precision · Source check by ${h(r.review.reviewer)} on ${h(displayDate(r.review.reviewedAt))}. Selected milestones, not a complete chronology.</p></details></div>`;
 if(!reducedMotion())$('tw-detail-title').animate([{opacity:.3},{opacity:1}],{duration:180});
}
function renderInlineEvent(r){
 document.querySelectorAll('.tw-inline-event').forEach(el=>{if(!r||el.id!=='inline-'+r.id)el.remove();});
 if(!r)return;
 const card=$('row-'+r.id);if(!card)return;
 if($('inline-'+r.id)){markSelected();return;}
 const references=(editorial.references||[]).filter(s=>r.sourceIds.includes(s.id)),archive=sources.filter(s=>[...(r.archiveSourceIds||[]),...r.sourceIds].includes(s.id));
 const rows=references.map(s=>`<li class="tw-evidence-source"><p class="tw-small">${h(s.source)}${s.publicationDate?' · Published '+h(displayDate(s.publicationDate)):''}</p><a href="${h(s.url)}" target="_blank" rel="noopener noreferrer">${h(s.title)} <span aria-hidden="true">↗</span><span class="tw-sr-only"> (opens a new tab)</span></a></li>`).join('');
 const archiveRows=archive.map(s=>`<li><p class="tw-small">${h(s.source)} · Archive date ${h(displayDate(s.importedDate))}</p><a href="${h(recordURL(s.id))}" data-select="${s.id}">${h(s.title)} <span aria-hidden="true">→</span></a></li>`).join('');
 card.insertAdjacentHTML('beforeend',`<section class="tw-inline-event tw-event-detail" id="inline-${r.id}" aria-labelledby="link-${r.id}"><h4 id="tw-inline-title" tabindex="-1">What happened</h4><p>${h(r.summary)}</p>${r.context?'<p>'+h(r.context)+'</p>':''}${renderImpact(r,references).replaceAll('<h3','<h4').replaceAll('</h3>','</h4>')}<section aria-labelledby="tw-inline-evidence-heading"><h4 id="tw-inline-evidence-heading">Supporting sources</h4>${references.length?`<ol class="tw-evidence-list">${rows}</ol>`:`<ol class="tw-event-archive-list">${archiveRows}</ol>`}</section>${archive.length&&references.length?`<details class="tw-further-reading"><summary>Further reading</summary><p class="tw-small">Later and related archive articles. Their archive dates are not incident dates.</p><ol class="tw-event-archive-list">${archiveRows}</ol></details>`:''}<details class="tw-event-method"><summary>About these sources</summary><p class="tw-small">${h(r.eventTime.rationale)}</p><p class="tw-small">${h(r.review.method||'')}</p><p class="tw-small">${h(r.eventTime.precision)} date precision · ${h(r.review.reviewer)} · ${h(displayDate(r.review.reviewedAt))}. Selected coverage, not a complete chronology.</p><button type="button" data-share>Copy event link</button></details><button type="button" class="tw-close-inline" data-close-detail>Close details ↑</button></section>`);
 syncReadingMonth(r.eventTime.start.slice(0,7));markSelected();
 if(!reducedMotion())$('inline-'+r.id).animate([{opacity:.5},{opacity:1}],{duration:160});
}
function renderDetail() {
  const r=currentRecord();
  const dialog=$('tw-reader-dialog');
  const inlineEvent=state.mode==='events'?(r?.eventTime?r:editorial.events.find(e=>e.id===state.event)):null;
  renderInlineEvent(inlineEvent);
  const isInline=state.mode==='events'&&Boolean(r?.eventTime)&&Boolean($('row-'+r.id));
  document.body.classList.toggle('tw-reader-open',Boolean(state.selected)&&!isInline);
  if(!state.selected||isInline){if(dialog.open)dialog.close();return;}
  if(!dialog.open)dialog.showModal();
  if(!r){$('tw-detail').innerHTML='<div class="tw-detail-body"><h2 id="tw-detail-title" tabindex="-1">Source not found</h2><p>This link may refer to a record outside the current snapshot.</p><button type="button" data-close-detail>Return to the timeline</button></div>';return;}
  const event=Boolean(r.eventTime && r.sourceIds);if(event){renderEventDetail(r);return;}
  const parent=state.event&&editorial.events.find(e=>e.id===state.event),recordIndex=filtered.findIndex(s=>s.id===r.id),isVisible=Boolean(parent)||recordIndex>=0;
  const origin=history.state?.readerOrigin,backMonth=origin?.month||recordDate(r)?.slice(0,7);
  const backLabel=parent?'Back to event':backMonth?'Back to '+displayDate(backMonth+'-01','month'):'Back to timeline';
  const sequence=parent?`<nav class="tw-reader-sequence tw-event-return" aria-label="Return to the event"><button type="button" data-back-event="${h(parent.id)}">← Back to event</button></nav>`:`<nav class="tw-reader-sequence" aria-label="Browse articles in your results"><button type="button" data-reader-step="-1" ${recordIndex<=0?'disabled':''}>← Previous article</button><p class="tw-small">${isVisible?(recordIndex+1).toLocaleString()+' of '+filtered.length.toLocaleString():'Outside these results'}</p><button type="button" data-reader-step="1" ${recordIndex<0||recordIndex>=filtered.length-1?'disabled':''}>Next article →</button></nav>`;
  const follow=event?{records:sources.filter(s=>r.sourceIds.includes(s.id)),kind:'Supporting sources',label:'Sources for this reviewed entry'}:relatedSources(r,sources,editorial.collections);
  const related=[...follow.records].sort((a,b)=>(a.importedDate||'').localeCompare(b.importedDate||'')||a.id.localeCompare(b.id));
  const approvedRelations=editorial.relationships.filter(rel=>rel.status==='approved'&&(rel.from===r.id||rel.to===r.id));
  $('tw-detail').innerHTML=`<div class="tw-detail-top"><p class="tw-kicker">${event?'Reviewed entry':'Source record'}</p><button type="button" ${parent?'data-back-event="'+h(parent.id)+'"':'data-close-detail'}>← ${h(backLabel)}</button>${parent?'<button type="button" data-close-detail aria-label="Close article and return to timeline">Close</button>':''}</div><div class="tw-detail-body">${sequence}${!isVisible?'<p class="tw-notice">This selected record is outside the active filters. Your timeline filters are preserved.</p>':''}<p class="tw-small">${h(event?r.eventTime.label:r.source+' · '+displayDate(r.importedDate))}</p><h2 id="tw-detail-title" tabindex="-1">${h(r.title)}</h2><p>${h(r.summary||'No summary stored. Consult the original source for its account.')}</p>${!event&&r.url?`<a class="tw-source-link" href="${h(r.url)}" target="_blank" rel="noopener noreferrer">Open original article ↗ · ${h(r.source)} <span class="tw-small">(opens a new tab)</span></a>`:''}${event?`<dl><dt>Event date</dt><dd>${h(r.eventTime.label)}</dd><dt>Date precision</dt><dd>${h(r.eventTime.precision)}</dd><dt>Date rationale</dt><dd>${h(r.eventTime.rationale)}</dd><dt>Editorial review</dt><dd>${h(r.review.reviewer)} · ${h(displayDate(r.review.reviewedAt.slice(0,10)))}</dd></dl>`:'<details class="tw-detail-context"><summary>Dates, access and source context</summary>'+sourceDates(r)+'</details>'}${!event&&r.flags.length?`<details><summary>Metadata notes (${r.flags.length})</summary><ul class="tw-small">${r.flags.map(f=>`<li>${h(f)}</li>`).join('')}</ul><p class="tw-small">Original imported fields remain in the archive dataset. No date was corrected from a URL alone.</p></details>`:''}<div class="tw-detail-actions">${event?'<button type="button" data-save-event="'+r.id+'">Save all supporting sources</button>':`<button type="button" class="tw-save" data-save="${r.id}" aria-pressed="${saved(r)}">${saved(r)?'Saved ✓':'Save source'}</button><button type="button" data-copy-source="${r.id}">Copy citation</button>`}<button type="button" data-share>Copy this view’s link</button></div>${!event?`<h3>Suggested threads</h3><p class="tw-small">${h(r.themes.map(id=>THEMES.find(t=>t[0]===id)[1]).join(' · ')||'Unassigned; editorial review needed.')}</p>`:''}<h3>Related reporting</h3><p class="tw-small">${h(follow.label)}<br>${h(follow.kind)}. ${event?'Supporting links retained with their own archive dates.':'These connections do not establish cause, agreement or verified event dates.'}</p><ol class="tw-follow">${related.map(s=>`<li${s.id===r.id?' class="is-current"':''}><p>Archive date · ${h(displayDate(s.importedDate))}</p><a href="${h(recordURL(s.id))}" data-select="${s.id}" ${s.id===r.id?'aria-current="true"':''}>${h(s.title)}</a><small>${h(s.source)}${s.id===r.id?' · You are here':''}</small></li>`).join('')}</ol>${related.length<=1&&!event?'<p class="tw-small">No sufficiently specific related reading suggestion is available in this snapshot.</p>':''}${approvedRelations.length?`<h3>Reviewed connections</h3><ul>${approvedRelations.map(rel=>`<li><a data-select="${h(rel.from===r.id?rel.to:rel.from)}" href="${h(recordURL(rel.from===r.id?rel.to:rel.from))}">${h(rel.type)}</a><p class="tw-small">${h(rel.explanation)}</p></li>`).join('')}</ul>`:''}<p class="tw-small">Permanent record ID<br>${h(r.id)}</p><a href="collab.html" class="tw-small">Suggest a metadata correction ↗</a></div>`;
  if(!reducedMotion())$(isMobile()?'tw-detail-title':'tw-detail').animate([{opacity:.3,transform:'translateX(14px)'},{opacity:1,transform:'translateX(0)'}],{duration:280,easing:'cubic-bezier(.2,.65,.3,1)'});
}
function render() {
  if(loading)return;
  $('tw-basis').innerHTML=state.mode==='sources'?'Dates shown are <strong>archive dates</strong>, not verified event or publication dates.':'Attacks use <strong>incident dates</strong>; findings are labeled <strong>Report published</strong>. Each entry cites its sources and an AI-assisted source check.';
  document.body.classList.toggle('tw-events-view',state.mode==='events');
  document.querySelectorAll('#tw-view-tabs [data-mode]').forEach(b=>b.hidden=b.dataset.mode===state.mode);
  for(const id of ['tw-refine-toggle','tw-packet-open','tw-options-open'])$(id).hidden=state.mode==='events';
  $('tw-date-open').hidden=state.mode!=='events';
  const useDateSheet=isMobile()||state.mode==='events';
  (useDateSheet?$('tw-mobile-date-content'):$('tw-date-picker')).append(dateContent);
  $('tw-view-tabs').hidden=!editorial.events.some(e=>e.status==='approved');
  $('tw-events-intro').hidden=state.mode!=='events';
  $('tw-advanced').hidden=state.mode==='events';$('tw-image-toggle').hidden=state.mode==='events';$('tw-auto-load').hidden=state.mode==='events';document.querySelectorAll('.tw-search-submit,.tw-filter-submit button').forEach(b=>b.textContent='Show '+itemWord());$('tw-mobile-search-title').textContent=state.mode==='events'?'Search events':'Search the archive';$('tw-detail').setAttribute('aria-label',state.mode==='events'?'Event and supporting article details':'Article details');$('tw-topic-heading').hidden=state.mode==='events';$('tw-routes').hidden=state.mode==='events';
  $('tw-search-toggle').setAttribute('aria-label',state.mode==='events'?'Search events':'Search articles');
  document.querySelector('.tw-search-label').textContent=state.mode==='events'?'Search events':'Search articles';
  $('tw-query').placeholder=state.mode==='events'?'Search events, places or topics…':'Search people, places or topics…';
  $('tw-previous').setAttribute('aria-label','Previous month with '+itemWord());$('tw-next').setAttribute('aria-label','Next month with '+itemWord());
  $('tw-picker-help').textContent='Months without matching '+itemWord()+' are unavailable.';
  $('tw-earlier').textContent=state.mode==='events'?'First events · 2023':'First articles · 2023';$('tw-latest').textContent='Latest '+itemWord();
  $('tw-jump').closest('label').firstChild.textContent=state.mode==='events'?'Go to an event date':'Go to an archive date';
  $('tw-more').textContent='Load 30 more '+itemWord();$('tw-before').textContent='↑ Load earlier '+itemWord();
  $('tw-mode-toolbar').hidden=true;
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
 if(!target){feedback('No dated records match these filters. Remove a filter to explore more.');return;}
 const index=filtered.findIndex(r=>r.id===target.id);
 $('tw-date-picker').open=false;if($('tw-mobile-date-dialog').open)$('tw-mobile-date-dialog').close();
 if(state.mode==='events')focus='year-'+recordDate(target).slice(0,4);
 else if(isMobile())focus='tw-period-button';
 commit({at:recordDate(target),selected:'',event:'',limit:Math.min(filtered.length,index+30)},{start:state.mode==='events'?0:index,focus});
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
const toolDialogIds=['tw-filter-dialog','tw-options-dialog','tw-about-dialog','tw-packet-dialog','tw-mobile-date-dialog','tw-mobile-tools-dialog','tw-mobile-search-dialog'];
function openDialog(id,opener=document.activeElement){
 // Tool buttons move between native sheets; only the final sheet restores focus.
 if($('tw-mobile-tools-dialog').open&&id!=='tw-mobile-tools-dialog'){$('tw-mobile-tools-dialog').close();opener=$('tw-more-button');}
 modalOpeners.set(id,opener);$('tw-more-menu').open=false;$(id).showModal();document.body.classList.add('tw-modal-open');
}
for(const id of toolDialogIds)$(id).addEventListener('close',()=>{
 if(id==='tw-mobile-search-dialog'){$('tw-search-panel').hidden=true;$('tw-search-toggle').setAttribute('aria-expanded','false');}
 if(document.querySelector('dialog[open]'))return;
 document.body.classList.remove('tw-modal-open');
 const opener=modalOpeners.get(id),fallback=id==='tw-mobile-date-dialog'?(state.mode==='events'?'tw-more-button':'tw-period-button'):id==='tw-mobile-search-dialog'?'tw-search-toggle':'tw-more-button';
 if(opener?.isConnected&&opener.getClientRects().length&&!opener.closest('dialog:not([open])')&&(!opener.closest('details:not([open])')||opener.tagName==='SUMMARY'))opener.focus({preventScroll:true});else $(fallback).focus({preventScroll:true});
});
function setSearchOpen(open,focus=true){
 if(open){$('tw-more-menu').open=false;$('tw-date-picker').open=false;$('tw-search-status').textContent=state.q?`${filtered.length.toLocaleString()} matching ${itemWord()}`:'';$('tw-search-status').hidden=!state.q;}
 $('tw-search-panel').hidden=!open;$('tw-search-toggle').setAttribute('aria-expanded',String(open));
 if(isMobile()){if(open)openDialog('tw-mobile-search-dialog',$('tw-search-toggle'));else $('tw-mobile-search-dialog').close();}
 if(focus)(open?$('tw-query'):$('tw-search-toggle')).focus({preventScroll:true});
}
$('tw-search-toggle').addEventListener('click',()=>setSearchOpen($('tw-search-panel').hidden));
$('tw-search-close').addEventListener('click',()=>setSearchOpen(false));
$('tw-search-panel').addEventListener('submit',e=>{e.preventDefault();clearTimeout(searchTimer);if(applyForm()&&isMobile()){$('tw-query').blur();setSearchOpen(false);}});
$('tw-refine-toggle').addEventListener('click',()=>openDialog('tw-filter-dialog'));
$('tw-options-open').addEventListener('click',()=>openDialog('tw-options-dialog'));
$('tw-about-open').addEventListener('click',()=>openDialog('tw-about-dialog'));
$('tw-date-open').addEventListener('click',()=>{pickerYear=readingMonth.slice(0,4)||'2023';$('tw-picker-year').value=pickerYear;renderPicker();openDialog('tw-mobile-date-dialog',$('tw-more-button'));});
$('tw-period-button').addEventListener('click',e=>{
 if(!$('tw-date-picker').open){pickerYear=readingMonth.slice(0,4)||'2023';$('tw-picker-year').value=pickerYear;renderPicker();}
 if(isMobile()){e.preventDefault();openDialog('tw-mobile-date-dialog',$('tw-period-button'));}
});
$('tw-more-button').addEventListener('click',e=>{if(isMobile()){e.preventDefault();openDialog('tw-mobile-tools-dialog',$('tw-more-button'));}});
$('tw-date-picker').addEventListener('toggle',()=>{if($('tw-date-picker').open)$('tw-more-menu').open=false;});
$('tw-picker-year').addEventListener('change',e=>{pickerYear=e.target.value;renderPicker();});
$('tw-more-menu').addEventListener('toggle',()=>{if($('tw-more-menu').open)$('tw-date-picker').open=false;});
// The same controls move between desktop popovers and phone sheets: no duplicate state.
const dateContent=document.querySelector('.tw-date-popover'),toolsContent=document.querySelector('.tw-more-popover');
function syncMobileLayout(){
 const wasSearch=!$('tw-search-panel').hidden;
 for(const id of ['tw-mobile-date-dialog','tw-mobile-tools-dialog','tw-mobile-search-dialog'])if($(id).open)$(id).close();
 $('tw-date-picker').open=false;$('tw-more-menu').open=false;
 if(isMobile()){
  $('tw-mobile-date-content').append(dateContent);$('tw-mobile-tools-content').append(toolsContent);$('tw-mobile-search-content').append($('tw-search-panel'));
  $('tw-overview').before($('tw-date-restriction'));
  $('tw-search-panel').hidden=true;$('tw-search-toggle').setAttribute('aria-expanded','false');
 }else{
  (state.mode==='events'?$('tw-mobile-date-content'):$('tw-date-picker')).append(dateContent);$('tw-more-menu').append(toolsContent);
  document.querySelector('.tw-browse-row').after($('tw-search-panel'));
  $('tw-search-panel').after($('tw-date-restriction'));$('tw-search-panel').hidden=!wasSearch;$('tw-search-toggle').setAttribute('aria-expanded',String(wasSearch));
 }
 for(const id of ['tw-period-button','tw-more-button']){if(isMobile())$(id).setAttribute('aria-haspopup','dialog');else $(id).removeAttribute('aria-haspopup');}
}
mobileLayout.addEventListener('change',syncMobileLayout);syncMobileLayout();
function syncVisualViewport(){
 const viewport=window.visualViewport,height=viewport?.height||innerHeight,top=viewport?.offsetTop||0;
 document.documentElement.style.setProperty('--tw-visible-height',`${height}px`);
 document.documentElement.style.setProperty('--tw-visible-top',`${top}px`);
 document.documentElement.style.setProperty('--tw-keyboard-bottom',`${Math.max(0,innerHeight-height-top)}px`);
}
window.visualViewport?.addEventListener('resize',syncVisualViewport);window.visualViewport?.addEventListener('scroll',syncVisualViewport);window.addEventListener('resize',syncVisualViewport);syncVisualViewport();
$('tw-browse-all').addEventListener('click',()=>{
 const date=state.at||recordDate(filtered[windowStart]||{})||state.from||'2023-01-01';
 const expanded=getRecords(true),dated=expanded.filter(r=>recordDate(r)).sort((a,b)=>recordDate(a).localeCompare(recordDate(b))||a.id.localeCompare(b.id));
 const target=dated.find(r=>recordDate(r)>=date)||dated.at(-1),index=target?expanded.findIndex(r=>r.id===target.id):0;
 commit({from:'2023-01-01',to:'',selected:'',event:'',at:target?recordDate(target):'',limit:Math.min(expanded.length,index+30)},{start:index,focus:state.mode==='events'?'year-'+(recordDate(target||{})?.slice(0,4)||'2023'):'tw-period-button'});
 if(target)requestAnimationFrame(()=>scrollToRecord(target.id,true));
 say('Browsing all dates. Your other filters and reading date are preserved.');
});
$('tw-reader-dialog').addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.classList.remove('tw-modal-open');});
$('tw-reader-dialog').addEventListener('cancel',e=>{e.preventDefault();closeDetail();});
$('tw-reader-dialog').addEventListener('click',e=>{if(e.target===$('tw-reader-dialog')){const box=e.target.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)closeDetail();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')){for(const id of ['tw-date-picker','tw-more-menu'])if($(id).open){$(id).open=false;$(id).querySelector('summary').focus();return;}if(!$('tw-search-panel').hidden){setSearchOpen(false);return;}if(state.mode==='events'&&state.selected)closeDetail();}});
document.addEventListener('pointerdown',e=>{for(const id of ['tw-date-picker','tw-more-menu'])if($(id).open&&!$(id).contains(e.target))$(id).open=false;});
$('tw-image-toggle').addEventListener('click',()=>{imagePreference=!imagePreference;try{localStorage.setItem('echoes_timeline_images',imagePreference?'show':'hidden');}catch{}syncPreferences();renderList();});
$('tw-auto-load').addEventListener('click',()=>{autoLoad=!autoLoad;try{localStorage.setItem('echoes_timeline_auto_load',autoLoad?'on':'off');}catch{}syncPreferences();enhanceCards();});
document.addEventListener('error',e=>{if(e.target.matches?.('.tw-card-media img')){const card=e.target.closest('.tw-record-card');e.target.closest('.tw-card-media').remove();card?.classList.remove('has-image');}},true);
window.addEventListener('scroll',()=>{if(!scrollFrame){scrollFrame=true;requestAnimationFrame(()=>{updateReadingPosition();scrollFrame=false;});}},{passive:true});
$('tw-filter-form').addEventListener('submit',e=>{e.preventDefault();clearTimeout(searchTimer);if(applyForm())$('tw-filter-dialog').close();});
$('tw-query').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>applyForm(true),300);});
$('tw-to').addEventListener('input',()=>$('tw-to').setCustomValidity(''));
$('tw-from').addEventListener('input',()=>{$('tw-to').setCustomValidity('');$('tw-from').setCustomValidity('');});
$('tw-filter-form').addEventListener('change',e=>{if(e.target.closest('#tw-refinement')&&(e.target.type==='checkbox'||e.target.tagName==='SELECT'))applyForm();});
$('tw-publisher-search').addEventListener('input',e=>{$('tw-publishers').querySelectorAll('label').forEach(label=>label.hidden=!label.textContent.toLowerCase().includes(e.target.value.toLowerCase()));});
$('tw-clear').addEventListener('click',()=>{commit({...defaults(),mode:state.mode});showResults();});
$('tw-order').addEventListener('change',e=>{commit({order:e.target.value,limit:30});showResults();});
$('tw-more').addEventListener('click',()=>loadMore(true));$('tw-before').addEventListener('click',loadEarlier);
$('tw-earlier').addEventListener('click',()=>{const keys=availableMonths();if(keys.length)selectPeriod(keys[0]);});
$('tw-latest-reporting').addEventListener('click',()=>{const date=snapshot.latest,records=filterSources(sources,{...defaults(),mode:'sources'}),index=records.findIndex(r=>recordDate(r)>=date);commit({...defaults(),mode:'sources',at:date,limit:Math.min(records.length,Math.max(0,index)+30)},{start:Math.max(0,index),focus:'tw-period-button'});requestAnimationFrame(()=>scrollToRecord(records[Math.max(0,index)].id,true));});
$('tw-latest').addEventListener('click',()=>{const dates=filtered.map(recordDate).filter(Boolean).sort();if(dates.length)jumpToDate(dates.at(-1));});
$('tw-previous').addEventListener('click',()=>movePeriod(-1));$('tw-next').addEventListener('click',()=>movePeriod(1));
$('tw-jump-button').addEventListener('click',()=>{const input=$('tw-jump'),date=civilDate(input.value);if(date&&input.checkValidity())jumpToDate(date);else{input.setCustomValidity('Choose an archive date from 2023 through the latest collected date.');input.reportValidity();}});
$('tw-jump').addEventListener('input',()=>$('tw-jump').setCustomValidity(''));
$('tw-packet-open').addEventListener('click',()=>{renderPacket();openDialog('tw-packet-dialog');});$('tw-packet-close').addEventListener('click',()=>$('tw-packet-dialog').close());
$('tw-copy-packet').addEventListener('click',()=>copy(packetText()));$('tw-download-text').addEventListener('click',()=>download(packetText(),'echoes-of-gaza-research-packet.txt','text/plain;charset=utf-8'));
$('tw-download-json').addEventListener('click',()=>download(JSON.stringify({version:1,exportedAt:new Date().toISOString(),privateNotes:$('tw-notes').value,sources:sources.filter(saved)},null,2),'echoes-of-gaza-research-packet.json','application/json'));
$('tw-clear-packet').addEventListener('click',()=>{if(!packet.length&&!$('tw-notes').value)return;packet=[];$('tw-notes').value='';try{localStorage.removeItem(notesKey);}catch{}persistPacket();syncSaveButtons();renderPacket();$('tw-packet-status').textContent='Packet and private notes cleared.';});
$('tw-notes').addEventListener('input',()=>{try{localStorage.setItem(notesKey,$('tw-notes').value);$('tw-packet-status').textContent='Notes saved in this browser.';}catch{$('tw-packet-status').textContent='Storage unavailable. Notes last for this visit only.';}});
for(const dialog of [...toolDialogIds.map($),$('tw-copy-dialog')])dialog.addEventListener('click',e=>{if(e.target===dialog){const box=dialog.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)dialog.close();}});
document.addEventListener('click',e=>{
  const b=e.target.closest('button,a');if(!b){const card=e.target.closest('[data-card-select]');if(card&&!window.getSelection()?.toString()&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey)openRecord(card.dataset.cardSelect);return;}
  if(b.dataset.closeDialog){if(b.dataset.closeDialog==='tw-filter-dialog'){if(!applyForm())return;}$(b.dataset.closeDialog).close();return;}
  if(b.hasAttribute('data-about')){openDialog('tw-about-dialog',b);return;}
  if(b.dataset.select){if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();openRecord(b.dataset.select);}
  else if(b.dataset.thread){commit({themes:[b.dataset.thread],limit:30});showResults();}
  else if(b.dataset.year){if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();jumpToDate(b.dataset.year+'-01-01',b.id);}
  else if(b.dataset.mode){e.preventDefault();$('tw-about-dialog').close();commit({...defaults(),mode:b.dataset.mode},{focus:'tw-heading',scroll:0});}
  else if(b.dataset.route){if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();$('tw-filter-dialog').close();commit({collection:b.dataset.route,limit:30});showResults();}
  else if(b.dataset.backEvent){closeDetail();}
  else if(b.hasAttribute('data-reset')){commit({...defaults(),mode:state.mode});showResults();}
  else if(b.dataset.period)selectPeriod(b.dataset.period,b.id);
  else if(b.dataset.readerStep){const index=filtered.findIndex(r=>r.id===state.selected),next=filtered[index+Number(b.dataset.readerStep)];if(next)openRecord(next.id);}
  else if(b.dataset.save)save(sources.find(r=>r.id===b.dataset.save));
  else if(b.hasAttribute('data-close-detail'))closeDetail();
  else if(b.dataset.copySource)copy(citation(sources.find(r=>r.id===b.dataset.copySource),$('tw-citation-style').value));
  else if(b.hasAttribute('data-share'))copy(location.href);
  else if(b.dataset.saveEvent){const event=editorial.events.find(ev=>ev.id===b.dataset.saveEvent);packet=[...new Set([...packet,...sources.filter(r=>[...(event.archiveSourceIds||[]),...event.sourceIds].includes(r.id)).map(r=>r.packetId)])];persistPacket();syncSaveButtons();renderPacket();feedback('Archive articles saved.');}
  else if(b.dataset.packetRemove){const r=sources.find(r=>r.id===b.dataset.packetRemove);packet=packet.filter(id=>id!==r.packetId);persistPacket();syncSaveButtons();renderPacket();$('tw-packet-close').focus();}
  else if(b.dataset.packetSelect){if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();$('tw-packet-dialog').close();openRecord(b.dataset.packetSelect);}
  else if(b.dataset.removeFilter){const key=b.dataset.removeFilter;let patch={limit:30};if(key==='range')Object.assign(patch,{from:'2023-01-01',to:''});else if(key.startsWith('theme:'))patch.themes=state.themes.filter(v=>v!==key.slice(6));else if(key.startsWith('publisher:'))patch.publishers=state.publishers.filter(v=>v!==key.slice(10));else if(key.startsWith('type:'))patch.types=state.types.filter(v=>v!==key.slice(5));else patch[key]=key==='dates'?'all':'';commit(patch,{focus:'tw-results-title'});showResults();}
});
window.addEventListener('popstate',()=>{
 clearTimeout(searchTimer);const previous=state,next=parseState(location.search);
 if(inlineCloseOrigin){history.replaceState({...history.state,scroll:inlineCloseOrigin.scroll,focusId:inlineCloseOrigin.focusId},'',location.href);inlineCloseOrigin=null;}
 const sameFeed=windowStart===(history.state?.windowStart??0)&&['mode','q','from','to','themes','publishers','types','status','dates','collection','granularity','order','limit'].every(k=>JSON.stringify(previous[k])===JSON.stringify(next[k]));
 state=next;windowStart=history.state?.windowStart??0;restoring=true;syncControls(true);
 if(sameFeed){renderDetail();markSelected();syncSaveButtons();}else render();
 requestAnimationFrame(()=>{const target=$(history.state?.focusId);target?.focus({preventScroll:true});window.scrollTo({top:history.state?.scroll||0,behavior:'instant'});restoring=false;updateReadingPosition();});
});
window.addEventListener('pagehide',()=>history.replaceState({...history.state,scroll:window.scrollY,windowStart},'',location.href));
window.addEventListener('storage',e=>{if(e.key===packetAPI.key){packet=packetAPI.read();syncSaveButtons();renderPacket();}if(e.key===notesKey)$('tw-notes').value=e.newValue||'';});
async function load() {
  try {
    const data=await Promise.all(['data/timeline/sources.json','data/timeline/editorial.json'].map(async url=>{const r=await fetch(url,{cache:url.includes('editorial')?'no-cache':'default'});if(!r.ok)throw new Error('Dataset request failed');return r.json();}));
    snapshot=data[0];sources=snapshot.sources.filter(r=>!r.importedDate||r.importedDate<=today());editorial=data[1];
    if(!Array.isArray(sources)||!sources.length)throw new Error('No valid source records');
    const errors=validateEditorial(editorial,sources);if(errors.length)throw new Error('Editorial validation failed');
    const aliasMap=new Map();sources.forEach(r=>r.packetAliases.forEach(alias=>{if(!aliasMap.has(alias))aliasMap.set(alias,r.packetId);}));
    packet=[...new Set(packet.map(id=>aliasMap.get(id)||id))];persistPacket();
    if(state.event&&(state.mode!=='events'||!editorial.events.some(e=>e.id===state.event&&e.status==='approved')))state.event='';
    if(state.collection&&!editorial.collections.some(c=>c.id===state.collection))state.collection='';
    try{$('tw-notes').value=localStorage.getItem(notesKey)||'';}catch{}
    $('tw-snapshot').textContent=`${sources.filter(r=>r.importedDate>='2023-01-01').length.toLocaleString()} sources since 2023 · ${sources.length.toLocaleString()} in the full archive · Latest archive date ${displayDate(snapshot.latest)} · Built ${displayDate(snapshot.generatedAt.slice(0,10))}`;
    const eventCount=editorial.events.filter(e=>e.status==='approved').length;
    $('tw-event-count').textContent=eventCount;
    $('tw-mode-toolbar').hidden=true;
    $('tw-collection-policy').textContent=`${snapshot.importedCount.toLocaleString()} imported records become ${sources.length.toLocaleString()} unique public sources: ${snapshot.duplicateCount} duplicate imports grouped and ${snapshot.excluded.length} test or future record(s) withheld. The original import remains unchanged. The interactive timeline starts in 2023; earlier records remain in the static reading edition. Draft events are never published automatically.`;
    renderFacets();loading=false;syncPreferences();syncControls(true);if(state.q&&!isMobile())setSearchOpen(true,false);
    filtered=getRecords();
    const savedView=history.state,initialAt=state.at;
    if(savedView?.windowStart!==undefined)windowStart=Math.min(savedView.windowStart,Math.max(0,filtered.length-1));
    else if(state.at&&state.mode!=='events'){const dated=filtered.filter(r=>recordDate(r)).sort((a,b)=>recordDate(a).localeCompare(recordDate(b))||a.id.localeCompare(b.id)),target=dated.find(r=>recordDate(r)>=state.at)||dated.at(-1);if(target){windowStart=filtered.findIndex(r=>r.id===target.id);state.limit=Math.max(state.limit,Math.min(filtered.length,windowStart+30));}}
    render();renderPacket();document.body.dataset.timelineReady='true';
    history.replaceState({...history.state,windowStart},'',stateURL(state));
    if(state.selected)requestAnimationFrame(()=>{
      const record=currentRecord(),event=state.mode==='events'&&(record?.eventTime?record:editorial.events.find(e=>e.id===state.event));
      if(event)scrollToRecord(event.id);
      $(record?.eventTime&&state.mode==='events'?'tw-inline-title':'tw-detail-title')?.focus({preventScroll:true});
    });
    else if(savedView?.scroll!==undefined)requestAnimationFrame(()=>window.scrollTo({top:savedView.scroll,behavior:'instant'}));
    else if(initialAt)requestAnimationFrame(()=>{const target=state.mode==='events'?(filtered.find(r=>recordDate(r)>=initialAt)||filtered.at(-1)):filtered[windowStart];scrollToRecord(target?.id);});
  } catch(error) {loading=false;$('tw-results-title').textContent='Timeline temporarily unavailable';$('tw-error').hidden=false;$('tw-error').innerHTML='<h3>The collection could not be loaded.</h3><p>Your saved packet remains in this browser. Try again, or read the complete static chronology.</p><button type="button" id="tw-retry">Try again</button> <a href="timeline-sources.html">Static reading edition ↗</a>';$('tw-retry').addEventListener('click',()=>location.reload());$('tw-snapshot').textContent='Interactive data unavailable. Static reading edition available.';document.querySelectorAll('.tw-filters input,.tw-filters button,.tw-filters select,.tw-overview button,.tw-toolbar button,.tw-view-controls select').forEach(el=>el.disabled=true);console.error('Timeline load failed:',error);say('Collection unavailable. The static reading edition is available.');}
}
if('ResizeObserver' in window)new ResizeObserver(()=>document.documentElement.style.setProperty('--tw-rail-offset',`${$('tw-overview').getBoundingClientRect().height+84}px`)).observe($('tw-overview'));
load();
