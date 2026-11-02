import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(project, 'dist');
const segments = (process.env.BUILD_BASE_PATH || '').split('/').filter(Boolean);
if (segments.some(segment => segment === '.' || segment === '..' || !/^[A-Za-z0-9_.-]+$/.test(segment))) {
  throw new Error('BUILD_BASE_PATH must contain only safe URL path segments');
}
const base = segments.length ? '/' + segments.join('/') : '';
const files = [];
async function findHtml(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await findHtml(filename);
    else if (entry.name.endsWith('.html')) files.push(filename);
  }
}
await findHtml(dist);
const problems = [];
let rewritten = 0;
for (const filename of files) {
  const original = await readFile(filename, 'utf8');
  const html = original.replace(/\b(href|src|poster)="(\/(?!\/)[^"]*)"/g, (match, attribute, value) => {
    if (!base || value === base || value.startsWith(base + '/')) return match;
    rewritten++;
    return `${attribute}="${base}${value}"`;
  });
  if (html !== original) await writeFile(filename, html);
  const relative = path.relative(dist, filename).split(path.sep).join('/');
  for (const [, attribute, value] of html.matchAll(/\b(href|src|poster)="([^"]*)"/g)) {
    if (!value || value.startsWith('#') || /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/.test(value)) continue;
    const url = new URL(value.replaceAll('&amp;', '&'), `https://pages.invalid${base}/${relative}`);
    let pathname = decodeURIComponent(url.pathname);
    if (base) {
      if (pathname !== base && !pathname.startsWith(base + '/')) {
        problems.push(`${relative}: ${attribute} escapes the Pages URL prefix: ${value}`);
        continue;
      }
      pathname = pathname.slice(base.length) || '/';
    }
    const target = path.resolve(dist, '.' + pathname);
    const difference = path.relative(dist, target);
    if (difference === '..' || difference.startsWith('..' + path.sep) || path.isAbsolute(difference)) {
      problems.push(`${relative}: path escapes dist: ${value}`);
      continue;
    }
    try {
      const info = await stat(target);
      if (info.isDirectory()) await stat(path.join(target, 'index.html'));
    } catch {
      problems.push(`${relative}: missing ${attribute}: ${value}`);
    }
  }
}
if (problems.length) throw new Error(problems.join('\n'));
console.log(`Prepared ${files.length} HTML files for GitHub Pages at ${base || '/'}; verified all internal URLs (${rewritten} rewritten).`);
