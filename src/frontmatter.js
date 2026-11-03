import { load } from 'js-yaml';

export function parseFrontMatter(source) {
  const match = /^﻿?---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/.exec(source);
  if (!match) return { meta: {}, body: source };

  let parsed;
  try {
    parsed = load(match[1] ?? '');
  } catch (error) {
    throw new Error('Invalid front matter: ' + error.reason);
  }

  const meta = parsed !== null && typeof parsed === 'object'
    && Object.getPrototypeOf(parsed) === Object.prototype ? parsed : {};
  return { meta, body: source.slice(match[0].length) };
}
