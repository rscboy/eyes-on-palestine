const ALLOWED_MANUAL_STATUSES = new Set([
  "confirmed_live",
  "confirmed_removed",
  "confirmed_changed",
  "blocked_unknown",
  "needs_manual_review"
]);

const SCREENSHOT_ACTIONS = new Set([
  "delete_after_review",
  "keep_as_evidence",
  "no_screenshot"
]);

const SCAN_MODES = new Set([
  "due",
  "quick_test",
  "standard",
  "forced_custom"
]);

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigin = env.ALLOWED_ORIGIN || "https://echoesofgaza.org";
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };

  if (origin === allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
  }

  return headers;
}

function jsonResponse(request, env, status, payload) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request, env)
    }
  });
}

function isAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  return !origin || origin === (env.ALLOWED_ORIGIN || "https://echoesofgaza.org");
}

function requireAllowedOrigin(request, env) {
  if (!isAllowedOrigin(request, env)) {
    throw Object.assign(new Error("Origin is not allowed."), { status: 403 });
  }
}

function requireAdmin(request, env) {
  const expected = env.ADMIN_API_KEY;
  const provided = request.headers.get("X-Admin-Key") || "";
  if (!expected) {
    throw Object.assign(new Error("ADMIN_API_KEY is not configured."), { status: 500 });
  }
  if (!provided || provided !== expected) {
    throw Object.assign(new Error("Unauthorized admin request."), { status: 401 });
  }
}

async function readJson(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw Object.assign(new Error("Content-Type must be application/json."), { status: 415 });
  }

  try {
    return await request.json();
  } catch (error) {
    throw Object.assign(new Error("Request body must be valid JSON."), { status: 400 });
  }
}

function asString(value, field, required = true) {
  if (value == null || value === "") {
    if (required) throw Object.assign(new Error(`${field} is required.`), { status: 400 });
    return "";
  }
  if (typeof value !== "string") {
    throw Object.assign(new Error(`${field} must be a string.`), { status: 400 });
  }
  return value.trim();
}

function asInteger(value, field, min, max, fallback) {
  const next = value == null || value === "" ? fallback : Number(value);
  if (!Number.isInteger(next) || next < min || next > max) {
    throw Object.assign(new Error(`${field} must be an integer between ${min} and ${max}.`), { status: 400 });
  }
  return next;
}

function asBoolean(value, field, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value !== "boolean") {
    throw Object.assign(new Error(`${field} must be a boolean.`), { status: 400 });
  }
  return value;
}

function validateBulkOverride(payload) {
  const reviewer = asString(payload.reviewer, "reviewer");
  const notes = asString(payload.notes, "notes", false).slice(0, 500);
  const screenshotAction = asString(payload.screenshot_action || "delete_after_review", "screenshot_action");
  if (!SCREENSHOT_ACTIONS.has(screenshotAction)) {
    throw Object.assign(new Error("screenshot_action is not allowed."), { status: 400 });
  }

  if (!Array.isArray(payload.overrides) || payload.overrides.length === 0) {
    throw Object.assign(new Error("overrides must be a non-empty array."), { status: 400 });
  }
  if (payload.overrides.length > 25) {
    throw Object.assign(new Error("Maximum 25 overrides are allowed per request."), { status: 400 });
  }

  const overrides = payload.overrides.map((override, index) => {
    if (!override || typeof override !== "object" || Array.isArray(override)) {
      throw Object.assign(new Error(`overrides[${index}] must be an object.`), { status: 400 });
    }
    const articleId = asString(override.article_id, `overrides[${index}].article_id`);
    const manualStatus = asString(override.manual_status, `overrides[${index}].manual_status`);
    if (!ALLOWED_MANUAL_STATUSES.has(manualStatus)) {
      throw Object.assign(new Error(`overrides[${index}].manual_status is not allowed.`), { status: 400 });
    }
    return { article_id: articleId, manual_status: manualStatus };
  });

  return {
    reviewer,
    notes,
    screenshot_action: screenshotAction,
    overrides
  };
}

