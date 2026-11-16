const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const html = fs.readFileSync(require('node:path').join(__dirname, '../collab.html'), 'utf8');
const fields = ['submitterName', 'link', 'date', 'title', 'source', 'documentType', 'authors', 'summary', 'imageUrl'];
const extraFields = ['link', 'date', 'title', 'source', 'documentType', 'authors', 'summary', 'imageUrl', 'primaryCategory', 'additionalCategories'];
const node = () => ({ value: '', checked: false, disabled: false, textContent: '', style: {}, classList: { toggle() {}, remove() {} } });

function submissionTransport(fetch) {
  const start = html.indexOf('        async function submitArticlePayload(');
  const code = html.slice(start, html.indexOf('        const draftFields', start));
  const ctx = vm.createContext({
    fetch, URL, crypto: require('node:crypto').webcrypto,
    AbortController, setTimeout, clearTimeout,
    googleScriptWebAppUrl: 'https://script.google.com/macros/s/test-deployment/exec'
  });
  vm.runInContext(code, ctx);
  return ctx.submitArticlePayload;
}

test('each submission bypasses cached Apps Script redirects and sends the complete POST body', async () => {
  const requests = [];
  const send = submissionTransport(async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ result: 'success', id: 'receipt' }) };
  });
  const payload = { action: 'submitArticle', title: 'Saved draft', link: 'https://example.com/article' };
  assert.equal((await send(payload)).id, 'receipt');
  await send(payload);
  assert.notEqual(requests[0].url, requests[1].url);
  for (const { url, options } of requests) {
    assert.ok(new URL(url).searchParams.get('submissionRequest'));
    assert.equal(options.method, 'POST');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'follow');
    assert.deepEqual(JSON.parse(options.body), payload);
  }
});

test('a backend rejection remains retryable and never becomes a success receipt', async () => {
  const { SubmissionOutbox } = require('../assets/submission-outbox.js');
  const data = new Map();
  const box = new SubmissionOutbox({getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value)});
  const payload = { action: 'submitArticle', title: 'Saved draft', link: 'https://example.com/article' };
  box.enqueue([payload]);
  await box.send(submissionTransport(async () => ({ok: true, json: async () => ({result: 'error', message: 'Unknown GET action.'})})));
  assert.equal(box.state.entries[0].status, 'failed');
  assert.deepEqual(box.state.entries[0].payload, payload);
  assert.equal(box.state.entries[0].receipt, '');
  await box.send(submissionTransport(async () => ({ok: true, json: async () => ({result: 'success', id: 'retry-receipt'})})));
  assert.equal(box.state.entries[0].status, 'confirmed');
  assert.equal(box.state.entries[0].receipt, 'retry-receipt');
});

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

function removalFixture({ extraLinks, pastedLinks, primaryLink = 'https://haaretz.com/article' }) {
  const handlers = {};
  let savedDraft;
  let checklist;
  let progress;
  const entries = extraLinks.map(link => ({
    link: { value: link }, heading: { textContent: '' },
    remove() { entries.splice(entries.indexOf(this), 1); },
    querySelector() { return this.heading; }
  }));
  const ctx = vm.createContext({
    URL, EogSubmissionOutbox: require('../assets/submission-outbox.js'),
    linkIntakeInput: { value: pastedLinks.join('\n') },
    linkIntakeStatus: {}, multiArticleMode: { checked: true },
    errorMessage: { textContent: '1 pasted link(s) have not been built into articles.', style: { display: 'block' } },
    additionalArticles: {
      addEventListener(type, callback) { handlers[type] = callback; },
      querySelector: () => entries[0], querySelectorAll: () => entries
    },
    getExtraArticleField: (entry, field) => entry[field],
    collectArticleStatuses: () => [primaryLink, ...entries.map(entry => entry.link.value)]
      .map((link, index) => ({ link, label: `Article ${index + 1}`, missing: [] })),
    renderIntakeChecklist() { checklist = ctx.collectArticleStatuses().map(status => status.link); },
    setMetadataStatus(element, text) { element.textContent = text; },
    setLinkIntakeProgress(value) { progress = value; },
    setMultiArticleMode(enabled) { assert.equal(enabled, false); assert.equal(entries.length, 0); },
    saveSubmissionDraft() { savedDraft = { links: ctx.linkIntakeInput.value, extras: entries.map(entry => entry.link.value) }; }
  });
  const extract = (from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));
  vm.runInContext([
    extract('        function isProbablyUrl(', '        async function runWithConcurrency('),
    extract('        function updateIntakeReviewSummary(', '        async function runLinkIntake('),
    extract('        function setBatchEntryEvents(', '        function parseAuthors('),
    'setBatchEntryEvents();'
  ].join('\n'), ctx);
  return {
    ctx, entries,
    remove(index) {
      const entry = entries[index];
      const button = { closest: () => entry };
      handlers.click({ target: { closest: selector => selector === '[data-remove-extra-article]' ? button : null } });
    },
    get savedDraft() { return savedDraft; }, get checklist() { return checklist; }, get progress() { return progress; }
  };
}

