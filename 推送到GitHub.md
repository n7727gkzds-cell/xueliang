# 推送到 GitHub（3 步，约 2 分钟）

本文档要求「（必含）代码链接（github）」，且权限需为 **public**。
`repo/` 目录已经准备好（**已脱敏，不含任何 API Key**），照下面做即可。

## 前提
- 已安装 Git；已登录 github.com 账号

## 第 1 步：在 GitHub 上建空仓库
1. 打开 https://github.com/new
2. Repository name 填：`forge-atoms-demo`
3. 选择 **Public**
4. **不要**勾选 "Add a README file" / ".gitignore" / "license"（保持空仓库）
5. 点 Create repository，记下你的仓库地址，形如：
   - HTTPS：`https://github.com/<你的用户名>/forge-atoms-demo.git`
   - SSH：`git@github.com:<你的用户名>/forge-atoms-demo.git`

## 第 2 步：在本目录执行（把 `<你的用户名>` 换成真实用户名）

```bash
cd "C:/Users/Administrator/Desktop/Forge-Atoms-Demo-提交包/repo"

git init
git add .
git commit -m "feat: Forge - AI App Studio (Atoms-Demo)"

git branch -M main
git remote add origin https://github.com/<你的用户名>/forge-atoms-demo.git
git push -u origin main
```

> 若用 SSH：`git remote add origin git@github.com:<你的用户名>/forge-atoms-demo.git`

## 第 3 步：确认并回填文档
1. 打开 `https://github.com/<你的用户名>/forge-atoms-demo` 确认文件齐全、仓库为 Public
2. 把该地址填回两份笔试文档的「（必含）代码链接（github）」处：
   - `笔试文档-ROOT全栈岗位笔试.md`
   - `笔试文档-ROOT全栈岗位笔试.html`
3. 顺手确认在线链接已填：`https://2108109949544263680.app.workbuddy.host/`

## 常见问题
- **push 提示认证失败**：GitHub 已不支持账号密码 push，请在 GitHub → Settings → Developer settings → Personal access tokens 生成 token，push 时用 token 作为密码；或改用 SSH key。
- **想检查是否误传密钥**：推送前可在本目录执行 `grep -r "sk-" .`，应无输出（当前版本已确认无密钥）。

## 仓库应包含的文件
```
index.html   界面
styles.css   样式
app.js       智能体 / 生成 / 版本 / 发布 / 附件 / 初始化引导
engine.js    本地规则引擎（8 类应用模板 + 9 套配色）
server.js    本地代理（静态托管 + /api/llm 转发）
README.md    项目说明
.gitignore
```
