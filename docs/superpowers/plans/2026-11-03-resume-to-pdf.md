# resume-to-pdf Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零实现一个多主题的 Markdown 简历 → A4 PDF 命令行工具（`build` / `preview` / `themes`），附带打磨过的 `default` 主题、中英文示例和中英文 README。

**Architecture:** 流程是 front matter 拆分 → markdown-it（加两条 core rule：识别条目标题、把章节和条目包裹成结构）→ 根据主题模板组装 HTML → puppeteer 打开临时 HTML 文件并导出 PDF。各模块都是纯函数，CLI 只负责参数解析和分发子命令，主题是 `themes/<name>/` 目录。

**Tech Stack:** Node.js ≥ 22.12（ESM）、markdown-it 14、js-yaml 4、puppeteer 25、`node:test`。

**Spec:** `docs/superpowers/specs/2026-11-03-resume-to-pdf-design.md`（实现前必读，尤其是 §5.3 规则、§5.5 HTML 约定、§5.7 视觉规范）

**试做参考：** 试做文件在 `/private/tmp/claude-501/-Users-chenjianrui--claude-spares-spare-blyWhP/933f8028-3601-4fcd-8b98-9faf12d3b2fc/scratchpad/spike/`，包括 `render.mjs`（core rule 的写法）、`theme-c.css`（选定的样式）、`example.md` / `example.pdf`（中文示例及其输出）。

## Global Constraints

- `package.json`：`"engines": { "node": ">=22.12.0" }`，`"type": "module"`。
- 运行时依赖只有 `markdown-it@^14`、`js-yaml@^4`、`puppeteer@^25`，不加任何 devDependencies（测试用 `node:test`）。
- 参数解析用 `node:util` 的 `parseArgs`，不用 CLI 框架；不用模板引擎。
- CLI 的所有输出（提示、报错、帮助）都用英文。
- Git 只在仓库内设置：`git config user.name "jianjustin"`、`git config user.email "janine.jian.chen@gmail.com"`，绝不能改全局配置。
- 提交信息**不得**含任何 AI 署名：不能有 `Co-Authored-By`、`Generated with`、Claude、Anthropic 等字样，即使所用工具默认会加，也要去掉。
- 提交信息使用 Conventional Commits（`feat:` / `docs:` / `chore:`），每个任务按逻辑单元提交。
- 识别规则不能依赖具体的中文词，例如“工作经历”“产品描述”。
- §5.5 中的 HTML class 名是对主题的约定，不得改名。

## Review Focus

1. 输入路径含空格或中文（例如作者的 `OneDrive-个人/笔记库/…`）：要能正常生成，`<base href>` 和 file URL 都要正确编码。测试见 Task 4、5、6。
2. 直接拿 Obsidian 笔记来跑，front matter 里有 `title`、`tags` 数组、`created` 日期：不报错，页眉里不出现这些字段。测试见 Task 4。
3. 文件是 Windows 换行（CRLF）或带 BOM：front matter 仍然能识别。测试见 Task 2。
4. front matter 的值含 HTML 特殊字符（`R&D <Lab>`）：要转义，不能破坏页面。测试见 Task 4。
5. `-o` 指向不存在的目录：自动创建目录。测试见 Task 5、6。

---

### Task 1: 初始化仓库与项目骨架

**Files:**
- Create: `package.json`、`.gitignore`、`LICENSE`
- Commit（已存在）：`docs/superpowers/specs/2026-11-03-resume-to-pdf-design.md`、`docs/superpowers/plans/2026-11-03-resume-to-pdf.md`

**Interfaces:**
- Produces: 安装好依赖的 ESM 项目；之后各任务都在这个基础上加文件。

- [ ] **Step 1: 初始化 git 并设置仓库级身份**

```bash
git init
git config user.name "jianjustin"
git config user.email "janine.jian.chen@gmail.com"
```

Run: `git config --local --get user.name; git config --global --get user.name`
Expected: 第一行是 `jianjustin`，第二行是 `chenjianrui`（全局配置没有变）

- [ ] **Step 2: 写 `package.json`**

字段如下：
- `name: "resume-to-pdf"`、`version: "0.1.0"`、`type: "module"`、`license: "MIT"`、`author: "jianjustin"`；
- `description`：一句英文；
- `bin: { "resume-to-pdf": "bin/resume-to-pdf.js" }`；
- `engines.node: ">=22.12.0"`；
- `scripts`：
  - `"build": "node bin/resume-to-pdf.js build"`
  - `"preview": "node bin/resume-to-pdf.js preview"`
  - `"themes": "node bin/resume-to-pdf.js themes"`
  - `"test": "node --test"`

- [ ] **Step 3: 写 `.gitignore` 和 `LICENSE`**

`.gitignore` 的内容：

```
node_modules/
*.pdf
examples/*.html
.DS_Store
Thumbs.db
npm-debug.log*
.idea/
.vscode/
```

`LICENSE`：标准 MIT 文本，版权行写 `Copyright (c) 2026 jianjustin`。

- [ ] **Step 4: 安装依赖**

