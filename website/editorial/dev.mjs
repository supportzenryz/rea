// Local preview that runs the real Worker (src/worker.js) in Node:
//   node dev.mjs [port]      -> http://localhost:4176
// Content, uploads and enquiries are kept in memory (enquiries are printed
// here). Set ADMIN_PASSWORD to try /admin; NO_KV=1 runs with no storage.

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./src/worker.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const pub = root;
// Same files Cloudflare leaves out (see .assetsignore): never served.
const HIDDEN = /^\/(src|\.wrangler)(\/|$)|^\/(wrangler\.jsonc|dev\.mjs|README\.md|MIGRATION\.md|\.assetsignore)$/;
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
  // The admin's password here comes from the environment: ADMIN_PASSWORD=... node dev.mjs
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  // Emails (enquiries, password links) are printed here instead of sent.
  RESEND_API_KEY: "local",
  CONTENT: process.env.NO_KV ? undefined : memoryKV(store),
};

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  if (String(input).startsWith("https://api.resend.com/")) {
    const m = JSON.parse(init.body);
    console.log(`\n--- Email to ${m.to} ---\nSubject: ${m.subject}\n${m.text}\n---\n`);
    return new Response("{}", { status: 200 });
  }
  return realFetch(input, init);
};

// Enough of Workers KV for local use (kept in memory until the process ends).
function memoryKV(m) {
  const read = (v, type) => (v == null ? null : type === "arrayBuffer" ? v.value : typeof v.value === "string" ? v.value : Buffer.from(v.value).toString());
  return {
    get: async (k, opts) => read(m.get(k), typeof opts === "string" ? opts : opts?.type),
    getWithMetadata: async (k, opts) => ({ value: read(m.get(k), opts?.type), metadata: m.get(k)?.metadata ?? null }),
    put: async (k, value, opts = {}) => {
      m.set(k, { value: value instanceof ArrayBuffer ? value : value, metadata: opts.metadata ?? null });
      if (k.startsWith("enquiry:")) console.log("Enquiry received:", value);
    },
    delete: async (k) => void m.delete(k),
    list: async ({ prefix = "", limit = 1000 } = {}) => ({
      keys: [...m.keys()].filter((k) => k.startsWith(prefix)).sort().slice(0, limit).map((name) => ({ name })),
      list_complete: true,
    }),
  };
}

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
