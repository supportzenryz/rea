// Local preview that runs the real Worker (src/worker.js) in Node:
//   node dev.mjs [port]      -> http://localhost:4176
// Enquiries are kept in memory and printed here; set NO_KV=1 to try the
// "not set up yet" path (the page then opens the email app instead).

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./src/worker.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const pub = root;
// Same files Cloudflare leaves out (see .assetsignore): never served.
const HIDDEN = /^\/(src|\.wrangler)(\/|$)|^\/(wrangler\.jsonc|dev\.mjs|README\.md|\.assetsignore)$/;
const port = Number(process.argv[2]) || 4176;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
};

const store = new Map();
const env = {
  ENQUIRY_TO: "work.photosbysundar@gmail.com",
  ASSETS: {
    async fetch(request) {
      let p = decodeURIComponent(new URL(request.url).pathname);
      if (HIDDEN.test(p)) return new Response("Not found", { status: 404 });
      if (p.endsWith("/")) p += "index.html";
      const file = path.join(pub, p);
      if (!file.startsWith(pub)) return new Response("Forbidden", { status: 403 });
      try {
        const data = await fs.readFile(file);
        return new Response(data, { headers: { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" } });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    },
  },
  ENQUIRIES: process.env.NO_KV
    ? undefined
    : {
        get: async (k) => store.get(k) ?? null,
        put: async (k, v) => {
          store.set(k, v);
          if (k.startsWith("enquiry:")) console.log("Enquiry received:", v);
        },
      },
};

http
  .createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const hasBody = !["GET", "HEAD"].includes(req.method);
      const request = new Request(`http://${req.headers.host}${req.url}`, {
        method: req.method,
        headers: Object.entries(req.headers).filter(([, v]) => typeof v === "string"),
        body: hasBody ? Buffer.concat(chunks) : undefined,
      });
      const response = await worker.fetch(request, env);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      console.error(err);
      res.writeHead(500).end("Server error");
    }
  })
  .listen(port, () => console.log(`Sundar Rajan site with Worker on http://localhost:${port}`));
