/* ============================================================
   Forge · server
   - static hosting (index.html / engine.js / app.js / ...)
   - auth: register / login / logout / me  (scrypt + session cookie)
   - state: per-user project state persisted on the server
   - publish: real shareable address  GET /p/<slug>
   - llm proxy: POST /api/llm -> OpenAI-compatible endpoint (SSE)
   ============================================================ */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Readable } = require("stream");

const PORT = Number(process.env.PORT || 8137);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const DATA = path.join(ROOT, "data");
const PAGES = path.join(DATA, "pages");
const USERS_FILE = path.join(DATA, "users.json");
const SESS_FILE = path.join(DATA, "sessions.json");
const STATE_DIR = path.join(DATA, "state");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

/* ---------------- storage helpers ---------------- */
function ensureDirs() {
  [DATA, PAGES, STATE_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}
ensureDirs();

function readJSON(p, def) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return def; }
}
function writeJSON(p, obj) {
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, p);
}

let users = readJSON(USERS_FILE, null);
if (!users) {
  users = {};
}
let sessions = readJSON(SESS_FILE, {});

function saveUsers() { writeJSON(USERS_FILE, users); }
function saveSessions() { writeJSON(SESS_FILE, sessions); }

/* seed a demo account so reviewers can sign in without registering */
function seedDemo() {
  const email = "demo@forge.app";
  if (users[email]) return null;
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync("demo1234", salt, 32).toString("hex");
  users[email] = {
    id: "u_demo",
    name: "演示账号",
    email,
    salt,
    hash,
    createdAt: Date.now(),
    demo: true
  };
  saveUsers();
  return { email, password: "demo1234" };
}
const seeded = seedDemo();

/* ---------------- auth ---------------- */
function hashPw(pw, salt) { return crypto.scryptSync(pw, salt, 32).toString("hex"); }
function publicUser(u) {
  return u ? { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt, demo: !!u.demo } : null;
}
function newSession(userId) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions[token] = { userId, ts: Date.now() };
  saveSessions();
  return token;
}
function userFromReq(req) {
  const raw = req.headers.cookie || "";
  const m = /(?:^|;\s*)forge_token=([^;]+)/.exec(raw);
  if (!m) return null;
  const s = sessions[m[1]];
  if (!s) return null;
  const u = Object.values(users).find((x) => x.id === s.userId);
  return u || null;
}
function cookieHeader(token, maxAge) {
  return "forge_token=" + token + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + maxAge;
}

/* ---------------- http helpers ---------------- */
function json(res, code, obj, extraHeaders) {
  const body = JSON.stringify(obj);
  res.writeHead(code, Object.assign({
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  }, extraHeaders || {}));
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => {
      b += c;
      if (b.length > 40 * 1024 * 1024) { req.destroy(); resolve("{}"); }
    });
    req.on("end", () => resolve(b));
  });
}
function parseJSON(s) { try { return JSON.parse(s || "{}"); } catch (e) { return {}; } }

const stateFile = (userId) => path.join(STATE_DIR, userId + ".json");

