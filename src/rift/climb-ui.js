// ==================== 裂隙行者 5% · 爬塔 UI 层 ====================
// 接管 #tab-climb 主区域。读取 window.Rift.State/Economy/Climb 渲染。
// 不动现有 5 tab。

(function () {
  'use strict';

  var Rift = window.Rift;
  if (!Rift) {
    console.error('[Rift UI] window.Rift not ready — make sure rift/index.js is loaded last');
    return;
  }
  var State = Rift.State, Economy = Rift.Economy, Climb = Rift.Climb;

  // ============================================================
  // 启动入口
  // ============================================================
  function initClimbTab() {
    var root = document.getElementById('tab-climb');
    if (!root) return;
    root.innerHTML = '';  // 清空

    // 顶部标题条 + 状态
    var header = document.createElement('div');
    header.className = 'rift-header';
    header.innerHTML =
      '<div class="rift-title">⚔ CLIMB · 35 LAYERS · 5% PATIENCE</div>' +
      '<div class="rift-sub">// ' + (Rift.buildAt || '') + ' · v' + Rift.version + '</div>';
    root.appendChild(header);

    var state = State.load();
    renderState(root);

    // 绑定 resume / newRun 按钮
    var actions = document.createElement('div');
    actions.className = 'rift-actions';
    var resumeBtn = document.createElement('button');
    resumeBtn.className = 'btn-primary rift-resume';
    resumeBtn.textContent = state && state.climb.status === 'running'
      ? '↻  RESUME (' + state.climb.floor + '/35)'
      : '▶  START NEW CLIMB';
    resumeBtn.onclick = function () { openStartOrContinue(); };
    actions.appendChild(resumeBtn);
    root.appendChild(actions);

    // 元层揭示隐藏（Phase 4 用）
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
    if (!s || !s.climb) return;  // 没有进行中游戏，不显示

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

    // 新爬塔：选职业
    var classes = (window.DATA && window.DATA.classes) || [];
    var opts = '';
    for (var i = 0; i < classes.length; i++) {
      var c = classes[i];
      opts += '<option value="' + c.id + '">' + (c.name || c.id) + '</option>';
    }

    var html =
      '<div class="lore-modal" style="display:flex">' +
        '<div class="lore-content">' +
          '<div class="lore-name">▶ START NEW CLIMB</div>' +
          '<div class="lore-sub">// 35 LAYERS · 经济可崩溃 · 命题反思</div>' +
          '<div style="margin: 14px 0;">' +
            '<label class="rift-pick-label">// 选择职业:&nbsp;</label>' +
            '<select id="rift-class-pick" class="recommend-select" style="width: 220px;">' + opts + '</select>' +
          '</div>' +
          '<div class="lore-body" style="font-size: 11px;">— 每次开始 = 5 血瓶 + 80 金币（普通符文包）<br>— 每 10 层免费补给 1 个血瓶（Q5）<br>— 通关或死亡 → 飞书排行榜</div>' +
          '<div style="display:flex; gap:8px; margin-top:14px;">' +
            '<button class="btn-primary" id="rift-start-confirm">⚔ ENTER</button>' +
            '<button class="btn-small" id="rift-start-cancel">[ CANCEL ]</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    var backdrop = document.createElement('div');
    backdrop.className = 'rift-modal-backdrop';
    backdrop.innerHTML = html;
    document.body.appendChild(backdrop);

    backdrop.querySelector('#rift-start-cancel').onclick = function () {
      document.body.removeChild(backdrop);
    };
    backdrop.querySelector('#rift-start-confirm').onclick = function () {
      var cls = backdrop.querySelector('#rift-class-pick').value;
      State.newRun(cls, 80, 5);
      document.body.removeChild(backdrop);
      // 重新渲染
      initClimbTab();
      openFloor(State.load().climb.floor);
    };
  }

  // ============================================================
  // 进入一层（中心显示）
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

    var monsterCard = renderMonsterCard(monster, isBoss);

    var actionHtml;
    if (isBoss && monster.moralChoice) {
      // Boss 战：先道德选择
      actionHtml = '<button class="btn-primary rift-action-boss">⚔ BEGIN BOSS FIGHT</button>';
    } else {
      actionHtml =
        '<button class="btn-primary rift-action-fight">⚔ FIGHT</button>' +
        '<button class="btn-small rift-action-retreat">↩ RETREAT</button>';
    }

    var winPct = Climb.getContinueProbability(s.player, monster);

    var html =
      '<div class="rift-floor-modal" style="display:flex">' +
        '<div class="lore-content" style="max-width: 520px;">' +
          '<div class="lore-name">FLOOR ' + floor + '/35' + (isBoss ? ' · BOSS GATE' : '') + '</div>' +
          '<div class="lore-sub">// ' + (monster.tier || 'monster') + ' · HP ' + monster.hp + ' · DMG ' + monster.dmg + '</div>' +
          monsterCard +
          '<div class="rift-win-bar">' +
            '<span class="rift-win-label">WIN%</span>' +
            '<span class="rift-win-pct" style="color:' + winPctColor(winPct) + '">' + winPct.toFixed(1) + '%</span>' +
          '</div>' +
          '<div style="display:flex; gap:8px; margin-top:14px;">' +
            actionHtml +
          '</div>' +
        '</div>' +
      '</div>';
    var backdrop = document.createElement('div');
    backdrop.className = 'rift-modal-backdrop';
    backdrop.innerHTML = html;
    document.body.appendChild(backdrop);

    backdrop.querySelector('.rift-action-fight').onclick = function () {
      document.body.removeChild(backdrop);
      runBattleAndDecide(monster, false);
    };
    var rb = backdrop.querySelector('.rift-action-retreat');
    if (rb) rb.onclick = function () {
      if (!confirm('确认撤退？你能带出当前已得装备与金币，但放弃本层奖励。')) return;
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
  // Boss 战：先道德选择，再战斗
  // ============================================================
  function promptMoralChoiceThenBoss(boss) {
    var mc = Climb.showMoralChoice(boss.id);

    var html =
      '<div class="lore-modal" style="display:flex">' +
        '<div class="lore-content" style="max-width:520px;">' +
          '<div class="lore-name">' + mc.bossName + '</div>' +
          '<div class="lore-sub">// ' + mc.theme + '</div>' +
          '<pre class="lore-body">' + (boss.lore || boss.theme || 'Trinity has no face. Trinity has only decisions.') + '</pre>' +
          '<div style="display:flex; gap:14px; margin-top:14px;">' +
            '<button class="btn-primary" id="rift-moral-a">' + mc.choiceA.label + '</button>' +
            '<button class="btn-small" id="rift-moral-b">' + mc.choiceB.label + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    var backdrop = document.createElement('div');
    backdrop.className = 'rift-modal-backdrop';
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
      // 胜：拿奖励
      var reward = Economy.calculateTileReward(s.climb.floor);
      s.player.gold += reward.gold;
      // 血瓶若掉
      if (reward.brines) addFreeBrine(s, reward.brines);
      State.save(s);

      // 文案
      showBattleResult(true, isBoss, monster, reward);
    } else {
      // 负：死亡结算
      State.die('defeated by ' + monster.name);
      showDeathModal(true);
    }
  }

  function showBattleResult(won, isBoss, monster, reward) {
    var s = State.load();
    var isFinalBossFloor = s.climb.floor === 35;

    if (isFinalBossFloor) {
      // 终局：直接走元层翻转
      State.advanceFloor();  // floor=36 触发 won
      showMetaLayer();
      return;
    }

    State.advanceFloor();

    var html =
      '<div class="lore-modal" style="display:flex">' +
        '<div class="lore-content">' +
          '<div class="lore-name">⚔ VICTORY · ' + monster.name + '</div>' +
          '<div class="lore-sub">// ' + (isBoss ? 'BOSS GATE CLEARED' : 'combat won') + '</div>' +
          '<div class="lore-body" style="font-size: 11px;">' +
            '🏆 Rewards: +' + reward.gold + ' gold · ' + (reward.brines ? '+'+reward.brines+' 🩸 ' : '') +
            (reward.itemRarity ? '· loot ' + reward.itemRarity : '') +
          '</div>' +
          '<div style="display:flex; gap:8px; margin-top:14px;">' +
            '<button class="btn-primary" id="rift-go-next">▶ CONTINUE → FLOOR ' + (s.climb.floor + 1) + '</button>' +
            '<button class="btn-small" id="rift-stop-climb">↩ END CLIMB NOW</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    var backdrop = document.createElement('div');
    backdrop.className = 'rift-modal-backdrop';
    backdrop.innerHTML = html;
    document.body.appendChild(backdrop);

    backdrop.querySelector('#rift-go-next').onclick = function () {
      document.body.removeChild(backdrop);
      initClimbTab();  // 刷新右上状态
      openFloor(State.load().climb.floor);
    };
    backdrop.querySelector('#rift-stop-climb').onclick = function () {
      document.body.removeChild(backdrop);
      State.retreat();
      showDeathModal(false);
    };
  }

  // ============================================================
  // 死亡 / 退场结算 modal
  // ============================================================
  function showDeathModal(isDeath) {
    var s = State.load();
    var loot = Climb.calculateDeathLoot(s);

    // 飞书排行榜异步提交
    submitLeaderboard(s, isDeath ? 'died' : 'retreated');

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
      '<div class="lore-modal" style="display:flex">' +
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
    backdrop.className = 'rift-modal-backdrop';
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
  // 飞书排行榜提交（异步、不阻塞）
  // ============================================================
  function submitLeaderboard(s, cause) {
    try {
      var payload = {
        runId: s.climb.runId,
        floor: s.climb.floor,
        status: s.climb.status,
        cause: cause,
        classId: s.player.classId,
        goldRemaining: s.player.gold,
        itemsBroughtOut: 0,
        itemsLost: 0,
        destroyed: (s.choices && s.choices.destroyed) || 0,
        spared:    (s.choices && s.choices.spared) || 0,
        ending:    s.climb.status === 'won' ? 'B_Inheritor' : 'A_Rebel',
        submittedAt: new Date().toISOString()
      };
      console.log('[Rift] leaderboard payload:', JSON.stringify(payload));
      // 真实提交在 Phase 5 阶段接 lark-cli 代理
    } catch (e) {
      console.warn('[Rift] leaderboard payload build failed:', e);
    }
  }

  // ============================================================
  // 终局元层（Phase 4 文案到位后展开）
  // ============================================================
  function showMetaLayer() {
    var box = document.getElementById('rift-meta-layer');
    if (!box) return;
    box.style.display = '';
    box.innerHTML =
      '<div class="rift-meta-glitch">' +
        '<div class="rift-meta-text">' +
          '> 测试主体 #LJX-001<br>' +
          '> 攻防演练评估: 在测试中<br><br>' +
          '> ...你并不在反抗 Trinity。<br>' +
          '> Trinity 在测试你。' +
        '</div>' +
      '</div>';
    console.log('[Rift] meta-layer shown');
  }

  // ============================================================
  // 辅助：怪物卡 / 血瓶增减
  // ============================================================
  function renderMonsterCard(m, isBoss) {
    var colorKey = isBoss ? 'boss' : m.tier;
    return (
      '<div class="rift-monster-card rift-tier-' + colorKey + '">' +
        '<div class="rift-monster-name">' + m.name + '</div>' +
        '<div class="rift-monster-stat">' +
          '<span>HP</span><b>' + m.hp + '</b>' +
          '<span>AC</span><b>' + m.ac + '</b>' +
          '<span>DMG</span><b>' + m.dmg + '</b>' +
          (m.elem ? '<span>ELEM</span><b>' + m.elem + '</b>' : '') +
        '</div>' +
      '</div>'
    );
  }

  function addFreeBrine(s, amount) {
    if (!s.player.brines) s.player.brines = [];
    s.player.brines.push({ id: 'free-' + Date.now(), amount: amount });
  }

  // ============================================================
  // 导出
  // ============================================================
  window.RiftUI = {
    init: initClimbTab,
    openStart: openStartOrContinue,
    openFloor: openFloor,
    showMetaLayer: showMetaLayer
  };

  console.log('[Rift UI] climb-ui.js loaded');
})();
