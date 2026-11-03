import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseFrontMatter } from './frontmatter.js';
import { renderBody } from './markdown.js';

const HEADER_FIELDS = ['name', 'role', 'location', 'phone', 'email', 'website', 'github'];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function fieldText(value) {
  return value == null ? '' : String(value);
}

export function buildHeader(meta) {
  const name = fieldText(meta.name);
  const role = fieldText(meta.role);
  const contacts = [];
  const link = (href, label) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;

  for (const field of HEADER_FIELDS.slice(2)) {
    const value = fieldText(meta[field]);
    if (!value) continue;
    let contact;
    if (field === 'location') {
      contact = escapeHtml(value);
    } else if (field === 'phone') {
      contact = link(`tel:${value.replace(/[^\d+]/g, '')}`, value);
    } else if (field === 'email') {
      contact = link(`mailto:${value}`, value);
    } else {
      const href = field === 'github' && !/^https?:\/\//.test(value) ? `https://${value}` : value;
      contact = link(href, value.replace(/^https?:\/\//, '').replace(/\/$/, ''));
    }
    contacts.push(`<li>${contact}</li>`);
  }

  if (!name && !role && !contacts.length) return '';
  return '<header class="resume-header">'
    + (name ? `<h1 class="name">${escapeHtml(name)}</h1>` : '')
    + (role ? `<p class="role">${escapeHtml(role)}</p>` : '')
    + (contacts.length ? `<ul class="contact">${contacts.join('')}</ul>` : '')
    + '</header>';
}

export function detectLang(meta, body) {
  if (meta.lang) return String(meta.lang);
  const displayedText = [body, ...HEADER_FIELDS.map((field) => fieldText(meta[field]))].join('\n');
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(displayedText) ? 'zh-CN' : 'en';
}

export function fillTemplate(template, reserved, fields) {
  return template.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_match, key) => {
    if (Object.hasOwn(reserved, key)) return reserved[key];
    if (Object.hasOwn(fields, key) && ['string', 'number', 'boolean'].includes(typeof fields[key])) {
      return escapeHtml(fields[key]);
    }
    return '';
  });
}

export function renderDocument(source, { theme, baseDir }) {
  const { meta, body } = parseFrontMatter(source);
  const template = fs.readFileSync(theme.templatePath ?? new URL('./template.html', import.meta.url), 'utf8');
  const baseHref = pathToFileURL(baseDir).href.replace(/\/?$/, '/');
  return fillTemplate(template, {
    styles: `<base href="${escapeHtml(baseHref)}"><link rel="stylesheet" href="${escapeHtml(pathToFileURL(theme.cssPath).href)}">`,
    header: buildHeader(meta),
    content: renderBody(body),
    lang: escapeHtml(detectLang(meta, body)),
    title: escapeHtml(fieldText(meta.name) || 'Resume'),
  }, meta);
}
