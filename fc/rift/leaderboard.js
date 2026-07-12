// ==================== DIABLO BUILD · 排行榜提交（T5.1）====================
// 异步 POST · Web Worker 避免阻塞游戏主线程
//
// 用法（在 climb-ui.js 结算 / 通关 modal 内）：
//   Leaderboard.submitRun({
//     player, buildHash, score, floor, goldRemaining,
//     itemsBroughtOut, itemsLost, ending, classId, submittedAt
//   }).then(r => console.log('[Leaderboard] submitted', r))
//    .catch(e => console.warn('[Leaderboard] submit failed', e));
//
// 契约（与 T5.2 Bitable 写入字段对齐）：
//   - player          string    玩家昵称（用户输入 / localStorage）
//   - buildHash       string    装备 hash（Game.aggregateBuild 序列化）
//   - score           number    分数（floor * 100 + 道德分 + 金币）
//   - floor           number    最高层 1~35
//   - goldRemaining   number    结算后剩余金币
//   - itemsBroughtOut array     带出装备（unique / set）
//   - itemsLost       array     失去装备（normal / magic / rare）
//   - ending          string    'A_Rebel' | 'B_Inheritor' | 'C_Glitched' | 'died' | 'retreated'
//   - classId         string    角色 id
//   - submittedAt     ISO string
//
// 失败策略：best-effort，失败仅 console.warn，不影响游戏。
// endpoint 由 window.LEADERBOARD_ENDPOINT 注入（T5.2 已实现自动检测：基于 pathname 构造完整 URL）。

(function () {
  'use strict';

  if (typeof window === 'undefined' && typeof globalThis === 'undefined') return;
  var root = typeof window !== 'undefined' ? window : globalThis;

  // ---- 常量 ----
  var WORKER_URL = 'rift/leaderboard-worker.js';   // 与 src/index.html 同目录相对路径
  var TIMEOUT_MS = 5000;
  var MAX_PAYLOAD_BYTES = 64 * 1024;               // 64KB 上限（Bitable 单字段）

  // ---- 主入口 ----
  /**
   * 提交一次爬塔结果。返回 Promise<{ ok, status, body }>。
   * - 浏览器支持 Worker → 在 Worker 内 fetch，主线程零阻塞
   * - 不支持 → 主线程内 fetch（仍为 Promise，不阻塞 UI 渲染，但 fetch 期间不能切 tab）
   * - 失败 / 超时 → resolve { ok:false, error }（**不 reject**，避免破坏结算 modal）
   *
   * @param {object} payload - 见文件头契约
   * @returns {Promise<{ok:boolean, status?:number, body?:any, error?:string}>}
   */
  function submitRun(payload) {
    return new Promise(function (resolve) {
      try {
        var safePayload = sanitizePayload(payload);
        var body = JSON.stringify(safePayload);

        if (body.length > MAX_PAYLOAD_BYTES) {
          // 超大 payload 主动放弃，避免 worker postMessage 失败
          console.warn('[Leaderboard] payload too large:', body.length, 'bytes');
          resolve({ ok: false, error: 'payload_too_large' });
          return;
        }

        var endpoint = root.LEADERBOARD_ENDPOINT || '';

        if (typeof Worker !== 'undefined' && endpoint) {
          submitViaWorker(endpoint, body, resolve);
        } else if (endpoint) {
          submitViaFetch(endpoint, body, resolve);
        } else {
          // 未配置 endpoint（T5.2 部署前）：仅本地存档，不打远程
          resolve({ ok: false, error: 'no_endpoint' });
        }
      } catch (err) {
        console.warn('[Leaderboard] submitRun exception:', err);
        resolve({ ok: false, error: String(err && err.message || err) });
      }
    });
  }

  // ---- Worker 路径 ----
  function submitViaWorker(endpoint, body, resolve) {
    var worker;
    var settled = false;
    var timer;

    try {
      worker = new Worker(WORKER_URL);
    } catch (e) {
      console.warn('[Leaderboard] Worker 构造失败，降级为 fetch:', e);
      submitViaFetch(endpoint, body, resolve);
      return;
    }

    var cleanup = function () {
      if (timer) clearTimeout(timer);
      if (worker) try { worker.terminate(); } catch (_) {}
    };

    timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      cleanup();
      console.warn('[Leaderboard] worker timeout after', TIMEOUT_MS, 'ms');
      resolve({ ok: false, error: 'timeout' });
    }, TIMEOUT_MS);

    worker.onmessage = function (ev) {
      if (settled) return;
      settled = true;
      cleanup();
      var msg = ev && ev.data || {};
      resolve({
        ok: !!msg.ok,
        status: msg.status,
        body: msg.body,
        error: msg.error
      });
    };

    worker.onerror = function (ev) {
      if (settled) return;
      settled = true;
      cleanup();
      console.warn('[Leaderboard] worker error:', ev && ev.message);
      resolve({ ok: false, error: 'worker_error' });
    };

    worker.postMessage({ endpoint: endpoint, body: body });
  }

  // ---- 主线程 fetch 降级路径 ----
  function submitViaFetch(endpoint, body, resolve) {
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer;

    if (controller) {
      timer = setTimeout(function () {
        try { controller.abort(); } catch (_) {}
      }, TIMEOUT_MS);
    }

    var opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      mode: 'cors',
      credentials: 'omit',
      keepalive: true
    };
    if (controller) opts.signal = controller.signal;

    fetch(endpoint, opts)
      .then(function (resp) {
        if (timer) clearTimeout(timer);
        return resp.text().then(function (text) {
          var parsed = null;
          try { parsed = text ? JSON.parse(text) : null; } catch (_) {}
          resolve({ ok: resp.ok, status: resp.status, body: parsed });
        });
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        console.warn('[Leaderboard] fetch failed:', err && err.message);
        resolve({ ok: false, error: String(err && err.message || err) });
      });
  }

  // ---- payload 净化：丢弃 undefined / 函数 / 超长字符串；保留 T5.2 Bitable 字段 ----
  function sanitizePayload(p) {
    var p2 = p || {};
    var out = {
      player:        str(p2.player, 64),
      buildHash:     str(p2.buildHash, 64),
      score:         num(p2.score),
      floor:         num(p2.floor),
      goldRemaining: num(p2.goldRemaining),
      itemsBroughtOut: arr(p2.itemsBroughtOut, 32),
      itemsLost:       arr(p2.itemsLost, 64),
      ending:        str(p2.ending, 32),
      classId:       str(p2.classId, 32),
      submittedAt:   str(p2.submittedAt || new Date().toISOString(), 32)
    };
    return out;
  }
  function str(v, max) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    return s.length > max ? s.slice(0, max) : s;
  }
  function num(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }
  function arr(v, max) {
    if (!Array.isArray(v)) return [];
    if (v.length <= max) return v.slice();
    return v.slice(0, max);
  }

  // ---- 暴露 ----
  root.Leaderboard = {
    submitRun: submitRun,
    WORKER_URL: WORKER_URL,
    TIMEOUT_MS: TIMEOUT_MS
  };
})();