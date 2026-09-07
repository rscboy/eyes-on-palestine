/* News intake state is saved after every edit and every submission result. */
(() => {
    const $ = id => document.getElementById(id);
    const form = $('submissionForm');
    const storageKey = 'echoes.newsIntake.v1';
    const fields = { title:'Article title', source:'Publication', date:'Publication date', categories:'Categories', authors:'Authors', documentType:'Document type', summary:'Summary (optional)', imageUrl:'Image URL (optional)' };
    let records = [], busy = false, importing = false, saveAvailable = true;
    let archive = new Set(), archiveAvailable = false, pendingAvailable = true;
    const accepted = new Set();
    const canonical = value => {
        try {
            const u = new URL(value); u.hash = '';
            u.hostname = u.hostname.replace(/^www\./, '');
            for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) u.searchParams.delete(key);
            u.searchParams.sort();
            return u.hostname.toLowerCase() + u.pathname.replace(/\/+$/, '') + u.search;
        } catch { return ''; }
    };
    const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
    function issues(r) {
        const errors = {};
        if (!isProbablyUrl(r.link)) errors.link = 'Enter a valid article link.';
        if (!r.title.trim()) errors.title = 'Add the headline.';
        if (!r.source.trim()) errors.source = 'Add the publication name.';
        if (!r.unknownDate && !validDate(r.date)) errors.date = 'Add the publication date or choose date unknown.';
        if (!r.categories.length) errors.categories = 'Choose at least one category.';
        if (r.imageUrl && !isProbablyUrl(r.imageUrl)) errors.imageUrl = 'Use a full http or https image link, or leave it empty.';
        return errors;
    }
    const ready = r => !Object.keys(issues(r)).length && !r.loading && !r.duplicate && !['sent','sending'].includes(r.status);
    function save() {
        try {
            localStorage.setItem(storageKey, JSON.stringify({ version:1, name:$('news-name').value, links:$('news-links').value, records, accepted:[...accepted] }));
            $('news-save-status').textContent = 'Saved on this device · ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            saveAvailable = true;
        } catch {
            saveAvailable = false;
            $('news-save-status').textContent = 'This browser cannot save drafts. Keep this page open until you finish.';
        }
    }
    function fresh(link) {
        return { id:crypto.randomUUID(), link, title:'', source:'', date:'', unknownDate:false, categories:[], authors:'', documentType:'Article', summary:'', imageUrl:'', status:'draft', selected:false, expanded:false, loading:false, error:'', duplicate:'', edited:[] };
    }
    function restore() {
        try {
            const data = JSON.parse(localStorage.getItem(storageKey) || 'null');
            $('news-name').value = data?.name || localStorage.getItem(submitterNameStorageKey) || '';
            if (data?.version !== 1) return;
            $('news-links').value = data.links || '';
            (data.accepted || []).filter(v => typeof v === 'string').forEach(v => accepted.add(v));
            records = (data.records || []).filter(r => r && isProbablyUrl(r.link)).map(r => {
                const item = {...fresh(r.link), ...r, loading:false};
                item.categories = Array.isArray(r.categories) ? r.categories.filter(c => categories.includes(c)) : [];
                item.edited = Array.isArray(r.edited) ? r.edited : [];
                if (item.status === 'sending') { item.status = 'failed'; item.error = 'Receipt not confirmed. Retry checks whether this article was already received.'; }
                return item;
            });
        } catch { $('news-save-status').textContent = 'Could not restore the saved draft.'; }
    }
    function duplicateCheck() {
        const seen = new Set();
        for (const r of records) {
            const key = canonical(r.link);
            if (r.status === 'sent') { seen.add(key); continue; }
            if (archive.has(key)) r.duplicate = 'Already in the archive';
            else if (accepted.has(key)) r.duplicate = 'Already received on this device';
            else if (seen.has(key)) r.duplicate = 'Already in this batch';
            else if (r.duplicate !== 'Already pending review' && r.duplicate !== 'Already received') r.duplicate = '';
            seen.add(key);
        }
    }
    function status(r) {
        if (r.status === 'sent') return 'Received for editorial review' + (r.receipt ? ' · Reference: ' + r.receipt : '');
        if (r.duplicate) return r.duplicate;
        if (r.status === 'sending') return 'Submitting…';
        if (r.loading) return 'Finding article details…';
        if (r.status === 'failed') return r.error || 'Submission failed. Your article is saved for retry.';
        const missing = Object.keys(issues(r)).map(k => fields[k] || 'Article link');
        return missing.length ? 'Needs: ' + missing.join(', ') : 'Ready to submit' + (r.unknownDate ? ' · Editor will verify the date' : '');
    }
    function fieldMarkup(r, key, errors) {
        const id = r.id + '-' + key;
        let control;
        if (key === 'categories') {
            control = `<div class="news-category-choices">${r.categories.map(c => `<button type="button" data-category="${escapeHtml(c)}" aria-pressed="true" aria-label="Remove ${escapeHtml(c)}">${escapeHtml(c)} ×</button>`).join('')}</div>
                <select id="${id}" data-field="addCategory" class="form-select"><option value="">Choose a category</option>${categories.filter(c => !r.categories.includes(c)).map(c => `<option>${escapeHtml(c)}</option>`).join('')}</select>
                <p class="news-help">Suggested from the headline—select to confirm:</p><div class="news-category-choices">${categoriesSuggestedByTitle(r.title).filter(c => !r.categories.includes(c)).map(c => `<button type="button" class="small-interface-button" data-category="${escapeHtml(c)}" aria-pressed="false">${escapeHtml(c)}</button>`).join('') || '<span class="news-help">No suggestions yet. Choose a category above.</span>'}</div>`;
        } else if (key === 'documentType') {
            control = `<select id="${id}" data-field="${key}" class="form-select">${['Article','Press release','Blog','Social media post'].map(v => `<option ${r[key] === v ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
        } else if (key === 'summary') {
            control = `<textarea id="${id}" data-field="${key}" class="form-input" rows="3">${escapeHtml(r[key])}</textarea>`;
        } else {
            control = `<input id="${id}" data-field="${key}" class="form-input" type="${key === 'date' ? 'date' : key === 'imageUrl' ? 'url' : 'text'}" value="${escapeHtml(r[key])}" ${key === 'date' && r.unknownDate ? 'disabled' : ''} ${key === 'source' ? 'list="sourceDatabase"' : key === 'authors' ? 'list="authorDatabase"' : ''} aria-invalid="${Boolean(errors[key])}" aria-describedby="${id}-error">`;
        }
        if (key === 'date') control += `<label class="news-help"><input type="checkbox" id="${r.id}-unknownDate" data-field="unknownDate" ${r.unknownDate ? 'checked' : ''}>Date unknown—editor to verify</label>`;
        return `<div data-field-wrap="${key}" ${!r.expanded && !errors[key] ? 'hidden' : ''}><label for="${id}">${fields[key]}</label>${control}<p id="${id}-error" class="news-field-error">${escapeHtml(errors[key] || '')}</p></div>`;
    }
    function render() {
        const focus = document.activeElement;
        const focusId = focus?.id;
        const activeRecord = records.find(r => r.id === focus?.closest('[data-record]')?.dataset.record);
        if (activeRecord && focus?.matches('input:not([type=checkbox]), textarea')) activeRecord.expanded = true;
        const selection = typeof focus?.selectionStart === 'number' ? [focus.selectionStart, focus.selectionEnd] : null;
        duplicateCheck();
        $('news-cards').innerHTML = records.map(r => {
            const errors = issues(r), locked = r.status === 'sent' || busy, received = r.status === 'sent' || Boolean(r.duplicate);
            return `<article class="news-card" data-record="${r.id}">
                <div class="news-card-head">${isProbablyUrl(r.imageUrl) ? `<img src="${escapeHtml(r.imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<div><h3>${escapeHtml(r.title || 'Article details')}</h3><p class="news-help">${escapeHtml(r.source || domainLabel(r.link))} · ${escapeHtml(r.unknownDate ? 'Date to verify' : r.date || 'Date not found')}</p><a href="${escapeHtml(r.link)}" target="_blank" rel="noopener noreferrer">Open original article ↗</a></div></div>
                ${r.categories.length ? `<p class="news-help">${r.categories.map(escapeHtml).join(' · ')}</p>` : ''}
                <p class="news-card-status" role="status">${escapeHtml(status(r))}</p>
                ${r.lookupNote && !received ? `<p class="news-help">${escapeHtml(r.lookupNote)}</p>` : ''}
                <div class="news-actions"><label ${received ? 'hidden' : ''}><input id="${r.id}-selected" data-field="selected" type="checkbox" ${r.selected ? 'checked' : ''} ${locked || r.duplicate ? 'disabled' : ''}>Select for shared category</label>
                <button type="button" class="small-interface-button" data-action="expand" id="${r.id}-expand" ${received ? 'hidden' : ''} ${locked ? 'disabled' : ''}>${r.expanded ? 'Show only missing fields' : 'Edit details'}</button>
                <button type="button" class="small-interface-button" data-action="lookup" id="${r.id}-lookup" ${received ? 'hidden' : ''} ${locked || r.loading || r.duplicate ? 'disabled' : ''}>Retry details</button>
                <button type="button" class="small-interface-button" data-action="remove" ${busy ? 'disabled' : ''}>Remove</button></div>
                <fieldset class="news-fields" ${locked || r.duplicate ? 'disabled hidden' : ''}>${Object.keys(fields).map(k => fieldMarkup(r,k,errors)).join('')}</fieldset>
            </article>`;
        }).join('');
        if (focusId && $(focusId)) { $(focusId).focus({preventScroll:true}); if (selection) $(focusId).setSelectionRange(...selection); }
        $('news-bulk').hidden = records.filter(r => r.status !== 'sent').length < 2;
        $('news-submit').disabled = busy || !records.some(ready);
        $('news-submit').textContent = busy ? 'Submitting…' : `Submit ready articles (${records.filter(ready).length})`;
        $('news-retry').hidden = !records.some(r => r.status === 'failed' && ready(r));
        $('news-retry').disabled = busy;
        $('news-clear-sent').hidden = !records.some(r => r.status === 'sent');
        $('news-clear-sent').disabled = busy;
        $('news-add').disabled = busy || importing;
        $('news-links').disabled = busy;
        $('news-apply-category').disabled = busy;
    }
    async function post(payload) {
        const response = await fetchWithTimeout(googleScriptWebAppUrl, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(payload) }, 45000);
        const data = JSON.parse(response);
        if (data.result !== 'success') throw new Error(data.message || 'The server could not confirm receipt. Retry to check again.');
        return data;
    }
    async function checkPending(items) {
        if (!items.length) return;
        if (items.length > 100) {
            for (let start = 0; start < items.length; start += 100) await checkPending(items.slice(start, start + 100));
            return;
        }
        try {
            const data = await post({action:'checkArticleLinks', links:items.map(r => r.link)});
            pendingAvailable = true;
            for (const r of items) {
                const result = data.matches?.find(m => canonical(m.link) === canonical(r.link));
                if (result) {
                    r.duplicate = result.status === 'pending' ? 'Already pending review' : 'Already received';
                    if (r.status === 'failed') { r.status = 'sent'; r.error = ''; accepted.add(canonical(r.link)); }
                }
            }
        } catch {
            pendingAvailable = false;
            $('news-intake-status').textContent = 'Pending-review lookup is unavailable. Published articles and this device’s receipts are still checked.';
        }
    }
    async function lookup(r) {
        if (r.loading || r.status === 'sent' || r.duplicate) return;
        r.loading = true; render();
        try {
            await catalogReady;
            duplicateCheck();
            if (r.duplicate) return;
            const results = await Promise.allSettled([fetchMicrolinkMetadata(r.link), fetchArticleHtml(r.link).then(html => extractArticleMetadata(html,r.link))]);
            let metadata = {};
            for (const result of results) if (result.status === 'fulfilled') metadata = mergeMetadata(metadata,result.value);
            metadata.source = resolveSourceNameForArticle(r.link, metadata.source);
            metadata.authors = cleanAuthorMetadata(metadata.authors);
            for (const key of ['title','source','date','authors','summary','imageUrl','documentType']) {
                const value = cleanMetadataValue(metadata[key]);
                if (r.edited.includes(key) || (key === 'date' && r.unknownDate) || !isUsableMetadataValue(value)) continue;
                if (key === 'date' && !validDate(value)) continue;
                if (key === 'imageUrl' && !isProbablyUrl(value)) continue;
                if (key === 'documentType' && !['Article','Press release','Blog','Social media post'].includes(value)) continue;
                if (!r[key] || key === 'documentType') r[key] = value;
            }
            r.lookupNote = !r.title ? 'This publisher did not provide full details. Fill in the missing fields below.' : 'Details found. Please check the headline, publication, and date.';
        } catch { r.lookupNote = 'Could not load details. Enter the missing information or retry.'; }
        finally { r.loading = false; save(); render(); }
    }
    const catalogReady = fetch('./data/articles.json').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(items => {
        if (!Array.isArray(items)) throw new Error();
        archive = new Set(items.map(r => canonical(r.link)).filter(Boolean)); archiveAvailable = true;
        learnSourceDomainsFromLibrary(items);
        $('sourceDatabase').innerHTML = [...new Set([...Object.keys(SOURCE_IMAGE_URLS), ...items.map(r => r.source).filter(Boolean)])].sort().map(v => `<option value="${escapeHtml(v)}"></option>`).join('');
        render();
    }).catch(() => { $('news-intake-status').textContent = 'Archive lookup is unavailable. You can continue; duplicates are checked again when submitted.'; });
    async function addLinks() {
        if (importing || busy) return;
        const raw = $('news-links').value.trim();
        const urls = parseLinkList(raw);
        if (!urls.length) { $('news-intake-status').textContent = 'Paste a full http or https article link.'; return; }
        importing = true;
        const items = [];
        for (const url of urls) {
            let r = records.find(r => canonical(r.link) === canonical(url));
            if (!r) { r = fresh(url); records.push(r); }
            if (r.status !== 'sent') items.push(r);
        }
        const invalid = raw.split(/\s+/).filter(t => !parseLinkList(t).length);
        $('news-links').value = invalid.join('\n');
        $('news-intake-status').textContent = `Reviewing ${items.length} article links…`;
        save(); render();
        await catalogReady;
        duplicateCheck();
        await checkPending(items);
        await runWithConcurrency(items.filter(r => !r.duplicate), 3, lookup);
        importing = false;
        save(); render();
        $('news-intake-status').textContent = `${items.length} links reviewed. ${items.filter(ready).length} ready to submit. ${items.filter(r => r.duplicate).length} already received or in the archive.${pendingAvailable ? '' : ' Pending-review lookup unavailable.'}${archiveAvailable ? '' : ' Archive lookup unavailable.'}`;
        if (invalid.length) $('news-intake-status').textContent = 'Some text was not recognized as a link and remains above. The valid links were added.';
    }
    async function submit(failedOnly = false) {
        if (busy) return;
        if (!$('news-name').value.trim()) { $('news-name').setCustomValidity('Add your name for editorial records.'); $('news-name').reportValidity(); $('news-name').focus(); return; }
        const items = records.filter(r => ready(r) && (!failedOnly || r.status === 'failed'));
        if (!items.length) return;
        const submitterName = $('news-name').value.trim();
        busy = true; render();
        let sent = 0;
        try {
            await checkPending(items);
            for (const r of items) {
                if (r.duplicate) { save(); render(); continue; }
                r.status = 'sending'; r.error = ''; save(); render();
                const payload = buildArticlePayload({ ...r, submitterName, date:r.unknownDate ? '' : r.date, primaryCategory:r.categories[0], additionalCategories:r.categories.slice(1).join(', ') });
                payload.clientSubmissionId = r.id;
                payload.dateUnknown = r.unknownDate;
                try {
                    const result = await post(payload);
                    r.status = 'sent'; r.receipt = result.id || ''; r.selected = false; r.expanded = false;
                    accepted.add(canonical(r.link)); sent++;
                } catch (error) { r.status = 'failed'; r.error = error.message || 'Receipt not confirmed. Retry this article.'; }
                save(); render();
            }
        } finally {
            busy = false;
            $('news-progress').textContent = `${sent} received. ${records.filter(r => r.status === 'failed').length} need retry. Unfinished articles remain saved.`;
            save(); render();
        }
    }
    form.addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.hidden = true; }, true);
    form.addEventListener('submit', e => { e.preventDefault(); submit(); });
    $('news-add').addEventListener('click', addLinks);
    $('news-links').addEventListener('paste', () => setTimeout(addLinks,0));
    $('news-links').addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); addLinks(); } });
    $('news-name').addEventListener('input', () => $('news-name').setCustomValidity(''));
    $('news-retry').addEventListener('click', () => submit(true));
    $('news-clear-sent').addEventListener('click', () => { records = records.filter(r => r.status !== 'sent'); save(); render(); });
    $('news-bulk-category').innerHTML = '<option value="">Choose a category</option>' + categories.map(c => `<option>${escapeHtml(c)}</option>`).join('');
    $('news-apply-category').addEventListener('click', () => {
        const category = $('news-bulk-category').value;
        if (!category) return;
        const items = records.filter(r => r.selected && r.status !== 'sent' && !r.duplicate);
        items.forEach(r => { if (!r.categories.includes(category)) r.categories.push(category); });
        $('news-progress').textContent = items.length ? `Added ${category} to ${items.length} selected articles.` : 'Select articles using the checkbox on each card first.';
        save(); render();
    });
    form.addEventListener('input', e => {
        const r = records.find(r => r.id === e.target.closest('[data-record]')?.dataset.record);
        const key = e.target.dataset.field;
        if (r && key && !['selected','unknownDate','addCategory'].includes(key)) { r[key] = e.target.value; if (!r.edited.includes(key)) r.edited.push(key); }
        save();
        if (r && key && fields[key]) {
            const error = issues(r)[key] || '';
            const message = $(r.id + '-' + key + '-error');
            if (message) message.textContent = error;
            e.target.setAttribute('aria-invalid', String(Boolean(error)));
        }
        if (r && key === 'title') {
            const card = e.target.closest('[data-record]');
            card.querySelector('h3').textContent = r.title || 'Article details';
            card.querySelector('[data-field-wrap=categories]').outerHTML = fieldMarkup(r, 'categories', issues(r));
        }
        if (r) { const el = e.target.closest('[data-record]').querySelector('.news-card-status'); el.textContent = status(r); $('news-submit').disabled = busy || !records.some(ready); $('news-submit').textContent = `Submit ready articles (${records.filter(ready).length})`; }
    });
    form.addEventListener('change', e => {
        const r = records.find(r => r.id === e.target.closest('[data-record]')?.dataset.record);
        const key = e.target.dataset.field;
        if (r && key) {
            if (['selected','unknownDate'].includes(key)) r[key] = e.target.checked;
            if (key === 'addCategory' && categories.includes(e.target.value) && !r.categories.includes(e.target.value)) r.categories.push(e.target.value);
            save();
            if (['selected','unknownDate','addCategory'].includes(key)) render();
        }
    });
    form.addEventListener('click', e => {
        const r = records.find(r => r.id === e.target.closest('[data-record]')?.dataset.record);
        if (!r || busy) return;
        const button = e.target.closest('button');
        if (!button) return;
        if (button.dataset.category) { const c = button.dataset.category; r.categories = r.categories.includes(c) ? r.categories.filter(v => v !== c) : [...r.categories,c]; }
        if (button.dataset.action === 'expand') r.expanded = !r.expanded;
        if (button.dataset.action === 'lookup') { lookup(r); return; }
        if (button.dataset.action === 'remove') records = records.filter(item => item !== r);
        save(); render();
    });
    window.addEventListener('beforeunload', e => { if (busy || (!saveAvailable && records.some(r => r.status !== 'sent'))) { e.preventDefault(); e.returnValue = ''; } });
    fetch('./data/authors.json').then(r => r.json()).then(items => { if (Array.isArray(items)) $('authorDatabase').innerHTML = items.map(v => `<option value="${escapeHtml(v)}"></option>`).join(''); }).catch(() => {});
    restore(); render();
    // Re-check restored drafts without re-fetching or overwriting contributor edits.
    catalogReady.then(() => checkPending(records.filter(r => r.status !== 'sent'))).then(() => { save(); render(); });
    const primaryDate = $('primaryDate');
    if (primaryDate) primaryDate.value = todayIsoDate();
})();
