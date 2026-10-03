/* Shared packet identity; old truncated IDs remain readable during migration. */
(function (root) {
  const key = 'echoes_research_packet';
  let identities = {};
  const configure = mapping => { identities = mapping && typeof mapping === 'object' ? mapping : {}; };
  const normalize = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  function legacyHash(value) {
    return btoa(unescape(encodeURIComponent(String(value || '')))).replace(/=+$/g, '').slice(0, 48);
  }
  function fingerprint(article) {
    // Two independent full-input hashes avoid the old 48-character prefix collisions.
    const value = String(article.link || [article.source, article.date, article.title].join('|')).trim();
    let a = 2166136261, b = 5381;
    for (const c of value) { a = Math.imul(a ^ c.codePointAt(0), 16777619); b = Math.imul(b, 33) ^ c.codePointAt(0); }
    return 'v3-' + (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
  }
  function id(article) { return identities[String(article.link || '').trim()] || fingerprint(article); }
  function aliases(article) {
    return [...new Set([id(article), fingerprint(article), legacyHash(['v2', ...['source','date','title','link'].map(k => normalize(article[k]))].join('|')), legacyHash(article.link || `${article.source || ''}:${article.title || ''}:${article.date || ''}`)])];
  }
  function read() { try { const data = JSON.parse(root.localStorage.getItem(key) || '[]'); return Array.isArray(data) ? [...new Set(data.filter(x => typeof x === 'string'))] : []; } catch { return []; } }
  function write(ids) { try { root.localStorage.setItem(key, JSON.stringify([...new Set(ids)])); return true; } catch { return false; } }
  function migrate(ids, articles) {
    const lookup = new Map();
    for (const article of articles) for (const alias of aliases(article)) if (!lookup.has(alias)) lookup.set(alias, id(article));
    // Preserve IDs from other collections, and retain the old first-match policy for ambiguous legacy IDs.
    return [...new Set(ids.map(value => lookup.get(value) || value))];
  }
  root.EogPacket = {key, id, aliases, read, write, migrate, configure};
})(globalThis);