Run: `npm install markdown-it@^14 js-yaml@^4 puppeteer@^25`
Expected: 安装成功，并且下载了 Chrome。如果因为网络下载失败，查 `node_modules/puppeteer` 文档里下载源环境变量的确切名字（`*_DOWNLOAD_BASE_URL`），设成 npmmirror 的 chrome-for-testing 镜像后重试，并把用到的变量名记下来给 Task 8 的 README 用。

- [ ] **Step 5: 确认浏览器可用**

Run: `node -e "import('puppeteer').then(async p => { const b = await p.default.launch(); console.log(await b.version()); await b.close(); })"`
Expected: 打印出 Chrome 版本号

- [ ] **Step 6: 提交两次**

```bash
git add package.json package-lock.json .gitignore LICENSE
git commit -m "chore: initialize project"
git add docs/
git commit -m "docs: add design spec and implementation plan"
```

Run: `git log --format='%an <%ae>%n%B'`
Expected: 两个提交的作者都是 `jianjustin <janine.jian.chen@gmail.com>`，正文没有署名行

---

### Task 2: front matter 与条目标题解析（纯函数）

**Files:**
- Create: `src/frontmatter.js`、`src/entry.js`
- Test: `test/frontmatter.test.js`、`test/entry.test.js`

**Interfaces:**
- Produces:
  - `parseFrontMatter(source: string): { meta: Record<string, unknown>, body: string }`
  - `parseEntryHeading(text: string): { title: string, subtitle: string, date: string } | null`。`text` 是标题的原始行内 Markdown；返回的 `title` 和 `subtitle` 仍是原始 Markdown，`date` 已经规范化。

- [ ] **Step 1: 写 front matter 的失败测试**

```js
test('splits yaml front matter from body', () => {
  const { meta, body } = parseFrontMatter('---\nname: 苏晚\nrole: 数据分析师\n---\n\n## 个人简介\n');
  assert.deepEqual(meta, { name: '苏晚', role: '数据分析师' });
  assert.equal(body, '\n## 个人简介\n');
});
test('no front matter returns empty meta and the untouched source', () => {
  const src = 'intro\n\n---\n\nmore';           // a later hr is not front matter
  assert.deepEqual(parseFrontMatter(src), { meta: {}, body: src });
});
test('handles BOM and CRLF', () => {
  assert.deepEqual(parseFrontMatter('﻿---\r\nname: A\r\n---\r\nbody'), { meta: { name: 'A' }, body: 'body' });
});
test('empty block yields empty meta', () => {
  assert.deepEqual(parseFrontMatter('---\n---\nbody'), { meta: {}, body: 'body' });
});
test('keeps unknown keys with their yaml types', () => {
  const { meta } = parseFrontMatter('---\ntags: [a, b]\ncreated: 2026-11-02\n---\n');
  assert.deepEqual(meta.tags, ['a', 'b']);
  assert.ok(meta.created instanceof Date);
});
test('non-object yaml yields empty meta', () => {
  assert.deepEqual(parseFrontMatter('---\njust text\n---\nbody').meta, {});
});
test('invalid yaml throws a readable error', () => {
  assert.throws(() => parseFrontMatter('---\nname: [oops\n---\n'), /Invalid front matter/);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test test/frontmatter.test.js`
Expected: FAIL，原因是模块不存在

- [ ] **Step 3: 在 `src/frontmatter.js` 实现 `parseFrontMatter`**

用正则 `^﻿?---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)` 匹配，`js-yaml` 的 `load` 解析。解析结果不是普通对象时 `meta = {}`。YAML 报错时抛出 `Error('Invalid front matter: ' + reason)`。

- [ ] **Step 4: 写条目标题的失败测试（表驱动）**

```js
const entries = [
  ['青禾生鲜 ｜ 高级数据分析师（2022.03 – 至今）', '青禾生鲜', '高级数据分析师', '2022.03 – 至今'],
  ['木棉出行 ｜ 数据分析师（2019/07 - 2022/02）', '木棉出行', '数据分析师', '2019.07 – 2022.02'],
  ['云溪大学 ｜ 统计学 · 本科（2015.09—2019.06）', '云溪大学', '统计学 · 本科', '2015.09 – 2019.06'],
  ['云笺软件（2022.12 ～ 2023.09）', '云笺软件', '', '2022.12 – 2023.09'],
  ['北辰云服务 （ 2020.08 ~ 2022.12 ）', '北辰云服务', '', '2020.08 – 2022.12'],
  ['门店选址评分模型 | 2023.06 – 2023.11', '门店选址评分模型', '', '2023.06 – 2023.11'],
  ['Acme Inc. | Senior Engineer (2021-03 to present)', 'Acme Inc.', 'Senior Engineer', '2021.03 – Present'],
  ['Startup (2024 – Now)', 'Startup', '', '2024 – Present'],
  ['实习（2023.7 - 今）', '实习', '', '2023.07 – 至今'],
  ['某公司（2020年8月 至 2022年12月）', '某公司', '', '2020.08 – 2022.12'],
  ['某大学（2021.6）', '某大学', '', '2021.06'],
  ['A | B | C (2017 - 2021)', 'A', 'B · C', '2017 – 2021'],
  ['[Acme](https://acme.test) | Engineer (2021 - 2022)', '[Acme](https://acme.test)', 'Engineer', '2021 – 2022'],
];
for (const [text, title, subtitle, date] of entries) {
  test(`entry: ${text}`, () => assert.deepEqual(parseEntryHeading(text), { title, subtitle, date }));
}
for (const text of ['指标口径治理', 'A | B', 'Projects (2)', '（2020 – 2021）', '2023 年度总结', 'Version 2 (beta)']) {
  test(`not an entry: ${text}`, () => assert.equal(parseEntryHeading(text), null));
}
```

