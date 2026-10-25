/**
 * GET /api/status
 * 返回函数运行时信息、边缘节点位置和服务端时间。
 * 不需要任何控制台配置，部署后即可访问。
 */

/** @param {{ request: Request }} context */
export function onRequest({ request }) {
  const eo = request.eo || {};
  const geo = eo.geo || {};

  return json({
    ok: true,
    runtime: 'EdgeOne Pages Functions',
    kv: Boolean(resolveKv()),
    edge: {
      colo: eo.colo || geo.colo || null,
      continent: geo.continentName || geo.continent || null,
      country: geo.countryName || geo.country || null,
      region: geo.regionName || geo.region || null,
      city: geo.cityName || geo.city || null,
      asn: geo.asn || null,
    },
    client: {
      // 只回显前两段，避免把访客完整 IP 暴露在页面上
      ip: maskIp(geo.ip),
      ua: request.headers.get('user-agent') || '',
    },
    server: {
      time: new Date().toISOString(),
      timestamp: Date.now(),
    },
    request: {
      method: request.method,
      path: new URL(request.url).pathname,
    },
  });
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

function resolveKv() {
  if (typeof GUESTBOOK_KV !== 'undefined' && GUESTBOOK_KV) return GUESTBOOK_KV;
  try {
    return globalThis.GUESTBOOK_KV || null;
  } catch (err) {
    return null;
  }
}

function maskIp(ip) {
  if (!ip || typeof ip !== 'string') return null;
  if (ip.includes(':')) return ip.split(':').slice(0, 4).join(':') + ':…';
  const parts = ip.split('.');
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.*.*` : null;
}
