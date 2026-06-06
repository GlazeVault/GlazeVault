/**
 * Production server for the exported Expo **web** build (SPA).
 *
 * `pnpm run build` runs `expo export --platform web` (with `web.output: "single"`)
 * which emits a single-page app into `dist/`. This server:
 * - serves real files from `dist/` (JS, CSS, fonts, images, the favicon, etc.)
 * - falls back to `dist/index.html` for any non-file route so client-side
 *   routing (expo-router) handles it — this is what makes the public artist
 *   links like `/{slug}` and `/{slug}/archive` resolve directly in the browser.
 *
 * Zero external dependencies — uses only Node.js built-ins (http, fs, path).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const DIST_ROOT = path.resolve(__dirname, "..", "dist");
const INDEX_HTML = path.join(DIST_ROOT, "index.html");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");
const port = parseInt(process.env.PORT || "3000", 10);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

function serveIndex(res) {
  if (!fs.existsSync(INDEX_HTML)) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(
      "Web build not found. Expected dist/index.html — run `pnpm run build`.",
    );
    return;
  }
  // index.html must never be cached so new deploys are picked up immediately;
  // the referenced JS/CSS are content-hashed and cached aggressively below.
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-cache, no-store, must-revalidate",
  });
  res.end(fs.readFileSync(INDEX_HTML));
}

const server = http.createServer((req, res) => {
  let pathname = "/";
  try {
    pathname = decodeURIComponent(
      new URL(req.url || "/", `http://${req.headers.host}`).pathname,
    );
  } catch {
    pathname = "/";
  }

  // Strip the artifact's base path prefix (e.g. "/") so routing is origin-relative.
  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  if (pathname === "/" || pathname === "") {
    return serveIndex(res);
  }

  // Try to serve a real static file from dist/.
  const safePath = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(DIST_ROOT, safePath);

  if (
    filePath.startsWith(DIST_ROOT) &&
    fs.existsSync(filePath) &&
    fs.statSync(filePath).isFile()
  ) {
    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      "content-type": MIME_TYPES[ext] || "application/octet-stream",
    };
    // Content-hashed build assets are safe to cache forever.
    if (pathname.startsWith("/_expo/") || pathname.startsWith("/assets/")) {
      headers["cache-control"] = "public, max-age=31536000, immutable";
    }
    res.writeHead(200, headers);
    res.end(fs.readFileSync(filePath));
    return;
  }

  // A missing file *with* an extension is a genuine 404 (don't hand back HTML
  // for a missing .js/.png — that would cause confusing MIME errors).
  if (path.extname(pathname)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }

  // Everything else is a client-side route → serve the SPA shell.
  return serveIndex(res);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Serving Expo web build (SPA) on port ${port}`);
});
