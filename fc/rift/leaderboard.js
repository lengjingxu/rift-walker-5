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

  // ---- T5.3: GET 拉排行榜 ----
  // 与 POST 一样走 LEADERBOARD_ENDPOINT（同一端点 /api/leaderboard，method 不同）。
  // best-effort：失败 resolve { ok:false, error }，不 reject。
  // 默认 limit=50，由 FC MAX_LEADERBOARD_LIMIT=100 兜底。
  function fetchTop(limit) {
    return new Promise(function (resolve) {
      try {
        var endpoint = root.LEADERBOARD_ENDPOINT || '';
        if (!endpoint) {
          resolve({ ok: false, error: 'no_endpoint' });
          return;
        }
        var lim = (typeof limit === 'number' && isFinite(limit) && limit > 0) ? Math.min(100, limit) : 50;
        // endpoint 已经包含 /api/leaderboard，加 ?limit=N
        var sep = endpoint.indexOf('?') >= 0 ? '&' : '?';
        var url = endpoint + sep + 'limit=' + lim;

        var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var timer;
        if (controller) {
          timer = setTimeout(function () { try { controller.abort(); } catch (_) {} }, TIMEOUT_MS);
        }
        var opts = { method: 'GET', headers: { 'Accept': 'application/json' }, mode: 'cors', credentials: 'omit', cache: 'no-store' };
        if (controller) opts.signal = controller.signal;

        fetch(url, opts)
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
            console.warn('[Leaderboard] fetchTop failed:', err && err.message);
            resolve({ ok: false, error: String(err && err.message || err) });
          });
      } catch (err) {
        console.warn('[Leaderboard] fetchTop exception:', err);
        resolve({ ok: false, error: String(err && err.message || err) });
      }
    });
  }

  // ---- T5.3: 渲染表格（vanilla DOM，5 列 + 排名）----
  // 输入：body.items 数组（每项含 player / score / floor / ending / classId / submittedAt）
  // 输出：把 #lb-table tbody 填满；空态显示"暂无记录"
  function renderTable(container, body) {
    if (!container) return;
    var tbody = container.querySelector('tbody') || container;
    // 清空（保留 thead）
    var existing = container.querySelectorAll('tbody tr');
    for (var i = 0; i < existing.length; i++) existing[i].parentNode.removeChild(existing[i]);

    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      var empty = document.createElement('tr');
      empty.className = 'lb-empty';
      var td = document.createElement('td');
      td.colSpan = 7;
      td.textContent = '暂无记录 · 第一个冲榜的人就是你';
      empty.appendChild(td);
      (container.querySelector('tbody') || container.appendChild(document.createElement('tbody'))).appendChild(empty);
      return;
    }

    var tbodyEl = container.querySelector('tbody') || (function () {
      var t = document.createElement('tbody');
      container.appendChild(t);
      return t;
    })();

    for (var j = 0; j < body.items.length; j++) {
      var r = body.items[j];
      var tr = document.createElement('tr');
      var cells = [
        '#' + (j + 1),                                 // rank
        esc(r.player || 'anonymous'),                  // player
        String(r.score != null ? r.score : 0),         // score
        (r.floor != null ? r.floor : 0) + 'F',         // floor
        esc(endingLabel(r.ending)),                    // ending
        esc(classLabel(r.classId)),                    // class
        formatTime(r.submittedAt)                      // submittedAt
      ];
      for (var k = 0; k < cells.length; k++) {
        var td2 = document.createElement('td');
        td2.textContent = cells[k];
        tr.appendChild(td2);
      }
      tbodyEl.appendChild(tr);
    }
  }

  // ---- T5.3: 渲染辅助 ----
  function endingLabel(e) {
    var map = {
      'A_Rebel':      'A·叛逆',
      'B_Inheritor':  'B·继承',
      'C_Glitched':   'C·崩坏',
      'died':         '死亡',
      'retreated':    '撤退'
    };
    return map[e] || (e || '-');
  }
  function classLabel(c) {
    var map = {
      'paladin':      '圣骑士',
      'barbarian':    '野蛮人',
      'sorceress':    '女巫',
      'necromancer':  '死灵',
      'druid':        '德鲁伊',
      'assassin':     '刺客'
    };
    return map[c] || (c || '-');
  }
  function formatTime(s) {
    if (!s) return '-';
    // submittedAt 来自 FC，可能是 ms 数字字符串（feishu datetime cell），
    // 也可能是 ISO string。
    var n = Number(s);
    var d;
    if (isFinite(n) && n > 1000000000) {
      // ms 数字
      d = new Date(n < 1e12 ? n * 1000 : n);
    } else {
      d = new Date(String(s));
    }
    if (isNaN(d.getTime())) return String(s);
    var pad = function (x) { return x < 10 ? '0' + x : '' + x; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---- 暴露 ----
  root.Leaderboard = {
    submitRun: submitRun,
    fetchTop: fetchTop,
    renderTable: renderTable,
    WORKER_URL: WORKER_URL,
    TIMEOUT_MS: TIMEOUT_MS
  };
})();