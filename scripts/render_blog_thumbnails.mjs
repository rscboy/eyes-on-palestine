import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const thumbnailDir = path.join(root, "blog", "thumbnails");

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listSvgFiles(dir) {
  if (!(await pathExists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listSvgFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".svg")) {
      files.push(fullPath);
    }
  }
  return files;
}

function decodeHtmlAttribute(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function mimeFromUrl(url, contentType) {
  const type = String(contentType || "").split(";")[0].trim();
  if (type.startsWith("image/")) return type;
  const lower = String(url || "").toLowerCase().split("?")[0];
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/png";
}

async function inlineRemoteImages(svg) {
  const imageTagPattern = /<image\b[^>]*\bhref="(https?:\/\/[^"]+)"[^>]*\/>/g;
  const replacements = [];
  for (const match of svg.matchAll(imageTagPattern)) {
    const [tag, rawUrl] = match;
    const url = decodeHtmlAttribute(rawUrl);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const mime = mimeFromUrl(url, response.headers.get("content-type"));
      replacements.push([tag, tag.replace(rawUrl, `data:${mime};base64,${bytes.toString("base64")}`)]);
    } catch (error) {
      console.warn(`Could not inline thumbnail image ${url}: ${error.message}`);
      replacements.push([tag, ""]);
    }
  }
  return replacements.reduce((output, [from, to]) => output.replace(from, to), svg);
}

async function renderThumbnail(svgPath) {
  const pngPath = svgPath.replace(/\.svg$/, ".png");
  const [svgStat, pngExists] = await Promise.all([
    fs.stat(svgPath),
    pathExists(pngPath)
  ]);
  if (pngExists) {
    const pngStat = await fs.stat(pngPath);
    if (pngStat.mtimeMs >= svgStat.mtimeMs) return false;
  }

  const rawSvg = await fs.readFile(svgPath, "utf8");
  const svg = await inlineRemoteImages(rawSvg);
  await sharp(Buffer.from(svg))
    .resize(1200, 630, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toFile(pngPath);
  console.log(`Rendered ${path.relative(root, pngPath)}`);
  return true;
}

const svgFiles = await listSvgFiles(thumbnailDir);
let rendered = 0;
for (const svgFile of svgFiles) {
  if (await renderThumbnail(svgFile)) rendered += 1;
}
console.log(`Blog thumbnails rendered: ${rendered}`);
