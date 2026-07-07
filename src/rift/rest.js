// ==================== 裂隙行者 5% · 休息站 UI (Phase 1 · T1.3) ====================
// 玩家每 10 层 / 决策点 "回城补给" 入口进入
// 3 个 Tab：换装 / 升级 / 融入
//
// 设计原则（DESIGN.md）：
//   - 极简：modal 永远只问 1 件事；tab 之间切换不弹新 modal
//   - 真实（Q3）：装备颜色 = 真实价值，不做"鼠标 hover 才显真信息"的伎俩
//   - 危险前置：升级/融入确认 modal 强调"碎光就回不来"
//
// 暴露：
//   window.Rest.open()                     — 打开休息站 modal
//   window.Rest.openFuseAnimation(result)  — 直接放融入动画（被 climb-ui 调用）
//
// 依赖：
//   window.Rift (= State + Economy + Climb)
//   window.DATA  (slots, rarities, classes)
//   window.Game  (uid)
//   vanilla DOM (no framework)

(function () {
  'use strict';

  var UPGRADE_GOLD_COST = 20;        // 单次升级消耗（与 Economy.UPGRADE_GOLD_COST 对齐）
  var FUSE_RATE_DISPLAY = '60% 碎 / 35% 高一阶 / 5% 传奇';

  // ============================================================
  // Modal helpers (与 climb-ui.js 共享一套视觉)
  // ============================================================
  function openShell(innerHTML) {
    var shell = document.createElement('div');
    shell.className = 'rv-shell';
    shell.innerHTML = innerHTML;
    document.body.appendChild(shell);
    return shell;
  }
  function closeShell(shell) {
    if (shell && shell.parentNode) shell.parentNode.removeChild(shell);
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ============================================================
  // 装备视觉（Q3 真颜色 = 真实价值）
  // ============================================================
  // rarity border + tier glyph
  function rarityBorder(rarity) {
    var r = (window.DATA && window.DATA.rarities && window.DATA.rarities[rarity]) || null;
    return r ? r.color : '#444';
  }
  function tierGlyph(tier) {
    if (!tier) return '·';
    return tier.replace('T', '');
  }
  function slotLabel(slotId) {
    if (!window.DATA || !window.DATA.slots) return slotId || '·';
    var found = window.DATA.slots.filter(function (s) { return s === slotId; });
    return found.length ? found[0] : slotId;
  }
  function tierColor(tier) {
    var map = { T1: '#cccccc', T2: '#6688ff', T3: '#999999', T4: '#ff9933', T5: '#ffcc00', T6: '#cc66ff' };
    return map[tier] || '#aaa';
  }

  // 渲染单件装备卡片（紧凑）
  function itemCardHtml(item, opts) {
    opts = opts || {};
    var rarityColor = rarityBorder(item.rarity);
    var tCol = tierColor(item.tier);
    var upgradeLevel = item.upgradeLevel || 0;
    var upgradeBadge = upgradeLevel > 0 ? ' <span class="rv-r-up">+' + upgradeLevel + '</span>' : '';
    var uidAttr = ' data-uid="' + escapeHtml(item.uid) + '"';
    var slotAttr = ' data-slot="' + escapeHtml(item.slot) + '"';
    var selected = opts.selected ? ' rv-selected' : '';
    return (
      '<div class="rv-r-card' + selected + '"' + uidAttr + slotAttr +
        ' style="border-color:' + rarityColor + '">' +
        '<div class="rv-r-card-line1">' +
          '<span class="rv-r-name" style="color:' + rarityColor + '">' + escapeHtml(item.name || '未命名') + '</span>' +
          upgradeBadge +
        '</div>' +
        '<div class="rv-r-card-line2">' +
          '<span class="rv-r-tier" style="color:' + tCol + '">T' + tierGlyph(item.tier) + '</span>' +
          '<span class="rv-r-slot">' + slotLabel(item.slot) + '</span>' +
          '<span class="rv-r-rarity">' + (item.rarity || 'normal') + '</span>' +
        '</div>' +
      '</div>'
    );
  }

  // ============================================================
  // 主入口
  // ============================================================
  function open() {
    var Rift = window.Rift;
    if (!Rift) {
      console.error('[Rest] window.Rift not ready');
      return;
    }
    var State = Rift.State;
    var s = State.getState();
    if (!s.climb || s.climb.status !== 'running') {
      // 不在爬塔中 → 直接弹空状态
      var emptyShell = openShell(
        '<div class="rv-modal">' +
          '<div class="rv-modal-q">休息站</div>' +
          '<div class="rv-rest-empty">当前没有进行中的爬塔。</div>' +
          '<div class="rv-modal-actions">' +
            '<button class="rv-btn-primary rv-btn-full" id="rv-rest-close">关闭</button>' +
          '</div>' +
        '</div>'
      );
      emptyShell.querySelector('#rv-rest-close').onclick = function () { closeShell(emptyShell); };
      return;
    }
    renderTabEquip(s);
  }

  // ============================================================
  // Tab 1: 换装
  // ============================================================
  function renderTabEquip(s) {
    var Rift = window.Rift;
    var State = Rift.State;

    var slotsHtml = '';
    var slots = (window.DATA && window.DATA.slots) || [];
    for (var i = 0; i < RiftState.ITEM_SLOTS && i < slots.length; i++) {
      var slotId = slots[i];
      var equipped = s.player.items[i];
      var cardInner = equipped
        ? itemCardHtml(equipped, { selected: false })
        : '<div class="rv-r-slot-empty">空槽位</div>';
      slotsHtml += (
        '<div class="rv-r-slot-row" data-slot-idx="' + i + '" data-slot-id="' + escapeHtml(slotId) + '">' +
          '<div class="rv-r-slot-label">' + escapeHtml(slotId) + '</div>' +
          '<div class="rv-r-slot-card">' + cardInner + '</div>' +
          '<div class="rv-r-slot-actions">' +
            (equipped ? '<button class="rv-btn-ghost rv-btn-sm" data-act="unequip">卸下</button>' : '<span class="rv-r-na">·</span>') +
          '</div>' +
        '</div>'
      );
    }

    var backpackHtml = '';
    if (!s.player.backpack || s.player.backpack.length === 0) {
      backpackHtml = '<div class="rv-rest-empty">背包为空</div>';
    } else {
      for (var j = 0; j < s.player.backpack.length; j++) {
        var it = s.player.backpack[j];
        if (!it) continue;
        backpackHtml += (
          '<div class="rv-r-bp-row">' +
            itemCardHtml(it, { selected: false }) +
            '<div class="rv-r-bp-actions">' +
              '<button class="rv-btn-ghost rv-btn-sm" data-act="equip" data-uid="' + escapeHtml(it.uid) + '">装备</button>' +
              '<button class="rv-btn-ghost rv-btn-sm" data-act="sell" data-uid="' + escapeHtml(it.uid) + '">卖出</button>' +
            '</div>' +
          '</div>'
        );
      }
    }

    var statusRow =
      '<div class="rv-status-bar">' +
        statSeg('楼层', (s.climb.floor || 0) + '/35') +
        statSeg('💰', s.player.gold || 0) +
        statSeg('血瓶', countBrines(s.player)) +
      '</div>';

    var shell = openShell(
      '<div class="rv-modal rv-modal-wide">' +
        '<div class="rv-modal-q">🏕 休息站 · 换装</div>' +
        statusRow +
        tabNav('equip') +
        '<div class="rv-rest-section">' +
          '<div class="rv-rest-h">已装备（' + countEquipped(s) + '/' + RiftState.ITEM_SLOTS + '）</div>' +
          slotsHtml +
        '</div>' +
        '<div class="rv-rest-section">' +
          '<div class="rv-rest-h">背包（' + ((s.player.backpack || []).length) + '）</div>' +
          backpackHtml +
        '</div>' +
        '<div class="rv-modal-actions">' +
          '<button class="rv-btn-ghost rv-btn-full" id="rv-rest-close">关闭</button>' +
        '</div>' +
      '</div>'
    );

    bindTabs(shell, s);
    bindEquipActions(shell);
    shell.querySelector('#rv-rest-close').onclick = function () { closeShell(shell); };
  }

  function bindEquipActions(shell) {
    var Rift = window.Rift;
    var State = Rift.State;

    // 卸下
    var unequipBtns = shell.querySelectorAll('[data-act="unequip"]');
    for (var i = 0; i < unequipBtns.length; i++) {
      (function (btn) {
        btn.onclick = function () {
          var row = btn.closest('.rv-r-slot-row');
          var slotIdx = parseInt(row.getAttribute('data-slot-idx'), 10);
          if (State.unequipItem(slotIdx)) {
            refresh(shell);
          }
        };
      })(unequipBtns[i]);
    }

    // 装备 / 卖出（背包行）
    var bpRows = shell.querySelectorAll('.rv-r-bp-row');
    for (var k = 0; k < bpRows.length; k++) {
      (function (row) {
        var equipBtn = row.querySelector('[data-act="equip"]');
        var sellBtn = row.querySelector('[data-act="sell"]');
        if (equipBtn) {
          equipBtn.onclick = function () {
            var uid = equipBtn.getAttribute('data-uid');
            var card = row.querySelector('.rv-r-card');
            var slot = card && card.getAttribute('data-slot');
            // 找到匹配 slot 的槽位
            var slots = (window.DATA && window.DATA.slots) || [];
            var slotIdx = -1;
            for (var i = 0; i < slots.length; i++) {
              if (slots[i] === slot) { slotIdx = i; break; }
            }
            if (slotIdx < 0) {
              showToast(shell, '⚠ 槽位不匹配：' + slot);
              return;
            }
            if (State.equipItem(uid, slotIdx)) {
              refresh(shell);
            }
          };
        }
        if (sellBtn) {
          sellBtn.onclick = function () {
            var uid = sellBtn.getAttribute('data-uid');
            if (!window.confirm('卖出这件装备？')) return;
            State.sellItem(uid);
            refresh(shell);
          };
        }
      })(bpRows[k]);
    }
  }

  // ============================================================
  // Tab 2: 升级
  // ============================================================
  function renderTabUpgrade(s) {
    var Rift = window.Rift;
    var State = Rift.State, Economy = Rift.Economy;

    var html =
      '<div class="rv-modal rv-modal-wide">' +
        '<div class="rv-modal-q">⬆ 休息站 · 升级</div>' +
        statBar(s) +
        tabNav('upgrade') +
        '<div class="rv-rest-info">' +
          '80% 装备 +1 阶（最高 +2 到 T5）· 20% 装备碎裂 + 返还 30% 金币<br>' +
          'T6 紫词条 / 套装 不可升级。每次消耗 <b>' + UPGRADE_GOLD_COST + '</b> 金币。' +
        '</div>' +
        '<div class="rv-rest-section" id="rv-upgrade-list"></div>' +
        '<div class="rv-modal-actions">' +
          '<button class="rv-btn-ghost rv-btn-full" id="rv-rest-close">关闭</button>' +
        '</div>' +
      '</div>';

    var shell = openShell(html);
    bindTabs(shell, s);
    shell.querySelector('#rv-rest-close').onclick = function () { closeShell(shell); };
    paintUpgradeList(shell);
  }

  function paintUpgradeList(shell) {
    var Rift = window.Rift;
    var State = Rift.State, Economy = Rift.Economy;
    var s = State.getState();
    var list = shell.querySelector('#rv-upgrade-list');

    // 可升级候选 = 装备 + 背包中非 T6 非 set 的装
    var candidates = [];
    for (var i = 0; i < s.player.items.length; i++) {
      var eq = s.player.items[i];
      if (eq) candidates.push({ item: eq, origin: 'equipped', slotIdx: i });
    }
    for (var j = 0; j < (s.player.backpack || []).length; j++) {
      var bp = s.player.backpack[j];
      if (bp) candidates.push({ item: bp, origin: 'backpack' });
    }
    // 过滤 T6 / set
    candidates = candidates.filter(function (c) {
      return c.item.rarity !== 'set' && c.item.tier !== 'T6' &&
             (c.item.upgradeLevel || 0) < 2;
    });

    if (candidates.length === 0) {
      list.innerHTML = '<div class="rv-rest-empty">无可升级装备</div>';
      return;
    }

    var inner = '';
    for (var k = 0; k < candidates.length; k++) {
      var c = candidates[k];
      var it = c.item;
      var disabled = (s.player.gold || 0) < UPGRADE_GOLD_COST ? ' disabled' : '';
      var canBuy = (s.player.gold || 0) >= UPGRADE_GOLD_COST;
      inner += (
        '<div class="rv-upg-row" data-uid="' + escapeHtml(it.uid) + '">' +
          itemCardHtml(it) +
          '<div class="rv-upg-actions">' +
            '<button class="rv-btn-primary rv-btn-sm" data-act="upgrade"' + disabled + '>' +
              (canBuy ? '升级 -' + UPGRADE_GOLD_COST + '💰' : '金币不足') +
            '</button>' +
          '</div>' +
        '</div>'
      );
    }
    list.innerHTML = inner;

    var btns = list.querySelectorAll('[data-act="upgrade"]');
    for (var m = 0; m < btns.length; m++) {
      (function (btn) {
        btn.onclick = function () {
          var uid = btn.closest('.rv-upg-row').getAttribute('data-uid');
          if (!window.confirm('升级一旦失败，装备可能碎裂且无法回滚。继续？')) return;
          // 找到装备
          var cur = State.getState();
          var target = null;
          for (var a = 0; a < cur.player.items.length; a++) {
            if (cur.player.items[a] && cur.player.items[a].uid === uid) { target = cur.player.items[a]; break; }
          }
          if (!target) {
            for (var b = 0; b < cur.player.backpack.length; b++) {
              if (cur.player.backpack[b] && cur.player.backpack[b].uid === uid) { target = cur.player.backpack[b]; break; }
            }
          }
          if (!target) return;
          // 扣金 → 调用 upgrade
          State.takeResource('gold', UPGRADE_GOLD_COST);
          var r = Economy.upgradeItem(target);
          // 处理结果（碎裂 → 从 items/backpack 删除）
          if (r.success) {
            // 写回新装备（替换原对象）
            // Economy.upgradeItem 修改的是 in-place，但对象引用已替换
            showToast(shell, '✅ ' + (r.message || '升级成功'));
          } else {
            // 碎裂 / 失败 → 删除
            removeItemByUid(uid);
            showToast(shell, '💥 ' + (r.message || r.error || '装备碎裂'), 'danger');
          }
          // 保存
          State.save(State.getState());
          paintUpgradeList(shell);
          // 顶部状态条更新
          shell.querySelector('.rv-status-bar').outerHTML = statBar(State.getState());
        };
      })(btns[m]);
    }
  }

  function removeItemByUid(uid) {
    var State = RiftState;
    var s = State.getState();
    for (var i = 0; i < s.player.items.length; i++) {
      if (s.player.items[i] && s.player.items[i].uid === uid) {
        s.player.items[i] = null;
        return true;
      }
    }
    for (var j = 0; j < (s.player.backpack || []).length; j++) {
      if (s.player.backpack[j] && s.player.backpack[j].uid === uid) {
        s.player.backpack.splice(j, 1);
        return true;
      }
    }
    return false;
  }

  // ============================================================
  // Tab 3: 融入
  // ============================================================
  function renderTabFuse(s) {
    var Rift = window.Rift;
    var State = Rift.State, Economy = Rift.Economy;

    var html =
      '<div class="rv-modal rv-modal-wide">' +
        '<div class="rv-modal-q">⚗ 休息站 · 融入</div>' +
        statBar(s) +
        tabNav('fuse') +
        '<div class="rv-rest-info">' +
          '三件同稀有度装融入 · ' + FUSE_RATE_DISPLAY + '<br>' +
          '套装不可融。' +
        '</div>' +
        '<div class="rv-rest-section" id="rv-fuse-pool"></div>' +
        '<div class="rv-rest-section" id="rv-fuse-slots"></div>' +
        '<div class="rv-modal-actions">' +
          '<button class="rv-btn-primary rv-btn-full" id="rv-rest-fuse-go" disabled>⚗ 选 3 件后融入</button>' +
          '<button class="rv-btn-ghost rv-btn-full" id="rv-rest-close">关闭</button>' +
        '</div>' +
      '</div>';

    var shell = openShell(html);
    bindTabs(shell, s);
    shell.querySelector('#rv-rest-close').onclick = function () { closeShell(shell); };
    paintFuseUI(shell);
  }

  function paintFuseUI(shell) {
    var Rift = window.Rift;
    var State = Rift.State, Economy = Rift.Economy;
    var s = State.getState();
    var poolEl = shell.querySelector('#rv-fuse-pool');
    var slotsEl = shell.querySelector('#rv-fuse-slots');
    var goBtn = shell.querySelector('#rv-rest-fuse-go');

    // 候选池 = 背包中可融入的（非 set）
    var candidates = (s.player.backpack || []).filter(function (it) { return it && it.rarity !== 'set'; });

    var selected = []; // selected uids
    // 渲染槽位
    slotsEl.innerHTML = '<div class="rv-rest-h">融入槽位</div>' +
      '<div class="rv-fuse-3slots">' +
        '<div class="rv-fuse-slot" data-pos="0">+</div>' +
        '<div class="rv-fuse-slot" data-pos="1">+</div>' +
        '<div class="rv-fuse-slot" data-pos="2">+</div>' +
      '</div>';
    var fuseSlots = slotsEl.querySelectorAll('.rv-fuse-slot');
    for (var i = 0; i < fuseSlots.length; i++) {
      (function (slotEl) {
        slotEl.onclick = function () {
          var pos = parseInt(slotEl.getAttribute('data-pos'), 10);
          if (selected[pos]) {
            // 卸下
            selected[pos] = null;
            renderSlots();
            renderPool();
          }
        };
      })(fuseSlots[i]);
    }

    function renderSlots() {
      for (var p = 0; p < 3; p++) {
        var slotEl = slotsEl.querySelector('.rv-fuse-slot[data-pos="' + p + '"]');
        var uid = selected[p];
        if (!uid) {
          slotEl.innerHTML = '+';
          slotEl.className = 'rv-fuse-slot';
          continue;
        }
        var it = findItem(uid);
        if (!it) {
          selected[p] = null;
          slotEl.innerHTML = '+';
          slotEl.className = 'rv-fuse-slot';
          continue;
        }
        slotEl.className = 'rv-fuse-slot rv-fuse-slot-filled';
        slotEl.innerHTML = itemCardHtml(it);
      }
      goBtn.disabled = !canFuse();
    }

    function renderPool() {
      if (candidates.length === 0) {
        poolEl.innerHTML = '<div class="rv-rest-empty">背包无可融入装备</div>';
        return;
      }
      var inner = '<div class="rv-rest-h">候选池</div>';
      for (var k = 0; k < candidates.length; k++) {
        var it = candidates[k];
        var alreadySelected = selected.indexOf(it.uid) >= 0;
        var disabled = alreadySelected ? ' disabled' : '';
        inner += (
          '<div class="rv-fuse-pool-row">' +
            itemCardHtml(it) +
            '<button class="rv-btn-ghost rv-btn-sm" data-fuse-pick="' + escapeHtml(it.uid) + '"' + disabled + '>' +
              (alreadySelected ? '已选' : '加入') +
            '</button>' +
          '</div>'
        );
      }
      poolEl.innerHTML = inner;

      var pickBtns = poolEl.querySelectorAll('[data-fuse-pick]');
      for (var n = 0; n < pickBtns.length; n++) {
        (function (btn) {
          if (btn.disabled) return;
          btn.onclick = function () {
            var uid = btn.getAttribute('data-fuse-pick');
            // 检查 rarity 一致
            var firstItem = null;
            for (var q = 0; q < 3; q++) { if (selected[q]) { firstItem = findItem(selected[q]); break; } }
            var newItem = findItem(uid);
            if (firstItem && firstItem.rarity !== newItem.rarity) {
              showToast(shell, '⚠ 三件必须同稀有度（当前：' + firstItem.rarity + '，新：' + newItem.rarity + '）', 'warn');
              return;
            }
            // 找一个空位
            var pos = -1;
            for (var p2 = 0; p2 < 3; p2++) {
              if (!selected[p2]) { pos = p2; break; }
            }
            if (pos < 0) {
              showToast(shell, '⚠ 3 个槽位已满，请先卸下一个', 'warn');
              return;
            }
            selected[pos] = uid;
            renderSlots();
            renderPool();
          };
        })(pickBtns[n]);
      }
    }

    function findItem(uid) {
      var cur = State.getState();
      for (var a = 0; a < cur.player.backpack.length; a++) {
        if (cur.player.backpack[a] && cur.player.backpack[a].uid === uid) return cur.player.backpack[a];
      }
      for (var b = 0; b < cur.player.items.length; b++) {
        if (cur.player.items[b] && cur.player.items[b].uid === uid) return cur.player.items[b];
      }
      return null;
    }

    function canFuse() {
      if (selected[0] && selected[1] && selected[2]) {
        var r0 = findItem(selected[0]).rarity;
        var r1 = findItem(selected[1]).rarity;
        var r2 = findItem(selected[2]).rarity;
        return r0 === r1 && r1 === r2;
      }
      return false;
    }

    goBtn.onclick = function () {
      if (!canFuse()) return;
      if (!window.confirm('融入一旦执行，三件装备会按概率消失/升阶/传奇，不可回滚。继续？')) return;
      var items = [findItem(selected[0]), findItem(selected[1]), findItem(selected[2])];
      // 移除 3 件
      for (var r = 0; r < items.length; r++) {
        removeItemByUid(items[r].uid);
      }
      // 重新刷新 state（移除后）
      var cur = State.getState();
      // 执行融入（调用 economy）
      var result = Economy.fuseItems(items);
      // 应用结果
      if (result.result === 'shattered') {
        cur.player.gold += (result.goldRefund || 0);
        State.save(cur);
        showFuseAnimation(shell, 'shattered', result);
        setTimeout(function () { closeShell(shell); }, 1500);
      } else if (result.result === 'high' && result.newItem) {
        cur.player.backpack = cur.player.backpack || [];
        cur.player.backpack.push(result.newItem);
        State.save(cur);
        showFuseAnimation(shell, 'high', result);
        setTimeout(function () { closeShell(shell); }, 2200);
      } else if (result.result === 'legendary' && result.newItem) {
        cur.player.backpack = cur.player.backpack || [];
        cur.player.backpack.push(result.newItem);
        State.save(cur);
        showFuseAnimation(shell, 'legendary', result);
        setTimeout(function () { closeShell(shell); }, 3000);
      }
    };

    renderSlots();
    renderPool();
  }

  function showFuseAnimation(shell, kind, result) {
    var cap = result && result.animation && result.animation.caption ? result.animation.caption : '融入';
    var color = result && result.animation && result.animation.color ? result.animation.color : '#ffaa00';
    var inner = shell.querySelector('.rv-modal') || shell.firstChild;
    if (!inner) return;
    inner.innerHTML =
      '<div class="rv-fuse-anim" style="color:' + color + '">' +
        '<div class="rv-fuse-anim-cap">' + cap + '</div>' +
        '<div class="rv-fuse-anim-sub">' + (result.message || '') + '</div>' +
      '</div>';
  }

  // ============================================================
  // 通用辅助
  // ============================================================
  function statSeg(label, val, cls) {
    return (
      '<div class="rv-seg ' + (cls || '') + '">' +
        '<div class="rv-seg-label">' + label + '</div>' +
        '<div class="rv-seg-val">' + val + '</div>' +
      '</div>'
    );
  }
  function statBar(s) {
    return (
      '<div class="rv-status-bar">' +
        statSeg('楼层', (s.climb.floor || 0) + '/35') +
        statSeg('💰', s.player.gold || 0) +
        statSeg('血瓶', countBrines(s.player)) +
      '</div>'
    );
  }
  function countBrines(player) {
    if (!player || !player.brines) return 0;
    var n = 0;
    for (var i = 0; i < player.brines.length; i++) n += (player.brines[i] && player.brines[i].amount) || 1;
    return n;
  }
  function countEquipped(s) {
    var n = 0;
    for (var i = 0; i < s.player.items.length; i++) {
      if (s.player.items[i]) n++;
    }
    return n;
  }

  function tabNav(active) {
    var tabs = [
      { id: 'equip',   label: '换装' },
      { id: 'upgrade', label: '升级' },
      { id: 'fuse',    label: '融入' }
    ];
    var inner = '';
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      var cls = 'rv-tab-btn' + (t.id === active ? ' rv-tab-active' : '');
      inner += '<button class="' + cls + '" data-tab="' + t.id + '">' + t.label + '</button>';
    }
    return '<div class="rv-rest-tabs">' + inner + '</div>';
  }

  function bindTabs(shell, s) {
    var btns = shell.querySelectorAll('[data-tab]');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.onclick = function () {
          var tab = btn.getAttribute('data-tab');
          // 关闭旧 shell，开新 tab
          var freshState = RiftState.getState();
          closeShell(shell);
          if (tab === 'equip')   renderTabEquip(freshState);
          if (tab === 'upgrade') renderTabUpgrade(freshState);
          if (tab === 'fuse')    renderTabFuse(freshState);
        };
      })(btns[i]);
    }
  }

  function refresh(shell) {
    // 当前 shell 关闭 + 重开（避免 DOM diff 复杂度）
    var cur = RiftState.getState();
    closeShell(shell);
    renderTabEquip(cur);
  }

  // toast
  function showToast(shell, msg, kind) {
    var existing = shell.querySelector('.rv-r-toast');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.className = 'rv-r-toast rv-r-toast-' + (kind || 'ok');
    el.textContent = msg;
    var target = shell.querySelector('.rv-modal') || shell;
    target.appendChild(el);
    setTimeout(function () { if (el && el.parentNode) el.remove(); }, 2500);
  }

  // ============================================================
  // 暴露 + 启动
  // ============================================================
  window.Rest = {
    open: open,
    openFuseAnimation: showFuseAnimation
  };

  // RiftState alias (本文件用 RiftState.* 引用)
  // 因为 const RiftState = {} 不会进 window，这里直接从 window.Rift 取
  // 但 climb-ui.js / state.js 已经挂 window.RiftState
  // 兜底：等 window.Rift / window.RiftState
  function ensureDeps() {
    if (!window.RiftState && window.Rift && window.Rift.State) {
      window.RiftState = window.Rift.State;
    }
  }
  ensureDeps();

  // console log
  console.log('[Rest] v1.0 loaded · Tabs: 换装 / 升级 / 融入');
})();