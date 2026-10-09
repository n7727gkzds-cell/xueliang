/* ============================================================
   Forge · Generation Engine
   A local, intent-driven "AI agent" that turns a natural-language
   prompt into a self-contained, runnable web app (HTML+CSS+JS).
   No external API required — fully offline & extensible.
   ============================================================ */
(function (global) {
  "use strict";

  /* ---------- palette library ---------- */
  const PALETTES = {
    aurora:  { name:"极光紫蓝", p:"#7c5cff", p2:"#22d3ee", bg:"#0e1020", card:"#181b2e", txt:"#eef1ff", sub:"#a9b0d6", grad:"linear-gradient(135deg,#7c5cff,#22d3ee)" },
    warm:    { name:"暖阳橘棕", p:"#ff7a45", p2:"#ffb454", bg:"#1c1208", card:"#2a1c10", txt:"#fff6ec", sub:"#e7c3a6", grad:"linear-gradient(135deg,#ff7a45,#ffb454)" },
    cool:    { name:"科技蓝青", p:"#2f7bff", p2:"#21d4c4", bg:"#07101c", card:"#0f1d31", txt:"#eaf3ff", sub:"#a9c4e6", grad:"linear-gradient(135deg,#2f7bff,#21d4c4)" },
    red:     { name:"赤焰红",   p:"#ff4d6d", p2:"#ff8a5b", bg:"#1d0a10", card:"#2c111a", txt:"#ffeef2", sub:"#e6b3c0", grad:"linear-gradient(135deg,#ff4d6d,#ff8a5b)" },
    green:   { name:"松林绿",   p:"#1fbf75", p2:"#7be495", bg:"#08160f", card:"#0f241a", txt:"#ecfff4", sub:"#a9d8c2", grad:"linear-gradient(135deg,#1fbf75,#7be495)" },
    purple:  { name:"葡萄紫",   p:"#9b5cff", p2:"#d98bff", bg:"#140a20", card:"#221338", txt:"#f6ecff", sub:"#c9b0e6", grad:"linear-gradient(135deg,#9b5cff,#d98bff)" },
    pink:    { name:"樱粉",     p:"#ff6fae", p2:"#ffa6cf", bg:"#1d0c16", card:"#2c1224", txt:"#fff0f7", sub:"#e6b3cf", grad:"linear-gradient(135deg,#ff6fae,#ffa6cf)" },
    gold:    { name:"流金",     p:"#e0a93b", p2:"#ffe08a", bg:"#1a1405", card:"#26200c", txt:"#fff8e6", sub:"#e6cf9b", grad:"linear-gradient(135deg,#e0a93b,#ffe08a)" },
    dark:    { name:"暗夜高级灰", p:"#cfd6e6", p2:"#8a93b0", bg:"#0a0c12", card:"#14171f", txt:"#f2f4fa", sub:"#9aa3bd", grad:"linear-gradient(135deg,#3a4256,#1b2030)" }
  };

  const TYPE_LABEL = {
    portfolio:"个人作品集", cafe:"品牌官网 / 咖啡馆", landing:"产品落地页",
    dashboard:"数据看板", event:"活动 / 会议", blog:"博客 / 内容站",
    tool:"互动小工具", shop:"电商 / 店铺"
  };

  /* ---------- 1. analyze prompt ---------- */
  function analyze(text) {
    const t = (text || "").toLowerCase();
    const meta = { raw:text, type:"landing", name:"", palette:"aurora", sections:[], tone:"现代简洁", interactive:[] };

    // type detection
    const rules = [
      { k:["作品集","简历","portfolio","个人主页","个人网站","cv","showcase"], t:"portfolio" },
      { k:["咖啡","餐厅","cafe","restaurant","菜单","menu","餐馆","小馆","烘焙"], t:"cafe" },
      { k:["活动","会议","大会","event","沙龙","展会","峰会","summit","发布会","日程","嘉宾","议程","报名"], t:"event" },
      { k:["看板","仪表","dashboard","数据","报表","大屏","指标","运营分析"], t:"dashboard" },
      { k:["落地页","landing","产品页","官网","首页","主页","介绍页","saas"], t:"landing" },
      { k:["博客","blog","文章","周刊","内容站","杂志"], t:"blog" },
      { k:["待办","todo","工具","小工具","计算器","tool","小应用","倒计时"], t:"tool" },
      { k:["商城","商店","shop","store","电商","商品","店铺","小店","购物"], t:"shop" }
    ];
    for (const r of rules) { if (r.k.some(w => t.includes(w))) { meta.type = r.t; break; } }

    // name extraction
    let name = "";
    const namePatterns = [
      /(?:叫|名为|名叫|名称是|名字是|name[:：]\s*)\s*["']?([^\s，。,."'：:]+)/i,
      /为\s*["']?([^""\s，。的]+?)["']?\s*(?:做|开发|搭建|建设|制作|设计|写|搞|弄)/,
      /[""]([^""]{2,16})[""]/,
      /「([^」]{2,16})」/,
      /《([^》]{2,16})》/
    ];
    for (const p of namePatterns) { const m = text.match(p); if (m) { name = m[1].replace(/[，。的做开发搭建建设制作设计写搞弄]$/,""); break; } }
    const defaults = { portfolio:"林夕的设计工作台", cafe:"暖屋咖啡 WarmHut", landing:"Nova 云协作平台", dashboard:"增长运营看板", event:"2026 创作者大会", blog:"拾光周刊", tool:"专注番茄钟", shop:"木与光生活馆" };
    meta.name = name || defaults[meta.type];

    // palette detection
    const palRules = [
      { k:["暖","warm","橙","橘","orange","咖啡","烘焙","棕"], v:"warm" },
      { k:["冷","cool","蓝","青","blue","科技"], v:"cool" },
      { k:["红","red","赤"], v:"red" },
      { k:["绿","green","翠","松"], v:"green" },
      { k:["紫","purple","violet","靛"], v:"purple" },
      { k:["粉","pink","樱"], v:"pink" },
      { k:["金","gold","黄","流金"], v:"gold" },
      { k:["黑","暗","dark","高级","酷","黑金","极简"], v:"dark" }
    ];
    for (const r of palRules) { if (r.k.some(w => t.includes(w))) { meta.palette = r.v; break; } }
    // type-based sensible default palette nudge
    if (meta.palette === "aurora") {
      if (meta.type === "cafe") meta.palette = "warm";
      else if (meta.type === "landing" || meta.type === "dashboard") meta.palette = "cool";
      else if (meta.type === "portfolio") meta.palette = "dark";
      else if (meta.type === "event") meta.palette = "purple";
      else if (meta.type === "shop") meta.palette = "pink";
    }

    // tone
    if (/(高级|奢华|高端|premium| luxury)/.test(t)) meta.tone = "高端奢华";
    else if (/(可爱|萌|活泼|fun| playful)/.test(t)) meta.tone = "活泼可爱";
    else if (/(商务|专业|b2b|企业|严肃)/.test(t)) meta.tone = "专业商务";
    else if (/(极简|简洁|minimal)/.test(t)) meta.tone = "极简克制";

    // explicit section requests
    const secMap = {
      menu:["菜单","menu","菜品"], hours:["营业时间","opening","营业"], location:["地址","位置","location","地址"],
      story:["故事","品牌故事","about","历程"], contact:["联系","contact","客服"], team:["团队","team","成员"],
      price:["价格","定价","pricing","报价"], faq:["常见问题","faq","答疑"], feature:["功能","feature"],
      schedule:["日程","议程","agenda","安排"], speaker:["嘉宾","speaker","讲师"], project:["项目","作品","project"],
      skill:["技能","skill"], post:["文章","post"], product:["商品","product"], chart:["图表","趋势","chart"]
    };
    const wanted = new Set();
    for (const key in secMap) { if (secMap[key].some(w => t.includes(w))) wanted.add(key); }
    meta.sections = [...wanted];

    // interactive hints
    if (/(手机|移动|mobile|响应式|phone)/.test(t)) meta.interactive.push("mobileMenu");
    if (meta.type === "tool") meta.interactive.push("widget");
    if (meta.type === "shop") meta.interactive.push("cart");

    return meta;
  }

  /* ---------- 2. shared CSS + components ---------- */
  function appShell(meta, bodyHTML, extraJS) {
    const c = PALETTES[meta.palette];
    const css = `
:root{--p:${c.p};--p2:${c.p2};--bg:${c.bg};--card:${c.card};--txt:${c.txt};--sub:${c.sub};--grad:${c.grad}}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",Roboto,sans-serif;background:var(--bg);color:var(--txt);line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.wrap{max-width:1080px;margin:0 auto;padding:0 22px}
.grad-text{background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.btn{display:inline-block;padding:12px 22px;border-radius:11px;font-weight:600;cursor:pointer;border:none;background:var(--grad);color:#fff;font-size:14px;transition:.2s}
.btn:hover{transform:translateY(-2px);filter:brightness(1.07)}
.btn.ghost{background:transparent;border:1px solid var(--p);color:var(--txt)}
.section{padding:72px 0}
.center{text-align:center}
.eyebrow{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--p2);font-weight:700;margin-bottom:12px}
h1{font-size:clamp(30px,5vw,52px);line-height:1.1;letter-spacing:-.5px}
h2{font-size:clamp(24px,3.5vw,36px);letter-spacing:-.3px;margin-bottom:14px}
p.lead{color:var(--sub);font-size:16px;max-width:620px}
.card{background:var(--card);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:24px;transition:.25s}
.card:hover{transform:translateY(-4px);border-color:var(--p)}
.grid{display:grid;gap:20px}
.grid.c3{grid-template-columns:repeat(3,1fr)}
.grid.c2{grid-template-columns:repeat(2,1fr)}
.grid.c4{grid-template-columns:repeat(4,1fr)}
.nav{position:sticky;top:0;z-index:20;backdrop-filter:blur(12px);background:color-mix(in srgb,var(--bg) 82%,transparent);border-bottom:1px solid rgba(255,255,255,.07)}
.nav .row{display:flex;align-items:center;justify-content:space-between;height:64px}
.logo{font-weight:800;font-size:19px;display:flex;align-items:center;gap:9px}
.logo .mk{width:30px;height:30px;border-radius:9px;background:var(--grad);display:grid;place-items:center;font-size:15px}
.nav ul{display:flex;gap:26px;list-style:none;font-size:14px;color:var(--sub)}
.nav ul a:hover{color:var(--txt)}
.burger{display:none;background:none;border:none;color:var(--txt);font-size:24px;cursor:pointer}
@media(max-width:760px){
  .nav ul{position:fixed;inset:64px 0 auto 0;flex-direction:column;background:var(--bg);padding:18px 26px;gap:14px;border-bottom:1px solid rgba(255,255,255,.08);display:none}
  .nav ul.open{display:flex}
  .burger{display:block}
  .grid.c3,.grid.c4{grid-template-columns:1fr}
  .grid.c2{grid-template-columns:1fr}
  .section{padding:52px 0}
}
footer{text-align:center;padding:40px 0;color:var(--sub);font-size:13px;border-top:1px solid rgba(255,255,255,.07)}
.pill{display:inline-block;padding:5px 12px;border-radius:999px;background:color-mix(in srgb,var(--p) 18%,transparent);color:var(--p2);font-size:12px;font-weight:600}
.tag{font-size:12px;color:var(--sub)}
/* ambient decor + rhythm */
.decor{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:-1}
.decor i{position:absolute;border-radius:50%;filter:blur(70px);opacity:.3}
.decor i:nth-child(1){width:440px;height:440px;background:var(--p);top:-150px;right:-110px}
.decor i:nth-child(2){width:360px;height:360px;background:var(--p2);bottom:-130px;left:-90px;opacity:.24}
.decor i:nth-child(3){width:280px;height:280px;background:var(--grad);top:42%;left:52%;opacity:.14}
.section.alt{background:color-mix(in srgb,var(--card) 42%,transparent)}
.divider{height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent);margin:0}
.quote{font-style:italic;color:var(--sub);border-left:3px solid var(--p);padding-left:14px;margin:10px 0}
.stat{text-align:center}
.stat b{display:block;font-size:30px;font-weight:800;background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.cta-band{margin:8px 0 0;padding:48px 24px;border-radius:22px;background:var(--grad);color:#fff;text-align:center}
.cta-band h2{color:#fff}.cta-band p{color:rgba(255,255,255,.85)}
.logos{display:flex;gap:26px;flex-wrap:wrap;justify-content:center;align-items:center;opacity:.7;font-weight:700;letter-spacing:1px;color:var(--sub)}
`;
    const js = extraJS ? `<script>${extraJS}<\/script>` : "";
    const decor = `<div class="decor" aria-hidden="true"><i></i><i></i><i></i></div>`;
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${meta.name}</title><style>${css}</style></head><body>${decor}${bodyHTML}${js}</body></html>`;
  }

  function navHTML(meta, links) {
    const lis = links.map(l => `<li><a href="#${l.id}">${l.t}</a></li>`).join("");
    return `<nav class="nav"><div class="wrap row"><div class="logo"><span class="mk">⚛</span>${meta.name}</div><button class="burger" onclick="document.getElementById('navmenu').classList.toggle('open')">☰</button><ul id="navmenu">${lis}</ul></div></nav>`;
  }
  const footerHTML = (meta) => `<footer><div class="wrap">© ${new Date().getFullYear()} ${meta.name} · 由 Forge AI 智能体生成 · 可自由迭代</div></footer>`;

  /* ---------- 3. templates ---------- */
  const builders = {
    cafe(meta) {
      const menu = meta.sections.includes("menu") || true;
      const hours = meta.sections.includes("hours") || true;
      const loc = meta.sections.includes("location") || true;
      const story = meta.sections.includes("story") || true;
      const items = [
        ["手冲单品", "28", "埃塞俄比亚耶加雪菲 · 柑橘与茉莉"],
        ["燕麦拿铁", "32", "丝滑燕麦奶 + 双份浓缩"],
        ["脏脏咖啡", "30", "冰博克淋浓缩，层次分明"],
        ["肉桂卷", "22", "现烤 · 配手冲绝配"],
        ["贝果三明治", "36", "烟熏鸡胸 + 牛油果"],
        ["季节特调", "34", "每月更换，限定供应"]
      ];
      const menuHTML = menu ? `<section class="section" id="menu"><div class="wrap"><div class="center"><div class="eyebrow">Menu</div><h2>今日菜单</h2><p class="lead" style="margin:0 auto 36px">用心挑选的豆子与餐点，安静地陪你度过一段时光。</p></div>
        <div class="grid c3">${items.map(i=>`<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline"><strong>${i[0]}</strong><span class="grad-text" style="font-weight:700">¥${i[1]}</span></div><p class="tag" style="margin-top:8px">${i[2]}</p></div>`).join("")}</div></div></section>` : "";
      const info = [];
      if (hours) info.push(`<div class="card"><div class="eyebrow">Hours</div><h3 style="margin:6px 0 8px">营业时间</h3><p class="tag">周一至周五 08:00 – 22:00<br>周末 09:00 – 23:00</p></div>`);
      if (loc) info.push(`<div class="card"><div class="eyebrow">Location</div><h3 style="margin:6px 0 8px">地址</h3><p class="tag">西湖区文新路 88 号<br>近地铁 2 号线文新站 B 口</p></div>`);
      const infoHTML = (hours||loc) ? `<section class="section" id="visit"><div class="wrap"><div class="grid c2">${info.join("")}${story?`<div class="card"><div class="eyebrow">Story</div><h3 style="margin:6px 0 8px">我们的故事</h3><p class="tag">${meta.name} 始于一间十平米的老巷弄。我们相信，一杯好咖啡不该有距离感——它属于每一个愿意慢下来的人。</p></div>`:""}</div></div></section>`:"";
      const body = navHTML(meta,[{id:"menu",t:"菜单"},{id:"visit",t:"到店"},{id:"contact",t:"联系"}]) + `
        <header class="section" style="padding-top:96px"><div class="wrap center">
          <span class="pill">☕ 社区咖啡馆</span>
          <h1 style="margin:18px 0">${meta.name}</h1>
          <p class="lead" style="margin:0 auto 26px">把日常的喧嚣关在门外，留一盏灯、一杯手冲，和一段属于自己的安静。</p>
          <a href="#menu" class="btn">查看菜单</a> <a href="#visit" class="btn ghost">到店指引</a>
        </div></header>` + menuHTML + infoHTML + footerHTML(meta);
      return appShell(meta, body, `document.querySelector('.burger')&&document.querySelector('.burger').addEventListener('click',()=>document.getElementById('navmenu').classList.toggle('open'));`);
    },

    portfolio(meta) {
      const projects = [
        ["实时协作白板","WebSocket + Canvas 多人同步编辑器，支持离线草稿","design"],
        ["低代码表单引擎","拖拽生成表单，自动校验与数据看板","build"],
        ["开源组件库","12k Star 的 React 组件库，含暗色主题","code"],
        ["AI 周报助手","自然语言生成团队周报，接入企业微信","ai"]
      ];
      const skills = ["Figma","React","TypeScript","Node.js","Framer","WebGL","Rust","AI 编排"];
      const body = navHTML(meta,[{id:"work",t:"作品"},{id:"skill",t:"技能"},{id:"about",t:"关于"},{id:"contact",t:"联系"}]) + `
        <header class="section" style="padding-top:100px"><div class="wrap"><div style="display:flex;gap:34px;align-items:center;flex-wrap:wrap">
          <div style="flex:1;min-width:280px"><div class="eyebrow">Product Designer · Builder</div>
          <h1 style="margin:14px 0">你好，我是 <span class="grad-text">${meta.name.replace(/的.*$/,'')}</span></h1>
          <p class="lead" style="margin-bottom:24px">我用设计与代码搭建有温度的产品。8 年经验，专注于把复杂流程变得简单可用。</p>
          <a href="#work" class="btn">查看作品</a> <a href="#contact" class="btn ghost">联系我</a></div>
          <div style="width:160px;height:160px;border-radius:30px;background:var(--grad);display:grid;place-items:center;font-size:60px;box-shadow:0 20px 50px rgba(0,0,0,.4)">🧑‍💻</div>
        </div></div></header>
        <section class="section" id="work"><div class="wrap"><div class="eyebrow">Selected Work</div><h2>精选项目</h2>
          <div class="grid c2" style="margin-top:24px">${projects.map(p=>`<div class="card"><div style="font-size:30px">${p[2]==='ai'?'🤖':p[2]==='code'?'💻':p[2]==='build'?'🛠':'🎨'}</div><h3 style="margin:12px 0 6px">${p[0]}</h3><p class="tag">${p[1]}</p></div>`).join("")}</div></div></section>
        <section class="section" id="skill" style="padding-top:0"><div class="wrap"><div class="eyebrow">Toolkit</div><h2>技能栈</h2><div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:20px">${skills.map(s=>`<span class="pill">${s}</span>`).join("")}</div></div></section>
        <section class="section" id="about" style="padding-top:0"><div class="wrap"><div class="eyebrow">About</div><h2>关于我</h2><p class="lead">我相信好的产品是"设计"与"工程"的合谋。工作之外，我写技术博客、做开源，也喜欢用咖啡换一段长聊。</p></div></section>` + footerHTML(meta);
      return appShell(meta, body, `document.querySelector('.burger')&&document.querySelector('.burger').addEventListener('click',()=>document.getElementById('navmenu').classList.toggle('open'));`);
    },

    landing(meta) {
      const feats = [
        ["⚡","极速上手","5 分钟完成接入，开箱即用的模板与 SDK。"],
        ["🔒","企业级安全","细粒度权限、审计日志与私有化部署。"],
        ["🔗","开放生态","Webhook、API 与 200+ 集成一键连接。"],
        ["📈","数据驱动","内置看板与漏斗，决策有据可依。"]
      ];
      const plans = [
        ["入门","¥0","个人与小团队试用","3 个项目 · 社区支持"],
        ["专业","¥99","成长型团队","无限项目 · 协作 · 看板"],
        ["企业","定制","规模化与安全合规","SSO · 私有化 · 专属顾问"]
      ];
      const faqs = [
        ["支持私有化部署吗？","企业版支持，可部署在你的内网环境。"],
        ["如何计费？","按席位月度订阅，可随时升级或降级。"],
        ["有试用吗？","专业版提供 14 天免费试用，无需信用卡。"]
      ];
      const body = navHTML(meta,[{id:"feat",t:"功能"},{id:"price",t:"定价"},{id:"faq",t:"FAQ"}]) + `
        <header class="section" style="padding-top:104px"><div class="wrap center">
          <span class="pill">✨ 全新发布</span>
          <h1 style="margin:18px 0">让团队像 <span class="grad-text">${meta.name}</span><br>一样顺畅协作</h1>
          <p class="lead" style="margin:0 auto 26px">把分散的工具、文档与流程，收拢到一个工作空间。少一些切换，多一些专注。</p>
          <a href="#price" class="btn">免费开始</a> <a href="#feat" class="btn ghost">了解功能</a>
        </div></header>
        <section class="section" id="feat"><div class="wrap"><div class="grid c4">${feats.map(f=>`<div class="card"><div style="font-size:26px">${f[0]}</div><h3 style="margin:10px 0 6px;font-size:17px">${f[1]}</h3><p class="tag">${f[2]}</p></div>`).join("")}</div></div></section>
        <section class="section alt"><div class="wrap"><div class="grid c4">${[["10k+","活跃团队"],["99.9%","服务可用性"],["200+","集成市场"],["4.9","用户评分"]].map(s=>`<div class="card stat"><b>${s[0]}</b><span class="tag">${s[1]}</span></div>`).join("")}</div>
          <div class="logos" style="margin-top:30px"><span>Acme</span><span>云图</span><span>Nova</span><span>启明</span><span>光合</span></div></div></section>
        <section class="section"><div class="wrap"><div class="center"><div class="eyebrow">Loved by teams</div><h2>他们怎么说</h2></div><div class="grid c3" style="margin-top:24px">${[["“上线第一周，协作效率肉眼可见地提升了。”","— 林见，产品负责人"],["“模板太省事，半天搭完整个工作区。”","— 苏黎，设计师"],["“看板和权限正好是我们缺的。”","— 陈默，CTO"]].map(q=>`<div class="card"><p class="quote">${q[0]}</p><p class="tag">${q[1]}</p></div>`).join("")}</div></div></section>
        <section class="section" id="price" style="padding-top:0"><div class="wrap"><div class="center"><div class="eyebrow">Pricing</div><h2>简单透明的定价</h2></div><div class="grid c3" style="margin-top:26px">${plans.map((p,i)=>`<div class="card" style="${i===1?'border-color:var(--p);box-shadow:0 10px 30px rgba(0,0,0,.3)':''}"><h3>${p[0]}</h3><div class="grad-text" style="font-size:34px;font-weight:800;margin:8px 0">${p[1]}<span style="font-size:14px;color:var(--sub)">${p[1].startsWith('¥')?'/月':''}</span></div><p class="tag" style="margin-bottom:16px">${p[3]}</p><p style="font-size:13px;color:var(--sub)">${p[2]}</p></div>`).join("")}</div></div></section>
        <section class="section" id="faq" style="padding-top:0"><div class="wrap" style="max-width:720px"><div class="center"><div class="eyebrow">FAQ</div><h2>常见问题</h2></div>${faqs.map(f=>`<div class="card" style="margin-top:14px"><h3 style="font-size:16px">${f[0]}</h3><p class="tag" style="margin-top:6px">${f[1]}</p></div>`).join("")}</div></section>` + `<section class="section"><div class="wrap"><div class="cta-band"><div class="eyebrow" style="color:rgba(255,255,255,.85)">Get started</div><h2>准备好让团队更顺畅了吗？</h2><p style="margin:8px 0 18px">今天就开始，14 天专业版免费试用，无需信用卡。</p><a href="#price" class="btn" style="background:#fff;color:var(--p)">免费开始</a></div></div></section>` + footerHTML(meta);
      return appShell(meta, body, `document.querySelector('.burger')&&document.querySelector('.burger').addEventListener('click',()=>document.getElementById('navmenu').classList.toggle('open'));`);
    },

    dashboard(meta) {
      const kpis = [["活跃用户","48.2k","+12.4%"],["转化率","6.8%","+1.1pt"],["客单价","¥268","+5.3%"],["留存(30d)","71%","+2.9pt"]];
      const bars = [42,58,47,73,65,88,76,94];
      const rows = [["新版落地页", "2026-09-28","已上线","✅"],["推送召回", "2026-09-27","实验中","🧪"],["会员体系", "2026-09-25","评审中","🔍"],["数据看板", "2026-09-24","已上线","✅"]];
      const body = `<div style="padding-top:80px"><div class="wrap"><div class="eyebrow">Operations</div><h1 style="margin:10px 0">${meta.name}</h1><p class="lead" style="margin-bottom:30px">核心指标一览，决策更快一步。</p>
        <div class="grid c4">${kpis.map(k=>`<div class="card"><div class="tag">${k[0]}</div><div style="font-size:30px;font-weight:800;margin:6px 0">${k[1]}</div><span class="grad-text" style="font-weight:700;font-size:13px">${k[2]} ▲</span></div>`).join("")}</div>
        <div class="grid c2" style="margin-top:22px">
          <div class="card"><div class="eyebrow">近 8 周趋势</div><h3 style="margin:6px 0 18px">访问量</h3><div style="display:flex;align-items:flex-end;gap:10px;height:160px">${bars.map(b=>`<div style="flex:1;background:var(--grad);border-radius:6px 6px 0 0;height:${b}%;opacity:${0.55+b/220}"></div>`).join("")}</div></div>
          <div class="card"><div class="eyebrow">近期动态</div><h3 style="margin:6px 0 14px">变更记录</h3>${rows.map(r=>`<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:14px"><span>${r[0]}</span><span class="tag">${r[1]}</span><span>${r[3]}</span></div>`).join("")}</div>
        </div></div></div>` + footerHTML(meta);
      return appShell(meta, body, "");
    },

    event(meta) {
      const agenda = [["09:30","签到 & 咖啡","大堂"],["10:00","开幕主题演讲","主会场"],["11:00","圆桌：AI 与创作者","主会场"],["14:00","工作坊分组","分会场"],["16:30","闭幕 & 交流","花园"]];
      const speakers = [["林见","产品负责人","🧑‍💼"],["苏黎","首席设计师","🎨"],["陈默","AI 研究员","🤖"],["周野","社区主理人","🌱"]];
      const body = navHTML(meta,[{id:"agenda",t:"日程"},{id:"speaker",t:"嘉宾"},{id:"reg",t:"报名"}]) + `
        <header class="section" style="padding-top:104px"><div class="wrap center">
          <span class="pill">📅 2026 · 杭州</span>
          <h1 style="margin:18px 0"><span class="grad-text">${meta.name}</span></h1>
          <p class="lead" style="margin:0 auto 26px">一天，和同频的人聊点真东西。限 300 席。</p>
          <a href="#reg" class="btn">立即报名</a>
        </div></header>
        <section class="section" id="agenda" style="padding-top:0"><div class="wrap"><div class="eyebrow">Agenda</div><h2>当日日程</h2><div class="card" style="margin-top:20px">${agenda.map(a=>`<div style="display:flex;gap:18px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.06)"><strong style="width:64px;color:var(--p2)">${a[0]}</strong><span style="flex:1">${a[1]}</span><span class="tag">${a[2]}</span></div>`).join("")}</div></div></section>
        <section class="section" id="speaker" style="padding-top:0"><div class="wrap"><div class="eyebrow">Speakers</div><h2>分享嘉宾</h2><div class="grid c4" style="margin-top:22px">${speakers.map(s=>`<div class="card center"><div style="font-size:40px">${s[2]}</div><h3 style="margin:10px 0 4px">${s[0]}</h3><p class="tag">${s[1]}</p></div>`).join("")}</div></div></section>
        <section class="section" id="reg" style="padding-top:0"><div class="wrap center"><div class="card" style="max-width:480px;margin:0 auto"><div class="eyebrow">Register</div><h2>报名参会</h2><p class="tag" style="margin:8px 0 18px">填写邮箱，获取电子门票。</p><input id="regEmail" placeholder="you@email.com" style="width:100%;padding:12px;border-radius:10px;border:1px solid var(--p);background:transparent;color:var(--txt);margin-bottom:12px"><button class="btn" style="width:100%" onclick="const v=document.getElementById('regEmail').value;if(v)alert('🎉 报名成功，门票已发送至 '+v)">提交报名</button></div></div></section>` + footerHTML(meta);
      return appShell(meta, body, `document.querySelector('.burger')&&document.querySelector('.burger').addEventListener('click',()=>document.getElementById('navmenu').classList.toggle('open'));`);
    },

    blog(meta) {
      const posts = [["为什么我们重写了前端","9 分钟阅读","关于一次大规模重构的真实复盘。","#"],["远程协作的 7 个习惯","6 分钟阅读","分布式团队的沟通清单。","#"],["我用 AI 做了 100 个小工具","11 分钟阅读","从想法到上线的流水线。","#"],["设计系统的取舍","8 分钟阅读","一致性 vs 灵活性的平衡。","#"]];
      const body = navHTML(meta,[{id:"posts",t:"文章"},{id:"about",t:"关于"}]) + `
        <header class="section" style="padding-top:96px"><div class="wrap"><div class="eyebrow">Weekly</div><h1 style="margin:12px 0">${meta.name}</h1><p class="lead">记录关于产品、设计与工程的思考，每周更新。</p></div></header>
        <section class="section" id="posts" style="padding-top:0"><div class="wrap"><div class="grid c2">${posts.map(p=>`<a class="card" href="${p[3]}"><h3 style="margin-bottom:8px">${p[0]}</h3><p class="tag">${p[1]} · ${p[2]}</p></a>`).join("")}</div></div></section>` + footerHTML(meta);
      return appShell(meta, body, `document.querySelector('.burger')&&document.querySelector('.burger').addEventListener('click',()=>document.getElementById('navmenu').classList.toggle('open'));`);
    },

    tool(meta) {
      const body = `<div style="padding-top:90px"><div class="wrap center"><div class="eyebrow">Focus Tool</div><h1 style="margin:10px 0">${meta.name}</h1><p class="lead" style="margin:0 auto 26px">一个清爽的番茄钟，帮你进入心流。</p>
        <div class="card" style="max-width:380px;margin:0 auto">
          <div id="disp" style="font-size:64px;font-weight:800;font-variant-numeric:tabular-nums;margin:10px 0">25:00</div>
          <div style="display:flex;gap:10px;justify-content:center;margin-top:10px">
            <button class="btn" id="startBtn">开始</button>
            <button class="btn ghost" id="resetBtn">重置</button>
          </div>
          <p class="tag" id="state" style="margin-top:14px">准备好了吗？</p>
        </div></div></div>` + footerHTML(meta);
      const js = `let t=25*60,run=null;const d=document.getElementById('disp'),st=document.getElementById('state');
      function tick(){if(t<=0){clearInterval(run);run=null;st.textContent='🎉 完成一个番茄！';return;}t--;const m=String(Math.floor(t/60)).padStart(2,'0'),s=String(t%60).padStart(2,'0');d.textContent=m+':'+s;}
      document.getElementById('startBtn').onclick=()=>{if(run){clearInterval(run);run=null;st.textContent='已暂停';document.getElementById('startBtn').textContent='继续';}else{run=setInterval(tick,1000);st.textContent='专注中…';document.getElementById('startBtn').textContent='暂停';}};
      document.getElementById('resetBtn').onclick=()=>{clearInterval(run);run=null;t=25*60;d.textContent='25:00';st.textContent='准备好了吗？';document.getElementById('startBtn').textContent='开始';};`;
      return appShell(meta, body, js);
    },

    shop(meta) {
      const goods = [["陶土咖啡杯","¥68","手作釉面，温润如玉","🏺"],["原木手机架","¥49","极简线条，稳如磐石","🪵"],["亚麻香薰","¥88","雪松与海盐，助眠","🕯"],["羊毛拖鞋","¥99","踩云般柔软","🧦"]];
      const body = navHTML(meta,[{id:"goods",t:"好物"},{id:"cart",t:"购物袋"}]) + `
        <header class="section" style="padding-top:96px"><div class="wrap center"><span class="pill">🛍 生活选物</span><h1 style="margin:16px 0">${meta.name}</h1><p class="lead" style="margin:0 auto 10px">把日子过慢一点，用好物装点日常。</p></div></header>
        <section class="section" id="goods" style="padding-top:0"><div class="wrap"><div class="grid c4">${goods.map((g,i)=>`<div class="card"><div style="font-size:38px">${g[3]}</div><h3 style="margin:10px 0 4px">${g[0]}</h3><div class="grad-text" style="font-weight:700">${g[1]}</div><button class="btn ghost" style="margin-top:12px;width:100%" onclick="addCart('${g[0]}')">加入购物袋</button></div>`).join("")}</div>
        <div class="card center" id="cart" style="margin-top:24px"><div class="eyebrow">Your Bag</div><p id="cartInfo" class="tag">购物袋还是空的 🛒</p></div></div></section>` + footerHTML(meta);
      const js = `let bag=[];function addCart(n){bag.push(n);document.getElementById('cartInfo').textContent='已选 '+bag.length+' 件：'+bag.join('、');}`;
      return appShell(meta, body, js);
    }
  };

  /* ---------- 4. public generate ---------- */
  /* 各类应用的"强类型词"：只有句子里真的出现了这些词，才可能是想换一个应用。
     颜色、字号、文案、微调类指令不含这些词，因此永远判为迭代。 */
  const TYPE_WORDS = [
    "作品集", "简历", "portfolio", "咖啡", "餐厅", "cafe", "restaurant", "菜单",
    "落地页", "landing", "saas", "官网", "看板", "仪表", "dashboard", "大屏",
    "报表", "博客", "blog", "周刊", "商城", "商店", "shop", "store", "电商",
    "活动", "会议", "大会", "event", "峰会", "待办", "todo", "计算器", "番茄钟"
  ];
  const TYPE_WORD_RE = new RegExp(TYPE_WORDS.join("|"), "i");

  /* 纯微调类指令：这些词出现时，一律当作"在改当前应用"，不做任何模板切换 */
  const TWEAK_RE = /(再大一点|再大点|大一点|大点|再小一点|小一点|标题|字号|字体|颜色|配色|改成|改为|换成|调成|换成深色|加一个|加上|增加|添加|删除|去掉|去掉|优化|调整|挪|移到|放到|置顶|白改|文案|标题|短一点|精简|更短|更简洁|换一张|对齐|间距|留白|圆角|阴影|居中)/;

  function isNewAppIntent(text, prevMeta) {
    const t = (text || "").trim();
    if (!t) return false;
    if (!prevMeta || !prevMeta.type) return true;      // 没有历史 → 必然是新应用

    // 出现微调信号词 → 优先判为迭代（哪怕句子里也带了类型词，如"菜单改一下"）
    if (TWEAK_RE.test(t)) return false;

    // 句中确实出现了别的应用类型词 → 换模板
    const m = analyze(t);
    const mentionsType = TYPE_WORD_RE.test(t);
    // 「其实想要 / 干脆 / 不如」这类转折词后接类型词，是明确的换应用意图
    const turnSignal = /(其实|干脆|不如|改成做|换成做|我想做|我要做|想做|需要|来一个|来个)/.test(t);
    if (mentionsType && (m.type !== prevMeta.type || turnSignal)) return true;

    // 明确的第一人称新建表达（且没有微调词）
    if (/(帮我|给我|重新做|换一个|换个新|新建|从头|另外做|重新生成|另做)/.test(t)) return true;

    return false;
  }

  function generate(prompt, prevMeta) {
    const meta = analyze(prompt);
    // inherit refinements lightly when continuing a conversation
    if (prevMeta && prevMeta._refine) {
      meta.palette = prevMeta.palette;
      meta.name = prevMeta.name;
      meta.type = prevMeta.type;
    }
    const build = builders[meta.type] || builders.landing;
    const html = build(meta);
    meta.kindLabel = TYPE_LABEL[meta.type];
    meta.paletteName = PALETTES[meta.palette].name;
    meta.sectionCount = (html.match(/class="card"/g) || []).length;
    return { html, meta };
  }

  /* 让"改一下"真的看得出变化：对生成的 HTML 做可见的微调 */
  function applyTweaks(html, instruction) {
    const t = instruction;
    let out = html;
    const notes = [];
    const HL = {
      "营业时间": "visit", "地址": "visit", "位置": "visit", "到店": "visit",
      "菜单": "menu", "价格": "price", "定价": "price",
      "报名": "reg", "日程": "agenda", "嘉宾": "speaker",
      "项目": "work", "技能": "skill", "关于": "about",
      "功能": "feat", "常见问题": "faq", "商品": "goods", "文章": "posts"
    };
    if (/(醒目|突出|强调|明显|显眼|更好找|更清楚|更显眼)/.test(t)) {
      const hit = Object.keys(HL).find((k) => t.indexOf(k) >= 0);
      const id = hit ? HL[hit] : null;
      const hl = 'style="background:linear-gradient(180deg,rgba(124,92,255,.12),transparent);border-top:2px solid var(--p);border-bottom:2px solid var(--p)"';
      if (id && out.indexOf('id="' + id + '"') >= 0) {
        out = out.replace(new RegExp('<section([^>]*)id="' + id + '"'), '<section$1 ' + hl + ' id="' + id + '"');
        notes.push("把「" + hit + "」区块加了高亮边框和底色，更好找");
      } else {
        out = out.replace("</head>", "<style>h1{text-shadow:0 6px 30px rgba(124,92,255,.35)}</style></head>");
        notes.push("强化了首屏标题的视觉重量");
      }
    }
    if (/(短一点|更短|精简|简洁|少一点字|文案再短)/.test(t)) {
      out = out.replace(/(<p class="lead"[^>]*>)([\s\S]*?)(<\/p>)/g, (m, a, b, c) => {
        const s = b.replace(/<[^>]+>/g, "");
        return a + (s.length > 34 ? s.slice(0, 33) + "…" : s) + c;
      });
      notes.push("首屏和各段的长文案精简了");
    }
    if (/(不要动效|去掉动效|别加动画|去掉动画|静止)/.test(t)) {
      out = out.replace("</head>", "<style>*{animation:none!important;transition:none!important}</style></head>");
      notes.push("关掉了全部动效与过渡");
    }
    if (/(字更大|字号大|放大字体|大一点字)/.test(t)) {
      out = out.replace("</head>", "<style>body{font-size:17px}</style></head>");
      notes.push("整体字号调大了一档");
    }
    if (/(圆角更大|更圆)/.test(t)) {
      out = out.replace("</head>", "<style>.card,.btn,.pill{border-radius:20px}</style></head>");
      notes.push("卡片和按钮圆角加大");
    }
    if (/(留白|间距更大|别太挤|宽松)/.test(t)) {
      out = out.replace("</head>", "<style>.section{padding-top:80px!important;padding-bottom:80px!important}</style></head>");
      notes.push("区块上下留白加大");
    }
    return { html: out, notes };
  }

  /* apply a natural-language refinement to existing meta */
  function refine(prevMeta, instruction) {
    const t = instruction.toLowerCase();
    const next = Object.assign({}, prevMeta, { _refine: true });
    if (/(暗|dark|黑|高级)/.test(t) && !/(亮|白|浅|light)/.test(t)) next.palette = "dark";
    if (/(亮|白|浅|light)/.test(t)) next.palette = "aurora";
    if (/(暖|橙|橘|warm)/.test(t)) next.palette = "warm";
    if (/(蓝|青|cool)/.test(t)) next.palette = "cool";
    if (/(红|red)/.test(t)) next.palette = "red";
    if (/(绿|green)/.test(t)) next.palette = "green";
    if (/(紫|purple)/.test(t)) next.palette = "purple";
    if (/(菜单|menu)/.test(t)) next.sections = [...new Set([...next.sections, "menu"])];
    if (/(营业时间|hours|地址|位置|location)/.test(t)) next.sections = [...new Set([...next.sections, "hours", "location"])];
    if (/(联系|contact)/.test(t)) next.sections = [...new Set([...next.sections, "contact"])];
    const build = builders[next.type] || builders.landing;
    let html = build(next);
    const tweak = applyTweaks(html, instruction);
    html = tweak.html;
    next.tweaks = tweak.notes;
    next.kindLabel = TYPE_LABEL[next.type];
    next.paletteName = PALETTES[next.palette].name;
    next.sectionCount = (html.match(/class="card"/g) || []).length;
    return { html, meta: next };
  }

  global.Forge = { generate, refine, analyze, isNewAppIntent, PALETTES, TYPE_LABEL };
})(window);
