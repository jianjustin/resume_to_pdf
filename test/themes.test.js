import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES_DIR, listThemes, loadTheme } from '../src/themes.js';

const FIX = fileURLToPath(new URL('./fixtures/themes/', import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtp-test-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('lists only directories with theme.css, with metadata defaults', () => {
  const themes = listThemes(FIX);
  assert.deepEqual(themes.map((t) => t.id), ['basic', 'custom']);
  assert.deepEqual([themes[0].name, themes[0].description, themes[0].author], ['basic', 'Basic fixture', 'test']);
  assert.equal(themes[0].templatePath, null);
  assert.deepEqual([themes[1].name, themes[1].description, themes[1].author], ['custom', '', '']);
  assert.ok(themes[1].templatePath.endsWith(path.join('custom', 'template.html')));
  assert.equal(themes[0].dir, path.join(FIX, 'basic'));
  assert.equal(themes[0].cssPath, path.join(FIX, 'basic', 'theme.css'));
});

test('listThemes and loadTheme normalize metadata fields to strings after defaults', () => {
  const dir = fs.mkdtempSync(path.join(tmp, 'metadata-'));
  const fixtures = [
    ['mixed', { name: 17, description: [], author: false }, ['17', '', 'false']],
    ['objects', { name: {}, description: { text: 'description' }, author: { name: 'author' } },
      ['[object Object]', '[object Object]', '[object Object]']],
    ['nullish', { name: null, description: null }, ['nullish', '', '']],
  ];
  for (const [id, metadata] of fixtures) {
    fs.mkdirSync(path.join(dir, id));
    fs.writeFileSync(path.join(dir, id, 'theme.css'), 'body{}');
    fs.writeFileSync(path.join(dir, id, 'theme.json'), JSON.stringify(metadata));
  }
  const themes = listThemes(dir);
  for (const [id, , expected] of fixtures) {
    for (const theme of [themes.find((candidate) => candidate.id === id), loadTheme(id, dir)]) {
      assert.deepEqual([theme.name, theme.description, theme.author], expected);
      assert.ok([theme.name, theme.description, theme.author].every((value) => typeof value === 'string'));
    }
  }
});

test('THEMES_DIR is the absolute package themes directory', () => {
  assert.equal(THEMES_DIR, fileURLToPath(new URL('../themes/', import.meta.url)));
  assert.ok(path.isAbsolute(THEMES_DIR));
});

test('unknown or path-like theme names are rejected', () => {
  for (const name of ['nope', '../basic']) {
    assert.throws(() => loadTheme(name, FIX), (e) => e.code === 'THEME_NOT_FOUND'
      && e.message === `Theme "${name}" not found. Available themes: basic, custom`);
  }
});

test('invalid theme.json reports the theme dir', () => {
  fs.mkdirSync(path.join(tmp, 'bad'));
  fs.writeFileSync(path.join(tmp, 'bad', 'theme.css'), '');
  fs.writeFileSync(path.join(tmp, 'bad', 'theme.json'), '{');
  assert.throws(() => listThemes(tmp), /Invalid theme\.json in .*bad: .+/);
});

test('listThemes sorts ids independently of metadata names', () => {
  const dir = fs.mkdtempSync(path.join(tmp, 'sorted-'));
  for (const [id, name] of [['z', 'First'], ['a', 'Last']]) {
    fs.mkdirSync(path.join(dir, id));
    fs.writeFileSync(path.join(dir, id, 'theme.css'), '');
    fs.writeFileSync(path.join(dir, id, 'theme.json'), JSON.stringify({ name }));
  }
  fs.writeFileSync(path.join(dir, 'stray.css'), '');
  assert.deepEqual(listThemes(dir).map((theme) => theme.id), ['a', 'z']);
  assert.equal(loadTheme('z', dir).name, 'First');
});
