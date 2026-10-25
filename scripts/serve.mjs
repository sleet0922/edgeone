#!/usr/bin/env node
/**
 * 本地预览：node scripts/serve.mjs [port]
 * 只用于本地查看 dist/，线上由 EdgeOne Pages 托管。
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'dist');
const port = Number(process.argv[2] || process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let filePath = path.join(root, decodeURIComponent(url.pathname));

    if (!filePath.startsWith(root)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const info = await stat(filePath).catch(() => null);
    if (!info || info.isDirectory()) filePath = path.join(filePath, 'index.html');

    const body = await readFile(filePath);
    res.writeHead(200, {
      'content-type': TYPES[path.extname(filePath)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 Not Found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`  preview → http://127.0.0.1:${port}`);
});
