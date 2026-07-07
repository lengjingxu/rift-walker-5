// ==================== 裂隙行者 5% · 爬塔 UI 层 (v2.2 极简交互) ====================
// 原则：主页面永远只有 1 行状态 + 1 按钮。Modal 永远只问 1 件事。
//
// (function () {
//   'use strict';
//   var booted = false;
//   function boot() {
//     if (booted) return;
//     var Rift = window.Rift;
//     if (!Rift) { console.error('[Rift UI] window.Rift 仍未就绪'); return; }
//     booted = true;
//     var State = Rift.State, Economy = Rift.Economy, Climb = Rift.Climb;
//     ...

(function () {
  'use strict';
  var booted = false;

  function boot() {
    if (booted) return;
    var Rift = window.Rift;
    if (!Rift) { console.error('[Rift UI] window.Rift 仍未就绪'); return; }
    booted = true;
    var State = Rift.State, Economy = Rift.Economy, Climb = Rift.Climb;

    // ================================================================
    // 工具
    // ================================================================
    function statusLabel(s) {
      return { idle: '待命', running: '进行中', won: '通关', died: '死亡', retreated: '撤退' }[s] || s;
    }

    function countBrines(player) {
      if (!player || !player.brines) return 0;
      var n = 0;
      for (var i = 0; i < player.brines.length; i++) n += player.brines[i].amount || 1;
      return n;
    }

    function moralSummary(s) {
      if (!s) return '';
      if (s.total === 0) return '';
      var b = s.bias === 'destroy' ? '⚔' : s.bias === 'spare' ? '✋' : '·';
      return b + ' ' + s.destroy + ' / ' + s.spare;
    }

    function sLabel(s) { return s ? s.label || s : ''; }

    // ================================================================
    // 全屏遮罩（所有 modal 共享）
    // ================================================================
    function openModal(innerHTML) {
      var shell = document.createElement('div');
      shell.className = 'rv-shell';
      shell.innerHTML = innerHTML;
      document.body.appendChild(shell);
      return shell;
    }

    function closeModal(shell) {
      if (shell && shell.parentNode) shell.parentNode.removeChild(shell);
    }

    // ================================================================
    // 主页面（1 行状态 + 1 按钮，永远极简）
    // ================================================================
    function initClimbTab() {
      var root = document.getElementById('tab-climb');
      if (!root) { console.error('[Rift UI] #tab-climb not found'); return; }

      // 重置：清空旧内容，重新构建
      root.innerHTML = '';

      // ---- 标题 ----
      var title = document.createElement('div');
      title.className = 'rv-title';
      title.textContent = '⚔ 裂隙行者 5%';
      root.appendChild(title);

      // ---- 1 行状态条 ----
      var bar = buildStatusBar();
      root.appendChild(bar);

      // ---- 主按钮 ----
      var btn = buildMainButton();
      root.appendChild(btn);

      // ---- 终局元层占位 ----
      var meta = document.createElement('div');
      meta.id = 'rv-meta-layer';
      meta.className = 'rv-meta';
      root.appendChild(meta);

      console.log('[Rift UI] v2.2 ready');
    }

    function buildStatusBar() {
      var bar = document.createElement('div');
      bar.className = 'rv-status-bar';
      var s = State.load();
      if (!s || !s.climb) {
        bar.textContent = '// 尚未开始爬塔';
        return bar;
      }
      var status = s.climb.status || 'idle';
      var hp = Math.ceil(s.player.hp || 0);
      var hpMax = Math.ceil(s.player.hpMax || 100);
      var gold = s.player.gold || 0;
      var floor = s.climb.floor || 0;
      var destroyed = (s.choices && s.choices.destroyed) || 0;
      var spared = (s.choices && s.choices.spared) || 0;

      var segs = [
        { label: '楼层', val: floor + '/35' },
        { label: 'HP', val: hp + '/' + hpMax, cls: hp < hpMax * 0.3 ? 'rv-danger' : '' },
        { label: '💰', val: gold },
        { label: '血瓶', val: countBrines(s.player) },
        { label: '⚔', val: destroyed, cls: destroyed > 0 ? 'rv-danger' : '' },
        { label: '✋', val: spared, cls: spared > 0 ? 'rv-safe' : '' }
      ];

      for (var i = 0; i < segs.length; i++) {
        var seg = document.createElement('span');
        seg.className = 'rv-seg';
        if (segs[i].cls) seg.className += ' ' + segs[i].cls;
        seg.innerHTML = '<span class="rv-seg-label">' + segs[i].label + '</span>' +
                        '<span class="rv-seg-val">' + segs[i].val + '</span>';
        bar.appendChild(seg);
        if (i < segs.length - 1) {
          var sep = document.createElement('span');
          sep.className = 'rv-sep';
          sep.textContent = '|';
          bar.appendChild(sep);
        }
      }
      return bar;
    }

    function buildMainButton() {
      var s = State.load();
      var status = (s && s.climb && s.climb.status) || 'idle';
      var isRunning = status === 'running';

      var wrap = document.createElement('div');
      wrap.className = 'rv-main-btn-wrap';

      var btn = document.createElement('button');
      btn.className = 'rv-btn-primary';
      btn.textContent = isRunning
        ? '↻ 继续 · 楼层 ' + s.climb.floor
        : '▶ 开始爬塔';
      btn.onclick = function () {
        if (isRunning) showResumeModal(s);
        else openStartOrContinue();
      };
      wrap.appendChild(btn);
      return wrap;
    }

    function refreshMainPage() {
      var root = document.getElementById('tab-climb');
      if (!root) return;
      // 重建状态条和按钮（保留标题和 meta 层）
      var oldBar = root.querySelector('.rv-status-bar');
      var oldBtn = root.querySelector('.rv-main-btn-wrap');
      if (oldBar) oldBar.remove();
      if (oldBtn) oldBtn.remove();
      var metaLayer = root.querySelector('#rv-meta-layer');
      root.insertBefore(buildStatusBar(), metaLayer);
      root.insertBefore(buildMainButton(), metaLayer);
    }

    // ================================================================
    // Modal 1：检测到进行中的爬塔 → 继续 / 重新开始
    // ================================================================
    function showResumeModal(s) {
      var clsId = s.player && s.player.classId || '未知';
      var floor = s.climb.floor;
      var hp = Math.ceil(s.player.hp);
      var hpMax = Math.ceil(s.player.hpMax);
      var gold = s.player.gold;

      var shell = openModal(
        '<div class="rv-modal">' +
          '<div class="rv-modal-q">已有爬塔进行中</div>' +
          '<div class="rv-modal-info">' +
            clsId + ' · ' + floor + '/35 层 · ' + hp + '/' + hpMax + ' HP · 💰' + gold +
          '</div>' +
          '<div class="rv-modal-actions">' +
            '<button class="rv-btn-primary rv-btn-full" id="rv-resume">↻ 继续</button>' +
            '<button class="rv-btn-ghost rv-btn-full" id="rv-go-rest">🏕 进休息站</button>' +
            '<button class="rv-btn-ghost rv-btn-full" id="rv-restart">重新开始</button>' +
          '</div>' +
        '</div>'
      );
      shell.querySelector('#rv-resume').onclick = function () {
        closeModal(shell);
        openFloor(State.load().climb.floor);
      };
      shell.querySelector('#rv-go-rest').onclick = function () {
        closeModal(shell);
        if (window.Rest && typeof window.Rest.open === 'function') {
          window.Rest.open();
        } else {
          console.warn('[Rift UI] window.Rest 未加载');
        }
      };
      shell.querySelector('#rv-restart').onclick = function () {
        closeModal(shell);
        if (window.confirm('放弃当前进度？')) {
          State.resetRun();
          showClassPicker();
        }
      };
    }

    // ================================================================
    // Modal 2：选职业（6 选 1，极简）
    // ================================================================
    function showClassPicker() {
      var classes = (window.DATA && window.DATA.classes) || [];

      var cardsHtml = '';
      for (var i = 0; i < classes.length; i++) {
        var c = classes[i];
        var name = (c && (c.name || c.id)) || 'unknown';
        var trait = (c && (c.prototype || c.passive || c.trait)) || '—';
        cardsHtml +=
          '<button class="rv-class-card" data-cid="' + (c.id || name) + '">' +
            '<div class="rv-class-name">' + name + '</div>' +
            '<div class="rv-class-trait">' + trait + '</div>' +
          '</button>';
      }

      var shell = openModal(
        '<div class="rv-modal rv-modal-wide">' +
          '<div class="rv-modal-q">选择职业</div>' +
          '<div class="rv-class-grid">' + cardsHtml + '</div>' +
          '<div class="rv-modal-actions">' +
            '<button class="rv-btn-primary rv-btn-full" id="rv-confirm-start" disabled>⚔ 进入爬塔</button>' +
          '</div>' +
        '</div>'
      );

      var picked = null;
      var cards = shell.querySelectorAll('.rv-class-card');
      for (var i = 0; i < cards.length; i++) {
        cards[i].onclick = function () {
          for (var j = 0; j < cards.length; j++) cards[j].classList.remove('rv-selected');
          this.classList.add('rv-selected');
          picked = this.getAttribute('data-cid');
          shell.querySelector('#rv-confirm-start').disabled = false;
        };
      }

      shell.querySelector('#rv-confirm-start').onclick = function () {
        if (!picked) return;
        closeModal(shell);
        State.newRun(picked, 80, 5);
        refreshMainPage();
        openFloor(1);
      };
    }

    // ================================================================
    // Modal 3：楼层战斗前（极简：怪物 + 胜率 + 2 按钮）
    // ================================================================
    function openFloor(floor) {
      var s = State.load();

      // Q5：每 10 层免费血瓶
      if ([10, 20, 30].indexOf(floor) >= 0) {
        addFreeBrine(s, 1);
        State.save(s);
        refreshMainPage();
      }

      var monster = Climb.spawnMonsterForFloor(floor);
      var isBoss = Climb.isBossFloor(floor);
      var winPct = Math.max(0, Math.min(100, Climb.getContinueProbability(s, monster)));

      var winColor = winPct >= 70 ? 'rv-good' : winPct >= 40 ? 'rv-warn' : 'rv-bad';

      var shell = openModal(
        '<div class="rv-modal">' +
          '<div class="rv-floor-badge">楼层 ' + floor + '/35' + (isBoss ? ' · BOSS' : '') + '</div>' +
          '<div class="rv-monster-name' + (isBoss ? ' rv-boss-name' : '') + '">' + monster.name + '</div>' +
          '<div class="rv-monster-stats">HP ' + monster.hp + ' · AC ' + monster.ac + ' · DMG ' + monster.dmg + '</div>' +
          '<div class="rv-win-row">' +
            '<span class="rv-win-label">胜率</span>' +
            '<div class="rv-win-track"><div class="rv-win-fill ' + winColor + '" style="width:' + winPct + '%"></div></div>' +
            '<span class="rv-win-pct ' + winColor + '">' + winPct.toFixed(0) + '%</span>' +
          '</div>' +
          '<div class="rv-modal-actions">' +
            (isBoss && monster.moralChoice
              ? '<button class="rv-btn-primary rv-btn-full" id="rv-fight">⚔ 进入 Boss 战</button>'
              : '<button class="rv-btn-primary rv-btn-full" id="rv-fight">⚔ 战斗</button>') +
            '<button class="rv-btn-ghost rv-btn-full" id="rv-retreat">↩ 撤退</button>' +
          '</div>' +
        '</div>'
      );

      shell.querySelector('#rv-fight').onclick = function () {
        closeModal(shell);
        if (isBoss) promptMoralChoiceThenBoss(monster);
        else runBattleAndDecide(monster, false);
      };
      shell.querySelector('#rv-retreat').onclick = function () {
        if (!window.confirm('撤退？可带出当前装备。')) return;
        closeModal(shell);
        State.retreat();
        showSettlementModal(false);
      };
    }

    // ================================================================
    // Modal 4：道德选择（Boss 战前，极简）
    // ================================================================
    function promptMoralChoiceThenBoss(boss) {
      var mc = Climb.showMoralChoice(boss.id);
      var lore = (boss && (boss.lore || boss.theme)) || mc.theme || '';

      var shell = openModal(
        '<div class="rv-modal rv-modal-wide">' +
          '<div class="rv-floor-badge rv-boss-badge">' + mc.bossName + ' · BOSS</div>' +
          '<div class="rv-boss-lore">' + lore + '</div>' +
          '<div class="rv-choice-row">' +
            '<button class="rv-choice-btn rv-choice-destroy" id="rv-choose-a">' +
              '<span class="rv-choice-label">' + mc.choiceA.label + '</span>' +
              '<span class="rv-choice-desc">' + mc.choiceA.text + '</span>' +
            '</button>' +
            '<button class="rv-choice-btn rv-choice-spare" id="rv-choose-b">' +
              '<span class="rv-choice-label">' + mc.choiceB.label + '</span>' +
              '<span class="rv-choice-desc">' + mc.choiceB.text + '</span>' +
            '</button>' +
          '</div>' +
        '</div>'
      );

      shell.querySelector('#rv-choose-a').onclick = function () {
        State.setChoice('destroyed');
        closeModal(shell);
        runBattleAndDecide(boss, true);
      };
      shell.querySelector('#rv-choose-b').onclick = function () {
        State.setChoice('spared');
        closeModal(shell);
        runBattleAndDecide(boss, true);
      };
    }

    // ================================================================
    // 战斗核心
    // ================================================================
    function runBattleAndDecide(monster, isBoss) {
      var result = State.simulateRiftBattle(monster);
      if (result && result.win) {
        var s = State.load();
        var reward = Economy.calculateTileReward(s.climb.floor);
        s.player.gold += reward.gold;
        if (reward.brines) addFreeBrine(s, reward.brines);
        State.save(s);

        if (s.climb.floor === 35) {
          State.advanceFloor();
          refreshMainPage();
          showVictoryModal();
        } else {
          State.advanceFloor();
          refreshMainPage();
          showVictoryModal(monster, reward);
        }
      } else {
        State.die('defeated by ' + monster.name);
        showSettlementModal(true);
      }
    }

    // ================================================================
    // Modal 5：战斗胜利（极简）
    // ================================================================
    function showVictoryModal(monster, reward) {
      var s = State.load();
      var nextFloor = s.climb.floor + 1;
      var rewardText = reward
        ? (reward.gold > 0 ? '💰 +' + reward.gold : '') +
          (reward.brines > 0 ? ' 🩸 +' + reward.brines : '')
        : '';

      var shell = openModal(
        '<div class="rv-modal">' +
          '<div class="rv-outcome rv-outcome-win">⚔ 胜利</div>' +
          (monster ? '<div class="rv-outcome-sub">' + monster.name + ' 已击败</div>' : '') +
          (rewardText ? '<div class="rv-outcome-reward">' + rewardText + '</div>' : '') +
          '<div class="rv-modal-actions">' +
            '<button class="rv-btn-primary rv-btn-full" id="rv-next-floor">▶ 继续 · 楼层 ' + nextFloor + '</button>' +
            '<button class="rv-btn-ghost rv-btn-full" id="rv-end-here">↩ 结束爬塔</button>' +
          '</div>' +
        '</div>'
      );

      shell.querySelector('#rv-next-floor').onclick = function () {
        closeModal(shell);
        openFloor(nextFloor);
      };
      shell.querySelector('#rv-end-here').onclick = function () {
        closeModal(shell);
        State.retreat();
        showSettlementModal(false);
      };
    }

    // ================================================================
    // Modal 6：通关（终局）
    // ================================================================
    function showVictoryModal() {
      var meta = document.getElementById('rv-meta-layer');
      if (meta) {
        meta.style.display = 'flex';
        meta.innerHTML =
          '<div class="rv-meta-inner">' +
            '<div class="rv-meta-line">> 你通关了。</div>' +
            '<div class="rv-meta-line">> 5% 不是失败率。</div>' +
            '<div class="rv-meta-line">> 5% 是你愿意为不完美活着的概率。</div>' +
          '</div>';
      }
      refreshMainPage();
    }

    // ================================================================
    // Modal 7：结算（死亡 / 撤退）
    // ================================================================
    function showSettlementModal(isDeath) {
      var s = State.load();
      var loot = Climb.calculateDeathLoot(s);

      var moral = moralSummary(loot.moralSummary);

      var shell = openModal(
        '<div class="rv-modal">' +
          '<div class="rv-outcome ' + (isDeath ? 'rv-outcome-die' : 'rv-outcome-retreat') + '">' +
            (isDeath ? '💀 死亡' : '↩ 撤退') +
          '</div>' +
          '<div class="rv-settlement-row">' +
            '<div class="rv-settlement-cell">' +
              '<div class="rv-settlement-big rv-safe">' + (loot.broughtOut ? loot.broughtOut.length : 0) + '</div>' +
              '<div class="rv-settlement-label">带出</div>' +
            '</div>' +
            '<div class="rv-settlement-cell">' +
              '<div class="rv-settlement-big rv-danger">' + (loot.lost ? loot.lost.length : 0) + '</div>' +
              '<div class="rv-settlement-label">失去</div>' +
            '</div>' +
          '</div>' +
          '<div class="rv-settlement-info">💰 ' + loot.goldRemaining + ' 金币' +
            (moral ? ' · ' + moral : '') +
            ' · 楼层 ' + loot.floorReached + '/35' +
          '</div>' +
          '<div class="rv-modal-actions">' +
            '<button class="rv-btn-primary rv-btn-full" id="rv-new-run">▶ 重新开始</button>' +
          '</div>' +
        '</div>'
      );

      shell.querySelector('#rv-new-run').onclick = function () {
        closeModal(shell);
        refreshMainPage();
        openStartOrContinue();
      };
    }

    // ================================================================
    // 辅助
    // ================================================================
    function addFreeBrine(s, amount) {
      if (!s.player.brines) s.player.brines = [];
      s.player.brines.push({ id: 'free-' + Date.now(), amount: amount });
    }

    // ================================================================
    // 暴露 / 启动
    // ================================================================
    window.RiftUI = { init: initClimbTab };

    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('button.tab[data-tab="climb"]');
      if (btn) setTimeout(initClimbTab, 0);
    });

    if (document.readyState !== 'loading') {
      initClimbTab();
    } else {
      document.addEventListener('DOMContentLoaded', initClimbTab);
    }

    // Debug widget（小而不扰）
    var dw = document.createElement('div');
    dw.id = 'rv-debug';
    document.body.appendChild(dw);
    setInterval(function () {
      var s = State.load();
      dw.textContent = s
        ? 'v2.2 ' + (s.climb && s.climb.status || '?') + ' f' + (s.climb && s.climb.floor || 0)
        : 'v2.2 no-state';
    }, 3000);

    // ---- waitRift ----
    function waitRift(attempt) {
      attempt = attempt || 0;
      if (window.Rift) { boot(); return; }
      if (attempt > 80) { console.error('[Rift UI] window.Rift 4s 内未就绪'); return; }
      setTimeout(function () { waitRift(attempt + 1); }, 50);
    }
    waitRift();
  }
})();