/* ---------------- server ---------------- */
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://" + (req.headers.host || "localhost"));
  const pathname = decodeURIComponent(u.pathname);

  /* ---- health ---- */
  if (pathname === "/api/health") return json(res, 200, { ok: true, demo: true });

  /* ---- auth ---- */
  if (pathname === "/api/auth/register" && req.method === "POST") {
    const b = parseJSON(await readBody(req));
    const name = String(b.name || "").trim();
    const email = String(b.email || "").trim().toLowerCase();
    const pw = String(b.password || "");
    if (!name || !email || pw.length < 6) {
      return json(res, 400, { error: "请填写昵称和邮箱，密码至少 6 位" });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { error: "邮箱格式不对" });
    if (users[email]) return json(res, 409, { error: "这个邮箱已经注册过了" });
    const salt = crypto.randomBytes(16).toString("hex");
    const id = "u_" + crypto.randomBytes(6).toString("hex");
    users[email] = { id, name, email, salt, hash: hashPw(pw, salt), createdAt: Date.now() };
    saveUsers();
    const token = newSession(id);
    return json(res, 200, { token, user: publicUser(users[email]) },
      { "Set-Cookie": cookieHeader(token, 60 * 60 * 24 * 30) });
  }

  if (pathname === "/api/auth/login" && req.method === "POST") {
    const b = parseJSON(await readBody(req));
    const email = String(b.email || "").trim().toLowerCase();
    const pw = String(b.password || "");
    const user = users[email];
    if (!user) return json(res, 401, { error: "账号不存在，先注册一个吧" });
    if (hashPw(pw, user.salt) !== user.hash) return json(res, 401, { error: "密码不对" });
    const token = newSession(user.id);
    return json(res, 200, { token, user: publicUser(user) },
      { "Set-Cookie": cookieHeader(token, 60 * 60 * 24 * 30) });
  }

  if (pathname === "/api/auth/logout" && req.method === "POST") {
    const m = /(?:^|;\s*)forge_token=([^;]+)/.exec(req.headers.cookie || "");
    if (m) { delete sessions[m[1]]; saveSessions(); }
    return json(res, 200, { ok: true }, { "Set-Cookie": cookieHeader("", 0) });
  }

  if (pathname === "/api/auth/me" && req.method === "GET") {
    const user = userFromReq(req);
    return json(res, 200, { user: publicUser(user), authAvailable: true });
  }

  /* ---- per-user state (server-side persistence) ---- */
  if (pathname === "/api/state" && req.method === "GET") {
    const user = userFromReq(req);
    if (!user) return json(res, 401, { error: "未登录" });
    const st = readJSON(stateFile(user.id), {});
    return json(res, 200, { state: st });
  }

  if (pathname === "/api/state" && req.method === "PUT") {
    const user = userFromReq(req);
    if (!user) return json(res, 401, { error: "未登录" });
    const b = parseJSON(await readBody(req));
    const prev = readJSON(stateFile(user.id), {});
    const next = Object.assign({}, prev, b.state || {});
    next.updatedAt = Date.now();
    writeJSON(stateFile(user.id), next);
    return json(res, 200, { ok: true, updatedAt: next.updatedAt });
  }

  /* ---- publish: real shareable address ---- */
  if (pathname === "/api/publish" && req.method === "POST") {
    const user = userFromReq(req);
    if (!user) return json(res, 401, { error: "未登录" });
    const b = parseJSON(await readBody(req));
    const html = String(b.html || "");
    if (!html) return json(res, 400, { error: "没有内容可以发布" });
    const st = readJSON(stateFile(user.id), {});
    let slug = b.slug && /^[a-z0-9-]{4,32}$/.test(b.slug) ? b.slug : null;
    if (!slug) {
      if (st.published && st.published.slug) slug = st.published.slug;
      else slug = (String(b.name || "app").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "app") + "-" + crypto.randomBytes(3).toString("hex");
    }
    fs.writeFileSync(path.join(PAGES, slug + ".html"), html, "utf8");
    const origin = (req.headers["x-forwarded-proto"] || "http") + "://" + (req.headers.host || "localhost:" + PORT);
    const url = origin + "/p/" + slug;
    const version = Number(b.version || (st.curVer || 1));
    const info = { slug, url, version, name: b.name || "应用", ts: Date.now() };
    st.published = info;
    st.updatedAt = Date.now();
    writeJSON(stateFile(user.id), st);
    return json(res, 200, { ok: true, published: info });
  }

  if (pathname === "/api/pages" && req.method === "GET") {
    const user = userFromReq(req);
    if (!user) return json(res, 401, { error: "未登录" });
    const st = readJSON(stateFile(user.id), {});
    return json(res, 200, { published: st.published || null });
  }

  /* ---- published page (public) ---- */
  if (pathname.startsWith("/p/")) {
    const slug = pathname.slice(3).replace(/\.html$/, "");
    if (!/^[a-z0-9-]{4,64}$/.test(slug)) { res.writeHead(404); return res.end("Not found"); }
    const fp = path.join(PAGES, slug + ".html");
    fs.readFile(fp, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        return res.end("<meta charset='utf-8'><body style='font-family:sans-serif;padding:40px'><h2>页面不存在</h2><p>这个链接可能已经被取消发布了。</p></body>");
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      res.end(data);
    });
    return;
  }

  /* ---- LLM proxy ---- */
  if (req.method === "POST" && pathname === "/api/llm") {
    const cfg = parseJSON(await readBody(req));
    if (!cfg.apiKey || !cfg.baseUrl) {
      return json(res, 400, { error: "missing apiKey or baseUrl" });
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
          temperature: cfg.temperature != null ? cfg.temperature : 0.7,
          max_tokens: cfg.max_tokens || 8192
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
      json(res, 502, { error: String((e && e.message) || e) });
    }
    return;
  }

  /* ---- static files ---- */
  let p = pathname === "/" ? "/index.html" : pathname;
  const safe = path.normalize(p).replace(/^(\.\.[/\\])+/, "");
  const fp = path.join(ROOT, safe);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(fp, (err, data) => {
    if (err) {
      if (pathname === "/index.html") { res.writeHead(404); return res.end("Not found"); }
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
});

let port = PORT;
// 部署环境会显式注入 PORT，此时必须监听该端口，不能顺延（平台只暴露一个端口）
const CAN_TRY_NEXT = !process.env.PORT;
const MAX_TRY = 12;
server.on("error", (err) => {
  if (err.code === "EADDRINUSE" && CAN_TRY_NEXT && port < PORT + MAX_TRY) {
    console.log("端口 " + port + " 已被占用，尝试 " + (port + 1) + " ...");
    port += 1;
    setTimeout(() => server.listen(port, HOST), 120);
  } else {
    console.error("启动失败：" + err.message);
    process.exit(1);
  }
});
server.listen(port, HOST, () => {
  const url = "http://localhost:" + port;
  console.log("");
  console.log("  Forge running at " + url);
  console.log("  ------------------------------------------");
  console.log("  测试账号：demo@forge.app  /  demo1234");
  if (seeded) console.log("  （已自动创建演示账号，可直接登录）");
  console.log("  注册登录页：" + url + "/  首次打开会要求登录");
  console.log("  ------------------------------------------");
  console.log("");
  if (process.env.FORGE_OPEN !== "0" && process.platform === "win32" && !process.env.PORT) {
    try { require("child_process").exec('start "" ' + url); } catch (e) {}
  }
});
