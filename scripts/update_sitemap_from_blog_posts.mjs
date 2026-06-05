import fs from "node:fs/promises";

const SITE_ORIGIN = "https://echoesofgaza.org";
const SITEMAP_PATH = "sitemap.xml";
const BLOG_POSTS_PATH = "data/blog_posts.json";

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unescapeXml(value) {
  return String(value || "")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function parseSitemapEntries(xml) {
  const entries = [];
  String(xml || "").replace(/<url\b[\s\S]*?<\/url>/gi, (block) => {
    const locMatch = block.match(/<loc>([\s\S]*?)<\/loc>/i);
    if (!locMatch) return block;
    const lastmodMatch = block.match(/<lastmod>([\s\S]*?)<\/lastmod>/i);
    entries.push({
      loc: unescapeXml(locMatch[1].trim()),
      lastmod: lastmodMatch ? lastmodMatch[1].trim() : ""
    });
    return block;
  });
  return entries;
}

function toDateOnly(value, fallback) {
  if (!value) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const parsed = Date.parse(String(value));
  if (!Number.isFinite(parsed)) return fallback;
  return new Date(parsed).toISOString().slice(0, 10);
}

function isIndexablePost(post) {
  const status = String(post.status || "published").toLowerCase();
  if (status !== "published") return false;
  if (!post.path && !post.slug) return false;
  if (post.scheduledAt && Date.parse(post.scheduledAt) > Date.now()) return false;
  return true;
}

function sortKey(loc) {
  if (loc === `${SITE_ORIGIN}/`) return "0000";
  if (loc === `${SITE_ORIGIN}/blog`) return "0010";
  if (loc.startsWith(`${SITE_ORIGIN}/blog/`)) return `0011-${loc}`;
  return `0100-${loc}`;
}

function buildSitemap(existingXml, posts) {
  const today = new Date().toISOString().slice(0, 10);
  const byLoc = {};
  for (const entry of parseSitemapEntries(existingXml)) {
    if (!/^https:\/\/echoesofgaza\.org\/blog\/[^/]+\.html$/i.test(entry.loc)) {
      byLoc[entry.loc] = entry;
    }
  }

  byLoc[`${SITE_ORIGIN}/blog`] = {
    loc: `${SITE_ORIGIN}/blog`,
    lastmod: today
  };

  for (const post of posts.filter(isIndexablePost)) {
    const path = post.path || `${post.slug}.html`;
    const loc = `${SITE_ORIGIN}/blog/${encodeURI(path)}`;
    byLoc[loc] = {
      loc,
      lastmod: toDateOnly(post.updatedAt || post.publishedAt || post.date, today)
    };
  }

  const urls = Object.values(byLoc)
    .sort((a, b) => sortKey(a.loc).localeCompare(sortKey(b.loc)))
    .map((entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${escapeXml(entry.lastmod || today)}</lastmod>
  </url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

const [sitemapXml, rawPosts] = await Promise.all([
  fs.readFile(SITEMAP_PATH, "utf8"),
  fs.readFile(BLOG_POSTS_PATH, "utf8")
]);
let posts = JSON.parse(rawPosts || "[]");
posts = Array.isArray(posts) ? posts : posts.posts || [];
if (!Array.isArray(posts)) throw new Error("blog_posts.json must be an array or contain a posts array.");

const nextSitemap = buildSitemap(sitemapXml, posts);
await fs.writeFile(SITEMAP_PATH, nextSitemap);
console.log(`Updated ${SITEMAP_PATH} with ${posts.filter(isIndexablePost).length} published blog posts.`);
