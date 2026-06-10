const SHEET_NAME = "Secondary_Submissions";
const BLOG_SHEET_NAME = "Blog_Submissions";
const BLOG_COMMENTS_SHEET_NAME = "Blog_Comments";
const BLOG_VIEWS_SHEET_NAME = "Blog_Views";
const BLOG_COMMENT_HEADERS = ["id", "status", "postId", "postSlug", "authorName", "authorEmail", "comment", "submittedAt", "deletedAt", "deletedBy"];
const BLOG_VIEW_HEADERS = ["id", "postId", "postSlug", "visitorKey", "viewedAt", "userAgent"];

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

function getOrCreateSheetWithHeaders_(sheetName, headers) {
  const sheetId = getProps_().getProperty("SHEET_ID");
  const ss = SpreadsheetApp.openById(sheetId);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  const missing = headers.filter(header => !existing.includes(header));
  if (missing.length) {
    sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  }

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

function isoDateTime_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  const parsed = new Date(String(value).trim());
  return isNaN(parsed.getTime()) ? "" : parsed.toISOString();
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

function setCellIfHeader_(sheet, headers, rowNumber, headerName, value) {
  const colIndex = headers.indexOf(headerName) + 1;
  if (colIndex <= 0) return false;
  sheet.getRange(rowNumber, colIndex).setValue(value);
  return true;
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

    if (action === "getBlogEngagement") {
      return json_(getBlogEngagementData_(e.parameter));
    }

    if (action === "listPublishedBlogPosts") {
      const adminCode = e.parameter.adminCode || "";
      requireAdmin_({ adminCode });
      return json_(listPublishedBlogPostsData_());
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

    if (action === "recordBlogView") {
      return json_(recordBlogViewData_(payload));
    }

    if (action === "submitBlogComment") {
      return json_(submitBlogCommentData_(payload));
    }

    if (action === "approveArticle") {
      requireAdmin_(payload);
      return approveArticle_(payload);
    }

    if (action === "approveAllPendingArticles") {
      requireAdmin_(payload);
      return approveAllPendingArticles_(payload);
    }

    if (action === "rejectArticle") {
      requireAdmin_(payload);
      return rejectArticle_(payload);
    }

    if (action === "repairApprovedArticles") {
      requireAdmin_(payload);
      return json_(repairApprovedArticlesData_());
    }

    if (action === "repairArticleTextEncoding") {
      requireAdmin_(payload);
      return json_(repairArticleTextEncodingData_());
    }

    if (action === "repairBlogPostTextEncoding") {
      requireAdmin_(payload);
      return json_(repairBlogPostTextEncodingData_());
    }

    if (action === "approveBlogPost") {
      requireAdmin_(payload);
      return approveBlogPost_(payload);
    }

    if (action === "rejectBlogPost") {
      requireAdmin_(payload);
      return rejectBlogPost_(payload);
    }

    if (action === "updatePendingBlogPost") {
      requireAdmin_(payload);
      return json_(updatePendingBlogPostData_(payload));
    }

    if (action === "updateBlogPost") {
      requireAdmin_(payload);
      return json_(updateBlogPostData_(payload));
    }

    if (action === "deleteBlogPost") {
      requireAdmin_(payload);
      return json_(deleteBlogPostData_(payload));
    }

    if (action === "deleteBlogComment") {
      requireAdmin_(payload);
      return json_(deleteBlogCommentData_(payload));
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
  const categories = cleanDisplayList_(payload.categories || []);
  const authors = cleanDisplayList_(payload.authors || []);

  const record = {
    id,
    status: "pending",
    type: cleanDisplayText_(payload.type || "secondary_source"),
    submittedAt: payload.submittedAt || now,
    submitted_by: cleanDisplayText_(payload.submitted_by || ""),
    date: payload.date || "",
    title: cleanDisplayText_(payload.title || ""),
    summary: cleanDisplayText_(payload.summary || ""),
    link: payload.link || "",
    imageUrl: payload.imageUrl || "https://placeholder.com/image.jpg",
    category: cleanDisplayText_(payload.category || ""),
    categories: JSON.stringify(categories),
    categoryColor: payload.categoryColor || "",
    source: cleanDisplayText_(payload.source || ""),
    author: cleanDisplayText_(payload.author || ""),
    authors: JSON.stringify(authors),
    documentType: cleanDisplayText_(payload.documentType || ""),
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
  return withGithubWriteLock_(function() {
    const sheet = getSheet_();
    const { rowNumber, rowObj, headers } = findRowById_(sheet, payload.id);

    if (rowObj.status !== "pending") {
      throw new Error("Only pending articles can be approved.");
    }

    const article = rowToArticle_(rowObj);

    validateArticle_(article);
    updateGithubArticlesJson_(article);

    const now = new Date().toISOString();
    setCell_(sheet, headers, rowNumber, "status", "approved");
    setCell_(sheet, headers, rowNumber, "approvedAt", now);
    setCell_(sheet, headers, rowNumber, "approvedBy", payload.adminEmail || "");

    return json_({ result: "success", article });
  });
}

function approveAllPendingArticles_(payload) {
  return withGithubWriteLock_(function() {
    const sheet = getSheet_();
    const headers = getHeaders_(sheet);
    const values = sheet.getDataRange().getValues();
    const pendingRows = values
      .slice(1)
      .map((row, index) => rowToObject_(headers, row, index + 2))
      .filter(rowObj => rowObj.status === "pending");

    const validRows = [];
    const skipped = [];
    const seenLinks = new Set();

    pendingRows.forEach(rowObj => {
      const article = rowToArticle_(rowObj);
      try {
        validateArticle_(article);
      } catch (err) {
        skipped.push({
          rowNumber: rowObj.rowNumber,
          id: rowObj.id || "",
          title: rowObj.title || "",
          reason: err.message || String(err)
        });
        return;
      }

      const link = String(article.link || "");
      if (seenLinks.has(link)) {
        skipped.push({
          rowNumber: rowObj.rowNumber,
          id: rowObj.id || "",
          title: rowObj.title || "",
          reason: "Duplicate link in pending queue."
        });
        return;
      }

      seenLinks.add(link);
      validRows.push({ rowObj, article });
    });

    if (!validRows.length) {
      return json_({
        result: "success",
        approved: 0,
        addedToGithub: 0,
        skipped,
        message: skipped.length
          ? "No valid pending articles were approved."
          : "There are no pending articles to approve."
      });
    }

    const githubResult = updateGithubArticlesJsonBatch_(validRows.map(item => item.article));
    const now = new Date().toISOString();
    validRows.forEach(item => {
      setCell_(sheet, headers, item.rowObj.rowNumber, "status", "approved");
      setCell_(sheet, headers, item.rowObj.rowNumber, "approvedAt", now);
      setCell_(sheet, headers, item.rowObj.rowNumber, "approvedBy", payload.adminEmail || "");
    });

    return json_({
      result: "success",
      approved: validRows.length,
      addedToGithub: githubResult.addedToGithub,
      alreadyExisted: githubResult.alreadyExisted,
      skipped,
      titles: validRows.map(item => item.article.title)
    });
  });
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

function repairApprovedArticlesFromSheet() {
  const result = repairApprovedArticlesData_();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function repairApprovedArticlesData_() {
  return withGithubWriteLock_(function() {
    const sheet = getSheet_();
    const headers = getHeaders_(sheet);
    const values = sheet.getDataRange().getValues();
    const approvedRows = values
      .slice(1)
      .map((row, index) => rowToObject_(headers, row, index + 2))
      .filter(rowObj => rowObj.status === "approved");

    const articlesPath = getProps_().getProperty("ARTICLES_PATH") || "data/articles.json";
    const { fileData, currentContent } = getGithubFile_(articlesPath);

    if (!String(currentContent || "").trim()) {
      throw new Error(`${articlesPath} on GitHub is empty, so approved articles cannot be repaired.`);
    }

    let articles;
    try {
      articles = JSON.parse(currentContent);
    } catch (err) {
      throw new Error(`${articlesPath} on GitHub is not valid JSON: ${err.message}`);
    }

    if (!Array.isArray(articles)) {
      throw new Error("articles.json must be a JSON array.");
    }

    const existingLinks = new Set(articles.map(article => String(article.link || "")));
    const skipped = [];
    const missingArticles = [];

    approvedRows.forEach(rowObj => {
      const article = rowToArticle_(rowObj);
      try {
        validateArticle_(article);
      } catch (err) {
        skipped.push({
          rowNumber: rowObj.rowNumber,
          title: rowObj.title || "",
          reason: err.message || String(err)
        });
        return;
      }

      const link = String(article.link || "");
      if (!existingLinks.has(link)) {
        existingLinks.add(link);
        missingArticles.push(article);
      }
    });

    if (missingArticles.length) {
      missingArticles
        .slice()
        .reverse()
        .forEach(article => articles.unshift(article));

      putGithubFile_(
        articlesPath,
        fileData,
        JSON.stringify(articles, null, 2),
        `Repair approved articles: add ${missingArticles.length} missing`
      );
    }

    return {
      result: "success",
      checked: approvedRows.length,
      repaired: missingArticles.length,
      skipped,
      addedTitles: missingArticles.map(article => article.title)
    };
  });
}

function repairArticleTextEncodingOnGithub() {
  const result = repairArticleTextEncodingData_();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function repairArticleTextEncodingData_() {
  return withGithubWriteLock_(function() {
    const articlesPath = getProps_().getProperty("ARTICLES_PATH") || "data/articles.json";
    const { fileData, currentContent } = getGithubFile_(articlesPath);

    if (!String(currentContent || "").trim()) {
      throw new Error(`${articlesPath} on GitHub is empty, so article text cannot be repaired.`);
    }

    let articles;
    try {
      articles = JSON.parse(currentContent);
    } catch (err) {
      throw new Error(`${articlesPath} on GitHub is not valid JSON: ${err.message}`);
    }

    if (!Array.isArray(articles)) {
      throw new Error("articles.json must be a JSON array.");
    }

    const changedTitles = [];
    const cleanedArticles = articles.map(article => {
      const cleaned = cleanArticleDisplayText_(article);
      if (JSON.stringify(cleaned) !== JSON.stringify(article)) {
        changedTitles.push(cleaned.title || article.title || article.link || "Untitled article");
      }
      return cleaned;
    });

    if (changedTitles.length) {
      putGithubFile_(
        articlesPath,
        fileData,
        JSON.stringify(cleanedArticles, null, 2),
        `Repair article text encoding: ${changedTitles.length} updated`
      );
    }

    return {
      result: "success",
      checked: articles.length,
      repaired: changedTitles.length,
      repairedTitles: changedTitles
    };
  });
}

function repairBlogPostTextEncodingOnGithub() {
  const result = repairBlogPostTextEncodingData_();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function repairBlogPostTextEncodingData_() {
  return withGithubWriteLock_(function() {
    const blogPath = getProps_().getProperty("BLOG_POSTS_PATH") || "data/blog_posts.json";
    let changedTitles = [];
    let cleanedPosts = [];

    updateGithubFileWithRetry_(
      blogPath,
      "Repair blog post text encoding and thumbnails",
      function(currentContent) {
        let posts = JSON.parse(currentContent || "[]");
        if (!Array.isArray(posts)) {
          posts = posts.posts || [];
        }
        if (!Array.isArray(posts)) {
          throw new Error("blog_posts.json must be a JSON array or an object with a posts array.");
        }

        changedTitles = [];
        cleanedPosts = posts.map(post => {
          const cleaned = ensureBlogPostThumbnail_(cleanBlogPostDisplayText_(post));
          if (JSON.stringify(cleaned) !== JSON.stringify(post)) {
            changedTitles.push(cleaned.title || post.title || post.slug || post.id || "Untitled blog post");
          }
          return cleaned;
        });

        return JSON.stringify(cleanedPosts, null, 2);
      }
    );

    const rebuiltTitles = [];
    cleanedPosts
      .filter(isSitemapIndexableBlogPost_)
      .forEach(post => {
        updateGithubBlogPostPage_(post);
        rebuiltTitles.push(post.title || post.slug || post.id || "Untitled blog post");
      });
    if (cleanedPosts.length) {
      updateGithubSitemapForBlogPosts_(cleanedPosts);
    }

    return {
      result: "success",
      repaired: changedTitles.length,
      repairedTitles: changedTitles,
      rebuiltPages: rebuiltTitles.length,
      rebuiltPageTitles: rebuiltTitles
    };
  });
}

function cleanArticleDisplayText_(article) {
  const cleaned = Object.assign({}, article);
  ["title", "summary", "category", "source", "author", "documentType"].forEach(key => {
    cleaned[key] = cleanDisplayText_(cleaned[key]);
  });
  cleaned.categories = cleanDisplayList_(cleaned.categories || []);
  cleaned.authors = cleanDisplayList_(cleaned.authors && cleaned.authors.length ? cleaned.authors : ["Unknown author"]);
  return cleaned;
}

function rowToArticle_(rowObj) {
  return cleanArticleDisplayText_({
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
  });
}

function cleanDisplayList_(values) {
  return (Array.isArray(values) ? values : [])
    .map(value => cleanDisplayText_(value))
    .filter(Boolean);
}

function cleanDisplayText_(value) {
  return cleanBlogTextSegment_(value).trim();
}

function cleanBlogTextSegment_(value) {
  return repairBrokenPunctuation_(value)
    .replace(/Hebrew Name:\s*\?{3,}\s+\?{2}\s+\?{3,}\s+\?{3,}/g, "Hebrew Name: נחמה בת אברהם ושרה")
    .replace(/Alexandria Gary King\s*\/\s*\?{3,}\s+\?{2}\s+\?{3,}\s+\?{3,}/g, "Alexandria Gary King / נחמה בת אברהם ושרה")
    .replace(/sides of the\s+\?{3,}\s+\(mechitza/g, "sides of the מחיצה (mechitza")
    .replace(/(\S)\s+\?\s+(\S)/g, "$1 - $2")
    .replace(/(^|[\s(])\?([^?\n<>]{1,80})\?([\s.,;:!)]|$)/g, '$1"$2"$3')
    .replace(/Â/g, "")
    .replace(/\bM\?decins Sans Fronti\?res\b/g, "Medecins Sans Frontieres")
    .replace(/\bM\?decins\b/g, "Medecins")
    .replace(/\bFronti\?res\b/g, "Frontieres")
    .replace(/\b([A-Za-z]+n)\?t\b/g, "$1't")
    .replace(/([A-Za-z])\?s\b/g, "$1's")
    .replace(/\b([A-Za-z]+)\?(re|ve|ll|d|m)\b/g, "$1'$2")
    .replace(/([A-Za-z0-9])\?([A-Za-z0-9])/g, "$1-$2")
}

function repairBrokenPunctuation_(value) {
  return String(value || "")
    .replace(/&apos;|&#39;|&#x27;|&#8217;|&#x2019;/gi, "'")
    .replace(/&quot;|&#34;|&#8220;|&#8221;|&#x201c;|&#x201d;/gi, '"')
    .replace(/[\u2018\u2019\u201A\u201B]|â€™|â€˜/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]|â€œ|â€�/g, '"')
    .replace(/[\u2013\u2014]|â€“|â€”/g, "-")
    .replace(/\u00A0/g, " ");
}

function cleanBlogContentText_(value) {
  const cleaned = String(value || "")
    .split(/(<[^>]+>)/g)
    .map(part => /^<[^>]+>$/.test(part) ? part : cleanBlogTextSegment_(part))
    .join("");
  return normalizeImageSourcesInHtml_(cleaned);
}

function cleanBlogPostDisplayText_(post) {
  const cleaned = Object.assign({}, post);
  ["title", "subtitle", "shareDescription", "category", "displayAuthor", "displayDate", "displayDateShort", "readTime"].forEach(key => {
    if (cleaned[key] !== undefined) cleaned[key] = cleanDisplayText_(cleaned[key]);
  });

  if (cleaned.author && typeof cleaned.author === "object" && !Array.isArray(cleaned.author)) {
    cleaned.author = Object.assign({}, cleaned.author, {
      name: cleanDisplayText_(cleaned.author.name || ""),
      email: String(cleaned.author.email || "").trim(),
      role: cleanDisplayText_(cleaned.author.role || ""),
      photoUrl: String(cleaned.author.photoUrl || "").trim(),
      location: cleanDisplayText_(cleaned.author.location || ""),
      links: cleanUrlList_(cleaned.author.links || []),
      bio: cleanDisplayText_(cleaned.author.bio || ""),
      anonymous: Boolean(cleaned.author.anonymous)
    });
  } else if (cleaned.author) {
    cleaned.author = cleanDisplayText_(cleaned.author);
  }

  if (typeof cleaned.content === "string") {
    cleaned.content = cleanBlogContentText_(cleaned.content);
  }

  return cleaned;
}

function submitBlogPost_(payload) {
  const sheet = getSheetByName_(BLOG_SHEET_NAME);
  const headers = getHeaders_(sheet);
  const id = Utilities.getUuid();
  const now = new Date().toISOString();

  const title = cleanDisplayText_(payload.title || "");
  const subtitle = cleanDisplayText_(payload.subtitle || "");
  const body = cleanBlogContentText_(payload.body || "").trim();
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
    name: cleanDisplayText_(author.name || "") || "Anonymous contributor",
    email: String(author.email || "").trim(),
    role: cleanDisplayText_(author.role || ""),
    photoUrl: String(author.photoUrl || "").trim(),
    location: cleanDisplayText_(author.location || ""),
    links: Array.isArray(author.links) ? author.links.map(String).filter(Boolean) : [],
    bio: cleanDisplayText_(author.bio || ""),
    anonymous: false
  };

  const record = {
    id,
    status: "pending",
    submittedAt: payload.submittedAt || now,
    title,
    subtitle,
    category: cleanDisplayText_(payload.category || "Personal essay"),
    body,
    images: JSON.stringify(Array.isArray(payload.images) ? payload.images.map(String).filter(Boolean) : []),
    author: JSON.stringify(safeAuthor),
    authorName: safeAuthor.name,
    contactEmail,
    anonymous: anonymous ? "true" : "false",
    editorNotes: cleanBlogContentText_(payload.editorNotes || "").trim(),
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
  return withGithubWriteLock_(function() {
    const sheet = getSheetByName_(BLOG_SHEET_NAME);
    const { rowNumber, rowObj, headers } = findRowById_(sheet, payload.id);

    if (rowObj.status !== "pending") {
      throw new Error("Only pending blog submissions can be approved.");
    }

    const now = new Date().toISOString();
    const scheduledAt = isoDateTime_(payload.scheduledAt || "");
    const isScheduled = scheduledAt && Date.parse(scheduledAt) > Date.now();
    const publishAt = scheduledAt || now;
    const publishDate = Utilities.formatDate(new Date(publishAt), "UTC", "yyyy-MM-dd");
    const incoming = payload.post && typeof payload.post === "object" ? payload.post : {};
    const incomingAuthor = incoming.author && typeof incoming.author === "object" ? incoming.author : {};
    const rowAuthor = rowObj.author && Object.keys(rowObj.author).length ? rowObj.author : {
      name: rowObj.authorName || "Anonymous contributor",
      anonymous: rowObj.anonymous === "true"
    };
    const title = cleanDisplayText_(incoming.title || rowObj.title || "");
    const subtitle = cleanDisplayText_(incoming.subtitle || rowObj.subtitle || "");
    const category = cleanDisplayText_(incoming.category || rowObj.category || "Personal essay");
    const body = cleanBlogContentText_(incoming.body || rowObj.body || "").trim();
    const incomingImages = incoming.images && incoming.images.length ? incoming.images : rowObj.images;
    const images = cleanUrlList_(incomingImages || []);
    const author = {
      name: cleanDisplayText_(incomingAuthor.name || rowAuthor.name || rowObj.authorName || "Anonymous contributor"),
      role: cleanDisplayText_(incomingAuthor.role || rowAuthor.role || ""),
      photoUrl: String(incomingAuthor.photoUrl || rowAuthor.photoUrl || "").trim(),
      location: cleanDisplayText_(incomingAuthor.location || rowAuthor.location || ""),
      links: cleanUrlList_(incomingAuthor.links || rowAuthor.links || []),
      bio: cleanDisplayText_(incomingAuthor.bio || rowAuthor.bio || ""),
      anonymous: incomingAuthor.anonymous === true || rowAuthor.anonymous === true || rowObj.anonymous === "true"
    };
    const bodyHasInlineHtml = /<\/?[a-z][\s\S]*>/i.test(body);
    const content = incoming.content ? cleanBlogContentText_(incoming.content) : (bodyHasInlineHtml ? body : blogBodyToHtml_(body));
    const slug = uniqueBlogSlug_(incoming.slug || rowObj.slug || title, rowObj.id);
    let post = {
      id: rowObj.id,
      slug,
      path: `${slug}.html`,
      status: isScheduled ? "scheduled" : "published",
      title,
      subtitle,
      shareDescription: cleanDisplayText_(incoming.shareDescription || subtitle),
      category,
      author,
      images,
      featureImage: images.length ? images[0] : "",
      shareImage: images.length ? images[0] : "",
      date: publishDate,
      publishedAt: publishAt,
      scheduledAt: isScheduled ? scheduledAt : "",
      readTime: estimateReadTime_(body || content.replace(/<[^>]*>/g, " ")),
      citations: 0,
      comments: 0,
      content
    };
    post = ensureBlogPostThumbnail_(post);

    validateBlogPost_(post);
    updateGithubBlogPostsJson_(post);
    updateGithubBlogPostPage_(post);
    updateGithubSitemapForBlogPosts_();

    setCell_(sheet, headers, rowNumber, "status", "approved");
    setCell_(sheet, headers, rowNumber, "approvedAt", now);
    setCell_(sheet, headers, rowNumber, "approvedBy", payload.adminEmail || "");
    setCell_(sheet, headers, rowNumber, "slug", post.slug);

    return json_({ result: "success", post });
  });
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

function updatePendingBlogPostData_(payload) {
  const sheet = getSheetByName_(BLOG_SHEET_NAME);
  const { rowNumber, rowObj, headers } = findRowById_(sheet, payload.id);

  if (rowObj.status !== "pending") {
    throw new Error("Only pending blog submissions can be edited.");
  }

  const incoming = payload.post && typeof payload.post === "object" ? payload.post : {};
  const incomingAuthor = incoming.author && typeof incoming.author === "object" ? incoming.author : {};
  const rowAuthor = rowObj.author && Object.keys(rowObj.author).length ? rowObj.author : {
    name: rowObj.authorName || "Anonymous contributor",
    anonymous: rowObj.anonymous === "true"
  };

  const title = cleanDisplayText_(incoming.title || rowObj.title || "");
  const subtitle = cleanDisplayText_(incoming.subtitle || rowObj.subtitle || "");
  const category = cleanDisplayText_(incoming.category || rowObj.category || "Personal essay");
  const body = cleanBlogContentText_(incoming.body || rowObj.body || "").trim();

  if (!title || !subtitle || !body) {
    throw new Error("Pending blog edit requires title, short description, and body.");
  }

  const incomingImages = Array.isArray(incoming.images) ? incoming.images : rowObj.images;
  const images = cleanUrlList_(incomingImages || []);
  const anonymous = incoming.anonymous === true || incoming.anonymous === "true" || rowObj.anonymous === "true";
  const author = anonymous ? {
    name: "Anonymous contributor",
    anonymous: true
  } : {
    name: cleanDisplayText_(incomingAuthor.name || rowAuthor.name || rowObj.authorName || "Anonymous contributor"),
    email: String(incomingAuthor.email || rowAuthor.email || "").trim(),
    role: cleanDisplayText_(incomingAuthor.role || rowAuthor.role || ""),
    photoUrl: String(incomingAuthor.photoUrl || rowAuthor.photoUrl || "").trim(),
    location: cleanDisplayText_(incomingAuthor.location || rowAuthor.location || ""),
    links: cleanUrlList_(incomingAuthor.links || rowAuthor.links || []),
    bio: cleanDisplayText_(incomingAuthor.bio || rowAuthor.bio || ""),
    anonymous: false
  };

  setCell_(sheet, headers, rowNumber, "title", title);
  setCell_(sheet, headers, rowNumber, "subtitle", subtitle);
  setCell_(sheet, headers, rowNumber, "category", category);
  setCell_(sheet, headers, rowNumber, "body", body);
  setCell_(sheet, headers, rowNumber, "images", JSON.stringify(images));
  setCell_(sheet, headers, rowNumber, "author", JSON.stringify(author));
  setCell_(sheet, headers, rowNumber, "authorName", author.name);
  setCell_(sheet, headers, rowNumber, "anonymous", author.anonymous ? "true" : "false");
  setCell_(sheet, headers, rowNumber, "slug", slugify_(incoming.slug || title));
  setCellIfHeader_(sheet, headers, rowNumber, "updatedAt", new Date().toISOString());
  setCellIfHeader_(sheet, headers, rowNumber, "updatedBy", payload.adminEmail || "");

  const refreshed = findRowById_(sheet, payload.id).rowObj;
  return { result: "success", item: refreshed };
}

function getBlogEngagementData_(params) {
  const postId = String(params.postId || "").trim();
  const postSlug = String(params.postSlug || "").trim();
  if (!postId && !postSlug) {
    throw new Error("Missing blog post id or slug.");
  }

  const commentsSheet = getOrCreateSheetWithHeaders_(BLOG_COMMENTS_SHEET_NAME, BLOG_COMMENT_HEADERS);
  const commentsHeaders = getHeaders_(commentsSheet);
  const commentValues = commentsSheet.getDataRange().getValues();
  const comments = commentValues
    .slice(1)
    .map((row, index) => rowToObject_(commentsHeaders, row, index + 2))
    .filter(item => item.status === "visible")
    .filter(item => blogPostMatches_(item, postId, postSlug))
    .sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)))
    .map(item => ({
      id: item.id,
      authorName: item.authorName || "Anonymous",
      comment: item.comment || "",
      submittedAt: item.submittedAt || ""
    }));

  const viewsSheet = getOrCreateSheetWithHeaders_(BLOG_VIEWS_SHEET_NAME, BLOG_VIEW_HEADERS);
  const viewsHeaders = getHeaders_(viewsSheet);
  const viewValues = viewsSheet.getDataRange().getValues();
  const viewCount = viewValues
    .slice(1)
    .map((row, index) => rowToObject_(viewsHeaders, row, index + 2))
    .filter(item => blogPostMatches_(item, postId, postSlug))
    .length;

  return {
    result: "success",
    postId,
    postSlug,
    viewCount,
    commentCount: comments.length,
    comments
  };
}

function recordBlogViewData_(payload) {
  const postId = String(payload.postId || "").trim();
  const postSlug = String(payload.postSlug || "").trim();
  if (!postId && !postSlug) {
    throw new Error("Missing blog post id or slug.");
  }

  const sheet = getOrCreateSheetWithHeaders_(BLOG_VIEWS_SHEET_NAME, BLOG_VIEW_HEADERS);
  const headers = getHeaders_(sheet);
  const record = {
    id: Utilities.getUuid(),
    postId,
    postSlug,
    visitorKey: String(payload.visitorKey || "").slice(0, 160),
    viewedAt: new Date().toISOString(),
    userAgent: String(payload.userAgent || "").slice(0, 300)
  };
  sheet.appendRow(headers.map(header => record[header] ?? ""));
  return getBlogEngagementData_({ postId, postSlug });
}

function submitBlogCommentData_(payload) {
  const postId = String(payload.postId || "").trim();
  const postSlug = String(payload.postSlug || "").trim();
  if (!postId && !postSlug) {
    throw new Error("Missing blog post id or slug.");
  }

  const authorName = cleanDisplayText_(payload.signedInName || payload.authorName || "").slice(0, 80);
  const authorEmail = String(payload.authorEmail || "").trim().slice(0, 160);
  const comment = cleanDisplayText_(payload.comment || "").slice(0, 2000);

  if (!authorName) {
    throw new Error("Please enter a name before commenting.");
  }
  if (comment.length < 2) {
    throw new Error("Please write a comment before submitting.");
  }

  const sheet = getOrCreateSheetWithHeaders_(BLOG_COMMENTS_SHEET_NAME, BLOG_COMMENT_HEADERS);
  const headers = getHeaders_(sheet);
  const record = {
    id: Utilities.getUuid(),
    status: "visible",
    postId,
    postSlug,
    authorName,
    authorEmail,
    comment,
    submittedAt: new Date().toISOString(),
    deletedAt: "",
    deletedBy: ""
  };
  sheet.appendRow(headers.map(header => record[header] ?? ""));

  return getBlogEngagementData_({ postId, postSlug });
}

function deleteBlogCommentData_(payload) {
  const sheet = getOrCreateSheetWithHeaders_(BLOG_COMMENTS_SHEET_NAME, BLOG_COMMENT_HEADERS);
  const headers = getHeaders_(sheet);
  const values = sheet.getDataRange().getValues();
  const id = String(payload.id || "").trim();

  for (let i = 1; i < values.length; i++) {
    const rowObj = rowToObject_(headers, values[i], i + 1);
    if (String(rowObj.id) === id) {
      setCell_(sheet, headers, i + 1, "status", "deleted");
      setCell_(sheet, headers, i + 1, "deletedAt", new Date().toISOString());
      setCell_(sheet, headers, i + 1, "deletedBy", payload.adminEmail || "");
      return { result: "success" };
    }
  }

  throw new Error("Comment not found: " + id);
}

function listPublishedBlogPostsData_() {
  const { posts } = getGithubBlogPosts_();
  return { result: "success", posts: posts.map(post => cleanBlogPostDisplayText_(post)) };
}

function updateBlogPostData_(payload) {
  return withGithubWriteLock_(function() {
    const incoming = payload.post || {};
    const { path, fileData, posts } = getGithubBlogPosts_();
    const index = findBlogPostIndex_(posts, incoming.id || payload.id, incoming.slug || payload.slug);
    if (index < 0) {
      throw new Error("Published blog post not found.");
    }

    const existing = posts[index];
    const author = incoming.author && typeof incoming.author === "object" ? incoming.author : {};
    const title = cleanDisplayText_(incoming.title || existing.title || "");
    const subtitle = cleanDisplayText_(incoming.subtitle || existing.subtitle || "");
    const slug = existing.slug || slugify_(title);
    const content = cleanBlogContentText_(incoming.content || existing.content || "");
    const images = cleanUrlList_(incoming.images || existing.images || []);
    const featureImage = String(images[0] || incoming.featureImage || "").trim();
    const shareImage = String(images[0] || incoming.shareImage || featureImage || "").trim();

    let updated = Object.assign({}, existing, {
      title,
      subtitle,
      shareDescription: cleanDisplayText_(incoming.shareDescription || subtitle),
      category: cleanDisplayText_(incoming.category || existing.category || "Personal essay"),
      author: {
        name: cleanDisplayText_(author.name || existing.author?.name || existing.author || "Anonymous contributor"),
        email: String(author.email || existing.author?.email || "").trim(),
        role: cleanDisplayText_(author.role || existing.author?.role || ""),
        photoUrl: String(author.photoUrl || existing.author?.photoUrl || existing.authorImg || "").trim(),
        location: cleanDisplayText_(author.location || existing.author?.location || ""),
        links: cleanUrlList_(author.links || existing.author?.links || []),
        bio: cleanDisplayText_(author.bio || existing.author?.bio || ""),
        anonymous: Boolean(author.anonymous || existing.author?.anonymous)
      },
      images,
      featureImage,
      shareImage,
      date: isoDate_(incoming.date || existing.date || new Date()),
      publishedAt: existing.publishedAt || new Date().toISOString(),
      readTime: estimateReadTime_(content.replace(/<[^>]+>/g, " ")),
      content,
      slug,
      path: existing.path || `${slug}.html`
    });
    updated = ensureBlogPostThumbnail_(updated);

    validateBlogPost_(updated);
    const dedupedPosts = posts.filter((post, postIndex) => {
      if (postIndex === index) return false;
      return !blogPostIdentityMatches_(post, updated.id, updated.slug);
    });
    dedupedPosts.splice(Math.min(index, dedupedPosts.length), 0, updated);
    putGithubFile_(path, fileData, JSON.stringify(dedupedPosts, null, 2), `Update blog post: ${updated.title}`);
    updateGithubBlogPostPage_(updated);
    updateGithubSitemapForBlogPosts_(dedupedPosts);

    return { result: "success", post: updated };
  });
}

function deleteBlogPostData_(payload) {
  return withGithubWriteLock_(function() {
    const { path, fileData, posts } = getGithubBlogPosts_();
    const index = findBlogPostIndex_(posts, payload.id, payload.slug);
    if (index < 0) {
      throw new Error("Published blog post not found.");
    }

    const removed = posts.splice(index, 1)[0];
    putGithubFile_(path, fileData, JSON.stringify(posts, null, 2), `Delete blog post: ${removed.title || removed.slug}`);
    if (removed.path) {
      putGithubFileAllowCreate_(
        `blog/${removed.path}`,
        deletedBlogPostPageHtml_(removed),
        `Retire blog post page: ${removed.title || removed.slug}`
      );
    }
    if (removed.slug) {
      putGithubFileAllowCreate_(
        `blog/${removed.slug}/index.html`,
        deletedBlogPostPageHtml_(removed),
        `Retire clean blog post page: ${removed.title || removed.slug}`
      );
    }
    updateGithubSitemapForBlogPosts_(posts);

    return { result: "success", deleted: removed };
  });
}

function getGithubBlogPosts_() {
  const path = getProps_().getProperty("BLOG_POSTS_PATH") || "data/blog_posts.json";
  const { fileData, currentContent } = getGithubFile_(path);
  let posts = JSON.parse(currentContent || "[]");
  posts = Array.isArray(posts) ? posts : (posts.posts || []);
  if (!Array.isArray(posts)) {
    throw new Error("blog_posts.json must be a JSON array or an object with a posts array.");
  }
  return { path, fileData, posts };
}

function findBlogPostIndex_(posts, id, slug) {
  const idText = String(id || "");
  const slugText = String(slug || "");
  return posts.findIndex(post => blogPostIdentityMatches_(post, idText, slugText));
}

function blogPostIdentityMatches_(post, id, slug) {
  const idText = String(id || "");
  const slugText = String(slug || "");
  return (idText && String(post.id || "") === idText) ||
    (slugText && String(post.slug || "") === slugText);
}

function blogPostMatches_(item, postId, postSlug) {
  return (postId && String(item.postId || "") === String(postId)) ||
    (postSlug && String(item.postSlug || "") === String(postSlug));
}

function cleanUrlList_(values) {
  const list = Array.isArray(values)
    ? values
    : String(values || "").split(/\n|,/);
  return list
    .map(value => normalizeImageUrl_(String(value || "").trim()))
    .filter(Boolean);
}

function normalizeImageUrl_(url) {
  const clean = String(url || "").trim().replace(/&amp;/g, "&");
  if (!clean) return "";

  const githubBlobMatch = clean.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+?)(?:\?.*)?$/i);
  if (githubBlobMatch) {
    return `https://raw.githubusercontent.com/${githubBlobMatch[1]}/${githubBlobMatch[2]}/${githubBlobMatch[3]}/${githubBlobMatch[4]}`;
  }

  return clean;
}

function normalizeImageSourcesInHtml_(html) {
  return String(html || "").replace(/(<img\b[^>]*\bsrc=)(["'])(.*?)\2/gi, function(match, prefix, quote, url) {
    const normalized = normalizeImageUrl_(url).replace(/"/g, "%22").replace(/'/g, "%27");
    return `${prefix}${quote}${normalized}${quote}`;
  });
}

function extractFirstImageFromHtml_(html) {
  const text = String(html || "");
  const match = text.match(/<img\b[^>]*\bsrc=(["'])(.*?)\1/i);
  return match ? normalizeImageUrl_(match[2]) : "";
}

function deletedBlogPostPageHtml_(post) {
  const title = escapeHtml_(post.title || "Blog post removed");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>${title} | Removed</title>
  <meta http-equiv="refresh" content="0; url=https://echoesofgaza.org/blog">
  <script>window.location.replace("https://echoesofgaza.org/blog");</script>
</head>
<body>
  <p>This blog post has been removed. <a href="https://echoesofgaza.org/blog">Return to the blog</a>.</p>
</body>
</html>`;
}

function withGithubWriteLock_(callback) {
  const lock = LockService.getScriptLock();
  let hasLock = false;

  try {
    lock.waitLock(90000);
    hasLock = true;
    return callback();
  } catch (err) {
    if (!hasLock) {
      throw new Error("Another approval is updating GitHub. Please wait a few seconds and try again. Nothing was marked approved.");
    }
    throw err;
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}


function importLebanonPeaceDraftToPendingBlogQueue() {
  const encodedDraft = [
    'ewogICJzdGF0dXMiOiAiZHJhZnQiLAogICJwdWJsaXNoIjogZmFsc2UsCiAgInNvdXJjZVBkZiI6ICIvVXNlcnMvZ29ibHUv',
    'TGlicmFyeS9Db250YWluZXJzL2NvbS5hcHBsZS5tYWlsL0RhdGEvTGlicmFyeS9NYWlsIERvd25sb2Fkcy83NTFGNEIyRi1B',
    'NTUwLTQ0M0UtOUNBOS01MzI3RkZBREE4NkYvTGViYW5vbi1hbmQtcGVhY2UtUmV2LTIucGRmIiwKICAidGl0bGUiOiAiT2Nj',
    'dXBhdGlvbiBEb2VzIE5vdCBFcmFzZSBSZXNpc3RhbmNlOiBMZWJhbm9uLCBJcmFuLCBhbmQgdGhlIElsbHVzaW9uIG9mIER1',
    'cmFibGUgQ29udHJvbCIsCiAgInNsdWciOiAib2NjdXBhdGlvbi1kb2VzLW5vdC1lcmFzZS1yZXNpc3RhbmNlLWxlYmFub24t',
    'aXJhbi1hbmQtdGhlLWlsbHVzaW9uLW9mLWR1cmFibGUtY29udHJvbCIsCiAgInBhdGhQcmV2aWV3SWZBcHByb3ZlZCI6ICJv',
    'Y2N1cGF0aW9uLWRvZXMtbm90LWVyYXNlLXJlc2lzdGFuY2UtbGViYW5vbi1pcmFuLWFuZC10aGUtaWxsdXNpb24tb2YtZHVy',
    'YWJsZS1jb250cm9sLyIsCiAgInN1YnRpdGxlIjogIkEgcmVmbGVjdGlvbiBvbiBMZWJhbm9uLCBJcmFuLCBhbmQgdGhlIHJl',
    'Y3VycmluZyBmYWlsdXJlIG9mIG1pbGl0YXJ5IG9jY3VwYXRpb24gdG8gcHJvZHVjZSBkdXJhYmxlIGNvbnRyb2wsIGFyZ3Vp',
    'bmcgdGhhdCBsYXN0aW5nIHNlY3VyaXR5IHJlcXVpcmVzIHBvbGl0aWNhbCBsZWdpdGltYWN5LCByZWNpcHJvY2l0eSwgYW5k',
    'IGFjY291bnRhYmlsaXR5LiIsCiAgInNoYXJlRGVzY3JpcHRpb24iOiAiQSByZWZsZWN0aW9uIG9uIExlYmFub24sIElyYW4s',
    'IGFuZCB0aGUgcmVjdXJyaW5nIGZhaWx1cmUgb2YgbWlsaXRhcnkgb2NjdXBhdGlvbiB0byBwcm9kdWNlIGR1cmFibGUgY29u',
    'dHJvbCwgYXJndWluZyB0aGF0IGxhc3Rpbmcgc2VjdXJpdHkgcmVxdWlyZXMgcG9saXRpY2FsIGxlZ2l0aW1hY3ksIHJlY2lw',
    'cm9jaXR5LCBhbmQgYWNjb3VudGFiaWxpdHkuIiwKICAiY2F0ZWdvcnkiOiAiT3BpbmlvbiIsCiAgImRhdGVEcmFmdGVkIjog',
    'IjIwMjYtMDYtMDciLAogICJhdXRob3IiOiB7CiAgICAibmFtZSI6ICJZb3Vzc2VmIEEuIEVsemVpbiIsCiAgICAicm9sZSI6',
    'ICIiLAogICAgImxvY2F0aW9uIjogIkRheXRvbiwgT2hpbyIsCiAgICAicGhvdG9VcmwiOiAiIiwKICAgICJiaW8iOiAiIiwK',
    'ICAgICJsaW5rcyI6IFtdLAogICAgImFub255bW91cyI6IGZhbHNlCiAgfSwKICAiaW1hZ2VzIjogW10sCiAgImZlYXR1cmVJ',
    'bWFnZSI6ICIiLAogICJzaGFyZUltYWdlIjogIiIsCiAgInJlYWRUaW1lIjogIjE0IG1pbiByZWFkIiwKICAid29yZENvdW50',
    'IjogMzAzNywKICAiZWRpdG9yTm90ZXMiOiBbCiAgICAiRHJhZnQgb25seS4gRG8gbm90IGFkZCB0byBkYXRhL2Jsb2dfcG9z',
    'dHMuanNvbiBvciBnZW5lcmF0ZSBwdWJsaWMgYmxvZyBwYWdlcyB1bnRpbCBhcHByb3ZlZC4iLAogICAgIkF1dGhvciBiaW8v',
    'cGhvdG8vY29udGFjdCBpbmZvIHN0aWxsIG5lZWRlZCBiZWZvcmUgcHVibGljYXRpb24uIiwKICAgICJTZXZlcmFsIGNsYWlt',
    'cyBkZXBlbmQgb24gY3VycmVudC1ldmVudCBzb3VyY2luZzsgdmVyaWZ5IGNpdGF0aW9ucyBhbmQgc291cmNlIGxpbmtzIGJl',
    'Zm9yZSBwdWJsaXNoaW5nLiIsCiAgICAiUERGIGV4dHJhY3Rpb24gd2FzIGNsZWFuZWQgZm9yIGxheW91dCBhcnRpZmFjdHMg',
    'YW5kIHJlYWRhYmlsaXR5OyBjb21wYXJlIGFnYWluc3QgdGhlIHNvdXJjZSBQREYgYmVmb3JlIGZpbmFsIGFwcHJvdmFsLiIK',
    'ICBdLAogICJjb250ZW50IjogIjxwPkEgbm90ZSBiZWZvcmUgeW91IHJlYWQ6IEkgYW0gbm90IGEgcG9saXRpY2FsIHNjaWVu',
    'dGlzdCBvciBtaWxpdGFyeSBhbmFseXN0LiBJIGhvbGQgbm8gY3JlZGVudGlhbHMgdGhhdCBjb25mZXIgYXV0aG9yaXR5IG9u',
    'IHRoZXNlIHF1ZXN0aW9ucy4gV2hhdCBJIGRvIGJyaW5nIGlzIGEgY29tbWl0bWVudCB0byByZWFkaW5nIGNhcmVmdWxseSwg',
    'cmVzZWFyY2hpbmcgaG9uZXN0bHksIGFuZCBmb2xsb3dpbmcgZXZpZGVuY2Ugd2hlcmUgaXQgbGVhZHMg4oCUIGV2ZW4gd2hl',
    'biBpdCBpcyBpbmNvbnZlbmllbnQuIEkgd3JpdGUgZnJvbSBjdXJpb3NpdHkgYW5kIGNvbnNjaWVuY2UsIG5vdCBmcm9tIGlk',
    'ZW9sb2d5LiBJIHdyaXRlIHRvIGV4cG9zZSBpbmh1bWFuZSBwcmFjdGljZXMgd2hpbGUgY2hhbGxlbmdpbmcgYSBtZWRpYSBl',
    'bnZpcm9ubWVudCBpbiB3aGljaCBvbmx5IG9uZSBzaWRlIG9mIHRoZSBzdG9yeSBpcyBvZnRlbiBjZW50ZXJlZCBpbiBXZXN0',
    'ZXJuIGFuZCBVUyBjb3ZlcmFnZS4gSSBhc2sgdGhhdCB5b3UgZW5nYWdlIHRoaXMgcGllY2Ugb24gdGhlIHN0cmVuZ3RoIG9m',
    'IGl0cyBhcmd1bWVudHMgYW5kIHRoZSBkb2N1bWVudGVkIHJlY29yZCBpdCBkcmF3cyBmcm9tLjwvcD5cbjxwPk1lbW9yaWFs',
    'IERheSBwYXNzZWQganVzdCBkYXlzIGFnbywgYW5kIHdpdGggaXQgY2FtZSB0aGUgZmFtaWxpYXIgY2VyZW1vbmllczogZmxh',
    'Z3MsIHNwZWVjaGVzLCB0aGUgc29sZW1uIHJvbGwgY2FsbCBvZiB0aGUgZmFsbGVuLiBXZSBob25vcmVkLCBhcyB3ZSBzaG91',
    'bGQsIHRoZSBtZW4gYW5kIHdvbWVuIHdobyBnYXZlIHRoZWlyIGxpdmVzIGluIHNlcnZpY2UgdG8gdGhpcyBjb3VudHJ5LiBC',
    'dXQgaG9ub3Jpbmcgc2FjcmlmaWNlIGhvbmVzdGx5IGFsc28gbWVhbnMgYXNraW5nIHdoYXQgdGhhdCBzYWNyaWZpY2Ugd2Fz',
    'IGZvciDigJQgYW5kIHdoZXRoZXIgaXQgYWNoaWV2ZWQgd2hhdCB3ZSB3ZXJlIHRvbGQgaXQgd291bGQuPC9wPlxuPHA+Q29u',
    'c2lkZXIgdGhlIHJlY2VudCByZWNvcmQuIEluIElyYXEsIHRoZSBVbml0ZWQgU3RhdGVzIHRvcHBsZWQgYSBnb3Zlcm5tZW50',
    'LCBkaXNtYW50bGVkIGFuIGFybXksIGFuZCBzcGVudCB0d28gZGVjYWRlcyBhbmQgbmVhcmx5IDQsNTAwIEFtZXJpY2FuIGxp',
    'dmVzIGF0dGVtcHRpbmcgdG8gYnVpbGQgYSBzdGFibGUsIGRlbW9jcmF0aWMgb3JkZXIuIFdoYXQgZW1lcmdlZCBpbnN0ZWFk',
    'IHdhcyBhIHNlY3RhcmlhbiBzdGF0ZSB3aXRoIGRlZXAgSXJhbmlhbiBpbmZsdWVuY2UsIGFuIElTSVMgaW5zdXJnZW5jeSBi',
    'b3JuIGRpcmVjdGx5IGZyb20gdGhlIGJldHJheWFsIGFuZCBhYmFuZG9ubWVudCBvZiB0aGUgU3VubmkgY29tbXVuaXR5IGJ5',
    'IGJvdGggdGhlIFVTIGFuZCBJcmFuIOKAlCBXYXNoaW5ndG9uIGJyZWFraW5nIGl0cyBwbGVkZ2VzIHRvIHRoZSAxMDAsMDAw',
    'IGFybWVkIFN1bm5pIGZpZ2h0ZXJzIHdobyBoYWQgc3Rvb2Qgd2l0aCBBbWVyaWNhbiBmb3JjZXMgZHVyaW5nIHRoZSBzdXJn',
    'ZSwgd2hpbGUgYWxsb3dpbmcgUHJpbWUgTWluaXN0ZXIgTm91cmkgYWwtTWFsaWtpIHRvIHN5c3RlbWF0aWNhbGx5IGV4Y2x1',
    'ZGUgYW5kIHBlcnNlY3V0ZSBTdW5uaSBwb2xpdGljYWwgbGVhZGVycyDigJQgYW5kIGEgcG9wdWxhdGlvbiB0aGF0IHJlZ2Fy',
    'ZHMgdGhlIGludGVydmVudGlvbiB3aXRoIGFtYml2YWxlbmNlIGF0IGJlc3QgYW5kIGZ1cnkgYXQgd29yc3QuIEluIEFmZ2hh',
    'bmlzdGFuLCB0aGUgVW5pdGVkIFN0YXRlcyB3YWdlZCB0aGUgbG9uZ2VzdCB3YXIgaW4gaXRzIGhpc3Rvcnkg4oCUIHR3ZW50',
    'eSB5ZWFycywgb3ZlciAyLDQwMCBzZXJ2aWNlIG1lbWJlcnMga2lsbGVkLCBodW5kcmVkcyBvZiB0aG91c2FuZHMgb2YgQWZn',
    'aGFuIGxpdmVzIGxvc3Qg4oCUIG9ubHkgdG8gd2F0Y2ggdGhlIFRhbGliYW4gcmV0YWtlIEthYnVsIGluIGVsZXZlbiBkYXlz',
    'IG9uY2UgdGhlIHdpdGhkcmF3YWwgY2FtZS4gSW4gU3lyaWEsIEFtZXJpY2FuIGZvcmNlcyB3ZXJlIGRyYXduIGludG8gYSBt',
    'dWx0aS1zaWRlZCBjb25mbGljdCB3aXRoIG5vIGNsZWFyIG1hbmRhdGUsIG5vIGV4aXQgc3RyYXRlZ3ksIGFuZCBubyBlbmR1',
    'cmluZyBvdXRjb21lIHRoYXQgY291bGQganVzdGlmeSB0aGUgY29zdCBpbiBsaXZlcyBhbmQgdHJlYXN1cmUuPC9wPlxuPHA+',
    'QW5kIHRoZW4gSXJhbiDigJQgaW4gdHdvIGFjdHMuIEluIEp1bmUgMjAyNSwgT3BlcmF0aW9uIE1pZG5pZ2h0IEhhbW1lciBz',
    'dHJ1Y2sgSXJhbmlhbiBudWNsZWFyIGZhY2lsaXRpZXMgd2l0aCBCLTIgYm9tYmVycy4gVGhlIGFkbWluaXN0cmF0aW9uIGRl',
    'Y2xhcmVkIHZpY3RvcnkuIFRoZSBjcmlzaXMgd2FzIG5vdCByZXNvbHZlZC4gVGhlbiBjYW1lIEZlYnJ1YXJ5IDIwMjYsIHdo',
    'ZW4gdGhlIFVuaXRlZCBTdGF0ZXMgYW5kIElzcmFlbCBsYXVuY2hlZCBPcGVyYXRpb24gRXBpYyBGdXJ5IOKAlCBhc3Nhc3Np',
    'bmF0aW5nIFN1cHJlbWUgTGVhZGVyIEtoYW1lbmVpIGFuZCB0cmlnZ2VyaW5nIElyYW5pYW4gcmV0YWxpYXRvcnkgc3RyaWtl',
    'cyBhY3Jvc3MgYWxsIHNpeCBHdWxmIHN0YXRlcywgdGFyZ2V0aW5nIGFpcnBvcnRzLCBvaWwgcmVmaW5lcmllcywgYW5kIFVT',
    'IG1pbGl0YXJ5IGJhc2VzIHRocm91Z2hvdXQgdGhlIHJlZ2lvbi4gVGhlIFN0cmFpdCBvZiBIb3JtdXogd2FzIGNsb3NlZC4g',
    'R2xvYmFsIG9pbCBtYXJrZXRzIGNvbnZ1bHNlZC4gQW1lcmljYW4gc2VydmljZSBtZW1iZXJzIGFjcm9zcyB0aGUgR3VsZiB3',
    'ZXJlIHBsYWNlZCBkaXJlY3RseSBpbiB0aGUgbGluZSBvZiBmaXJlIOKAlCBub3QgYmVjYXVzZSBBbWVyaWNhIHdhcyBhdHRh',
    'Y2tlZCwgYnV0IGJlY2F1c2UgV2FzaGluZ3RvbiBjaG9zZSB0byBlbnRlciBzb21lb25lIGVsc2UncyB3YXIuIE9ubHkgMjEg',
    'cGVyY2VudCBvZiBBbWVyaWNhbnMgc3VwcG9ydGVkIHRoZSBGZWJydWFyeSBzdHJpa2VzLiBUaGUgcGVvcGxlIHdobyBiZWFy',
    'IHRoZSByaXNrIHdlcmUgbm90IGNvbnN1bHRlZC4gVGhleSByYXJlbHkgYXJlLjwvcD5cbjxwPldoYXQgbWFrZXMgdGhpcyBt',
    'b3JlIHRyb3VibGluZyBpcyB3aGF0IHdhcyBrbm93biBhbmQgaWdub3JlZCBiZWZvcmVoYW5kLiBUaGUgVVMgSm9pbnQgQ2hp',
    'ZWZzIG9mIFN0YWZmIGV4cGxpY2l0bHkgd2FybmVkIFByZXNpZGVudCBUcnVtcCB0aGF0IHN0cmlrZXMgb24gSXJhbiB3b3Vs',
    'ZCBsaWtlbHkgcHJvbXB0IHRoZSBjbG9zdXJlIG9mIHRoZSBTdHJhaXQgb2YgSG9ybXV6LiBIZSBkaXNtaXNzZWQgdGhlIHdh',
    'cm5pbmcuIEFzIGZvciBBbWVyaWNhJ3MgR3VsZiBhbGxpZXMg4oCUIFNhdWRpIEFyYWJpYSBhbmQgdGhlIFVBRSBoYWQgcHVi',
    'bGljbHkgc2lnbmFsZWQgdGhlaXIgbmV1dHJhbGl0eSBhbmQgdGhhdCB0aGVpciB0ZXJyaXRvcnkgd291bGQgbm90IGJlIHVz',
    'ZWQgdG8gbGF1bmNoIGF0dGFja3Mgb24gSXJhbiwgYSBzaWduYWwgaW50ZW5kZWQgdG8gaW5zdWxhdGUgdGhlbSBmcm9tIEly',
    'YW5pYW4gcmV0YWxpYXRpb24uIFdoYXRldmVyIHByaXZhdGUgY29uc3VsdGF0aW9ucyBtYXkgaGF2ZSBvY2N1cnJlZCBhdCB0',
    'aGUgZWxpdGUgbGV2ZWwsIEd1bGYgcG9wdWxhdGlvbnMgd29rZSBvbiBNYXJjaCAxIHRvIElyYW5pYW4gbWlzc2lsZXMgc3Ry',
    'aWtpbmcgdGhlaXIgYWlycG9ydHMsIHBvcnRzLCBhbmQgZW5lcmd5IGluZnJhc3RydWN0dXJlIHdpdGhvdXQgd2FybmluZyBv',
    'ciBwcmVwYXJhdGlvbi4gVGhlIHJlc3RyYWludCB0aG9zZSBnb3Zlcm5tZW50cyBoYWQgY2FyZWZ1bGx5IHBlcmZvcm1lZCBi',
    'b3VnaHQgdGhlbSBubyBwcm90ZWN0aW9uLiBUaGVpciBwZW9wbGUgcGFpZCB0aGUgcHJpY2UgZm9yIGEgZGVjaXNpb24gdGhh',
    'dCB3YXMgbm90IHRoZWlycyB0byBtYWtlLjwvcD5cbjxwPlN5cmlhIGRlc2VydmVzIGl0cyBvd24gcGFyYWdyYXBoLCBiZWNh',
    'dXNlIGl0IHByb2R1Y2VkIHRoZSBtb3N0IGV4dHJhb3JkaW5hcnkgaWxsdXN0cmF0aW9uIG9mIEFtZXJpY2FuIGRpcGxvbWF0',
    'aWMgaW5jb2hlcmVuY2UgaW4gbW9kZXJuIGhpc3Rvcnkg4oCUIGFuZCB0aGUgbW9zdCBkaXJlY3QgcmVidWtlIHRvIG9uZSBv',
    'ZiBXYXNoaW5ndG9uJ3MgbW9zdCBsb3VkbHkgcHJvY2xhaW1lZCBwcmluY2lwbGVzLiBUaGUgVW5pdGVkIFN0YXRlcyBhbmQg',
    'SXNyYWVsIGhhdmUgbG9uZyBpbnNpc3RlZCwgYXMgYSBtYXR0ZXIgb2Ygc29sZW1uIHBvbGljeSwgdGhhdCB0aGV5IGRvIG5v',
    'dCBuZWdvdGlhdGUgd2l0aCB0ZXJyb3Jpc3RzLiBJdCBpcyBhIHBvc2l0aW9uIHN0YXRlZCB3aXRoIHBhcnRpY3VsYXIgZm9y',
    'Y2Ugd2hlbmV2ZXIgUGFsZXN0aW5pYW4sIExlYmFuZXNlLCBvciBJcmFuaWFuIGludGVybG9jdXRvcnMgYXJlIGludm9sdmVk',
    'LiBIb2xkIHRoYXQgcHJpbmNpcGxlIGluIG1pbmQgd2hpbGUgY29uc2lkZXJpbmcgdGhlIGZvbGxvd2luZyBkb2N1bWVudGVk',
    'IGZhY3RzLiBBaG1lZCBhbC1TaGFyYWEg4oCUIHRoZW4ga25vd24gYnkgaGlzIG5vbSBkZSBndWVycmUgQWJ1IE1vaGFtbWFk',
    'IGFsLUpvbGFuaSDigJQgd2FzIGFycmVzdGVkIGJ5IEFtZXJpY2FuIHRyb29wcyBpbiBJcmFxIGZvciBtZW1iZXJzaGlwIGlu',
    'IGFsLVFhZWRhLiBIZSBsYXRlciBsZWQgSGF5YXQgVGFocmlyIGFsLVNoYW0sIHdoaWNoIHRoZSBVbml0ZWQgU3RhdGVzIGZv',
    'cm1hbGx5IGRlc2lnbmF0ZWQgYSBmb3JlaWduIHRlcnJvcmlzdCBvcmdhbml6YXRpb24uIFRoZSBVUyBwbGFjZWQgYSAkMTAg',
    'bWlsbGlvbiBib3VudHkgb24gaGlzIGhlYWQuIEluIERlY2VtYmVyIDIwMjQsIGhpcyBmb3JjZXMgc3dlcHQgYWNyb3NzIFN5',
    'cmlhIGFuZCB0b3BwbGVkIEJhc2hhciBhbC1Bc3NhZC4gVGhlIEJpZGVuIGFkbWluaXN0cmF0aW9uJ3MgQXNzaXN0YW50IFNl',
    'Y3JldGFyeSBvZiBTdGF0ZSB0aGVuIGZsZXcgdG8gRGFtYXNjdXMsIG1ldCB3aXRoIGFsLVNoYXJhYSwgYW5kIGxpZnRlZCB0',
    'aGUgYm91bnR5IOKAlCBleHBsYWluaW5nIHRoYXQgXCJpZiB3ZSBhcmUgaGF2aW5nIGEgZGlzY3Vzc2lvbiwgaXQgaXMgaW5j',
    'b2hlcmVudCB0byBoYXZlIGEgYm91bnR5IG9uIGhpcyBoZWFkLlwiIEJ5IEphbnVhcnkgMjAyNSwgYWwtU2hhcmFhIHdhcyBu',
    'YW1lZCBTeXJpYSdzIGludGVyaW0gcHJlc2lkZW50LiBCeSBOb3ZlbWJlciAyMDI1LCBoZSB3YXMgd2VsY29tZWQgdG8gdGhl',
    'IFdoaXRlIEhvdXNlIGJ5IERvbmFsZCBUcnVtcCwgd2hvIHNlbnQgaGltIGEgY29yZGlhbCBoYW5kd3JpdHRlbiBub3RlIGhh',
    'aWxpbmcgaGltIGFzIGEgZnV0dXJlIFwiZ3JlYXQgbGVhZGVyLlwiIEl0IHdhcyB0aGUgZmlyc3QgdGltZSBhIFN5cmlhbiBw',
    'cmVzaWRlbnQgaGFkIGV2ZXIgYmVlbiByZWNlaXZlZCBhdCB0aGUgV2hpdGUgSG91c2UuIFRoZSBtYW4gd2l0aCB0aGUgQW1l',
    'cmljYW4gdGVycm9yaXN0IGRlc2lnbmF0aW9uIGFuZCB0aGUgJDEwIG1pbGxpb24gYm91bnR5IGlzIG5vdyBXYXNoaW5ndG9u',
    'J3MgcGFydG5lciBpbiB0aGUgZmlnaHQgYWdhaW5zdCBJU0lTLiBUaGUgVW5pdGVkIFN0YXRlcyBhbmQgSXNyYWVsIGRvIG5v',
    'dCBuZWdvdGlhdGUgd2l0aCB0ZXJyb3Jpc3RzIOKAlCB1bmxlc3MsIGl0IGFwcGVhcnMsIHRoZSBuZWdvdGlhdGlvbiBzZXJ2',
    'ZXMgYSBwdXJwb3NlIHRoZXkgZmluZCBjb252ZW5pZW50LiBUaGF0IHF1YWxpZmllciByZW5kZXJzIHRoZSBwcmluY2lwbGUg',
    'bWVhbmluZ2xlc3MsIGFuZCB0aGUgcGVvcGxlIG9mIExlYmFub24sIFBhbGVzdGluZSwgYW5kIElyYW4gYXJlIGVudGl0bGVk',
    'IHRvIHNheSBzby48L3A+XG48cD5JbiBlYWNoIGNhc2Ug4oCUIElyYXEsIEFmZ2hhbmlzdGFuLCBTeXJpYSwgSXJhbiDigJQg',
    'dGhlIHBhdHRlcm4gaXMgdGhlIHNhbWU6IG1pbGl0YXJ5IGRvbWluYW5jZSBjb3VsZCBub3Qgc3Vic3RpdHV0ZSBmb3IgcG9s',
    'aXRpY2FsIGxlZ2l0aW1hY3kuIFJlZ2ltZSBjaGFuZ2UgY291bGQgbm90IG1hbnVmYWN0dXJlIGNvbnNlbnQuIEFuZCByZXNp',
    'c3RhbmNlIOKAlCBob3dldmVyIGJydXRhbGx5IHN1cHByZXNzZWQg4oCUIGRpZCBub3Qgc3RheSBzdXBwcmVzc2VkLjwvcD5c',
    'bjxwPkkgd3JpdGUgdGhpcyBub3QgdG8gZGltaW5pc2ggdGhlIHZhbG9yIG9mIHRob3NlIHdobyBzZXJ2ZWQuIEkgd3JpdGUg',
    'aXQgYmVjYXVzZSB0aGVpciBzYWNyaWZpY2UgZGVzZXJ2ZXMgYmV0dGVyIHRoYW4gcmVwZXRpdGlvbi4gQXMgSSB3YXRjaCB0',
    'aGUgY3VycmVudCBjYW1wYWlnbiB1bmZvbGRpbmcgaW4gTGViYW5vbiwgd2l0aCB0aGUgc2FtZSBsb2dpYywgdGhlIHNhbWUg',
    'bGFuZ3VhZ2UsIGFuZCB0aGUgc2FtZSBjb25maWRlbnQgcHJlZGljdGlvbnMgb2YgYSBkdXJhYmxlIG1pbGl0YXJ5IHNvbHV0',
    'aW9uLCBJIGZpbmQgbXlzZWxmIHJldHVybmluZyB0byBhIHF1ZXN0aW9uIHRoYXQgbm8gb25lIGluIHBvd2VyIHNlZW1zIHdp',
    'bGxpbmcgdG8gYW5zd2VyIGhvbmVzdGx5OiB3aGVuIGhhcyB0aGlzIGV2ZXIgd29ya2VkIGluIHRoZSBNaWRkbGUgRWFzdD88',
    'L3A+XG48cD5UaGVyZSBpcyBhIHF1ZXN0aW9uIHRoYXQgcmFyZWx5IGdldHMgYXNrZWQgaW4gdGhlIGJyZWF0aGxlc3MgY292',
    'ZXJhZ2Ugb2YgSXNyYWVsJ3MgZXhwYW5kaW5nIG1pbGl0YXJ5IGNhbXBhaWduIGluIExlYmFub246IGV2ZW4gaWYgdGhlIHN0',
    'YXRlZCBvYmplY3RpdmUg4oCUIGRpc21hbnRsaW5nIEhlemJvbGxhaCDigJQgd2VyZSBmdWxseSBhY2hpZXZlZCwgd2hhdCBw',
    'cmV2ZW50cyBhbm90aGVyIHJlc2lzdGFuY2UgbW92ZW1lbnQgZnJvbSBlbWVyZ2luZyBpbiBpdHMgcGxhY2U/IEhpc3Rvcnkg',
    'b2ZmZXJzIGEgY2xlYXIgYW5zd2VyLiBJdCBhbHdheXMgZG9lcy48L3A+XG48cD5UaGF0IHF1ZXN0aW9uIGRlc2VydmVzIHRv',
    'IHNpdCBhdCB0aGUgY2VudGVyIG9mIGFueSBob25lc3QgYW5hbHlzaXMgb2Ygd2hhdCBpcyB1bmZvbGRpbmcgdG9kYXkg4oCU',
    'IG5vdCBqdXN0IGluIExlYmFub24sIGJ1dCBpbiB0aGUgYnJvYWRlciBkaXBsb21hdGljIHRoZWF0ZXIgc3Vycm91bmRpbmcg',
    'dGhlIHN0YWxsZWQgVVMtSXJhbiBjZWFzZWZpcmUgYW5kIHRoZSBsYW5kIGJlaW5nIHN3YWxsb3dlZCBpbiBzb3V0aGVybiBM',
    'ZWJhbm9uIHdoaWxlIHRoZSB3b3JsZCB3YXRjaGVzLjwvcD5cbjxoMj5UaGUgR2VvbWV0cnkgb2YgdGhlIERlbGF5PC9oMj5c',
    'bjxwPldoZW4gdGhlIFVuaXRlZCBTdGF0ZXMgYW5kIElyYW4gYW5ub3VuY2VkIGEgdHdvLXdlZWsgY2Vhc2VmaXJlIGluIGVh',
    'cmx5IEFwcmlsIDIwMjYsIHRoZSBpbmsgaGFkIGJhcmVseSBkcmllZCBiZWZvcmUgSXNyYWVsaSBmb3JjZXMgbGF1bmNoZWQg',
    'YSBtYWpvciBtaWxpdGFyeSBvcGVyYXRpb24gYWNyb3NzIExlYmFub24g4oCUIGtpbGxpbmcgaHVuZHJlZHMgd2l0aGluIGhv',
    'dXJzIG9mIHRoZSBhbm5vdW5jZW1lbnQuIElyYW4ncyBGb3JlaWduIE1pbmlzdGVyIHB1dCBpdCBwbGFpbmx5OiBcIlRoZSBV',
    'UyBtdXN0IGNob29zZSDigJQgY2Vhc2VmaXJlIG9yIGNvbnRpbnVlZCB3YXIgdmlhIElzcmFlbC4gSXQgY2Fubm90IGhhdmUg',
    'Ym90aC5cIiBUaGF0IHdhcyBub3QgcmhldG9yaWMuIEl0IHdhcyBhIHN0cnVjdHVyYWwgb2JzZXJ2YXRpb24uIFRoZSBjZWFz',
    'ZWZpcmUncyB0ZXJtcyB3ZXJlLCBmcm9tIHRoZSBvdXRzZXQsIGRlbGliZXJhdGVseSBhbWJpZ3VvdXMgb24gdGhlIHF1ZXN0',
    'aW9uIG9mIExlYmFub24uIElzcmFlbCBpbnNpc3RlZCBMZWJhbm9uIHdhcyBleGNsdWRlZCwgdGhlIExlYmFuZXNlIGdvdmVy',
    'bm1lbnQgb2JsaWdlZCwgd2hpbGUgSXJhbiBpbnNpc3RlZCBpdCB3YXMgaW5jbHVkZWQuIFRoZSBVUywgcmF0aGVyIHRoYW4g',
    'cmVzb2x2aW5nIHRoaXMgYW1iaWd1aXR5LCBhbGxvd2VkIGl0IHRvIHBlcnNpc3Qg4oCUIGVmZmVjdGl2ZWx5IGdyYW50aW5n',
    'IElzcmFlbCBhIHdpbmRvdyBpbiB3aGljaCB0byBvcGVyYXRlIHdpdGhvdXQgZGlwbG9tYXRpYyBjb25zdHJhaW50LCBldmVu',
    'IGFzIGEgbm9taW5hbCB0cnVjZSB3YXMgaW4gZWZmZWN0LjwvcD5cbjxwPlNpbmNlIHRoZW4sIElzcmFlbGkgZm9yY2VzIGhh',
    'dmUgY3Jvc3NlZCB0aGUgTGl0YW5pIFJpdmVyIOKAlCB0aGUgZGVlcGVzdCBpbmN1cnNpb24gaW50byBMZWJhbm9uIHNpbmNl',
    'IDE5ODIg4oCUIGFuZCBub3cgb2NjdXB5IGFwcHJveGltYXRlbHkgb25lLWZpZnRoIG9mIExlYmFuZXNlIHRlcnJpdG9yeS4g',
    'SXNyYWVsaSBEZWZlbnNlIE1pbmlzdGVyIElzcmFlbCBLYXR6IGhhcyBvcGVubHkgZGVjbGFyZWQgcGxhbnMgdG8gaG9sZCBh',
    'IFwic2VjdXJpdHkgem9uZVwiIHVwIHRvIHRoZSBMaXRhbmkgUml2ZXIgaW5kZWZpbml0ZWx5LiBGaW5hbmNlIE1pbmlzdGVy',
    'IEJlemFsZWwgU21vdHJpY2ggaGFzIHN1Z2dlc3RlZCByZWRyYXduIG5vcnRoZXJuIGJvcmRlcnMgYWxvbmcgdGhlIExpdGFu',
    'aSBhbHRvZ2V0aGVyLiBUaGVzZSBhcmUgbm90IG1pbGl0YXJ5IGNvbW1hbmRlcnMgc3BlYWtpbmcgb2ZmLXNjcmlwdC4gVGhl',
    'c2UgYXJlIGNhYmluZXQgbWluaXN0ZXJzIHN0YXRpbmcgcG9saWN5LjwvcD5cbjxwPlRoZSBjb25uZWN0aW9uIGJldHdlZW4g',
    'dGhlIGNlYXNlZmlyZSBkZWxheSBhbmQgdGhlIGxhbmQgYmVpbmcgc2VpemVkIGlzIG5vdCBzcGVjdWxhdGl2ZS4gSXQgaXMg',
    'c2VxdWVudGlhbCwgZG9jdW1lbnRlZCwgYW5kIOKAlCB0byBhbnlvbmUgd2F0Y2hpbmcgY2FyZWZ1bGx5IOKAlCBlbnRpcmVs',
    'eSBsZWdpYmxlLiBBIGZpbmFsIGFncmVlbWVudCB0aGF0IGxvY2tzIGluIGEgY2Vhc2VmaXJlIGFsc28gY29uc3RyYWlucyBm',
    'dXJ0aGVyIHRlcnJpdG9yaWFsIGNvbnNvbGlkYXRpb24uIFRoZSBkZWxheSBpcyB0aGUgc3RyYXRlZ3kuPC9wPlxuPGgyPlRo',
    'ZSBMaXRhbmkgSXMgTm90IGEgTmV3IEFtYml0aW9uPC9oMj5cbjxwPkl0IGlzIHdvcnRoIG5vdGluZyB0aGF0IElzcmFlbCdz',
    'IGZpcnN0IGludmFzaW9uIG9mIExlYmFub24gaW4gMTk3OCB3YXMgbmFtZWQsIHdpdGhvdXQgaXJvbnksIE9wZXJhdGlvbiBM',
    'aXRhbmkuIE1pbGl0YXJ5IGNhbXBhaWducyBhcmUgcmFyZWx5IG5hbWVkIGFyYml0cmFyaWx5LiBUaGUgcml2ZXIgaGFzIGJl',
    'ZW4gYSBzdHJhdGVnaWMgb2JqZWN0aXZlIGZvciBkZWNhZGVzIOKAlCB2YWx1ZWQgbm90IG9ubHkgZm9yIHdoYXQgaXQgZGVu',
    'aWVzIGFybWVkIG1vdmVtZW50cywgYnV0IGZvciB3aGF0IGNvbnRyb2xsaW5nIGl0IGNvbmZlcnM6IHdhdGVyIHJlc291cmNl',
    'cywgdGVycml0b3JpYWwgZGVwdGgsIGFuZCBhIGJ1ZmZlciB0aGF0LCBpZiBoZWxkIGxvbmcgZW5vdWdoLCBiZWNvbWVzIGEg',
    'ZmFpdCBhY2NvbXBsaS48L3A+XG48cD5Jc3JhZWwgbWFpbnRhaW5lZCBhbiBvY2N1cGF0aW9uIG9mIHNvdXRoZXJuIExlYmFu',
    'b24gZnJvbSAxOTgyIHVudGlsIHRoZSB5ZWFyIDIwMDAg4oCUIGVpZ2h0ZWVuIHllYXJzIOKAlCB1bmRlciBuZWFybHkgaWRl',
    'bnRpY2FsIGp1c3RpZmljYXRpb25zIHRvIHRob3NlIG9mZmVyZWQgdG9kYXkuIFRoYXQgb2NjdXBhdGlvbiBlbmRlZCBub3Qg',
    'dGhyb3VnaCBhIG5lZ290aWF0ZWQgZGlzYXJtYW1lbnQgb2YgTGViYW5lc2UgcmVzaXN0YW5jZSwgYnV0IHRocm91Z2ggc3Vz',
    'dGFpbmVkIGd1ZXJyaWxsYSBwcmVzc3VyZSB0aGF0IG1hZGUgdGhlIGNvc3Qgb2Ygc3RheWluZyB1bnRlbmFibGUuIFRoZSBm',
    'b3JjZSB0aGF0IGRyb3ZlIElzcmFlbCBvdXQgaW4gMjAwMCB3YXMgSGV6Ym9sbGFoLiBCdXQgaGVyZSBpcyB3aGF0IGlzIHJh',
    'cmVseSBhY2tub3dsZWRnZWQ6IEhlemJvbGxhaCB3YXMgbm90IHRoZSBiZWdpbm5pbmcgb2YgTGViYW5lc2UgcmVzaXN0YW5j',
    'ZS4gSXQgd2FzIHRoZSBsYXRlc3QgaXRlcmF0aW9uIG9mIGl0LjwvcD5cbjxwPkFybWVkIHJlc2lzdGFuY2UgaW4gc291dGhl',
    'cm4gTGViYW5vbiBwcmVkYXRlcyBIZXpib2xsYWggYnkgZGVjYWRlcy4gVGhlIFBhbGVzdGluZSBMaWJlcmF0aW9uIE9yZ2Fu',
    'aXphdGlvbiAoUExPKSBvcGVyYXRlZCBmcm9tIExlYmFuZXNlIHRlcnJpdG9yeSBhZ2FpbnN0IElzcmFlbCBmcm9tIDE5Njgg',
    'b253YXJkLiBUaGUgQW1hbCBtb3ZlbWVudCDigJQgZm91bmRlZCBpbiAxOTczIGFzIHRoZSBwb2xpdGljYWwgdm9pY2Ugb2Yg',
    'TGViYW5vbidzIGRpc3Bvc3Nlc3NlZCBTaGlhIGNvbW11bml0eSDigJQgZm9ybWVkIGl0cyBtaWxpdGFyeSB3aW5nIGluIDE5',
    'NzUsIGFuZCBzYXcgaXRzIHJhbmtzIHN3ZWxsIHRvIDE0LDAwMCBmaWdodGVycyBhZnRlciBJc3JhZWwncyAxOTc4IGludmFz',
    'aW9uIGRpc3BsYWNlZCAzMDAsMDAwIFNoaWEgZnJvbSB0aGUgc291dGguIFdoZW4gSXNyYWVsIGludmFkZWQgaW4gMTk4MiBh',
    'bmQgb2NjdXBpZWQgQmVpcnV0LCB0aGUgTGViYW5lc2UgTmF0aW9uYWwgUmVzaXN0YW5jZSBGcm9udCB3YXMgYm9ybiB3aXRo',
    'aW4gd2Vla3Mg4oCUIGEgYnJvYWQgY29hbGl0aW9uIG9mIExlYmFuZXNlIGZhY3Rpb25zIHRoYXQgY2FycmllZCBvdXQgb3Zl',
    'ciAxLDAwMCBvcGVyYXRpb25zIGFnYWluc3QgSXNyYWVsaSBmb3JjZXMgaW4gaXRzIGZpcnN0IHR3byB5ZWFycyBhbG9uZSwg',
    'dHVybmluZyBzb3V0aGVybiBMZWJhbm9uIGludG8gd2hhdCBvbmUgY29udGVtcG9yYXJ5IGFjY291bnQgZGVzY3JpYmVkIGFz',
    'IFwiYSBxdWFnbWlyZSBmb3IgdGhlIG1vc3QgcG93ZXJmdWwgYXJtZWQgZm9yY2VzIGluIHRoZSBNaWRkbGUgRWFzdC5cIiBI',
    'ZXpib2xsYWggaXRzZWxmIGVtZXJnZWQgZnJvbSB0aGUgd3JlY2thZ2Ugb2YgdGhhdCBpbnZhc2lvbiwgdHJhaW5lZCBhbmQg',
    'c3VwcG9ydGVkIGJ5IElyYW4sIGJ1dCByb290ZWQgaW4gdGhlIHNhbWUgTGViYW5lc2UgU2hpYSBwb3B1bGF0aW9uIHRoYXQg',
    'aGFkIGFscmVhZHkgYmVlbiByZXNpc3Rpbmcgb2NjdXBhdGlvbiBmb3IgeWVhcnMgdW5kZXIgQW1hbCBhbmQgdGhlIE5hdGlv',
    'bmFsIFJlc2lzdGFuY2UgRnJvbnQuPC9wPlxuPHA+VGhpcyBpcyB0aGUgY2VudHJhbCBpcm9ueSB0aGF0IHBvbGljeW1ha2Vy',
    'cyBjb25zaXN0ZW50bHkgZGVjbGluZSB0byByZWNrb24gd2l0aDogb2NjdXBhdGlvbiwgaW4gTGViYW5vbidzIG1vZGVybiBo',
    'aXN0b3J5LCBoYXMgbm90IHN1cHByZXNzZWQgYXJtZWQgcmVzaXN0YW5jZS4gSXQgaGFzIGdlbmVyYXRlZCBpdCDigJQgaW4g',
    'c3VjY2Vzc2l2ZSB3YXZlcywgZWFjaCBvbmUgbW9yZSBvcmdhbml6ZWQgYW5kIG1vcmUgY2FwYWJsZSB0aGFuIHRoZSBsYXN0',
    'LjwvcD5cbjxoMj5UaGUgUXVlc3Rpb24gVGhhdCBHb2VzIFVuYXNrZWQ8L2gyPlxuPHA+QW5hbHlzdHMgYW5kIG9mZmljaWFs',
    'cyBkZWJhdGUgYXQgbGVuZ3RoIHdoZXRoZXIgSGV6Ym9sbGFoIGNhbiBiZSBtaWxpdGFyaWx5IGRlZmVhdGVkLCBkZWdyYWRl',
    'ZCwgb3IgZGlzbWFudGxlZC4gRmFyIGZld2VyIGFzayB0aGUgZm9sbG93LW9uIHF1ZXN0aW9uOiBhbmQgdGhlbiB3aGF0Pzwv',
    'cD5cbjxwPkxlYmFub24gaXMgYSBjb3VudHJ5IHRoYXQgaGFzIHN1cnZpdmVkIGEgY2l2aWwgd2FyLCBtdWx0aXBsZSBJc3Jh',
    'ZWxpIGludmFzaW9ucywgU3lyaWFuIG9jY3VwYXRpb24sIHBvbGl0aWNhbCBhc3Nhc3NpbmF0aW9uLCBlY29ub21pYyBjb2xs',
    'YXBzZSwgYW5kIGEgcG9ydCBleHBsb3Npb24gdGhhdCBsZXZlbGVkIGEgc2lnbmlmaWNhbnQgYXJlYSBvZiBpdHMgY2FwaXRh',
    'bCBjaXR5LiBJdHMgcG9wdWxhdGlvbiBpcyBub3QgcGFzc2l2ZS4gSXRzIGdlb2dyYXBoeSDigJQgbW91bnRhaW5vdXMsIGZy',
    'YWN0dXJlZCwgZGlmZmljdWx0IHRvIGhvbGQg4oCUIGhhcyBjb25mb3VuZGVkIG9jY3VweWluZyBhcm1pZXMgZm9yIGNlbnR1',
    'cmllcy4gVGhlIG5vdGlvbiB0aGF0IGEgbWlsaXRhcnkgY2FtcGFpZ24gc3VmZmljaWVudCB0byBkaXNtYW50bGUgb25lIG9y',
    'Z2FuaXplZCByZXNpc3RhbmNlIG1vdmVtZW50IHdvdWxkIGFsc28gcGVybWFuZW50bHkgZXh0aW5ndWlzaCB0aGUgY29uZGl0',
    'aW9ucyB0aGF0IHByb2R1Y2Ugc3VjaCBtb3ZlbWVudHMgaXMgbm90IGEgc3RyYXRlZ2ljIGFyZ3VtZW50LiBJdCBpcyBhIHdp',
    'c2guPC9wPlxuPHA+SWYgSGV6Ym9sbGFoIHdlcmUgdG8gYmUgZnVsbHkgZGlzbWFudGxlZCB0b21vcnJvdyDigJQgaXRzIHdl',
    'YXBvbnMgc2VpemVkLCBpdHMgbGVhZGVyc2hpcCBraWxsZWQsIHNjYXR0ZXJlZCwgaXRzIGluZnJhc3RydWN0dXJlIGxldmVs',
    'ZWQg4oCUIHRoZSBvY2N1cGF0aW9uIG9mIHNvdXRoZXJuIExlYmFub24gd291bGQgbm90IHRoZXJlYnkgYmVjb21lIG1vcmUg',
    'YWNjZXB0YWJsZSB0byB0aG9zZSBsaXZpbmcgdW5kZXIgaXQuIFRoZSBkaXNwbGFjZW1lbnQgb2YgaHVuZHJlZHMgb2YgdGhv',
    'dXNhbmRzIG9mIExlYmFuZXNlIGNpdmlsaWFucywgdGhlIGRlc3RydWN0aW9uIG9mIHZpbGxhZ2VzLCB0aGUgY3V0dGluZyBv',
    'ZmYgb2YgdGhlIHNvdXRoIGZyb20gdGhlIHJlc3Qgb2YgdGhlIGNvdW50cnkgYnkgdGhlIHN5c3RlbWF0aWMgZGVtb2xpdGlv',
    'biBvZiBicmlkZ2VzIG92ZXIgdGhlIExpdGFuaTogdGhlc2UgYXJlIG5vdCBjb25kaXRpb25zIHRoYXQgcHJvZHVjZSByZWNv',
    'bmNpbGlhdGlvbi4gVGhleSBhcmUgY29uZGl0aW9ucyB0aGF0IHByb2R1Y2UgdGhlIG5leHQgZ2VuZXJhdGlvbiBvZiByZXNp',
    'c3RhbmNlLjwvcD5cbjxwPkhpc3RvcnkgZG9lcyBub3QgcmVwZWF0IGl0c2VsZiBtZWNoYW5pY2FsbHksIGJ1dCBpdCBkb2Vz',
    'IG9mZmVyIHBhdHRlcm5zLiBSZXNpc3RhbmNlIG1vdmVtZW50cyBhcmUgbm90IHNpbXBseSBvcmdhbml6YXRpb25zLiBUaGV5',
    'IGFyZSByZXNwb25zZXMgdG8gY29uZGl0aW9ucy4gRWxpbWluYXRlIHRoZSBvcmdhbml6YXRpb24gd2hpbGUgc3VzdGFpbmlu',
    'ZyB0aGUgY29uZGl0aW9ucywgYW5kIHlvdSBoYXZlIG5vdCBzb2x2ZWQgdGhlIHByb2JsZW0uIFlvdSBoYXZlIHJlc3RhcnRl',
    'ZCB0aGUgY2xvY2suPC9wPlxuPGgyPlRoZSBQcmVjZWRlbnQgVGhhdCBJcyBCZWluZyBEZWxpYmVyYXRlbHkgSWdub3JlZDwv',
    'aDI+XG48cD5CZWZvcmUgZXhhbWluaW5nIHdoYXQgYSBkdXJhYmxlIHNldHRsZW1lbnQgcmVxdWlyZXMsIGl0IGlzIHdvcnRo',
    'IGV4YW1pbmluZyB3aGF0IHRoZSBoaXN0b3JpY2FsIHJlY29yZCBhbHJlYWR5IHRlbGxzIHVzIGFib3V0IGhvdyBMZWJhbm9u',
    'J3MgY29uZmxpY3RzIGhhdmUgYWN0dWFsbHkgYmVlbiByZXNvbHZlZCDigJQgYmVjYXVzZSB0aGUgYW5zd2VyIGlzIG1vcmUg',
    'aW5zdHJ1Y3RpdmUgdGhhbiBwb2xpY3ltYWtlcnMgY2FyZSB0byBhZG1pdC48L3A+XG48cD5UaGUgMjAwNiB3YXIgYmV0d2Vl',
    'biBJc3JhZWwgYW5kIEhlemJvbGxhaCBsYXN0ZWQgMzQgZGF5cyBhbmQgZW5kZWQgbm90IHdpdGggYSBtaWxpdGFyeSB2aWN0',
    'b3IsIGJ1dCB0aHJvdWdoIFVOIFNlY3VyaXR5IENvdW5jaWwgUmVzb2x1dGlvbiAxNzAxLCBhZG9wdGVkIHVuYW5pbW91c2x5',
    'IG9uIEF1Z3VzdCAxMSwgMjAwNi4gVGhlIHJlc29sdXRpb24gY2FsbGVkIGZvciBhbiBpbW1lZGlhdGUgY2Vhc2VmaXJlLCB0',
    'aGUgd2l0aGRyYXdhbCBvZiBJc3JhZWxpIGZvcmNlcywgdGhlIGRlcGxveW1lbnQgb2YgTGViYW5lc2UgdHJvb3BzIGFuZCBh',
    'biBleHBhbmRlZCBVTklGSUwgcGVhY2VrZWVwaW5nIGZvcmNlIG9mIHVwIHRvIDE1LDAwMCB0byBzb3V0aGVybiBMZWJhbm9u',
    'LCBhbmQgdGhlIGVzdGFibGlzaG1lbnQgb2YgYSBidWZmZXIgem9uZSBiZXR3ZWVuIHRoZSBMaXRhbmkgUml2ZXIgYW5kIHRo',
    'ZSBCbHVlIExpbmUg4oCUIGZyZWUgb2YgdW5hdXRob3JpemVkIGFybWVkIHBlcnNvbm5lbC4gVGhlIEJsdWUgTGluZSBpdHNl',
    'bGYgaXMgbm90IGEgZm9ybWFsIGludGVybmF0aW9uYWwgYm9yZGVyIGJ1dCBhIDEyMC1raWxvbWV0ZXIgdGVtcG9yYXJ5IGxp',
    'bmUgb2Ygd2l0aGRyYXdhbCBzZXQgYnkgdGhlIFVOIGluIDIwMDAsIG9yaWdpbmFsbHkgZHJhd24gdG8gY29uZmlybSB0aGUg',
    'SXNyYWVsaSBkZXBhcnR1cmUgZnJvbSBzb3V0aGVybiBMZWJhbm9uIGZvbGxvd2luZyB0aGUgZWlnaHRlZW4teWVhciBvY2N1',
    'cGF0aW9uLiBJdCBoYXMgc2VydmVkIGFzIHRoZSByZWZlcmVuY2UgcG9pbnQgZm9yIGV2ZXJ5IHN1YnNlcXVlbnQgbmVnb3Rp',
    'YXRpb24g4oCUIGFuZCBldmVyeSBzdWJzZXF1ZW50IHZpb2xhdGlvbi48L3A+XG48cD5DcnVjaWFsbHksIGFsbCBuZWdvdGlh',
    'dGlvbnMgd2VyZSBmb3JtYWxseSBjb25kdWN0ZWQgd2l0aCB0aGUgTGViYW5lc2UgZ292ZXJubWVudC4gSGV6Ym9sbGFoIHdh',
    'cyBuZXZlciBhIHBhcnR5IGF0IHRoZSB0YWJsZSBpbiBuYW1lLiBCdXQgaXQgd2FzIGFsd2F5cyBhIHBhcnR5IGluIGZhY3Qu',
    'IFRoaXMgcGF0dGVybiDigJQgZm9ybWFsIGVuZ2FnZW1lbnQgd2l0aCBCZWlydXQsIGRlIGZhY3RvIGFja25vd2xlZGdtZW50',
    'IG9mIEhlemJvbGxhaCdzIHJvbGUg4oCUIGlzIG5vdCBhIGRpcGxvbWF0aWMgYW5vbWFseS4gSXQgaXMgdGhlIHJlYWxpdHkg',
    'b2YgTGViYW5lc2UgcG9saXRpY2FsIGdlb2dyYXBoeSwgYW5kIGV2ZXJ5IG1lZGlhdG9yIHdobyBoYXMgc3VjY2VlZGVkIGhh',
    'cyB1bmRlcnN0b29kIGl0LjwvcD5cbjxwPlRoZSBtb3N0IGNvbXBlbGxpbmcgcHJvb2YgY2FtZSBpbiBPY3RvYmVyIDIwMjIs',
    'IHdoZW4gdGhlIFVuaXRlZCBTdGF0ZXMgYnJva2VyZWQgdGhlIGZpcnN0LWV2ZXIgbWFyaXRpbWUgYm9yZGVyIGFncmVlbWVu',
    'dCBiZXR3ZWVuIElzcmFlbCBhbmQgTGViYW5vbiDigJQgdGhlIG9ubHkgaW50ZXJuYXRpb25hbGx5IHJlY29nbml6ZWQsIHBl',
    'cm1hbmVudGx5IGRlbWFyY2F0ZWQgYm91bmRhcnkgYmV0d2VlbiB0aGUgdHdvIGNvdW50cmllcywgd2hpY2ggcmVtYWluIHRl',
    'Y2huaWNhbGx5IGluIGEgc3RhdGUgb2Ygd2FyLiBUaGUgYWdyZWVtZW50IHdhcyBuZWdvdGlhdGVkIHdpdGggdGhlIExlYmFu',
    'ZXNlIGdvdmVybm1lbnQuIEJ1dCB3aGF0IGRyb3ZlIGl0IHRvIGNvbXBsZXRpb24sIGFuZCB3aGF0IHNoYXBlZCBpdHMgdGVy',
    'bXMsIHdhcyBIZXpib2xsYWguIFRoZSBlbnRpcmUgYWdyZWVtZW50IHdhcyB2ZXR0ZWQgYnkgdGhlIG9yZ2FuaXphdGlvbidz',
    'IHRvcCBsZWFkZXJzaGlwIHByaW9yIHRvIGFwcHJvdmFsLCBhbmQgTmFzcmFsbGFoIHBlcnNvbmFsbHkgcHJvdmlkZWQgc2Vj',
    'dXJpdHkgZ3VhcmFudGVlcyB0aGF0IElzcmFlbCdzIEthcmlzaCBnYXMgZmllbGQgd291bGQgbm90IGJlIHRhcmdldGVkLiBD',
    'cml0aWNhbGx5LCBiZWZvcmUgSGV6Ym9sbGFoJ3MgaW50ZXJ2ZW50aW9uLCBzb21lIExlYmFuZXNlIHBvbGl0aWNhbCBmaWd1',
    'cmVzIGhhbmRsaW5nIHRoZSBmaWxlIHdlcmUgcHJlcGFyZWQgdG8gd2FpdmUgc2lnbmlmaWNhbnQgbWFyaXRpbWUgcmlnaHRz',
    'IOKAlCBhY2NlcHRpbmcgbGVzcyB0aGFuIHdoYXQgTGViYW5vbidzIG93biBnb3Zlcm5tZW50IGhhZCBmb3JtYWxseSBjbGFp',
    'bWVkLiBJdCB3YXMgSGV6Ym9sbGFoJ3MgY29lcmNpdmUgcHJlc3N1cmUgdGhhdCBzdGlmZmVuZWQgdGhlIExlYmFuZXNlIHBv',
    'c2l0aW9uIGFuZCBwcm9kdWNlZCBhbiBvdXRjb21lIExlYmFub24ncyBnb3Zlcm5tZW50IG1pZ2h0IG5vdCBoYXZlIHNlY3Vy',
    'ZWQgYWxvbmUuPC9wPlxuPHA+VGhlIG1ldGhvZCBvZiBzaWduaW5nIHJlZmxlY3RzIHRoaXMgcmVhbGl0eSBwcmVjaXNlbHk6',
    'IGJlY2F1c2UgSXNyYWVsIGFuZCBMZWJhbm9uIGhhdmUgbm8gZGlwbG9tYXRpYyByZWxhdGlvbnMsIHRoZSBhZ3JlZW1lbnQg',
    'Y2FtZSBhcyBzZXBhcmF0ZSBleGNoYW5nZXMgb2YgbGV0dGVycyBiZXR3ZWVuIHRoZSBVUyBhbmQgZWFjaCBwYXJ0eSwgd2l0',
    'aCBib3RoIHNpZGVzIHNpZ25pbmcgaW4gc2VwYXJhdGUgcm9vbXMgYXQgVU5JRklMIGhlYWRxdWFydGVycyBpbiBOYXFvdXJh',
    'LiBMZWJhbm9uJ3MgcHJlc2lkZW50LCBwcmltZSBtaW5pc3RlciwgYW5kIHBhcmxpYW1lbnRhcnkgc3BlYWtlciBlbmRvcnNl',
    'ZCBpdC4gU28gZGlkIEhlemJvbGxhaC48L3A+XG48cD5UaGlzIGlzIHRoZSBpbmNvbnZlbmllbnQgdHJ1dGggdGhlIGN1cnJl',
    'bnQgbWlsaXRhcnkgY2FtcGFpZ24gcmVmdXNlcyB0byByZWNrb24gd2l0aDogaW4gZXZlcnkgaW5zdGFuY2Ugd2hlcmUgTGVi',
    'YW5vbiBhbmQgSXNyYWVsIGhhdmUgcmVhY2hlZCBhbnkgZHVyYWJsZSBhcnJhbmdlbWVudCDigJQgMTcwMSwgdGhlIEJsdWUg',
    'TGluZSwgdGhlIDIwMjIgbWFyaXRpbWUgYm91bmRhcnkg4oCUIHRoZSBMZWJhbmVzZSBnb3Zlcm5tZW50IHNlcnZlZCBhcyB0',
    'aGUgZm9ybWFsIHBhcnRuZXIgd2hpbGUgcmVzaXN0YW5jZSBmb3JjZXMgb3BlcmF0ZWQgYXMgYW4gZXNzZW50aWFsIGJhY2tn',
    'cm91bmQgcmVhbGl0eS4gVGhlIGZhbnRhc3kgdGhhdCBMZWJhbm9uIGNhbiBiZSBuZWdvdGlhdGVkIHdpdGggd2hpbGUgaXRz',
    'IG1vc3QgcG93ZXJmdWwgaW50ZXJuYWwgYWN0b3IgaXMgc2ltcGx5IGVsaW1pbmF0ZWQgaGFzIG5vIHByZWNlZGVudCBpbiBz',
    'dWNjZXNzLiBJdCBoYXMgY29uc2lkZXJhYmxlIHByZWNlZGVudCBpbiBmYWlsdXJlLjwvcD5cbjxwPlRoZSBsZXNzb24gaXMg',
    'bm90IHRoYXQgSGV6Ym9sbGFoIHNob3VsZCBiZSByZXdhcmRlZCBvciBsZWdpdGltaXplZCB1bmNvbmRpdGlvbmFsbHkuIFRo',
    'ZSBsZXNzb24gaXMgdGhhdCBkdXJhYmxlIGFncmVlbWVudHMgaW4gTGViYW5vbiBoYXZlIGFsd2F5cyByZXF1aXJlZCBhY2tu',
    'b3dsZWRnaW5nIHRoZSBwb2xpdGljYWwgbGFuZHNjYXBlIGFzIGl0IGFjdHVhbGx5IGV4aXN0cyDigJQgbm90IGFzIG91dHNp',
    'ZGVycyB3aXNoIGl0IHdlcmUuPC9wPlxuPGgyPldoYXQgYSBEdXJhYmxlIFNldHRsZW1lbnQgV291bGQgQWN0dWFsbHkgUmVx',
    'dWlyZTwvaDI+XG48cD5Ob25lIG9mIHRoaXMgaXMgdG8gYXJndWUgdGhhdCBIZXpib2xsYWggcHJlc2VudHMgbm8gZ2VudWlu',
    'ZSBzZWN1cml0eSBjaGFsbGVuZ2UgdG8gbm9ydGhlcm4gSXNyYWVsLCBvciB0aGF0IElyYW5pYW4gaW5mbHVlbmNlIGluIExl',
    'YmFub24gaXMgYmVuaWduLiBUaGVzZSBhcmUgcmVhbCBjb25jZXJucywgYW5kIGFueSBzZXJpb3VzIGFuYWx5c2lzIG11c3Qg',
    'YWNrbm93bGVkZ2UgdGhlbS4gQnV0IHNlY3VyaXR5IGZvciBJc3JhZWxpIGNpdmlsaWFucyBpbiB0aGUgbm9ydGggYW5kIHNv',
    'dmVyZWlnbnR5IGFuZCBkaWduaXR5IGZvciBMZWJhbmVzZSBjaXZpbGlhbnMgaW4gdGhlIHNvdXRoIGFyZSBub3QgaW5oZXJl',
    'bnRseSBpbmNvbXBhdGlibGUuIFRoZXkgYXJlIGluY29tcGF0aWJsZSBvbmx5IHdpdGggYSBmcmFtZXdvcmsgcHJlbWlzZWQg',
    'b24gcGVybWFuZW50IG1pbGl0YXJ5IGNvbnRyb2wgb2YgTGViYW5lc2UgdGVycml0b3J5LjwvcD5cbjxwPkEgc2V0dGxlbWVu',
    'dCB3aXRoIGFueSBwcm9zcGVjdCBvZiBkdXJhYmlsaXR5IHdvdWxkIG5lZWQgdG8gYWRkcmVzczogTGViYW5lc2Ugc292ZXJl',
    'aWdudHkgb3ZlciBpdHMgb3duIHNvdXRoLCB0aGUgcmV0dXJuIG9mIGRpc3BsYWNlZCBjaXZpbGlhbnMsIGEgdGltZWxpbmUg',
    'Zm9yIElzcmFlbGkgbWlsaXRhcnkgd2l0aGRyYXdhbCwgYW5kIOKAlCBjcnVjaWFsbHkg4oCUIHRoZSB1bmRlcmx5aW5nIHBv',
    'bGl0aWNhbCBhbmQgZWNvbm9taWMgZ3JpZXZhbmNlcyB0aGF0IGhhdmUgbWFkZSBzb3V0aGVybiBMZWJhbm9uIGZlcnRpbGUg',
    'Z3JvdW5kIGZvciBhcm1lZCBtb3ZlbWVudHMgZm9yIGZpZnR5IHllYXJzLiBVTiBTZWN1cml0eSBDb3VuY2lsIFJlc29sdXRp',
    'b24gMTcwMSwgd2hpY2ggZW5kZWQgdGhlIDIwMDYgd2FyLCBvdXRsaW5lZCBzdWNoIGEgZnJhbWV3b3JrLiBJdCB3YXMgbmV2',
    'ZXIgaW1wbGVtZW50ZWQuPC9wPlxuPHA+SGVyZSBpcyBhIHF1ZXN0aW9uIHRoYXQgaGFzIGdvbmUgbGFyZ2VseSB1bmFza2Vk',
    'IGluIFdlc3Rlcm4gZGlwbG9tYXRpYyBjaXJjbGVzOiBpZiBhIG1pbGl0YXJ5LWZyZWUgYnVmZmVyIHpvbmUgaW4gc291dGhl',
    'cm4gTGViYW5vbiBpcyBhIGxlZ2l0aW1hdGUgc2VjdXJpdHkgZGVtYW5kIOKAlCBhbmQgdGhlcmUgaXMgYSByZWFzb25hYmxl',
    'IGNhc2UgdGhhdCBpdCBpcyDigJQgdGhlbiB3aHkgaGFzIG5vIHBhcnR5IGZvcm1hbGx5IGRlbWFuZGVkIHRoZSBzYW1lIHJl',
    'Y2lwcm9jYWwgYXJyYW5nZW1lbnQgaW4gbm9ydGhlcm4gSXNyYWVsPyBJZiB0aGUgbG9naWMgb2YgZGVtaWxpdGFyaXphdGlv',
    'biBpcyBzb3VuZCwgaXQgaXMgc291bmQgb24gYm90aCBzaWRlcyBvZiBhIGJvcmRlci4gQSBnZW51aW5lIHBlYWNlIGFyY2hp',
    'dGVjdHVyZSB3b3VsZCBpbmNsdWRlIG11dHVhbCBidWZmZXIgem9uZXM6IHNvdXRoZXJuIExlYmFub24gZnJlZSBvZiBhcm1l',
    'ZCBub24tc3RhdGUgYWN0b3JzLCBhbmQgbm9ydGhlcm4gSXNyYWVsJ3MgYm9yZGVyIGNvbW11bml0aWVzIGVxdWFsbHkgc3Vi',
    'amVjdCB0byB2ZXJpZmlhYmxlIHJlc3RyYWludHMgb24gbWlsaXRhcnkgaW5mcmFzdHJ1Y3R1cmUgdGhhdCB0aHJlYXRlbnMg',
    'TGViYW5lc2UgdGVycml0b3J5LiBUaGlzIGlzIG5vdCBhIHJhZGljYWwgcHJvcG9zaXRpb24uIFRoZSAxOTc5IEVneXB0LUlz',
    'cmFlbCBwZWFjZSB0cmVhdHkgaW5jbHVkZWQgYSBkZW1pbGl0YXJpemVkIFNpbmFpIHByZWNpc2VseSBiZWNhdXNlIGJvdGgg',
    'cGFydGllcyByZWNvZ25pemVkIHRoYXQgc2VjdXJpdHkgZGVtYW5kcyBjdXQgaW4gYm90aCBkaXJlY3Rpb25zLiBUaGUgcHJp',
    'bmNpcGxlIG9mIHJlY2lwcm9jaXR5IGlzIG5vdCBhIGNvbmNlc3Npb24g4oCUIGl0IGlzIHRoZSBmb3VuZGF0aW9uIG9mIGFu',
    'eSBhZ3JlZW1lbnQgdGhhdCBib3RoIHNpZGVzIGNhbiBhY3R1YWxseSBsaXZlIHdpdGguIFRoYXQgdGhpcyBkZW1hbmQgaGFz',
    'IG5ldmVyIGJlZW4gc2VyaW91c2x5IHRhYmxlZCBieSBMZWJhbm9uJ3MgaW50ZXJuYXRpb25hbCBhZHZvY2F0ZXMsIG9yIHBy',
    'ZXNzZWQgYnkgYW55IG1lZGlhdGluZyBwb3dlciwgc3BlYWtzIHRvIHRoZSBwcm9mb3VuZCBhc3ltbWV0cnkgaW4gaG93IHRo',
    'aXMgY29uZmxpY3QgaXMgYmVpbmcgZnJhbWVkIGFuZCBtYW5hZ2VkLiBBIHBlYWNlIHByb2Nlc3MgdGhhdCBhc2tzIG9uZSBz',
    'aWRlIHRvIGRpc2FybSB3aGlsZSB0aGUgb3RoZXIgZmFjZXMgbm8gZXF1aXZhbGVudCBjb25zdHJhaW50IGlzIG5vdCBhIHBl',
    'YWNlIHByb2Nlc3MuIEl0IGlzIGEgdGVybXMtb2Ytc3VycmVuZGVyIGRvY3VtZW50IGRyZXNzZWQgaW4gZGlwbG9tYXRpYyBs',
    'YW5ndWFnZS48L3A+XG48cD5UaGUgY3VycmVudCB0cmFqZWN0b3J5IOKAlCBkZWxheWVkIGRpcGxvbWFjeSwgZXhwYW5kaW5n',
    'IG9jY3VwYXRpb24sIGxhbmQgZGVjbGFyZWQgYSBcInNlY3VyaXR5IHpvbmVcIiB3aXRoIG5vIHRpbWVsaW5lIGZvciByZXR1',
    'cm4g4oCUIGRvZXMgbm90IGxlYWQgdG93YXJkIHRoYXQgc2V0dGxlbWVudC4gSXQgbGVhZHMgdG93YXJkIGEgcmVwZXRpdGlv',
    'biBvZiAxOTgyOiBhbiBvY2N1cGF0aW9uIHRoYXQgZ2VuZXJhdGVzIHRoZSB2ZXJ5IHJlc2lzdGFuY2UgaXQgY2xhaW1zIHRv',
    'IHByZXZlbnQsIHN1c3RhaW5lZCB1bnRpbCB0aGUgY29zdCBiZWNvbWVzIHBvbGl0aWNhbGx5IHVuYmVhcmFibGUsIGFuZCBj',
    'b25jbHVkZWQgd2l0aG91dCBoYXZpbmcgcmVzb2x2ZWQgYW55dGhpbmcuPC9wPlxuPGgyPkEgRmluYWwgTm90ZSBvbiBBY2Nv',
    'dW50YWJpbGl0eTwvaDI+XG48cD5BbWVyaWNhbiBwb2xpY3kgaW4gdGhpcyBtb21lbnQgZGVzZXJ2ZXMgZGlyZWN0IHNjcnV0',
    'aW55LiBUaGUgVW5pdGVkIFN0YXRlcyBicm9rZXJlZCBhIGNlYXNlZmlyZSB3aXRoIElyYW4gYW5kIHRoZW4gZXh0ZW5kZWQg',
    'bGF0aXR1ZGUgdG8gaXRzIGNsb3Nlc3QgYWxseSB0byBjb25kdWN0IGFuIGVzY2FsYXRpbmcgbWlsaXRhcnkgY2FtcGFpZ24g',
    'aW4gTGViYW5vbiB0aGF0IElyYW4gaGFzIGV4cGxpY2l0bHkgbmFtZWQgYXMgYSBkZWFsYnJlYWtlci4gVGhlIGFkbWluaXN0',
    'cmF0aW9uIGhhcyB0b2xkIElzcmFlbCBpdCBzdXBwb3J0cyBcImZyZWVkb20gb2YgYWN0aW9uIGFnYWluc3QgdGhyZWF0cyBv',
    'biBhbGwgZnJvbnRzLCBpbmNsdWRpbmcgTGViYW5vbixcIiBldmVuIGFzIHRoYXQgZnJlZWRvbSBvZiBhY3Rpb24gZGlyZWN0',
    'bHkgdW5kZXJtaW5lcyB0aGUgZGlwbG9tYXRpYyBmcmFtZXdvcmsgdGhlIFVTIGl0c2VsZiBjb25zdHJ1Y3RlZC48L3A+XG48',
    'cD5UaGVzZSBhcmUgbm90IHBhc3NpdmUgY29udHJhZGljdGlvbnMuIFRoZXkgYXJlIGNob2ljZXMuIEFuZCB0aGV5IHdpbGwg',
    'aGF2ZSBjb25zZXF1ZW5jZXMg4oCUIG5vdCBvbmx5IGZvciBMZWJhbm9uIGFuZCBJcmFuLCBidXQgZm9yIHdoYXRldmVyIHBv',
    'c3QtY29uZmxpY3Qgb3JkZXIgdGhlIFVuaXRlZCBTdGF0ZXMgZXZlbnR1YWxseSBob3BlcyB0byBjbGFpbSBjcmVkaXQgZm9y',
    'IGJyb2tlcmluZy48L3A+XG48cD5UaGUgaGFyZCBxdWVzdGlvbiDigJQgd2hhdCBjb21lcyBhZnRlciBIZXpib2xsYWgsIGlm',
    'IGl0IGlzIGV2ZXIgdHJ1bHkgZGlzbWFudGxlZCDigJQgd2lsbCBub3Qgd2FpdCBmb3IgYSBjb252ZW5pZW50IG1vbWVudCB0',
    'byBiZSBhbnN3ZXJlZC4gSXQgaXMgYmVpbmcgYW5zd2VyZWQgbm93LCBvbiB0aGUgZ3JvdW5kLCBieSB0aGUgY29uZGl0aW9u',
    'cyBiZWluZyBjcmVhdGVkLiBUaG9zZSB3aG8gd2lsbCBsaXZlIHdpdGggdGhlIGFuc3dlciBhcmUgYWxyZWFkeSB3YXRjaGlu',
    'Zy48L3A+XG48cD5Tb3VyY2VzIGZvciB0aGlzIHBpZWNlIGluY2x1ZGUgcmVwb3J0aW5nIGZyb20gQWwgSmF6ZWVyYSwgTkJD',
    'IE5ld3MsIENOTiwgdGhlIFRpbWVzIG9mIElzcmFlbCwgQnJpdGFubmljYSdzIDIwMjYgSXJhbiB3YXIgZG9jdW1lbnRhdGlv',
    'biwgYW5kIGFuYWx5dGljYWwgY292ZXJhZ2UgZnJvbSBSb2xsaW5nIFN0b25lIE1FTkEgb24gdGhlIExpdGFuaSBSaXZlcidz',
    'IGhpc3RvcmljYWwgc2lnbmlmaWNhbmNlLjwvcD4iCn0K'
  ].join("");

  const draftJson = Utilities.newBlob(Utilities.base64Decode(encodedDraft)).getDataAsString("UTF-8");
  const draft = JSON.parse(draftJson);
  const result = importBlogDraftToPendingQueue_(draft);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function importBlogDraftToPendingQueue_(draft) {
  const sheet = getSheetByName_(BLOG_SHEET_NAME);
  const headers = getHeaders_(sheet);
  const values = sheet.getDataRange().getValues();
  const slug = slugify_(draft.slug || draft.title || "blog-draft");
  const title = String(draft.title || "").trim();

  if (!title || !String(draft.content || "").trim()) {
    throw new Error("Draft import requires a title and content.");
  }

  const existing = values
    .slice(1)
    .map((row, index) => rowToObject_(headers, row, index + 2))
    .find(item => String(item.slug || "") === slug || String(item.title || "") === title);

  if (existing) {
    return {
      result: "skipped",
      message: "A blog submission with this title or slug already exists.",
      rowNumber: existing.rowNumber,
      id: existing.id || "",
      title: existing.title || title,
      slug: existing.slug || slug,
      status: existing.status || ""
    };
  }

  const id = Utilities.getUuid();
  const now = new Date().toISOString();
  const author = draft.author && typeof draft.author === "object" ? draft.author : {};
  const images = Array.isArray(draft.images) ? draft.images.filter(Boolean) : [];
  const featureImage = String(draft.featureImage || draft.shareImage || "").trim();
  if (featureImage && !images.includes(featureImage)) images.unshift(featureImage);

  const editorNotes = [
    "Imported from local PDF draft helper. Review before approving.",
    ...(Array.isArray(draft.editorNotes) ? draft.editorNotes : [])
  ].filter(Boolean).join("\n");

  const record = {
    id,
    status: "pending",
    submittedAt: now,
    title,
    subtitle: String(draft.subtitle || draft.shareDescription || "").trim(),
    category: String(draft.category || "Opinion").trim(),
    body: String(draft.content || "").trim(),
    images: JSON.stringify(images),
    author: JSON.stringify({
      name: String(author.name || "Anonymous contributor").trim(),
      email: String(author.email || "").trim(),
      role: String(author.role || "").trim(),
      photoUrl: String(author.photoUrl || "").trim(),
      location: String(author.location || "").trim(),
      links: Array.isArray(author.links) ? author.links.map(String).filter(Boolean) : [],
      bio: String(author.bio || "").trim(),
      anonymous: author.anonymous === true
    }),
    authorName: String(author.name || "Anonymous contributor").trim(),
    contactEmail: String(author.email || "").trim(),
    anonymous: author.anonymous === true ? "true" : "false",
    editorNotes,
    slug,
    approvedAt: "",
    approvedBy: "",
    rejectedAt: "",
    rejectedBy: "",
    rejectionReason: "",
    scheduledAt: "",
    publishedAt: ""
  };

  const row = headers.map(header => record[header] ?? "");
  sheet.appendRow(row);

  return {
    result: "success",
    id,
    title,
    slug,
    status: "pending",
    message: "Draft imported into Blog_Submissions as pending. It is not published."
  };
}

function validateArticle_(article) {
  const required = ["date", "title", "link", "imageUrl", "category", "categoryColor", "source"];
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
  const path = getProps_().getProperty("ARTICLES_PATH") || "data/articles.json";

  return updateGithubFileWithRetry_(
    path,
    `Approve article: ${newArticle.title}`,
    function(currentContent) {
      if (!String(currentContent || "").trim()) {
        throw new Error(`${path} on GitHub is empty, so the approved article cannot be added.`);
      }

      let articles;
      try {
        articles = JSON.parse(currentContent);
      } catch (err) {
        throw new Error(`${path} on GitHub is not valid JSON: ${err.message}`);
      }

      if (!Array.isArray(articles)) {
        throw new Error("articles.json must be a JSON array.");
      }

      const alreadyExists = articles.some(article => article.link === newArticle.link);
      if (!alreadyExists) {
        articles.unshift(newArticle);
      }

      return JSON.stringify(articles, null, 2);
    }
  );
}

function updateGithubArticlesJsonBatch_(newArticles) {
  const path = getProps_().getProperty("ARTICLES_PATH") || "data/articles.json";
  const requestedLinks = new Set(newArticles.map(article => String(article.link || "")));

  updateGithubFileWithRetry_(
    path,
    `Approve ${newArticles.length} articles`,
    function(currentContent) {
      if (!String(currentContent || "").trim()) {
        throw new Error(`${path} on GitHub is empty, so approved articles cannot be added.`);
      }

      let articles;
      try {
        articles = JSON.parse(currentContent);
      } catch (err) {
        throw new Error(`${path} on GitHub is not valid JSON: ${err.message}`);
      }

      if (!Array.isArray(articles)) {
        throw new Error("articles.json must be a JSON array.");
      }

      const existingLinks = new Set(articles.map(article => String(article.link || "")));
      newArticles
        .filter(article => !existingLinks.has(String(article.link || "")))
        .slice()
        .reverse()
        .forEach(article => {
          existingLinks.add(String(article.link || ""));
          articles.unshift(article);
        });

      return JSON.stringify(articles, null, 2);
    }
  );

  const { currentContent } = getGithubFile_(path);
  const articles = JSON.parse(currentContent || "[]");
  const finalLinks = new Set(Array.isArray(articles) ? articles.map(article => String(article.link || "")) : []);
  const addedOrPresent = Array.from(requestedLinks).filter(link => finalLinks.has(link)).length;

  return {
    addedToGithub: addedOrPresent,
    alreadyExisted: Math.max(0, newArticles.length - addedOrPresent)
  };
}

function updateGithubFileWithRetry_(path, message, buildUpdatedContent) {
  const maxAttempts = 6;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { fileData, currentContent } = getGithubFile_(path);
      const updatedContent = buildUpdatedContent(currentContent);
      return putGithubFile_(path, fileData, updatedContent, message);
    } catch (err) {
      lastError = err;
      if (!isGithubWriteRaceError_(err) || attempt === maxAttempts) {
        throw err;
      }
      Utilities.sleep(750 * attempt);
    }
  }

  throw lastError || new Error("GitHub update failed.");
}

function isGithubWriteRaceError_(err) {
  const message = String(err && err.message ? err.message : err);
  return /GitHub PUT failed/i.test(message) && /(409|sha|does not match|is at|conflict)/i.test(message);
}

function getGithubFileContentText_(fileData, token) {
  if (fileData.content && fileData.encoding === "base64") {
    return Utilities.newBlob(
      Utilities.base64Decode(fileData.content)
    ).getDataAsString();
  }

  if (fileData.download_url) {
    const rawResponse = UrlFetchApp.fetch(fileData.download_url, {
      method: "get",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.raw"
      },
      muteHttpExceptions: true
    });

    const rawCode = rawResponse.getResponseCode();
    if (rawCode < 200 || rawCode >= 300) {
      throw new Error("GitHub raw file download failed: " + rawResponse.getContentText());
    }

    return rawResponse.getContentText();
  }

  throw new Error("GitHub did not return file content or a raw download URL.");
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
  const currentContent = getGithubFileContentText_(fileData, token);

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
    content: Utilities.base64Encode(updatedContent, Utilities.Charset.UTF_8),
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

function putGithubFileAllowCreate_(path, updatedContent, message) {
  const props = getProps_();
  const token = props.getProperty("GITHUB_TOKEN");
  const owner = props.getProperty("GITHUB_OWNER");
  const repo = props.getProperty("GITHUB_REPO");
  const branch = props.getProperty("GITHUB_BRANCH") || "main";

  let sha = "";
  const getResponse = UrlFetchApp.fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
    method: "get",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    },
    muteHttpExceptions: true
  });

  if (getResponse.getResponseCode() >= 200 && getResponse.getResponseCode() < 300) {
    sha = JSON.parse(getResponse.getContentText()).sha || "";
  }

  const putPayload = {
    message,
    content: Utilities.base64Encode(updatedContent, Utilities.Charset.UTF_8),
    branch
  };
  if (sha) putPayload.sha = sha;

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
    throw new Error("GitHub PUT failed for " + path + ": " + response.getContentText());
  }

  return JSON.parse(response.getContentText());
}

function ensureBlogPostThumbnail_(post) {
  const images = cleanUrlList_(post.images || []);
  const embeddedImage = extractFirstImageFromHtml_(post.content || post.body || "");
  const articleImage = images[0] || embeddedImage || "";
  const updated = Object.assign({}, post, { images });

  if (articleImage) {
    updated.featureImage = articleImage;
    updated.shareImage = articleImage;
    updated.generatedThumbnail = false;
    return updated;
  }

  const thumbnailBasePath = `blog/thumbnails/${slugify_(updated.slug || updated.title || updated.id || "blog-post")}`;
  const thumbnailSourcePath = `${thumbnailBasePath}.svg`;
  const thumbnailUrl = `https://echoesofgaza.org/${thumbnailBasePath}.png`;
  const svg = buildBlogPostThumbnailSvg_(updated);
  putGithubFileAllowCreate_(thumbnailSourcePath, svg, `Create blog thumbnail source: ${updated.title}`);

  updated.featureImage = thumbnailUrl;
  updated.shareImage = thumbnailUrl;
  updated.generatedThumbnail = true;
  return updated;
}

function buildBlogPostThumbnailSvg_(post) {
  const author = post.author && typeof post.author === "object" ? post.author : { name: post.author || "" };
  const authorName = cleanDisplayText_(author.name || "Echoes of Gaza contributor");
  const authorRole = cleanDisplayText_([author.role, author.location].filter(Boolean).join(" / "));
  const titleLines = wrapSvgTextLines_(cleanDisplayText_(post.title || "Untitled"), 38, 4);
  const subtitleLines = wrapSvgTextLines_(cleanDisplayText_(post.subtitle || post.shareDescription || ""), 72, 2);
  const avatarUrl = String(author.photoUrl || post.authorImg || "").trim();
  const initial = escapeHtml_(String(authorName || "E").trim().charAt(0).toUpperCase() || "E");
  const titleSvg = titleLines.map((line, index) =>
    `<text x="86" y="${346 + index * 60}" class="title">${escapeHtml_(line)}</text>`
  ).join("\n");
  const subtitleSvg = subtitleLines.map((line, index) =>
    `<text x="88" y="${580 + index * 26}" class="subtitle">${escapeHtml_(line)}</text>`
  ).join("\n");
  const avatarSvg = avatarUrl
    ? `<circle cx="158" cy="154" r="82" fill="#171717" stroke="#333" stroke-width="2"/>
       <text x="158" y="182" text-anchor="middle" class="initial">${initial}</text>
       <image href="${escapeHtml_(avatarUrl)}" x="76" y="72" width="164" height="164" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>`
    : `<circle cx="158" cy="154" r="82" fill="#171717" stroke="#333" stroke-width="2"/>
       <text x="158" y="182" text-anchor="middle" class="initial">${initial}</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeHtml_(post.title || "Echoes of Gaza blog thumbnail")}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#050505"/>
      <stop offset="0.52" stop-color="#0c0909"/>
      <stop offset="1" stop-color="#220707"/>
    </linearGradient>
    <radialGradient id="glow" cx="78%" cy="20%" r="70%">
      <stop offset="0" stop-color="#8b0000" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#8b0000" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="avatarClip">
      <circle cx="158" cy="154" r="78"/>
    </clipPath>
    <style>
      .brand { font: 700 21px Arial, sans-serif; letter-spacing: 8px; fill: #b91c1c; }
      .kicker { font: 700 16px Arial, sans-serif; letter-spacing: 5px; fill: #b4b4b4; }
      .author { font: 700 28px Arial, sans-serif; fill: #f4f4f5; }
      .role { font: 400 19px Arial, sans-serif; fill: #8c8c94; }
      .title { font: 700 52px Georgia, serif; fill: #f7f7f7; }
      .subtitle { font: 400 22px Arial, sans-serif; fill: #9b9ba3; }
      .initial { font: 700 72px Georgia, serif; fill: #f4f4f5; }
    </style>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="38" y="38" width="1124" height="554" fill="none" stroke="#252525" stroke-width="2"/>
  <line x1="86" y1="288" x2="1114" y2="288" stroke="#2a2a2e" stroke-width="2"/>
  <text x="86" y="88" class="brand">ECHOES OF GAZA</text>
  ${avatarSvg}
  <text x="276" y="146" class="kicker">VOICES</text>
  <text x="276" y="184" class="author">${escapeHtml_(authorName)}</text>
  ${authorRole ? `<text x="276" y="218" class="role">${escapeHtml_(authorRole)}</text>` : ""}
  ${titleSvg}
  ${subtitleSvg}
</svg>`;
}

function wrapSvgTextLines_(value, maxChars, maxLines) {
  const words = String(value || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let current = "";

  words.forEach(word => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  const limited = lines.slice(0, maxLines);
  if (lines.length > maxLines && limited.length) {
    limited[limited.length - 1] = limited[limited.length - 1].replace(/[.,;:!?]*$/, "") + "...";
  }
  return limited.length ? limited : ["Untitled"];
}

function updateGithubBlogPostsJson_(newPost) {
  const path = getProps_().getProperty("BLOG_POSTS_PATH") || "data/blog_posts.json";
  updateGithubFileWithRetry_(
    path,
    `Approve blog post: ${newPost.title}`,
    function(currentContent) {
      let posts = JSON.parse(currentContent || "[]");
      if (!Array.isArray(posts)) {
        posts = posts.posts || [];
      }
      if (!Array.isArray(posts)) {
        throw new Error("blog_posts.json must be a JSON array or an object with a posts array.");
      }

      posts = posts.filter(post => !blogPostIdentityMatches_(post, newPost.id, newPost.slug));
      posts.unshift(newPost);
      return JSON.stringify(posts, null, 2);
    }
  );
}

function updateGithubBlogPostPage_(post) {
  const slug = post.slug || slugify_(post.title || post.id || "blog-post");
  const legacyPath = post.path || `${slug}.html`;
  const pagePath = `blog/${legacyPath}`;
  const cleanPagePath = `blog/${slug}/index.html`;
  const appUrl = `https://echoesofgaza.org/blog?post=${encodeURIComponent(slug)}`;
  const canonicalUrl = `https://echoesofgaza.org/blog/${encodeURIComponent(slug)}/`;
  const description = escapeHtml_(post.shareDescription || post.subtitle || "");
  const title = escapeHtml_(post.title || "Echoes of Gaza Blog");
  const image = post.shareImage || post.featureImage || "https://i.postimg.cc/fT81SwN0/426559D6-9EF9-49AA-8A0B-84A3FA70B3E2.png";
  const imageMeta = blogShareImageMeta_(image);
  const author = post.author && typeof post.author === "object" ? post.author : { name: post.author || "Echoes of Gaza contributor" };
  const authorName = cleanDisplayText_(author.name || "Echoes of Gaza contributor");
  const publishedTime = isoDateTime_(post.publishedAt || post.date || new Date().toISOString()) || new Date().toISOString();
  const modifiedTime = new Date().toISOString();
  const jsonLd = safeJsonLd_({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": canonicalUrl
    },
    "headline": post.title || "Echoes of Gaza Blog",
    "description": post.shareDescription || post.subtitle || "",
    "image": image ? [image] : [],
    "datePublished": publishedTime,
    "dateModified": modifiedTime,
    "author": {
      "@type": "Person",
      "name": authorName
    },
    "publisher": {
      "@type": "Organization",
      "name": "Echoes of Gaza",
      "url": "https://echoesofgaza.org",
      "logo": {
        "@type": "ImageObject",
        "url": "https://i.postimg.cc/fT81SwN0/426559D6-9EF9-49AA-8A0B-84A3FA70B3E2.png"
      }
    }
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="author" content="${escapeHtml_(authorName)}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Echoes of Gaza">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="article:published_time" content="${escapeHtml_(publishedTime)}">
  <meta property="article:modified_time" content="${escapeHtml_(modifiedTime)}">
  <meta property="article:author" content="${escapeHtml_(authorName)}">
  <meta property="og:image" content="${escapeHtml_(image)}">
  <meta property="og:image:secure_url" content="${escapeHtml_(image)}">
  <meta property="og:image:type" content="${imageMeta.type}">
  <meta property="og:image:width" content="${imageMeta.width}">
  <meta property="og:image:height" content="${imageMeta.height}">
  <meta property="og:image:alt" content="${title} thumbnail">
  <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:image" content="${escapeHtml_(image)}">
  <script type="application/ld+json">${jsonLd}</script>
  <script>
    (function() {
      var crawler = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Applebot|Googlebot|Bingbot/i.test(navigator.userAgent || "");
      if (!crawler) window.location.replace(${JSON.stringify(appUrl)});
    })();
  </script>
</head>
<body>
  <p><a href="${appUrl}">${title}</a></p>
</body>
</html>`;

  putGithubFileAllowCreate_(pagePath, html, `Create blog post page: ${post.title}`);
  putGithubFileAllowCreate_(cleanPagePath, html, `Create clean blog post page: ${post.title}`);
}

function updateGithubSitemapForBlogPosts_(postsOverride) {
  const sitemapPath = getProps_().getProperty("SITEMAP_PATH") || "sitemap.xml";
  const { fileData, currentContent } = getGithubFile_(sitemapPath);
  const posts = Array.isArray(postsOverride) ? postsOverride : getGithubBlogPosts_().posts;
  const updatedContent = buildSitemapXml_(currentContent, posts);
  if (updatedContent.trim() === String(currentContent || "").trim()) return;
  putGithubFile_(sitemapPath, fileData, updatedContent, "Update sitemap for blog posts");
}

function buildSitemapXml_(currentContent, posts) {
  const existingEntries = parseSitemapEntries_(currentContent);
  const today = Utilities.formatDate(new Date(), "UTC", "yyyy-MM-dd");
  const byLoc = {};

  existingEntries.forEach(entry => {
    if (!/^https:\/\/echoesofgaza\.org\/blog\/[^/]+(?:\.html|\/)$/i.test(entry.loc)) {
      byLoc[entry.loc] = entry;
    }
  });

  byLoc["https://echoesofgaza.org/blog"] = {
    loc: "https://echoesofgaza.org/blog",
    lastmod: today
  };

  (posts || [])
    .filter(post => isSitemapIndexableBlogPost_(post))
    .forEach(post => {
      const slug = post.slug || (post.path ? String(post.path).replace(/\.html$/i, "") : "");
      if (!slug) return;
      const loc = `https://echoesofgaza.org/blog/${encodeURIComponent(slug)}/`;
      byLoc[loc] = {
        loc,
        lastmod: sitemapLastmodForPost_(post, today)
      };
    });

  const entries = Object.keys(byLoc)
    .sort((a, b) => sitemapSortKey_(a).localeCompare(sitemapSortKey_(b)))
    .map(loc => byLoc[loc]);

  const body = entries.map(entry => `  <url>
    <loc>${escapeXml_(entry.loc)}</loc>
    <lastmod>${escapeXml_(entry.lastmod || today)}</lastmod>
  </url>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

function parseSitemapEntries_(xml) {
  const entries = [];
  String(xml || "").replace(/<url\b[\s\S]*?<\/url>/gi, function(block) {
    const locMatch = block.match(/<loc>([\s\S]*?)<\/loc>/i);
    if (!locMatch) return block;
    const lastmodMatch = block.match(/<lastmod>([\s\S]*?)<\/lastmod>/i);
    entries.push({
      loc: unescapeXml_(locMatch[1].trim()),
      lastmod: lastmodMatch ? lastmodMatch[1].trim() : ""
    });
    return block;
  });
  if (!entries.some(entry => entry.loc === "https://echoesofgaza.org/")) {
    entries.unshift({ loc: "https://echoesofgaza.org/", lastmod: Utilities.formatDate(new Date(), "UTC", "yyyy-MM-dd") });
  }
  return entries;
}

function isSitemapIndexableBlogPost_(post) {
  const status = String(post.status || "published").toLowerCase();
  if (status && status !== "published") return false;
  if (!post || (!post.slug && !post.path)) return false;
  if (post.scheduledAt && Date.parse(post.scheduledAt) > Date.now()) return false;
  return true;
}

function sitemapLastmodForPost_(post, fallback) {
  const value = post.updatedAt || post.publishedAt || post.date || fallback;
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, "UTC", "yyyy-MM-dd");
  }
  const parsed = Date.parse(String(value || ""));
  if (Number.isFinite(parsed)) {
    return Utilities.formatDate(new Date(parsed), "UTC", "yyyy-MM-dd");
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return String(value);
  return fallback;
}

function sitemapSortKey_(loc) {
  if (loc === "https://echoesofgaza.org/") return "0000";
  if (loc === "https://echoesofgaza.org/blog") return "0010";
  if (/^https:\/\/echoesofgaza\.org\/blog\//.test(loc)) return `0011-${loc}`;
  return `0100-${loc}`;
}

function escapeXml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unescapeXml_(value) {
  return String(value || "")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function safeJsonLd_(obj) {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function blogShareImageMeta_(imageUrl) {
  const url = String(imageUrl || "").toLowerCase().split("?")[0];
  if (url.endsWith(".svg")) {
    return { type: "image/svg+xml", width: "1200", height: "630" };
  }
  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) {
    return { type: "image/jpeg", width: "1200", height: "630" };
  }
  if (url.endsWith(".webp")) {
    return { type: "image/webp", width: "1200", height: "630" };
  }
  return { type: "image/png", width: "1200", height: "630" };
}

function uniqueBlogSlug_(value, currentId) {
  const base = slugify_(value || "blog-post") || "blog-post";
  const path = getProps_().getProperty("BLOG_POSTS_PATH") || "data/blog_posts.json";
  try {
    const { currentContent } = getGithubFile_(path);
    let posts = JSON.parse(currentContent || "[]");
    posts = Array.isArray(posts) ? posts : (posts.posts || []);
    const used = new Set(posts
      .filter(post => String(post.id || "") !== String(currentId || ""))
      .map(post => String(post.slug || "")));
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
  const required = ["id", "slug", "path", "title", "subtitle", "author", "date", "publishedAt", "content"];
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
