# resume-to-pdf 设计文档

- 日期：2026-11-03
- 状态：已定稿（2026-11-03 作者确认）

## 1. 意图

一个命令行工具：读取 Markdown 写的简历（带 YAML front matter），套用主题，导出 A4 PDF。主题是独立目录，之后会不断新增。

第一个用户是作者本人。他用 Obsidian 写简历，希望同一份 Markdown 直接出一份好看的 PDF，不再手动排版。他最看重三件事：

1. 排版耐看，招聘方扫一眼就能定位到每段经历（公司名、项目名）和重点（加粗的成果）；
2. 中英文混排正常；
3. 生成逻辑通用，不针对某一份简历写死规则。

## 2. 目标 / 非目标 / 反目标

**目标**

- `resume-to-pdf build | themes | preview` 三个子命令（见 §5.2）。
- front matter 填基本信息，渲染到页眉；正文按普通 Markdown 渲染，外加一条通用的“条目标题”识别规则（见 §5.3）。
- 主题 = 一个目录：`theme.css` 必需，`template.html` 可选，`theme.json` 放元信息。
- 一个打磨过的 `default` 主题（见 §5.7）。
- 中英文两份示例简历、中英文两份 README。
- 分页友好：标题不孤立在页尾，列表项不被切开。

**非目标（这次不做）**

- 监听文件变化自动重建、本地开发服务器（`preview` 只生成 HTML，改完刷新浏览器即可）。
- DOCX 等其他输出格式。
- 多栏布局主题、头像照片的专门排版（标准 Markdown 图片照常渲染，但不专门设计样式）。
- 自动识别并高亮数字或关键词。重点由作者用 `**加粗**` 标出。
- Obsidian 专有语法（`[[双链]]`、callout 等）。
- 通过 `--theme` 传入任意路径的主题目录。只按名称查找仓库内的 `themes/<name>/`。

**反目标（做了也算失败）**

- 识别规则依赖具体的中文词，比如认“工作经历”“产品描述”。规则必须中英文简历都适用。
- 写法不符合约定的简历报错或排版错乱。不符合约定的部分应按普通 Markdown 正常渲染。
- default 主题出现大面积色块、图标、阴影、花哨边框，或使用一种以上的点缀色。
- 提交信息带任何 AI 署名；修改全局 git 配置。

## 3. 约束

- Node.js ≥ 22.12（`engines.node: ">=22.12.0"`），ESM（`"type": "module"`）。原需求是 Node 20+。但最新的 puppeteer 25.x 要求 Node ≥ 22.12.0，而且 Node 20 已于 2026 年 4 月停止维护，所以作者同意上调。依赖用 `puppeteer@^25`。作者本机是 v26。
- 运行时依赖只有三个：`markdown-it`、`js-yaml`、`puppeteer`。不引入前端框架、模板引擎和 CLI 框架。
- 验收命令：`npm install && npm run build -- examples/resume.md` 在干净环境下生成 PDF。
- Git：只在仓库内设置 `user.name "jianjustin"`、`user.email "janine.jian.chen@gmail.com"`；提交信息不得含 `Co-Authored-By`、`Generated with Claude` 等任何 AI 署名；使用 Conventional Commits（`feat:` / `docs:` / `chore:` 等），按逻辑单元分多次提交。

## 4. 方案取舍

### 4.1 Chromium 来源 —— 选定：`puppeteer` 完整包

| 方案 | 说明 | 取舍 |
|---|---|---|
| **`puppeteer` 完整包（选定）** | `npm install` 时自动下载配套的 Chrome for Testing | 干净环境一条命令可用，版本固定、各机器结果一致；代价是首次安装慢、体积几百 MB，国内网络可能需要镜像 |
| `puppeteer-core` + 本机 Chrome/Edge | 不下载浏览器 | 安装快；但要探测浏览器路径，没装 Chrome 的机器（如 Linux CI）直接失败，不满足验收 |
| Playwright | 能力相近 | 浏览器要额外执行 `npx playwright install chromium`，做不到一条命令跑通 |

想用本机 Chrome 的人，使用 puppeteer 原生支持的 `PUPPETEER_SKIP_DOWNLOAD` + `PUPPETEER_EXECUTABLE_PATH` 即可，不额外写代码，只在 README 中说明。国内镜像同样只写进 README（puppeteer 的下载源环境变量，变量名以实际安装版本的文档为准）。

### 4.2 字体 —— 选定：只用系统字体 + 回退链

