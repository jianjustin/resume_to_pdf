English | [简体中文](README.zh-CN.md)

# resume-to-pdf

## Introduction

Turn a Markdown resume into an A4 PDF with a clean, single-column layout. Optional YAML front matter supplies the header; ordinary Markdown supplies the content. Chinese and English resumes are supported, and HTML preview makes theme editing quick. See [the example resume](examples/resume.md).

## Requirements

- Node.js **≥ 22.12** and npm.
- Chrome (downloaded by Puppeteer, or an existing local installation).
- System fonts covering the characters in your resume.

## Installation

Run from the project directory:

```sh
npm install
```

## Browser

Puppeteer automatically downloads Chrome for Testing and Chrome headless shell during installation, provided your package manager allows Puppeteer's install script. If npm warns that Puppeteer's `postinstall` is not approved, review and approve it according to your package manager's install-script policy before relying on the automatic download. A successful install alone does not prove a browser was downloaded. PDF generation uses Chrome; HTML preview does not launch a browser.

### Downloads and mirrors

If the default download host is unreachable, these **Puppeteer 25** settings select a mirror for both default browser downloads (POSIX shell):

```sh
PUPPETEER_CHROME_DOWNLOAD_BASE_URL=https://cdn.npmmirror.com/binaries/chrome-for-testing \
PUPPETEER_CHROME_HEADLESS_SHELL_DOWNLOAD_BASE_URL=https://cdn.npmmirror.com/binaries/chrome-for-testing \
npm install
```

These variable names are confirmed against the installed Puppeteer implementation. A fresh mirror download has not been tested; mirror availability and coverage of your browser version/platform are not guaranteed. An install with an existing browser cache does not verify the mirror.

### Using local Chrome

To avoid downloading browsers during installation:

```sh
PUPPETEER_SKIP_DOWNLOAD=true npm install
```

Set `PUPPETEER_EXECUTABLE_PATH` to the **absolute path to your installed Chrome executable** in the environment used for PDF generation. Quote paths containing spaces. On macOS, a typical Google Chrome executable is `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; use the actual location on your machine, not just the `.app` directory. `PUPPETEER_SKIP_DOWNLOAD` only skips installation downloads: it does not locate or install Chrome. Keep the executable-path setting available when running `build`.

### Linux and containers

On Debian/Ubuntu, install the `fonts-noto-cjk` package with your system package manager so Chinese text has a suitable font. Other Linux distributions need an equivalent CJK font package, as well as Chrome's runtime libraries. The default theme uses system fonts and bundles no fonts.

Chrome may need additional sandbox/container configuration when run as root in a container. Prefer a non-root user and a properly configured Chrome sandbox; disabling the sandbox is not a safe default, and the CLI does not automatically do so. Linux package installation and root-container behavior have not been validated on macOS.

## Usage

Run these commands from the project directory:

```sh
node bin/resume-to-pdf.js build examples/resume.md
node bin/resume-to-pdf.js preview examples/resume.md
node bin/resume-to-pdf.js themes
```

| Subcommand | Arguments and result |
| --- | --- |
| `build` | Required Markdown input path; writes a same-name `.pdf` beside the input by default. |
| `preview` | Required Markdown input path; writes a same-name `.html` beside the input by default. |
| `themes` | No input required; lists theme IDs, descriptions, and authors. |

For `build` and `preview`, `-o` / `--output` chooses the output path and `--theme` selects a theme ID (default: `default`). `-h` / `--help` prints usage. Paths containing spaces must be quoted. For example:

```sh
node bin/resume-to-pdf.js build examples/resume.md -o examples/resume-custom.pdf --theme default
node bin/resume-to-pdf.js preview examples/resume.md --output examples/resume-custom.html --theme default
node bin/resume-to-pdf.js --help
```

Equivalent npm scripts (use `--` before arguments):

```sh
npm run build -- examples/resume.md
npm run preview -- examples/resume.md
npm run themes
```

The package's CLI entry point can also be invoked from this checkout:

```sh
npx resume-to-pdf themes
```

The default examples write `examples/resume.pdf` and `examples/resume.html`. Open the HTML file in a browser to preview it. Theme paths are resolved relative to the package, not the current working directory. CLI messages are in English; errors exit with a nonzero status.

## Resume format

### Optional YAML front matter

Place front matter at the very start of the Markdown file, between `---` lines. See the example resume for a complete document.

| Field | Meaning | Header display |
| --- | --- | --- |
| `name` | Name | Large title |
| `role` | Target role / position | Line below the name |
| `location` | City | Contact line |
| `phone` | Phone number | Contact line, `tel:` link |
| `email` | Email address | Contact line, `mailto:` link |
| `website` | Personal website | Contact line, with the protocol prefix removed from display |
| `github` | GitHub URL | Same as above; a value without a protocol (`github.com/x`) automatically gets `https://` |
| `lang` | Document language (optional) | Written to `<html lang>`; if omitted, CJK text yields `zh-CN`, otherwise `en` |