test('Remove synchronizes pasted links, checklist, progress, numbering and saved draft', () => {
  const primary = 'https://haaretz.com/article';
  const removed = 'https://inquirer.com/article';
  const remaining = 'https://jpost.com/article';
  const fixture = removalFixture({ extraLinks: [removed, remaining], pastedLinks: [primary, removed, remaining] });
  fixture.remove(0);
  assert.equal(fixture.ctx.linkIntakeInput.value, `${primary}\n${remaining}`);
  assert.deepEqual(fixture.checklist, [primary, remaining]);
  assert.equal(fixture.progress.total, 2);
  assert.equal(fixture.ctx.linkIntakeStatus.textContent, 'All 2 articles are ready to review.');
  assert.equal(fixture.entries[0].heading.textContent, 'Article 2');
  assert.equal(fixture.ctx.errorMessage.style.display, 'none');
  assert.deepEqual(fixture.savedDraft, { links: `${primary}\n${remaining}`, extras: [remaining] });
});

test('Remove keeps genuinely unbuilt links blocked instead of silently dropping them', () => {
  const fixture = removalFixture({ extraLinks: ['https://inquirer.com/article'], pastedLinks: [
    'https://haaretz.com/article', 'https://inquirer.com/article', 'https://example.com/unbuilt'
  ] });
  fixture.remove(0);
  assert.equal(fixture.ctx.multiArticleMode.checked, false);
  assert.deepEqual(Array.from(fixture.ctx.getUnbuiltIntakeLinks()), ['https://example.com/unbuilt']);
  assert.equal(fixture.ctx.errorMessage.style.display, 'block');
  assert.equal(fixture.progress.total, 1);
  assert.equal(fixture.ctx.linkIntakeStatus.textContent, 'All 1 article is ready to review.');
});

test('Remove matches canonical URL variants without deleting another prepared copy', () => {
  const fixture = removalFixture({ extraLinks: ['https://www.inquirer.com/article/'], pastedLinks: [
    'https://haaretz.com/article', 'https://inquirer.com/article#section'
  ] });
  fixture.remove(0);
  assert.equal(fixture.ctx.linkIntakeInput.value, 'https://haaretz.com/article');
  const duplicate = removalFixture({ extraLinks: ['https://www.haaretz.com/article/'], pastedLinks: ['https://haaretz.com/article'] });
  duplicate.remove(0);
  assert.equal(duplicate.ctx.linkIntakeInput.value, 'https://haaretz.com/article');
});

test('removing an empty article preserves the pasted list and unrelated errors', () => {
  const fixture = removalFixture({ extraLinks: [''], pastedLinks: ['https://haaretz.com/article'] });
  fixture.ctx.errorMessage.textContent = 'Recovery storage is unavailable.';
  fixture.remove(0);
  assert.equal(fixture.ctx.linkIntakeInput.value, 'https://haaretz.com/article');
  assert.equal(fixture.ctx.errorMessage.textContent, 'Recovery storage is unavailable.');
  assert.equal(fixture.ctx.errorMessage.style.display, 'block');
});