- [ ] **Step 5: 运行测试，确认失败**

Run: `node --test test/entry.test.js`
Expected: FAIL

- [ ] **Step 6: 在 `src/entry.js` 实现 `parseEntryHeading`**

正则（不区分大小写）：

- `D = \d{4}(?:\s*[./\-年]\s*\d{1,2}\s*月?)?`
- `END = (?:D|至今|今|现在|present|now|current)`
- `SEP = (?:—|–|-|~|～|〜|至|to)`
- `RANGE = D(?:\s*SEP\s*END)?`
- 先试 `^(.*?)\s*[（(]\s*(RANGE)\s*[)）]\s*$`，再试 `^(.*?)\s*[|｜]\s*(RANGE)\s*$`。

拆分与规范化：

- 前半部分按 `\s*[|｜]\s*` 切开：第一段是 `title`，其余段用 ` · ` 连成 `subtitle`。`title` 为空时返回 `null`。
- 日期规范成 `YYYY` 或 `YYYY.MM`（月份补零）。`至今`、`今`、`现在` 统一为 `至今`；`present`、`now`、`current` 统一为 `Present`。起止之间用 ` – ` 连接。

- [ ] **Step 7: 运行全部测试，确认通过**

Run: `npm test`
Expected: PASS

- [ ] **Step 8: 提交**

```bash
git add src/frontmatter.js src/entry.js test/frontmatter.test.js test/entry.test.js
git commit -m "feat: parse front matter and entry headings"
```

---

### Task 3: markdown-it 渲染（条目标题 + 章节/条目包裹）

**Files:**
- Create: `src/markdown.js`
- Test: `test/markdown.test.js`

**Interfaces:**
- Consumes: `parseEntryHeading`（Task 2）
- Produces:
  - `createMarkdown(): MarkdownIt`，配置 `html: true`、`linkify: true`、`typographer: false`，并注册两条 core rule；
  - `renderBody(markdown: string): string`，使用模块内单例。

- [ ] **Step 1: 写失败测试**

```js
const flat = (s) => s.replace(/\n/g, '');
test('entry heading becomes title/sub/date spans', () => {
  assert.ok(flat(renderBody('### 青禾生鲜 ｜ 高级数据分析师（2022.03 – 至今）')).includes(
    '<h3 class="entry-head"><span class="entry-main"><span class="entry-title">青禾生鲜</span>' +
    '<span class="entry-sub">高级数据分析师</span></span><span class="entry-date">2022.03 – 至今</span></h3>'));
});
test('no entry-sub without subtitle', () => {
  const html = renderBody('### 门店选址评分模型（2023.06—2023.11）');
  assert.ok(html.includes('<span class="entry-main"><span class="entry-title">门店选址评分模型</span></span><span class="entry-date">2023.06 – 2023.11</span>'));
  assert.ok(!html.includes('entry-sub'));
});
test('inline markdown inside entry parts is rendered', () => {
  assert.ok(renderBody('### [Acme](https://acme.test) | Engineer (2021 - 2022)')
    .includes('<span class="entry-title"><a href="https://acme.test">Acme</a></span>'));
});
test('headings without a date stay plain', () => {
  assert.ok(renderBody('### 指标口径治理').includes('<h3>指标口径治理</h3>'));
  assert.ok(renderBody('### A | B').includes('<h3>A | B</h3>'));
});
test('h4 gets entry layout but is not wrapped', () => {
  const html = renderBody('#### 主要工作（2020 – 2021）');
  assert.ok(html.includes('<h4 class="entry-head">'));
  assert.ok(!html.includes('<article'));
});
test('wraps h2 into sections and h3 into entries', () => {
  const md = 'intro\n\n## 工作经历\n\n### A（2020 – 2021）\n\n- x\n\n### B\n\ntext\n\n## 技能\n\n- y\n';
  assert.equal(flat(renderBody(md)),
    '<p>intro</p><section class="section"><h2>工作经历</h2>' +
    '<article class="entry"><h3 class="entry-head"><span class="entry-main"><span class="entry-title">A</span></span>' +
    '<span class="entry-date">2020 – 2021</span></h3><ul><li>x</li></ul></article>' +
    '<article class="entry"><h3>B</h3><p>text</p></article></section>' +
    '<section class="section"><h2>技能</h2><ul><li>y</li></ul></section>');
});
test('headings nested in blockquotes are not wrapped', () => {
  assert.ok(!renderBody('> ### Quote（2020）').includes('<article'));
});
test('free-form markdown renders untouched', () => {
  assert.equal(flat(renderBody('- 英语：CET-6\n- 兴趣：长跑')), '<ul><li>英语：CET-6</li><li>兴趣：长跑</li></ul>');
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test test/markdown.test.js`
Expected: FAIL

