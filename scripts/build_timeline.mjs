import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import '../assets/research-packet.js';
import {buildSources,validateEditorial,escapeHTML,displayDate} from '../assets/timeline-core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), out=path.join(root,'data/timeline');
await mkdir(out,{recursive:true});
const read=async name=>JSON.parse(await readFile(path.join(root,name),'utf8'));
const articles=await read('data/articles.json');
let registry; try {registry=await read('data/timeline/source-registry.json');} catch {registry={version:1,records:[]};}
for (const a of articles) {
  const url=String(a.link || '').trim();
  let entry=registry.records.find(r=>r.urls.includes(url));
  if (!entry) {entry={id:'source-'+randomUUID(),urls:[url],packetId:EogPacket.id(a),packetAliases:[]};registry.records.push(entry);}
  entry.packetAliases=[...new Set([...entry.packetAliases,...EogPacket.aliases(a)])];
}
await writeFile(path.join(out,'source-registry.json'),JSON.stringify(registry,null,2)+'\n');
await writeFile(path.join(out,'packet-identities.json'),JSON.stringify(Object.fromEntries(registry.records.flatMap(r=>r.urls.map(url=>[url,r.packetId]))))+'\n');
const integrity=await read('data/integrity/latest.json'), overrides=await read('data/integrity/manual_overrides.json'), captures=await read('data/wayback/archive_status.json');
const {sources,excluded}=buildSources(articles,registry,integrity,overrides,captures);
let editorial;try {editorial=await read('data/timeline/editorial.json');} catch {
  const ids=numbers=>numbers.map(n=>registry.records.find(r=>r.urls.includes(articles[n-1].link.trim()))?.id).filter(Boolean);
  editorial={version:1,events:[],claims:[],relationships:[],revisions:[],collections:[{id:'nasser',title:'Nasser Hospital: follow the reporting',description:'A reading route through collected reporting. Connections are by subject; event dates and source bodies await review.',sourceIds:ids([482,484,502,503,604,44,40])},{id:'daily-life',title:'Life continues in the record',description:'Sources on swimming, beekeeping, education, art and everyday work. Read each account in its own words and context.',sourceIds:ids([52,81,153,171,236,1279,1284,1332,1336,1342])}]};
  await writeFile(path.join(out,'editorial.json'),JSON.stringify(editorial,null,2)+'\n');
}
const errors=validateEditorial(editorial,sources);if(errors.length)throw new Error(errors.join('\n'));
const dated=sources.map(r=>r.importedDate).filter(Boolean).sort();
const snapshot={version:1,generatedAt:new Date().toISOString(),corpusHash:createHash('sha256').update(JSON.stringify(articles)).digest('hex'),importedCount:articles.length,sourceCount:sources.length,duplicateCount:articles.length-excluded.length-sources.length,excluded,earliest:dated[0],latest:dated.at(-1),integritySnapshot:integrity.generated_at || integrity.generatedAt || null,sources};
await writeFile(path.join(out,'sources.json'),JSON.stringify(snapshot)+'\n');
const sorted=[...sources].sort((a,b)=>(b.importedDate||'').localeCompare(a.importedDate||'') || a.id.localeCompare(b.id));
const records=sorted.map(r=>`<article id="${escapeHTML(r.id)}"><p class="tw-kicker">Archive date · ${escapeHTML(displayDate(r.importedDate))} · ${escapeHTML(r.source)}</p><h2><a href="timeline.html?selected=${r.id}">${escapeHTML(r.title)}</a></h2><p>${escapeHTML(r.summary || 'No summary stored. Consult the original source.')}</p><a href="${escapeHTML(r.url)}" rel="noopener noreferrer">Original source</a></article>`).join('\n');
await writeFile(path.join(root,'timeline-sources.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Source chronology | Echoes of Gaza</title><link rel="stylesheet" href="assets/site-tokens.css"><link rel="stylesheet" href="assets/timeline.css"></head><body class="tw-static"><a class="tw-skip" href="#sources">Skip to sources</a><main id="sources" class="tw-static-main"><p class="tw-kicker">Echoes of Gaza · Static reading edition</p><h1>Threads of Witness</h1><p>${sources.length.toLocaleString()} unique source records. Dates are imported archive dates, not verified publication or event dates. Snapshot generated ${snapshot.generatedAt.slice(0,10)}.</p><p><a href="timeline.html">Open interactive timeline</a> · <a href="index.html#articles">Open archive</a></p>${records}</main></body></html>`);
console.log(`${articles.length} imports → ${sources.length} unique public sources; ${excluded.length} quarantined; ${snapshot.duplicateCount} duplicate imports. ${editorial.events.filter(e=>e.status==='approved').length} approved events.`);
