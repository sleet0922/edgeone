#!/usr/bin/env node
/**
 * 本地开发服务器（仅用于本仓库预览，线上由 EdgeOne Pages 托管）
 *
 *   node scripts/serve.mjs [port]
 *
 * 它能做两件事：
 *   1. 托管 dist/ 里的静态产物
 *   2. 以 Pages Functions 的方式执行 functions/ 目录下的接口
 *      —— 路由规则、onRequest/onRequestGet/onRequestPost、context 结构与线上一致
 *
 * 另外提供一个文件落盘的 KV 模拟（.data/kv.json），
 * 这样本地也能完整走通「写留言 → 读留言」，无需登录控制台。
 */
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = path.join(projectRoot, 'dist');
const functionsRoot = path.join(projectRoot, 'functions');
const port = Number(process.argv[2] || process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

/* ---------------- 本地 KV 模拟 ---------------- */

const kvFile = path.join(projectRoot, '.data', 'kv.json');
let kvCache = null;

async function kvLoad() {
  if (kvCache) return kvCache;
  try {
    kvCache = JSON.parse(await readFile(kvFile, 'utf8'));
  } catch {
    kvCache = {};
  }
  return kvCache;
}

async function kvSave() {
  await mkdir(path.dirname(kvFile), { recursive: true });
  await writeFile(kvFile, JSON.stringify(kvCache, null, 2));
}

const mockKv = {
  async get(key) {
    const db = await kvLoad();
    return Object.prototype.hasOwnProperty.call(db, key) ? db[key].value : null;
  },
  async put(key, value, options) {
    const db = await kvLoad();
    db[key] = { value: String(value), ttl: options?.expirationTtl ?? null, meta: options?.metadata ?? null };
    await kvSave();
    return 'OK';
  },
  async delete(key) {
    const db = await kvLoad();
    delete db[key];
    await kvSave();
  },
  async list({ prefix = '', limit = 100 } = {}) {
    const db = await kvLoad();
    const keys = Object.keys(db)
      .filter((k) => k.startsWith(prefix))
      .map((k) => ({ key: k, ttl: db[k].ttl, meta: db[k].meta }));
    return { keys: keys.slice(0, limit), complete: true };
  },
};

// Pages 的 KV 绑定是全局变量，本地模拟同名注入
globalThis.GUESTBOOK_KV ||= mockKv;
globalThis.my_kv ||= mockKv;

/* ---------------- 函数路由 ---------------- */

async function resolveFunction(pathname) {
  const rel = pathname.replace(/^\/+|\/+$/g, '');
  if (!rel) return null;

  const candidates = [`${rel}.js`, `${rel}/index.js`, `${rel}.mjs`];
  for (const candidate of candidates) {
    const file = path.join(functionsRoot, candidate);
    if (!file.startsWith(functionsRoot + path.sep)) continue;
    try {
      const info = await stat(file);
      if (info.isFile()) return { file, info };
    } catch {
      /* 继续尝试下一个候选 */
    }
  }
  return null;
}

function pickHandler(mod, method) {
  const suffix = method.charAt(0) + method.slice(1).toLowerCase();
  return mod[`onRequest${suffix}`] || mod.onRequest || null;
}

function mockEo(clientIp) {
  return {
    colo: 'LOCAL',
    geo: {
      ip: clientIp,
      countryName: '本地开发',
      regionName: 'Localhost',
      cityName: '本机',
      continentName: '—',
      asn: null,
    },
  };
}

async function handleFunction(req, res, url) {
  const started = Date.now();
  const route = await resolveFunction(url.pathname);

  if (!route) {
    sendJson(res, 404, { ok: false, code: 'NOT_FOUND', message: `没有匹配的函数：${url.pathname}` });
    return true;
  }

  try {
    const mod = await import(`${pathToFileURL(route.file).href}?v=${route.info.mtimeMs}`);
    const handler = pickHandler(mod, req.method);

    if (!handler) {
      sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: `${req.method} ${url.pathname} 未实现` });
      return true;
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);

    const init = { method: req.method, headers: req.headers };
    if (chunks.length) init.body = Buffer.concat(chunks);

    const request = new Request(url, init);
    const clientIp = String(req.socket.remoteAddress || '').replace('::ffff:', '');
    Object.defineProperty(request, 'eo', { value: mockEo(clientIp), configurable: true });

    const response = await handler({
      request,
      params: {},
      env: process.env,
      waitUntil: (task) => Promise.resolve(task).catch(() => {}),
    });

    if (!(response instanceof Response)) {
      throw new Error('handler 必须返回 Response');
    }

    const body = Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(req.method === 'HEAD' ? undefined : body);
    log(req.method, url.pathname, response.status, Date.now() - started, 'fn');
    return true;
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { ok: false, code: 'FUNCTION_ERROR', message: String(err && err.message || err) });
    return true;
  }
}

/* ---------------- 静态资源 ---------------- */

async function serveStatic(req, res, url) {
  const started = Date.now();
  let filePath;

  try {
    filePath = path.join(staticRoot, decodeURIComponent(url.pathname));
  } catch {
    res.writeHead(400).end('Bad Request');
    return;
  }

  if (!filePath.startsWith(staticRoot)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  const info = await stat(filePath).catch(() => null);
  if (!info || info.isDirectory()) filePath = path.join(filePath, 'index.html');

  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      'content-type': TYPES[path.extname(filePath)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
    log(req.method, url.pathname, 200, Date.now() - started, 'static');
  } catch {
    if (req.headers.accept?.includes('text/html')) {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
        .end('<!doctype html><meta charset="utf-8"><title>404</title><body style="font:16px/1.6 system-ui;padding:40px;background:#06080d;color:#e9eefb">404 — 没有找到这个文件。先运行 <code>npm run build</code>。</body>');
    } else {
      res.writeHead(404).end('404 Not Found');
    }
  }
}

/* ---------------- 入口 ---------------- */

createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `127.0.0.1:${port}`}`);

  if (req.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS',
      'access-control-allow-headers': 'content-type',
    }).end();
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    await handleFunction(req, res, url);
    return;
  }

  await serveStatic(req, res, url);
}).listen(port, '127.0.0.1', async () => {
  const built = await stat(path.join(staticRoot, 'index.html')).then(() => true).catch(() => false);
  console.log(`\n  preview  → http://127.0.0.1:${port}`);
  console.log(`  functions → /api/status · /api/messages`);
  console.log(`  KV       → .data/kv.json（本地模拟，首次写入时创建）`);
  if (!built) console.log(`  ⚠ dist/ 不存在，先执行 npm run build\n`);
  else console.log('');
});

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=UTF-8',
    'cache-control': 'no-store',
  }).end(body);
}

function log(method, pathname, status, ms, kind) {
  const mark = status >= 500 ? '✗' : status >= 400 ? '!' : '✓';
  console.log(`  ${mark} ${method.padEnd(4)} ${pathname.padEnd(22)} ${status}  ${ms}ms  ${kind}`);
}