| 方案 | 取舍 |
|---|---|
| **系统字体 + 回退链（选定）** | 零体积、无许可问题；不同系统字形略有差异；macOS 上 Chrome 会把系统字体嵌为 Type 3（试做时已用 `pdftotext` 验证文字可提取）；Linux 没装中文字体会出现方块，README 写明安装 `fonts-noto-cjk` |
| npm 引入 `@fontsource/noto-sans-sc`（OFL） | 各平台一致，不进仓库；多一个依赖，`node_modules` 明显变大 |
| 字体文件放进仓库 | 一致；但仓库多十几 MB 二进制文件 |

主题可以在自己的目录里放字体文件，用 `@font-face` 引用（见 §5.6）。以后哪个主题需要特定字体，由主题自己解决。

### 4.3 条目标题的写法 —— 选定：识别现有写法，不加新语法

试做时比较了“自定义语法（如属性块、容器块）”和“识别标题末尾的日期”两种做法。选后者：源文件在 Obsidian 等任何 Markdown 编辑器里读起来仍是普通 Markdown，作者现有的写法（`### 公司（2023.10—2026.10）`）几乎不用改。

### 4.4 模板机制 —— 选定：无逻辑占位符

不引入模板引擎。页眉 HTML 由程序生成，作为 `{{header}}` 提供；单个字段也以占位符提供，方便主题完全自定义页眉（见 §5.6）。

## 5. 已定的设计

### 5.1 目录结构

```
resume-to-pdf/
├── bin/resume-to-pdf.js        # CLI 入口：parseArgs，分发子命令
├── src/
│   ├── frontmatter.js          # 拆分并解析 YAML front matter
│   ├── markdown.js             # markdown-it 实例、条目标题识别、分节包裹
│   ├── themes.js               # 主题查找、列出、读取 theme.json
│   ├── render.js               # 组装完整 HTML（模板 + 占位符 + 页眉）
│   ├── pdf.js                  # puppeteer 导出 PDF
│   └── template.html           # 内置默认模板
├── themes/
│   └── default/
│       ├── theme.json
│       └── theme.css
├── examples/
│   ├── resume.md               # 中文示例（验收命令使用这一份）
│   └── resume.en.md            # 英文示例
├── test/                       # node:test 单元测试
├── docs/superpowers/specs/     # 本文档
├── README.md                   # 英文（默认）
├── README.zh-CN.md             # 简体中文
├── LICENSE
├── package.json / package-lock.json
└── .gitignore
```

`src/` 内的拆分是建议，实现者可以合并或细分，但 §5.5 的 HTML 结构约定必须保持。

### 5.2 CLI

```
resume-to-pdf build <input.md> [-o output.pdf] [--theme <name>]
resume-to-pdf preview <input.md> [-o output.html] [--theme <name>]
resume-to-pdf themes
```

- 参数解析用 Node 自带的 `util.parseArgs`。
- `--theme` 默认 `default`。主题不存在时报错，并列出可用主题。
- `build` 默认输出到输入文件所在目录、同名 `.pdf`（`examples/resume.md` → `examples/resume.pdf`）。
- `preview` 默认输出到输入文件所在目录、同名 `.html`。`preview` 生成的 HTML 用绝对 `file://` 地址**链接**主题 CSS（不内联），这样改完 `theme.css` 刷新浏览器就能看到效果，方便调样式。`-o` 是在原需求之外加的，与 `build` 保持一致。
- `themes` 列出 `themes/` 下每个含 `theme.css` 的目录，显示名称、描述、作者（来自 `theme.json`；缺少 `theme.json` 时用目录名）。
- `-h/--help` 输出用法。CLI 输出用英文。
- 出错（文件不存在、主题不存在、浏览器启动失败）时给出清楚的说明，退出码非 0。浏览器启动失败的提示里要指向 README 的“浏览器下载 / 镜像”说明。
- `package.json`：`bin: { "resume-to-pdf": "bin/resume-to-pdf.js" }`，scripts 包括 `build`、`preview`、`themes`（都是 `node bin/resume-to-pdf.js <子命令>`）以及 `test`（`node --test`）。这样 `npm run build -- examples/resume.md` 能直接工作。
- 主题目录相对于包自身的位置解析（不依赖当前工作目录）。

### 5.3 简历 Markdown 格式

**front matter**（可选，YAML）：

| 字段 | 含义 | 页眉中的显示 |
|---|---|---|
| `name` | 姓名 | 大号标题 |
| `role` | 求职方向 / 职位 | 姓名下方一行 |
| `location` | 城市 | 联系方式行 |
| `phone` | 电话 | 联系方式行，链接 `tel:` |
| `email` | 邮箱 | 联系方式行，链接 `mailto:` |
| `website` | 个人网站 | 联系方式行，显示时去掉协议前缀 |
| `github` | GitHub 地址 | 同上；不带协议的写法（`github.com/x`）自动补 `https://` |
| `lang` | 文档语言（可选） | 写入 `<html lang>`；不填时正文含 CJK 字符则为 `zh-CN`，否则为 `en` |

