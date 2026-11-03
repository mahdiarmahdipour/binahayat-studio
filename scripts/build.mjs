import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const metadata = JSON.parse(await readFile(path.join(root, 'content/pages.json'), 'utf8'));
const videos = JSON.parse(await readFile(path.join(root, 'content/aparat-videos.json'), 'utf8'));
const frameVideo = JSON.parse(await readFile(path.join(root, 'content/frame-video.json'), 'utf8'));
const headerTemplate = await readFile(path.join(root, 'src/partials/header.html'), 'utf8');
const footerTemplate = await readFile(path.join(root, 'src/partials/footer.html'), 'utf8');
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
await mkdir(path.join(dist, 'assets'), { recursive: true });
let css = await readFile(path.join(root, 'src/styles/reference.css'), 'utf8');
css = css.replace(/@font-face\{[^}]+\}/g, '');
// Logo rendering is controlled by the real uploaded assets, never by CSS content URLs.
css = css.replace(/html\[data-theme=light\] \.brand img\{[^}]+\}/g, '');
await writeFile(path.join(dist, 'assets/reference.css'), css);
await copyFile(path.join(root, 'src/styles/theme.css'), path.join(dist, 'assets/theme.css'));
await copyFile(path.join(root, 'src/app.js'), path.join(dist, 'assets/app.js'));
await copyFile(path.join(root, 'src/theme-init.js'), path.join(dist, 'assets/theme-init.js'));
await copyFile(path.join(root, 'src/collaboration-config.js'), path.join(dist, 'assets/collaboration-config.js'));
await copyFile(path.join(root, 'src/collaboration-form.js'), path.join(dist, 'assets/collaboration-form.js'));
await copyFile(path.join(root, 'src/styles/plus.css'), path.join(dist, 'assets/plus.css'));
await copyFile(path.join(root, 'src/styles/articles.css'), path.join(dist, 'assets/articles.css'));

