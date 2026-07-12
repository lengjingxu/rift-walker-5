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

      // T2.4：道德分支剧情事件（先于一切 modals，给叙事落地）
      var branchEvent = Climb.checkBranchEvent(s, floor);
      if (branchEvent) {
        promptBranchEventModal(s, branchEvent, floor, function () {
          openFloor(s, floor); // 分支 modal 关后重入 openFloor，走后续 brine / 战斗流程
        });
        return;
      }

      // T2.1：每 10 层先弹血瓶带入决策 modal（强制，不跳过）
      if (Climb.isBrineGateFloor(floor)) {
        promptBrineGateModal(s, floor, function () {
          // modal 关闭后再进入楼层战斗 modal
          openFloorCombat(s, floor);
        });
        return;
      }

      openFloorCombat(s, floor);
    }

    // ================================================================
    // Modal 3a：道德分支剧情事件（T2.4，floor 20/25 触发，按 moralBias）
    // ================================================================
    function promptBranchEventModal(s, branchEvent, floor, onClose) {
      var ev = branchEvent;
      var biasLabel = ev.moralBias === 'spare' ? '✋ 不伤' : '🩸 终结';
      var choices = ev.choices || [];
      var buttonsHtml = choices.map(function (c, idx) {
        var cssClass = idx === 0 ? 'rv-choice-spare' : 'rv-choice-destroy';
        return '<button class="rv-choice-btn ' + cssClass + '" data-choice-id="' + c.id + '">' +
                 '<span class="rv-choice-label">' + c.label + '</span>' +
               '</button>';
      }).join('');

      var shell = openModal(
        '<div class="rv-modal rv-modal-wide">' +
          '<div class="rv-floor-badge rv-boss-badge">第 ' + floor + ' 层 · 道德分支</div>' +
          '<div class="rv-boss-lore"><strong>' + ev.title + '</strong> · ' + biasLabel + ' 偏向 ' + ev.currentRatio + '%</div>' +
          '<div class="rv-branch-text">' + (ev.text || '').replace(/\n/g, '<br>') + '</div>' +
          '<div class="rv-choice-row">' + buttonsHtml + '</div>' +
        '</div>'
      );

      shell.querySelectorAll('.rv-choice-btn').forEach(function (btn) {
        btn.onclick = function () {
          var choiceId = btn.getAttribute('data-choice-id');
          var choice = choices.find(function (c) { return c.id === choiceId; });
          if (!choice || !choice.effect) {
            closeModal(shell);
            if (typeof onClose === 'function') onClose();
            return;
          }
          applyBranchEventEffect(s, choice.effect, floor);
          State.save(s);
          closeModal(shell);
          if (typeof onClose === 'function') onClose();
        };
      });
    }

    /** 把分支事件的 effect 落到 state 上 */
    function applyBranchEventEffect(s, effect, floor) {
      if (!effect) return;
      // 道德累积：spare/destroy ±1
      if (effect.moralSpare) {
        for (var i = 0; i < Math.abs(effect.moralSpare); i++) {
          if (effect.moralSpare > 0) State.setChoice('spared');
          else State.setChoice('destroyed');
        }
      }
      if (effect.moralDestroy) {
        for (var j = 0; j < Math.abs(effect.moralDestroy); j++) {
          State.setChoice('destroyed');
        }
      }
      // 金币奖励
      if (effect.goldBonus) {
        s.player.gold = (s.player.gold || 0) + effect.goldBonus;
      }
      // boss 弱化（标记到下一层 boss 战，对应 floor）
      if (effect.bossWeaken) {
        s._bossWeaken = s._bossWeaken || {};
        s._bossWeaken[floor] = effect.bossWeaken;
      }
    }

    // 战斗 modal（怪物 + 胜率 + 2 按钮）
    function openFloorCombat(s, floor) {
      var monster = Climb.spawnMonsterForFloor(floor);
      var isBoss = Climb.isBossFloor(floor);
      // T2.2：Boss 战技能输入窗口（5/15/25/35）强制先选技能，再进战斗 modal
      // 用 onChoose 回调确保 modal 关闭后再渲染战斗 modal（避免嵌套 — pitfall #21）
      if (isBoss && Climb.isBossSkillWindowFloor(floor)) {
        promptBossSkillModal(s, monster, function () {
          renderCombatModal(s, floor, monster, isBoss);
        });
        return;
      }
      renderCombatModal(s, floor, monster, isBoss);
    }

    function renderCombatModal(s, floor, monster, isBoss) {
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
      // 优先读 boss.story（T4.x 长篇），fallback 到 lore/theme
      var loreRaw = (boss && (boss.story || boss.lore || boss.theme)) || mc.story || mc.theme || '';
      // 把 \n 换成段落 <p>，长篇故事更好读
      var lore = loreRaw
        ? loreRaw.split(/\n\s*\n/).map(function (p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; }).join('')
        : '';
      // 道德钩子（如果有）
      var hook = boss && boss.moralHook ? '<span class="rv-moral-hook">' + boss.moralHook + '</span>' : '';

      var shell = openModal(
        '<div class="rv-modal rv-modal-wide">' +
          '<div class="rv-floor-badge rv-boss-badge">' + mc.bossName + ' · BOSS</div>' +
          '<div class="rv-boss-lore">' + lore + hook + '</div>' +
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
    // Modal 3b：血瓶带入决策（T2.1，每 10 层强制）
    // ================================================================
    function promptBrineGateModal(s, floor, onClose) {
      var payload = Climb.showBrineGateModal(s, floor);
      var opt = payload.options;

      var warnHtml = payload.warning
        ? '<div class="rv-brine-warn">' + payload.warning + '</div>'
        : '';

      var disabledBring = opt.bring.disabled ? ' rv-btn-disabled' : '';

      var shell = openModal(
        '<div class="rv-modal rv-modal-wide">' +
          '<div class="rv-floor-badge rv-brine-badge">第 ' + floor + ' 层 · 血瓶带入决策</div>' +
          '<div class="rv-brine-subtitle">' + payload.subtitle + '</div>' +
          '<div class="rv-brine-stats">' +
            '<span>❤️ ' + payload.hp + '/' + payload.hpMax + ' (' + payload.hpPct + '%)</span>' +
            '<span>🩸 stash: ' + payload.brinesStash + '</span>' +
          '</div>' +
          warnHtml +
          '<div class="rv-brine-choices">' +
            '<button class="rv-brine-btn rv-brine-bring' + disabledBring + '" id="rv-brine-bring">' +
              '<span class="rv-brine-label">' + opt.bring.label + '</span>' +
              '<span class="rv-brine-text">' + opt.bring.text + '</span>' +
            '</button>' +
            '<button class="rv-brine-btn rv-brine-free" id="rv-brine-free">' +
              '<span class="rv-brine-label">' + opt.free.label + '</span>' +
              '<span class="rv-brine-text">' + opt.free.text + '</span>' +
            '</button>' +
            '<button class="rv-brine-btn rv-brine-skip" id="rv-brine-skip">' +
              '<span class="rv-brine-label">' + opt.skip.label + '</span>' +
              '<span class="rv-brine-text">' + opt.skip.text + '</span>' +
            '</button>' +
          '</div>' +
        '</div>'
      );

      // 选项 1：从 stash 取 1 个血瓶（消耗 1 个，加 1 个 → stash 不变）
      shell.querySelector('#rv-brine-bring').onclick = function () {
        if (opt.bring.disabled) return;
        // 从 stash 找 1 个 standard 消耗
        var consumed = consumeBrineFromStash(s, 1);
        if (consumed) {
          addFreeBrine(s, 1); // 强制补 1 个
          State.save(s);
          closeModal(shell);
          refreshMainPage();
          if (typeof onClose === 'function') onClose();
        }
      };

      // 选项 2：免费拿 1 个新血瓶（无消耗）
      shell.querySelector('#rv-brine-free').onclick = function () {
        addFreeBrine(s, 1);
        State.save(s);
        closeModal(shell);
        refreshMainPage();
        if (typeof onClose === 'function') onClose();
      };

      // 选项 3：跳过（不拿，下个 boss 战无血瓶）
      shell.querySelector('#rv-brine-skip').onclick = function () {
        // 标记 skip 选择（用于未来追溯/统计）
        s._brineGateSkip = s._brineGateSkip || {};
        s._brineGateSkip[floor] = true;
        State.save(s);
        closeModal(shell);
        if (typeof onClose === 'function') onClose();
      };
    }

    // ================================================================
    // Modal 3c：Boss 战技能输入窗口（T2.2，5/15/25/35 boss 战强制）
    // ================================================================
    function promptBossSkillModal(s, boss, onChoose) {
      var payload = Climb.showBossSkillWindow(s, boss);
      var skills = payload.skills || [];

      var warnHtml = payload.warning
        ? '<div class="rv-skill-warn">' + payload.warning + '</div>'
        : '';

      var skillsHtml = skills.map(function (sk) {
        return '<button class="rv-skill-btn" data-skill-id="' + sk.id + '">' +
          '<span class="rv-skill-label">' + sk.label + '</span>' +
          '<span class="rv-skill-text">' + sk.text + '</span>' +
        '</button>';
      }).join('');

      var shell = openModal(
        '<div class="rv-modal rv-modal-wide">' +
          '<div class="rv-floor-badge rv-skill-badge">第 ' + payload.floor + ' 层 · ' + payload.bossName + ' · 技能选择</div>' +
          '<div class="rv-skill-subtitle">职业：' + payload.className + ' · 选择 1 个技能带入 boss 战</div>' +
          warnHtml +
          '<div class="rv-skill-choices">' + skillsHtml + '</div>' +
        '</div>'
      );

      // 三个技能按钮的 click handler（统一绑定，按 data-skill-id 识别）
      var btns = shell.querySelectorAll('.rv-skill-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].onclick = (function (btn) {
          return function () {
            var skillId = btn.getAttribute('data-skill-id');
            State.setBossSkill(skillId, payload.floor);
            closeModal(shell);
            if (typeof onChoose === 'function') onChoose(skillId);
          };
        })(btns[i]);
      }
    }

    // 从 stash 消耗 1 个血瓶（找 standard 类型）
    function consumeBrineFromStash(s, amount) {
      if (!s.player.brines) return false;
      amount = Math.max(1, Math.floor(amount || 1));
      for (var i = 0; i < s.player.brines.length && amount > 0; i++) {
        var b = s.player.brines[i];
        if (!b) continue;
        if (b.amount >= amount) {
          b.amount -= amount;
          amount = 0;
          if (b.amount <= 0) {
            s.player.brines.splice(i, 1);
            i--;
          }
        } else {
          amount -= b.amount;
          s.player.brines.splice(i, 1);
          i--;
        }
      }
      return amount <= 0;
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
      // T5.1: 终局通关 → 上报排行榜（worker 异步，不阻塞元层收尾动画）
      try {
        var s35 = State.load();
        var loot35 = Climb.calculateDeathLoot(s35);
        submitLeaderboardAsync(loot35, 'B_Inheritor');
      } catch (_) { /* best-effort */ }
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
      // T5.1: 死亡 / 撤退 → 上报排行榜（worker 异步）
      try { submitLeaderboardAsync(loot, isDeath ? 'died' : 'retreated'); } catch (_) {}
    }

    // ================================================================
    // T5.1 helper: 把结算 loot + ending → Leaderboard.submitRun(payload)
    // payload 字段与 T5.2 Bitable 写入契约对齐（player/buildHash/score/...）
    // ================================================================
    function submitLeaderboardAsync(loot, ending) {
      if (typeof Leaderboard === 'undefined' || !Leaderboard.submitRun) return;
      var s = State.load();
      var player = s && s.player || {};
      var equipped = player.equipped || {};
      var equippedKeys = Object.keys(equipped).filter(function (k) { return equipped[k]; });

      // buildHash: 简化为 equipped 名 + 槽位 + 颜色串联（确定性）
      var hashSource = equippedKeys
        .sort()
        .map(function (k) {
          var it = equipped[k];
          return (it.name || '') + '@' + k + ':' + (it.rarity || '');
        })
        .join('|');
      var buildHash = hashSource ? simpleHash(hashSource) : '';

      // score: floor*100 + 金币*0.1 + 道德分（spare=+50 / destroy=+10）
      var moral = (loot && loot.moralSummary) || {};
      var spareN = moral.spare || 0;
      var destroyN = moral.destroy || 0;
      var score = ((loot && loot.floorReached) || 0) * 100 +
                  ((loot && loot.goldRemaining) || 0) * 0.1 +
                  spareN * 50 + destroyN * 10;

      Leaderboard.submitRun({
        player:        getPlayerName(),
        buildHash:     buildHash,
        score:         Math.round(score),
        floor:         (loot && loot.floorReached) || 0,
        goldRemaining: (loot && loot.goldRemaining) || 0,
        itemsBroughtOut: (loot && loot.broughtOut) || [],
        itemsLost:       (loot && loot.lost) || [],
        ending:        ending,
        classId:       player.classId || '',
        submittedAt:   new Date().toISOString()
      }).then(function (r) {
        // 仅 console 输出，不污染 modal
        if (r && r.ok) console.log('[Leaderboard] submitted', r.status);
        else console.warn('[Leaderboard] not submitted:', r && r.error);
      });
    }

    function getPlayerName() {
      try {
        var n = localStorage.getItem('rift_player_name');
        if (n) return n;
      } catch (_) {}
      return 'anonymous-' + Math.random().toString(36).slice(2, 8);
    }

    // 32-bit FNV-1a hash（纯 JS，无依赖；用于 buildHash 短串）
    function simpleHash(str) {
      var h = 0x811c9dc5;
      for (var i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
      }
      return ('00000000' + h.toString(16)).slice(-8);
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
