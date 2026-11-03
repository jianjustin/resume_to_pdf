import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarkdown, renderBody } from '../src/markdown.js';

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
for (const [heading, title, subtitle] of [
  ['[Research | Labs](https://example.com) | Engineer (2021 - 2022)', '<a href="https://example.com">Research | Labs</a>', 'Engineer'],
  [String.raw`Research \| Labs (2021 - 2022)`, 'Research | Labs', ''],
  ['`Research | Labs` | Engineer (2021 - 2022)', '<code>Research | Labs</code>', 'Engineer'],
  ['[Research｜Labs](https://example.com/a|b)｜Engineer｜Lead (2021 - 2022)', '<a href="https://example.com/a%7Cb">Research｜Labs</a>', 'Engineer · Lead'],
  ['Acme | [Engineer | Lead](https://example.com/a_(b|c)) (2021 - 2022)', 'Acme', '<a href="https://example.com/a_(b%7Cc)">Engineer | Lead</a>'],
  ['``Research `|` Labs`` ｜ Engineer | 2021 - 2022', '<code>Research `|` Labs</code>', 'Engineer'],
]) {
  test(`entry inline Markdown survives splitting: ${heading}`, () => {
    const html = renderBody(`### ${heading}`);
    assert.ok(html.includes(`<span class="entry-title">${title}</span>`), html);
    if (subtitle) assert.ok(html.includes(`<span class="entry-sub">${subtitle}</span>`), html);
    else assert.ok(!html.includes('entry-sub'), html);
    assert.ok(html.includes('<span class="entry-date">2021 – 2022</span>'), html);
  });
}

test('ambiguous unbalanced entry headings keep ordinary Markdown rendering', () => {
  for (const heading of ['[Research | Labs (2021 - 2022)', '`Research | Labs (2021 - 2022)',
    '[Research](https://example.com/a|b (2021 - 2022)', String.raw`Research \| 2021 - 2022`]) {
    const html = renderBody(`### ${heading}`);
    assert.ok(!html.includes('entry-head'), html);
    assert.ok(html.includes('<h3>'), html);
  }
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

test('createMarkdown configures independent markdown-it instances', () => {
  const md = createMarkdown();
  assert.notEqual(md, createMarkdown());
  assert.equal(md.options.html, true);
  assert.equal(md.options.linkify, true);
  assert.equal(md.options.typographer, false);
  assert.equal(flat(md.render('<b>raw</b>\n\nhttps://example.test "quoted" ...')),
    '<p><b>raw</b></p><p><a href="https://example.test">https://example.test</a> &quot;quoted&quot; ...</p>');
  assert.equal(md.render('## Section\n\n### Entry'), renderBody('## Section\n\n### Entry'));
});
test('entry subtitles render inline markdown and text remains escaped', () => {
  assert.ok(renderBody('### A & B | **Engineer** & `lead` (2021 - 2022)').includes(
    '<span class="entry-title">A &amp; B</span><span class="entry-sub"><strong>Engineer</strong> &amp; <code>lead</code></span>'));
});
test('h3 before the first top-level h2 is unwrapped but still transformed', () => {
  assert.equal(flat(renderBody('### Intro（2020）\n\ntext\n\n## Section\n\n### Entry')),
    '<h3 class="entry-head"><span class="entry-main"><span class="entry-title">Intro</span></span>' +
    '<span class="entry-date">2020</span></h3><p>text</p>' +
    '<section class="section"><h2>Section</h2><article class="entry"><h3>Entry</h3></article></section>');
});
test('top-level h1 closes the article and section until another h2 opens a section', () => {
  assert.equal(flat(renderBody('## First\n\n### Entry\n\ntext\n\n# Reset\n\n### Outside\n\n## Second\n\n### Next')),
    '<section class="section"><h2>First</h2><article class="entry"><h3>Entry</h3><p>text</p></article></section>' +
    '<h1>Reset</h1><h3>Outside</h3><section class="section"><h2>Second</h2>' +
    '<article class="entry"><h3>Next</h3></article></section>');
});
test('top-level h1 closes a section even when no article is open', () => {
  assert.equal(flat(renderBody('## Section\n\ntext\n\n# Outside\n\nafter')),
    '<section class="section"><h2>Section</h2><p>text</p></section><h1>Outside</h1><p>after</p>');
});
test('nested h1, h2 and h3 do not open or close wrappers', () => {
  assert.equal(flat(renderBody('## Section\n\n### Entry\n\n> # Nested h1\n>\n> ## Nested h2\n>\n> ### Nested h3\n\nafter')),
    '<section class="section"><h2>Section</h2><article class="entry"><h3>Entry</h3>' +
    '<blockquote><h1>Nested h1</h1><h2>Nested h2</h2><h3>Nested h3</h3></blockquote>' +
    '<p>after</p></article></section>');
});
test('nested h2 does not enable wrappers and nested entry headings still transform', () => {
  assert.equal(flat(renderBody('> ## Nested\n>\n> ### Quote（2020）\n>\n> #### Detail（2021）\n\n### Outside')),
    '<blockquote><h2>Nested</h2><h3 class="entry-head"><span class="entry-main"><span class="entry-title">Quote</span></span>' +
    '<span class="entry-date">2020</span></h3><h4 class="entry-head"><span class="entry-main"><span class="entry-title">Detail</span></span>' +
    '<span class="entry-date">2021</span></h4></blockquote><h3>Outside</h3>');
});
test('headings inside lists do not control wrappers', () => {
  assert.equal(flat(renderBody('## Section\n\n### Entry\n\n- # Nested h1\n\n- ## Nested h2\n\n- ### Nested h3\n\nafter')),
    '<section class="section"><h2>Section</h2><article class="entry"><h3>Entry</h3>' +
    '<ul><li><h1>Nested h1</h1></li><li><h2>Nested h2</h2></li><li><h3>Nested h3</h3></li></ul>' +
    '<p>after</p></article></section>');
});
test('h4 stays inside the current article without opening another wrapper', () => {
  assert.equal(flat(renderBody('## Section\n\n### Entry\n\n#### Detail\n\ntext')),
    '<section class="section"><h2>Section</h2><article class="entry"><h3>Entry</h3><h4>Detail</h4><p>text</p></article></section>');
});
test('renderBody does not retain wrapper state between calls', () => {
  renderBody('## Section\n\n### Entry');
  assert.equal(flat(renderBody('### Outside')), '<h3>Outside</h3>');
  assert.equal(renderBody(''), '');
});
