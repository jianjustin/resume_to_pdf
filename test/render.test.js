import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadTheme } from '../src/themes.js';
import { buildHeader, detectLang, fillTemplate, renderDocument } from '../src/render.js';

const FIX = fileURLToPath(new URL('./fixtures/themes/', import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtp-test-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

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

test('header escapes link attributes and strips only phone punctuation', () => {
  assert.equal(buildHeader({ role: 'R&D', phone: '+1 (234)-567', website: 'http://example.com/?a="x"&b=2/', github: 'http://github.com/a/' }),
    '<header class="resume-header"><p class="role">R&amp;D</p><ul class="contact">' +
    '<li><a href="tel:+1234567">+1 (234)-567</a></li>' +
    '<li><a href="http://example.com/?a=&quot;x&quot;&amp;b=2/">example.com/?a=&quot;x&quot;&amp;b=2</a></li>' +
    '<li><a href="http://github.com/a/">github.com/a</a></li></ul></header>');
});

test('fillTemplate: reserved raw html wins, fields are escaped, others empty', () => {
  assert.equal(fillTemplate('<p>{{name}}</p>{{content}}{{ missing }}{{tags}}{{content2}}', { content: '<b>x</b>' },
    { name: 'A&B', tags: ['a'], content: 'ignored' }), '<p>A&amp;B</p><b>x</b>');
});

test('fillTemplate only reads own properties and supports scalar fields', () => {
  const reserved = Object.assign(Object.create({ inherited: '<b>hidden</b>' }), { raw: '<i>raw</i>' });
  const fields = Object.assign(Object.create({ inheritedField: 'hidden' }), {
    'some-key': '"<&', zero: 0, bool: false, nil: null, date: new Date(), obj: {},
  });
  assert.equal(fillTemplate('{{toString}}{{constructor}}{{__proto__}}{{inherited}}{{inheritedField}}' +
    '{{ raw }}|{{some-key}}|{{zero}}|{{bool}}|{{nil}}{{date}}{{obj}}', reserved, fields),
  '<i>raw</i>|&quot;&lt;&amp;|0|false|');
});

test('detectLang', () => {
  assert.equal(detectLang({ lang: 'ja' }, ''), 'ja');
  assert.equal(detectLang({}, '## 工作经历'), 'zh-CN');
  assert.equal(detectLang({}, '## Experience'), 'en');
  assert.equal(detectLang({ name: '苏晚' }, 'Experience'), 'zh-CN');
});

test('detectLang checks all displayed header fields, ignores unknown metadata, and honors explicit lang', () => {
  for (const field of ['name', 'role', 'location', 'phone', 'email', 'website', 'github']) {
    assert.equal(detectLang({ [field]: '中文' }, 'Experience'), 'zh-CN');
  }
  assert.equal(detectLang({ lang: 'en', name: '苏晚' }, '中文'), 'en');
  assert.equal(detectLang({ title: '笔记', tags: ['中文'], unknown: '中文' }, 'Experience'), 'en');
  assert.equal(detectLang({}, '日本語 한글'), 'zh-CN');
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

test('renderDocument escapes reserved text and ignores metadata overrides of reserved HTML', () => {
  const source = '---\nname: R&D <Lab>\nlang: \'en"<\'\ntitle: ignored\nstyles: bad-styles\nheader: bad-header\ncontent: bad-content\n---\nBody';
  const html = renderDocument(source, { theme: loadTheme('basic', FIX), baseDir: tmp });
  assert.ok(html.includes('<title>R&amp;D &lt;Lab&gt;</title>'));
  assert.ok(html.includes('<html lang="en&quot;&lt;">'));
  assert.ok(html.includes('<p>Body</p>'));
  assert.ok(!html.includes('bad-'));
  assert.ok(renderDocument('---\ntitle: 笔记\n---\nBody', {
    theme: loadTheme('basic', FIX), baseDir: tmp,
  }).includes('<title>Resume</title>'));
});

test('renderDocument encodes file URLs and keeps one trailing directory separator', () => {
  const baseDir = path.join(tmp, '我的 简历#?') + path.sep;
  const dir = path.join(tmp, 'theme #?');
  fs.mkdirSync(dir);
  const cssPath = path.join(dir, 'theme.css');
  fs.writeFileSync(cssPath, 'body{}');
  const theme = { ...loadTheme('basic', FIX), cssPath };
  const html = renderDocument('text', { theme, baseDir });
  assert.ok(html.includes(`<base href="${pathToFileURL(baseDir).href}">`));
  assert.ok(html.includes(`<link rel="stylesheet" href="${pathToFileURL(cssPath).href}">`));
  assert.ok(html.includes('%23%3F/'));
});
