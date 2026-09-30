import fs from "node:fs/promises";

const origin = "https://echoesofgaza.org";
const sources = {
  "/": "index.html", "/about": "about.html", "/blog": "blog.html",
  "/primary": "primary.html", "/toolkit": "toolkit.html", "/events": "events.html",
  "/podcast": "podcast.html", "/collab": "collab.html",
  "/blog_submit": "blog_submit.html", "/zionism_divide": "zionism_divide.html"
};
const raw = JSON.parse(await fs.readFile("data/blog_posts.json", "utf8"));
const posts = Array.isArray(raw) ? raw : raw.posts || [];
if (!Array.isArray(posts)) throw new Error("blog_posts.json must be an array or contain a posts array.");

const urls = [];
for (const [route, file] of Object.entries(sources)) {
  const html = await fs.readFile(file, "utf8");
  if (/<meta\s+name=["']robots["'][^>]*noindex/i.test(html)) continue;
  urls.push(origin + route);
}
for (const post of posts) {
  const status = String(post.status || "published").toLowerCase();
  const release = Date.parse(post.scheduledAt || post.publishedAt || post.date || "");
  if (["draft", "deleted"].includes(status) ||
      (status === "scheduled" && (!Number.isFinite(release) || release > Date.now()))) continue;
  if (!/^[a-z0-9-]+$/.test(post.slug || "")) continue;
  await fs.access(`blog/${post.slug}/index.html`);
  urls.push(`${origin}/blog/${post.slug}/`);
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}\n</urlset>\n`;
await fs.writeFile("sitemap.xml", xml);
console.log(`Updated sitemap.xml with ${urls.length} canonical, indexable URLs.`);
