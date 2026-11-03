import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { listThemes, loadTheme, THEMES_DIR } from './themes.js';
import { renderDocument } from './render.js';
import { htmlToPdf } from './pdf.js';

const USAGE = `Usage:
  resume-to-pdf build <input.md> [-o output.pdf] [--theme <name>]
  resume-to-pdf preview <input.md> [-o output.html] [--theme <name>]
  resume-to-pdf themes
`;

export async function main(argv, { stdout = process.stdout, stderr = process.stderr, themesDir = THEMES_DIR } = {}) {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        output: { type: 'string', short: 'o' },
        theme: { type: 'string', default: 'default' },
        help: { type: 'boolean', short: 'h' },
      },
    });
    if (values.help) {
      stdout.write(USAGE);
      return 0;
    }

    const [command, input, ...extra] = positionals;
    if (!command) {
      stderr.write(USAGE);
      return 1;
    }
    if (!['build', 'preview', 'themes'].includes(command)) {
      throw new Error(`Unknown command: ${command}`);
    }
    if (command === 'themes' ? input !== undefined : extra.length > 0) {
      throw new Error(`Unexpected argument: ${command === 'themes' ? input : extra[0]}`);
    }
    if (command === 'themes') {
      const themes = listThemes(themesDir);
      stdout.write('Available themes:\n');
      for (const theme of themes) {
        const name = theme.name === theme.id ? '' : ` (${theme.name})`;
        const author = theme.author ? `  — ${theme.author}` : '';
        stdout.write(`  ${theme.id}${name}  ${theme.description}${author}\n`);
      }
      return 0;
    }

    if (!input) throw new Error('Missing input file');
    const inputPath = path.resolve(input);
    if (!fs.existsSync(inputPath)) throw new Error(`Input file not found: ${input}`);

    const theme = loadTheme(values.theme, themesDir);
    const html = renderDocument(fs.readFileSync(inputPath, 'utf8'), {
      theme,
      baseDir: path.dirname(inputPath),
    });
    const extension = command === 'build' ? '.pdf' : '.html';
    const outputPath = values.output === undefined
      ? inputPath.replace(/\.(?:md|markdown)$/, '') + extension
      : path.resolve(values.output);

    if (command === 'build') {
      await htmlToPdf(html, outputPath);
      stdout.write(`PDF written to ${outputPath}\n`);
    } else {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, html);
      stdout.write(`HTML written to ${outputPath}\n`);
    }
    return 0;
  } catch (error) {
    if (error.code === 'BROWSER_LAUNCH_FAILED') {
      stderr.write(`Could not launch Chromium: ${error.cause.message}. See the "Browser" section in README.md.\n`);
    } else {
      stderr.write(`${error.message}\n`);
    }
    return 1;
  }
}
