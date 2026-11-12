/* Durable secondary-article receipts. No request is sent before it is saved locally. */
(function (root) {
  'use strict';
  const KEY = 'echoes.article-outbox.v1';
  function articleKey(payload) {
    const url = new URL(payload.link);
    url.hash = '';
    url.hostname = url.hostname.replace(/^www\./, '');
    return url.href.replace(/\/$/, '');
  }
  class SubmissionOutbox {
    constructor(storage) {
      this.storage = storage;
      this.busy = false;
      const raw = storage.getItem(KEY);
      this.lastSerialized = raw;
      this.state = raw ? JSON.parse(raw) : { version: 1, entries: [], draft: null };
      if (this.state.version !== 1 || !Array.isArray(this.state.entries)) throw new Error('Saved submissions could not be read. Keep this browser data and contact the archive team.');
      this.state.entries.forEach(entry => {
        // A closed tab may have interrupted a response after the server saved it.
        if (entry.status === 'sending') entry.status = 'unconfirmed';
      });
    }
    commit(next) {
      const serialized = JSON.stringify(next);
      if (this.storage.getItem(KEY) !== this.lastSerialized) throw new Error('Another tab changed your saved submissions. Reload this page before sending more articles. Your current form has been kept.');
      this.storage.setItem(KEY, serialized);
      if (this.storage.getItem(KEY) !== serialized) throw new Error('The browser could not save a recovery copy. No further articles will be sent.');
      this.state = next;
      this.lastSerialized = serialized;
    }
    saveDraft(draft) { this.commit({ ...this.state, draft }); }
    enqueue(payloads) {
      const entries = this.state.entries.map(entry => ({ ...entry }));
      for (const payload of payloads) {
        const key = articleKey(payload);
        const existing = entries.find(entry => entry.key === key);
        if (!existing) entries.push({ key, payload, status: 'queued', receipt: '', error: '' });
        // Never overwrite a confirmed receipt or silently retry an uncertain request.
        else if (existing.status === 'queued' || existing.status === 'failed') existing.payload = payload;
      }
      this.commit({ ...this.state, entries });
      return payloads.map(articleKey);
    }
    update(key, changes) {
      this.commit({ ...this.state, entries: this.state.entries.map(entry => entry.key === key ? { ...entry, ...changes } : entry) });
    }
    async send(sendPayload, onProgress = () => {}, keys = null) {
      if (this.busy) throw new Error('Submissions are already being sent.');
      this.busy = true;
      try {
        const selected = keys ? new Set(keys) : null;
        const pending = this.state.entries.filter(entry => (!selected || selected.has(entry.key)) && ['queued', 'failed'].includes(entry.status));
        for (let i = 0; i < pending.length; i++) {
          const entry = pending[i];
          this.update(entry.key, { status: 'sending', error: '' });
          onProgress(i + 1, pending.length);
          let result;
          try { result = await sendPayload(entry.payload); }
          catch (error) {
            // One failure must not prevent the remaining articles being attempted.
            this.update(entry.key, { status: error.definitiveRejection ? 'failed' : 'unconfirmed', error: error.message || 'No confirmation received.' });
            continue;
          }
          // Do not treat a generic success flag as proof the article was stored.
          if (result?.result !== 'success' || !result.id) {
            this.update(entry.key, { status: 'unconfirmed', error: 'The server did not return a submission receipt.' });
            continue;
          }
          // Storage errors here stop processing: never report an unrecorded receipt as saved.
          this.update(entry.key, { status: 'confirmed', receipt: String(result.id), error: '', confirmedAt: new Date().toISOString() });
        }
        return this.state.entries.filter(entry => !selected || selected.has(entry.key));
      } finally { this.busy = false; }
    }
    allowUnconfirmedRetry() {
      this.commit({ ...this.state, entries: this.state.entries.map(entry => entry.status === 'unconfirmed' ? { ...entry, status: 'queued' } : entry) });
    }
  }
  root.EogSubmissionOutbox = { SubmissionOutbox, articleKey, KEY };
  if (typeof module !== 'undefined') module.exports = root.EogSubmissionOutbox;
})(typeof window !== 'undefined' ? window : globalThis);
