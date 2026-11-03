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

// Locate only structural delimiters; keep inline Markdown slices byte-for-byte.
// Unbalanced constructs are left to the ordinary Markdown heading renderer.
function headingDelimiters(text) {
  const delimiters = new Set();
  let brackets = 0;
  let destination = 0;
  let quotedDestination = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '\\') {
      i++;
      continue;
    }
    if (destination) {
      if (quotedDestination) {
        if (char === quotedDestination) quotedDestination = '';
      } else if (char === '<') quotedDestination = '>';
      else if ((char === '"' || char === "'") && /\s/.test(text[i - 1])) quotedDestination = char;
      else if (char === '(') destination++;
      else if (char === ')') destination--;
      continue;
    }
    if (char === '`') {
      const opening = /^`+/.exec(text.slice(i))[0];
      const runs = /`+/g;
      runs.lastIndex = i + opening.length;
      let closing = runs.exec(text);
      while (closing && closing[0].length !== opening.length) closing = runs.exec(text);
      if (!closing) return null;
      i = closing.index + opening.length - 1;
      continue;
    }
    if (char === '[') brackets++;
    else if (char === ']') {
      if (!brackets) return null;
      brackets--;
      if (!brackets && text[i + 1] === '(') {
        destination = 1;
        i++;
      }
    } else if (!brackets && /[|｜(（]/.test(char)) delimiters.add(i);
  }
  return brackets || destination ? null : delimiters;
}

export function parseEntryHeading(text) {
  const parenthesized = parenthesizedHeading.exec(text);
  const match = parenthesized ?? pipeHeading.exec(text);
  if (!match) return null;

  const delimiters = headingDelimiters(text);
  const dateDelimiter = match[1].length + text.slice(match[1].length).search(parenthesized ? /[（(]/ : /[|｜]/);
  if (!delimiters?.has(dateDelimiter)) return null;
  const parts = [];
  let partStart = 0;
  for (const index of delimiters) {
    if (index >= match[1].length) break;
    if (text[index] !== '|' && text[index] !== '｜') continue;
    parts.push(text.slice(partStart, index).trim());
    partStart = index + 1;
  }
  parts.push(match[1].slice(partStart).trim());
  const title = parts.shift();
  if (!title) return null;

  const [, start, end] = dateRange.exec(match[2]);
  const date = normalizeDate(start) + (end ? ` – ${normalizeDate(end)}` : '');
  return { title, subtitle: parts.join(' · '), date };
}
