import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontMatter } from '../src/frontmatter.js';

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