- 联系方式行的顺序固定为 `location · phone · email · website · github`，缺的字段跳过。
- 其他键（如 Obsidian 的 `tags`、`created`、`title`）一律忽略。职位用 `role`，不用 `title`，因为 Obsidian 笔记常用 `title` 作为笔记标题。
- 没有 front matter 或没有任何页眉字段时，不输出页眉，正文照常渲染。正文里的 `# 一级标题` 由主题按姓名的样式处理。

**条目标题识别**（通用规则，适用于 `###` 和 `####`）：

- 标题末尾是一个日期范围，并且日期范围写在括号里（`()` 或 `（）`），或跟在 `|` / `｜` 后面 → 这个标题是“条目标题”，排成“标题靠左、日期靠右”。
- 剩下的文字按 `|` / `｜` 切分：第一段是主标题（公司、项目、学校），其余各段用 ` · ` 连成副标题（职位、学历）。各段内部的行内 Markdown（链接、加粗）照常渲染。
- 日期格式：`YYYY`、`YYYY.MM`、`YYYY-MM`、`YYYY/MM`、`YYYY年MM月`；范围分隔符：`-` `–` `—` `~` `～` `〜` `至` `to`；结束值也可以是 `至今` `今` `现在` `Present` `Now` `Current`（大小写不敏感）。允许只写一个日期（如毕业时间）。
- 显示时统一格式：日期为 `YYYY.MM`（月份补零），范围分隔符为 ` – `（前后有空格的 en dash）。“至今”保留中文，英文的结束词统一为 `Present`。
- 不符合规则的标题保持原样，不报错。

示例：

```markdown
### 青禾生鲜 ｜ 高级数据分析师（2022.03 – 至今）
### Acme Inc. | Senior Engineer (2021-03 to present)
### 门店选址评分模型（2023.06—2023.11）
### 指标口径治理
```

**重点**：由作者用 `**加粗**` 标出，主题负责把它显示得醒目。

### 5.4 渲染流程

1. 读取输入文件，拆出 front matter 并用 `js-yaml` 解析，得到 `meta` 和 `body`。
2. `markdown-it`（`html: true`、`linkify: true`）渲染 `body`，带两条自定义 core rule：
   - **条目标题**：按 §5.3 改写 `h3`/`h4` 的行内 token，给标题加 `entry-head` class。行内内容用 `md.parseInline` 重新解析。
   - **分节包裹**：每个顶层 `h2` 开启一个 `<section class="section">`，每个顶层 `h3` 开启一个 `<article class="entry">`，直到下一个同级或更高级标题为止。第一个 `h2` 之前的内容不包裹。
3. 由 `meta` 生成页眉 HTML（所有字段做 HTML 转义）。
4. 读取主题的 `template.html`（没有就用 `src/template.html`），替换占位符，得到完整 HTML。
5. 根据子命令输出：
   - `preview`：写出 HTML 文件。
   - `build`：把 HTML 写到临时目录的文件里。`<base href>` 指向输入文件所在目录，让正文里的相对路径（如图片）相对 Markdown 文件解析。puppeteer `page.goto(file://…)` 打开后等待 `document.fonts.ready`，然后 `page.pdf({ preferCSSPageSize: true, printBackground: true })`，最后删除临时文件。

### 5.5 HTML 结构约定（主题依赖这些 class）

```html
<main class="resume">
  <header class="resume-header">
    <h1 class="name">…</h1>
    <p class="role">…</p>
    <ul class="contact"><li>…</li>…</ul>
  </header>
  <section class="section">
    <h2>工作经历</h2>
    <article class="entry">
      <h3 class="entry-head">
        <span class="entry-main">
          <span class="entry-title">青禾生鲜</span>
          <span class="entry-sub">高级数据分析师</span>
        </span>
        <span class="entry-date">2022.03 – 至今</span>
      </h3>
      …正文…
    </article>
  </section>
</main>
```

没有日期的 `h3` 也会被包进 `article.entry`，只是标题上没有 `entry-head` class，也没有上面这些 span。README 的“新增主题”一节要列出这些 class。

### 5.6 主题机制

- 主题目录：`themes/<name>/`。
  - `theme.css`（必需）。
  - `template.html`（可选）。
  - `theme.json`（建议提供）：`{ "name": "...", "description": "...", "author": "..." }`。
  - 其他资源（字体、图片）自由放置，在 CSS 里用相对路径引用即可。CSS 是通过绝对 `file://` 链接加载的，相对路径会按 CSS 文件自身的位置解析。
