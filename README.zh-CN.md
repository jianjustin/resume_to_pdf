[English](README.md) | 简体中文

# resume-to-pdf

## 简介

把 Markdown 简历转换为整洁的单栏 A4 PDF。可选的 YAML front matter 提供页眉，普通 Markdown 提供正文。支持中文和英文简历，HTML 预览便于快速调整主题。参见[示例简历](examples/resume.md)。

## 环境要求

- Node.js **≥ 22.12** 和 npm。
- Chrome（由 Puppeteer 下载，或使用本机已安装的版本）。
- 覆盖简历所需字符的系统字体。

## 安装

在项目目录中运行：

```sh
npm install
```

## 浏览器

只要包管理器允许执行 Puppeteer 的安装脚本，Puppeteer 就会在安装时自动下载 Chrome for Testing 和 Chrome headless shell。如果 npm 提示 Puppeteer 的 `postinstall` 尚未获准执行，请先按包管理器的安装脚本策略审查并批准，再依赖自动下载。安装成功本身不代表浏览器已经下载。生成 PDF 使用 Chrome；HTML 预览不会启动浏览器。

### 下载与镜像

如果无法访问默认下载源，以下 **Puppeteer 25** 环境变量可为两种默认下载的浏览器指定镜像（POSIX shell）：

```sh
PUPPETEER_CHROME_DOWNLOAD_BASE_URL=https://cdn.npmmirror.com/binaries/chrome-for-testing \
PUPPETEER_CHROME_HEADLESS_SHELL_DOWNLOAD_BASE_URL=https://cdn.npmmirror.com/binaries/chrome-for-testing \
npm install
```

这些变量名已根据当前安装的 Puppeteer 实现确认。尚未测试从镜像全新下载，不能保证镜像可用或涵盖你的浏览器版本及平台。使用现有浏览器缓存完成安装，并不代表验证了镜像。

### 使用本机 Chrome

如果不想在安装时下载浏览器：

```sh
PUPPETEER_SKIP_DOWNLOAD=true npm install
```

在生成 PDF 所用的环境中，将 `PUPPETEER_EXECUTABLE_PATH` 设置为**本机 Chrome 可执行文件的绝对路径**。含空格的路径需要加引号。macOS 上 Google Chrome 的常见路径是 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`；请使用本机的实际位置，而不只是 `.app` 目录。`PUPPETEER_SKIP_DOWNLOAD` 只跳过安装时的下载，不会查找或安装 Chrome。运行 `build` 时也要保留可执行文件路径设置。

### Linux 与容器

Debian/Ubuntu 上请通过系统包管理器安装 `fonts-noto-cjk`，为中文提供合适的字体。其他 Linux 发行版需要等效的 CJK 字体包，以及 Chrome 的运行库。默认主题使用系统字体，不自带字体。

在容器中以 root 运行 Chrome 时，可能需要额外的沙箱或容器配置。优先使用非 root 用户并正确配置 Chrome 沙箱；禁用沙箱不是安全的默认方案，CLI 也不会自动禁用。Linux 软件包安装及 root 容器行为未在 macOS 上验证。

## 用法

在项目目录中运行：

```sh
node bin/resume-to-pdf.js build examples/resume.md
node bin/resume-to-pdf.js preview examples/resume.md
node bin/resume-to-pdf.js themes
```

| 子命令 | 参数与结果 |
| --- | --- |
| `build` | 必填 Markdown 输入路径；默认在输入文件旁生成同名 `.pdf`。 |
| `preview` | 必填 Markdown 输入路径；默认在输入文件旁生成同名 `.html`。 |
| `themes` | 无需输入文件；列出主题 ID、描述和作者。 |

`build` 和 `preview` 支持用 `-o` / `--output` 指定输出路径，用 `--theme` 选择主题 ID（默认 `default`）。`-h` / `--help` 输出用法。含空格的路径必须加引号。例如：

```sh
node bin/resume-to-pdf.js build examples/resume.md -o examples/resume-custom.pdf --theme default
node bin/resume-to-pdf.js preview examples/resume.md --output examples/resume-custom.html --theme default
node bin/resume-to-pdf.js --help
```

对应的 npm scripts 写法（参数前使用 `--`）：

```sh
npm run build -- examples/resume.md
npm run preview -- examples/resume.md
npm run themes
```

也可以在当前项目中调用包的 CLI 入口：

```sh
npx resume-to-pdf themes
```

默认示例会生成 `examples/resume.pdf` 和 `examples/resume.html`。在浏览器中打开 HTML 文件即可预览。主题路径相对于包自身解析，不依赖当前工作目录。CLI 提示为英文；出错时退出码非零。

## 简历格式

### 可选的 YAML front matter

将 front matter 放在 Markdown 文件最开头的两行 `---` 之间。完整文档可参考示例简历。

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

语言检测会检查正文和显示在页眉中的字段。联系方式行的顺序固定为 `location · phone · email · website · github`，缺的字段跳过。不认识的键（如 Obsidian 的 `tags`、`created`、`title`）不会用于标准页眉。职位用 `role`，不用 `title`。自定义模板可以显式引用标量类型的 front matter 字段，详见下文。

没有 front matter 或没有任何页眉字段时，不输出页眉，正文照常渲染。正文里的 `# 一级标题` 由默认主题按姓名的样式处理。

### 条目标题

以下规则不依赖具体语言，适用于 `###` 和 `####` 标题：

