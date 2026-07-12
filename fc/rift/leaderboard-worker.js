// ==================== DIABLO BUILD · 排行榜 Worker（T5.1）====================
// 在独立线程中 POST 到 /api/leaderboard，避免阻塞游戏主线程。
//
// 消息契约（来自 Leaderboard.submitRun → new Worker(url).postMessage）：
//   { endpoint: string, body: string (JSON) }
//
// 回复（worker.onmessage 收到）：
//   { ok: boolean, status?: number, body?: any, error?: string }

'use strict';

// Service Worker 环境降级（FetchEvent / respondWith 不可用时仅当 fetch 可用）
var canFetch = (typeof fetch === 'function');

self.onmessage = function (ev) {
  var data = (ev && ev.data) || {};
  var endpoint = data.endpoint;
  var body = data.body;

  if (!endpoint || !body) {
    self.postMessage({ ok: false, error: 'bad_args' });
    return;
  }

  if (!canFetch) {
    self.postMessage({ ok: false, error: 'no_fetch' });
    return;
  }

  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body,
    mode: 'cors',
    credentials: 'omit',
    keepalive: true
  })
    .then(function (resp) {
      return resp.text().then(function (text) {
        var parsed = null;
        try { parsed = text ? JSON.parse(text) : null; } catch (_) { parsed = text; }
        self.postMessage({
          ok: resp.ok,
          status: resp.status,
          body: parsed
        });
      });
    })
    .catch(function (err) {
      self.postMessage({
        ok: false,
        error: String((err && err.message) || err || 'fetch_failed')
      });
    });
};

// 兼容 ServiceWorker context（worker.js 部署在 sw.js 旁时，self.addEventListener 模式）
if (typeof self.addEventListener === 'function' && typeof FetchEvent !== 'undefined') {
  self.addEventListener('fetch', function (event) {
    // 此 worker 不拦截网络请求；仅做 POST 中转。
    // 保留监听避免某些浏览器判定为"无效 SW"。
  });
}