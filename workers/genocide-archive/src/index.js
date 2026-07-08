// Echoes of Gaza — Genocide Archive metadata proxy.
//
// The Genocide Archive (Israel Exposed) publishes its gallery index as static
// JSON on archivegenocide.com, but WITHOUT CORS headers, so a browser on
// echoesofgaza.org cannot fetch it directly. This Worker fetches those files
// server-side, caches them at the Cloudflare edge, and re-serves them to our
// origin with CORS — so the Witness Archive gallery reads live metadata
// (auto-updating as Israel Exposed updates their archive) with nothing stored
// in our repo. Media itself streams straight from their zero-egress R2 bucket
// and never touches this Worker.
//
// Deploy:  cd workers/genocide-archive && npx wrangler deploy
// Then set GENOCIDE_ARCHIVE_API in primary.html to the deployed URL.

const ALLOWED_FILES = new Set([
  "gallery_high.json",
  "gallery_rest.json",
  "gallery_meta.json",
  "victims.json",
]);

// Official mirrors, tried in order (matches the archive's own get-data.sh).
const UPSTREAMS = [
  "https://archivegenocide.com",
  "https://archivegenocide.org",
  "https://archivegenocide.is",
];

const CACHE_TTL_SECONDS = 43200; // 12h — the index changes slowly.

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGIN || "https://echoesofgaza.org")
    .split(",")
    .map((s) => s.trim());
  const headers = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else if (allowed.length === 1) {
    headers["Access-Control-Allow-Origin"] = allowed[0];
  }
  return headers;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405, headers: cors });
    }

    const url = new URL(request.url);
    const file = url.pathname.replace(/^\/+/, "");
    if (!ALLOWED_FILES.has(file)) {
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let lastStatus = 502;
    for (const base of UPSTREAMS) {
      let upstream;
      try {
        upstream = await fetch(`${base}/${file}`, {
          cf: { cacheEverything: true, cacheTtl: CACHE_TTL_SECONDS },
          headers: { Accept: "application/json" },
        });
      } catch (_) {
        continue; // mirror unreachable — try the next one
      }
      if (!upstream.ok) {
        lastStatus = upstream.status;
        continue;
      }
      return new Response(upstream.body, {
        status: 200,
        headers: {
          ...cors,
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
          "X-Archive-Upstream": base,
        },
      });
    }

    return new Response(
      JSON.stringify({ error: "all upstream mirrors failed", status: lastStatus }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
    );
  },
};
