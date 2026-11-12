const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SubmissionOutbox, KEY } = require('../assets/submission-outbox.js');
const payloads = Array.from({ length: 7 }, (_, i) => ({ title: `Article ${i + 1}`, link: `https://example.com/${i + 1}` }));
function storage() { const data = new Map(); return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) }; }
test('one rejection does not skip later articles and only failed articles retry', async () => {
  const box = new SubmissionOutbox(storage()); box.enqueue(payloads);
  let calls = 0;
  await box.send(async () => { calls++; if (calls === 2) { const error = new Error('Temporary rejection'); error.definitiveRejection = true; throw error; } return { result: 'success', id: `receipt-${calls}` }; });
  assert.equal(calls, 7); assert.equal(box.state.entries.filter(e => e.status === 'confirmed').length, 6);
  await box.send(async p => { assert.equal(p.title, 'Article 2'); calls++; return { result: 'success', id: 'retry' }; });
  assert.equal(calls, 8); assert.ok(box.state.entries.every(e => e.status === 'confirmed'));
});
test('lost responses remain recoverable and are not automatically retried', async () => {
  const store = storage(); const box = new SubmissionOutbox(store); box.saveDraft({ links: 'all seven', extras: payloads.slice(1) }); box.enqueue(payloads);
  let calls = 0;
  await box.send(async () => { calls++; if (calls === 2) throw new Error('Connection lost'); return { result: 'success', id: `receipt-${calls}` }; });
  const restored = new SubmissionOutbox(store);
  assert.equal(restored.state.draft.extras.length, 6); assert.equal(restored.state.entries[1].status, 'unconfirmed');
  await restored.send(async () => { throw new Error('Must not retry'); });
  restored.allowUnconfirmedRetry(); await restored.send(async () => ({ result: 'success', id: 'explicit-retry' }));
  assert.ok(restored.state.entries.every(e => e.status === 'confirmed'));
});
test('success without a receipt never counts as confirmed', async () => {
  const box = new SubmissionOutbox(storage()); box.enqueue(payloads.slice(0, 1)); await box.send(async () => ({ result: 'success' }));
  assert.equal(box.state.entries[0].status, 'unconfirmed');
});
test('confirmed links cannot be sent again after reload or a repeated click', async () => {
  const store = storage(); const box = new SubmissionOutbox(store); box.enqueue(payloads.slice(0, 1)); await box.send(async () => ({ result: 'success', id: 'confirmed' }));
  const restored = new SubmissionOutbox(store); restored.enqueue([{ ...payloads[0], link: 'https://www.example.com/1/#fragment' }]);
  await restored.send(async () => assert.fail('Resent a confirmed article')); assert.equal(restored.state.entries.length, 1);
});
test('a closed tab during a request restores an unconfirmed entry', () => {
  const store = storage(); const box = new SubmissionOutbox(store); box.enqueue(payloads.slice(0, 1)); box.update(box.state.entries[0].key, { status: 'sending' });
  assert.equal(new SubmissionOutbox(store).state.entries[0].status, 'unconfirmed');
});
test('storage failure prevents requests rather than losing the recovery copy', async () => {
  const store = storage(); const box = new SubmissionOutbox(store); box.enqueue(payloads);
  store.setItem = () => { throw new Error('Quota exceeded'); };
  await assert.rejects(box.send(async () => assert.fail('Sent without persistence')), /Quota/); assert.equal(box.busy, false);
});
test('concurrent clicks cannot submit a batch twice', async () => {
  const box = new SubmissionOutbox(storage()); box.enqueue(payloads.slice(0, 1)); let release;
  const sending = box.send(() => new Promise(resolve => { release = resolve; }));
  await assert.rejects(box.send(async () => assert.fail('Second sender')), /already/);
  release({ result: 'success', id: 'one' }); await sending;
});
test('storage write silently ignored is detected before a request', () => {
  const box = new SubmissionOutbox({ getItem: () => null, setItem: () => {} });
  assert.throws(() => box.enqueue(payloads), /recovery copy/);
});
test('a second tab cannot overwrite saved receipts or drafts', () => {
  const store = storage(); const first = new SubmissionOutbox(store); const second = new SubmissionOutbox(store);
  first.enqueue(payloads); assert.throws(() => second.saveDraft({ link: 'stale' }), /Another tab/);
  assert.equal(new SubmissionOutbox(store).state.entries.length,7);
});
