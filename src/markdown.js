import MarkdownIt from 'markdown-it';
import cjkFriendly from 'markdown-it-cjk-friendly';
import { parseEntryHeading } from './entry.js';

function htmlToken(state, type, content) {
  const token = new state.Token(type, '', 0);
  token.content = content;
  token.block = type === 'html_block';
  return token;
}

export function createMarkdown() {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: false }).use(cjkFriendly);

  md.core.ruler.push('resume_entry_headings', (state) => {
    for (let i = 0; i < state.tokens.length; i++) {
      const heading = state.tokens[i];
      if (heading.type !== 'heading_open' || !['h3', 'h4'].includes(heading.tag)) continue;

      const inline = state.tokens[i + 1];
      const entry = parseEntryHeading(inline.content);
      if (!entry) continue;

      const children = [];
      const addHtml = (content) => children.push(htmlToken(state, 'html_inline', content));
      addHtml('<span class="entry-main"><span class="entry-title">');
      children.push(...md.parseInline(entry.title, state.env)[0].children);
      addHtml('</span>');
      if (entry.subtitle) {
        addHtml('<span class="entry-sub">');
        children.push(...md.parseInline(entry.subtitle, state.env)[0].children);
        addHtml('</span>');
      }
      addHtml(`</span><span class="entry-date">${md.utils.escapeHtml(entry.date)}</span>`);
      inline.children = children;
      heading.attrJoin('class', 'entry-head');
    }
  });

  md.core.ruler.push('resume_wrappers', (state) => {
    const tokens = [];
    let sectionOpen = false;
    let bodyPending = false;
    let entryOpen = false;
    const addHtml = (content) => tokens.push(htmlToken(state, 'html_block', `${content}\n`));
    const closeEntry = () => {
      if (entryOpen) addHtml('</article>');
      entryOpen = false;
    };
    const closeSection = () => {
      closeEntry();
      if (sectionOpen) addHtml('</div></section>');
      sectionOpen = false;
    };

    for (const token of state.tokens) {
      if (token.type === 'heading_open' && token.level === 0) {
        if (token.tag === 'h1') {
          closeSection();
        } else if (token.tag === 'h2') {
          closeSection();
          addHtml('<section class="section">');
          sectionOpen = true;
          bodyPending = true;
        } else if (token.tag === 'h3' && sectionOpen) {
          closeEntry();
          addHtml('<article class="entry">');
          entryOpen = true;
        }
      }
      tokens.push(token);
      // Keep the h2 outside the body so themes can style it as a separate tab.
      if (bodyPending && token.type === 'heading_close') {
        addHtml('<div class="section-body">');
        bodyPending = false;
      }
    }
    closeSection();
    state.tokens = tokens;
  });

  return md;
}

const markdown = createMarkdown();

export function renderBody(markdownSource) {
  return markdown.render(markdownSource);
}