const logo = '<img class="logo-light" src="/assets/logo-light.png" alt="بی‌نهایت"><img class="logo-dark" src="/assets/logo-dark.png" alt="بی‌نهایت">';
const posters = ['/assets/showreel-karbala.png', '/assets/showreel-flight.png', '/assets/showreel-worldcup.png'];
function siteHeader(route) {
  return headerTemplate.replace('{{HEADER_CLASS}}', route === '/' ? '' : 'header-solid')
    .replace('{{SITE_LOGO}}', logo)
    .replace(/<a\b([^>]*?)href="([^"]+)"([^>]*)>/g, (match, before, href, after) =>
      href === route ? `<a${before}href="${href}"${after} aria-current="page">` : match);
}
const siteFooter = footerTemplate.replace('{{SITE_LOGO}}', logo);
function framePlayer() {
  const source = new URL(frameVideo.url);
  if (source.protocol !== 'https:' || !['www.aparat.com', 'aparat.com'].includes(source.hostname)) throw new Error('Invalid frame video source');
  let player;
  if (frameVideo.src) {
    if (!/^\/assets\/[a-z0-9-]+\.mp4$/.test(frameVideo.src)) throw new Error('Invalid local frame video');
    if (frameVideo.poster && !/^\/assets\/[a-z0-9-]+\.(?:jpg|png|webp)$/.test(frameVideo.poster)) throw new Error('Invalid frame video poster');
    player = `<video src="${escape(frameVideo.src)}"${frameVideo.poster ? ` poster="${escape(frameVideo.poster)}"` : ''} controls playsinline preload="metadata" aria-label="${escape(frameVideo.title)}"><a href="${escape(frameVideo.src)}">دریافت ویدئو</a></video>`;
  } else if (frameVideo.embedUrl) {
    const embed = new URL(frameVideo.embedUrl);
    if (embed.protocol !== 'https:' || !['www.aparat.com', 'aparat.com'].includes(embed.hostname)) throw new Error('Invalid frame video embed');
    player = `<iframe src="${escape(embed.href)}" title="${escape(frameVideo.title)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  } else {
    player = `<a class="frame-direct-player" href="${escape(source.href)}" target="_blank" rel="noopener noreferrer"><img src="/assets/plus-mark.png" alt="" width="1080" height="1080"><span class="frame-play-symbol" aria-hidden="true">▶</span><strong>${escape(frameVideo.title)}</strong><span>تماشا در آپارات ↗</span></a>`;
  }
  const videoLink = frameVideo.src ? `<a href="${escape(frameVideo.src)}" download>دریافت ویدئو ↓</a>` : `<a href="${escape(source.href)}" target="_blank" rel="noopener noreferrer">تماشا در آپارات ↗</a>`;
  return `<figure class="frame-film"><div class="frame-film-player">${player}</div><figcaption><span>${escape(frameVideo.title)}</span>${videoLink}</figcaption></figure>`;
}
const xVideo = '<div class="article-embed"><blockquote class="twitter-tweet" data-dnt="true" data-theme="dark"><a href="https://x.com/OpenAI/status/2104993966043320759">تماشای ویدیوی OpenAI در X</a></blockquote><p><a href="https://x.com/OpenAI/status/2104993966043320759" target="_blank" rel="noopener noreferrer">اگر ویدیو نمایش داده نمی‌شود، آن را در X ببینید ↗</a></p></div>';
function collection(slug, title) {
  const items = videos[slug] || [];
  if (!items.length) return '<section class="empty-work-space shell" aria-label="ویدیوهای این اثر به‌زودی اضافه می‌شوند"></section>';
  const cards = items.map((item, i) => {
    const parsed = new URL(item.url);
    if (!['www.aparat.com', 'aparat.com'].includes(parsed.hostname) || parsed.protocol !== 'https:') throw new Error('Only HTTPS Aparat video URLs are supported');
    const hash = parsed.pathname.match(/videohash\/([A-Za-z0-9]+)/)?.[1] || parsed.pathname.match(/^\/v\/([A-Za-z0-9]+)/)?.[1];
    if (!hash) throw new Error('Invalid Aparat video URL: ' + item.url);
    return `<article class="aparat-card"><div class="aparat-frame"><iframe src="https://www.aparat.com/video/video/embed/videohash/${hash}/vt/frame" title="${escape(item.title)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div><div class="aparat-meta"><span>${String(i + 1).padStart(2, '0')}</span><h2><a href="https://www.aparat.com/v/${hash}" target="_blank" rel="noopener noreferrer" aria-label="تماشای ${escape(item.title)} در آپارات">${escape(item.title)}</a></h2></div></article>`;
  }).join('');
  return `<section class="video-collection section shell"><div class="section-kicker"><span>ویدیوها</span><small>${escape(title)}</small></div><div class="aparat-grid">${cards}</div></section>`;
}
for (const page of metadata) {
  let main = await readFile(path.join(root, 'src/pages', page.file), 'utf8');
  const headerMarkup = siteHeader(page.route);
  main = main.replace('<!--SITE_HEADER-->', headerMarkup)
    .replace(/<header\b[^>]*class="site-header[^"]*"[^>]*>[\s\S]*?<\/header>/, () => headerMarkup);
  main = main.replace('<!--SITE_FOOTER-->', siteFooter)
    .replace(/<footer\b[^>]*class="footer shell"[^>]*>[\s\S]*?<\/footer>/, () => siteFooter);
  main = main.replace(/<img src="\/assets\/binahayat-logo-white\.png" alt="بی‌نهایت">/g, logo);
  main = main.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  main = main.replace('<!--FRAME_VIDEO-->', framePlayer());
  main = main.replace('<!--OPENAI_X_VIDEO-->', xVideo);
  if (page.route === '/') {
    let index = 0;
    main = main.replace(/<figure class="slide[^\"]*"[^>]*>[\s\S]*?<\/figure>/g, () => {
      const i = index++;
      return `<figure class="slide${i === 0 ? ' slide-active' : ''}" aria-hidden="${i !== 0}"><video src="/assets/showreel-0${i + 1}.mp4" poster="${posters[i]}" muted playsinline preload="${i === 0 ? 'auto' : 'metadata'}" aria-label="${['روایت تاریخی و آیینی', 'روایت داستانی', 'تیزر و محتوای برند'][i]}"></video></figure>`;
    });
    let dot = 0;
    main = main.replace(/<button class="(?:active)?" aria-label="نمایش اسلاید [123]"><\/button>/g, () => {
      const i = dot++;
      return `<button class="${i === 0 ? 'active' : ''}" aria-label="نمایش اسلاید ${i + 1}" aria-pressed="${i === 0}"></button>`;
    });
  }
  if (page.route.startsWith('/works/')) {
    const slug = page.route.split('/').at(-1);
    if (!main.includes('<!--APARAT_COLLECTION-->')) throw new Error('Missing Aparat collection marker for ' + page.route);
    main = main.replace('<!--APARAT_COLLECTION-->', collection(slug, page.title.split(' | ')[0]));
  }
  main = main.replace(/<nav class="nav"/, '<nav id="main-nav" class="nav"');
  main = main.replace(/class="menu-button"/, 'class="menu-button" aria-controls="main-nav"');
  // Remove ambiguous duplicated image names from the accessibility tree.
  main = main.replace(/<a href="\/"(?![^>]*aria-label)([^>]*)>(<img class="logo-light")/, '<a href="/" aria-label="بی‌نهایت، صفحه خانه"$1>$2');
  main = main.replace(/class="logo-(light|dark)" src="([^"]+)" alt="بی‌نهایت"/g, 'class="logo-$1" src="$2" alt="" aria-hidden="true"');
  const collaborationScripts = page.route === '/collaboration' ? '<script src="/assets/collaboration-config.js" defer></script>\n<script src="/assets/collaboration-form.js" defer></script>\n' : '';
  const extraCss = page.route.startsWith('/plus') ? '<link rel="stylesheet" href="/assets/plus.css">\n' : page.route.startsWith('/blog') ? '<link rel="stylesheet" href="/assets/articles.css">\n' : '';
  const externalMedia = page.route === '/blog/openai-devday-2026' ? '<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>' : '';
  const html = `<!doctype html>\n<html lang="fa" dir="rtl" data-theme="light">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escape(page.title)}</title>\n<meta name="description" content="${escape(page.description)}">\n<meta name="color-scheme" content="light dark">\n<link rel="icon" href="/assets/logo-icon.jpg">\n<script src="/assets/theme-init.js"></script>\n<link rel="stylesheet" href="/assets/reference.css">\n<link rel="stylesheet" href="/assets/theme.css">\n${extraCss}${collaborationScripts}<script src="/assets/app.js" defer></script>\n</head>\n<body${page.route.startsWith('/plus') ? ' class="site-plus"' : ''}>${main}${externalMedia}</body>\n</html>\n`;
  const directory = page.route === '/' ? dist : path.join(dist, page.route.slice(1));
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), html);
}
const home = await readFile(path.join(dist, 'index.html'), 'utf8');
const header = siteHeader('/404').replace('class="nav"', 'id="main-nav" class="nav"').replace('class="menu-button"', 'class="menu-button" aria-controls="main-nav"');
await writeFile(path.join(dist, '404.html'), home.replace(/<main>[\s\S]*?<\/main>/, `<main class="not-found" id="top">${header}<div><b>۴۰۴</b><h1>این صفحه پیدا نشد.</h1><a class="button button-primary" href="/">بازگشت به خانه ↙</a></div></main>`).replace(/<title>.*?<\/title>/, '<title>صفحه پیدا نشد | بی‌نهایت</title>'));
console.log(`Built ${metadata.length} pages in ${dist}`);
