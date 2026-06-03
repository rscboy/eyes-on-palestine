const SHEET_NAME = "Secondary_Submissions";
const BLOG_SHEET_NAME = "Blog_Submissions";

function getProps_() {
  return PropertiesService.getScriptProperties();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  return getSheetByName_(SHEET_NAME);
}

function getSheetByName_(sheetName) {
  const sheetId = getProps_().getProperty("SHEET_ID");
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Missing sheet tab: ${sheetName}`);
  return sheet;
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function rowToObject_(headers, row, rowNumber) {
  const obj = { rowNumber };
  headers.forEach((header, index) => {
    obj[header] = row[index];
  });

  try {
    obj.categories = obj.categories ? JSON.parse(obj.categories) : [];
  } catch (e) {
    obj.categories = String(obj.categories || "").split(",").map(v => v.trim()).filter(Boolean);
  }

  try {
    obj.authors = obj.authors ? JSON.parse(obj.authors) : [];
  } catch (e) {
    obj.authors = String(obj.authors || "").split(",").map(v => v.trim()).filter(Boolean);
  }

  try {
    obj.images = obj.images ? JSON.parse(obj.images) : [];
  } catch (e) {
    obj.images = String(obj.images || "").split(",").map(v => v.trim()).filter(Boolean);
  }

  try {
    const parsedAuthor = obj.author ? JSON.parse(obj.author) : obj.author;
    obj.author = parsedAuthor && typeof parsedAuthor === "object" && !Array.isArray(parsedAuthor)
      ? parsedAuthor
      : obj.author;
  } catch (e) {
    obj.author = obj.author;
  }

  return obj;
}

function isoDate_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, "UTC", "yyyy-MM-dd");
  }
  return String(value).trim();
}

function findRowById_(sheet, id) {
  const headers = getHeaders_(sheet);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const rowObj = rowToObject_(headers, values[i], i + 1);
    if (String(rowObj.id) === String(id)) {
      return { rowNumber: i + 1, rowObj, headers };
    }
  }

  throw new Error("Submission not found: " + id);
}

function setCell_(sheet, headers, rowNumber, headerName, value) {
  const colIndex = headers.indexOf(headerName) + 1;
  if (colIndex <= 0) throw new Error("Missing header: " + headerName);
  sheet.getRange(rowNumber, colIndex).setValue(value);
}

function requireAdmin_(payload) {
  const expected = getProps_().getProperty("ADMIN_CODE");
  if (!expected) throw new Error("ADMIN_CODE is not set in Script Properties.");
  if (!payload.adminCode || payload.adminCode !== expected) {
    throw new Error("Unauthorized admin action.");
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action || "";

    if (action === "listPending") {
      const adminCode = e.parameter.adminCode || "";
      requireAdmin_({ adminCode });

      const sheet = getSheet_();
      const headers = getHeaders_(sheet);
      const values = sheet.getDataRange().getValues();

      const pending = values
        .slice(1)
        .map((row, index) => rowToObject_(headers, row, index + 2))
        .filter(item => item.status === "pending")
        .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));

      return json_({ result: "success", items: pending });
    }

    if (action === "listPendingBlog") {
      const adminCode = e.parameter.adminCode || "";
      requireAdmin_({ adminCode });

      const sheet = getSheetByName_(BLOG_SHEET_NAME);
      const headers = getHeaders_(sheet);
      const values = sheet.getDataRange().getValues();

      const pending = values
        .slice(1)
        .map((row, index) => rowToObject_(headers, row, index + 2))
        .filter(item => item.status === "pending")
        .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));

      return json_({ result: "success", items: pending });
    }

    return json_({ result: "error", message: "Unknown GET action." });
  } catch (err) {
    return json_({ result: "error", message: err.message || String(err) });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const action = payload.action || "submitArticle";

    if (action === "submitArticle") {
      return submitArticle_(payload);
    }

    if (action === "submitBlogPost") {
      return submitBlogPost_(payload);
    }

    if (action === "approveArticle") {
      requireAdmin_(payload);
      return approveArticle_(payload);
    }

    if (action === "rejectArticle") {
      requireAdmin_(payload);
      return rejectArticle_(payload);
    }

    if (action === "approveBlogPost") {
      requireAdmin_(payload);
      return approveBlogPost_(payload);
    }

    if (action === "rejectBlogPost") {
      requireAdmin_(payload);
      return rejectBlogPost_(payload);
    }

    return json_({ result: "error", message: "Unknown POST action." });
  } catch (err) {
    return json_({ result: "error", message: err.message || String(err) });
  }
}

function submitArticle_(payload) {
  const sheet = getSheet_();
  const headers = getHeaders_(sheet);

  const id = Utilities.getUuid();
  const now = new Date().toISOString();

  const record = {
    id,
    status: "pending",
    type: payload.type || "secondary_source",
    submittedAt: payload.submittedAt || now,
    submitted_by: payload.submitted_by || "",
    date: payload.date || "",
    title: payload.title || "",
    summary: payload.summary || "",
    link: payload.link || "",
    imageUrl: payload.imageUrl || "https://placeholder.com/image.jpg",
    category: payload.category || "",
    categories: JSON.stringify(payload.categories || []),
    categoryColor: payload.categoryColor || "",
    source: payload.source || "",
    author: payload.author || "",
    authors: JSON.stringify(payload.authors || []),
    documentType: payload.documentType || "",
    approvedAt: "",
    approvedBy: "",
    rejectedAt: "",
    rejectedBy: "",
    rejectionReason: ""
  };

  const row = headers.map(header => record[header] ?? "");
  sheet.appendRow(row);

  return json_({ result: "success", id });
}

function approveArticle_(payload) {
  const sheet = getSheet_();
  const { rowNumber, rowObj, headers } = findRowById_(sheet, payload.id);

  if (rowObj.status !== "pending") {
    throw new Error("Only pending articles can be approved.");
  }

  const article = {
    date: isoDate_(rowObj.date),
    title: rowObj.title,
    summary: rowObj.summary,
    link: rowObj.link,
    imageUrl: rowObj.imageUrl || "https://placeholder.com/image.jpg",
    category: rowObj.category,
    categories: rowObj.categories || [],
    categoryColor: rowObj.categoryColor,
    source: rowObj.source,
    author: rowObj.author || "Unknown author",
    authors: rowObj.authors && rowObj.authors.length ? rowObj.authors : ["Unknown author"],
    documentType: rowObj.documentType || "Article"
  };

  validateArticle_(article);
  updateGithubArticlesJson_(article);

  const now = new Date().toISOString();
  setCell_(sheet, headers, rowNumber, "status", "approved");
  setCell_(sheet, headers, rowNumber, "approvedAt", now);
  setCell_(sheet, headers, rowNumber, "approvedBy", payload.adminEmail || "");

  return json_({ result: "success", article });
}

function rejectArticle_(payload) {
  const sheet = getSheet_();
  const { rowNumber, rowObj, headers } = findRowById_(sheet, payload.id);

  if (rowObj.status !== "pending") {
    throw new Error("Only pending articles can be rejected.");
  }

  const now = new Date().toISOString();
  setCell_(sheet, headers, rowNumber, "status", "rejected");
  setCell_(sheet, headers, rowNumber, "rejectedAt", now);
  setCell_(sheet, headers, rowNumber, "rejectedBy", payload.adminEmail || "");
  setCell_(sheet, headers, rowNumber, "rejectionReason", payload.reason || "");

  return json_({ result: "success" });
}

function submitBlogPost_(payload) {
  const sheet = getSheetByName_(BLOG_SHEET_NAME);
  const headers = getHeaders_(sheet);
  const id = Utilities.getUuid();
  const now = new Date().toISOString();

  const title = String(payload.title || "").trim();
  const subtitle = String(payload.subtitle || "").trim();
  const body = String(payload.body || "").trim();
  const contactEmail = String(payload.contactEmail || "").trim();

  if (!title || !subtitle || !body) {
    throw new Error("Blog submission requires title, subtitle, and body.");
  }

  if (!contactEmail) {
    throw new Error("Blog submission requires a contact email for editorial follow-up.");
  }

  const anonymous = payload.anonymous === true || payload.anonymous === "true";
  const author = payload.author && typeof payload.author === "object" ? payload.author : {};
  const safeAuthor = anonymous ? {
    name: "Anonymous contributor",
    anonymous: true
  } : {
    name: String(author.name || "").trim() || "Anonymous contributor",
    email: String(author.email || "").trim(),
    role: String(author.role || "").trim(),
    photoUrl: String(author.photoUrl || "").trim(),
    location: String(author.location || "").trim(),
    links: Array.isArray(author.links) ? author.links.map(String).filter(Boolean) : [],
    bio: String(author.bio || "").trim(),
    anonymous: false
  };

  const record = {
    id,
    status: "pending",
    submittedAt: payload.submittedAt || now,
    title,
    subtitle,
    category: String(payload.category || "Personal essay").trim(),
    body,
    images: JSON.stringify(Array.isArray(payload.images) ? payload.images.map(String).filter(Boolean) : []),
    author: JSON.stringify(safeAuthor),
    authorName: safeAuthor.name,
    contactEmail,
    anonymous: anonymous ? "true" : "false",
    editorNotes: String(payload.editorNotes || "").trim(),
    slug: slugify_(title),
    approvedAt: "",
    approvedBy: "",
    rejectedAt: "",
    rejectedBy: "",
    rejectionReason: ""
  };

  const row = headers.map(header => record[header] ?? "");
  sheet.appendRow(row);

  return json_({ result: "success", id });
}

function approveBlogPost_(payload) {
  const sheet = getSheetByName_(BLOG_SHEET_NAME);
  const { rowNumber, rowObj, headers } = findRowById_(sheet, payload.id);

  if (rowObj.status !== "pending") {
    throw new Error("Only pending blog submissions can be approved.");
  }

  const now = new Date().toISOString();
  const post = {
    id: rowObj.id,
    slug: uniqueBlogSlug_(rowObj.slug || rowObj.title),
    title: rowObj.title,
    subtitle: rowObj.subtitle,
    shareDescription: rowObj.subtitle,
    category: rowObj.category || "Personal essay",
    author: rowObj.author && Object.keys(rowObj.author).length ? rowObj.author : {
      name: rowObj.authorName || "Anonymous contributor",
      anonymous: rowObj.anonymous === "true"
    },
    images: rowObj.images || [],
    featureImage: rowObj.images && rowObj.images.length ? rowObj.images[0] : "",
    shareImage: rowObj.images && rowObj.images.length ? rowObj.images[0] : "",
    date: Utilities.formatDate(new Date(), "UTC", "yyyy-MM-dd"),
    publishedAt: now,
    readTime: estimateReadTime_(rowObj.body),
    citations: 0,
    comments: 0,
    content: blogBodyToHtml_(rowObj.body)
  };

  validateBlogPost_(post);
  updateGithubBlogPostsJson_(post);

  setCell_(sheet, headers, rowNumber, "status", "approved");
  setCell_(sheet, headers, rowNumber, "approvedAt", now);
  setCell_(sheet, headers, rowNumber, "approvedBy", payload.adminEmail || "");
  setCell_(sheet, headers, rowNumber, "slug", post.slug);

  return json_({ result: "success", post });
}

function rejectBlogPost_(payload) {
  const sheet = getSheetByName_(BLOG_SHEET_NAME);
  const { rowNumber, rowObj, headers } = findRowById_(sheet, payload.id);

  if (rowObj.status !== "pending") {
    throw new Error("Only pending blog submissions can be rejected.");
  }

  const now = new Date().toISOString();
  setCell_(sheet, headers, rowNumber, "status", "rejected");
  setCell_(sheet, headers, rowNumber, "rejectedAt", now);
  setCell_(sheet, headers, rowNumber, "rejectedBy", payload.adminEmail || "");
  setCell_(sheet, headers, rowNumber, "rejectionReason", payload.reason || "");

  return json_({ result: "success" });
}

function validateArticle_(article) {
  const required = ["date", "title", "summary", "link", "imageUrl", "category", "categoryColor", "source"];
  const missing = required.filter(key => !article[key]);

  if (missing.length) {
    throw new Error("Missing required article fields: " + missing.join(", "));
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(article.date)) {
    throw new Error("Date must use YYYY-MM-DD format.");
  }

  if (!/^https?:\/\//i.test(article.link)) {
    throw new Error("Article link must be a valid URL.");
  }

  if (!/^https?:\/\//i.test(article.imageUrl)) {
    throw new Error("imageUrl must be a valid URL.");
  }
}

function updateGithubArticlesJson_(newArticle) {
  const props = getProps_();

  const token = props.getProperty("GITHUB_TOKEN");
  const owner = props.getProperty("GITHUB_OWNER");
  const repo = props.getProperty("GITHUB_REPO");
  const branch = props.getProperty("GITHUB_BRANCH") || "main";
  const path = props.getProperty("ARTICLES_PATH") || "data/articles.json";

  if (!token || !owner || !repo) {
    throw new Error("Missing GitHub Script Properties.");
  }

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

  const getResponse = UrlFetchApp.fetch(apiUrl, {
    method: "get",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    },
    muteHttpExceptions: true
  });

  const getCode = getResponse.getResponseCode();
  if (getCode < 200 || getCode >= 300) {
    throw new Error("GitHub GET failed: " + getResponse.getContentText());
  }

  const fileData = JSON.parse(getResponse.getContentText());
  const currentContent = Utilities.newBlob(
    Utilities.base64Decode(fileData.content)
  ).getDataAsString();

  let articles = JSON.parse(currentContent);
  if (!Array.isArray(articles)) {
    throw new Error("articles.json must be a JSON array.");
  }

  const alreadyExists = articles.some(article => article.link === newArticle.link);
  if (alreadyExists) {
    throw new Error("This article link already exists in articles.json.");
  }

  articles.unshift(newArticle);

  const updatedContent = JSON.stringify(articles, null, 2);
  const encodedContent = Utilities.base64Encode(updatedContent);

  const putPayload = {
    message: `Approve article: ${newArticle.title}`,
    content: encodedContent,
    sha: fileData.sha,
    branch
  };

  const putResponse = UrlFetchApp.fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: "put",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    },
    contentType: "application/json",
    payload: JSON.stringify(putPayload),
    muteHttpExceptions: true
  });

  const putCode = putResponse.getResponseCode();
  if (putCode < 200 || putCode >= 300) {
    throw new Error("GitHub PUT failed: " + putResponse.getContentText());
  }

  return JSON.parse(putResponse.getContentText());
}

function getGithubFile_(path) {
  const props = getProps_();
  const token = props.getProperty("GITHUB_TOKEN");
  const owner = props.getProperty("GITHUB_OWNER");
  const repo = props.getProperty("GITHUB_REPO");
  const branch = props.getProperty("GITHUB_BRANCH") || "main";

  if (!token || !owner || !repo) {
    throw new Error("Missing GitHub Script Properties.");
  }

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  const response = UrlFetchApp.fetch(apiUrl, {
    method: "get",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error("GitHub GET failed: " + response.getContentText());
  }

  const fileData = JSON.parse(response.getContentText());
  const currentContent = Utilities.newBlob(
    Utilities.base64Decode(fileData.content)
  ).getDataAsString();

  return { fileData, currentContent, token, owner, repo, branch };
}

function putGithubFile_(path, fileData, updatedContent, message) {
  const props = getProps_();
  const token = props.getProperty("GITHUB_TOKEN");
  const owner = props.getProperty("GITHUB_OWNER");
  const repo = props.getProperty("GITHUB_REPO");
  const branch = props.getProperty("GITHUB_BRANCH") || "main";

  const putPayload = {
    message,
    content: Utilities.base64Encode(updatedContent),
    sha: fileData.sha,
    branch
  };

  const response = UrlFetchApp.fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: "put",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    },
    contentType: "application/json",
    payload: JSON.stringify(putPayload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error("GitHub PUT failed: " + response.getContentText());
  }

  return JSON.parse(response.getContentText());
}

function updateGithubBlogPostsJson_(newPost) {
  const path = getProps_().getProperty("BLOG_POSTS_PATH") || "data/blog_posts.json";
  const { fileData, currentContent } = getGithubFile_(path);
  let posts = JSON.parse(currentContent || "[]");
  if (!Array.isArray(posts)) {
    posts = posts.posts || [];
  }
  if (!Array.isArray(posts)) {
    throw new Error("blog_posts.json must be a JSON array or an object with a posts array.");
  }

  const duplicate = posts.some(post => post.id === newPost.id || post.slug === newPost.slug);
  if (duplicate) {
    throw new Error("This blog post already exists in blog_posts.json.");
  }

  posts.unshift(newPost);
  putGithubFile_(path, fileData, JSON.stringify(posts, null, 2), `Approve blog post: ${newPost.title}`);
}

function uniqueBlogSlug_(value) {
  const base = slugify_(value || "blog-post") || "blog-post";
  const path = getProps_().getProperty("BLOG_POSTS_PATH") || "data/blog_posts.json";
  try {
    const { currentContent } = getGithubFile_(path);
    let posts = JSON.parse(currentContent || "[]");
    posts = Array.isArray(posts) ? posts : (posts.posts || []);
    const used = new Set(posts.map(post => String(post.slug || "")));
    if (!used.has(base)) return base;
    let index = 2;
    while (used.has(`${base}-${index}`)) index++;
    return `${base}-${index}`;
  } catch (error) {
    return base;
  }
}

function slugify_(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function blogBodyToHtml_(body) {
  return String(body || "")
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map(paragraph => `<p>${escapeHtml_(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function estimateReadTime_(content) {
  const words = String(content || "").trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 220))} min read`;
}

function validateBlogPost_(post) {
  const required = ["id", "slug", "title", "subtitle", "author", "date", "publishedAt", "content"];
  const missing = required.filter(key => !post[key]);
  if (missing.length) {
    throw new Error("Missing required blog post fields: " + missing.join(", "));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date)) {
    throw new Error("Blog post date must use YYYY-MM-DD format.");
  }
  const imageUrls = [post.featureImage, post.shareImage].concat(post.images || []).filter(Boolean);
  const invalidImages = imageUrls.filter(url => !/^https?:\/\//i.test(url));
  if (invalidImages.length) {
    throw new Error("Blog image URLs must begin with http:// or https://.");
  }
}
