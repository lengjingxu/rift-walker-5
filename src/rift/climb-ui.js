// ==================== 裂隙行者 5% · 爬塔 UI 层 (v2.1 重做) ====================
// 用 .rift-* 新 CSS class，系统字体替代像素字体，中文 13-15px

(function () {
  'use strict';

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

      if (root.getAttribute('data-rift-init') === '1') {
        renderState(root);
        return;
      }
      root.setAttribute('data-rift-init', '1');
      root.innerHTML = '';

      var header = document.createElement('div');
      header.className = 'rift-header';
      header.innerHTML =
        '<h2 class="rift-title">⚔ 裂隙行者 5% · 爬塔</h2>' +
        '<div class="rift-sub">// CLIMB · 35 LAYERS · 5% PATIENCE · v' + (Rift.version || '?') + '</div>';
      root.appendChild(header);

      var saved = State.load();
      var status = (saved && saved.climb && saved.climb.status) || 'idle';
      renderState(root);

      var actions = document.createElement('div');
      actions.className = 'rift-actions rift-row';

      var isRunning = status === 'running';
      var primaryBtn = document.createElement('button');
      primaryBtn.className = isRunning ? 'rift-btn-primary' : 'rift-btn-primary';
      primaryBtn.textContent = isRunning
        ? '↻ RESUME · 楼层 ' + saved.climb.floor + '/35'
        : '▶ 开始爬塔';
      primaryBtn.onclick = function () {
        if (isRunning) openFloor(saved.climb.floor);
        else openStartOrContinue();
      };
      actions.appendChild(primaryBtn);

      root.appendChild(actions);

      // 终局元层（Phase 4 用）
      var metaLayer = document.createElement('div');
      metaLayer.id = 'rift-meta-layer';
      metaLayer.className = 'rift-meta-layer';
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

      var status = s.climb.status || 'idle';
      var box = document.createElement('div');
      box.className = 'rift-state ' + status;

      var runLabel = s.climb.runId ? s.climb.runId.slice(-6) : '———';
      var destroyed = (s.choices && s.choices.destroyed) || 0;
      var spared = (s.choices && s.choices.spared) || 0;

      box.innerHTML =
        '<div class="rs-row">' +
          '<span class="rs-label">运行</span>' +
          '<span class="rs-val rift-mono">' + runLabel + '</span>' +
          '<span class="rs-label">楼层</span>' +
          '<span class="rs-val rift-num">' + s.climb.floor + '/35</span>' +
          '<span class="rs-label">状态</span>' +
          '<span class="rs-val rs-status">' + statusLabel(status) + '</span>' +
        '</div>' +
        '<div class="rs-row">' +
          '<span class="rs-label">生命</span>' +
          '<span class="rs-val rift-num">' + Math.ceil(s.player.hp || 0) + '/' + Math.ceil(s.player.hpMax || 100) + '</span>' +
          '<span class="rs-label">金币</span>' +
          '<span class="rs-val rift-num">' + (s.player.gold || 0) + '</span>' +
          '<span class="rs-label">血瓶</span>' +
          '<span class="rs-val rift-num">' + countBrines(s.player) + '</span>' +
        '</div>' +
        '<div class="rs-row">' +
          '<span class="rs-label">⚔ 终结</span>' +
          '<span class="rs-val rift-num rift-text-red">' + destroyed + '</span>' +
          '<span class="rs-label">✋ 守护</span>' +
          '<span class="rs-val rift-num rift-text-cyan">' + spared + '</span>' +
        '</div>';
      root.appendChild(box);
    }

    function statusLabel(s) {
      return {
        idle:      '待命中',
        running:   '爬塔中',
        won:       '通关',
        died:      '已死亡',
        retreated: '撤退'
      }[s] || s;
    }

    function countBrines(player) {
      if (!player || !player.brines) return 0;
      var n = 0;
      for (var i = 0; i < player.brines.length; i++) n += player.brines[i].amount || 1;
      return n;
    }

    // ============================================================
    // 开始 / 选职业 modal
    // ============================================================
    function openStartOrContinue() {
      var s = State.load();
      // 已有未结束爬塔：弹 "继续 / 新开始" 选项
      if (s && s.climb.status === 'running') {
        var existingHtml =
          '<div class="rift-modal-shell">' +
            '<div class="rift-modal">' +
              '<h3 class="rift-modal-title">检测到进行中的爬塔</h3>' +
              '<p class="rift-modal-sub">// 楼层 ' + s.climb.floor + '/35 · ' + statusLabel(s.climb.status) + '</p>' +
              '<div class="rift-modal-body">' +
                '上次你选 <b>' + (s.player && s.player.classId ? s.player.classId : '未选择') + '</b>，' +
                '生命 <b class="rift-num">' + Math.ceil(s.player.hp) + '/' + Math.ceil(s.player.hpMax) + '</b>，' +
                '金币 <b class="rift-num rift-text-orange">' + s.player.gold + '</b>。<br>' +
                '你可以继续之前进度，也可以放弃、重新开始。' +
              '</div>' +
              '<div class="rift-modal-actions">' +
                '<button class="rift-btn-primary" id="rift-resume">↻ 继续 · 楼层 ' + s.climb.floor + '</button>' +
                '<button class="rift-btn-secondary" id="rift-restart">▶ 放弃并重新开始</button>' +
              '</div>' +
            '</div>' +
          '</div>';
        var eb = document.createElement('div');
        eb.className = 'rift-modal-shell';
        eb.innerHTML = existingHtml;
        document.body.appendChild(eb);
        eb.querySelector('#rift-resume').onclick = function () {
          document.body.removeChild(eb);
          openFloor(s.climb.floor);
        };
        eb.querySelector('#rift-restart').onclick = function () {
          if (!window.confirm('确认放弃当前进度？这会清除已选职业与所有装备。')) return;
          document.body.removeChild(eb);
          State.resetRun();
          showClassPicker();
        };
        return;
      }
      // 没有进行中爬塔，直接进职业选择
      showClassPicker();
    }

    function showClassPicker() {

      var classes = (window.DATA && window.DATA.classes) || [];
      var cards = '';
      for (var i = 0; i < classes.length; i++) {
        var c = classes[i];
        var proto = (c && c.prototype) || (c && c.passive) || '原型未定义';
        var skill = (c && c.skill) || (c && c.active) || '主动技能未定义';
        var charName = (c && c.name) || c.id;
        cards += '<div class="rift-class-card" data-cid="' + c.id + '">' +
          '<div class="rift-class-name">' + charName + '</div>' +
          '<div class="rift-class-prototype">原型：' + proto + '</div>' +
          '<div class="rift-class-skill">主动：' + skill + '</div>' +
        '</div>';
      }

      var html =
        '<div class="rift-modal-shell">' +
          '<div class="rift-modal" style="max-width: 720px;">' +
            '<h3 class="rift-modal-title">▶ 开始新爬塔</h3>' +
            '<p class="rift-modal-sub">// 35 LAYERS · 经济可崩溃 · 命题反思</p>' +
            '<p class="rift-modal-body">每次开始 = 5 血瓶 + 80 金币<br>每 10 层自动补给 1 个血瓶（Q5）<br>通关或死亡 → 飞书排行榜</p>' +
            '<p class="rift-pick-label">选择职业（点击卡片）：</p>' +
            '<div class="rift-class-picker">' + cards + '</div>' +
            '<div class="rift-modal-actions">' +
              '<button class="rift-btn-primary" id="rift-start-confirm" disabled>⚔ 进入爬塔</button>' +
              '<button class="rift-btn-secondary" id="rift-start-cancel">取消</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      var backdrop = document.createElement('div');
      backdrop.className = 'rift-modal-shell';
      backdrop.innerHTML = html;
      document.body.appendChild(backdrop);

      var picked = null;
      var confirm = backdrop.querySelector('#rift-start-confirm');
      var cards2 = backdrop.querySelectorAll('.rift-class-card');
      for (var i = 0; i < cards2.length; i++) {
        cards2[i].onclick = function () {
          for (var j = 0; j < cards2.length; j++) cards2[j].classList.remove('selected');
          this.classList.add('selected');
          picked = this.getAttribute('data-cid');
          confirm.disabled = false;
        };
      }

      backdrop.querySelector('#rift-start-cancel').onclick = function () {
        document.body.removeChild(backdrop);
      };
      confirm.onclick = function () {
        if (!picked) return;
        State.newRun(picked, 80, 5);
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
      if ([10, 20, 30].indexOf(floor) >= 0 && s && s.player && s.player.brines) {
        addFreeBrine(s, 1);
        State.save(s);
      }

      var monster = Climb.spawnMonsterForFloor(floor);
      var winPct = Climb.getContinueProbability(s, monster);
      winPct = Math.max(0, Math.min(100, winPct));

      var monsterCard =
        '<div class="rift-monster-card rift-tier-' + (isBoss ? 'boss' : (monster.tier || 'normal')) + '">' +
          (isBoss ? '' : '<div class="rift-row rift-row-end"><span class="rift-monster-tag ' + (monster.tier || 'normal') + '">' + (monster.tier || 'normal').toUpperCase() + '</span></div>') +
          '<div class="rift-monster-name">' + monster.name + '</div>' +
          '<div class="rift-monster-stat">' +
            '<span class="lbl">HP</span><span class="val">' + monster.hp + '</span>' +
            '<span class="lbl">AC</span><span class="val">' + monster.ac + '</span>' +
            '<span class="lbl">DMG</span><span class="val danger">' + monster.dmg + '</span>' +
            (monster.elem ? '<span class="lbl">ELEM</span><span class="val warn">' + monster.elem + '</span>' : '') +
          '</div>' +
        '</div>';

      var html =
        '<div class="rift-modal-shell">' +
          '<div class="rift-modal" style="max-width: 560px;">' +
            '<h3 class="rift-modal-title">楼层 ' + floor + '/35</h3>' +
            '<p class="rift-modal-sub">// ' + (isBoss ? 'BOSS GATE' : (monster.tier || 'monster')) + ' · 难度递增</p>' +
            monsterCard +
            '<div class="rift-win-bar">' +
              '<span class="rift-win-label">胜率</span>' +
              '<div class="rift-win-track"><div class="rift-win-fill ' + winCls(winPct) + '" style="width:' + winPct + '%"></div></div>' +
              '<span class="rift-win-pct ' + winCls(winPct) + '">' + winPct.toFixed(0) + '%</span>' +
            '</div>' +
            '<div class="rift-modal-actions">' +
              (isBoss && monster.moralChoice
                ? '<button class="rift-btn-primary rift-action-boss">⚔ 进入 Boss 战</button>'
                : '<button class="rift-btn-primary rift-action-fight">⚔ 战斗</button>') +
              '<button class="rift-btn-secondary rift-action-retreat">↩ 撤退</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      var backdrop = document.createElement('div');
      backdrop.className = 'rift-modal-shell';
      backdrop.innerHTML = html;
      document.body.appendChild(backdrop);

      var fb = backdrop.querySelector('.rift-action-fight');
      if (fb) fb.onclick = function () {
        document.body.removeChild(backdrop);
        runBattleAndDecide(monster, false);
      };
      var rb = backdrop.querySelector('.rift-action-retreat');
      if (rb) rb.onclick = function () {
        if (!window.confirm('确认撤退？你能带出当前所有装备，但放弃本层奖励。')) return;
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

    function winCls(p) {
      if (p >= 70) return 'good';
      if (p >= 40) return 'warn';
      return 'bad';
    }

    // ============================================================
    // Boss 战：道德选择 modal
    // ============================================================
    function promptMoralChoiceThenBoss(boss) {
      var mc = Climb.showMoralChoice(boss.id);

      var html =
        '<div class="rift-modal-shell">' +
          '<div class="rift-modal" style="max-width: 640px;">' +
            '<h3 class="rift-modal-title">' + mc.bossName + '</h3>' +
            '<p class="rift-modal-sub">// BOSS · ' + mc.theme + '</p>' +
            '<div class="rift-modal-body" style="white-space:pre-wrap; line-height:1.8;">' +
              (boss.lore || boss.theme || 'Trinity has no face. Trinity has only decisions.') +
            '</div>' +
            '<p class="rift-pick-label">你要如何面对这个 Boss？</p>' +
            '<div class="rift-choice-grid">' +
              '<button class="rift-choice danger" id="rift-moral-a">' +
                '<span class="ch-label">' + mc.choiceA.label + '</span>' +
                '<span class="ch-desc">' + mc.choiceA.text + '</span>' +
              '</button>' +
              '<button class="rift-choice" id="rift-moral-b">' +
                '<span class="ch-label">' + mc.choiceB.label + '</span>' +
                '<span class="ch-desc">' + mc.choiceB.text + '</span>' +
              '</button>' +
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
    // 跑一场战斗
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
        '<div class="rift-modal-shell">' +
          '<div class="rift-modal">' +
            '<h3 class="rift-modal-title rift-text-green">⚔ 胜利 · ' + monster.name + '</h3>' +
            '<p class="rift-modal-sub">// ' + (isBoss ? 'BOSS GATE 已通过' : '战斗胜利') + '</p>' +
            '<div class="rift-modal-body">' +
              '<div class="rift-row" style="font-size:15px; gap:24px;">' +
                '<span>💰 <b class="rift-num rift-text-orange">+' + reward.gold + '</b> 金币</span>' +
                (reward.brines ? '<span>🩸 <b class="rift-num rift-text-red">+' + reward.brines + '</b> 血瓶</span>' : '') +
                (reward.itemRarity ? '<span>📦 <b>' + reward.itemRarity + '</b> 装备</span>' : '') +
              '</div>' +
            '</div>' +
            '<div class="rift-modal-actions">' +
              '<button class="rift-btn-primary" id="rift-go-next">▶ 继续 → 楼层 ' + (s.climb.floor + 1) + '</button>' +
              '<button class="rift-btn-secondary" id="rift-stop-climb">↩ 结束本次爬塔</button>' +
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

      var html =
        '<div class="rift-modal-shell">' +
          '<div class="rift-modal" style="max-width: 540px;">' +
            '<h3 class="rift-modal-title ' + (isDeath ? 'rift-text-red' : 'rift-text-orange') + '">' +
              (isDeath ? '💀 你已死亡' : '↩ 你撤退了') + 
            '</h3>' +
            '<p class="rift-modal-sub">// 楼层 ' + loot.floorReached + '/35 · 道德: ' + moralSummary(loot.moralSummary) + '</p>' +
            '<table class="rift-loot">' +
              '<thead><tr><th>带出</th><th>失去</th></tr></thead>' +
              '<tbody>' +
                '<tr>' +
                  '<td><span class="rift-brought">' + (loot.broughtOut ? loot.broughtOut.length : 0) + '</span> 件装备<br><span class="rift-mono rift-text-orange">金币 ' + loot.goldRemaining + '</span></td>' +
                  '<td><span class="rift-lost">' + (loot.lost ? loot.lost.length : 0) + '</span> 件装备</td>' +
                '</tr>' +
              '</tbody>' +
            '</table>' +
            '<p class="rift-loot-foot">' +
              '（Q11）不显示分数。装备与金币 = 你带出 / 失去的一切。' +
            '</p>' +
            '<div class="rift-modal-actions">' +
              '<button class="rift-btn-primary" id="rift-new-climb">▶ 开始新爬塔</button>' +
              '<button class="rift-btn-secondary" id="rift-close-death">关闭</button>' +
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

    function moralSummary(m) {
      if (!m || m.total === 0) return '选择尚未做出';
      var bias = m.bias === 'destroy' ? '偏向终结' : m.bias === 'spare' ? '偏向守护' : '中立';
      return bias + ' · ⚔' + m.destroy + ' / ✋' + m.spare;
    }

    // ============================================================
    // 终局元层
    // ============================================================
    function showMetaLayer() {
      var box = document.getElementById('rift-meta-layer');
      if (!box) return;
      box.style.display = 'flex';
      box.innerHTML =
        '<div class="rift-meta-glitch">' +
          '<div class="rift-meta-text">' +
            '&gt; 测试主体 #LJX-001<br>' +
            '&gt; 攻防演练评估: 进行中<br><br>' +
            '&gt; 你并不在反抗 Trinity。<br>' +
            '&gt; Trinity 在测试你。<br><br>' +
            '&gt; 5% 不是失败率。<br>' +
            '&gt; 5% 是你愿意为不完美活着的概率。' +
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
    // 导出
    // ============================================================
    window.RiftUI = {
      init: initClimbTab,
      openStart: openStartOrContinue,
      openFloor: openFloor,
      showMetaLayer: showMetaLayer,
      _debug: { booted: true, hasState: typeof State, hasClimb: typeof Climb }
    };

    document.addEventListener('click', function (e) {
      var t = e.target;
      var btn = t && t.closest && t.closest('button.tab[data-tab="climb"]');
      if (btn) setTimeout(initClimbTab, 0);
    });

    if (document.readyState !== 'loading') {
      initClimbTab();
    } else {
      document.addEventListener('DOMContentLoaded', initClimbTab);
    }

    var d = document.createElement('div');
    d.id = 'rift-debug-widget';
    document.body.appendChild(d);
    function refreshDebug() {
      var root = document.getElementById('tab-climb');
      var btn = document.querySelector('.rift-btn-primary');
      d.textContent =
        '⚔ RIFT DEBUG\n' +
        'Rift: ' + (window.Rift ? window.Rift.version : 'NOT-LOADED') + '\n' +
        'tab-climb: ' + (root ? 'YES' : 'NO') + '\n' +
        'initialized: ' + (root ? root.getAttribute('data-rift-init') : '-') + '\n' +
        'start btn: ' + (btn ? 'YES' : 'NO') + '\n' +
        'status: ' + (State && State.load() ? State.load().climb.status : 'none');
    }
    refreshDebug();
    setInterval(refreshDebug, 2500);
  }

  function waitRift(attempt) {
    attempt = attempt || 0;
    if (window.Rift) { boot(); return; }
    if (attempt > 80) { console.error('[Rift UI] window.Rift 4s 内未就绪'); return; }
    setTimeout(function () { waitRift(attempt + 1); }, 50);
  }
  waitRift();
})();