- 模板占位符：
  - 原样插入的 HTML：`{{styles}}`（主题 CSS 的 `<link>` 标签）、`{{header}}`、`{{content}}`。
  - 转义后的文本：`{{lang}}`、`{{title}}`（文档标题，取 `name`，没有则为 `Resume`），以及 front matter 的每个字段 `{{name}}`、`{{role}}`……。
  - 未定义的占位符替换为空字符串。保留名（`styles`、`header`、`content`、`lang`、`title`）优先于同名的 front matter 字段。
- 内置模板 `src/template.html` 大致是：`<!doctype html><html lang="{{lang}}"><head><meta charset="utf-8"><title>{{title}}</title>{{styles}}</head><body><main class="resume">{{header}}{{content}}</main></body></html>`。

### 5.7 default 主题视觉规范

数值来自试做时调好的版本（作者已看过 PDF 并选定），实现时可以微调，但观感不能偏离。试做文件见 §7，实现时以 `theme-c.css` 为起点整理成 `themes/default/theme.css`，再用 `example.pdf` 逐页对照。

- **纸张与边距**：`@page { size: A4; margin: 18mm 16mm; }`，打印时 `.resume` 左右各加 3mm 内边距，文字到纸边实际是 19mm。这 3mm 用来放条目标题左侧的细条：画在页边距区域里的内容会被 Chrome 打印裁掉，这一点试做时已经验证过。
- **字体**：`-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif`。
- **正文**：10.5pt，行高 1.5。
- **颜色**：
  - 正文 `#3a3a3a`；
  - 加粗与标题 `#111`；
  - 次要信息 `#6e6e6e`；
  - 更淡的信息 `#9b9b9b`；
  - 细线 `#cfd4da`；
  - 唯一的点缀色是低饱和深蓝 `#1f3a5a`，只用在姓名、章节标题、条目左侧细条三处。
- **层级**：
  - 姓名：22pt、半粗、深蓝；
  - 职位（`role`）：11.5pt；
  - 联系方式：9.5pt 灰色，用 `·` 分隔；
  - 章节标题 `h2`：11.5pt、半粗、深蓝、字距略宽，下方 0.6pt 细线；
  - 条目标题 `h3`（公司、项目、学校）：11.5pt、近黑、半粗，左侧一条 2pt 宽、圆角的深蓝细条（作者在三种候选里选的“C 样式”）。`article.entry` 里的**每个** `h3` 都有细条，不管带不带日期（选择器是 `.entry > h3`，试做稿里没有日期的“指标口径治理”也有细条）；
  - 副标题：常规字重，前面用一条 0.6pt 细竖线隔开；
  - 日期：9.5pt 灰色、右对齐、等宽数字；
  - `h4`：9pt 灰色小标签。`h4` 的定位是“产品描述”“工作内容”这类条目内的小节标签；带日期的 `h4` 也只是在小标签这一行里把日期靠右，不升级成条目样式，也不单独包裹。作者自己的简历里，项目是写在单独一节里的 `###`，不是公司下面的 `####`。
- **正文元素**：条目内的说明段落用灰色，好让要点列表（成果）先被看到；加粗用近黑色、600 字重；列表项目符号用浅灰。条目之间的间距约 13pt。
- **链接**：继承文字颜色，不加下划线。
- **屏幕预览**（`@media screen`）：页面放在浅灰背景上的白色 A4 纸面里，方便在浏览器里调样式。
- **黑白打印**：深蓝打印出来是深灰，层级主要靠字号和字重区分，黑白打印下依然清楚。
- **分页**：
  - `h2, h3, h4 { break-after: avoid; }`；
  - `li, .entry-head { break-inside: avoid; }`；
  - `p { orphans: 2; widows: 2; }`。

### 5.8 示例简历

- 两份示例都用虚构的人物和公司，与作者本人的经历无关。中文版以试做时的“苏晚 · 数据分析师”为蓝本（试做稿已发给作者），英文版写同一个人物。
- 示例要覆盖这些情况：
  - front matter；
  - 带副标题和日期的条目；
  - 混用的日期写法（`2022.03 – 至今`、`2019/07 - 2022/02`、`2015.09—2019.06`）；
  - 有日期和没有日期的项目；
  - `####` 小节；
  - 加粗的成果数字；
  - 一节不按任何约定写的普通列表（“其他”）。
- 中文示例用 default 主题时大约 1.5～2 页，用来验证分页。

### 5.9 README