Language detection checks the body and displayed header fields. The contact order is always `location · phone · email · website · github`, skipping missing fields. Unknown keys (such as Obsidian's `tags`, `created`, and `title`) are ignored by the standard header. Use `role`, not `title`, for the position. Custom templates can explicitly reference scalar front matter fields as described below.

Without front matter, or without any header fields, no header is emitted; the body still renders. A body `# Heading` is styled like the name by the default theme.

### Entry headings

These language-independent rules apply to `###` and `####` headings:

- A trailing date or date range, enclosed in `()` / `（）` or following `|` / `｜`, makes an entry heading: title on the left, date on the right.
- Split the remaining text on `|` / `｜`: the first part is the title (company, project, school); join the remaining parts with ` · ` as the subtitle (role, degree). Inline Markdown, including links and bold, is preserved within each part.
- Date forms: `YYYY`, `YYYY.MM`, `YYYY-MM`, `YYYY/MM`, `YYYY年MM月`. Range separators: `-`, `–`, `—`, `~`, `～`, `〜`, `至`, `to`. The end may also be `至今`, `今`, `现在`, `Present`, `Now`, or `Current` (English is case-insensitive). A single date, such as a graduation date, is allowed.
- Display uses `YYYY.MM` with zero-padded months (year-only dates remain `YYYY`) and ` – ` (an en dash with spaces) between endpoints. Chinese current-date words display as `至今`; English ones display as `Present`.
- Nonmatching headings stay unchanged, without an error.

```markdown
### 青禾生鲜 ｜ 高级数据分析师（2022.03 – 至今）
### Acme Inc. | Senior Engineer (2021-03 to present)
### 门店选址评分模型（2023.06—2023.11）
### 指标口径治理
```

The first three are dated entries; the last remains an ordinary heading. Mark important accomplishments with `**bold**`; the theme provides the visual emphasis.

## Themes

- **`default`** — Single-column layout with tabbed section cards, a navy and orange accent, built for quick scanning. Author: jianjustin.

## Creating a theme

### Files and metadata

Add a directory inside the package's `themes/` directory. The directory name is the ID used by `--theme`:

```text
themes/my-theme/
├── theme.css       (required)
├── theme.json      (recommended)
├── template.html   (optional)
└── fonts/          (optional font assets)
```

A directory is listed as a theme only if it contains `theme.css`. `theme.json` describes the display name, description, and author; without it, the directory name is the display name:

```json
{
  "name": "My theme",
  "description": "A personal resume layout.",
  "author": "Your name"
}
```

An optional `template.html` replaces the built-in `src/template.html`. The template is a full HTML document; there is no template logic. A minimal template is:

```html
<!doctype html>
<html lang="{{lang}}">
<head>
  <meta charset="utf-8">
  <title>{{title}}</title>
  {{styles}}
</head>
<body>
  <main class="resume">{{header}}{{content}}</main>
</body>
</html>
```

### Placeholders

| Placeholder | Substitution |
| --- | --- |
| `{{styles}}` | Raw HTML: the theme CSS `<link>` plus the document's asset-base `<base>` tag |
| `{{header}}` | Raw HTML: generated resume header |
| `{{content}}` | Raw HTML: rendered Markdown body |
| `{{lang}}` | HTML-escaped document language |
| `{{title}}` | HTML-escaped document title: `name`, or `Resume` if absent |
| `{{name}}`, `{{role}}`, `{{location}}`, `{{phone}}`, `{{email}}`, `{{website}}`, `{{github}}` | HTML-escaped front matter values; other scalar front matter fields can also be referenced |

Undefined placeholders become empty strings. Only string, number, and boolean front matter values are substituted. Reserved names (`styles`, `header`, `content`, `lang`, `title`) take precedence over same-named front matter fields. Escaping is HTML escaping, not URL validation; use trusted Markdown, themes, and assets.

### HTML structure and classes

Themes rely on these class names; keep them when using a custom template:

```html
<main class="resume">
  <header class="resume-header">
    <h1 class="name">…</h1>
    <p class="role">…</p>
    <ul class="contact"><li>…</li>…</ul>
  </header>
  <section class="section">
    <h2>工作经历</h2>
    <div class="section-body">
    <article class="entry">
      <h3 class="entry-head">
        <span class="entry-main">
          <span class="entry-title">青禾生鲜</span>
          <span class="entry-sub">高级数据分析师</span>
        </span>
        <span class="entry-date">2022.03 – 至今</span>
      </h3>
      …
    </article>
    </div>
  </section>
</main>
```

`resume` is the page wrapper; `resume-header`, `name`, `role`, and `contact` form the optional header. An `h2` starts a `section`; the content after it is wrapped in `section-body`. Within a section, each `h3` starts an `article.entry`, even without a date. Recognized dated `h3` / `h4` headings use `entry-head`, `entry-main`, `entry-title`, optional `entry-sub`, and `entry-date`. An undated `h3` has no `entry-head` or generated spans. An `h4` does not start another article.

### Fonts and style iteration

Themes can bundle fonts (check their redistribution licenses). Reference font files relative to `theme.css`, for example, after placing `ResumeSans.woff2` in the theme's `fonts/` directory:

```css
@font-face {
  font-family: "Resume Sans";
  src: url("./fonts/ResumeSans.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
}
body { font-family: "Resume Sans", "Noto Sans CJK SC", sans-serif; }
```

The font file is an illustration, not an included asset; provide it before using this CSS. Supply appropriate CJK coverage or a system fallback. Theme CSS is linked through an absolute `file://` URL, so relative font/image paths resolve from the CSS file itself. PDF generation waits for document fonts to be ready.

Use `preview` with your theme selected, open the resulting HTML, edit `theme.css`, and refresh the browser. CSS is linked, not inlined, so CSS-only edits do not require rerunning preview. Rerun preview after changing Markdown or the HTML template. Rebuild the PDF to apply changes to the PDF output.

## License

[MIT](LICENSE).
