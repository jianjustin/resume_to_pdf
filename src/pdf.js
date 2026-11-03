import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';

export async function htmlToPdf(html, outputPath, { launchOptions } = {}) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'resume-to-pdf-'));
  let browser;
  try {
    const file = path.join(tempDir, 'index.html');
    await fs.writeFile(file, html);
    try {
      browser = await puppeteer.launch({ headless: true, ...launchOptions });
    } catch (cause) {
      const error = new Error('Failed to launch browser', { cause });
      error.code = 'BROWSER_LAUNCH_FAILED';
      throw error;
    }
    const page = await browser.newPage();
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await page.pdf({ path: outputPath, format: 'A4', preferCSSPageSize: true, printBackground: true });
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}
