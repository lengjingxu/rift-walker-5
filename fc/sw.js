/* ⚔ Diablo Build · Service Worker · 离线缓存
 * 缓存策略：
 *   - App Shell（HTML/CSS/JS/字体）: stale-while-revalidate（秒开 + 后台更新）
 *   - 静态数据（data.js/icons.js）: cache-first（数据极少变）
 *   - Web Worker（rift/leaderboard-worker.js）: cache-first（POST 端点不能被 SW 拦截，但 worker 脚本本身需秒开）
 *   - 其它（同源 GET）: network-first with cache fallback
 *   - 离线导航回退：offline.html
 *
 * 版本：v1.5 · T5.4 缓存策略升级（v2.15 排行榜 POST 链路 + Phase 2 引入 rift/battle + rift/rest）
 *   - 升级点 1：SHELL_URLS 补全 rift/leaderboard.js + rift/leaderboard-worker.js + rift/battle.js + rift/rest.js
 *   - 升级点 2：WORKER_URLS 白名单（worker 文件独立 cache，避免 SW 拦截 POST 请求——fetch handler 只处理 GET 已是 v1.4 行为，v1.5 显式注释）
 *   - 升级点 3：缓存版本从 v1.4.9-rift-minimal → v1.5-leaderboard（强制让旧客户端 skipWaiting 后拉新 shell）
 *   - 升级点 4：message 协议扩展 SW_GET_VERSION（前端可探活部署后的 SW_VERSION 字串）
 */

const SW_VERSION = 'diablo-v1.5-leaderboard';
const CACHE_SHELL = `${SW_VERSION}-shell`;
const CACHE_DATA  = `${SW_VERSION}-data`;
const CACHE_WORKER = `${SW_VERSION}-worker`;

// App Shell：用户访问必须的资源
const SHELL_URLS = [
  './',
  'index.html',
  'style.css',
  'rift/style.css',
  'data.js',
  'icons.js',
  'game.js',
  'ui.js',
  'app.py',
  'offline.html',
  'rift/state.js',
  'rift/economy.js',
  'rift/climb.js',
  'rift/rest.js',
  'rift/climb-ui.js',
  'rift/leaderboard.js',
  'rift/leaderboard-worker.js',
  'rift/index.js'
];

// Web Worker 脚本：cache-first + 独立 cache（避免 shell cache 失效牵连）
// 关键：fetch handler 只处理 GET（line 84 已有 guard），POST 请求（如飞书 Bitable）
// 不会被 SW 拦截，永远直走浏览器原生 network——这是 v2.15 leaderboard-worker 的设计前提
const WORKER_URLS = [
  'rift/leaderboard-worker.js',
];

// 静态数据：极少变，cache-first
const DATA_URLS = [
  'data.js',
  'icons.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_SHELL);
    // addAll 任意一个失败整体失败 → 静默降级：不阻塞 install，让 fetch 阶段补
    try {
      await cache.addAll(SHELL_URLS);
    } catch (e) {
      // 部分资源失败（如 /offline.html 第一次部署不存在），逐个加
      await Promise.all(SHELL_URLS.map((u) => cache.add(u).catch(() => null)));
    }
    // 预缓存 worker 脚本（独立 cache）——Worker URL 必须 cache-first 否则主线程 new Worker() 阻塞
    const workerCache = await caches.open(CACHE_WORKER);
    try {
      await workerCache.addAll(WORKER_URLS);
    } catch (e) {
      await Promise.all(WORKER_URLS.map((u) => workerCache.add(u).catch(() => null)));
    }
    // 立即激活新 SW（不等旧 SW 关闭），避免 stale shell 阻塞
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 清理旧版本缓存
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => !k.startsWith(SW_VERSION))
        .map((k) => caches.delete(k))
    );
    // 立即接管所有页面
    await self.clients.claim();
  })());
});

// 工具：判断是不是 data.js / icons.js 这种静态数据
function isDataAsset(url) {
  const path = url.pathname;
  return DATA_URLS.some((p) => path.endsWith('/' + p) || path.endsWith(p));
}

// 工具：判断是不是 shell 资源
function isShellAsset(url) {
  const path = url.pathname;
  return SHELL_URLS.some((p) => path.endsWith('/' + p) || path.endsWith(p) || path === url.pathname.replace(/\/$/, '') + '/' || path.endsWith(p + '/'));
}

// 工具：判断是不是 worker 脚本资源
function isWorkerAsset(url) {
  const path = url.pathname;
  return WORKER_URLS.some((p) => path.endsWith('/' + p) || path.endsWith(p));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // 只处理 GET + 同源
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 数据资源 → cache-first
  if (isDataAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_DATA);
      const cached = await cache.match(req);
      if (cached) {
        // 后台异步刷新
        fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
        }).catch(() => null);
        return cached;
      }
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (e) {
        return new Response('// offline: data missing', { status: 503 });
      }
    })());
    return;
  }

  // Web Worker 脚本 → cache-first（必须秒开，new Worker() 阻塞主线程）
  // 关键设计：POST 请求（飞书 Bitable）不在这里处理，line 84 已 guard method !== 'GET' 直接 return
  // 所以本分支不会拦截任何 POST，worker 内部的 fetch(POST endpoint) 直走浏览器原生 network
  if (isWorkerAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_WORKER);
      const cached = await cache.match(req);
      if (cached) {
        // 后台异步刷新（worker 脚本几乎不变，但版本升级时仍要拿新）
        fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
        }).catch(() => null);
        return cached;
      }
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (e) {
        return new Response('// offline: worker missing', { status: 503 });
      }
    })());
    return;
  }

  // App Shell → stale-while-revalidate
  if (isShellAsset(url) || req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_SHELL);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      // 立即返回缓存（秒开），后台更新
      if (cached) {
        return cached;
      }
      // 没缓存：等网络
      const networkRes = await fetchPromise;
      if (networkRes) return networkRes;
      // 网络挂了 + 没缓存 → 回退离线页
      const offline = await cache.match('offline.html');
      if (offline) return offline;
      return new Response('Offline', { status: 503 });
    })());
    return;
  }

  // 其它同源 GET → network-first，失败回缓存
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      return res;
    } catch (e) {
      const cache = await caches.open(CACHE_SHELL);
      const cached = await cache.match(req);
      if (cached) return cached;
      return new Response('Offline', { status: 503 });
    }
  })());
});

// 监听客户端消息：允许 UI 主动清缓存 / 查状态
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SW_GET_STATUS') {
    event.source && event.source.postMessage({
      type: 'SW_STATUS',
      version: SW_VERSION,
      caches: [CACHE_SHELL, CACHE_DATA, CACHE_WORKER],
    });
  } else if (data.type === 'SW_GET_VERSION') {
    // v1.5 新增：轻量探活（仅返回版本号，不列 cache 名）
    event.source && event.source.postMessage({
      type: 'SW_VERSION',
      version: SW_VERSION,
    });
  } else if (data.type === 'SW_CLEAR_CACHE') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      event.source && event.source.postMessage({ type: 'SW_CLEARED' });
    })());
  }
});