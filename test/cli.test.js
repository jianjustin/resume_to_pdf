import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import { main } from '../src/cli.js';

const FIX = fileURLToPath(new URL('./fixtures/themes/', import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtp-cli-test-'));
const input = path.join(tmp, '我的 简历', 'resume.md');
fs.mkdirSync(path.dirname(input));
fs.writeFileSync(input, '---\nname: 苏晚\n---\n## 工作经历\n');
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function io() {
  return { text: '', write(value) { this.text += value; } };
}

test('help lists all commands without loading themes', async () => {
  for (const flag of ['--help', '-h']) {
    const o = io();
    assert.equal(await main([flag], { stdout: o, themesDir: '/nonexistent/themes' }), 0);
    for (const usage of [
      'resume-to-pdf build <input.md> [-o output.pdf] [--theme <name>]',
      'resume-to-pdf preview <input.md> [-o output.html] [--theme <name>]',
      'resume-to-pdf themes',
    ]) assert.ok(o.text.includes(usage));
  }
});

test('no command prints usage and fails', async () => {
  const e = io();
  assert.equal(await main([], { stderr: e }), 1);
  assert.ok(e.text.includes('resume-to-pdf build <input.md>'));
});

test('unknown command is diagnosed before loading themes', async () => {
  const e = io();
  assert.equal(await main(['make'], { stderr: e }), 1);
  assert.ok(e.text.includes('Unknown command: make'));
});

test('built-in themes include default', async () => {
  const o = io(); assert.equal(await main(['themes'], { stdout: o }), 0);
  assert.match(o.text, /^\s*default\s+Single-column layout with tabbed section cards/m);
});

test('themes lists fixture themes and authors', async () => {
  const o = io();
  assert.equal(await main(['themes'], { stdout: o, themesDir: FIX }), 0);
  assert.equal(o.text, 'Available themes:\n  basic  Basic fixture  — test\n  custom  \n');
});

test('themes shows a distinct display name in parentheses', async () => {
  const themesDir = path.join(tmp, 'named-themes');
  fs.mkdirSync(path.join(themesDir, 'named'), { recursive: true });
  fs.writeFileSync(path.join(themesDir, 'named', 'theme.css'), '');
  fs.writeFileSync(path.join(themesDir, 'named', 'theme.json'), JSON.stringify({ name: 'Display name', description: 'Named fixture' }));
  const o = io();
  assert.equal(await main(['themes'], { stdout: o, themesDir }), 0);
  assert.equal(o.text, 'Available themes:\n  named (Display name)  Named fixture\n');
});

test('missing input argument is diagnosed without a default theme', async () => {
  for (const command of ['build', 'preview']) {
    const e = io();
    assert.equal(await main([command], { stderr: e }), 1);
    assert.ok(e.text.includes('Missing input file'));
  }
});

test('input not found is diagnosed without a default theme', async () => {
  for (const command of ['build', 'preview']) {
    const e = io();
    assert.equal(await main([command, 'missing.md'], { stderr: e }), 1);
    assert.ok(e.text.includes('Input file not found: missing.md'));
  }
});

test('unknown option preserves the parseArgs diagnostic', async () => {
  const argv = ['build', input, '--colour'];
  let diagnostic;
  assert.throws(() => parseArgs({ args: argv, allowPositionals: true }), (error) => {
    diagnostic = error.message;
    return true;
  });
  const e = io();
  assert.equal(await main(argv, { stderr: e }), 1);
  assert.equal(e.text, `${diagnostic}\n`);
  assert.match(e.text, /--colour/);
});

test('option requiring a value fails before loading themes', async () => {
  const e = io();
  assert.equal(await main(['build', input, '-o'], { stderr: e }), 1);
  assert.match(e.text, /Option '-o, --output <value>' argument missing/);
});

test('extra positional arguments are rejected before loading themes', async () => {
  for (const argv of [['build', input, 'extra.md'], ['preview', input, 'extra.md'], ['themes', 'extra.md']]) {
    const e = io();
    assert.equal(await main(argv, { stderr: e }), 1);
    assert.ok(e.text.includes('extra.md'));
  }
});

test('unknown theme lists available ones', async () => {
  const e = io();
  assert.equal(await main(['build', input, '--theme', 'nope'], { stderr: e, themesDir: FIX }), 1);
  assert.ok(e.text.includes('Theme "nope" not found. Available themes: basic, custom'));
});

test('preview writes html next to the input by default with its base directory', async () => {
  const o = io();
  const out = input.replace(/\.md$/, '.html');
  assert.equal(await main(['preview', input, '--theme', 'basic'], { stdout: o, themesDir: FIX }), 0);
  const html = fs.readFileSync(out, 'utf8');
  assert.ok(html.includes('class="resume"'));
  assert.ok(html.includes(`<base href="${pathToFileURL(path.dirname(input)).href}/">`));
  assert.equal(o.text, `HTML written to ${out}\n`);
});

test('preview -o creates missing directories', async () => {
  const out = path.join(tmp, 'out', 'nested', 'r.html');
  assert.equal(await main(['preview', input, '--theme', 'basic', '-o', out], { stdout: io(), themesDir: FIX }), 0);
  assert.ok(fs.existsSync(out));
});

test('relative input and --output resolve from the current working directory', async () => {
  const out = path.join(tmp, 'relative-output', 'r.html');
  const o = io();
  assert.equal(await main(['preview', path.relative(process.cwd(), input), '--theme', 'basic', '--output', path.relative(process.cwd(), out)],
    { stdout: o, themesDir: FIX }), 0);
  assert.ok(fs.existsSync(out));
  assert.equal(o.text, `HTML written to ${out}\n`);
  assert.ok(fs.readFileSync(out, 'utf8').includes(`<base href="${pathToFileURL(path.dirname(input)).href}/">`));
});

test('preview replaces the .markdown extension', async () => {
  const markdown = path.join(path.dirname(input), 'long.markdown');
  fs.copyFileSync(input, markdown);
  const o = io();
  assert.equal(await main(['preview', markdown, '--theme', 'basic'], { stdout: o, themesDir: FIX }), 0);
  const out = markdown.replace(/\.markdown$/, '.html');
  assert.ok(fs.existsSync(out));
  assert.equal(o.text, `HTML written to ${out}\n`);
});

for (const command of ['build', 'preview']) {
  for (const alias of ['identical', 'relative', 'symlink', 'hard-link', 'symlink-directory']) {
    test(`${command} rejects ${alias} source/output collisions without changing source bytes`, async (t) => {
      const dir = fs.mkdtempSync(path.join(tmp, 'collision-'));
      const source = path.join(dir, 'resume.md');
      const original = Buffer.from('---\nname: 苏晚\n---\n### Research \\| Labs (2021 - 2022)\n');
      fs.writeFileSync(source, original);
      let output = source;
      if (alias === 'relative') output = path.relative(process.cwd(), source);
      if (alias === 'symlink' || alias === 'hard-link') {
        output = path.join(dir, 'alias.md');
        if (alias === 'symlink') fs.symlinkSync(source, output);
        else fs.linkSync(source, output);
      }
      if (alias === 'symlink-directory') {
        fs.symlinkSync(dir, path.join(dir, 'alias-dir'));
        output = path.join(dir, 'alias-dir', 'resume.md');
      }
      let launched = false;
      t.mock.method(puppeteer, 'launch', async () => {
        launched = true;
        throw new Error('Collision must be rejected before browser launch');
      });
      const o = io();
      const e = io();
      const status = await main([command, source, '--theme', 'basic', '-o', output],
        { stdout: o, stderr: e, themesDir: FIX });
      assert.deepEqual(fs.readFileSync(source), original, 'source bytes must be preserved');
      assert.equal(status, 1);
      assert.match(e.text, /Output file must not refer to the input file/);
      assert.equal(o.text, '');
      assert.equal(launched, false);
    });
  }
  test(`${command} still replaces a distinct existing output artifact`, { timeout: 60000 }, async () => {
    const out = path.join(tmp, `replace-${command}.${command === 'build' ? 'pdf' : 'html'}`);
    fs.writeFileSync(out, 'old artifact');
    const original = fs.readFileSync(input);
    assert.equal(await main([command, input, '--theme', 'basic', '-o', out],
      { stdout: io(), themesDir: FIX }), 0);
    assert.deepEqual(fs.readFileSync(input), original);
    assert.ok(fs.readFileSync(out, 'utf8').startsWith(command === 'build' ? '%PDF-' : '<!doctype html>'));
  });
}

test('preview write failures return a diagnostic and no success output', async () => {
  const blocked = path.join(tmp, 'blocked');
  fs.writeFileSync(blocked, 'not a directory');
  const o = io();
  const e = io();
  assert.equal(await main(['preview', input, '--theme', 'basic', '-o', path.join(blocked, 'r.html')],
    { stdout: o, stderr: e, themesDir: FIX }), 1);
  assert.match(e.text, /EEXIST|ENOTDIR/);
  assert.equal(o.text, '');
});

test('build writes a real pdf', { timeout: 60000 }, async () => {
  const o = io();
  assert.equal(await main(['build', input, '--theme', 'basic'], { stdout: o, themesDir: FIX }), 0);
  const out = input.replace(/\.md$/, '.pdf');
  assert.equal(fs.readFileSync(out).subarray(0, 5).toString(), '%PDF-');
  assert.equal(o.text, `PDF written to ${out}\n`);
});

test('build replaces the .markdown extension', { timeout: 60000 }, async () => {
  const markdown = path.join(path.dirname(input), 'build.markdown');
  fs.copyFileSync(input, markdown);
  const o = io();
  assert.equal(await main(['build', markdown, '--theme', 'basic'], { stdout: o, themesDir: FIX }), 0);
  const out = markdown.replace(/\.markdown$/, '.pdf');
  assert.equal(fs.readFileSync(out).subarray(0, 5).toString(), '%PDF-');
  assert.equal(o.text, `PDF written to ${out}\n`);
});

test('browser launch failure includes its cause and README guidance', async (t) => {
  t.mock.method(puppeteer, 'launch', async () => { throw new Error('Chrome is unavailable'); });
  const e = io();
  const o = io();
  assert.equal(await main(['build', input, '--theme', 'basic'], { stdout: o, stderr: e, themesDir: FIX }), 1);
  assert.equal(e.text, 'Could not launch Chromium: Chrome is unavailable. See the "Browser" section in README.md.\n');
  assert.equal(o.text, '');
});

test('executable entry point prints help and returns failure codes', () => {
  const bin = fileURLToPath(new URL('../bin/resume-to-pdf.js', import.meta.url));
  assert.ok(fs.statSync(bin).mode & 0o111);
  assert.ok(fs.readFileSync(bin, 'utf8').startsWith('#!/usr/bin/env node\n'));
  const help = spawnSync(bin, ['--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.ok(help.stdout.includes('resume-to-pdf build <input.md>'));
  assert.equal(help.stderr, '');
  const missing = spawnSync(bin, ['build'], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.ok(missing.stderr.includes('Missing input file'));
  assert.equal(missing.stdout, '');
});