- [ ] **Step 3: 在 `src/markdown.js` 实现 `createMarkdown` / `renderBody`**

做法参照试做的 `render.mjs`：

- **条目标题**：在 `core.ruler.push` 注册的 rule 里，遇到 `heading_open` 且 tag 为 h3 或 h4 时，对后面那个 inline token 的 `content` 调用 `parseEntryHeading`。匹配成功就用 `html_inline` token 加上 `md.parseInline(part, state.env)[0].children` 重建 `children`，日期用 `md.utils.escapeHtml` 转义，并给 heading_open 加 `attrJoin('class', 'entry-head')`。
- **包裹**：只处理 `level === 0` 的 h2 和 h3，插入 `html_block` token。h2 先关闭当前的 article 和 section，再开新的 section；h3 先关闭当前的 article，再开新的 article；最后把还开着的都关闭。

- [ ] **Step 4: 运行全部测试，确认通过**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/markdown.js test/markdown.test.js
git commit -m "feat: render resume markdown with entry and section wrappers"
```

---

### Task 4: 主题加载与 HTML 组装

**Files:**
- Create: `src/themes.js`、`src/render.js`、`src/template.html`
- Create fixtures：
  - `test/fixtures/themes/basic/theme.css`（内容 `body{}`）
  - `test/fixtures/themes/basic/theme.json`（`{"name":"basic","description":"Basic fixture","author":"test"}`）
  - `test/fixtures/themes/custom/theme.css`
  - `test/fixtures/themes/custom/template.html`（内容 `<html lang="{{lang}}"><head>{{styles}}</head><body><h1>{{name}}</h1>{{content}}<p>{{created}}</p></body></html>`，**不提供** theme.json）
  - `test/fixtures/themes/not-a-theme/notes.txt`
- Test: `test/themes.test.js`、`test/render.test.js`

**Interfaces:**
- Consumes: `parseFrontMatter`（Task 2）、`renderBody`（Task 3）
- Produces:
  - `Theme = { id: string, name: string, description: string, author: string, dir: string, cssPath: string, templatePath: string | null }`
  - `THEMES_DIR: string`：包内 `themes/` 的绝对路径，用 `fileURLToPath(new URL('../themes/', import.meta.url))` 得到。
  - `listThemes(themesDir = THEMES_DIR): Theme[]`：只列含 `theme.css` 的目录，按 id 排序。没有 theme.json 时 `name = id`、`description = ''`、`author = ''`。theme.json 不是合法 JSON 时抛 `Error('Invalid theme.json in <dir>: <reason>')`。
  - `loadTheme(name: string, themesDir = THEMES_DIR): Theme`：在 `listThemes` 的结果里按 id 查找。找不到时抛出带 `code = 'THEME_NOT_FOUND'` 的错误，message 为 `Theme "<name>" not found. Available themes: <id, id>`。
  - `buildHeader(meta: object): string`
  - `detectLang(meta: object, body: string): string`
  - `fillTemplate(template: string, reserved: Record<string, string>, fields: Record<string, unknown>): string`
  - `renderDocument(source: string, { theme: Theme, baseDir: string }): string`

- [ ] **Step 1: 写主题的失败测试**

```js
const FIX = fileURLToPath(new URL('./fixtures/themes/', import.meta.url));
test('lists only directories with theme.css, with metadata defaults', () => {
  const themes = listThemes(FIX);
  assert.deepEqual(themes.map((t) => t.id), ['basic', 'custom']);
  assert.deepEqual([themes[0].name, themes[0].description, themes[0].author], ['basic', 'Basic fixture', 'test']);
  assert.equal(themes[0].templatePath, null);
  assert.deepEqual([themes[1].name, themes[1].description], ['custom', '']);
  assert.ok(themes[1].templatePath.endsWith(path.join('custom', 'template.html')));
});
test('unknown or path-like theme names are rejected', () => {
  for (const name of ['nope', '../basic']) {
    assert.throws(() => loadTheme(name, FIX), (e) => e.code === 'THEME_NOT_FOUND' && /Available themes: basic, custom/.test(e.message));
  }
});
test('invalid theme.json reports the theme dir', () => {
  fs.mkdirSync(path.join(tmp, 'bad'));
  fs.writeFileSync(path.join(tmp, 'bad', 'theme.css'), '');
  fs.writeFileSync(path.join(tmp, 'bad', 'theme.json'), '{');
  assert.throws(() => listThemes(tmp), /Invalid theme\.json in .*bad/);
});
```

（各测试文件里的 `tmp` 都用 `fs.mkdtempSync(path.join(os.tmpdir(), 'rtp-test-'))` 在文件顶部创建；Task 5、6 也一样。）

- [ ] **Step 2: 写渲染的失败测试**

```js
test('header renders fields in fixed order with links', () => {
  assert.equal(buildHeader({ name: '苏晚', role: '数据分析师', github: 'github.com/suwan', website: 'https://example.com/',
    email: 'suwan@example.com', phone: '139-0000-0000', location: '杭州' }),
    '<header class="resume-header"><h1 class="name">苏晚</h1><p class="role">数据分析师</p><ul class="contact">' +
    '<li>杭州</li><li><a href="tel:13900000000">139-0000-0000</a></li>' +
    '<li><a href="mailto:suwan@example.com">suwan@example.com</a></li>' +
    '<li><a href="https://example.com/">example.com</a></li>' +
    '<li><a href="https://github.com/suwan">github.com/suwan</a></li></ul></header>');
});
test('header is empty for obsidian-only metadata', () => {
  assert.equal(buildHeader({}), '');
  assert.equal(buildHeader({ title: '笔记标题', tags: ['简历'], created: new Date() }), '');
});
test('header escapes html and accepts numeric phone', () => {
  const html = buildHeader({ name: 'R&D <Lab>', phone: 13900000000 });
  assert.ok(html.includes('R&amp;D &lt;Lab&gt;'));
  assert.ok(html.includes('href="tel:13900000000"'));
});
test('fillTemplate: reserved raw html wins, fields are escaped, others empty', () => {
  assert.equal(fillTemplate('<p>{{name}}</p>{{content}}{{ missing }}{{tags}}{{content2}}', { content: '<b>x</b>' },
    { name: 'A&B', tags: ['a'], content: 'ignored' }), '<p>A&amp;B</p><b>x</b>');
});
test('detectLang', () => {
  assert.equal(detectLang({ lang: 'ja' }, ''), 'ja');
  assert.equal(detectLang({}, '## 工作经历'), 'zh-CN');
  assert.equal(detectLang({}, '## Experience'), 'en');
  assert.equal(detectLang({ name: '苏晚' }, 'Experience'), 'zh-CN');
});
test('renderDocument uses built-in template, base href and linked css', () => {
  const theme = loadTheme('basic', FIX);
  const baseDir = path.join(os.tmpdir(), '我的 简历');
  const html = renderDocument('---\nname: 苏晚\n---\n## 工作经历\n', { theme, baseDir });
  assert.match(html, /^<!doctype html>/i);
  assert.ok(html.includes('<html lang="zh-CN">'));
  assert.ok(html.includes('<title>苏晚</title>'));
  assert.ok(html.includes(`<base href="${pathToFileURL(baseDir).href}/">`));
  assert.ok(html.includes('%E6%88%91%E7%9A%84%20%E7%AE%80%E5%8E%86/'));
  assert.ok(html.includes(`<link rel="stylesheet" href="${pathToFileURL(theme.cssPath).href}">`));
  assert.ok(html.includes('<main class="resume"><header class="resume-header">'));
});
test('renderDocument uses a theme template and survives obsidian front matter', () => {
  const html = renderDocument('---\ntitle: 笔记\ntags: [a]\ncreated: 2026-11-02\n---\n正文', { theme: loadTheme('custom', FIX), baseDir: os.tmpdir() });
  assert.ok(html.includes('<h1></h1><p>正文</p>'));
  assert.ok(html.includes('<p></p>'));
  assert.ok(!html.includes('resume-header'));
});
test('title falls back to Resume', () => {
  assert.ok(renderDocument('text', { theme: loadTheme('basic', FIX), baseDir: os.tmpdir() }).includes('<title>Resume</title>'));
});
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `node --test test/themes.test.js test/render.test.js`
Expected: FAIL

