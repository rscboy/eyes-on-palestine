const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const html = fs.readFileSync(require('node:path').join(__dirname, '../collab.html'), 'utf8');
const fields = ['submitterName', 'link', 'date', 'title', 'source', 'documentType', 'authors', 'summary', 'imageUrl'];
const extraFields = ['link', 'date', 'title', 'source', 'documentType', 'authors', 'summary', 'imageUrl', 'primaryCategory', 'additionalCategories'];
const node = () => ({ value: '', checked: false, disabled: false, textContent: '', style: {}, classList: { toggle() {}, remove() {} } });
test('restores all seven draft articles, original date, categories and unknown-author state', () => {
  const elements = Object.fromEntries([...fields, 'unknownAuthor'].map(id => [id, node()]));
  const entries = [];
  const draft = { fields: Object.fromEntries(fields.map(f => [f, f === 'date' ? '2026-11-11' : `saved-${f}`])), categories: ['Genocide','Children'], links: 'saved links', unknownAuthor: true, extras: Array.from({length:6}, (_, i) => ({fields:Object.fromEntries(extraFields.map(f=>[f,`${f}-${i}`])),unknownAuthor:i===0})) };
  const start = html.indexOf("        document.addEventListener('DOMContentLoaded', () => {\n            const draft = submissionOutbox");
  assert.ok(start > 0);
  const callback = html.slice(start, html.indexOf('        // Set default date to today for both forms', start));
  const ctx = vm.createContext({
    document:{getElementById:id=>elements[id],addEventListener:(event, fn)=>fn()},
    submissionOutbox:{state:{draft}}, draftFields:fields, extraDraftFields:extraFields,
    linkIntakeInput:node(),multiArticleMode:node(),multiArticleSection:node(),
    additionalArticles:{replaceChildren(){entries.length=0;},get lastElementChild(){return entries.at(-1);}},
    createExtraArticleBlock:()=>entries.push(Object.fromEntries([...extraFields,'unknownAuthor'].map(f=>[f,node()]))),
    getExtraArticleField:(entry,f)=>entry[f],syncSelectedCategories(){},updateImageUrlPreview(){},renderIntakeChecklist(){},renderSubmissionReceipts(){},saveSubmissionDraft(){}
  });
  vm.runInContext('const selectedCategories = []; let restoringSubmissionDraft = false; let submissionDraftReady = false;'+callback,ctx);
  assert.equal(entries.length,6); assert.equal(elements.date.value,'2026-11-11'); assert.equal(elements.authors.disabled,true);
  assert.equal(entries[0].authors.disabled,true); assert.equal(entries[5].title.value,'title-5');
  assert.deepEqual(Array.from(vm.runInContext('selectedCategories',ctx)),['Genocide','Children']);
  assert.equal(vm.runInContext('submissionDraftReady',ctx),true);
});
test('unchecking batch mode cannot erase or hide prepared articles', () => {
  const start=html.indexOf('        function setMultiArticleMode(');
  const code=html.slice(start,html.indexOf('        function getExtraArticleField(',start));
  let hidden=true;
  const ctx=vm.createContext({additionalArticles:{children:[{}],querySelector:()=>({})},multiArticleMode:node(),multiArticleSection:{classList:{toggle:(c,v)=>hidden=v}},document:{getElementById:()=>node()},createExtraArticleBlock:()=>assert.fail('Unexpected replacement')});
  vm.runInContext(code+';setMultiArticleMode(false)',ctx);
  assert.equal(ctx.additionalArticles.children.length,1); assert.equal(ctx.multiArticleMode.checked,true); assert.equal(hidden,false);
});
test('retrying an old batch preserves a newer form draft; only completed new submissions clear it', async () => {
  const start=html.indexOf('        async function sendSavedSubmissions(');
  const code=html.slice(start,html.indexOf("        submitButton.addEventListener('click'",start));
  const controls=[node(),node()];controls[1].disabled=true;
  const elements={authors:node(),unknownAuthor:node()};
  let clears=0,saves=0;
  const ctx=vm.createContext({form:{querySelectorAll:()=>controls},document:{getElementById:id=>elements[id]},submittingText:node(),errorMessage:node(),successMessage:node(),submissionOutbox:{send:async()=>[{status:'confirmed'}]},submitArticlePayload(){},renderSubmissionReceipts(){},resetArticleFormAfterSuccess(){clears++;},additionalArticles:{replaceChildren(){}},linkIntakeInput:node(),saveSubmissionDraft(){saves++;}});
  vm.runInContext(code,ctx);
  await ctx.sendSavedSubmissions();assert.equal(clears,0);
  await ctx.sendSavedSubmissions(['new-link']);assert.equal(clears,1);assert.equal(saves,2);
  assert.equal(controls[0].disabled,false);assert.equal(controls[1].disabled,true);
});
