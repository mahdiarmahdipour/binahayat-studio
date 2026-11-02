import http from 'node:http';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const projectDirectory = path.dirname(fileURLToPath(import.meta.url));
const staticDirectory = path.join(projectDirectory, 'dist');
const staticRoot = await realpath(staticDirectory);
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

function isInside(directory, candidate) {
  const relative = path.relative(directory, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function findFile(requestPath) {
  if (requestPath.includes('\\') || requestPath.includes('\0')) return null;
  let filename = path.resolve(staticDirectory, `.${requestPath}`);
  if (!isInside(staticDirectory, filename)) return null;
  try {
    let info = await stat(filename);
    if (info.isDirectory()) {
      filename = path.join(filename, 'index.html');
      info = await stat(filename);
    }
    if (!info.isFile()) return null;
    const resolved = await realpath(filename);
    if (!isInside(staticRoot, resolved)) return null;
    return { filename: resolved, size: info.size };
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
}

function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return null;
    if (start > end || start >= size) return null;
    end = Math.min(end, size - 1);
  }
  return { start, end };
}

function plainResponse(response, status, message, method) {
  const body = Buffer.from(message, 'utf8');
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': body.length });
  response.end(method === 'HEAD' ? undefined : body);
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      plainResponse(response, 405, 'Method not allowed', request.method);
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      plainResponse(response, 400, 'Invalid request path', request.method);
      return;
    }

    let file = await findFile(pathname);
    let statusCode = 200;
    if (!file) {
      statusCode = 404;
      file = await findFile('/404.html');
    }
    if (!file) {
      plainResponse(response, 404, 'Page not found', request.method);
      return;
    }

    const headers = {
      'Content-Type': contentTypes[path.extname(file.filename).toLowerCase()] || 'application/octet-stream',
      'Content-Length': file.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
    };
    let streamOptions;
    if (request.headers.range && statusCode === 200) {
      const range = byteRange(request.headers.range, file.size);
      if (!range) {
        response.writeHead(416, { 'Content-Range': `bytes */${file.size}`, 'Content-Length': 0 });
        response.end();
        return;
      }
      statusCode = 206;
      streamOptions = range;
      headers['Content-Range'] = `bytes ${range.start}-${range.end}/${file.size}`;
      headers['Content-Length'] = range.end - range.start + 1;
    }
    response.writeHead(statusCode, headers);
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    const stream = createReadStream(file.filename, streamOptions);
    stream.on('error', () => response.destroy());
    response.on('close', () => stream.destroy());
    stream.pipe(response);
  } catch (error) {
    console.error(`Static server error: ${error.code || 'unexpected error'}`);
    if (!response.headersSent) plainResponse(response, 500, 'Server error', request.method);
    else response.destroy();
  }
});

server.listen(port, host, () => console.log(`Local: http://${host}:${port}/`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