- [ ] **Step 4: 写 `src/template.html`**

```html
<!doctype html>
<html lang="{{lang}}">
<head>
<meta charset="utf-8">
<title>{{title}}</title>
{{styles}}
</head>
<body><main class="resume">{{header}}{{content}}</main></body>
</html>
```

（`<main class="resume">` 后面紧跟 `{{header}}`，中间不能有换行，这样上面的测试断言才成立。）

- [ ] **Step 5: 实现 `src/themes.js` 和 `src/render.js`**

- `buildHeader`：
  - 联系方式顺序：location、phone（`tel:` 后只保留 `[\d+]`）、email、website、github。
  - website 和 github 显示时去掉 `^https?://` 和末尾的 `/`；github 没写协议时补 `https://`。
  - 所有值先 `String()` 再转义。没有 name、role、联系方式时返回 `''`。
- `fillTemplate`：占位符正则是 `\{\{\s*([\w-]+)\s*\}\}`。先查 `reserved`（原样插入），再查 `fields`（只有 string、number、boolean 会被 `String()` 后转义，其他类型一律为 `''`），都没有就替换为 `''`。
- `renderDocument` 传给模板的 `reserved` 是：
  - `styles` = `<base href="<pathToFileURL(baseDir).href>/">` + `<link rel="stylesheet" href="<pathToFileURL(theme.cssPath).href>">`
  - `header` = `buildHeader(meta)`
  - `content` = `renderBody(body)`
  - `lang`、`title`（转义后放入）
