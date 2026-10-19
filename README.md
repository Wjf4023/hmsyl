# 拾光集 · 示例阅读站

响应式网页阅读页 + 自动构建部署流水线。当前内容为**占位示例文本**，随时可替换。

- **阅读方式**：上下连续排布，自然滚动；也可一键切换「逐屏模式」（滚动吸附 + 方向键/翻页键/按钮逐屏翻动）
- **位置记忆**：滚动位置、当前章节、字号、主题、阅读模式均保存在浏览器本地，下次打开自动恢复
- **响应式**：移动优先；≤1023px 目录为抽屉、≥1024px 目录固定左侧；字号与间距随视口自适应；触屏点按区域 ≥44px；适配刘海屏安全区
- **零依赖**：构建只用 Node 标准库，产物为**单个 HTML 文件**，双击即可打开

## 目录结构

```
reader-site/
├── .github/workflows/deploy.yml # CI：推送后自动构建并部署 GitHub Pages
├── content/                     # 【内容区】改这里
│   ├── meta.json                # 标题/副标题/作者/年份/占位标记
│   └── chapters/*.md            # 各章正文（按文件名排序，"# " 行为章标题）
├── src/                         # 【模板区】页面骨架与样式脚本
│   ├── template.html            # HTML 骨架（构建时注入）
│   ├── css/style.css            # 全部样式（含深浅主题、响应式断点）
│   └── js/reader.js             # 交互（进度/位置记忆/目录/字号/主题/逐屏）
├── scripts/
│   ├── build.js                 # 构建：md + 模板 -> dist/index.html
│   └── serve.js                 # 本地预览服务器
├── dist/                        # 构建产物（CI 生成，不入库）
├── netlify.toml                 # 备选平台（Netlify）配置
└── package.json
```

## 本地使用

```bash
cd reader-site
npm run build     # 构建 -> dist/index.html
npm run serve     # 构建并起本地服务：http://localhost:4173
```

也可以直接双击 `dist/index.html` 在浏览器中打开。

## 替换正文

1. 编辑 `content/meta.json`：改标题、副标题、作者；正式内容就绪后用 `"placeholder": false` 去掉角标提示
2. 把正文按章保存为 `content/chapters/01-xxx.md`、`02-xxx.md`……文件名决定顺序，每章第一行 `# 章标题`
3. 支持的 Markdown 子集：`##/###/####` 小标题、段落、`-` 无序列表、`1.` 有序列表、`>` 引用、`---` 分割线、`**加粗**`、`*斜体*`、`` `代码` ``、`[链接](url)`
4. `npm run build` 本地确认效果，或直接提交推送，由 CI 自动构建部署

## 自动部署（GitHub Pages）

### 需要的配置文件（均已就绪）

| 文件                             | 作用                                       |
| ------------------------------ | ---------------------------------------- |
| `.github/workflows/deploy.yml` | 触发条件（推送 main / PR / 手动）、构建、上传产物、部署 Pages |
| `package.json`                 | 约定 `npm run build` 构建入口                  |
| `.gitignore`                   | 不提交 `dist/`、`node_modules/`（产物由 CI 生成）   |
| `netlify.toml`                 | 备选：Netlify 的构建命令与发布目录                    |

### 仓库设置步骤

1. **建仓库**：在 GitHub 新建一个仓库（建议 Public；Pages 私有仓库需 Pro 计划）
2. **关联并推送**（本地仓库已初始化并提交，**不要**再执行 `git init`；在 PowerShell 里逐条执行，目录和 URL 都要换成真实值）：

   ```powershell
   cd C:\Users\25195\WorkBuddy\2026-10-19-19-35-22\reader-site
   git remote add origin https://github.com/<你的GitHub用户名>/<仓库名>.git
   git push -u origin main
   ```

   `<你的GitHub用户名>/<仓库名>` 必须**整体替换**为真实地址，例如 `https://github.com/zhangsan/reader-site.git`；带着尖括号直接推送会被 GitHub 拒绝（HTTP 400）。若误加过占位符 remote，先 `git remote remove origin` 再加。
3. **开启 Pages**：仓库 `Settings → Pages → Build and deployment → Source` 选择 **GitHub Actions**（新版仓库默认即此，无需改动）
4. **查看部署**：`Actions` 标签页出现绿色对勾后，回到 `Settings → Pages`，顶部即显示地址：
   ```
   https://<你的用户名>.github.io/<仓库名>/
   ```
   打开即可阅读，无需登录或本地运行
5. **日常更新**：编辑 `content/` 后 `git commit + push`，Actions 自动重新构建并发布（约 30–60 秒生效）

> 无需配置任何 Secrets：GitHub 为工作流自动注入 `GITHUB_TOKEN`，权限已在 yml 中声明（`pages: write`、`id-token: write`）。

### 常见错误

| 现象 | 原因 | 解决 |
|---|---|---|
| `error: 400` | URL 里 `<占位符>` 未替换成真实仓库地址 | 替换为 `https://github.com/<用户名>/<仓库名>.git` 真实值，并先在 GitHub 建好仓库 |
| `fatal: not a git repository` | 在上层工作区（workspace 根）执行了推送命令 | 先 `cd` 进入 `reader-site` 再执行 |
| 根目录被 `git init`、`reader-site` 显示为 `160000` | 在包含子仓库的目录里又建了仓库，嵌套被记为 gitlink | 删除（改名）根目录的 `.git`；每个项目各自独立成仓库，互不嵌套 |
| `warning: LF will be replaced by CRLF` | Windows 换行转换提示 | 本仓库已设 `core.autocrlf=false` 并统一为 LF，无副作用 |

### 工作流说明（deploy.yml）

- **触发**：`push` 到 `main`（含合并入 main 的更新）、对 `main` 的 PR（仅验证构建）、`workflow_dispatch`（手动）
- **build**：checkout → 安装 Node 20 → `npm run build` → 校验 `dist/index.html` 生成 → `configure-pages` → `upload-pages-artifact`
- **deploy**：仅在 `push`/手动触发时执行，`deploy-pages` 发布到 Pages，并回显访问地址
- **并发**：同一时间只保留一个部署任务，避免覆盖竞态

### 备选平台

- **Netlify**：导入仓库即可识别 `netlify.toml`（构建 `npm run build`，发布 `dist`）
- **Vercel**：Framework 选 `Other`，构建命令 `npm run build`，输出目录 `dist`
- **Cloudflare Pages**：构建命令 `npm run build`，输出目录 `dist`

### 自定义域名（可选）

在 `content/` 之外加一个 `CNAME` 文件写入域名，推送后在 Pages 设置中开启 `Enforce HTTPS`。
