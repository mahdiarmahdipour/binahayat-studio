import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(projectRoot, 'dist');
const errors = [];

async function filesIn(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(entry => entry.isDirectory()
    ? filesIn(path.join(directory, entry.name))
    : [path.join(directory, entry.name)]));
  return groups.flat();
}

function report(message) {
  errors.push(message);
}

function routeFor(filename) {
  const relative = path.relative(dist, filename).split(path.sep).join('/');
  return '/' + relative.replace(/(?:^|\/)index\.html$/, '/').replace(/^\//, '');
}

const files = await filesIn(dist);
const htmlFiles = files.filter(filename => filename.endsWith('.html'));
const pages = htmlFiles.filter(filename => path.relative(dist, filename) !== '404.html');
if (pages.length !== 9) report(`Expected 9 pages excluding 404.html; found ${pages.length}.`);
if (!htmlFiles.includes(path.join(dist, '404.html'))) report('Missing dist/404.html.');

const requiredPages = ['index.html', 'about/index.html', 'works/index.html', 'blog/index.html', 'collaboration/index.html',
  ...['leader-funeral', 'short-film', 'world-cup', 'ramadan-war'].map(slug => `works/${slug}/index.html`)];
for (const relative of requiredPages) {
  if (!files.includes(path.join(dist, relative))) report(`Missing page: ${relative}`);
}

const referenceScripts = /(?:__VINEXT|__NEXT|data-rsc|__CF\$cv|challenge-platform|\/cdn-cgi\/|rolldown-runtime|layout-segment-context|framework-DjPHiq1u|SiteHeader-BzUaD3BD|HomeSlider-CxjhlB3-)/i;
for (const filename of htmlFiles) {
  const html = await fs.readFile(filename, 'utf8');
  const label = path.relative(dist, filename);
  if (/href=["']\/works\/(?:solidarity|egg-men)(?:["'/?#])/i.test(html)) report(`Removed work link remains: ${label}`);
  if (referenceScripts.test(html)) report(`Original framework or CDN challenge markup remains: ${label}`);
  if (!/<html\b[^>]*\blang=["']fa["']/i.test(html)) report(`Persian lang attribute missing: ${label}`);
  if (!/<html\b[^>]*\bdir=["']rtl["']/i.test(html)) report(`RTL attribute missing: ${label}`);
  for (const [, attribute, rawValue] of html.matchAll(/\b(href|src|poster)\s*=\s*["']([^"']*)["']/gi)) {
    const value = rawValue.replace(/&amp;/g, '&');
    if (!value || value.startsWith('#') || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) continue;
    let resolvedUrl;
    try {
      resolvedUrl = new URL(value, `https://static.invalid${routeFor(filename)}`);
    } catch {
      report(`Invalid ${attribute} ${value} in ${label}`);
      continue;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(resolvedUrl.pathname);
    } catch {
      report(`Invalid encoded path ${value} in ${label}`);
      continue;
    }
    const target = path.resolve(dist, `.${pathname}`);
    const relative = path.relative(dist, target);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      report(`Path escapes dist: ${value} in ${label}`);
      continue;
    }
    try {
      const info = await fs.stat(target);
      if (info.isDirectory()) await fs.access(path.join(target, 'index.html'));
      else if (!info.isFile()) report(`Not a file: ${value} in ${label}`);
    } catch {
      report(`Missing internal ${attribute}: ${value} in ${label}`);
    }
  }
}

const fonts = files.filter(filename => filename.toLowerCase().endsWith('.woff') && filename.startsWith(path.join(dist, 'fonts') + path.sep));
if (fonts.length !== 11) report(`Expected 11 original WOFF fonts; found ${fonts.length}.`);
const fontWeights = ['Thin', 'Black', 'Bold', 'ExtraBold', 'ExtraLight', 'HairLine', 'Heavy', 'Light', 'Medium', 'Regular', 'SemiBold'];
for (const weight of fontWeights) {
  const filename = path.join(dist, 'fonts', `DAMOON_FANUM-${weight}.woff`);
  if (!fonts.includes(filename)) report(`Missing original font: ${path.basename(filename)}`);
}
for (const number of ['01', '02', '03']) {
  const filename = path.join(dist, 'assets', `showreel-${number}.mp4`);
  try {
    const info = await fs.stat(filename);
    if (!info.isFile() || info.size === 0) report(`Empty or invalid original video: ${path.basename(filename)}`);
  } catch {
    report(`Missing original video: ${path.basename(filename)}`);
  }
}

const projectFiles = await filesIn(projectRoot);
const javascriptFiles = projectFiles.filter(filename => /\.(?:mjs|js)$/.test(filename) && !filename.split(path.sep).includes('node_modules') && !filename.split(path.sep).includes('.git'));
for (const filename of javascriptFiles) {
  const result = spawnSync(process.execPath, ['--check', filename], { encoding: 'utf8', windowsHide: true, shell: false });
  if (result.status !== 0) report(`JavaScript syntax error in ${path.relative(projectRoot, filename)}: ${(result.stderr || result.error?.message || 'check failed').trim()}`);
}

if (errors.length) {
  console.error(errors.map(message => `- ${message}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated ${pages.length} pages, ${fonts.length} WOFF fonts, 3 original videos, all internal HTML links/assets, and ${javascriptFiles.length} JavaScript files.`);
}
