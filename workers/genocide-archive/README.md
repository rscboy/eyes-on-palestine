# Genocide Archive metadata proxy

A tiny Cloudflare Worker that lets the **Witness Archive** gallery on
`primary.html` read the Genocide Archive (Israel Exposed) gallery index.

## Why it exists

The archive publishes `gallery_high.json`, `gallery_rest.json`,
`gallery_meta.json` and `victims.json` on `archivegenocide.com`, but **without
CORS headers**, so a browser on `echoesofgaza.org` can't fetch them directly.
This Worker fetches them server-side, edge-caches them (12h), and re-serves them
with CORS to our origin. The index stays **live** — it reflects Israel Exposed's
latest data, and nothing is copied into this repo.

The **media** (video/photos) does *not* go through this Worker. It streams
straight from the archive's zero-egress Cloudflare R2 bucket
(`media.archivegenocide.com`) into `<video>`/`<img>` tags, so there is no
bandwidth cost to them and no storage cost to us.

## Deploy

```bash
cd workers/genocide-archive
npx wrangler deploy
```

Wrangler prints a URL like
`https://echoes-genocide-archive.<your-subdomain>.workers.dev`.

Then open `primary.html`, find `GENOCIDE_ARCHIVE_API`, and set it to that URL
(no trailing slash).

## Endpoints

- `GET /gallery_high.json` — high-confidence records (default view)
- `GET /gallery_rest.json` — the remaining records ("load full archive")
- `GET /gallery_meta.json` — counts + source-archive list
- `GET /victims.json` — victim records

Only these four paths are proxied; anything else returns 404.
