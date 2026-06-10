#!/usr/bin/env node
// Validates the JSON data files that the site and the automation workflows
// depend on. Run by .github/workflows/validate-data.yml on every push/PR that
// touches data/. Keep checks minimal and structural so legitimate automation
// commits never fail: invalid JSON or wrong shapes only.

import { readFileSync, existsSync } from "node:fs";

let failures = 0;

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function loadJson(path) {
  if (!existsSync(path)) {
    console.log(`skip: ${path} (not present)`);
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${path} is not valid JSON: ${error.message}`);
    return undefined;
  }
}

const articles = loadJson("data/articles.json");
if (articles !== undefined) {
  if (!Array.isArray(articles)) {
    fail("data/articles.json must be a JSON array.");
  } else {
    articles.forEach((article, index) => {
      if (!article || typeof article !== "object" || Array.isArray(article)) {
        fail(`data/articles.json[${index}] must be an object.`);
        return;
      }
      if (typeof article.title !== "string" || !article.title.trim()) {
        fail(`data/articles.json[${index}] is missing a non-empty string "title".`);
      }
      if (typeof article.link !== "string" || !/^https?:\/\//.test(article.link)) {
        fail(`data/articles.json[${index}] ("${String(article.title).slice(0, 60)}") needs an http(s) "link".`);
      }
    });
    console.log(`ok: data/articles.json (${articles.length} articles)`);
  }
}

const blogPosts = loadJson("data/blog_posts.json");
if (blogPosts !== undefined) {
  const posts = Array.isArray(blogPosts) ? blogPosts : blogPosts?.posts;
  if (!Array.isArray(posts)) {
    fail("data/blog_posts.json must be a JSON array or an object with a posts array.");
  } else {
    posts.forEach((post, index) => {
      if (!post || typeof post !== "object" || Array.isArray(post)) {
        fail(`data/blog_posts.json[${index}] must be an object.`);
      }
    });
    console.log(`ok: data/blog_posts.json (${posts.length} posts)`);
  }
}

const authors = loadJson("data/authors.json");
if (authors !== undefined) {
  if (typeof authors !== "object" || authors === null) {
    fail("data/authors.json must be a JSON array or object.");
  } else {
    console.log("ok: data/authors.json");
  }
}

const latest = loadJson("data/integrity/latest.json");
if (latest !== undefined) {
  if (!latest || typeof latest !== "object" || !Array.isArray(latest.results)) {
    fail("data/integrity/latest.json must be an object with a results array.");
  } else {
    console.log(`ok: data/integrity/latest.json (${latest.results.length} results)`);
  }
}

const overrides = loadJson("data/integrity/manual_overrides.json");
if (overrides !== undefined) {
  if (!overrides || typeof overrides !== "object" || typeof overrides.overrides !== "object") {
    fail("data/integrity/manual_overrides.json must be an object with an overrides object.");
  } else {
    console.log(`ok: data/integrity/manual_overrides.json (${Object.keys(overrides.overrides).length} overrides)`);
  }
}

const wayback = loadJson("data/wayback/archive_status.json");
if (wayback !== undefined) {
  if (!wayback || typeof wayback !== "object") {
    fail("data/wayback/archive_status.json must be a JSON object.");
  } else {
    console.log("ok: data/wayback/archive_status.json");
  }
}

if (existsSync("data/integrity/history.jsonl")) {
  const lines = readFileSync("data/integrity/history.jsonl", "utf8").split("\n").filter(Boolean);
  lines.forEach((line, index) => {
    try {
      JSON.parse(line);
    } catch (error) {
      fail(`data/integrity/history.jsonl line ${index + 1} is not valid JSON: ${error.message}`);
    }
  });
  console.log(`ok: data/integrity/history.jsonl (${lines.length} entries)`);
}

if (failures) {
  console.error(`\n${failures} validation failure(s).`);
  process.exit(1);
}
console.log("\nAll data files are valid.");
