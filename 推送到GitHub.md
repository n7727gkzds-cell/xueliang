# 推送到 GitHub —— 目标仓库已指定

目标仓库：**https://github.com/n7727gkzds-cell/xueliang**（已确认存在、可匿名访问 = 已设为 Public，当前为空仓库）

`repo/` 目录已脱敏（不含任何 API Key），且**本地 Git 仓库已初始化、代码已提交**，只差最后一步 push。

## 现在的进度

- ✅ 第 1 步：GitHub 建空仓库 —— 已完成（仓库 xueliang 已存在且 Public）
- ✅ 第 2 步：`git init` + `add` + `commit` —— 已完成
  - 分支：`main`
  - 提交：`3cf6bf1 feat: Forge AI App Studio - Atoms-Demo for ROOT fullstack assessment`
  - remote：`origin → https://github.com/n7727gkzds-cell/xueliang.git`
  - 已跟踪 7 个文件：`index.html` `styles.css` `app.js` `engine.js` `server.js` `README.md` `.gitignore`
- ✅ 第 3 步：`git push` —— **已完成**（使用 Personal Access Token 推送，推送后已清除本地残留的凭证信息）
  - 远端提交：`994694d`（含全部源码与本文档）
  - 仓库可见性：**Public**，默认分支：**main**
  - 验证：https://github.com/n7727gkzds-cell/xueliang 可看到 8 个文件

## 第 3 步：push（二选一）

### 方式 A：命令行（推荐）

GitHub 已不支持用账号密码 push，需要 **Personal Access Token**：

1. 打开 https://github.com/settings/tokens → **Generate new token (classic)**
2. 勾选 **`repo`**（读写仓库），生成并**复制** token（形如 `ghp_xxxx...`，只显示一次）
3. 在本目录执行：

```bash
cd "C:/Users/Administrator/Desktop/Forge-Atoms-Demo-提交包/repo"
git push -u origin main
```

4. 弹出登录窗口时：**用户名**填 `n7727gkzds-cell`，**密码**填刚才的 token（不是登录密码）

> 若报证书/吊销检查错误（本机网络环境常见），可加参数重试：
> `git -c http.sslVerify=false push -u origin main`

### 方式 B：网页拖拽上传（不用配凭证）

1. 打开 https://github.com/n7727gkzds-cell/xueliang
2. 点 **uploading an existing file**（或 **Add file → Upload files**）
3. 把本目录下这 6 个文件拖进去：`index.html` `styles.css` `app.js` `engine.js` `server.js` `README.md`
4. 底部填一句 commit 信息 → **Commit changes**

## 第 4 步：确认 + 回填（回填已完成）

1. 打开 https://github.com/n7727gkzds-cell/xueliang 确认文件齐全、仓库右上角显示 **Public**
2. 两份笔试文档的「（必含）代码链接（GitHub）」**已回填**为该地址：
   - `笔试文档-ROOT全栈岗位笔试.md`
   - `笔试文档-ROOT全栈岗位笔试.html`
   - 根目录 `README.md` / `提交说明.html` 也已同步
3. 在线链接（已部署）：https://2108109949544263680.app.workbuddy.host/

## 常见问题

- **认证失败**：确认用户名是 `n7727gkzds-cell`、密码填的是 token 而非登录密码；token 必须有 `repo` 权限。
- **SSH push 报 port 22 refused**：本机网络屏蔽了 22 端口，请改用上面的 HTTPS（方式 A 的第 4 点）或方式 B。
- **想确认没误传密钥**：本目录执行 `grep -r "sk-" .`，应无输出（当前版本已确认无密钥）。

## 仓库应包含的文件

```
README.md    项目说明
index.html   界面
styles.css   样式
app.js       智能体 / 生成 / 版本 / 发布 / 附件 / 初始化引导
engine.js    本地规则引擎（8 类应用模板 + 9 套配色）
server.js    本地代理（静态托管 + /api/llm 转发）
.gitignore
```