- `README.md`（英文，默认）和 `README.zh-CN.md`，顶部互相链接：`English | [简体中文](README.zh-CN.md)` / `[English](README.md) | 简体中文`。
- 内容：
  - 简介；
  - 安装（含 Chromium 下载说明、镜像与使用本机 Chrome 的方法、Linux 中文字体）；
  - 用法（三个子命令与 npm scripts）；
  - Markdown 简历格式（front matter 字段表、条目标题规则与示例）；
  - 主题列表；
  - 如何自定义 / 新增主题（目录结构、`theme.json`、占位符、HTML class 约定）；
  - 许可证。
- 文档里的命令必须与实际行为一致。

### 5.10 仓库与提交

- `git init` 后只做仓库级配置（见 §3）。
- `.gitignore`：
  - `node_modules/`；
  - `*.pdf`；
  - `examples/*.html`（只忽略预览生成的 HTML，模板文件 `src/template.html`、`themes/*/template.html` 要保留）；
  - `.DS_Store`、`Thumbs.db`；
  - `npm-debug.log*`；
  - 常见编辑器目录。
- 提交 `package-lock.json`。
- `LICENSE`：MIT，版权人 jianjustin。
- 建议的提交单元（实现者可调整粒度）：
  1. `chore: initialize project`
  2. `docs: add design spec`
  3. `feat: parse front matter and resume entries`
  4. `feat: render html with themes and templates`
  5. `feat: export pdf via puppeteer`
  6. `feat: add build, preview and themes commands`
  7. `feat: add default theme`
  8. `docs: add example resumes`
  9. `docs: add English and Chinese README`

### 5.11 测试与验收

- 单元测试用 `node:test`，不增加依赖。覆盖：
  - front matter 拆分（有 / 无 / 空）；
  - 条目标题识别（各种括号、分隔符、日期格式、至今 / Present、无日期、标题中含链接）；
  - 日期规范化；
  - 分节包裹；
  - 模板占位符替换与转义；
  - 主题列表。
- “干净环境”的含义（设计者的决定）：在作者的 macOS 上把仓库重新 clone 到一个空目录，执行 `npm install && npm run build -- examples/resume.md`，不复用已有的 `node_modules`。Linux / Docker / CI 不在必须通过的范围内，不加 CI 配置，也不默认加 `--no-sandbox`。README 只提示 Linux 上要装中文字体（`fonts-noto-cjk`），以及以 root 身份在容器里运行时 Chrome 可能需要额外配置。
- 端到端检查：
  1. 按上面的定义，在干净环境下执行 `npm install && npm run build -- examples/resume.md`，生成 PDF；
  2. 英文示例同样能生成；
  3. `npm run themes` 列出 `default`；
  4. 用 `pdftoppm` 把 PDF 每页转成图片逐页查看：无乱码、无溢出、细条可见、标题没有孤立在页尾；
  5. 用 `pdftotext` 确认中文文字可以提取；
  6. 用 `git log --format='%an <%ae>%n%B'` 确认所有提交的作者都是 jianjustin，且不含 AI 署名。
- 完成后告诉作者示例 PDF 的路径。

## 6. 留给实现者

- `src/` 内的模块拆分与函数签名。
- 错误信息的具体措辞、`--help` 的格式。
- 临时文件的位置与清理方式。
- 英文示例的具体文字。
- README 的行文。
- 在不改变观感的前提下微调 default 主题的具体数值。
- 提交粒度的细节（保持按逻辑单元分次提交）。

## 7. 试做中已验证的事实

试做文件在会话的临时目录 `/private/tmp/claude-501/-Users-chenjianrui--claude-spares-spare-blyWhP/933f8028-3601-4fcd-8b98-9faf12d3b2fc/scratchpad/spike/` 下（不入库，实现阶段在同一会话里使用）：

- `theme-c.css`：最终选定的样式。它由 `theme.css`、追加的 C 样式覆盖和页边距修正拼接而成，整理时需要合并重复规则。
- `example.md` / `example.pdf`：中文示例“苏晚”的试做稿及其输出。
- `render.mjs`：条目标题识别与分节包裹的试做实现。
- `compare.png`：A/B/C 三种标题样式的对比图。

- Chrome 无头打印会遵守 `@page` 的 A4 尺寸和页边距。
- `break-after: avoid` 能避免标题孤立在页尾（两份样例都没有出现）。
- 画在页边距区域内的内容会被裁掉（因此有 §5.7 的 16mm + 3mm 做法）。
- macOS 上苹方 / SF 字体以 Type 3 嵌入，`pdftotext` 能正确提取中英文。
- 用 markdown-it core rule 改写标题行内 token、用 `parseInline` 解析各段文字，这个做法可行。
