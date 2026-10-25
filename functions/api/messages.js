/**
 * GET  /api/messages  读取最新留言
 * POST /api/messages  写入一条留言（{ name?, content }）
 *
 * 存储使用 Pages KV：在控制台创建命名空间后，把绑定变量名设为 GUESTBOOK_KV。
 * 未绑定 KV 时接口仍然可用：GET 返回 kv:false，POST 返回 503 并附带提示。
 */

const KEY = 'guestbook';
const MAX_ITEMS = 50;
const MAX_NAME = 16;
const MAX_CONTENT = 140;

export async function onRequestGet({ env }) {
  const kv = resolveKv(env);
  if (!kv) return json({ ok: true, kv: false, messages: [], hint: hint() });

  try {
    const list = await read(kv);
    return json({ ok: true, kv: true, messages: list, total: list.length });
  } catch (err) {
    return json({ ok: false, kv: true, code: 'KV_READ_FAILED', message: String(err && err.message || err) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const kv = resolveKv(env);
  if (!kv) {
    return json({ ok: false, kv: false, code: 'KV_NOT_BOUND', message: hint() }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return json({ ok: false, code: 'BAD_JSON', message: '请求体必须是 JSON。' }, 400);
  }

  const name = clean(body && body.name, MAX_NAME) || '匿名';
  const content = clean(body && body.content, MAX_CONTENT);
  if (!content) {
    return json({ ok: false, code: 'EMPTY_CONTENT', message: '留言内容不能为空。' }, 400);
  }

  const item = {
    id: makeId(),
    name,
    content,
    at: Date.now(),
  };

  try {
    const list = await read(kv);
    const next = [item, ...list].slice(0, MAX_ITEMS);
    await kv.put(KEY, JSON.stringify(next));
    return json({ ok: true, kv: true, item, total: next.length }, 201);
  } catch (err) {
    return json({ ok: false, code: 'KV_WRITE_FAILED', message: String(err && err.message || err) }, 500);
  }
}

/* ---------- 工具 ---------- */

function resolveKv(env) {
  try {
    if (env && env.GUESTBOOK_KV) return env.GUESTBOOK_KV;
  } catch (err) { /* ignore */ }
  try {
    if (typeof GUESTBOOK_KV !== 'undefined' && GUESTBOOK_KV) return GUESTBOOK_KV;
    return globalThis.GUESTBOOK_KV || null;
  } catch (err) {
    return null;
  }
}

async function read(kv) {
  const raw = await kv.get(KEY);
  if (!raw) return [];
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((m) => m && typeof m.content === 'string')
    .slice(0, MAX_ITEMS)
    .map((m) => ({
      id: String(m.id || ''),
      name: String(m.name || '匿名').slice(0, MAX_NAME),
      content: String(m.content).slice(0, MAX_CONTENT),
      at: Number(m.at) || 0,
    }));
}

/** 去控制字符、合并空白、按码点截断，避免长表情被切坏 */
function clean(value, max) {
  if (typeof value !== 'string') return '';
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  const points = Array.from(normalized);
  return points.length > max ? points.slice(0, max).join('') : normalized;
}

function makeId() {
  try {
    return crypto.randomUUID().slice(0, 8);
  } catch (err) {
    return Math.random().toString(36).slice(2, 10);
  }
}

function hint() {
  return '未绑定 KV：在控制台创建 KV 命名空间，并在项目里把绑定变量名设为 GUESTBOOK_KV，然后重新部署。';
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
    },
  });
}
