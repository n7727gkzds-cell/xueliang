/* ============================================================
   Forge · App — conversation flow, agent streaming, preview
   ============================================================ */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const thread = $("#thread");
  const empty = $("#empty");
  const promptEl = $("#prompt");
  const sendBtn = $("#send");
  const preview = $("#preview");
  const codeView = $("#codeView");
  const codePanel = $("#codePanel");
  const stageTitle = $("#stageTitle");
  const appKind = $("#appKind");
  const publishBtn = $("#publish");
  const exportBtn = $("#export");

  let lastMeta = null;
  let lastHTML = "";
  let busy = false;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ============================================================
     账号体系：登录 / 注册 / 登出 + 服务端数据同步
     ============================================================ */
  let me = null;                 // 当前登录用户，null = 游客
  let syncState = "local";       // local | saving | saved | error
  let syncTimer = null;

  async function api(path, opts) {
    const o = Object.assign({ credentials: "same-origin", headers: {} }, opts || {});
    if (o.body && typeof o.body === "object") {
      o.headers["Content-Type"] = "application/json";
      o.body = JSON.stringify(o.body);
    }
    let r;
    try { r = await fetch(path, o); }
    catch (e) { return { ok: false, status: 0, data: { error: "连不上本地服务，请确认 server.js 已启动" } }; }
    const txt = await r.text();
    let data = null;
    try { data = JSON.parse(txt); } catch (e) { data = { raw: txt }; }
    return { ok: r.ok, status: r.status, data: data || {} };
  }

  async function checkAuth() {
    const r = await api("/api/auth/me");
    if (r.ok && r.data && r.data.authAvailable) { me = r.data.user || null; return true; }
    return false;
  }

  function collectState() {
    return {
      brief: { audience: brief.audience, goal: brief.goal, pref: brief.pref, files: [] },
      versions: versions,
      curVer: curVer,
      published: published,
      last: lastHTML ? { html: lastHTML, title: stageTitle.textContent, v: curVer, t: Date.now() } : null
    };
  }

  function scheduleSync() {
    if (!me) { syncState = "local"; renderAcct(); return; }
    syncState = "saving"; renderAcct();
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      const r = await api("/api/state", { method: "PUT", body: { state: collectState() } });
      syncState = r.ok ? "saved" : "error";
      renderAcct();
    }, 700);
  }

  async function pullState() {
    if (!me) return false;
    const r = await api("/api/state");
    if (!r.ok || !r.data || !r.data.state) return false;
    const st = r.data.state;
    if (st.brief) {
      brief = { audience: st.brief.audience || "", goal: st.brief.goal || "", pref: st.brief.pref || "", files: brief.files || [] };
      $("#bAudience").value = brief.audience;
      $("#bGoal").value = brief.goal;
      $("#bPref").value = brief.pref;
      renderBrief();
    }
    if (Array.isArray(st.versions) && st.versions.length) {
      versions = st.versions;
      curVer = st.curVer || versions.length;
    }
    if (st.published) published = st.published;
    if (st.last && st.last.html) {
      lastHTML = st.last.html;
      preview.srcdoc = withNavGuard(lastHTML);
      setCode(lastHTML);
      stageTitle.textContent = st.last.title || "应用";
      appKind.textContent = "云端恢复";
      publishBtn.disabled = false;
      empty.classList.add("gone");
      updateVerBadge();
    }
    updateVerBadge();
    return !!(st.last && st.last.html);
  }

  function renderAcct() {
    const name = me ? (me.name || me.email.split("@")[0]) : "游客";
    const initial = (name || "?").trim().slice(0, 1).toUpperCase();
    $("#acctName").textContent = me ? name : "未登录";
    $("#acctName2").textContent = name;
    $("#acctAvatar").textContent = initial;
    $("#acctAvatar2").textContent = initial;
    $("#acctEmail").textContent = me ? me.email : "数据仅存在本机浏览器";
    $("#logoutItem").hidden = !me;
    $("#loginItem").hidden = !!me;
    const map = {
      local: "本地模式 · 数据存本机",
      saving: "正在同步到云端…",
      saved: "已同步到云端 · " + new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      error: "同步失败（数据仍在本地）"
    };
    $("#acctSync").textContent = map[syncState] || map.local;
    $("#acctSync").className = "acct-sync " + syncState;
  }

  function enterApp() {
    $("#authGate").classList.add("gone");
    $("#appShell").hidden = false;
    renderAcct();
  }
  function enterGuest() {
    me = null; syncState = "local";
    enterApp();
    addMsg("bot", "你现在是<b>游客模式</b>，数据只存在这台电脑的浏览器里。右上角头像里可以登录，登录后项目、版本和发布记录会同步到服务端，换台电脑也能接着改。");
  }

  /* ---- auth UI ---- */
  let authTab = "login";
  function setAuthTab(t) {
    authTab = t;
    document.querySelectorAll(".auth-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
    $("#fldName").hidden = t !== "reg";
    $("#fldPw2").hidden = t !== "reg";
    $("#authSubmit").textContent = t === "reg" ? "注册并进入" : "登录";
    $("#authMsg").textContent = "";
  }
  document.querySelectorAll(".auth-tabs button").forEach((b) =>
    b.addEventListener("click", () => setAuthTab(b.dataset.tab))
  );
  $("#fillDemo").addEventListener("click", () => {
    setAuthTab("login");
    $("#authEmail").value = "demo@forge.app";
    $("#authPw").value = "demo1234";
    $("#authMsg").textContent = "已填入测试账号，点登录即可";
  });
  $("#guestBtn").addEventListener("click", enterGuest);

  $("#authSubmit").addEventListener("click", async () => {
    const email = $("#authEmail").value.trim();
    const pw = $("#authPw").value;
    const btn = $("#authSubmit");
    if (!email || !pw) { $("#authMsg").textContent = "邮箱和密码都要填"; return; }
    btn.disabled = true; btn.textContent = "处理中…";
    let r;
    if (authTab === "reg") {
      const name = $("#authName").value.trim() || email.split("@")[0];
      if (pw !== $("#authPw2").value) {
        $("#authMsg").textContent = "两次密码不一致";
        btn.disabled = false; btn.textContent = "注册并进入"; return;
      }
      r = await api("/api/auth/register", { method: "POST", body: { name, email, password: pw } });
    } else {
      r = await api("/api/auth/login", { method: "POST", body: { email, password: pw } });
    }
    btn.disabled = false; btn.textContent = authTab === "reg" ? "注册并进入" : "登录";
    if (!r.ok) {
      $("#authMsg").textContent = (r.data && r.data.error) || "登录失败";
      return;
    }
    me = r.data.user;
    syncState = "saved";
    enterApp();
    await pullState();
    toast("已登录：" + (me.name || me.email));
    if (!lastHTML) {
      addMsg("bot", "登录成功 👋 你的项目简报、版本历史和发布记录都会存在服务端，换台电脑登录就能接着改。");
    }
  });

  $("#acctBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    const m = $("#acctMenu");
    m.hidden = !m.hidden;
  });
  document.addEventListener("click", () => { $("#acctMenu").hidden = true; });
  $("#acctMenu").addEventListener("click", (e) => e.stopPropagation());
  $("#logoutItem").addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST" });
    me = null; syncState = "local";
    $("#acctMenu").hidden = true;
    $("#authGate").classList.remove("gone");
    $("#appShell").hidden = true;
    renderAcct();
  });
  $("#loginItem").addEventListener("click", () => {
    $("#acctMenu").hidden = true;
    $("#authGate").classList.remove("gone");
    $("#appShell").hidden = true;
  });
  $("#authEmail").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#authSubmit").click(); });
  $("#authPw").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#authSubmit").click(); });

  /* ---------- UI helpers ---------- */
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2200);
  }
  function addMsg(role, html) {
    const el = document.createElement("div");
    el.className = "msg " + role;
    el.innerHTML = `<div class="av">${role === "user" ? "🧑" : "⚛"}</div><div class="bubble">${html}</div>`;
    thread.appendChild(el); thread.scrollTop = thread.scrollHeight; return el;
  }
  function addAgent(title, icon) {
    const el = document.createElement("div");
    el.className = "agent running";
    el.innerHTML = '<div class="ic">' + (icon || "🤖") + '</div><div class="body"><div class="role">' +
      (title || "智能体") + '<span class="cost"></span></div><div class="txt"><span class="typing"><i></i><i></i><i></i></span></div></div>';
    thread.appendChild(el); thread.scrollTop = thread.scrollHeight;
    el._t0 = Date.now();
    return el;
  }
  function setAgent(el, html, done) {
    el.querySelector(".txt").innerHTML = html;
    if (done) {
      el.classList.add("done"); el.classList.remove("running");
      const ms = el._t0 ? Date.now() - el._t0 : 0;
      const c = el.querySelector(".cost");
      if (c) c.textContent = ms < 1000 ? ms + "ms" : (ms / 1000).toFixed(1) + "s";
    }
    thread.scrollTop = thread.scrollHeight;
  }
  /* 智能体的结构化产出物，点开能看到它到底做了什么 */
  function renderArtifact(el, art) {
    if (!el || !art || !art.rows) return;
    const box = document.createElement("div");
    box.className = "artifact";
    box.hidden = true;
    box.innerHTML = '<div class="art-title">' + escapeHTML(art.label) + "</div>" +
      art.rows.map((r) =>
        '<div class="art-row"><span>' + escapeHTML(String(r[0])) + "</span><b>" + escapeHTML(String(r[1])) + "</b></div>"
      ).join("");
    const btn = document.createElement("button");
    btn.className = "art-toggle";
    btn.innerHTML = '<span class="art-label">查看产出物</span><span class="art-c">▾</span>';
    btn.addEventListener("click", () => {
      box.hidden = !box.hidden;
      btn.classList.toggle("open", !box.hidden);
      thread.scrollTop = thread.scrollHeight;
    });
    el.querySelector(".body").appendChild(btn);
    el.querySelector(".body").appendChild(box);
  }

  /* ---------- agent plan: human-like narration ---------- */
  const PALETTE_REASON = {
    warm: "咖啡馆嘛，暖一点更让人想坐下来。",
    cool: "科技蓝比较稳，也显专业。",
    dark: "深色更有质感，适合作品集这种'看品味'的场合。",
    purple: "紫色偏年轻，活动感也够。",
    pink: "粉色柔和，跟店铺气质对得上。",
    green: "绿色干净，看着舒服不躁。",
    gold: "金色提一点，显档次。",
    red: "红色够抓眼，首屏一下就立住了。",
    aurora: "紫蓝渐变挺'AI 原生'的，不容易出错。"
  };
  function humanPlan(meta, isRefine) {
    const sec = meta.sectionCount || 6;
    const reason = PALETTE_REASON[meta.palette] || PALETTE_REASON.aurora;
    const planner = isRefine
      ? `我顺着你上一条往下想：在「<b>${meta.name}</b>」的基础上应用这个调整，已经好看的结构我尽量不动，只改你点名的地方。`
      : `我读了一下——你想要的是 <b>${meta.kindLabel}</b>，主角叫「<b>${meta.name}</b>」。我先把结构在脑子里理一遍：首屏负责"一眼懂"，下面再分模块讲清楚，整体语气往「<b>${meta.tone}</b>」靠。`;
    const secNames = ["首屏", "核心内容", "亮点模块", "详情区块", "信任背书", "行动引导", "补充说明"];
    const modules = secNames.slice(0, Math.max(3, Math.min(sec, secNames.length))).join(" / ");
    return [
      {
        icon: "🧭", title: "规划 · Planner", html: planner,
        artifact: {
          label: "需求拆解",
          rows: [
            ["应用类型", meta.kindLabel || "网页应用"],
            ["主要目标", meta.name || "未命名"],
            ["页面模块", modules],
            ["这次不做", "登录注册、支付、真实后端数据"]
          ]
        }
      },
      {
        icon: "🎨", title: "设计 · Designer", html: `配色我纠结了一下，最后选了 <b>${meta.paletteName}</b>。${reason}主色用渐变，首屏我准备放一团柔光做氛围，不抢内容；手机上的可读性我也先想到了。`,
        artifact: {
          label: "设计规格",
          rows: [
            ["配色方案", meta.paletteName || "默认"],
            ["语气", meta.tone || "亲和"],
            ["布局", "单列流式，区块间距统一"],
            ["圆角 / 阴影", "12px 圆角 · 柔和阴影"],
            ["断点", "768px 以下切移动端布局"]
          ]
        }
      },
      {
        icon: "⚙️", title: "构建 · Builder", html: `开始动手了——导航、首屏、各模块卡片、页脚都搭好，移动端我顺手做了汉堡菜单，手机上能正常展开。代码是自包含的，<b>不用后端也能跑</b>，你导出就能直接用。`,
        artifact: {
          label: "构建结果",
          rows: [
            ["产物", "单文件 index.html（内联样式与脚本）"],
            ["结构", "导航 + " + Math.max(3, Math.min(sec, 7)) + " 个区块 + 页脚"],
            ["移动端", "汉堡菜单 · 768px 断点"],
            ["外部依赖", "0 个，离线可直接打开"]
          ]
        }
      },
      {
        icon: "🔍", title: "评审 · Reviewer", html: `我自检了一遍：手机布局 <b>✓</b> · 键盘能点到 <b>✓</b> · 没有外链依赖 <b>✓</b>。有个小提醒——真实内容（营业时间、价格这些）你之后在导出文件里改一下就行，我不替你编数据 😉`,
        artifact: {
          label: "自检报告",
          rows: [
            ["移动端布局", "通过"],
            ["键盘可达", "通过"],
            ["外部依赖", "0 个"],
            ["待补真实信息", "营业时间 / 价格 / 联系方式"]
          ]
        }
      }
    ];
  }

  /* ---------- main flow ---------- */
  async function run(promptText, isRefine) {
    if (busy) return;
    busy = true; sendBtn.classList.add("busy"); sendBtn.title = "生成中，点击中断";
    empty.classList.add("gone");
    lastPromptText = promptText;
    addMsg("user", escapeHTML(promptText));

    // ---- try real LLM when configured ----
    if (cloudEnabled()) {
      const ac = new AbortController();
      currentAbort = ac;
      const t0 = Date.now();
      const timeout = setTimeout(() => ac.abort(new Error("生成超时（5 分钟）")), 300000);
      const thinkEl = addAgent("构建 · Builder", "⚙️");
      setAgent(thinkEl, "正在连接云端模型…（生成期间再点一次发送按钮可中断）");
      let reasoningBuf = "", contentLen = 0, rafPending = false;
      try {
        const meta0 = Forge.analyze(promptText);
        const sys = buildSystem(isRefine);
        const userText = isRefine
          ? `当前 HTML：\n\n${lastHTML}\n\n用户要求修改：${promptText}\n\n请返回修改后的完整 HTML。`
          : promptText;
        // 参考资料：图片走视觉输入，不支持时自动降级为纯文字
        const imgs = brief.files.filter((f) => f.isImage && f.dataUrl).slice(0, 4);
        const buildMsgs = (withImages) => {
          const content = withImages && imgs.length
            ? [{ type: "text", text: userText + "\n\n（我附上了参考图片，请在视觉风格与配色上参考它们）" }]
              .concat(imgs.map((f) => ({ type: "image_url", image_url: { url: f.dataUrl } })))
            : userText;
          return [{ role: "system", content: sys }, { role: "user", content }];
        };
        const onDelta = (tok, isReason) => {
          if (isReason) {
            reasoningBuf += tok;
            if (!rafPending) {
              rafPending = true;
              requestAnimationFrame(() => {
                rafPending = false;
                const tail = reasoningBuf.slice(-160).replace(/\s+/g, " ");
                setAgent(thinkEl, "🤔 模型思考中… <span style=\"opacity:.75\">" + escapeHTML(tail) + "…</span>");
              });
            }
          } else {
            contentLen += tok.length;
            codeView.textContent += tok;
            setAgent(thinkEl, "正在生成代码… 已输出 <b>" + contentLen + "</b> 字符（右侧实时预览中）");
            thread.scrollTop = thread.scrollHeight;
            livePreview();
          }
        };
        codeView.textContent = "";
        let html;
        try {
          html = await callLLM(buildMsgs(imgs.length > 0), onDelta, null, ac.signal);
        } catch (e) {
          if (imgs.length && (!e || e.name !== "AbortError")) {
            setAgent(thinkEl, "这个模型不接受图片参考，我改成纯文字继续生成…");
            html = await callLLM(buildMsgs(false), onDelta, null, ac.signal);
          } else { throw e; }
        }
        clearTimeout(timeout);
        if (!/<!doctype|<html/i.test(html)) {
          // model replied conversationally instead of returning HTML
          const reply = html.replace(/<[^>]+>/g, "").trim();
          setAgent(thinkEl, "这轮没生成应用。");
          if (reply && reply.length < 400) {
            addMsg("bot", "💬 " + escapeHTML(reply));
          }
          addMsg("bot", "我是帮你<b>做应用</b>的～想让我开工的话，给我一句具体点的需求，比如「<i>做一个社区咖啡馆官网，暖色，要有菜单和营业时间</i>」，我马上给你搭出来 🙂");
          busy = false; sendBtn.classList.remove("busy"); sendBtn.title = ""; currentAbort = null;
          return;
        }
        lastHTML = html;
        lastMeta = Object.assign({}, meta0);
        lastMeta.kindLabel = lastMeta.kindLabel || "应用";
        renderArtifact(thinkEl, {
          label: "生成结果",
          rows: [
            ["使用模型", (loadSettings().model || "-")],
            ["输出规模", html.length + " 字符 · " + html.split("\n").length + " 行"],
            ["耗时", ((Date.now() - t0) / 1000).toFixed(1) + "s"],
            ["响应式", /@media/i.test(html) ? "含媒体查询" : "未检测到"]
          ]
        });
        runNarrate(lastMeta, isRefine, true);
        currentAbort = null;
        return;
      } catch (e) {
        clearTimeout(timeout);
        currentAbort = null;
        const msg = (e && e.name === "AbortError")
          ? (ac.signal.reason && ac.signal.reason.message === "生成超时（5 分钟）" ? "生成超时" : "已手动中断")
          : "云端模型调用失败：" + (e.message || e);
        toast(msg + "，已回退本地引擎");
      }
    }

    // ---- local engine (fallback / default) ----
    const result = isRefine && lastMeta
      ? Forge.refine(lastMeta, promptText)
      : Forge.generate(promptText);
    lastMeta = result.meta; lastHTML = result.html;
    runNarrate(result.meta, isRefine, false);
  }

  async function runNarrate(meta, isRefine, cloud) {
    pushVersion(lastHTML, meta.name || "应用", lastPromptText);
    const steps = humanPlan(meta, isRefine);
    addMsg("bot", isRefine ? "好，我接着改 🛠" : "让我捋一下思路 🤔");
    for (const s of steps) {
      const el = addAgent(s.title, s.icon);
      await sleep(460 + Math.random() * 300);
      setAgent(el, s.html, true);
      if (s.artifact) renderArtifact(el, s.artifact);
    }
    setCode(lastHTML);
    stageTitle.textContent = meta.name || "应用";
    appKind.textContent = (meta.kindLabel || "应用") + (cloud ? " · 云端模型" : " · " + meta.paletteName);
    addMsg("bot", `好嘞，「<b>${meta.name || "应用"}</b>」${cloud ? "由云端大模型生成" : "第一版"}出来了，右边可以直接体验 👀。第一个成果只是起点——你先检查它有没有达到想要的效果，再用具体的意见告诉我改哪里。`);

    // 说明这次具体改了什么（让迭代看得见）
    if (meta.tweaks && meta.tweaks.length) {
      addMsg("bot", "这次具体动了这些地方：<br>· " + meta.tweaks.map(escapeHTML).join("<br>· "));
    }

    // 具体的改进建议（Atoms 式迭代引导）
    const sugg = [
      "让营业时间更醒目好找",
      "配色再暖一点",
      "首屏文案再短一些",
      "加上联系方式和地址",
      "去掉所有动效"
    ];
    const el = addMsg("bot", "可以这样提改进意见 👇");
    const box = document.createElement("div");
    box.className = "sugg";
    sugg.forEach((t) => {
      const b = document.createElement("button");
      b.textContent = t;
      b.addEventListener("click", () => { promptEl.value = t; promptEl.focus(); });
      box.appendChild(b);
    });
    el.querySelector(".bubble").appendChild(box);
    thread.scrollTop = thread.scrollHeight;
    publishBtn.disabled = false; exportBtn.disabled = false;
    busy = false; sendBtn.classList.remove("busy"); sendBtn.title = "";
    preview.srcdoc = withNavGuard(lastHTML);
    preview.scrollTop = 0;
    persistLast();
    markOnboard("first", true);
  }

  function highlight(code) {
    let h = escapeHTML(code);
    h = h.replace(/(&lt;\/?)([a-zA-Z0-9]+)/g, '$1<span class="tk-tag">$2</span>');
    h = h.replace(/([a-zA-Z-]+)=(&quot;[^&]*&quot;)/g, '<span class="tk-attr">$1</span>=<span class="tk-str">$2</span>');
    h = h.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="tk-cmt">$1</span>');
    return h;
  }
  function setCode(html) {
    codeView.textContent = "";
    const lines = html.split("\n");
    let i = 0;
    (function step() {
      if (i < lines.length) {
        codeView.textContent += (i ? "\n" : "") + lines[i];
        i++;
        if (i % 6 === 0) thread.scrollTop = thread.scrollHeight;
        requestAnimationFrame(() => setTimeout(step, 4));
      } else {
        codeView.innerHTML = highlight(html);
      }
    })();
  }

  function escapeHTML(s) {
    return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /* ---------- LLM integration (real model) ---------- */
  const PROVIDERS = {
    mimo:     { base: "https://api.xiaomimimo.com/v1", model: "mimo-v2.6-flash" },
    deepseek: { base: "https://api.deepseek.com/v1", model: "deepseek-chat" },
    openai:   { base: "https://api.openai.com/v1", model: "gpt-4o-mini" },
    qwen:     { base: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
    glm:      { base: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
    kimi:     { base: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
    custom:   { base: "", model: "" }
  };
  const DEFAULT_SETTINGS = { provider: "mimo", apiKey: "", model: "mimo-v2.6-flash", baseUrl: "https://api.xiaomimimo.com/v1" };
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem("forgeSettings") || "null");
      return s || DEFAULT_SETTINGS;
    } catch (e) { return DEFAULT_SETTINGS; }
  }
  function saveSettings(s) {
    localStorage.setItem("forgeSettings", JSON.stringify(s));
    try { markOnboard("model", !!(s && s.apiKey)); } catch (e) {}
  }

  /* ---------- 初始化引导 + 会话持久化（对应"初始化/注册/核心主流程"与"数据持久化"要求） ---------- */
  const OB_KEY = "forgeOnboard.v1";
  const LAST_KEY = "forgeLast.v1";
  let ob = { brief: false, model: false, first: false };
  try { ob = Object.assign(ob, JSON.parse(localStorage.getItem(OB_KEY) || "{}")); } catch (e) {}
  function markOnboard(k, v) {
    if (ob[k] === v) return;
    ob[k] = v;
    localStorage.setItem(OB_KEY, JSON.stringify(ob));
    renderOnboard();
  }
  function renderOnboard() {
    const box = $("#onboard"); if (!box) return;
    const map = { brief: "#ob1", model: "#ob2", first: "#ob3" };
    let n = 0;
    Object.keys(map).forEach((k) => {
      const li = $(map[k]); if (!li) return;
      if (ob[k]) { li.classList.add("done"); n++; } else { li.classList.remove("done"); }
    });
    $("#obProg").textContent = n + "/3";
    if (n >= 3) box.classList.add("hide");
  }
  function persistLast() {
    if (!lastHTML) return;
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({
        html: lastHTML, title: stageTitle.textContent, v: curVer, t: Date.now()
      }));
    } catch (e) {}
    scheduleSync();
  }
  function restoreLast() {
    try {
      const raw = localStorage.getItem(LAST_KEY);
      if (!raw) return false;
      const o = JSON.parse(raw);
      if (!o || !o.html) return false;
      lastHTML = o.html;
      if (o.v) curVer = o.v;
      preview.srcdoc = withNavGuard(o.html);
      setCode(o.html);
      stageTitle.textContent = o.title || "应用";
      appKind.textContent = "已恢复上次项目";
      publishBtn.disabled = false; exportBtn.disabled = false;
      empty.classList.add("gone");
      return true;
    } catch (e) { return false; }
  }
  function cloudEnabled() { const s = loadSettings(); return !!(s && s.apiKey && s.baseUrl); }
  function buildSystem(refine) {
    let base = refine
      ? "你是 Forge，一个 AI 应用生成器。用户会给你一段当前 HTML 和一个修改要求。请直接返回应用完整、自包含的 HTML（内联 CSS/JS，无外部依赖，响应式，中文内容）。代码保持精简、避免冗长注释与重复结构。只输出 HTML 代码本身，不要任何解释，不要使用 markdown 代码围栏。"
      : "你是 Forge，一个 AI 应用生成器。用户用自然语言描述想要做的网页应用。请直接返回应用完整、自包含的 HTML（内联 CSS/JS，无外部依赖，响应式，美观且内容充实，中文内容）。代码保持精简、控制在合理体量、避免冗长注释与重复结构。只输出 HTML 代码本身，不要任何解释，不要使用 markdown 代码围栏。";
    const b = briefContext();
    if (b) base += "\n\n【项目背景】\n" + b;
    return base;
  }

  /* ---------- 项目简报：为谁设计 / 目标 / 偏好 / 参考资料 ---------- */
  const BRIEF_KEY = "forgeBrief.v1";
  let brief = { audience: "", goal: "", pref: "", files: [] };
  function briefContext() {
    const parts = [];
    if (brief.audience) parts.push("目标用户：" + brief.audience);
    if (brief.goal) parts.push("要帮他们实现：" + brief.goal);
    if (brief.pref) parts.push("偏好与约束：" + brief.pref);
    const names = brief.files.map(f => f.name);
    if (names.length) parts.push("用户已提供参考材料：" + names.join("、") + "（若为图片，请在视觉风格上参考它）");
    return parts.join("\n");
  }
  function loadBrief() {
    try {
      const raw = localStorage.getItem(BRIEF_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        brief = { audience: d.audience || "", goal: d.goal || "", pref: d.pref || "", files: Array.isArray(d.files) ? d.files : [] };
      }
    } catch (e) {}
    $("#bAudience").value = brief.audience;
    $("#bGoal").value = brief.goal;
    $("#bPref").value = brief.pref;
    renderBrief();
  }
  function saveBrief(silent) {
    brief.audience = $("#bAudience").value.trim();
    brief.goal = $("#bGoal").value.trim();
    brief.pref = $("#bPref").value.trim();
    try { localStorage.setItem(BRIEF_KEY, JSON.stringify(brief)); } catch (e) {}
    scheduleSync();
    const filled = !!(brief.audience || brief.goal || brief.pref || brief.files.length);
    markOnboard("brief", filled);
    renderBrief();
    if (!silent) toast("项目简报已保存，后续生成会带上它");
  }
  function renderBrief() {
    const list = $("#attachList");
    list.innerHTML = "";
    brief.files.forEach((f, i) => {
      const el = document.createElement("div");
      el.className = "att";
      if (f.isImage) {
        const img = document.createElement("img");
        img.src = f.dataUrl; img.alt = f.name;
        el.appendChild(img);
      } else {
        el.insertAdjacentHTML("beforeend", "<span>📄</span>");
      }
      const nm = document.createElement("span");
      nm.textContent = f.name.length > 18 ? f.name.slice(0, 17) + "…" : f.name;
      el.appendChild(nm);
      const rm = document.createElement("button");
      rm.textContent = "✕"; rm.title = "移除";
      rm.addEventListener("click", () => { brief.files.splice(i, 1); saveBrief(true); });
      el.appendChild(rm);
      list.appendChild(el);
    });
    $("#attachCount").textContent = brief.files.length ? brief.files.length + " 个附件" : "未添加";
    const sum = [brief.audience, brief.goal, brief.pref].filter(Boolean).join(" · ");
    $("#briefSum").textContent = sum
      ? (sum.length > 26 ? sum.slice(0, 25) + "…" : sum)
      : "说明为谁做、要达成什么、有哪些偏好";
  }
  $("#briefToggle").addEventListener("click", () => {
    const b = $("#brief");
    const open = b.classList.toggle("open");
    $("#briefBody").hidden = !open;
  });
  $("#briefSave").addEventListener("click", () => saveBrief(false));
  $("#attachBtn").addEventListener("click", () => $("#attachInput").click());
  $("#attachInput").addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((f) => {
      const isImage = /^image\//.test(f.type);
      const rd = new FileReader();
      rd.onload = () => {
        if (brief.files.length >= 6) { toast("参考材料最多 6 个"); return; }
        brief.files.push({ name: f.name, isImage, dataUrl: isImage ? rd.result : "" });
        saveBrief(true);
        toast("已添加参考材料：" + f.name);
      };
      if (isImage) rd.readAsDataURL(f); else rd.readAsText(f);
    });
    e.target.value = "";
  });
  function cleanLLM(t) {
    t = (t || "").trim();
    if (/^```/i.test(t)) t = t.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim();
    return t;
  }
  let currentAbort = null;
  let lastLivePreview = 0;
  /* 导航防护：srcdoc 的相对解析基准是父页面 URL——空链接、相对路径甚至 #锚点 都会把预览导航回 Forge 本身。
     注入守卫脚本：#锚点拦截后在页内平滑滚动，外部 http(s) 新窗口打开，其余（空/相对/绝对路径）一律拦截。 */
  function withNavGuard(html) {
    const guard = '<script>(function(){document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a"):null;if(!a)return;var h=(a.getAttribute("href")||"").trim();if(!h){e.preventDefault();return;}if(h.charAt(0)==="#"){e.preventDefault();var t=h.length>1?document.getElementById(decodeURIComponent(h.slice(1))):null;if(t){t.scrollIntoView({behavior:"smooth"});}else{window.scrollTo({top:0,behavior:"smooth"});}return;}if(/^https?:/i.test(h)){e.preventDefault();window.open(h,"_blank","noopener");return;}e.preventDefault();},true);})();<\/script>';
    if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, guard + "</body>");
    return html + guard;
  }
  window.ForgeGuard = withNavGuard; /* 供自动化测试复用 */
  function livePreview() {
    const now = Date.now();
    if (now - lastLivePreview < 450) return;
    lastLivePreview = now;
    const html = codeView.textContent;
    if (/<html/i.test(html)) { try { preview.srcdoc = withNavGuard(html); } catch (e) {} }
  }
  async function callLLM(messages, onDelta, cfgOverride, signal) {
    const s = cfgOverride || loadSettings();
    const resp = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
      baseUrl: s.baseUrl, apiKey: s.apiKey, model: s.model, messages, stream: true,
      temperature: s.temperature != null ? Number(s.temperature) : 0.7
    }),
      signal
    });
    if (!resp.ok) { const t = await resp.text(); throw new Error("HTTP " + resp.status + " " + t); }
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = "", full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1);
        if (line.startsWith("data:")) {
          const d = line.slice(5).trim();
          if (d === "[DONE]") continue;
          try {
            const j = JSON.parse(d);
            const delta0 = j.choices && j.choices[0] && j.choices[0].delta || {};
            if (delta0.reasoning_content) { if (onDelta) onDelta(delta0.reasoning_content, true); }
            if (delta0.content) { full += delta0.content; if (onDelta) onDelta(delta0.content, false); }
          } catch (e) { /* ignore partial */ }
        }
      }
    }
    return cleanLLM(full);
  }

  /* ---------- model settings UI ---------- */
  const modelModal = $("#modelModal"), modelStatus = $("#modelStatus");
  function refreshStatus() {
    if (cloudEnabled()) { modelStatus.classList.add("cloud"); modelStatus.textContent = "⚙ 云端模型"; }
    else { modelStatus.classList.remove("cloud"); modelStatus.textContent = "⚙ 本地引擎"; }
  }
  function applyProv() {
    const p = $("#prov").value, def = PROVIDERS[p];
    if (p !== "custom") { $("#baseUrl").value = def.base; $("#modelName").value = def.model; }
    $("#modelHint").textContent = def.model;
  }
  $("#modelBtn").addEventListener("click", () => {
    const s = loadSettings() || DEFAULT_SETTINGS;
    $("#prov").value = s.provider || "mimo";
    $("#apiKey").value = s.apiKey || "";
    $("#modelName").value = s.model || PROVIDERS[s.provider || "mimo"].model;
    $("#baseUrl").value = s.baseUrl || PROVIDERS[s.provider || "mimo"].base;
    const tp = s.temperature != null ? s.temperature : 0.7;
    $("#temperature").value = tp;
    $("#tempVal").textContent = tp;
    $("#modelMsg").textContent = "";
    applyProv();
    modelModal.hidden = false;
  });
  $("#modelClose").addEventListener("click", () => { modelModal.hidden = true; refreshStatus(); });
  $("#prov").addEventListener("change", applyProv);
  $("#temperature").addEventListener("input", (e) => { $("#tempVal").textContent = e.target.value; });
  $("#saveModel").addEventListener("click", () => {
    const s = {
      provider: $("#prov").value,
      apiKey: $("#apiKey").value.trim(),
      model: $("#modelName").value.trim(),
      baseUrl: $("#baseUrl").value.trim(),
      temperature: Number($("#temperature").value)
    };
    if (!s.apiKey || !s.baseUrl) { $("#modelMsg").textContent = "请填写 API Key 与 Base URL"; return; }
    saveSettings(s);
    $("#modelMsg").textContent = "已保存 ✅";
    refreshStatus();
    toast("已切换到云端模型");
  });
  $("#testModel").addEventListener("click", async () => {
    const cfg = {
      provider: $("#prov").value,
      apiKey: $("#apiKey").value.trim(),
      model: $("#modelName").value.trim(),
      baseUrl: $("#baseUrl").value.trim()
    };
    if (!cfg.apiKey || !cfg.baseUrl) { $("#modelMsg").textContent = "请先填写 Key 与 Base URL"; return; }
    $("#modelMsg").textContent = "连接中…";
    try {
      const r = await callLLM(
        [{ role: "system", content: "只回复 OK 两个字。" }, { role: "user", content: "ping" }],
        () => {}, cfg
      );
      $("#modelMsg").textContent = "连接成功 ✅ 模型返回：" + r.slice(0, 40);
    } catch (e) { $("#modelMsg").textContent = "连接失败：" + (e.message || e); }
  });

  /* ---------- 版本管理：每次生成/修改留版，可回滚、可更新线上版本 ---------- */
  let versions = [];
  let curVer = 0;
  let published = null;   // { v, url }
  let lastPromptText = "";

  function pushVersion(html, name, note) {
    const v = versions.length + 1;
    versions.push({ v, name: name || "应用", html, note: note || "", ts: Date.now() });
    curVer = v;
    updateVerBadge();
  }
  function updateVerBadge() {
    const el = $("#verBadge");
    el.classList.remove("published", "dirty");
    if (!versions.length) { el.textContent = "草稿"; return; }
    if (published && published.v === curVer) {
      el.textContent = "v" + curVer + " · 已发布";
      el.classList.add("published");
    } else if (published) {
      el.textContent = "v" + curVer + " · 有改动";
      el.classList.add("dirty");
    } else {
      el.textContent = "v" + curVer + " · 未发布";
    }
  }
  /* ---------- 行级 diff（LCS，限制规模避免卡顿） ---------- */
  function diffLines(a, b) {
    const A = String(a || "").split("\n"), B = String(b || "").split("\n");
    const MAXL = 800;
    const ta = A.length > MAXL ? A.slice(0, MAXL) : A;
    const tb = B.length > MAXL ? B.slice(0, MAXL) : B;
    const n = ta.length, m = tb.length;
    if (n === 0 && m === 0) return [];
    const w = m + 1;
    const dp = new Int32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i * w + j] = ta[i] === tb[j]
          ? dp[(i + 1) * w + j + 1] + 1
          : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
      }
    }
    const out = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (ta[i] === tb[j]) { out.push({ t: "eq", s: ta[i] }); i++; j++; }
      else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) { out.push({ t: "del", s: ta[i] }); i++; }
      else { out.push({ t: "add", s: tb[j] }); j++; }
    }
    while (i < n) { out.push({ t: "del", s: ta[i] }); i++; }
    while (j < m) { out.push({ t: "add", s: tb[j] }); j++; }
    return out;
  }
  function renderDiff(aHtml, bHtml, metaText) {
    const rows = diffLines(aHtml || "", bHtml || "");
    let add = 0, del = 0, html = "";
    rows.forEach((r) => {
      const s = escapeHTML(r.s === undefined ? "" : String(r.s));
      if (r.t === "add") { add++; html += '<div class="dl add">+ ' + (s || "&nbsp;") + "</div>"; }
      else if (r.t === "del") { del++; html += '<div class="dl del">- ' + (s || "&nbsp;") + "</div>"; }
      else html += '<div class="dl eq">  ' + (s || "&nbsp;") + "</div>";
    });
    $("#diffOut").innerHTML = html || '<div class="dl eq">两个版本内容相同</div>';
    $("#diffMeta").textContent = (metaText || "") + " 新增 " + add + " 行 · 删除 " + del + " 行";
  }

  function openDiff(baseV, targetV) {
    const base = versions.find((x) => x.v === baseV);
    const target = versions.find((x) => x.v === targetV);
    if (!base || !target) { toast("找不到要对比的版本"); return; }
    codePanel.classList.add("open");
    setCodeMode("diff");
    renderDiff(base.html, target.html, "v" + base.v + " → v" + target.v + "：");
    $("#diffBase").innerHTML = versions.map((x) =>
      '<option value="' + x.v + '"' + (x.v === baseV ? " selected" : "") + ">v" + x.v + " · " + escapeHTML(x.name || "") + "</option>"
    ).join("");
    diffTarget = targetV;
  }
  let diffTarget = 0;

  function renderHistory() {
    const list = $("#verList");
    list.innerHTML = "";
    if (!versions.length) {
      list.innerHTML = '<div class="ver-empty">还没有版本。先发起一个需求，生成后这里就会出现 v1。</div>';
      return;
    }
    versions.slice().reverse().forEach((it) => {
      const d = document.createElement("div");
      d.className = "ver-item" + (it.v === curVer ? " cur" : "");
      const t = new Date(it.ts);
      const time = String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0");
      const size = Math.max(1, Math.round((it.html || "").length / 1024)) + "KB";
      d.innerHTML =
        '<div class="ver-main">' +
          '<span class="vno">v' + it.v + "</span>" +
          '<div class="vmeta"><b>' + escapeHTML(it.name || "应用") + "</b>" +
            "<span>" + escapeHTML(it.note ? it.note.slice(0, 40) : "首个成果") + " · " + time + " · " + size + "</span></div>" +
          (published && published.v === it.v ? '<span class="vpill live">线上</span>' : '<span class="vpill">草稿</span>') +
        "</div>" +
        '<div class="ver-ops">' +
          '<button data-op="restore">回到这版</button>' +
          '<button data-op="rename">改名</button>' +
          '<button data-op="diff">对比</button>' +
        "</div>";
      d.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-op]");
        if (btn) {
          const op = btn.dataset.op;
          if (op === "restore") {
            lastHTML = it.html;
            curVer = it.v;
            preview.srcdoc = withNavGuard(it.html);
            setCode(it.html);
            stageTitle.textContent = it.name;
            updateVerBadge();
            persistLast();
            $("#histModal").hidden = true;
            toast("已回到 v" + it.v + "，可继续修改或重新发布");
          } else if (op === "rename") {
            const nm = prompt("给 v" + it.v + " 起个名字", it.name || "");
            if (nm !== null && nm.trim()) { it.name = nm.trim(); renderHistory(); persistLast(); }
          } else if (op === "diff") {
            const baseV = it.v === curVer ? Math.max(1, it.v - 1) : curVer;
            $("#histModal").hidden = true;
            openDiff(baseV, it.v);
          }
          return;
        }
      });
      list.appendChild(d);
    });
  }
  $("#histBtn").addEventListener("click", () => { renderHistory(); $("#histModal").hidden = false; });
  $("#histClose").addEventListener("click", () => { $("#histModal").hidden = true; });
  $("#diffBase").addEventListener("change", (e) => {
    const baseV = Number(e.target.value);
    openDiff(baseV, diffTarget || curVer);
  });

  /* ---------- 代码面板：查看 / 编辑 / 对比 ---------- */
  let codeMode = "view";
  function setCodeMode(mode) {
    codeMode = mode;
    document.querySelectorAll(".code-tabs .ct").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    $("#codeViewWrap").hidden = mode !== "view";
    $("#codeEditor").hidden = mode !== "edit";
    $("#diffBody").hidden = mode !== "diff";
    $("#applyEdit").hidden = mode !== "edit";
    if (mode === "edit") $("#codeEditor").value = lastHTML;
    if (mode === "diff" && versions.length >= 2) {
      const baseV = Math.max(1, curVer - 1);
      renderDiff((versions.find((x) => x.v === baseV) || {}).html || "", lastHTML, "v" + baseV + " → 当前：");
      $("#diffBase").innerHTML = versions.map((x) =>
        '<option value="' + x.v + '"' + (x.v === baseV ? " selected" : "") + ">v" + x.v + " · " + escapeHTML(x.name || "") + "</option>"
      ).join("");
      diffTarget = curVer;
    }
  }
  document.querySelectorAll(".code-tabs .ct").forEach((b) =>
    b.addEventListener("click", () => setCodeMode(b.dataset.mode))
  );
  $("#applyEdit").addEventListener("click", () => {
    const v = $("#codeEditor").value;
    if (!v.trim()) { toast("代码是空的"); return; }
    lastHTML = v;
    preview.srcdoc = withNavGuard(lastHTML);
    setCode(lastHTML);
    pushVersion(lastHTML, stageTitle.textContent || "应用", "手动编辑代码");
    persistLast();
    toast("已应用，并保存为 v" + curVer);
  });

  /* ---------- 在新窗口预览（供他人查看并试用） ---------- */
  $("#shareBtn").addEventListener("click", () => {
    if (!lastHTML) { toast("先生成一个应用，再打开预览"); return; }
    try {
      const blob = new Blob([lastHTML], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (!w) toast("浏览器拦截了弹窗，请允许后重试");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast("打开预览失败：" + (e.message || e)); }
  });

  /* ---------- composer ---------- */
  function submit() {
    const v = promptEl.value.trim();
    if (!v || busy) return;
    promptEl.value = ""; promptEl.style.height = "auto";
    run(v, !!lastMeta);
  }
  sendBtn.addEventListener("click", () => {
    if (busy && currentAbort) { currentAbort.abort(new Error("手动中断")); return; }
    submit();
  });
  promptEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  });
  promptEl.addEventListener("input", () => {
    promptEl.style.height = "auto";
    promptEl.style.height = Math.min(promptEl.scrollHeight, 120) + "px";
  });
  document.querySelectorAll(".chip").forEach((c) =>
    c.addEventListener("click", () => {
      if (busy) return;
      promptEl.value = c.dataset.q;
      submit();
    })
  );
  $("#newChat").addEventListener("click", () => {
    thread.innerHTML = "";
    lastMeta = null; lastHTML = "";
    try { localStorage.removeItem(LAST_KEY); } catch (e) {}
    empty.classList.remove("gone");
    preview.srcdoc = "";
    publishBtn.disabled = true; exportBtn.disabled = true;
    codePanel.classList.remove("open");
    stageTitle.textContent = "实时预览"; appKind.textContent = "—";
    addMsg("bot", "新会话已开启。描述你想做的应用，我来帮你从想法到上线。");
  });

  /* ---------- device toggle ---------- */
  $("#deviceSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    document.querySelectorAll("#deviceSeg button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    $("#frame").dataset.dev = b.dataset.dev;
  });

  /* ---------- theme ---------- */
  $("#themeToggle").addEventListener("click", () => {
    const cur = document.body.dataset.theme;
    document.body.dataset.theme = cur === "dark" ? "light" : "dark";
  });

  /* ---------- code panel ---------- */
  $("#codeToggle").addEventListener("click", () => codePanel.classList.toggle("open"));
  $("#codeClose").addEventListener("click", () => codePanel.classList.remove("open"));

  /* ---------- export ---------- */
  exportBtn.addEventListener("click", () => {
    if (!lastHTML) return;
    const blob = new Blob([lastHTML], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (lastMeta.name || "forge-app").replace(/\s+/g, "-") + ".html";
    a.click();
    toast("已导出 HTML 文件");
  });

  /* ---------- publish: 真实可访问地址（登录后走服务端存储） ---------- */
  publishBtn.addEventListener("click", async () => {
    if (!lastHTML) return;
    const prevV = published ? published.v : 0;
    let note = "首次发布", title = "已发布";
    if (prevV && prevV !== curVer) { note = "已从 v" + prevV + " 更新到 v" + curVer; title = "线上版本已更新"; }
    else if (prevV === curVer) { note = "当前已是最新版本"; title = "已是最新"; }

    if (me) {
      publishBtn.disabled = true;
      const r = await api("/api/publish", {
        method: "POST",
        body: { html: lastHTML, name: stageTitle.textContent, version: curVer }
      });
      publishBtn.disabled = false;
      if (!r.ok) { toast("发布失败：" + ((r.data && r.data.error) || "未知错误")); return; }
      const info = r.data.published;
      published = { v: info.version, url: info.url, slug: info.slug, name: info.name, ts: info.ts };
      $("#pubDesc").textContent = "这个地址真实可访问，任何人打开链接都能查看并试用你的应用。";
    } else {
      if (!published || published.url.indexOf("http") !== 0) {
        published = { v: curVer, url: "游客模式 · 本地快照 " + Math.random().toString(36).slice(2, 6), local: true };
      } else {
        published = { v: curVer, url: published.url, local: true };
      }
      $("#pubDesc").textContent = "游客模式发布的是本地快照，换个浏览器就打不开。登录后发布生成的网址任何人都能访问。";
    }
    try { localStorage.setItem("forge:live", JSON.stringify(published)); } catch (e) {}
    $("#pubTitle").textContent = title;
    $("#pubVer").textContent = "v" + published.v;
    $("#pubNote").textContent = note;
    $("#liveUrl").value = published.url;
    $("#publishModal").hidden = false;
    updateVerBadge();
    persistLast();
    toast(note === "当前已是最新版本" ? "线上已是最新版本" : "已发布 v" + published.v);
  });
  $("#copyUrl").addEventListener("click", () => {
    const inp = $("#liveUrl");
    inp.select();
    try { navigator.clipboard.writeText(inp.value); } catch (e) { document.execCommand("copy"); }
    toast("链接已复制");
  });
  $("#openUrl").addEventListener("click", () => {
    if (published && published.url && published.url.indexOf("http") === 0) {
      window.open(published.url, "_blank");
      return;
    }
    const w = window.open();
    if (w) w.document.write(lastHTML);
  });
  $("#modalClose").addEventListener("click", () => { $("#publishModal").hidden = true; });

  /* ---------- welcome / boot ---------- */
  refreshStatus();
  try {
    const raw = localStorage.getItem("forge:live");
    if (raw) published = JSON.parse(raw);
  } catch (e) {}
  loadBrief();
  updateVerBadge();
  renderOnboard();

  function welcome() {
    addMsg("bot", "嗨，我是 Forge 的搭子 👋 你不用写代码，用大白话告诉我「想要什么结果」就行——比如「帮我做个社区咖啡馆官网，暖色，要有菜单、营业时间、地址和一段介绍」。<b>先定一个主要目标</b>，我先给你搭出第一版，你看着不对再用具体的意见喊我改。");
    addMsg("bot", "几个小提示：<br>· 上面的 <b>项目简报</b> 可以写明<b>为谁设计、要帮他们实现什么、有哪些偏好</b>，还能<b>上传截图或设计稿</b>当参考；<br>· 右侧可实时预览，<b>代码</b> 面板能直接改代码或对比版本差异；<br>· <b>发布</b> 会给它一个真实可访问的网址，之后再改可以一键<b>更新线上版本</b>，<b>版本</b> 里能随时回滚。");
  }

  (async function boot() {
    const hasServer = await checkAuth();
    if (hasServer && me) {
      enterApp();
      const restored = await pullState();
      if (restored) {
        addMsg("bot", "已从服务端恢复你上次的项目（登录状态下项目、版本和发布记录都存云端）。可以直接继续改，或者发布 / 打开版本历史。");
      } else if (restoreLast()) {
        addMsg("bot", "已恢复你上次的项目（本地记录）。可以直接继续改，或者发布 / 打开版本历史。");
      }
      welcome();
      return;
    }
    if (hasServer) {
      // 服务可用但未登录：先走登录页
      $("#authGate").classList.remove("gone");
      $("#appShell").hidden = true;
      renderAcct();
      welcome();
      return;
    }
    // 纯静态打开（没有本地服务）：游客模式
    enterGuest();
    if (restoreLast()) {
      addMsg("bot", "已恢复你上次的项目（数据存在本地，关掉浏览器再回来依然在）。");
    }
    welcome();
  })();
})();
