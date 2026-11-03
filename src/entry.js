const D = String.raw`\d{4}(?:\s*[./\-年]\s*\d{1,2}\s*月?)?`;
const END = `(?:${D}|至今|今|现在|present|now|current)`;
const SEP = '(?:—|–|-|~|～|〜|至|to)';
const RANGE = `${D}(?:\\s*${SEP}\\s*${END})?`;
const parenthesizedHeading = new RegExp(`^(.*?)\\s*[（(]\\s*(${RANGE})\\s*[)）]\\s*$`, 'i');
const pipeHeading = new RegExp(`^(.*?)\\s*[|｜]\\s*(${RANGE})\\s*$`, 'i');
const dateRange = new RegExp(`^(${D})(?:\\s*${SEP}\\s*(${END}))?$`, 'i');

function normalizeDate(text) {
  const match = /^(\d{4})(?:\s*[./\-年]\s*(\d{1,2})\s*月?)?$/.exec(text.trim());
  if (match) return match[1] + (match[2] ? `.${match[2].padStart(2, '0')}` : '');
  return /^(present|now|current)$/i.test(text.trim()) ? 'Present' : '至今';
}

export function parseEntryHeading(text) {
  const match = parenthesizedHeading.exec(text) ?? pipeHeading.exec(text);
  if (!match) return null;

  const [title, ...parts] = match[1].split(/\s*[|｜]\s*/).map(part => part.trim());
  if (!title) return null;

  const [, start, end] = dateRange.exec(match[2]);
  const date = normalizeDate(start) + (end ? ` – ${normalizeDate(end)}` : '');
  return { title, subtitle: parts.join(' · '), date };
}
