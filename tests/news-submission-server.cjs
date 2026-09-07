const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const headers = ['id','status','type','submittedAt','submitted_by','date','title','summary','link','imageUrl','category','categories','categoryColor','source','author','authors','documentType'];
const rows = [headers];
let locked = false;
const sheet = {
 getLastColumn:() => headers.length,
 getRange:() => ({getValues:() => [headers]}),
 getDataRange:() => ({getValues:() => rows}),
 appendRow:row => { assert.equal(locked,true); rows.push(row); }
};
const context = vm.createContext({
 PropertiesService:{getScriptProperties:() => ({getProperty:() => 'test-sheet'})},
 SpreadsheetApp:{openById:() => ({getSheetByName:() => sheet})},
 Utilities:{getUuid:() => 'receipt-'+rows.length},
 LockService:{getScriptLock:() => ({waitLock:() => { assert.equal(locked,false); locked=true; }, releaseLock:() => {locked=false;}})},
 ContentService:{MimeType:{JSON:'json'}, createTextOutput:text => ({setMimeType:() => JSON.parse(text)})},
});
vm.runInContext(fs.readFileSync('scripts/secondary-submissions-apps-script.gs','utf8'), context);
const payload = {link:'https://www.example.com/story/?utm_source=news#heading', title:'Article', source:'Example News', submitted_by:'Test Contributor', categories:['Children'], date:'', dateUnknown:true};
const first = context.submitArticle_(payload);
assert.equal(first.result,'success');
assert.equal(rows.length,2);
assert.equal(rows[1][headers.indexOf('date')],'');
const retry = context.submitArticle_({...payload,link:'https://example.com/story'});
assert.equal(retry.id,first.id);
assert.equal(retry.duplicate,true);
assert.equal(rows.length,2);
const checked = context.checkArticleLinks_({links:['https://example.com/story?fbclid=abc','https://example.com/not-submitted']});
assert.equal(checked.matches.length,1);
assert.equal(checked.matches[0].status,'pending');
assert.deepEqual(Object.keys(checked.matches[0]).sort(),['link','status']);
assert.throws(() => context.submitArticle_({...payload, link:'https://example.com/new',dateUnknown:false}), /publication date/);
assert.equal(locked,false);
assert.throws(() => context.validateArticle_({date:'',title:'Article',link:payload.link,imageUrl:'https://example.com/image.jpg',category:'Children',categoryColor:'#ffffff',source:'Example'}),/date/);
console.log('PASS: unknown date preserved, approval requires date, URL duplicates return original receipt, retry does not append, lock released, pending lookup exposes only matching link status');
