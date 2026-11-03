import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const THEMES_DIR = fileURLToPath(new URL('../themes/', import.meta.url));

export function listThemes(themesDir = THEMES_DIR) {
  return fs.readdirSync(themesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .flatMap((id) => {
      const dir = path.resolve(themesDir, id);
      const cssPath = path.join(dir, 'theme.css');
      if (!fs.existsSync(cssPath) || !fs.statSync(cssPath).isFile()) return [];

      const metadataPath = path.join(dir, 'theme.json');
      let metadata = {};
      if (fs.existsSync(metadataPath)) {
        const source = fs.readFileSync(metadataPath, 'utf8');
        try {
          metadata = JSON.parse(source);
        } catch (error) {
          throw new Error(`Invalid theme.json in ${dir}: ${error.message}`);
        }
      }

      const templatePath = path.join(dir, 'template.html');
      return [{
        id,
        name: metadata?.name ?? id,
        description: metadata?.description ?? '',
        author: metadata?.author ?? '',
        dir,
        cssPath,
        templatePath: fs.existsSync(templatePath) ? templatePath : null,
      }];
    });
}

export function loadTheme(name, themesDir = THEMES_DIR) {
  const themes = listThemes(themesDir);
  const theme = themes.find((candidate) => candidate.id === name);
  if (theme) return theme;

  const error = new Error(`Theme "${name}" not found. Available themes: ${themes.map((candidate) => candidate.id).join(', ')}`);
  error.code = 'THEME_NOT_FOUND';
  throw error;
}
