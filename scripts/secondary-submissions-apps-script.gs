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

    if (action === "approveBlogPost") {
      requireAdmin_(payload);
      return approveBlogPost_(payload);
    }

    if (action === "rejectBlogPost") {
      requireAdmin_(payload);
      return rejectBlogPost_(payload);
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
  return String(value || "")
    .replace(/â€™|â€˜|�/g, "'")
    .replace(/â€œ|â€�/g, '"')
    .replace(/â€“|â€”/g, "-")
    .replace(/Â/g, "")
    .replace(/\bM\?decins Sans Fronti\?res\b/g, "Medecins Sans Frontieres")
    .replace(/\bM\?decins\b/g, "Medecins")
    .replace(/\bFronti\?res\b/g, "Frontieres")
    .replace(/([A-Za-z])\?s\b/g, "$1's")
    .replace(/([A-Za-z])\?t\b/g, "$1't")
    .replace(/([A-Za-z])\?([A-Za-z])/g, "$1-$2")
    .trim();
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
    const body = String(incoming.body || rowObj.body || "");
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
    const content = incoming.content ? String(incoming.content) : blogBodyToHtml_(body);
    const slug = uniqueBlogSlug_(incoming.slug || rowObj.slug || title, rowObj.id);
    const post = {
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

    validateBlogPost_(post);
    updateGithubBlogPostsJson_(post);
    updateGithubBlogPostPage_(post);

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
  return { result: "success", posts };
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
    const content = String(incoming.content || existing.content || "");
    const images = cleanUrlList_(incoming.images || existing.images || []);
    const featureImage = String(incoming.featureImage || images[0] || existing.featureImage || "").trim();
    const shareImage = String(incoming.shareImage || featureImage || existing.shareImage || "").trim();

    const updated = Object.assign({}, existing, {
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

    validateBlogPost_(updated);
    posts[index] = updated;
    putGithubFile_(path, fileData, JSON.stringify(posts, null, 2), `Update blog post: ${updated.title}`);
    updateGithubBlogPostPage_(updated);

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
  return posts.findIndex(post =>
    (idText && String(post.id || "") === idText) ||
    (slugText && String(post.slug || "") === slugText)
  );
}

function blogPostMatches_(item, postId, postSlug) {
  return (postId && String(item.postId || "") === String(postId)) ||
    (postSlug && String(item.postSlug || "") === String(postSlug));
}

function cleanUrlList_(values) {
  const list = Array.isArray(values)
    ? values
    : String(values || "").split(/\n|,/);
  return list.map(value => String(value || "").trim()).filter(Boolean);
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
    lock.waitLock(45000);
    hasLock = true;
    return callback();
  } catch (err) {
    if (!hasLock) {
      throw new Error("Another approval is updating GitHub. Please wait a few seconds and try again.");
    }
    throw err;
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
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
  const currentContent = getGithubFileContentText_(fileData, token);

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
    content: Utilities.base64Encode(updatedContent),
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

  const existingIndex = posts.findIndex(post => post.id === newPost.id || post.slug === newPost.slug);
  if (existingIndex >= 0) {
    posts[existingIndex] = newPost;
  } else {
    posts.unshift(newPost);
  }
  putGithubFile_(path, fileData, JSON.stringify(posts, null, 2), `Approve blog post: ${newPost.title}`);
}

function updateGithubBlogPostPage_(post) {
  const pagePath = `blog/${post.path}`;
  const appUrl = `https://echoesofgaza.org/blog?post=${encodeURIComponent(post.slug)}`;
  const canonicalUrl = appUrl;
  const description = escapeHtml_(post.shareDescription || post.subtitle || "");
  const title = escapeHtml_(post.title || "Echoes of Gaza Blog");
  const image = post.shareImage || post.featureImage || "https://i.postimg.cc/fT81SwN0/426559D6-9EF9-49AA-8A0B-84A3FA70B3E2.png";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Echoes of Gaza">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${escapeHtml_(image)}">
  <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${escapeHtml_(image)}">
  <meta http-equiv="refresh" content="0; url=${appUrl}">
  <script>window.location.replace(${JSON.stringify(appUrl)});</script>
</head>
<body>
  <p>Opening <a href="${appUrl}">${title}</a>.</p>
</body>
</html>`;

  putGithubFileAllowCreate_(pagePath, html, `Create blog post page: ${post.title}`);
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
