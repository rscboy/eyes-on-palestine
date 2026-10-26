import { readFile, writeFile } from 'node:fs/promises';

// The intake needs publication names and domains, not every article body.
const articles = JSON.parse(await readFile(new URL('../data/articles.json', import.meta.url), 'utf8'));
const counts = new Map();
const sources = new Set();
for (const article of articles) {
  const source = String(article.source || '').trim();
  if (!source) continue;
  sources.add(source);
  try {
    const domain = new URL(article.link).hostname.toLowerCase().replace(/^www\./, '');
    const names = counts.get(domain) || new Map();
    names.set(source, (names.get(source) || 0) + 1);
    counts.set(domain, names);
  } catch { /* Records without a valid URL still contribute a source name. */ }
}
const domains = Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b)).map(([domain, names]) =>
  [domain, [...names].sort((a, b) => b[1] - a[1])[0][0]]));
const catalog = { sources: [...sources].sort((a, b) => a.localeCompare(b)), domains };
await writeFile(new URL('../data/submission-catalog.json', import.meta.url), JSON.stringify(catalog) + '\n');
console.log(`Built ${sources.size} publications and ${counts.size} domains.`);
