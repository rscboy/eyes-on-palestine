const SHEET_NAME = "Secondary_Submissions";

function getProps_() {
  return PropertiesService.getScriptProperties();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const sheetId = getProps_().getProperty("SHEET_ID");
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`Missing sheet tab: ${SHEET_NAME}`);
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

    if (action === "approveArticle") {
      requireAdmin_(payload);
      return approveArticle_(payload);
    }

    if (action === "rejectArticle") {
      requireAdmin_(payload);
      return rejectArticle_(payload);
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
