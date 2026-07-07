// ==================== 裂隙行者 5% · 爬塔 UI 层 (v2.0) ====================
// 接管 #tab-climb 主区域。本文件自包含，挂载到 window.RiftUI
//
// 关键设计：
// 1. 不立即初始化（window.Rift 在 rift/index.js 加载后才拼好）
// 2. 等 Rift 准备好后再启动；同时监听 CLIMB tab click
// 3. 重入保护（同一个 tab 多次点击不要重新清空）
// 4. 右下角 DEBUG 浮窗 — 你能直接看到状态是否正常

(function () {
  'use strict';

  // ---- 防递归占位变量（避免 var hoisting + 死循环） ----
  var booted = false;

  function boot() {
    if (booted) return;
    var Rift = window.Rift;
    if (!Rift) { console.error('[Rift UI] window.Rift 仍未就绪'); return; }
    booted = true;

    var State = Rift.State, Economy = Rift.Economy, Climb = Rift.Climb;

    // ============================================================
    // 启动入口
    // ============================================================
    function initClimbTab() {
      var root = document.getElementById('tab-climb');
      if (!root) { console.error('[Rift UI] #tab-climb not found'); return; }

      // 重入保护：已初始化过只刷新状态，不要清空 modal
      if (root.getAttribute('data-rift-init') === '1') {
        renderState(root);
        return;
      }
      root.setAttribute('data-rift-init', '1');
      root.innerHTML = '';

      // 顶部标题
      var header = document.createElement('div');
      header.className = 'rift-header';
      header.innerHTML =
        '<div class="rift-title">⚔ CLIMB · 35 LAYERS · 5% PATIENCE</div>' +
        '<div class="rift-sub">// ' + (Rift.buildAt || '') + ' · v' + Rift.version + '</div>';
      root.appendChild(header);

      var saved = State.load();
      renderState(root);

      // START / RESUME 按钮
      var actions = document.createElement('div');
      actions.className = 'rift-actions';
      var resumeBtn = document.createElement('button');
      resumeBtn.className = 'btn-primary rift-resume';
      resumeBtn.textContent = saved && saved.climb.status === 'running'
        ? '↻  RESUME (' + saved.climb.floor + '/35)'
        : '▶  START NEW CLIMB';
      resumeBtn.onclick = openStartOrContinue;
      actions.appendChild(resumeBtn);
      root.appendChild(actions);

      // 终局元层（Phase 4 用）
      var metaLayer = document.createElement('div');
      metaLayer.id = 'rift-meta-layer';
      metaLayer.style.display = 'none';
      root.appendChild(metaLayer);

      console.log('[Rift UI] climb tab initialized');
    }

    // ============================================================
    // 状态卡片
    // ============================================================
    function renderState(root) {
      var old = root.querySelector('.rift-state');
      if (old) old.remove();

      var s = State.load();
      if (!s || !s.climb) return;

      var status = s.climb.status;
      var box = document.createElement('div');
      box.className = 'rift-state ' + status;
      box.innerHTML =
        '<div class="rs-row">' +
          '<span class="rs-label">RUN</span>' +
          '<span class="rs-val">' + (s.climb.runId ? s.climb.runId.slice(-6) : '------') + '</span>' +
          '<span class="rs-label">FLOOR</span>' +
          '<span class="rs-val">' + s.climb.floor + '/35</span>' +
          '<span class="rs-label">STATUS</span>' +
          '<span class="rs-val">' + status.toUpperCase() + '</span>' +
        '</div>' +
        '<div class="rs-row">' +
          '<span class="rs-label">HP</span>' +
          '<span class="rs-val">' + Math.ceil(s.player.hp) + '/' + Math.ceil(s.player.hpMax) + '</span>' +
          '<span class="rs-label">💰</span>' +
          '<span class="rs-val">' + s.player.gold + '</span>' +
          '<span class="rs-label">🩸 BRINES</span>' +
          '<span class="rs-val">' + countBrines(s.player) + '</span>' +
        '</div>' +
        '<div class="rs-row">' +
          '<span class="rs-label">⚔ DESTROYED</span>' +
          '<span class="rs-val">' + (s.choices ? s.choices.destroyed : 0) + '</span>' +
          '<span class="rs-label">✋ SPARED</span>' +
          '<span class="rs-val">' + (s.choices ? s.choices.spared : 0) + '</span>' +
        '</div>';
      root.appendChild(box);
    }

    function countBrines(player) {
      if (!player || !player.brines) return 0;
      var n = 0;
      for (var i = 0; i < player.brines.length; i++) n += player.brines[i].amount || 1;
      return n;
    }

    // ============================================================
    // 开始 / 继续 modal
    // ============================================================
    function openStartOrContinue() {
      var s = State.load();
      if (s && s.climb.status === 'running') {
        openFloor(s.climb.floor);
        return;
      }

      var classes = (window.DATA && window.DATA.classes) || [];
      var opts = '';
      for (var i = 0; i < classes.length; i++) {
        var c = classes[i];
        opts += '<option value="' + c.id + '">' + (c.name || c.id) + '</option>';
      }

      var html =
        '<div class="rift-modal-backdrop" style="display:flex">' +
          '<div class="lore-content">' +
            '<div class="lore-name">▶ START NEW CLIMB</div>' +
            '<div class="lore-sub">// 35 LAYERS · 经济可崩溃 · 命题反思</div>' +
            '<div style="margin: 14px 0;">' +
              '<label class="rift-pick-label">// 选择职业:&nbsp;</label>' +
              '<select id="rift-class-pick" class="recommend-select" style="width: 220px;">' + opts + '</select>' +
            '</div>' +
            '<div class="lore-body" style="font-size: 11px;">— 每次开始 = 5 血瓶 + 80 金币<br>— 每 10 层免费补给 1 个血瓶（Q5）<br>— 通关或死亡 → 飞书排行榜</div>' +
            '<div style="display:flex; gap:8px; margin-top:14px;">' +
              '<button class="btn-primary" id="rift-start-confirm">⚔ ENTER</button>' +
              '<button class="btn-small" id="rift-start-cancel">[ CANCEL ]</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      var backdrop = document.createElement('div');
      backdrop.className = 'rift-modal-shell';
      backdrop.innerHTML = html;
      document.body.appendChild(backdrop);

      backdrop.querySelector('#rift-start-cancel').onclick = function () {
        document.body.removeChild(backdrop);
      };
      backdrop.querySelector('#rift-start-confirm').onclick = function () {
        var cls = backdrop.querySelector('#rift-class-pick').value;
        State.newRun(cls, 80, 5);
        document.body.removeChild(backdrop);
        initClimbTab();
        openFloor(State.load().climb.floor);
      };
    }

    // ============================================================
    // 进入一层
    // ============================================================
    function openFloor(floor) {
      var s = State.load();
      var isBoss = Climb.isBossFloor(floor);

      // Q5：每 10 层免费血瓶
      if ([10, 20, 30].indexOf(floor) >= 0 && s && s.player) {
        addFreeBrine(s, 1);
        State.save(s);
      }

      var monster = Climb.spawnMonsterForFloor(floor);
      var bcs = Climb.showContinueModal(s);
      var winPct = Climb.getContinueProbability(s, monster);

      var monsterCard =
        '<div class="rift-monster-card rift-tier-' + (isBoss ? 'boss' : (monster.tier || 'normal')) + '">' +
          '<div class="rift-monster-name">' + monster.name + (isBoss ? ' · BOSS' : '') + '</div>' +
          '<div class="rift-monster-stat">' +
            '<span>HP</span><b>' + monster.hp + '</b>' +
            '<span>AC</span><b>' + monster.ac + '</b>' +
            '<span>DMG</span><b>' + monster.dmg + '</b>' +
            (monster.elem ? '<span>ELEM</span><b>' + monster.elem + '</b>' : '') +
          '</div>' +
        '</div>';

      var actionHtml;
      if (isBoss && monster.moralChoice) {
        actionHtml = '<button class="btn-primary rift-action-boss">⚔ BEGIN BOSS FIGHT</button>';
      } else {
        actionHtml =
          '<button class="btn-primary rift-action-fight">⚔ FIGHT</button>' +
          '<button class="btn-small rift-action-retreat">↩ RETREAT</button>';
      }

      var html =
        '<div class="rift-modal-backdrop" style="display:flex">' +
          '<div class="lore-content" style="max-width: 520px;">' +
            '<div class="lore-name">FLOOR ' + floor + '/35' + (isBoss ? ' · BOSS GATE' : '') + '</div>' +
            '<div class="lore-sub">// ' + (monster.tier || 'monster') + ' · HP ' + monster.hp + ' · DMG ' + monster.dmg + '</div>' +
            monsterCard +
            '<div class="rift-win-bar">' +
              '<span class="rift-win-label">WIN%</span>' +
              '<span class="rift-win-pct" style="color:' + winPctColor(winPct) + '">' + winPct.toFixed(1) + '%</span>' +
            '</div>' +
            '<div style="display:flex; gap:8px; margin-top:14px;">' + actionHtml + '</div>' +
          '</div>' +
        '</div>';

      var backdrop = document.createElement('div');
      backdrop.className = 'rift-modal-shell';
      backdrop.innerHTML = html;
      document.body.appendChild(backdrop);

      backdrop.querySelector('.rift-action-fight').onclick = function () {
        document.body.removeChild(backdrop);
        runBattleAndDecide(monster, false);
      };
      var rb = backdrop.querySelector('.rift-action-retreat');
      if (rb) rb.onclick = function () {
        if (!window.confirm('确认撤退？')) return;
        document.body.removeChild(backdrop);
        State.retreat();
        showDeathModal(false);
      };
      var bb = backdrop.querySelector('.rift-action-boss');
      if (bb) bb.onclick = function () {
        document.body.removeChild(backdrop);
        promptMoralChoiceThenBoss(monster);
      };
    }

    function winPctColor(p) {
      if (p >= 70) return 'var(--gold-bright)';
      if (p >= 40) return '#ddaa33';
      return '#e74c3c';
    }

    // ============================================================
    // Boss 战：先道德选择
    // ============================================================
    function promptMoralChoiceThenBoss(boss) {
      var mc = Climb.showMoralChoice(boss.id);
      var html =
        '<div class="rift-modal-backdrop" style="display:flex">' +
          '<div class="lore-content" style="max-width:520px;">' +
            '<div class="lore-name">' + mc.bossName + '</div>' +
            '<div class="lore-sub">// ' + mc.theme + '</div>' +
            '<pre class="lore-body">' + (boss.lore || boss.theme || '') + '</pre>' +
            '<div style="display:flex; gap:14px; margin-top:14px;">' +
              '<button class="btn-primary" id="rift-moral-a">' + mc.choiceA.label + '</button>' +
              '<button class="btn-small" id="rift-moral-b">' + mc.choiceB.label + '</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      var backdrop = document.createElement('div');
      backdrop.className = 'rift-modal-shell';
      backdrop.innerHTML = html;
      document.body.appendChild(backdrop);

      backdrop.querySelector('#rift-moral-a').onclick = function () {
        State.setChoice('destroyed');
        document.body.removeChild(backdrop);
        runBattleAndDecide(boss, true);
      };
      backdrop.querySelector('#rift-moral-b').onclick = function () {
        State.setChoice('spared');
        document.body.removeChild(backdrop);
        runBattleAndDecide(boss, true);
      };
    }

    // ============================================================
    // 跑一场战斗 + 后续 modal
    // ============================================================
    function runBattleAndDecide(monster, isBoss) {
      var s = State.load();
      var result = State.simulateRiftBattle(monster);
      var won = result && result.win;

      if (won) {
        var reward = Economy.calculateTileReward(s.climb.floor);
        s.player.gold += reward.gold;
        if (reward.brines) addFreeBrine(s, reward.brines);
        State.save(s);
        showBattleResult(true, isBoss, monster, reward);
      } else {
        State.die('defeated by ' + monster.name);
        showDeathModal(true);
      }
    }

    function showBattleResult(won, isBoss, monster, reward) {
      var s = State.load();
      var isFinalBossFloor = s.climb.floor === 35;

      if (isFinalBossFloor) {
        State.advanceFloor();
        showMetaLayer();
        return;
      }

      State.advanceFloor();

      var html =
        '<div class="rift-modal-backdrop" style="display:flex">' +
          '<div class="lore-content">' +
            '<div class="lore-name">⚔ VICTORY · ' + monster.name + '</div>' +
            '<div class="lore-sub">// ' + (isBoss ? 'BOSS GATE CLEARED' : 'combat won') + '</div>' +
            '<div class="lore-body" style="font-size: 11px;">' +
              '🏆 Rewards: +' + reward.gold + ' gold' + (reward.brines ? ' · +' + reward.brines + ' 🩸' : '') +
              (reward.itemRarity ? ' · loot ' + reward.itemRarity : '') +
            '</div>' +
            '<div style="display:flex; gap:8px; margin-top:14px;">' +
              '<button class="btn-primary" id="rift-go-next">▶ CONTINUE → FLOOR ' + (s.climb.floor + 1) + '</button>' +
              '<button class="btn-small" id="rift-stop-climb">↩ END CLIMB NOW</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      var backdrop = document.createElement('div');
      backdrop.className = 'rift-modal-shell';
      backdrop.innerHTML = html;
      document.body.appendChild(backdrop);

      backdrop.querySelector('#rift-go-next').onclick = function () {
        document.body.removeChild(backdrop);
        initClimbTab();
        openFloor(State.load().climb.floor);
      };
      backdrop.querySelector('#rift-stop-climb').onclick = function () {
        document.body.removeChild(backdrop);
        State.retreat();
        showDeathModal(false);
      };
    }

    // ============================================================
    // 死亡 / 退场结算
    // ============================================================
    function showDeathModal(isDeath) {
      var s = State.load();
      var loot = Climb.calculateDeathLoot(s);

      var itemsTable =
        '<table class="rift-loot">' +
          '<tr><th>带出</th><th>失去</th></tr>' +
          '<tr>' +
            '<td><b class="rift-brought">' + loot.broughtOut.length + '</b> 件装备<br>· 金币 <b>' + loot.goldRemaining + '</b></td>' +
            '<td><b class="rift-lost">' + loot.lost.length + '</b> 件装备</td>' +
          '</tr>' +
          '<tr>' +
            '<td colspan="2" style="font-size:10px; color:var(--text-dim); padding-top:8px;">' +
              '(Q11) 不显示分数。装备与金币 = 你带出 / 失去的一切。' +
            '</td>' +
          '</tr>' +
        '</table>';

      var title = isDeath ? '💀 YOU DIED' : '↩ YOU RETREATED';

      var html =
        '<div class="rift-modal-backdrop" style="display:flex">' +
          '<div class="lore-content" style="max-width:480px;">' +
            '<div class="lore-name">' + title + '</div>' +
            '<div class="lore-sub">// 楼层 ' + loot.floorReached + '/35 · 道德: ' + loot.moralSummary + '</div>' +
            itemsTable +
            '<div style="display:flex; gap:8px; margin-top:14px;">' +
              '<button class="btn-primary" id="rift-new-climb">▶ START NEW</button>' +
              '<button class="btn-small" id="rift-close-death">[ CLOSE ]</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      var backdrop = document.createElement('div');
      backdrop.className = 'rift-modal-shell';
      backdrop.innerHTML = html;
      document.body.appendChild(backdrop);

      backdrop.querySelector('#rift-close-death').onclick = function () {
        document.body.removeChild(backdrop);
        initClimbTab();
      };
      backdrop.querySelector('#rift-new-climb').onclick = function () {
        document.body.removeChild(backdrop);
        openStartOrContinue();
      };
    }

    // ============================================================
    // 终局元层（Phase 4 用，先放个 placeholder）
    // ============================================================
    function showMetaLayer() {
      var box = document.getElementById('rift-meta-layer');
      if (!box) return;
      box.style.display = '';
      box.innerHTML =
        '<div class="rift-meta-glitch">' +
          '<div class="rift-meta-text">' +
            '> 测试主体 #LJX-001<br>' +
            '> 攻防演练评估: 进行中<br><br>' +
            '> 你并不在反抗 Trinity。<br>' +
            '> Trinity 在测试你。' +
          '</div>' +
        '</div>';
    }

    // ============================================================
    // 辅助
    // ============================================================
    function addFreeBrine(s, amount) {
      if (!s.player.brines) s.player.brines = [];
      s.player.brines.push({ id: 'free-' + Date.now(), amount: amount });
    }

    // ============================================================
    // 导出口
    // ============================================================
    window.RiftUI = {
      init: initClimbTab,
      openStart: openStartOrContinue,
      openFloor: openFloor,
      showMetaLayer: showMetaLayer,
      _debug: { booted: true, hasState: typeof State, hasClimb: typeof Climb }
    };

    // ---- 启动！----
    // 1. 监听 CLIMB tab click（老 ui.js 的 switchTab 切到 climb 时不会主动调我们）
    document.addEventListener('click', function (e) {
      var t = e.target;
      var btn = t && t.closest && t.closest('button.tab[data-tab="climb"]');
      if (btn) setTimeout(initClimbTab, 0);
    });

    // 2. 如果页面已经加载完（DOMContentLoaded 已过），现在立刻初始化
    if (document.readyState !== 'loading') {
      initClimbTab();
    } else {
      document.addEventListener('DOMContentLoaded', initClimbTab);
    }

    // 3. 右下角 debug 浮窗（帮你看清初始化是否到位）
    var d = document.createElement('div');
    d.id = 'rift-debug-widget';
    d.style.cssText = 'position:fixed; bottom:10px; right:10px; z-index:99999; background:rgba(0,0,0,0.85); color:#ffcc44; font:11px monospace; padding:8px 12px; border:1px solid #ffcc44; line-height:1.5; white-space:pre; cursor:move; user-select:none;';
    d.textContent = '⚔ RIFT loading...';
    document.body.appendChild(d);
    function refreshDebug() {
      var root = document.getElementById('tab-climb');
      var btn = document.querySelector('.rift-resume');
      d.textContent =
        '⚔ RIFT DEBUG\n' +
        'Rift ver: ' + (window.Rift ? window.Rift.version : 'NOT-LOADED') + '\n' +
        'tab-climb div: ' + (root ? 'YES' : 'NO') + '\n' +
        'initialized: ' + (root && root.getAttribute('data-rift-init')) + '\n' +
        'start btn: ' + (btn ? 'YES' : 'NO') + '\n' +
        'state.climb: ' + (State && State.load() && State.load().climb.status || 'none');
    }
    refreshDebug();
    setInterval(refreshDebug, 2000);
  }

  // ---- 等 Rift 拼好后再启动 boot（不阻塞 IIFE 退出）----
  function waitRift(attempt) {
    attempt = attempt || 0;
    if (window.Rift) { boot(); return; }
    if (attempt > 80) { console.error('[Rift UI] window.Rift 4s 内未就绪'); return; }
    setTimeout(function () { waitRift(attempt + 1); }, 50);
  }
  waitRift();
})();