function validateMonitorRun(payload) {
  const scanMode = asString(payload.scan_mode || "due", "scan_mode");
  if (!SCAN_MODES.has(scanMode)) {
    throw Object.assign(new Error("scan_mode is not allowed."), { status: 400 });
  }

  const requestedBy = asString(payload.requested_by, "requested_by");
  const reviewIntervalDays = asInteger(payload.review_interval_days, "review_interval_days", 1, 365, 60);
  const maxDue = asInteger(payload.max_due, "max_due", 1, 100, 25);
  const offset = asInteger(payload.offset, "offset", 0, 1000000, 0);
  const screenshots = asBoolean(payload.screenshots, "screenshots", false);
  const force = asBoolean(payload.force, "force", false);
  const note = asString(payload.note, "note", false).slice(0, 300);
  const limitValue = payload.limit == null || payload.limit === "" ? "" : asInteger(payload.limit, "limit", 1, 250, 25);

  if (scanMode === "due" && force) {
    throw Object.assign(new Error("due mode cannot use force."), { status: 400 });
  }
  if (scanMode === "due" && limitValue !== "" && Number(limitValue) > 100) {
    throw Object.assign(new Error("due mode limit cannot exceed 100."), { status: 400 });
  }
  if (scanMode === "quick_test" && (!force || limitValue === "" || Number(limitValue) > 5)) {
    throw Object.assign(new Error("quick_test requires force true and limit 5 or less."), { status: 400 });
  }
  if (scanMode === "standard" && (!force || limitValue === "" || Number(limitValue) > 25)) {
    throw Object.assign(new Error("standard requires force true and limit 25 or less."), { status: 400 });
  }
  if (scanMode === "forced_custom" && (!force || limitValue === "" || Number(limitValue) > 250)) {
    throw Object.assign(new Error("forced_custom requires force true and limit 250 or less."), { status: 400 });
  }

  return {
    scan_mode: scanMode,
    requested_by: requestedBy,
    review_interval_days: reviewIntervalDays,
    max_due: maxDue,
    limit: limitValue === "" ? "" : String(limitValue),
    offset: String(offset),
    screenshots: String(screenshots),
    force: String(force),
    note
  };
}

async function dispatchWorkflow(env, workflow, inputs) {
  const owner = env.GITHUB_OWNER || "rscboy";
  const repo = env.GITHUB_REPO || "eyes-on-palestine";
  const branch = env.GITHUB_BRANCH || "main";
  const token = env.GITHUB_TOKEN;

  if (!token) {
    throw Object.assign(new Error("GITHUB_TOKEN is not configured."), { status: 500 });
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "echoes-integrity-admin-worker"
    },
    body: JSON.stringify({
      ref: branch,
      inputs
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`GitHub workflow dispatch failed: ${response.status} ${text}`), { status: 502 });
  }
}

async function handleBulkOverride(request, env) {
  const payload = validateBulkOverride(await readJson(request));
  await dispatchWorkflow(env, env.GITHUB_BULK_OVERRIDE_WORKFLOW || "article-integrity-bulk-override.yml", {
    payload: JSON.stringify(payload)
  });
  return jsonResponse(request, env, 200, {
    ok: true,
    message: "Bulk override workflow dispatched",
    count: payload.overrides.length
  });
}

async function handleRunMonitor(request, env) {
  const payload = validateMonitorRun(await readJson(request));
  await dispatchWorkflow(env, env.GITHUB_MONITOR_WORKFLOW || "article-integrity-monitor.yml", {
    limit: payload.limit,
    offset: payload.offset,
    screenshots: payload.screenshots,
    review_interval_days: String(payload.review_interval_days),
    max_due: String(payload.max_due),
    force: payload.force
  });
  return jsonResponse(request, env, 200, {
    ok: true,
    message: "Monitor workflow dispatched"
  });
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";

      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(request, env) });
      }

      requireAllowedOrigin(request, env);

      if (request.method === "GET" && path === "/health") {
        return jsonResponse(request, env, 200, { ok: true, service: "echoes-integrity-admin" });
      }

      if (path === "/api/integrity/bulk-override" && request.method === "POST") {
        requireAdmin(request, env);
        return await handleBulkOverride(request, env);
      }

      if (path === "/api/integrity/run-monitor" && request.method === "POST") {
        requireAdmin(request, env);
        return await handleRunMonitor(request, env);
      }

      return jsonResponse(request, env, 404, { ok: false, error: "Not found." });
    } catch (error) {
      const status = error.status || 500;
      return jsonResponse(request, env, status, {
        ok: false,
        error: error.message || "Unexpected worker error."
      });
    }
  }
};
