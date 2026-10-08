/* ============================================================
   Forge · local server + LLM proxy
   - serves the static app (index.html / engine.js / ...)
   - proxies POST /api/llm to any OpenAI-compatible endpoint,
     streaming SSE back to the browser. Keeps the API key
     server-side (browser only talks to localhost).
   ============================================================ */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");

const PORT = process.env.PORT || 8137;
const ROOT = __dirname;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://localhost");

  // ---- LLM proxy ----
  if (req.method === "POST" && u.pathname === "/api/llm") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      let cfg;
      try { cfg = JSON.parse(body || "{}"); } catch (e) { cfg = {}; }
      if (!cfg.apiKey || !cfg.baseUrl) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "missing apiKey or baseUrl" }));
        return;
      }
      const upstream = cfg.baseUrl.replace(/\/+$/, "") + "/chat/completions";
      try {
        const r = await fetch(upstream, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.apiKey },
          body: JSON.stringify({
            model: cfg.model || "deepseek-chat",
            messages: cfg.messages || [],
            stream: cfg.stream !== false,
            temperature: cfg.temperature != null ? cfg.temperature : 0.7
          })
        });
        res.writeHead(r.status, {
          "Content-Type": r.headers.get("content-type") || "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        });
        if (r.body && typeof r.body.getReader === "function") {
          const upstreamStream = Readable.fromWeb(r.body);
          res.on("close", () => { try { upstreamStream.destroy(); } catch (e) {} });
          upstreamStream.pipe(res);
        } else {
          res.end(await r.text());
        }
      } catch (e) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(e && e.message || e) }));
      }
    });
    return;
  }

  // ---- static files ----
  let p = u.pathname === "/" ? "/index.html" : u.pathname;
  const safe = path.normalize(p).replace(/^(\.\.[/\\])+/, "");
  const fp = path.join(ROOT, safe);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" });
    res.end(data);
  });
});

let port = PORT;
const MAX_TRY = 12;
server.on("error", (err) => {
  if (err.code === "EADDRINUSE" && port < PORT + MAX_TRY) {
    console.log("端口 " + port + " 已被占用，尝试 " + (port + 1) + " ...");
    port += 1;
    setTimeout(() => server.listen(port), 120);
  } else {
    console.error("启动失败：" + err.message);
    process.exit(1);
  }
});
server.listen(port, () => {
  const url = "http://localhost:" + port;
  console.log("Forge running at " + url);
  if (process.env.FORGE_OPEN !== "0" && process.platform === "win32") {
    try { require("child_process").exec('start "" ' + url); } catch (e) {}
  }
});