- 标题末尾是日期或日期范围，写在括号里（`()` 或 `（）`），或跟在 `|` / `｜` 后面，就会成为“条目标题”：标题靠左，日期靠右。
- 剩下的文字按 `|` / `｜` 切分：第一段是主标题（公司、项目、学校），其余各段用 ` · ` 连成副标题（职位、学历）。各段内部的行内 Markdown（链接、加粗）照常渲染。
- 日期格式：`YYYY`、`YYYY.MM`、`YYYY-MM`、`YYYY/MM`、`YYYY年MM月`；范围分隔符：`-`、`–`、`—`、`~`、`～`、`〜`、`至`、`to`；结束值也可以是 `至今`、`今`、`现在`、`Present`、`Now`、`Current`（英文不区分大小写）。允许只写一个日期，如毕业时间。
- 显示时日期统一为 `YYYY.MM`，月份补零（只有年份时仍显示 `YYYY`）；范围分隔符统一为 ` – `，即前后有空格的 en dash。中文的当前时间词统一显示为 `至今`，英文的统一为 `Present`。
- 不符合规则的标题保持原样，不报错。

```markdown
### 青禾生鲜 ｜ 高级数据分析师（2022.03 – 至今）
### Acme Inc. | Senior Engineer (2021-03 to present)
### 门店选址评分模型（2023.06—2023.11）
### 指标口径治理
```

前三个是带日期的条目，最后一个保留为普通标题。用 `**加粗**` 标出重要成果，主题负责视觉强调。

## 主题

- **`default`** — 整洁的单栏布局，搭配低饱和海军蓝强调色，便于快速浏览。作者：jianjustin。

## 新增主题

### 文件与元数据

在包的 `themes/` 目录内新增一个目录。目录名就是 `--theme` 使用的 ID：

```text
themes/my-theme/
├── theme.css       （必需）
├── theme.json      （建议提供）
├── template.html   （可选）
└── fonts/          （可选字体资源）
```

只有包含 `theme.css` 的目录才会被列为主题。`theme.json` 描述显示名称、描述和作者；没有该文件时，显示名称使用目录名：

```json
{
  "name": "My theme",
  "description": "A personal resume layout.",
  "author": "Your name"
}
```

可选的 `template.html` 会替换内置的 `src/template.html`。模板是完整的 HTML 文档，不支持模板逻辑。最小模板如下：

```html
<!doctype html>
<html lang="{{lang}}">
<head>
  <meta charset="utf-8">
  <title>{{title}}</title>
  {{styles}}
</head>
<body>
  <main class="resume">{{header}}{{content}}</main>
</body>
</html>
```

### 占位符

| 占位符 | 替换内容 |
| --- | --- |
| `{{styles}}` | 原样插入 HTML：主题 CSS 的 `<link>` 和文档资源基址的 `<base>` 标签 |
| `{{header}}` | 原样插入 HTML：生成的简历页眉 |
| `{{content}}` | 原样插入 HTML：渲染后的 Markdown 正文 |
| `{{lang}}` | HTML 转义后的文档语言 |
| `{{title}}` | HTML 转义后的文档标题：取 `name`，没有则为 `Resume` |
| `{{name}}`、`{{role}}`、`{{location}}`、`{{phone}}`、`{{email}}`、`{{website}}`、`{{github}}` | HTML 转义后的 front matter 值；也可以引用其他标量类型的 front matter 字段 |

未定义的占位符替换为空字符串。front matter 值只有字符串、数字、布尔值会被替换。保留名（`styles`、`header`、`content`、`lang`、`title`）优先于同名的 front matter 字段。这里的转义是 HTML 转义，不是 URL 校验；请使用可信的 Markdown、主题和资源。

### HTML 结构与 class

主题依赖以下 class 名，自定义模板应保留它们：

```html
<main class="resume">
  <header class="resume-header">
    <h1 class="name">…</h1>
    <p class="role">…</p>
    <ul class="contact"><li>…</li>…</ul>
  </header>
  <section class="section">
    <h2>工作经历</h2>
    <div class="section-body">
    <article class="entry">
      <h3 class="entry-head">
        <span class="entry-main">
          <span class="entry-title">青禾生鲜</span>
          <span class="entry-sub">高级数据分析师</span>
        </span>
        <span class="entry-date">2022.03 – 至今</span>
      </h3>
      …
    </article>
    </div>
  </section>
</main>
```

`resume` 是页面容器；`resume-header`、`name`、`role`、`contact` 组成可选页眉。`h2` 开始一个 `section`，其后的内容包在 `section-body` 中。在 section 内，每个 `h3` 开始一个 `article.entry`，即使没有日期也是如此。识别出的带日期 `h3` / `h4` 使用 `entry-head`、`entry-main`、`entry-title`、可选的 `entry-sub` 和 `entry-date`。没有日期的 `h3` 没有 `entry-head`，也没有自动生成的 span。`h4` 不会开始另一个 article。

### 字体与样式调试

主题可以自带字体（请检查其再分发许可）。将 `ResumeSans.woff2` 放入主题的 `fonts/` 目录后，可以在 `theme.css` 中用相对路径引用，例如：

```css
@font-face {
  font-family: "Resume Sans";
  src: url("./fonts/ResumeSans.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
}
body { font-family: "Resume Sans", "Noto Sans CJK SC", sans-serif; }
```

这里的字体文件仅为示意，并未附带；使用这段 CSS 前请先提供文件。确保字体覆盖所需的 CJK 字符，或提供系统字体回退。主题 CSS 通过绝对 `file://` URL 链接，因此相对字体或图片路径以 CSS 文件本身的位置为基准。生成 PDF 时会等待文档字体就绪。

选择你的主题运行 `preview`，打开生成的 HTML，修改 `theme.css` 后刷新浏览器即可。CSS 是链接而非内联，仅修改 CSS 无需重新运行 preview。修改 Markdown 或 HTML 模板后需要重新运行 preview。要更新 PDF，则需重新构建。

## 许可证

[MIT](LICENSE)。
