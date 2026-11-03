import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { htmlToPdf } from '../src/pdf.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtp-test-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function trackResources(t) {
  const resources = {};
  const mkdtemp = fsp.mkdtemp;
  t.mock.method(fsp, 'mkdtemp', async (...args) => {
    resources.tempDir = await mkdtemp(...args);
    return resources.tempDir;
  });
  const launch = puppeteer.launch.bind(puppeteer);
  t.mock.method(puppeteer, 'launch', async (options) => {
    try {
      resources.browser = await launch(options);
      return resources.browser;
    } catch (error) {
      resources.launchError = error;
      throw error;
    }
  });
  return resources;
}

function assertCleaned(resources) {
  assert.ok(resources.tempDir);
  assert.equal(fs.existsSync(resources.tempDir), false);
  if (resources.browser) assert.equal(resources.browser.connected, false);
}

test('writes a pdf into missing dirs, including spaces and CJK', { timeout: 60000 }, async (t) => {
  const resources = trackResources(t);
  const out = path.join(tmp, '我的 简历', 'a', 'r.pdf');
  assert.equal(await htmlToPdf('<!doctype html><html lang="zh-CN"><body><p>你好 PDF</p></body></html>', out), undefined);
  assert.equal(fs.readFileSync(out).subarray(0, 5).toString(), '%PDF-');
  assertCleaned(resources);
});

for (const [name, css, width, height] of [
  ['A4 fallback without @page CSS', 'body {}', 210 / 25.4 * 72, 297 / 25.4 * 72],
  ['explicit CSS page size overrides A4 fallback', '@page { size: 100mm 150mm; }', 100 / 25.4 * 72, 150 / 25.4 * 72],
]) {
  test(`real PDF geometry: ${name}`, { timeout: 60000 }, async () => {
    const out = path.join(tmp, `${width}.pdf`);
    await htmlToPdf(`<!doctype html><style>${css}</style><p>Page geometry</p>`, out);
    // Chromium writes page geometry as uncompressed MediaBox arrays in PDF points.
    const boxes = [...fs.readFileSync(out, 'latin1').matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)];
    assert.ok(boxes.length > 0, 'generated PDF must expose page geometry');
    for (const [, actualWidth, actualHeight] of boxes) {
      assert.ok(Math.abs(Number(actualWidth) - width) < 1, `width: ${actualWidth}, expected ${width}`);
      assert.ok(Math.abs(Number(actualHeight) - height) < 1, `height: ${actualHeight}, expected ${height}`);
    }
  });
}

test('launch failure is reported with a code', { timeout: 60000 }, async (t) => {
  const resources = trackResources(t);
  await assert.rejects(htmlToPdf('<p>x</p>', path.join(tmp, 'x.pdf'), { launchOptions: { executablePath: '/nonexistent/chrome' } }),
    (e) => {
      assert.equal(e.code, 'BROWSER_LAUNCH_FAILED');
      assert.ok(e.cause instanceof Error);
      assert.equal(e.cause, resources.launchError);
      assert.match(e.cause.message, /\/nonexistent\/chrome/);
      return true;
    });
  assertCleaned(resources);
});

test('cleans up browser and temporary files when output creation fails', { timeout: 60000 }, async (t) => {
  const resources = trackResources(t);
  const blocked = path.join(tmp, 'not-a-directory');
  fs.writeFileSync(blocked, 'blocked');
  await assert.rejects(htmlToPdf('<p>x</p>', path.join(blocked, 'r.pdf')), (e) => {
    assert.ok(['EEXIST', 'ENOTDIR'].includes(e.code));
    return true;
  });
  assertCleaned(resources);
});

test('removes temporary files even when browser close fails', { timeout: 60000 }, async (t) => {
  const resources = trackResources(t);
  const launch = puppeteer.launch.bind(puppeteer);
  const closeError = new Error('Browser close failed');
  t.mock.method(puppeteer, 'launch', async (options) => {
    const browser = await launch(options);
    const close = browser.close.bind(browser);
    t.mock.method(browser, 'close', async () => {
      await close();
      throw closeError;
    });
    return browser;
  });
  const out = path.join(tmp, 'close-failure.pdf');
  await assert.rejects(htmlToPdf('<p>x</p>', out), (e) => e === closeError);
  assert.equal(fs.readFileSync(out).subarray(0, 5).toString(), '%PDF-');
  assertCleaned(resources);
});