- 模板来源：`theme.templatePath` 存在就用它，否则用内置的 `src/template.html`。

- [ ] **Step 6: 运行全部测试，确认通过**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add src/themes.js src/render.js src/template.html test/themes.test.js test/render.test.js test/fixtures
git commit -m "feat: render html with themes and templates"
```

---

### Task 5: 用 puppeteer 导出 PDF

**Files:**
- Create: `src/pdf.js`
- Test: `test/pdf.test.js`

**Interfaces:**
- Produces: `htmlToPdf(html: string, outputPath: string, { launchOptions } = {}): Promise<void>`。浏览器启动失败时，reject 的 Error 带 `code = 'BROWSER_LAUNCH_FAILED'`，`cause` 是原始错误。

- [ ] **Step 1: 写失败测试（每个测试 `{ timeout: 60000 }`）**

```js
test('writes a pdf into missing dirs, including spaces and CJK', async () => {
  const out = path.join(tmp, '我的 简历', 'a', 'r.pdf');
  await htmlToPdf('<!doctype html><html lang="zh-CN"><body><p>你好 PDF</p></body></html>', out);
  assert.equal(fs.readFileSync(out).subarray(0, 5).toString(), '%PDF-');
});
test('launch failure is reported with a code', async () => {
  await assert.rejects(htmlToPdf('<p>x</p>', path.join(tmp, 'x.pdf'), { launchOptions: { executablePath: '/nonexistent/chrome' } }),
    (e) => e.code === 'BROWSER_LAUNCH_FAILED');
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test test/pdf.test.js`
Expected: FAIL

- [ ] **Step 3: 在 `src/pdf.js` 实现 `htmlToPdf`**

1. 用 `fs.mkdtemp(path.join(os.tmpdir(), 'resume-to-pdf-'))` 建临时目录，写入 `index.html`。
2. `puppeteer.launch({ headless: true, ...launchOptions })`，失败时按上面的约定包装错误。
3. `page.goto(pathToFileURL(file).href, { waitUntil: 'load' })`，然后 `await page.evaluate(() => document.fonts.ready)`。
4. `fs.mkdir(dirname(outputPath), { recursive: true })`，再 `page.pdf({ path: outputPath, preferCSSPageSize: true, printBackground: true })`。
5. 在 `finally` 里关闭浏览器，并 `rm` 临时目录。

- [ ] **Step 4: 运行全部测试，确认通过**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/pdf.js test/pdf.test.js
git commit -m "feat: export pdf via puppeteer"
```

---

### Task 6: CLI（build / preview / themes）

**Files:**
- Create: `src/cli.js`、`bin/resume-to-pdf.js`
- Test: `test/cli.test.js`

**Interfaces:**
- Consumes: `listThemes`、`loadTheme`、`THEMES_DIR`、`renderDocument`（Task 4），`htmlToPdf`（Task 5）
- Produces: `main(argv: string[], { stdout = process.stdout, stderr = process.stderr, themesDir = THEMES_DIR } = {}): Promise<number>`，返回退出码：成功 0，出错 1。

- [ ] **Step 1: 写失败测试**

`io()` 返回带 `write` 方法的收集器；`FIX` 同 Task 4；`input` 是临时目录 `我的 简历/resume.md`，内容为 `---\nname: 苏晚\n---\n## 工作经历\n`。

```js
test('help lists all commands', async () => {
  const o = io(); assert.equal(await main(['--help'], { stdout: o }), 0);
  for (const s of ['resume-to-pdf build <input.md>', 'resume-to-pdf preview <input.md>', 'resume-to-pdf themes']) assert.ok(o.text.includes(s));
});
test('no command prints usage and fails', async () => assert.equal(await main([], { stderr: io() }), 1));
test('unknown command', async () => { const e = io(); assert.equal(await main(['make'], { stderr: e }), 1); assert.ok(e.text.includes('Unknown command: make')); });
test('themes lists fixture themes', async () => {
  const o = io(); assert.equal(await main(['themes'], { stdout: o, themesDir: FIX }), 0);
  assert.match(o.text, /^\s*basic\s+.*Basic fixture/m);
});
test('missing input argument', async () => { const e = io(); assert.equal(await main(['build'], { stderr: e }), 1); assert.ok(e.text.includes('Missing input file')); });
test('input not found', async () => { const e = io(); assert.equal(await main(['build', 'missing.md'], { stderr: e }), 1); assert.ok(e.text.includes('Input file not found: missing.md')); });
test('unknown option', async () => { const e = io(); assert.equal(await main(['build', input, '--colour'], { stderr: e }), 1); assert.match(e.text, /--colour/); });
test('unknown theme lists available ones', async () => {
  const e = io(); assert.equal(await main(['build', input, '--theme', 'nope'], { stderr: e, themesDir: FIX }), 1);
  assert.ok(e.text.includes('Theme "nope" not found. Available themes: basic, custom'));
});
test('preview writes html next to the input by default', async () => {
  const o = io(); assert.equal(await main(['preview', input, '--theme', 'basic'], { stdout: o, themesDir: FIX }), 0);
  assert.ok(fs.readFileSync(input.replace(/\.md$/, '.html'), 'utf8').includes('class="resume"'));
  assert.ok(o.text.includes('HTML written to'));
});
test('preview -o creates missing directories', async () => {
  const out = path.join(tmp, 'out', 'nested', 'r.html');
  assert.equal(await main(['preview', input, '--theme', 'basic', '-o', out], { stdout: io(), themesDir: FIX }), 0);
  assert.ok(fs.existsSync(out));
});
test('build writes a pdf', { timeout: 60000 }, async () => {
  const o = io(); assert.equal(await main(['build', input, '--theme', 'basic'], { stdout: o, themesDir: FIX }), 0);
  assert.equal(fs.readFileSync(input.replace(/\.md$/, '.pdf')).subarray(0, 5).toString(), '%PDF-');
  assert.ok(o.text.includes('PDF written to'));
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test test/cli.test.js`
Expected: FAIL

- [ ] **Step 3: 实现 `src/cli.js`**

- **参数解析**：`parseArgs({ args, allowPositionals: true, strict: true, options: { output: { type: 'string', short: 'o' }, theme: { type: 'string', default: 'default' }, help: { type: 'boolean', short: 'h' } } })`，抛出的错误原样输出到 stderr，返回 1。
- **默认输出路径**：输入文件同目录、同名，去掉 `.md` 或 `.markdown` 扩展名，换成 `.pdf` 或 `.html`。`-o` 的相对路径按 `process.cwd()` 解析。
- **preview**：写文件前先 `mkdir -p`。
- **调用 `renderDocument`**：`baseDir` 传 `path.dirname(path.resolve(input))`。build 和 preview 共用同一份 HTML。
- **成功信息**：`PDF written to <abs path>` / `HTML written to <abs path>`。
- **themes**：输出 `Available themes:`，然后每个主题一行 `  <id>  <description>` + （有作者时）`  — <author>`。`theme.json` 里的 `name` 和 id 不同时，在 id 后面用括号写出 name。
- **浏览器启动失败**：输出 `Could not launch Chromium: <cause message>. See the "Browser" section in README.md.`。
- **帮助文本**：包含 `resume-to-pdf build <input.md> [-o output.pdf] [--theme <name>]`、`resume-to-pdf preview <input.md> [-o output.html] [--theme <name>]`、`resume-to-pdf themes`。

- [ ] **Step 4: 写 `bin/resume-to-pdf.js`**

第一行是 `#!/usr/bin/env node`，然后 `process.exitCode = await main(process.argv.slice(2));`。写完执行 `chmod +x bin/resume-to-pdf.js`。

- [ ] **Step 5: 运行全部测试，确认通过**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/cli.js bin/resume-to-pdf.js test/cli.test.js
git commit -m "feat: add build, preview and themes commands"
```

---

### Task 7: default 主题与示例简历

**Files:**
- Create: `themes/default/theme.css`、`themes/default/theme.json`、`examples/resume.md`、`examples/resume.en.md`
- Modify: `test/cli.test.js`（加一条测试）

**Interfaces:**
- Consumes: Task 6 的 CLI、§5.5 的 class 约定

- [ ] **Step 1: 写失败测试（加到 `test/cli.test.js`）**

```js
test('built-in themes include default', async () => {
  const o = io(); assert.equal(await main(['themes'], { stdout: o }), 0);
  assert.match(o.text, /^\s*default\s+Clean single-column/m);
});
```

Run: `node --test test/cli.test.js`
Expected: FAIL

- [ ] **Step 2: 写 `themes/default/theme.json`**

```json
{ "name": "default", "description": "Clean single-column layout with a muted navy accent, built for quick scanning.", "author": "jianjustin" }
```

- [ ] **Step 3: 写 `themes/default/theme.css`**

以试做的 `theme-c.css` 为起点整理：合并重复规则，删掉 A/B 候选和拼接留下的注释。数值严格按 spec §5.7：

- `@page { size: A4; margin: 18mm 16mm; }`，打印时 `.resume { padding: 0 3mm; }`；
- 唯一的点缀色是 `#1f3a5a`，只用在 `.name`、`h2`、`.entry > h3::before` 三处；
- `.entry > h3::before` 是 2pt 宽的细条，`left: -7pt`；
- 分页规则照 §5.7 写。

只用 §5.5 里的 class，不加其他颜色或装饰。另外两点要保留：
- 正文里的 `h1`（没有 front matter 时作者自己写的姓名）用和 `.name` 一样的样式；
- 保留 `@media screen` 下“浅灰背景上的白色 A4 纸面”预览样式。

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 写两份示例**

- `examples/resume.md`：照抄试做的 `example.md`（“苏晚”）。
- `examples/resume.en.md`：同一个人物的英文版（Su Wan, Data Analyst, Hangzhou），章节对应个人简介、工作经历、项目经历、专业技能、教育经历、其他。至少保留：两段带副标题的经历（日期写法分别用 `2022.03 – Present` 和 `2019/07 - 2022/02`）、一个带 `####` 小节的经历、一个带日期和一个不带日期的项目、加粗的成果数字、写成 `### Yunxi University | B.S. in Statistics (2015.09—2019.06)` 的教育条目，以及一节普通列表（Other）。

- [ ] **Step 6: 生成并逐页查看**

```bash
npm run build -- examples/resume.md
npm run build -- examples/resume.en.md
pdfinfo examples/resume.pdf | grep Pages
P=$(mktemp -d) && pdftoppm -png -r 100 examples/resume.pdf "$P/zh" && pdftoppm -png -r 100 examples/resume.en.pdf "$P/en" && ls "$P"
pdftotext examples/resume.pdf - | grep -c -E '苏晚|青禾生鲜'
```

Expected：
- 中文版 2 页，观感和试做的 `example.pdf` 一致；
- 每个 `###` 左侧都有深蓝细条；
- 没有标题孤立在页尾，没有方块字，内容没有超出右边距；
- 英文版同样正常；
- `grep -c` 的结果 ≥ 2。

- [ ] **Step 7: 分两次提交**

```bash
git add themes/default test/cli.test.js
git commit -m "feat: add default theme"
git add examples/resume.md examples/resume.en.md
git commit -m "docs: add example resumes"
```

---

### Task 8: 中英文 README

**Files:**
- Create: `README.md`、`README.zh-CN.md`

- [ ] **Step 1: 写 `README.md`（英文）**

- 第一行：`English | [简体中文](README.zh-CN.md)`。
- 章节依次为：
  - Introduction
  - Requirements：Node.js ≥ 22.12
  - Installation：`npm install`
  - Browser：
    - puppeteer 会自动下载 Chrome；
    - 网络受限时的镜像环境变量，用 Task 1 Step 4 确认过的确切变量名；
    - 想用本机 Chrome 时，设置 `PUPPETEER_SKIP_DOWNLOAD=true` 和 `PUPPETEER_EXECUTABLE_PATH`；
    - Linux 上要装 `fonts-noto-cjk`；在容器里以 root 运行时 Chrome 可能需要额外配置。
  - Usage：三个子命令及其参数，加上对应的 npm scripts 写法 `npm run build -- examples/resume.md`。
  - Resume format：
    - front matter 字段表，照抄 spec §5.3，并说明不认识的键会被忽略；
    - 条目标题规则和四个示例；
    - 用 `**bold**` 标出重点。
  - Themes：列表，目前只有 `default`，附一句描述。
  - Creating a theme：
    - 目录结构、`theme.json` 字段、可选的 `template.html`；
    - 占位符表：`{{styles}}`、`{{header}}`、`{{content}}` 原样插入，`{{lang}}`、`{{title}}` 和 front matter 字段会被转义；
    - §5.5 的 HTML 结构和 class 约定；
    - 主题可以自带字体，用 `@font-face` 相对路径引用；
    - 调样式的做法：`preview` 生成 HTML，改完 CSS 刷新浏览器。
  - License：MIT。

- [ ] **Step 2: 写 `README.zh-CN.md`**

内容与英文版一一对应，第一行为 `[English](README.md) | 简体中文`。

- [ ] **Step 3: 核对命令**

把两份 README 里出现的每条命令都实际执行一遍，包括 `npm run themes`、`npm run preview -- examples/resume.md` 和 `npx resume-to-pdf themes`。
Expected：全部成功，输出与文档描述一致。不一致时以实际行为为准修改文档。

- [ ] **Step 4: 提交**

```bash
git add README.md README.zh-CN.md
git commit -m "docs: add English and Chinese README"
```

---

### Task 9: 干净环境验收

- [ ] **Step 1: 在空目录重新 clone 并构建**

```bash
D=$(mktemp -d) && git clone "$PWD" "$D/rtp" && cd "$D/rtp" && npm install && npm run build -- examples/resume.md && npm run themes && npm test
```

Expected：`examples/resume.pdf` 生成成功，`themes` 列出 `default`，测试全部通过。

- [ ] **Step 2: 检查提交历史**

```bash
git log --format='%an <%ae>' | sort -u
git log --format='%B' | grep -i -E 'co-authored|generated with|claude|anthropic' || echo CLEAN
git config --global --get user.name
```

Expected：
- 第一条命令只输出一行 `jianjustin <janine.jian.chen@gmail.com>`；
- 第二条输出 `CLEAN`；
- 第三条输出 `chenjianrui`。

- [ ] **Step 3: 向作者报告**

告诉作者示例 PDF 的绝对路径：`/Users/chenjianrui/workspaces/resume_to_pdf/examples/resume.pdf` 和 `examples/resume.en.pdf`。没有需要修复的问题，就不产生新的提交。
