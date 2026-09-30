import fs from "node:fs/promises";
import path from "node:path";

const ORIGIN = "https://echoesofgaza.org";
const raw = JSON.parse(await fs.readFile("data/blog_posts.json", "utf8"));
const posts = (Array.isArray(raw) ? raw : raw.posts || [])
  .filter((post) => {
    const status = String(post.status || "published").toLowerCase();
    if (["draft", "deleted"].includes(status)) return false;
    const release = Date.parse(post.scheduledAt || post.publishedAt || post.date || "");
    return status !== "scheduled" || (Number.isFinite(release) && release <= Date.now());
  })
  .filter((post) => /^[a-z0-9-]+$/.test(post.slug || ""))
  .sort((a, b) => Date.parse(b.publishedAt || b.date || 0) - Date.parse(a.publishedAt || a.date || 0));

const escape = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const author = (post) => typeof post.author === "string" ? post.author : post.author?.name || "Echoes of Gaza";
const url = (post) => `${ORIGIN}/blog/${post.slug}/`;
const summary = (post) => String(post.subtitle || "").replace(/\s+/g, " ").trim();
const cleanContent = (content) => String(content || "")
  .replace(/<(script|style|head|title|meta|link)\b[^>]*>(?:[\s\S]*?<\/\1>)?/gi, "")
  .replace(/<\/?(?:html|body|main)\b[^>]*>/gi, "")
  .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
  .replace(/[\t ]+$/gm, "");

const stylesheet = `<style>
  :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#101010;color:#eee9e3;font:17px/1.7 Georgia,serif}
  a{color:#e7bdae}a:hover{text-decoration-thickness:2px}header,main,footer{max-width:760px;margin:auto;padding:20px}
  header{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;font:14px/1.5 Arial,sans-serif;border-bottom:1px solid #444}
  header nav{display:flex;gap:15px;flex-wrap:wrap}h1{font-size:clamp(2.2rem,6vw,4rem);line-height:1.13;margin:2rem 0 1rem}h2,h3{line-height:1.25;margin-top:2rem}
  .eyebrow,.byline,footer{font:14px/1.5 Arial,sans-serif;color:#c7bdb4}.summary{font-size:1.2rem;color:#d5c9be}
  article img,article video,article iframe{max-width:100%;height:auto}figure{max-width:100%;margin:2rem 0}figcaption{font-size:.85rem;color:#bfb2a8}
  blockquote{border-left:3px solid #ad5b50;padding-left:1rem;margin-left:0}p{overflow-wrap:anywhere}
  .more{border-top:1px solid #444;margin-top:3rem;padding-top:1.5rem}
</style>`;

for (const post of posts) {
  const canonical = url(post);
  const headline = escape(post.title);
  const description = escape(summary(post));
  const image = post.shareImage || post.featureImage || "";
  const schema = {
    "@context": "https://schema.org", "@type": "BlogPosting",
    mainEntityOfPage: canonical, headline: post.title, description: summary(post),
    datePublished: post.publishedAt || post.date, author: { "@type": "Person", name: author(post) },
    publisher: { "@type": "Organization", name: "Echoes of Gaza", url: ORIGIN },
    ...(image ? { image } : {})
  };
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${headline} | Echoes of Gaza</title><meta name="description" content="${description}">
<link rel="canonical" href="${canonical}"><link rel="icon" href="/assets/favicon.png" type="image/png">
<meta property="og:type" content="article"><meta property="og:title" content="${headline}"><meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">${image ? `<meta property="og:image" content="${escape(image)}">` : ""}
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>${stylesheet}</head>
<body><header><a href="/">Echoes of Gaza</a><nav aria-label="Main navigation"><a href="/blog">Voices</a><a href="/about">About</a><a href="/primary">Primary sources</a><a href="/toolkit">Toolkit</a></nav></header>
<main><nav class="eyebrow" aria-label="Breadcrumb"><a href="/">Echoes of Gaza</a> / <a href="/blog">Voices</a> / ${headline}</nav>
<article><h1>${headline}</h1><p class="summary">${description}</p><p class="byline">By ${escape(author(post))} · <time datetime="${escape(post.date || post.publishedAt || "")}">${escape(post.date || post.publishedAt || "")}</time></p>
${cleanContent(post.content)}</article><p class="more"><a href="/blog?post=${post.slug}" rel="nofollow">View responses and join the discussion</a> · <a href="/blog">More voices and testimonies</a></p></main>
<footer>Echoes of Gaza · <a href="/about">About the archive</a></footer></body></html>\n`;
  const directory = path.join("blog", post.slug);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "index.html"), html);
  if (post.path && /^[a-z0-9-]+\.html$/.test(post.path)) {
    const alternate = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><link rel="canonical" href="${canonical}"><meta http-equiv="refresh" content="0;url=${canonical}"><title>${headline} | Echoes of Gaza</title></head><body><p>This article moved to <a href="${canonical}">${headline}</a>.</p></body></html>\n`;
    await fs.writeFile(path.join("blog", post.path), alternate);
  }
}

const blogPath = "blog.html";
let blog = await fs.readFile(blogPath, "utf8");
const fallback = `<section class="max-w-[1100px] mx-auto px-5 py-10 md:py-12" aria-label="Voices and testimonies">
  <p class="blog-breadcrumb mb-3"><a href="/">Echoes of Gaza</a> / Voices</p>
  <h1 class="font-serif text-4xl md:text-6xl font-bold text-off-white mb-4">Voices</h1>
  <p class="text-ash-gray mb-8">Stories, testimonies, and the lived consequences of standing for Palestine.</p>
  <ul class="space-y-5">${posts.map((post) => `<li><a href="/blog/${post.slug}/" class="text-off-white font-serif text-xl hover:underline">${escape(post.title)}</a><p class="text-ash-gray text-sm">${escape(author(post))} · ${escape(post.date || "")}</p></li>`).join("")}</ul>
</section>`;
blog = blog.replace(/(<main id="app-container"[^>]*>)[\s\S]*?(<\/main>)/, `$1\n<!-- Static crawlable listing; the interactive view replaces this after loading. -->\n${fallback}\n$2`);
await fs.writeFile(blogPath, blog);
console.log(`Built ${posts.length} published article pages and the Voices fallback.`);
