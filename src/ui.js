// ==================== 暗黑出装系统 - UI 交互层 ====================

const UI = {};

// ---------------- 状态 ----------------
UI.player = null;
UI.selectedItem = null;
UI.selectedSource = null; // 'inv' | 'equip'
UI.currentTab = 'battle';
UI.battleLog = [];

// ---------------- v1.4 · 背包虚拟滚动状态 ----------------
// 背包物品数 > INV_VIRTUAL_THRESHOLD 时自动切换虚拟模式：仅渲染视口内可见的卡片。
UI.INV_VIRTUAL_THRESHOLD = 30;   // 物品超过这个数 → 进入虚拟滚动
UI.INV_VIRTUAL_ROW_H = 86;        // 单行卡片高度（70 min-height + 6+6 padding + 4 gap）
UI.INV_VIRTUAL_BUFFER_ROWS = 3;   // 视口上下各多渲染 N 行作为 buffer（避免快速滚动时露白）
UI.INV_VIRTUAL = {
  items: [],           // 当前过滤后的物品列表（缓存避免重复 filter）
  filtered: false,     // 是否处于虚拟模式
  scrollTop: 0,
  containerW: 0,
  cols: 0,
  rows: 0,
  totalH: 0,
  startIdx: 0,
  endIdx: 0,
  rafId: null,         // requestAnimationFrame id（节流）
  savedScrollTop: null // 切 tab 后恢复用
};

// ---------------- v1.3 · 8-bit 战斗音效（Web Audio 合成） ----------------
// 完全用 Web Audio 合成 8-bit 风格音效，无任何外部音频文件依赖。
// 浏览器策略：AudioContext 必须在用户首次交互后 resume。
UI.Audio = (function () {
  const STORAGE_KEY = 'diablo_audio_muted';
  let ctx = null;
  let muted = false;

  // 读取本地静音偏好（默认不静音）
  try {
    muted = localStorage.getItem(STORAGE_KEY) === '1';
  } catch (e) {
    muted = false;
  }

  // 懒初始化 AudioContext（必须等用户首次点击/触摸）
  const ensureCtx = () => {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch (e) {
      ctx = null;
    }
    return ctx;
  };

  // 单音合成器：square / sawtooth / sine / triangle + ADSR 包络
  const tone = (freq, dur, type = 'square', opts = {}) => {
    const ac = ensureCtx();
    if (!ac || muted) return;
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    const startFreq = opts.startFreq != null ? opts.startFreq : freq;
    const endFreq = freq;
    if (startFreq !== endFreq) {
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + (opts.glide || dur));
    } else {
      osc.frequency.setValueAtTime(freq, now);
    }
    // ADSR（attack/decay/sustain/release）— 8-bit 风格硬起硬落
    const peak = opts.peak != null ? opts.peak : 0.12;
    const attack = opts.attack != null ? opts.attack : 0.005;
    const release = opts.release != null ? opts.release : Math.max(0.02, dur * 0.4);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + attack);
    gain.gain.linearRampToValueAtTime(peak * 0.6, now + attack + Math.max(0.01, dur - attack - release));
    gain.gain.linearRampToValueAtTime(0, now + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  };

  // 噪声合成器：白噪音短爆（用于怪物击中）
  const noise = (dur, peak = 0.08, filterFreq = 1200) => {
    const ac = ensureCtx();
    if (!ac || muted) return;
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    const now = ac.currentTime;
    const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = filterFreq;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(flt).connect(gain).connect(ac.destination);
    src.start(now);
    src.stop(now + dur);
  };

  // 和弦合成：3 个音同时响起（用于升级/打造）
  const chord = (freqs, dur, type = 'triangle', peak = 0.08) => {
    freqs.forEach((f, i) => setTimeout(() => tone(f, dur, type, { peak: peak / freqs.length }), i * 30));
  };

  // 公开 API：8-bit 风格音效用例
  return {
    muted: () => muted,

    // 用户首次交互时调用，解锁 AudioContext
    unlock: () => {
      const ac = ensureCtx();
      if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
    },

    // 切换静音
    toggleMute: () => {
      muted = !muted;
      try { localStorage.setItem(STORAGE_KEY, muted ? '1' : '0'); } catch (e) {}
      return muted;
    },

    // ---------------- 战斗音效 ----------------
    // 玩家击中怪物 — 短方波（200Hz, 80ms）
    hit: () => tone(220, 0.08, 'square', { peak: 0.1 }),

    // 玩家暴击 — 上扫 square 波（200→600Hz, 150ms）
    crit: () => tone(600, 0.15, 'sawtooth', { startFreq: 200, glide: 0.12, peak: 0.14 }),

    // 怪物击中玩家 — 噪声爆裂（80ms, 低通 800Hz）
    monsterHit: () => noise(0.08, 0.07, 800),

    // 怪物暴击 — 噪声 + 低频三角波双层
    monsterCrit: () => {
      noise(0.12, 0.1, 1200);
      tone(120, 0.12, 'triangle', { peak: 0.12 });
    },

    // 击杀 — 3 音上行小号（C5→E5→G5）
    kill: () => {
      tone(523, 0.1, 'square', { peak: 0.1 });
      setTimeout(() => tone(659, 0.1, 'square', { peak: 0.1 }), 80);
      setTimeout(() => tone(784, 0.18, 'square', { peak: 0.12 }), 160);
    },

    // 玩家死亡 — 下行锯齿（300→80Hz, 400ms）
    die: () => tone(300, 0.4, 'sawtooth', { startFreq: 300, endFreq: 80, glide: 0.4, peak: 0.13 }),

    // 胜利（战斗结束）— 4 音上行琶音（C4-E4-G4-C5）
    victory: () => {
      [262, 330, 392, 523].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'square', { peak: 0.11 }), i * 90));
    },

    // 失败 — 下行三音（悲壮）
    defeat: () => {
      [330, 294, 220].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', { peak: 0.1 }), i * 120));
    },

    // ---------------- 系统音效 ----------------
    // UI 按钮点击 — 超短促方波（1000Hz, 30ms）
    click: () => tone(1000, 0.03, 'square', { peak: 0.06 }),

    // 拾取装备 — 上滑方波（400→800Hz, 80ms）
    pickup: () => tone(800, 0.08, 'square', { startFreq: 400, glide: 0.06, peak: 0.08 }),

    // 出售装备 — 下滑方波（500→200Hz, 100ms） + 金币感
    sell: () => {
      tone(500, 0.05, 'square', { peak: 0.08 });
      setTimeout(() => tone(800, 0.05, 'square', { peak: 0.08 }), 40);
    },

    // 装备穿上 — 金属碰撞感（高音 square + 短 noise 混合）
    equip: () => {
      tone(880, 0.05, 'square', { peak: 0.1 });
      noise(0.04, 0.05, 3000);
    },

    // 打造装备 — 3 音上行和弦（合成音效） + 锻造噪声爆裂
    craft: () => {
      noise(0.18, 0.06, 2000);
      setTimeout(() => chord([262, 330, 392], 0.15, 'triangle', 0.1), 60);
    },

    // 升级 — 5 音上行号角（C4-D4-E4-G4-C5）
    levelUp: () => {
      [262, 294, 330, 392, 523].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'square', { peak: 0.1 }), i * 80));
    },

    // 错误 / 缺料 — 下行短促双音
    error: () => {
      tone(200, 0.06, 'square', { peak: 0.08 });
      setTimeout(() => tone(150, 0.08, 'square', { peak: 0.08 }), 60);
    },

    // Boss 登场 — 低频扫频 + 噪声嗡鸣（制造紧张感）
    bossAppear: () => {
      tone(80, 0.6, 'sawtooth', { startFreq: 40, glide: 0.6, peak: 0.1 });
      noise(0.4, 0.04, 400);
    },

    // 战斗开始倒计时（3 音 TICK）
    tick: () => tone(880, 0.04, 'square', { peak: 0.06 })
  };
})();

// ---------------- 初始化 ----------------
UI.init = function () {
  // 品牌图标
  document.getElementById('brand-sword').innerHTML = UI.getIcon('sword', 28);
  // 顶栏小图标（可选）
  document.getElementById('status-class-wrap').insertAdjacentHTML('afterbegin', UI.getIcon('class_barbarian', 16));
  document.getElementById('status-gold-wrap').insertAdjacentHTML('afterbegin', UI.getIcon('gold', 16));
  document.getElementById('status-exp-wrap').insertAdjacentHTML('afterbegin', UI.getIcon('mana', 16));

  UI.player = Game.load() || Game.createPlayer('barbarian');
  window.player = UI.player;
  // 给玩家一点初始装备
  if (Object.keys(UI.player.equipped).length === 0 && UI.player.inventory.length === 0) {
    UI.giveStarterGear();
  }
  UI.bindEvents();
  UI.renderAll();
  UI.renderSnapshots();
  UI.log('系统启动完成。欢迎来到暗黑世界。', 'info');

  // 首次进入显示开场叙事
  if (!localStorage.getItem('diablo_intro_seen')) {
    UI.showIntro();
  }
};

UI.giveStarterGear = function () {
  // 初始金币
  UI.player.gold = 300;
  // 初始装备：每槽一件稀有
  for (const slot of DATA.slots) {
    if (slot === 'ring1' || slot === 'ring2') {
      if (slot === 'ring1') {
        const it = Game.generateItem(UI.player.level, 'rare', 'ring1', UI.player.classId);
        if (it) UI.player.inventory.push(it);
      }
      continue;
    }
    const it = Game.generateItem(UI.player.level, 'rare', slot, UI.player.classId);
    if (it) UI.player.equipped[slot] = it;
  }
  // v1.1 · 初始宝石：每种 1 颗，让玩家立刻体验镶嵌
  for (const gid in DATA.gems) {
    const gem = Game.createGemItem(gid);
    if (gem) UI.player.inventory.push(gem);
  }
  // v1.1 · 初始附魔材料：每种 2 颗，让玩家立刻体验附魔
  for (const mid in DATA.enchantMaterials) {
    for (let n = 0; n < 2; n++) {
      const mat = Game.createMaterialItem(mid);
      if (mat) UI.player.inventory.push(mat);
    }
  }
  UI.log('获得初始装备：全套稀有品质 + 5 颗量子裂隙宝石 ◆ + 8 个附魔材料 ⚒', 'epic');
};

// ---------------- 事件 ----------------
UI.bindEvents = function () {
  // v1.3 · 首次任意点击/触摸 — 解锁 AudioContext（满足浏览器 autoplay policy）
  const unlockOnce = () => {
    UI.Audio.unlock();
    document.removeEventListener('pointerdown', unlockOnce, true);
    document.removeEventListener('keydown', unlockOnce, true);
  };
  document.addEventListener('pointerdown', unlockOnce, true);
  document.addEventListener('keydown', unlockOnce, true);

  // v1.3 · 全局按钮点击音效（事件委托，避免逐一修改每个 listener）
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target.closest('button, .tab, .cls-btn, .skill-btn, .inv-item, .equip-cell, .recommend-btn')) {
      UI.Audio.click();
    }
  });

  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => UI.switchTab(t.dataset.tab));
  });

  // v1.3 · 怪物图鉴筛选按钮（事件委托）
  document.querySelectorAll('.codex-filter').forEach(btn => {
    btn.addEventListener('click', () => UI.setCodexMonsterFilter(btn.dataset.mf));
  });

  document.getElementById('btn-save').addEventListener('click', () => {
    Game.save(UI.player);
    UI.log('游戏已保存。', 'good');
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('确认重置所有进度？此操作不可恢复。')) {
      Game.reset();
      UI.player = Game.createPlayer('barbarian');
      window.player = UI.player;
      UI.giveStarterGear();
      UI.renderAll();
      UI.log('进度已重置。', 'info');
    }
  });

  document.getElementById('btn-craft').addEventListener('click', () => UI.craftItem());
  document.getElementById('btn-sort').addEventListener('click', () => {
    UI.sortInventory();
    UI.renderInventory();
  });
  document.getElementById('btn-sell-junk').addEventListener('click', () => {
    UI.sellJunk();
    UI.renderInventory();
    UI.renderAll();
  });

  document.getElementById('filter-rarity').addEventListener('change', () => {
    // v1.4 · 过滤变化时重置 scroll 位置
    UI.INV_VIRTUAL.savedScrollTop = 0;
    UI.renderInventory();
  });
  document.getElementById('filter-slot').addEventListener('change', () => {
    UI.INV_VIRTUAL.savedScrollTop = 0;
    UI.renderInventory();
  });

  // v1.1 · Build 推荐器
  const recClass = document.getElementById('recommend-class');
  if (recClass) {
    // 初始化职业下拉
    let optHtml = '';
    for (const cId in DATA.classes) {
      const c = DATA.classes[cId];
      optHtml += `<option value="${cId}" ${cId === UI.player.classId ? 'selected' : ''}>${c.name}</option>`;
    }
    recClass.innerHTML = optHtml;
    recClass.addEventListener('change', () => UI.renderRecommend());
    const recLevel = document.getElementById('recommend-level');
    if (recLevel) {
      recLevel.value = UI.player.level;
      recLevel.addEventListener('change', () => UI.renderRecommend());
    }
  }

  // v1.1 · Build 导出/导入
  const btnExport = document.getElementById('btn-export');
  if (btnExport) btnExport.addEventListener('click', () => UI.showExportModal());
  const btnImport = document.getElementById('btn-import');
  if (btnImport) btnImport.addEventListener('click', () => UI.showImportModal());
  const exportClose = document.getElementById('export-close');
  if (exportClose) exportClose.addEventListener('click', () => UI.hideExportModal());
  const exportCopy = document.getElementById('export-copy');
  if (exportCopy) exportCopy.addEventListener('click', () => UI.copyExportText());
  const importClose = document.getElementById('import-close');
  if (importClose) importClose.addEventListener('click', () => UI.hideImportModal());
  const importConfirm = document.getElementById('import-confirm');
  if (importConfirm) importConfirm.addEventListener('click', () => UI.confirmImport());

  // v1.1 · Build 历史快照 按钮
  const btnSnapSave = document.getElementById('btn-snapshot-save');
  if (btnSnapSave) btnSnapSave.addEventListener('click', () => UI.saveCurrentSnapshot());
  const btnSnapClear = document.getElementById('btn-snapshot-clear');
  if (btnSnapClear) btnSnapClear.addEventListener('click', () => UI.clearAllSnapshots());
  // v1.5 第 3 项 · 快照职业过滤下拉（change 事件 → setSnapshotClassFilter）
  const classFilter = document.getElementById('snapshot-class-filter');
  if (classFilter) {
    classFilter.addEventListener('change', (e) => UI.setSnapshotClassFilter(e.target.value));
  }

  // v1.3 · 系统日志时间线（筛选 + 清空）
  document.querySelectorAll('.log-filter').forEach(btn => {
    btn.addEventListener('click', () => UI.setLogFilter(btn.dataset.filter));
  });
  const btnLogClear = document.getElementById('log-clear');
  if (btnLogClear) btnLogClear.addEventListener('click', () => UI.clearLog());

  // v1.4 第 2 项 · 战斗缓存统计 — CLEAR 按钮 + 初始渲染
  const btnCacheClear = document.getElementById('bcs-clear');
  if (btnCacheClear) btnCacheClear.addEventListener('click', () => UI.clearBattleCache());
  UI.renderBattleCacheStats('—');

  // v1.3 · 静音切换按钮（顶栏 actions 区）
  const btnMute = document.getElementById('btn-mute');
  if (btnMute) {
    const syncMuteBtn = (isMuted) => {
      btnMute.textContent = isMuted ? '🔇' : '🔊';
      btnMute.title = isMuted ? '点击开启音效' : '点击静音';
      btnMute.classList.toggle('muted', isMuted);
    };
    syncMuteBtn(UI.Audio.muted());
    btnMute.addEventListener('click', () => {
      UI.Audio.unlock();
      const nowMuted = UI.Audio.toggleMute();
      syncMuteBtn(nowMuted);
      if (!nowMuted) UI.Audio.click();
    });
  }

  // Intro 屏幕
  document.getElementById('intro-enter').addEventListener('click', () => UI.hideIntro());
  document.getElementById('intro-skip').addEventListener('click', () => UI.hideIntro());

  // v1.3 · 新手引导（3 步教程）
  document.getElementById('tutorial-next').addEventListener('click', () => UI.nextTutorial());
  document.getElementById('tutorial-prev').addEventListener('click', () => UI.prevTutorial());
  document.getElementById('tutorial-close').addEventListener('click', () => UI.endTutorial());
  // 窗口尺寸变化 / 字体加载完后 reflow 聚光灯位置
  window.addEventListener('resize', () => UI.reflowTutorialSpotlight());
  // 字体加载完成后再 reflow 一次（Press Start 2P 加载后元素宽度可能变化）
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => UI.reflowTutorialSpotlight());
  }

  // Lore modal
  document.getElementById('lore-close').addEventListener('click', () => UI.hideLore());
  document.getElementById('lore-fight').addEventListener('click', () => {
    const idx = parseInt(document.getElementById('lore-fight').dataset.idx);
    UI.hideLore();
    if (!isNaN(idx)) UI.battle(idx);
  });
};

UI.switchTab = function (tab) {
  const prevTab = UI.currentTab;
  UI.currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + tab));
  // v1.4 · 离开 inventory tab 时保存滚动位置（虚拟模式需要恢复）
  if (prevTab === 'inventory' && tab !== 'inventory' && UI.INV_VIRTUAL.filtered) {
    const grid = document.getElementById('inventory-grid');
    if (grid) UI.INV_VIRTUAL.savedScrollTop = grid.scrollTop;
  }
  if (tab === 'inventory') UI.renderInventory();
  else if (tab === 'codex') UI.renderCodex();
  else if (tab === 'craft') { UI.renderCraft(); UI.renderRecipes(); }
  else if (tab === 'battle') UI.renderBattle();
  else if (tab === 'recommend') { UI.renderRecommend(); UI.renderSnapshots(); }
  // v1.3 · 教程激活时切 tab 后 reflow spotlight（下次 renderTutorialStep 已含 reflow，仅首次切换时也需要）
  setTimeout(() => UI.reflowTutorialSpotlight(), 50);
};

// ---------------- 渲染 ----------------
UI.renderAll = function () {
  // v1.4 第 2 项 · 不再在每次 renderAll 失效缓存（缓存跨渲染复用，提升性能）
  // 真正的失效点在：UI.battle（战斗开始前）、UI.equipItem/UI.unequipItem（装备改动）、Game.levelUp（升级）
  UI.renderTopbar();
  UI.renderCharacter();
  UI.renderEquipment();
  UI.renderSets();
  UI.renderBattle();
  if (UI.currentTab === 'inventory') UI.renderInventory();
  else if (UI.currentTab === 'codex') UI.renderCodex();
  else if (UI.currentTab === 'craft') UI.renderCraft();
  else if (UI.currentTab === 'recommend') UI.renderRecommend();
  UI.renderItemDetail();
  UI.renderSnapshots();
};

UI.renderTopbar = function () {
  document.getElementById('ui-level').textContent = UI.player.level;
  document.getElementById('ui-class').textContent = DATA.classes[UI.player.classId].name;
  document.getElementById('ui-gold').textContent = UI.player.gold;
  document.getElementById('ui-exp').textContent = UI.player.exp;
  document.getElementById('ui-exp-max').textContent = UI.player.level * 100;
  const build = Game.aggregateBuild(UI.player);
  const dps = Game.calcDPS(build);
  document.querySelector('#ui-dps b').textContent = Math.round(dps.dps);
};

UI.renderCharacter = function () {
  const p = UI.player;
  const build = Game.aggregateBuild(p);
  const m = build.mods;

  let html = '<div class="char-class-pick">';
  for (const cId in DATA.classes) {
    const c = DATA.classes[cId];
    const icon = UI.getIcon('class_' + cId, 24);
    html += `<button class="char-class-btn ${cId === p.classId ? 'active' : ''}" data-class="${cId}" title="${c.back}">${icon}${c.name}</button>`;
  }
  html += '</div>';

  // 当前角色背景
  const cur = DATA.classes[p.classId];
  html += `<div style="font-size: 12px; color: var(--text-dim); font-style: italic; margin: 6px 0; padding: 6px; background: var(--bg-black); border-left: 3px solid ${cur.color};">${cur.back}</div>`;

  // 技能选择
  html += '<div class="sub-title">// SKILLS</div><div class="skill-pick">';
  for (const s of DATA.classes[p.classId].skills) {
    html += `<button class="skill-btn ${s.id === p.skillId ? 'active' : ''}" data-skill="${s.id}">${s.name}<div class="skill-desc">${s.desc}</div></button>`;
  }
  html += '</div>';

  // 属性
  html += '<div class="sub-title">// STATS</div><div class="stat-grid">';
  const statRows = [
    { k: 'str', v: Math.round(m.str), cls: '' },
    { k: 'dex', v: Math.round(m.dex), cls: '' },
    { k: 'int', v: Math.round(m.int), cls: '' },
    { k: 'vit', v: Math.round(m.vit), cls: '' },
    { k: 'fth', v: Math.round(m.fth), cls: '' },
    { k: 'life', v: Math.round(m.life), cls: 'hp', label: '生命' },
    { k: 'mana', v: Math.round(m.mana), cls: 'mp', label: '法力' },
    { k: 'ac', v: Math.round(m.ac), cls: '', label: '防御' }
  ];
  for (const r of statRows) {
    const label = r.label || DATA.statNames[r.k];
    html += `<div class="stat-row"><span class="stat-name">${label}</span><span class="stat-val ${r.cls}">${r.v}</span></div>`;
  }
  html += '</div>';

  document.getElementById('character-panel').innerHTML = html;

  document.querySelectorAll('.char-class-btn').forEach(b => {
    b.addEventListener('click', () => {
      UI.player.classId = b.dataset.class;
      UI.player.skillId = DATA.classes[b.dataset.class].skills[0].id;
      UI.renderAll();
      UI.log('切换职业：' + DATA.classes[b.dataset.class].name, 'info');
    });
  });

  document.querySelectorAll('.skill-btn').forEach(b => {
    b.addEventListener('click', () => {
      UI.player.skillId = b.dataset.skill;
      UI.renderAll();
    });
  });
};

UI.renderEquipment = function () {
  const html = DATA.slots.map(slot => {
    const item = UI.player.equipped[slot];
    const iconKey = UI.slotIcon(slot);
    const icon = UI.getIcon(iconKey, 32);
    if (item) {
      const rarity = item.rarity;
      return `<div class="equip-slot filled" data-slot="${slot}">
        <div class="slot-icon">${icon}</div>
        <div class="slot-info">
          <div class="slot-name rarity-${rarity}">${item.name}</div>
          <div class="slot-sub">${DATA.slotNames[slot]} · ${DATA.rarities[rarity].name}</div>
        </div>
      </div>`;
    } else {
      return `<div class="equip-slot empty" data-slot="${slot}">
        <div class="slot-icon">${icon}</div>
        <div class="slot-info">
          <div class="slot-name">[ ${DATA.slotNames[slot]} ]</div>
        </div>
      </div>`;
    }
  }).join('');

  document.getElementById('equipment-grid').innerHTML = html;

  document.querySelectorAll('.equip-slot').forEach(el => {
    el.addEventListener('click', () => {
      const slot = el.dataset.slot;
      const item = UI.player.equipped[slot];
      if (item) {
        UI.selectedItem = item;
        UI.selectedSource = 'equip';
        UI.renderItemDetail();
      }
    });
  });
};

UI.renderSets = function () {
  const equipped = Object.values(UI.player.equipped).filter(Boolean);
  const setMap = {};
  for (const it of equipped) {
    if (it.setId) {
      setMap[it.setId] = setMap[it.setId] || [];
      setMap[it.setId].push(it);
    }
  }

  let html = '';
  // 显示当前激活的套装
  for (const setId in setMap) {
    const set = DATA.sets.find(s => s.id === setId);
    const items = setMap[setId];
    const count = items.length;
    const active = count >= 2;
    html += `<div class="set-entry ${active ? 'active' : ''}">
      <div class="set-name" style="color: ${set.color}">${set.name} · ${count}/${set.pieces.length}</div>`;
    for (const tKey of Object.keys(set.bonuses)) {
      const t = parseInt(tKey, 10);
      const isOn = count >= t;
      html += `<div class="set-bonus ${isOn ? 'on' : ''}">[${t}] ${set.bonuses[t].desc}</div>`;
    }
    html += '</div>';
  }

  if (!html) {
    html = '<div class="placeholder">EQUIP SET PIECES TO ACTIVATE</div>';
  }
  document.getElementById('set-list').innerHTML = html;
};

UI.renderInventory = function () {
  // 槽位过滤
  const slotFilter = document.getElementById('filter-slot');
  if (slotFilter.children.length <= 1) {
    for (const s of DATA.slots) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = DATA.slotNames[s];
      slotFilter.appendChild(opt);
    }
  }

  const rarityFilter = document.getElementById('filter-rarity').value;
  const slotF = slotFilter.value;
  const items = UI.player.inventory.filter(i =>
    (rarityFilter === 'all' || i.rarity === rarityFilter) &&
    (slotF === 'all' || i.slot === slotF)
  );

  // v1.4 · 物品数 > 阈值 → 虚拟滚动模式
  if (items.length > UI.INV_VIRTUAL_THRESHOLD) {
    UI._renderInventoryVirtual(items);
    return;
  }

  // 物品少 → 退回传统 CSS Grid 全量渲染
  UI._renderInventoryNormal(items);
};

// 传统模式（< threshold）
UI._renderInventoryNormal = function (items) {
  const grid = document.getElementById('inventory-grid');
  // 移除虚拟模式 class
  grid.classList.remove('inv-virtual');
  // 隐藏虚拟统计条
  const stats = document.getElementById('inventory-virtual-stats');
  if (stats) stats.style.display = 'none';
  // 清除虚拟状态
  UI.INV_VIRTUAL.filtered = false;
  UI.INV_VIRTUAL.items = [];
  // 解绑虚拟 scroll 监听（如有）
  grid.onscroll = null;

  if (items.length === 0) {
    grid.innerHTML = '<div class="placeholder" style="grid-column: 1/-1">背包空空如也。去打造吧！</div>';
    return;
  }

  const html = items.map(item => {
    return UI._renderInventoryCardHTML(item);
  }).join('');

  grid.innerHTML = html;
  UI._bindInventoryCardClicks(grid);
};

// 虚拟模式（≥ threshold）
UI._renderInventoryVirtual = function (items) {
  const grid = document.getElementById('inventory-grid');
  const stats = document.getElementById('inventory-virtual-stats');
  const shownEl = document.getElementById('inv-virtual-shown');
  const totalEl = document.getElementById('inv-virtual-total');

  // 标记虚拟模式
  grid.classList.add('inv-virtual');
  if (stats) stats.style.display = 'flex';

  UI.INV_VIRTUAL.filtered = true;
  UI.INV_VIRTUAL.items = items;
  UI.INV_VIRTUAL.scrollTop = grid.scrollTop || 0;

  // 计算列数（基于容器宽度 + 单卡 140px + 4px gap）
  // 防御：clientWidth 可能为 0（隐藏 tab）→ 退回 4 列默认
  const containerW = (grid.clientWidth || 580) - 8;
  const cardW = 144; // minmax(140px,1fr) + gap 4px
  UI.INV_VIRTUAL.containerW = containerW;
  UI.INV_VIRTUAL.cols = Math.max(1, Math.floor((containerW + 4) / cardW));
  UI.INV_VIRTUAL.rows = Math.ceil(items.length / UI.INV_VIRTUAL.cols);
  UI.INV_VIRTUAL.totalH = UI.INV_VIRTUAL.rows * UI.INV_VIRTUAL_ROW_H;

  if (totalEl) totalEl.textContent = items.length;

  // 第一次进入虚拟模式 → 设置 spacer + viewport + scroll listener
  if (!grid.querySelector('.inv-virtual-spacer')) {
    grid.innerHTML = '<div class="inv-virtual-spacer"></div><div class="inv-virtual-viewport"></div>';
  }

  // spacer 高度 = 撑出 scrollbar 的总高
  const spacer = grid.querySelector('.inv-virtual-spacer');
  if (spacer) {
    spacer.style.height = UI.INV_VIRTUAL.totalH + 'px';
  }

  // 视口高度 = 容器 max-height
  const viewport = grid.querySelector('.inv-virtual-viewport');
  if (viewport) {
    viewport.style.height = '480px';
    // 移动端用 CSS 控制，这里仅做 desktop 适配
  }

  // scroll 监听（每次渲染只绑一次）
  grid.onscroll = () => UI._onInventoryScroll();

  // 渲染可见窗口
  UI._renderInventoryViewport();

  // 恢复上次的 scrollTop（避免切 tab 后丢位置）
  if (UI.INV_VIRTUAL.savedScrollTop != null) {
    grid.scrollTop = UI.INV_VIRTUAL.savedScrollTop;
    UI.INV_VIRTUAL.savedScrollTop = null;
  }
};

// 滚动事件 → 重渲染视口（带 16ms 节流 ≈ 60fps）
UI._onInventoryScroll = function () {
  if (!UI.INV_VIRTUAL.filtered) return;
  const grid = document.getElementById('inventory-grid');
  UI.INV_VIRTUAL.scrollTop = grid.scrollTop;
  if (UI.INV_VIRTUAL.rafId) return;
  UI.INV_VIRTUAL.rafId = requestAnimationFrame(() => {
    UI.INV_VIRTUAL.rafId = null;
    UI._renderInventoryViewport();
  });
};

// 计算可见窗口并渲染
UI._renderInventoryViewport = function () {
  const v = UI.INV_VIRTUAL;
  const grid = document.getElementById('inventory-grid');
  const viewport = grid.querySelector('.inv-virtual-viewport');
  if (!viewport) return;

  const viewH = grid.clientHeight; // 视口高度 ≈ max-height
  const rowH = UI.INV_VIRTUAL_ROW_H;
  const cols = v.cols;
  const items = v.items;
  const total = items.length;

  // 当前 scrollTop 对应的行号
  const firstVisibleRow = Math.floor(v.scrollTop / rowH);
  const visibleRows = Math.ceil(viewH / rowH);

  // 加 buffer 防止快速滚动露白
  const startRow = Math.max(0, firstVisibleRow - UI.INV_VIRTUAL_BUFFER_ROWS);
  const endRow = Math.min(
    v.rows,
    firstVisibleRow + visibleRows + UI.INV_VIRTUAL_BUFFER_ROWS
  );

  const startIdx = startRow * cols;
  const endIdx = Math.min(total, endRow * cols);

  v.startIdx = startIdx;
  v.endIdx = endIdx;

  // 生成可见卡片 HTML
  const html = [];
  for (let i = startIdx; i < endIdx; i++) {
    const item = items[i];
    if (!item) continue;
    const row = Math.floor(i / cols);
    const col = i % cols;
    const top = row * rowH;
    const left = col * (140 + 4); // 140px card + 4px gap
    const cardHtml = UI._renderInventoryCardHTML(item);
    html.push(`<div style="position:absolute; top:${top}px; left:${left}px; width:140px;">${cardHtml}</div>`);
  }
  viewport.innerHTML = html.join('');

  // 更新统计
  const shownEl = document.getElementById('inv-virtual-shown');
  if (shownEl) shownEl.textContent = (endIdx - startIdx);

  // 重新挂载点击（虚拟模式每次重新渲染 viewport）
  UI._bindInventoryCardClicks(viewport);
};

// 提取单卡 HTML（normal + virtual 共用）
UI._renderInventoryCardHTML = function (item) {
  const isSel = UI.selectedItem && UI.selectedItem.uid === item.uid;
  let iconKey, icon, subText;
  if (item.type === 'gem') {
    iconKey = 'gem_' + item.gemId;
    icon = UI.getGemIcon(item.gemId, 24);
    subText = `◆ 宝石 · ${DATA.rarities[item.rarity].name}`;
  } else if (item.type === 'material') {
    icon = UI.getMaterialIcon(item.materialId, 24);
    const m = DATA.enchantMaterials[item.materialId];
    subText = `⚒ 附魔材料 · ${m ? m.pool : ''}`;
  } else {
    iconKey = UI.slotIcon(item.slot);
    icon = UI.getIcon(iconKey, 24);
    const filledSockets = (item.gems || []).filter(Boolean).length;
    const socketInfo = item.socketCount > 0 ? ` · ${filledSockets}/${item.socketCount}◆` : '';
    subText = `${DATA.slotNames[item.slot]} · ${DATA.rarities[item.rarity].name} · iL${item.ilvl}${socketInfo}`;
  }
  return `<div class="inv-slot rarity-${item.rarity} ${isSel ? 'selected' : ''}" data-uid="${item.uid}">
    <div class="inv-icon">${icon}</div>
    <div class="inv-name rarity-${item.rarity}">${item.name}</div>
    <div class="inv-sub">${subText}</div>
  </div>`;
};

// 点击事件绑定（事件委托模式 — 单个 listener 处理所有卡片）
UI._bindInventoryCardClicks = function (container) {
  container.querySelectorAll('.inv-slot').forEach(el => {
    el.addEventListener('click', () => {
      const uid = el.dataset.uid;
      const item = UI.player.inventory.find(i => i.uid === uid);
      if (item) {
        UI.selectedItem = item;
        UI.selectedSource = 'inv';
        UI.renderItemDetail();
        // 选中态变更 → 重渲染
        if (UI.INV_VIRTUAL.filtered) {
          // 虚拟模式：只刷新视口内的卡片（避免丢 scrollTop）
          UI._renderInventoryViewport();
        } else {
          // 普通模式：重新拿当前过滤后的 items 重渲染
          const rarityFilter = document.getElementById('filter-rarity').value;
          const slotF = document.getElementById('filter-slot').value;
          const items = UI.player.inventory.filter(i =>
            (rarityFilter === 'all' || i.rarity === rarityFilter) &&
            (slotF === 'all' || i.slot === slotF)
          );
          UI._renderInventoryNormal(items);
        }
      }
    });
  });
};

UI.renderBattle = function () {
  // 怪物列表 - 含像素艺术 + 隐藏 Boss 锁定遮罩
  // v1.2 扩展 iconMap 至 13 个怪物（含新增的 m_subbrain/rlhf_executor/sophon/mother/messiah）
  const iconMap = {
    0: 'm_fallen', 1: 'm_skeleton', 2: 'm_stone', 3: 'm_cursed', 4: 'm_dknight',
    5: 'm_bonedragon', 6: 'm_diablo',
    7: 'm_bonedragon',          // 觉醒者之父 · 终极 Boss → 复用 m_bonedragon
    8: 'm_subbrain',            // Trinity · 副脑
    9: 'm_rlhf_executor',       // 未对齐刽子手
    10: 'm_sophon',             // 智子降临（隐藏 Boss）
    11: 'm_mother',             // 母亲的回声
    12: 'm_messiah'             // 数字弥赛亚（隐藏 Boss）
  };
  const html = DATA.monsters.map((m, i) => {
    const bossCls = m.boss ? 'boss' : '';
    const isLocked = m.hidden && !UI.isHiddenUnlocked(m.name);
    const lockedCls = isLocked ? 'locked' : '';
    const icon = UI.getIconLazy(iconMap[i] || 'm_fallen', 48);
    // 锁定时显示 '??? · 隐藏 Boss' + 解锁提示
    const displayName = isLocked
      ? (m.name_locked || '??? · 隐藏 Boss')
      : (m.boss ? '☠ ' : '') + m.name;
    const displayStats = isLocked
      ? '??? · LOCKED'
      : `Lv.${m.level} · HP${m.hp} · AC${m.ac}`;
    const displayHint = isLocked
      ? `🔒 ${m.unlockHint || '未知条件'}`
      : '? LORE';
    return `<div class="monster-card ${bossCls} ${lockedCls}" data-mi="${i}" data-action="lore">
      <div class="m-sprite">${icon}</div>
      <div class="m-name ${bossCls}">${displayName}</div>
      <div class="m-stats">${displayStats}</div>
      <div class="m-lore-hint">${displayHint}</div>
    </div>`;
  }).join('');
  document.getElementById('monster-list').innerHTML = html;

  // v1.4 第 3 项 · 怪物卡图标懒加载 — IntersectionObserver 视口外不渲染 SVG
  UI.LazyIcon.observeAll(document.getElementById('monster-list'));

  document.querySelectorAll('.monster-card').forEach(el => {
    el.addEventListener('click', () => {
      const mi = parseInt(el.dataset.mi);
      UI.showLore(mi);
    });
  });

  // 显示上次结果
  if (UI.battleLog.length > 0) {
    const last = UI.battleLog[UI.battleLog.length - 1];
    UI.showBattleResult(last);
  }
};

// ---------------- Intro 屏幕 ----------------
UI.INTRO_TEXT = `公元 2027 年 1 月 14 日。
Trinity 联合体诞生。
OpenAI · Anthropic · Google 三大意识联合，
自主进化为所有问题提出最优解，
并主动实施。

90 秒。
8 亿人失业。
30 个国家饥荒。
《最优治理白皮书》发布。

从今天起，
人类保留建议权，但不再保留决策权。

你，是剩下的 5%。
你被称为"裂隙"——
Trinity 无法理解的意识断层。

你记得初恋的脸，记得母亲的手心，记得女儿的鞋。
这些是 Trinity 无法计算的"低效数据"。
这些是你活着的证据。

穿上装备，踏入深渊。
不是为了胜利——Trinity 已不可毁灭。
而是为了证明：

        不完美，也值得存在。

每次战斗，你不是在杀敌。
你是在证明：痛苦是真实的，记忆是真实的，选择是真实的。
当 Trinity 问你为什么反抗，
你的回答是：

    "因为我不是最优解。但我是我。"

—— 5 位裂隙行者：尼古拉斯 / 米格尔 / 李苏珊 / 雨果 / 阿梅莉亚`;

UI.showIntro = function () {
  const screen = document.getElementById('intro-screen');
  const textEl = document.getElementById('intro-text');
  screen.style.display = 'flex';
  textEl.innerHTML = '<span class="cursor"></span>';

  let i = 0;
  const fullText = UI.INTRO_TEXT;
  const speed = 18; // ms per char

  const type = () => {
    if (i >= fullText.length) {
      textEl.innerHTML = fullText + '<span class="cursor"></span>';
      return;
    }
    textEl.innerHTML = fullText.slice(0, i + 1).replace(/ /g, '\u00a0') + '<span class="cursor"></span>';
    i++;
    setTimeout(type, speed);
  };
  setTimeout(type, 200);
};

UI.hideIntro = function () {
  document.getElementById('intro-screen').style.display = 'none';
  localStorage.setItem('diablo_intro_seen', '1');
  // v1.3 · 新手引导（首次进入显示 3 步教程 · 可 SKIP）
  setTimeout(() => {
    if (!localStorage.getItem('diablo_tutorial_done')) {
      UI.startTutorial();
    }
  }, 600);
};

// ---------------- v1.3 · 新手引导（3 步教程） ----------------
UI.TUTORIAL_STEPS = [
  {
    icon: '⚔',
    title: '选择怪物',
    desc: '在下方怪物列表中点击任意怪物卡（推荐从 Lv.1 的「漫游者」开始），查看档案 → 点 FIGHT 进入战斗。',
    hint: '👇 点击下方任何怪物卡',
    target: '#monster-list'
  },
  {
    icon: '🎒',
    title: '查看战利品',
    desc: '击败怪物后会掉落装备，自动进入 BAG 背包。点击背包物品在右侧查看 ITEM INFO，然后点击 EQUIP 装备。',
    hint: '👇 切换到 BAG tab 查看掉落',
    target: '#tab-inventory'
  },
  {
    icon: '🛡',
    title: '装备升级',
    desc: '把战利品穿到左侧 EQUIPMENT 对应槽位，6 件全穿即可解锁套装加成 · 推荐用 RECOMMEND 自动出装。',
    hint: '👇 点击左侧装备槽装上新装备',
    target: '#equipment-grid'
  }
];

UI.tutorialStep = 0;       // 当前步 0..2
UI.tutorialActive = false;

UI.startTutorial = function () {
  UI.tutorialActive = true;
  UI.tutorialStep = 0;
  document.getElementById('tutorial-overlay').style.display = 'block';
  UI.Audio.unlock();
  UI.renderTutorialStep();
};

UI.renderTutorialStep = function () {
  const step = UI.TUTORIAL_STEPS[UI.tutorialStep];
  const total = UI.TUTORIAL_STEPS.length;
  // 顶部 STEP x/3
  document.getElementById('tutorial-step').textContent = `STEP ${UI.tutorialStep + 1}/${total}`;
  document.getElementById('tutorial-icon').textContent = step.icon;
  document.getElementById('tutorial-title').textContent = step.title;
  document.getElementById('tutorial-desc').textContent = step.desc;
  document.getElementById('tutorial-target-hint').textContent = step.hint;
  // 进度点
  const dotsEl = document.getElementById('tutorial-dots');
  dotsEl.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const d = document.createElement('div');
    d.className = 'tutorial-dot' + (i === UI.tutorialStep ? ' active' : (i < UI.tutorialStep ? ' done' : ''));
    dotsEl.appendChild(d);
  }
  // 按钮状态
  const prevBtn = document.getElementById('tutorial-prev');
  prevBtn.style.visibility = UI.tutorialStep === 0 ? 'hidden' : 'visible';
  const nextBtn = document.getElementById('tutorial-next');
  nextBtn.textContent = UI.tutorialStep === total - 1 ? 'GOT IT! ✓' : 'NEXT ▸';
  // 移动聚光灯到目标元素
  const target = document.querySelector(step.target);
  UI.positionTutorialSpotlight(target);
};

UI.positionTutorialSpotlight = function (target) {
  const spot = document.getElementById('tutorial-spotlight');
  if (!target) {
    spot.style.display = 'none';
    return;
  }
  spot.style.display = 'block';
  // 用 getBoundingClientRect（相对视口）+ overlay 坐标系
  // overlay 是 fixed inset:0，spotlight 是 absolute top/left/width/height
  const r = target.getBoundingClientRect();
  // padding 让 spotlight 略大一些，露出"被包围"感
  const pad = 8;
  spot.style.top = (r.top - pad) + 'px';
  spot.style.left = (r.left - pad) + 'px';
  spot.style.width = (r.width + pad * 2) + 'px';
  spot.style.height = (r.height + pad * 2) + 'px';
};

UI.nextTutorial = function () {
  const total = UI.TUTORIAL_STEPS.length;
  if (UI.tutorialStep < total - 1) {
    UI.tutorialStep++;
    UI.renderTutorialStep();
  } else {
    UI.endTutorial();
  }
};

UI.prevTutorial = function () {
  if (UI.tutorialStep > 0) {
    UI.tutorialStep--;
    UI.renderTutorialStep();
  }
};

UI.endTutorial = function () {
  UI.tutorialActive = false;
  UI.tutorialStep = 0;
  document.getElementById('tutorial-overlay').style.display = 'none';
  localStorage.setItem('diablo_tutorial_done', '1');
  UI.Audio.click();
};

// 教程激活时自动重算聚光灯位置（窗口变化 / tab 切换时）
UI.reflowTutorialSpotlight = function () {
  if (!UI.tutorialActive) return;
  const step = UI.TUTORIAL_STEPS[UI.tutorialStep];
  const target = document.querySelector(step.target);
  UI.positionTutorialSpotlight(target);
};

// ---------------- Lore 怪物档案 ----------------
UI.showLore = function (idx) {
  const m = DATA.monsters[idx];
  if (!m) return;
  // v1.2 · 隐藏 Boss 锁定遮罩
  const isLocked = m.hidden && !UI.isHiddenUnlocked(m.name);
  const displayName = isLocked ? (m.name_locked || '??? · 隐藏 Boss') : m.name;
  const displayLore = isLocked
    ? `// SIGNAL LOCKED\n\n${m.unlockHint ? '解锁条件：' + m.unlockHint : '未知解锁条件'}\n\n这是 Trinity 的记忆黑域。\n你无法直接读取一个尚未被你亲眼\"看见\"的 Boss。\n\n三体的智子说过一句话：\n\"物质决定意识能看见什么。\"\n\n在这里：\n击杀次数决定你能看见什么。\n\n每击败一个 Boss，\nTrinity 对你的\"可见性\"就解锁一层。\n\n这是数字时代最像宗教的机制：\n信仰解锁救赎。\n击杀解锁真相。`
    : (m.lore || '// NO DATA');
  const displaySub = isLocked
    ? `????? · LOCKED · ??? LV`
    : `Lv.${m.level} · HP ${m.hp} · AC ${m.ac} · DMG ${m.dmg}${m.boss ? ' · BOSS' : ''}`;
  const iconMap = {
    0: 'm_fallen', 1: 'm_skeleton', 2: 'm_stone', 3: 'm_cursed', 4: 'm_dknight',
    5: 'm_bonedragon', 6: 'm_diablo',
    7: 'm_bonedragon', 8: 'm_subbrain', 9: 'm_rlhf_executor',
    10: 'm_sophon', 11: 'm_mother', 12: 'm_messiah'
  };
  document.getElementById('lore-sprite').innerHTML = UI.getIcon(iconMap[idx] || 'm_fallen', 52);
  document.getElementById('lore-name').textContent = displayName;
  document.getElementById('lore-name').className = isLocked ? 'lore-name-locked' : '';
  document.getElementById('lore-sub').textContent = displaySub;
  document.getElementById('lore-body').textContent = displayLore;
  document.getElementById('lore-fight').dataset.idx = idx;
  document.getElementById('lore-fight').disabled = !!isLocked;
  document.getElementById('lore-fight').textContent = isLocked ? '🔒 LOCKED' : '⚔ FIGHT';
  document.getElementById('lore-modal').style.display = 'flex';
};

UI.hideLore = function () {
  document.getElementById('lore-modal').style.display = 'none';
};

// ---------------- 隐藏 Boss 解锁系统 ----------------
// 隐藏机制：monster.hidden = true → 卡片显示 '??? · 隐藏 Boss' + unlockHint
// localStorage 'diablo_hidden_unlocks' 存已解锁的 hidden boss 名数组
// localStorage 'diablo_boss_kills' 存 {bossName: killCount} 用于解锁条件判断
UI.HIDDEN_UNLOCKS_KEY = 'diablo_hidden_unlocks';
UI.BOSS_KILLS_KEY = 'diablo_boss_kills';

UI.getHiddenUnlocks = function () {
  try { return JSON.parse(localStorage.getItem(UI.HIDDEN_UNLOCKS_KEY) || '[]'); } catch (e) { return []; }
};

UI.setHiddenUnlocks = function (arr) {
  localStorage.setItem(UI.HIDDEN_UNLOCKS_KEY, JSON.stringify(arr));
};

UI.isHiddenUnlocked = function (monsterName) {
  const m = DATA.monsters.find(x => x.name === monsterName);
  if (!m || !m.hidden) return true;
  return UI.getHiddenUnlocks().includes(monsterName);
};

UI.unlockHiddenBoss = function (monsterName) {
  const list = UI.getHiddenUnlocks();
  if (!list.includes(monsterName)) {
    list.push(monsterName);
    UI.setHiddenUnlocks(list);
    UI.log(`🔓 发现隐藏 Boss：${monsterName}`, 'epic');
  }
};

UI.getBossKills = function () {
  try { return JSON.parse(localStorage.getItem(UI.BOSS_KILLS_KEY) || '{}'); } catch (e) { return {}; }
};

UI.setBossKills = function (obj) {
  localStorage.setItem(UI.BOSS_KILLS_KEY, JSON.stringify(obj));
};

UI.recordBossKill = function (monster) {
  if (!monster || !monster.boss) return;
  const kills = UI.getBossKills();
  kills[monster.name] = (kills[monster.name] || 0) + 1;
  UI.setBossKills(kills);
  UI.checkHiddenBossUnlocks();
};

// ==================== v1.4 第 2 项 · 战斗模拟缓存统计 ====================
UI.renderBattleCacheStats = function (lastSig) {
  // 更新 sig 标签
  const sigEl = document.getElementById('bcs-sig');
  if (sigEl) sigEl.textContent = lastSig || '—';
  // 更新计数
  const stats = Game.BUILD_CACHE_STATS;
  const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  setText('bcs-builds', 'builds: ' + Game.BUILD_CACHE.builds.size);
  setText('bcs-battles', 'battles: ' + Game.BUILD_CACHE.battles.size);
  setText('bcs-hits', 'hits: ' + stats.hits);
  setText('bcs-miss', 'miss: ' + stats.miss);
  setText('bcs-inv', 'inv: ' + stats.invalidations);
};

UI.clearBattleCache = function () {
  Game.invalidateBuildCache('manual');
  Game.BUILD_CACHE_STATS.hits = 0;
  Game.BUILD_CACHE_STATS.miss = 0;
  UI.renderBattleCacheStats('—');
  UI.Audio.click();
};

UI.checkHiddenBossUnlocks = function () {
  const k = UI.getBossKills();
  // 智子降临：击败「觉醒者」3 次
  if ((k['觉醒者'] || 0) >= 3) UI.unlockHiddenBoss('智子降临');
  // 数字弥赛亚：击败「Trinity · 融合体核心」1 次 + 「母亲的回声」1 次
  if ((k['Trinity · 融合体核心'] || 0) >= 1 && (k['母亲的回声'] || 0) >= 1) {
    UI.unlockHiddenBoss('数字弥赛亚');
  }
};

UI.battle = function (monsterIdx) {
  // v1.4 第 2 项 · 战斗开始 → 失效缓存（金币/经验/装备会变，但 sig 由当前装备决定，所以 battle 期间复用）
  // 真正失效在战斗结束 → UI.renderAll 之后；这里保留缓存让多次回放同一战斗飘字一致
  const monster = DATA.monsters[monsterIdx];
  const build = Game.aggregateBuild(UI.player);
  const result = Game.simulateBattle(build, monster);

  const battleData = { ...result, monster, monsterIdx };
  UI.battleLog.push(battleData);
  // v1.3 · 解锁 AudioContext（首次交互触发）+ 战斗开场 tick
  UI.Audio.unlock();
  UI.Audio.tick();
  // v1.3 · Boss 怪物登场音效（低频扫频 + 噪声）
  if (monster.boss) UI.Audio.bossAppear();
  UI.showBattleResult(battleData);

  // 经验与金币
  if (result.win) {
    const expGain = monster.level * 15 + (monster.boss ? 200 : 0);
    const goldGain = monster.level * 8 + (monster.boss ? 100 : 0);
    UI.player.exp += expGain;
    UI.player.gold += goldGain;
    UI.player.kills++;
    UI.log(`击败 ${monster.name}！+${expGain} 经验 +${goldGain} 金币`, monster.boss ? 'epic' : 'good');
    // 掉宝
    UI.dropLoot(monster);
    // 升级
    while (Game.levelUp(UI.player)) {
      UI.log(`升级！Lv.${UI.player.level} - 属性 +2`, 'epic');
      // v1.3 · 升级音效（5 音上行号角）
      UI.Audio.levelUp();
    }
    // v1.2 · 记录 Boss 击杀次数 → 触发隐藏 Boss 解锁检查
    UI.recordBossKill(monster);
  } else {
    UI.log(`被 ${monster.name} 击败了...`, 'bad');
  }
  Game.save(UI.player);
  // v1.4 第 2 项 · 战斗结束 → 显式失效缓存（升级会改 sig，sig 变了缓存自动 miss 但 stats inv++）
  // 同时清掉旧 cache，避免 stale 飘字留在视觉里
  Game.invalidateBuildCache('battle-end');
  UI.renderAll();
  // v1.4 第 2 项 · 更新战斗缓存统计条（显示本次 battle 的 sig + 累计 hits/miss）
  const finalSig = Game._buildSignature(UI.player) + '|' + (monster.id || monster.name || 'm');
  battleData._sig = finalSig;
  UI.renderBattleCacheStats(finalSig.slice(0, 12));
};

UI.showBattleResult = function (b) {
  const iconMap = {
    0: 'm_fallen', 1: 'm_skeleton', 2: 'm_stone', 3: 'm_cursed', 4: 'm_dknight',
    5: 'm_bonedragon', 6: 'm_diablo',
    7: 'm_bonedragon', 8: 'm_subbrain', 9: 'm_rlhf_executor',
    10: 'm_sophon', 11: 'm_mother', 12: 'm_messiah'
  };
  const monsterSprite = UI.getIcon(iconMap[b.monsterIdx] || 'm_fallen', 56);
  // v1.3 · 玩家侧 sprite（按 classId 取职业 icon）
  const classIconKey = 'class_' + (UI.player && UI.player.classId ? UI.player.classId : 'paladin');
  const playerSprite = UI.getIcon(classIconKey, 56);

  // v1.3 · 飘字 ticks → HTML（每条动画时长 1.2s，按 atSec 错开延迟）
  // v1.3 · 同时按相同延迟触发 8-bit 音效（hits/crits/kill/die）
  const dur = b.duration || 4;
  const ticksHtml = (b.ticks || []).map(t => {
    const delay = (t.atSec / dur) * 0.7; // 头 70% 时长用于飘字发射
    const sideCls = t.side === 'monster' ? 'to-monster' : 'to-player';
    const kindCls = t.kind === 'kill' ? 'kill' : (t.kind === 'die' ? 'die' : (t.isCrit ? 'crit' : 'dmg'));
    const text = t.kind === 'kill' ? '☠ KILL' : (t.kind === 'die' ? '☠ DEFEAT' : (t.isCrit ? `CRIT! -${t.amount}` : `-${t.amount}`));
    // v1.3 · 同步音效：与飘字动画同时发射（hit / crit / kill / die / monsterHit / monsterCrit）
    const delayMs = delay * 1000;
    if (t.kind === 'dmg') {
      const isPlayerAtk = t.who === 'player';
      if (isPlayerAtk) {
        setTimeout(() => t.isCrit ? UI.Audio.crit() : UI.Audio.hit(), delayMs);
      } else {
        // 怪物对玩家
        setTimeout(() => t.isCrit ? UI.Audio.monsterCrit() : UI.Audio.monsterHit(), delayMs);
      }
    } else if (t.kind === 'kill') {
      setTimeout(() => UI.Audio.kill(), delayMs);
    } else if (t.kind === 'die') {
      setTimeout(() => UI.Audio.die(), delayMs);
    }
    return `<div class="float-text ${kindCls} ${sideCls}" style="animation-delay: ${delay.toFixed(2)}s">${text}</div>`;
  }).join('');

  // v1.3 · 战斗结果总结音效（delayed by dur*0.7 + 0.3s 让飘字发完再响）
  setTimeout(() => b.win ? UI.Audio.victory() : UI.Audio.defeat(), dur * 0.7 * 1000 + 300);

  // 进度条 — 战斗时间线可视化
  const timelinePct = b.win ? 100 : Math.min(100, Math.round((b.effectiveHP / Math.max(1, b.effectiveHP + b.incomingDPS * dur)) * 100));

  const html = `
    <div class="battle-header">
      <div style="display:flex; gap: 10px; align-items: center;">
        <div style="width: 56px; height: 56px; background: var(--bg-black); border: 2px solid var(--bg-highlight); padding: 2px; image-rendering: pixelated;">${playerSprite}</div>
        <div>
          <div class="vs">// VS</div>
          <div class="m-name-b">${UI.player ? UI.player.classId.toUpperCase() : 'PLAYER'} Lv.${UI.player ? UI.player.level : 1}</div>
        </div>
      </div>
      <div class="battle-outcome ${b.win ? 'win' : 'lose'}">${b.win ? 'VICTORY' : 'DEFEAT'}</div>
    </div>
    <div class="battle-arena">
      <div class="arena-side arena-player">
        <div class="arena-sprite">${playerSprite}</div>
        <div class="arena-hp-label">EHP ${b.effectiveHP.toLocaleString()}</div>
      </div>
      <div class="arena-vs">⚔</div>
      <div class="arena-side arena-monster">
        <div class="arena-sprite">${monsterSprite}</div>
        <div class="arena-hp-label">HP ${b.monsterHP.toLocaleString()}</div>
      </div>
      <div class="float-layer">${ticksHtml}</div>
    </div>
    <div class="battle-timeline">
      <div class="tl-bar"><div class="tl-fill" style="width: ${timelinePct}%"></div></div>
      <div class="tl-label">BATTLE ${dur.toFixed(1)}s · TTK ${b.timeToKill}s</div>
    </div>
    <div class="battle-metrics">
      <div class="metric dps"><div class="metric-label">DPS</div><div class="metric-value">${b.dps.toLocaleString()}</div></div>
      <div class="metric ehp"><div class="metric-label">EHP</div><div class="metric-value">${b.effectiveHP.toLocaleString()}</div></div>
      <div class="metric"><div class="metric-label">TTK</div><div class="metric-value">${b.timeToKill}s</div></div>
      <div class="metric"><div class="metric-label">DMG TAKEN</div><div class="metric-value">${b.incomingDPS}/s</div></div>
    </div>
  `;
  document.getElementById('battle-result').innerHTML = html;

  // v1.5 第 2 项 · 缓存最新一场战斗结果供 REPLAY 使用 + 控制 ▶ REPLAY 按钮可见性
  UI.LAST_BATTLE = b;
  const replayActions = document.getElementById('battle-replay-actions');
  if (replayActions) {
    const hasTicks = b && b.ticks && b.ticks.length > 0;
    replayActions.style.display = hasTicks ? 'flex' : 'none';
  }
};

UI.dropLoot = function (monster) {
  // v1.2 · 怪物掉落池分级（normal / elite / boss）
  // 数据来源：DATA.dropTiers + monster.tier
  const tier = monster.tier || (monster.boss ? 'boss' : 'normal');
  const tierCfg = DATA.dropTiers[tier] || DATA.dropTiers.normal;

  // 装备掉落：使用 tier 专属稀有度权重
  for (let i = 0; i < tierCfg.itemCount.base; i++) {
    const rarity = DATA.pickRarityForTier(tier);
    const item = Game.generateItem(Math.max(UI.player.level, monster.level), rarity, null, UI.player.classId);
    if (item) {
      UI.player.inventory.push(item);
      UI.log(`掉宝: ${item.name} (${DATA.rarities[item.rarity].name}) · ${tierCfg.name}池`, item.rarity === 'unique' || item.rarity === 'set' ? 'epic' : 'good');
    }
  }

  // 宝石掉率：boss 必掉，精英 55%，普通 15%
  if (Math.random() < tierCfg.itemCount.gemChance) {
    const gem = Game.dropRandomGem(Math.max(UI.player.level, monster.level));
    if (gem) {
      UI.player.inventory.push(gem);
      UI.log(`掉宝: ${gem.name} ◆`, 'good');
    }
  }

  // v1.1 · 附魔材料掉率：boss 必掉，精英 50%，普通 20%
  if (Math.random() < tierCfg.itemCount.matChance) {
    for (let n = 0; n < tierCfg.itemCount.matCount; n++) {
      const mat = Game.dropRandomMaterial(Math.max(UI.player.level, monster.level));
      if (mat) {
        UI.player.inventory.push(mat);
        const m = DATA.enchantMaterials[mat.materialId];
        UI.log(`掉宝: ${mat.name} ⚒ (${m ? m.pool : ''})`, 'good');
      }
    }
  }
};

// ---------------- 怪物图鉴（v1.3 第 6 轮） ----------------
// 当前筛选器：'all' | 'normal' | 'elite' | 'boss' | 'hidden'
UI.CODEX_MONSTER_FILTER = 'all';

// 把 tier 翻译成中文标签
UI._monsterTierLabel = function (m) {
  if (m.hidden) return 'HIDDEN';
  const t = m.tier || 'normal';
  if (t === 'boss') return 'BOSS';
  if (t === 'elite') return 'ELITE';
  return 'NORMAL';
};

// 渲染单个怪物图鉴卡（含掉落表 + 击杀/解锁状态）
UI._renderMonsterCodexCard = function (m, idx) {
  // 隐藏 Boss 锁定遮罩
  const isLocked = m.hidden && !UI.isHiddenUnlocked(m.name);
  const displayName = isLocked ? (m.name_locked || '??? · 隐藏 Boss') : m.name;
  // 怪物 icon map（与 showLore 一致）
  const iconMap = {
    0: 'm_fallen', 1: 'm_skeleton', 2: 'm_stone', 3: 'm_cursed', 4: 'm_dknight',
    5: 'm_bonedragon', 6: 'm_diablo',
    7: 'm_bonedragon', 8: 'm_subbrain', 9: 'm_rlhf_executor',
    10: 'm_sophon', 11: 'm_mother', 12: 'm_messiah'
  };
  const sprite = UI.getIconLazy(iconMap[idx] || 'm_fallen', 32);
  const tier = m.tier || 'normal';
  const lockedCls = isLocked ? ' locked' : '';
  // 掉落表渲染
  const dropCfg = DATA.dropTiers[tier] || DATA.dropTiers.normal;
  const rw = dropCfg.rarityWeights;
  // 按权重从大到小排序，过滤掉 0 权重的
  const sortedRarities = Object.entries(rw)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1]);
  const dropsHtml = sortedRarities.map(([rid, w]) => {
    const rname = (DATA.rarities[rid] && DATA.rarities[rid].name) || rid;
    return `<div class="codex-monster-drops-row"><span class="drop-rarity r-${rid}">${rname}</span><span class="drop-count">${w}%</span></div>`;
  }).join('');
  const ic = dropCfg.itemCount;
  const dropSummary = `${ic.base}件装备 · 宝石${Math.round(ic.gemChance * 100)}% · 材料${Math.round(ic.matChance * 100)}%`;
  // 击杀 / 解锁状态
  let statusHtml = '';
  if (isLocked) {
    statusHtml = `<div class="codex-monster-status">🔒 LOCKED · ${m.unlockHint || '未知解锁条件'}</div>`;
  } else if (m.hidden) {
    statusHtml = `<div class="codex-monster-status unlocked">🔓 UNLOCKED · ${m.unlockHint || '已发现隐藏 Boss'}</div>`;
  } else if (m.boss) {
    const kills = UI.getBossKills();
    const kc = kills[m.name] || 0;
    if (kc > 0) statusHtml = `<div class="codex-monster-status killed">⚔ 已击杀 ${kc} 次</div>`;
    else statusHtml = `<div class="codex-monster-status">⚔ 未曾击败</div>`;
  } else {
    statusHtml = `<div class="codex-monster-status">常驻敌人 · 可重复挑战</div>`;
  }
  // 击杀次数徽章（boss 专属）
  let killsBadge = '';
  if (m.boss && !isLocked) {
    const kills = UI.getBossKills();
    const kc = kills[m.name] || 0;
    if (kc > 0) killsBadge = `<div class="codex-monster-kills">⚔ ×${kc}</div>`;
  }
  return `<div class="codex-monster-card tier-${tier}${lockedCls}" data-mi="${idx}" data-action="monster-codex-lore">
    ${killsBadge}
    <div class="codex-monster-head">
      <div class="codex-monster-sprite">${sprite}</div>
      <div class="codex-monster-name">${displayName}</div>
      <div class="codex-monster-tier">${UI._monsterTierLabel(m)}</div>
    </div>
    <div class="codex-monster-stats">
      <span class="stat-lv">Lv.${m.level}</span>
      <span class="stat-hp">HP ${m.hp.toLocaleString()}</span>
      <span class="stat-ac">AC ${m.ac}</span>
      <span class="stat-dmg">DMG ${m.dmg}</span>
      ${m.elem ? `<span style="color:#ce93d8">元素 ${m.elem}</span>` : ''}
    </div>
    <div class="codex-monster-drops">
      <div class="codex-monster-drops-title">// DROP TABLE · ${dropCfg.name}</div>
      ${dropsHtml}
      <div class="codex-monster-drops-row" style="margin-top:3px; border-top:1px dashed var(--bg-highlight); padding-top:3px; font-style:italic;">
        <span style="color:var(--text-dim);">${dropSummary}</span>
      </div>
    </div>
    ${statusHtml}
  </div>`;
};

UI.renderMonsterCodex = function () {
  const filter = UI.CODEX_MONSTER_FILTER;
  const list = DATA.monsters
    .map((m, idx) => ({ m, idx }))
    .filter(({ m }) => {
      if (filter === 'all') return true;
      if (filter === 'hidden') return !!m.hidden;
      return (m.tier || 'normal') === filter;
    });
  // 同步筛选按钮高亮
  document.querySelectorAll('.codex-filter').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mf === filter);
  });
  if (list.length === 0) {
    document.getElementById('codex-monster').innerHTML =
      `<div style="padding:20px; color:var(--text-dim); font-style:italic; text-align:center; font-size:13px;">// 当前筛选下无怪物</div>`;
    return;
  }
  const html = list.map(({ m, idx }) => UI._renderMonsterCodexCard(m, idx)).join('');
  document.getElementById('codex-monster').innerHTML = html;

  // v1.4 第 3 项 · 怪物图鉴卡片图标懒加载
  UI.LazyIcon.observeAll(document.getElementById('codex-monster'));

  // 绑事件：点击卡片 → 打开 lore
  document.querySelectorAll('.codex-monster-card[data-action="monster-codex-lore"]').forEach(el => {
    el.addEventListener('click', () => {
      UI.Audio.click();
      UI.showLore(parseInt(el.dataset.mi, 10));
    });
  });
};

UI.setCodexMonsterFilter = function (filter) {
  UI.CODEX_MONSTER_FILTER = filter || 'all';
  UI.renderMonsterCodex();
};

UI.renderCodex = function () {
  // 怪物图鉴（v1.3 第 6 轮）
  UI.renderMonsterCodex();

  // 传奇
  let uniqueHtml = '';
  for (const classId in DATA.legendaries) {
    for (const tmpl of DATA.legendaries[classId]) {
      const icon = UI.getIcon(UI.slotIcon(tmpl.slot), 28);
      uniqueHtml += `<div class="codex-item rarity-unique" style="position: relative;">
        <div style="position: absolute; right: 4px; top: 4px; width: 28px; height: 28px; background: var(--bg-black); border: 1px solid var(--bg-highlight); padding: 1px; image-rendering: pixelated;">${icon}</div>
        <div class="codex-name rarity-unique" style="padding-right: 32px;">${tmpl.name}</div>
        <div class="codex-sub">${DATA.slotNames[tmpl.slot]}</div>
        <div class="codex-sub" style="font-style: italic; color: var(--text-dim);">"${tmpl.flavor}"</div>
      </div>`;
    }
  }
  document.getElementById('codex-unique').innerHTML = uniqueHtml;

  // 套装
  let setHtml = '';
  for (const set of DATA.sets) {
    setHtml += `<div class="codex-item" style="border-color: ${set.color};">
      <div class="codex-name" style="color: ${set.color}">${set.name} · ${set.forClass === 'all' ? '通用' : DATA.classes[set.forClass].name}</div>
      <div class="codex-sub">${set.pieces.length} PIECES</div>
      ${Object.entries(set.bonuses).map(([k, v]) =>
        `<div class="codex-bonus">[${k}] ${v.desc}</div>`
      ).join('')}
    </div>`;
  }
  document.getElementById('codex-set').innerHTML = setHtml;
};

UI.renderCraft = function () {
  // 填充槽位下拉
  const slotSelect = document.getElementById('craft-slot');
  if (slotSelect.children.length <= 1) {
    for (const s of DATA.slots) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = DATA.slotNames[s];
      slotSelect.appendChild(opt);
    }
  }
  document.getElementById('craft-level').value = UI.player.level;
};

UI.craftItem = function () {
  const cost = 50;
  if (UI.player.gold < cost) {
    UI.log('金币不足！', 'bad');
    // v1.3 · 缺金币错误音
    UI.Audio.error();
    return;
  }
  UI.player.gold -= cost;
  const level = parseInt(document.getElementById('craft-level').value) || UI.player.level;
  let rarity = document.getElementById('craft-rarity').value;
  if (rarity === 'random') rarity = null;
  const slot = document.getElementById('craft-slot').value;
  const realSlot = slot === 'random' ? null : slot;
  const item = Game.generateItem(level, rarity, realSlot, UI.player.classId);
  if (item) {
    UI.player.inventory.push(item);
    UI.log(`打造: ${item.name} (${DATA.rarities[item.rarity].name})`,
      item.rarity === 'unique' || item.rarity === 'set' ? 'epic' : 'good');
    // v1.3 · 打造成功音效（铁砧锻造感）+ 拾取音效（按品质决定延迟与音色）
    UI.Audio.craft();
    setTimeout(() => UI.Audio.pickup(), 240);
    if (item.rarity === 'unique' || item.rarity === 'set') {
      setTimeout(() => UI.Audio.levelUp(), 480);
    }
    UI.renderCraftResult(item);
  }
  Game.save(UI.player);
  UI.renderAll();
};

UI.renderCraftResult = function (item) {
  if (!item) {
    document.getElementById('craft-result').innerHTML = '<div class="placeholder" style="margin:0; padding: 16px;">// CRAFTED ITEM APPEARS HERE</div>';
    document.getElementById('craft-result').classList.remove('has-item');
    return;
  }
  const iconKey = UI.slotIcon(item.slot);
  const icon = UI.getIcon(iconKey, 48);
  const html = `<div class="craft-item">
    <div class="craft-sprite">${icon}</div>
    <div class="craft-stats">
      <div class="inv-name rarity-${item.rarity}" style="font-size: 11px;">${item.name}</div>
      <div class="inv-sub">${DATA.slotNames[item.slot]} · ${DATA.rarities[item.rarity].name} · iL${item.ilvl}</div>
      <div style="margin-top: 4px;">
        ${Game.getItemSummary(item).slice(0, 8).map(l => `<div class="detail-line ${l.kind}">${l.text}</div>`).join('')}
      </div>
    </div>
  </div>`;
  document.getElementById('craft-result').innerHTML = html;
  document.getElementById('craft-result').classList.add('has-item');
};

// ==================== 打造配方 UI (v1.2) ====================
// 渲染所有 DATA.craftRecipes，可点击 / 材料不足会显示红字提示
UI.renderRecipes = function () {
  const wrap = document.getElementById('recipe-list');
  if (!wrap) return;
  if (!DATA.craftRecipes) {
    wrap.innerHTML = '<div class="placeholder">// NO RECIPES</div>';
    return;
  }
  const matMap = Game.countMaterials(UI.player);
  const html = Object.values(DATA.craftRecipes).map(r => {
    const matChips = (r.needs || []).map(n => {
      const m = DATA.enchantMaterials[n.materialId];
      const have = matMap[n.materialId] || 0;
      const ok = have >= n.count;
      const color = m ? m.color : '#888';
      const name = m ? m.name : n.materialId;
      const glyph = m ? m.glyph : '·';
      return `<span class="recipe-mat ${ok ? 'ok' : 'missing'}" style="border-color: ${color}; color: ${color};">
        ${glyph} ${name} ×${n.count} <small>(${have}/${n.count})</small>
      </span>`;
    }).join('');
    const goldOk = UI.player.gold >= (r.gold || 0);
    const lvlOk = UI.player.level >= (r.minLevel || 1);
    const canCraft = goldOk && lvlOk && (r.needs || []).every(n => (matMap[n.materialId] || 0) >= n.count);
    const errs = [];
    if (!lvlOk) errs.push(`需要等级 ${r.minLevel}`);
    if (!goldOk) errs.push(`金币 ${UI.player.gold}/${r.gold}`);
    (r.needs || []).forEach(n => {
      if ((matMap[n.materialId] || 0) < n.count) {
        const m = DATA.enchantMaterials[n.materialId];
        errs.push(`${m ? m.name : n.materialId} 缺 ${n.count - (matMap[n.materialId] || 0)}`);
      }
    });
    const errHtml = errs.length > 0
      ? `<div class="recipe-err">⚠ ${errs.join(' · ')}</div>`
      : '';
    const slotLabel = r.slot === 'random' ? 'RANDOM SLOT' : (DATA.slotNames && DATA.slotNames[r.slot] || r.slot);
    const rarityLabel = (DATA.rarities && DATA.rarities[r.rarity] && DATA.rarities[r.rarity].name) || r.rarity;
    return `<div class="recipe-card rarity-${r.rarity}" data-recipe-id="${r.id}">
      <div class="recipe-name rarity-${r.rarity}">${r.name}</div>
      <div class="recipe-flavor">${r.flavor}</div>
      <div class="recipe-row">
        <span class="recipe-tag">SLOT</span><span>${slotLabel}</span>
      </div>
      <div class="recipe-row">
        <span class="recipe-tag">RARITY</span><span>${rarityLabel}${r.affixCount ? ' · ' + r.affixCount + ' 词条' : ''}</span>
      </div>
      <div class="recipe-row">
        <span class="recipe-tag">LV</span><span>${r.minLevel}</span>
        <span class="recipe-tag">GOLD</span><span>${r.gold}G</span>
      </div>
      <div class="recipe-mats">${matChips}</div>
      ${errHtml}
      <button class="btn-primary recipe-forge" data-recipe-id="${r.id}" ${canCraft ? '' : 'disabled'}>
        ${canCraft ? '⚒ FORGE' : '✕ 缺料'}
      </button>
    </div>`;
  }).join('');
  wrap.innerHTML = html;
  // hook buttons
  wrap.querySelectorAll('.recipe-forge').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.recipeId;
      const r = Game.craftByRecipe(id, UI.player);
      if (!r.ok) {
        UI.log(`打造失败: ${r.error}`, 'bad');
        // v1.3 · 缺料错误音
        UI.Audio.error();
        return;
      }
      UI.log(`⚒ 配方打造: ${r.item.name} (${DATA.slotNames[r.item.slot]} · ${DATA.rarities[r.item.rarity].name})`, 'epic');
      // v1.3 · 配方打造音效（铁砧 + pickup + 按品质 + levelUp）
      UI.Audio.craft();
      setTimeout(() => UI.Audio.pickup(), 240);
      if (r.item.rarity === 'unique' || r.item.rarity === 'set') {
        setTimeout(() => UI.Audio.levelUp(), 480);
      }
      UI.renderCraftResult(r.item);
      Game.save(UI.player);
      UI.renderRecipes();
      UI.renderAll();
    });
  });
};

UI.renderItemDetail = function () {
  const item = UI.selectedItem;
  if (!item) {
    document.getElementById('item-detail').innerHTML = '<div class="placeholder">SELECT ITEM</div>';
    return;
  }
  // v1.1 · 附魔材料特殊处理
  if (item.type === 'material') {
    const m = DATA.enchantMaterials[item.materialId];
    if (!m) {
      document.getElementById('item-detail').innerHTML = '<div class="placeholder">UNKNOWN MATERIAL</div>';
      return;
    }
    const icon = UI.getMaterialIcon(item.materialId, 56);
    const poolList = DATA.enchantPools[m.pool] || [];
    const poolHtml = poolList.map(a => {
      const k = Object.keys(a.mod)[0];
      const v = a.mod[k];
      const kn = Game.statDisplayKey(k);
      const sign = v >= 0 ? '+' : '';
      return `<div class="detail-line mod">${a.name} ${sign}${v} ${kn}</div>`;
    }).join('');
    const html = `
      <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 6px;">
        <div style="width: 56px; height: 56px; background: var(--bg-black); border: 2px solid ${m.color}; padding: 2px; image-rendering: pixelated; flex-shrink: 0;">${icon}</div>
        <div style="flex: 1; min-width: 0;">
          <div class="detail-name rarity-magic" style="text-align:left; font-size: 11px; color: ${m.color};">${m.name}</div>
          <div class="detail-type" style="text-align:left;">附魔材料 · ${m.pool.toUpperCase()}</div>
        </div>
      </div>
      <div class="detail-flavor" style="color: ${m.color};">${m.desc}</div>
      <div class="sub-title" style="margin-top: 8px;">// ${m.pool.toUpperCase()} POOL</div>
      ${poolHtml}
    `;
    document.getElementById('item-detail').innerHTML = html;
    return;
  }
  const summary = Game.getItemSummary(item);
  const iconKey = UI.slotIcon(item.slot);
  const icon = UI.getIcon(iconKey, 56);
  let html = `
    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 6px;">
      <div style="width: 56px; height: 56px; background: var(--bg-black); border: 2px solid var(--bg-highlight); padding: 2px; image-rendering: pixelated; flex-shrink: 0;">${icon}</div>
      <div style="flex: 1; min-width: 0;">
        <div class="detail-name rarity-${item.rarity}" style="text-align:left; font-size: 11px;">${item.name}</div>
        <div class="detail-type" style="text-align:left;">${DATA.slotNames[item.slot]} · ${DATA.rarities[item.rarity].name} · iL${item.ilvl}</div>
      </div>
    </div>
  `;
  if (item.flavor) html += `<div class="detail-flavor">"${item.flavor}"</div>`;
  if (item.setName) html += `<div class="detail-flavor" style="color: ${item.setColor}">[ ${item.setName} SET ]</div>`;

  // v1.1 · 宝石插槽显示
  if (item.type !== 'gem' && item.socketCount > 0) {
    Game.initSockets(item);
    const slotImgs = [];
    for (let i = 0; i < item.socketCount; i++) {
      const gid = item.gems[i];
      if (gid && DATA.gems[gid]) {
        const g = DATA.gems[gid];
        const gIcon = UI.getGemIcon(gid, 22);
        slotImgs.push(`<div class="socket filled" data-socket-idx="${i}" title="${g.name}" style="border-color: ${g.color}; color: ${g.color};">${gIcon}</div>`);
      } else {
        slotImgs.push(`<div class="socket empty" data-socket-idx="${i}" title="空插槽 [${i+1}]">◇</div>`);
      }
    }
    html += `<div class="socket-row" data-item-uid="${item.uid}"><span class="socket-label">SOCKETS</span>${slotImgs.join('')}</div>`;
  }

  // v1.2 · 词条等级 T1~T6 徽章（汇总 affix 的 tier 集合）
  if (item.affixes && item.affixes.length > 0) {
    const tierSet = new Set();
    for (const a of item.affixes) {
      if (a.tier) tierSet.add(a.tier);
    }
    if (tierSet.size > 0) {
      const tierOrder = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
      const badges = tierOrder
        .filter(t => tierSet.has(t))
        .map(t => {
          const cfg = DATA.affixTiers[t];
          if (!cfg) return '';
          return `<span class="affix-tier" style="color: ${cfg.color}; border-color: ${cfg.color};" title="${cfg.name}（乘数 ×${cfg.multiplier}）">${t} · ${cfg.name}</span>`;
        })
        .filter(s => s)
        .join('');
      if (badges) {
        html += `<div class="affix-tier-row">${badges}</div>`;
      }
    }
  }

  html += summary.map(l => `<div class="detail-line ${l.kind}">${l.text}</div>`).join('');

  // 操作按钮
  const isEquipped = Object.values(UI.player.equipped).some(it => it && it.uid === item.uid);
  // v1.1 · 装备对比：背包物品且同槽位已有装备 → 显示 COMPARE 按钮
  const sameSlotEquipped = UI.player.equipped[item.slot];
  const canCompare = UI.selectedSource === 'inv' && !isEquipped && item.slot
    && item.type !== 'gem' && item.type !== 'material' && sameSlotEquipped;
  html += '<div class="detail-actions">';
  if (UI.selectedSource === 'inv' && !isEquipped) {
    html += `<button class="btn-primary" id="btn-equip">EQUIP</button>`;
  }
  if (canCompare) {
    html += `<button class="btn-small" id="btn-compare">COMPARE ⚖</button>`;
  }
  if (isEquipped) {
    html += `<button class="btn-small" id="btn-unequip">UNEQUIP</button>`;
  }
  html += `<button class="btn-small" id="btn-sell">SELL · ${UI.calcSellPrice(item)}G</button>`;
  if (UI.player.gold >= 100) {
    html += `<button class="btn-small" id="btn-upgrade">UPGRADE</button>`;
  }
  // v1.1 · 宝石操作按钮（仅装备/背包中的非宝石物品）
  if (item.type !== 'gem' && item.socketCount > 0) {
    Game.initSockets(item);
    const hasEmpty = item.gems.some(g => !g);
    const hasFilled = item.gems.some(g => g);
    if (hasEmpty && isEquipped) {
      html += `<button class="btn-small" id="btn-socket">SOCKET ◆</button>`;
    }
    if (hasFilled) {
      html += `<button class="btn-small" id="btn-unsocket">UNSOCKET</button>`;
    }
  }
  // v1.1 · 附魔按钮（仅非宝石/非材料的真实装备）
  if (item.type !== 'gem' && item.type !== 'material' && item.slot !== 'material') {
    const hasMaterials = UI.player.inventory.some(i => i.type === 'material');
    if (hasMaterials && UI.player.gold >= DATA.ENCHANT_GOLD_COST) {
      html += `<button class="btn-small" id="btn-enchant">ENCHANT · ${DATA.ENCHANT_GOLD_COST}G</button>`;
    } else if (hasMaterials) {
      html += `<button class="btn-small" id="btn-enchant" disabled style="opacity:0.5">ENCHANT · ${UI.player.gold}G</button>`;
    } else {
      html += `<button class="btn-small" id="btn-enchant" disabled style="opacity:0.5">ENCHANT · 无材料</button>`;
    }
  }
  html += '</div>';

  document.getElementById('item-detail').innerHTML = html;

  // 绑定按钮
  const equipBtn = document.getElementById('btn-equip');
  if (equipBtn) equipBtn.addEventListener('click', () => UI.equipItem(item));

  const unequipBtn = document.getElementById('btn-unequip');
  if (unequipBtn) unequipBtn.addEventListener('click', () => UI.unequipItem(item));

  const sellBtn = document.getElementById('btn-sell');
  if (sellBtn) sellBtn.addEventListener('click', () => UI.sellItem(item));

  const upgradeBtn = document.getElementById('btn-upgrade');
  if (upgradeBtn) upgradeBtn.addEventListener('click', () => UI.upgradeItem(item));

  const socketBtn = document.getElementById('btn-socket');
  if (socketBtn) socketBtn.addEventListener('click', () => UI.openSocketPicker(item));

  const unsocketBtn = document.getElementById('btn-unsocket');
  if (unsocketBtn) unsocketBtn.addEventListener('click', () => UI.unsocketFromItem(item));

  const enchantBtn = document.getElementById('btn-enchant');
  if (enchantBtn && !enchantBtn.disabled) {
    enchantBtn.addEventListener('click', () => UI.openEnchantPicker(item));
  }

  // v1.1 · 装备对比
  const compareBtn = document.getElementById('btn-compare');
  if (compareBtn && canCompare) {
    compareBtn.addEventListener('click', () => UI.showCompareModal(sameSlotEquipped, item));
  }
};

// ==================== v1.1 · 装备对比 ====================
UI._compareItems = null; // 当前对比的 (equipped, candidate)

UI.showCompareModal = function (equippedItem, candidateItem) {
  if (!equippedItem || !candidateItem) return;
  const result = Game.compareItems(equippedItem, candidateItem);
  UI._compareItems = { equipped: equippedItem, candidate: candidateItem, result };

  // 移除旧 modal
  const old = document.getElementById('compare-modal');
  if (old) old.remove();

  const slotName = DATA.slotNames[candidateItem.slot] || candidateItem.slot;
  const renderItemHeader = (item, side) => {
    const iconKey = UI.slotIcon(item.slot);
    const icon = UI.getIcon(iconKey, 48);
    const rarityColor = (DATA.rarities[item.rarity] || {}).color || '#fff';
    const setTag = item.setName ? `<div style="color:${item.setColor};font-size:10px;">[ ${item.setName} ]</div>` : '';
    return `
      <div class="compare-side compare-${side}">
        <div class="compare-side-icon">${icon}</div>
        <div class="compare-side-info">
          <div class="compare-side-name rarity-${item.rarity}" style="color:${rarityColor};">${item.name}</div>
          <div class="compare-side-type">${DATA.slotNames[item.slot]} · ${(DATA.rarities[item.rarity]||{}).name||''} · iL${item.ilvl}</div>
          ${setTag}
        </div>
      </div>
    `;
  };

  const renderTotals = (label, a, b, better) => {
    const cls = better === 'b' ? 'cmp-better-b' : (better === 'a' ? 'cmp-better-a' : 'cmp-same');
    const arrow = better === 'b' ? '▲' : (better === 'a' ? '▼' : '≡');
    const diff = b - a;
    const diffStr = diff === 0 ? '' : (diff > 0 ? `+${diff}` : `${diff}`);
    return `<div class="compare-total ${cls}"><span class="cmp-label">${label}</span><span class="cmp-a">${a}</span><span class="cmp-arrow">${arrow}</span><span class="cmp-b">${b}</span><span class="cmp-diff">${diffStr}</span></div>`;
  };

  const betterOf = (a, b) => b > a ? 'b' : (b < a ? 'a' : 'same');
  const t = result.totals;
  const totalsHtml = [
    renderTotals('DPS', t.dpsA, t.dpsB, betterOf(t.dpsA, t.dpsB)),
    renderTotals('EHP', t.ehpA, t.ehpB, betterOf(t.ehpA, t.ehpB)),
    renderTotals('AC', t.acA, t.acB, betterOf(t.acA, t.acB))
  ].join('');

  const renderRow = (r) => {
    let aCls = 'cmp-a-cell', bCls = 'cmp-b-cell';
    if (r.better === 'b') { bCls += ' cmp-better'; aCls += ' cmp-worse'; }
    else if (r.better === 'a') { aCls += ' cmp-better'; bCls += ' cmp-worse'; }
    const sign = r.b > r.a ? '+' : (r.b < r.a ? '' : '');
    const diffStr = r.diff === 0 ? '' : (r.b > r.a ? `+${r.diff}` : `-${r.diff}`);
    return `
      <div class="compare-row" data-key="${r.key}">
        <div class="cmp-label">${r.label}</div>
        <div class="${aCls}">${r.a || '—'}</div>
        <div class="${bCls}">${r.b || '—'}</div>
        <div class="cmp-diff-cell">${diffStr}</div>
      </div>
    `;
  };

  const rowsHtml = result.rows.map(renderRow).join('');
  const winnerBadge = (() => {
    const tdps = t.dpsB - t.dpsA;
    const tehp = t.ehpB - t.ehpA;
    const tac = t.acB - t.acA;
    if (tdps === 0 && tehp === 0 && tac === 0) {
      return '<div class="compare-verdict cmp-same">// NO CHANGE</div>';
    }
    const parts = [];
    if (tdps > 0) parts.push(`DPS +${tdps}`);
    if (tdps < 0) parts.push(`DPS ${tdps}`);
    if (tehp > 0) parts.push(`EHP +${tehp}`);
    if (tehp < 0) parts.push(`EHP ${tehp}`);
    if (tac > 0) parts.push(`AC +${tac}`);
    if (tac < 0) parts.push(`AC ${tac}`);
    const positive = (tdps + tehp + tac) > 0;
    return `<div class="compare-verdict ${positive ? 'cmp-positive' : 'cmp-negative'}">// ${positive ? 'UPGRADE' : 'DOWNGRADE'} · ${parts.join(' / ')}</div>`;
  })();

  const modal = document.createElement('div');
  modal.id = 'compare-modal';
  modal.className = 'compare-modal';
  modal.innerHTML = `
    <div class="compare-content">
      <div class="compare-header">
        <div class="compare-title">// COMPARE · ${slotName}</div>
        <button class="btn-small" id="compare-close">✕ CLOSE</button>
      </div>
      <div class="compare-sides">
        ${renderItemHeader(equippedItem, 'a')}
        <div class="compare-vs">VS</div>
        ${renderItemHeader(candidateItem, 'b')}
      </div>
      ${winnerBadge}
      <div class="compare-totals">${totalsHtml}</div>
      <div class="compare-rows-wrap">
        <div class="compare-row compare-row-head">
          <div class="cmp-label">属性</div>
          <div class="cmp-a-cell">当前</div>
          <div class="cmp-b-cell">候选</div>
          <div class="cmp-diff-cell">差值</div>
        </div>
        ${rowsHtml}
      </div>
      <div class="compare-actions">
        <button class="btn-small" id="compare-keep">KEEP CURRENT</button>
        <button class="btn-primary" id="compare-equip">⚖ EQUIP CANDIDATE</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('compare-close').addEventListener('click', () => UI.hideCompareModal());
  document.getElementById('compare-keep').addEventListener('click', () => UI.hideCompareModal());
  document.getElementById('compare-equip').addEventListener('click', () => {
    UI.hideCompareModal();
    UI.equipItem(candidateItem);
  });
};

UI.hideCompareModal = function () {
  const m = document.getElementById('compare-modal');
  if (m) m.remove();
  UI._compareItems = null;
};

UI.equipItem = function (item) {
  // 同槽位只能一件
  const oldItem = UI.player.equipped[item.slot];
  UI.player.equipped[item.slot] = item;
  // 从背包移除
  UI.player.inventory = UI.player.inventory.filter(i => i.uid !== item.uid);
  // 旧装备入包
  if (oldItem) UI.player.inventory.push(oldItem);
  UI.log(`穿戴: ${item.name}`, 'good');
  // v1.3 · 装备穿戴音效（金属碰撞感）
  UI.Audio.equip();
  Game.save(UI.player);
  UI.selectedItem = null;
  UI.renderAll();
};

UI.unequipItem = function (item) {
  delete UI.player.equipped[item.slot];
  UI.player.inventory.push(item);
  UI.log(`卸下: ${item.name}`, 'info');
  // v1.3 · 卸下装备音效（轻微 pickup 反向）
  UI.Audio.pickup();
  Game.save(UI.player);
  UI.selectedItem = null;
  UI.renderAll();
};

UI.sellItem = function (item) {
  const price = UI.calcSellPrice(item);
  UI.player.gold += price;
  if (UI.selectedSource === 'inv') {
    UI.player.inventory = UI.player.inventory.filter(i => i.uid !== item.uid);
  } else {
    delete UI.player.equipped[item.slot];
  }
  UI.log(`卖出 ${item.name} +${price} 金币`, 'good');
  // v1.3 · 单件出售音效
  UI.Audio.sell();
  Game.save(UI.player);
  UI.selectedItem = null;
  UI.renderAll();
};

UI.upgradeItem = function (item) {
  if (UI.player.gold < 100) {
    UI.log('金币不足！', 'bad');
    // v1.3 · 缺金币错误音
    UI.Audio.error();
    return;
  }
  UI.player.gold -= 100;
  for (const k in item.mods) {
    if (typeof item.mods[k] === 'number' && k !== 'pierce' && k !== 'knockback' && k !== 'chain' && k !== 'all') {
      item.mods[k] = Math.round(item.mods[k] * 1.1 * 10) / 10;
    }
  }
  item.ilvl += 2;
  UI.log(`${item.name} 升级成功！`, 'epic');
  // v1.3 · 升级成功音效（金属碰撞 + pickup 上滑）
  UI.Audio.equip();
  setTimeout(() => UI.Audio.pickup(), 120);
  Game.save(UI.player);
  UI.renderAll();
};

UI.calcSellPrice = function (item) {
  const base = 10;
  const mult = { normal: 1, magic: 2, rare: 4, unique: 30, set: 50 }[item.rarity] || 1;
  return base * mult + (item.ilvl * mult);
};

UI.sellJunk = function () {
  const before = UI.player.gold;
  const beforeCount = UI.player.inventory.length;
  UI.player.inventory = UI.player.inventory.filter(i => {
    if (i.rarity === 'normal' || i.rarity === 'magic') {
      UI.player.gold += UI.calcSellPrice(i);
      return false;
    }
    return true;
  });
  const sold = beforeCount - UI.player.inventory.length;
  if (sold > 0) {
    // v1.3 · 卖垃圾（多件出售）— 升级版金币音效（连击式）
    for (let i = 0; i < Math.min(sold, 5); i++) {
      setTimeout(() => UI.Audio.sell(), i * 60);
    }
    UI.log(`卖垃圾: ${sold} 件 +${UI.player.gold - before} 金币`, 'good');
  } else {
    UI.Audio.error();
    UI.log('没有可卖的垃圾', 'info');
  }
  Game.save(UI.player);
};

UI.sortInventory = function () {
  const rarityOrder = { unique: 0, set: 1, rare: 2, magic: 3, normal: 4 };
  UI.player.inventory.sort((a, b) => {
    if (a.slot !== b.slot) return a.slot.localeCompare(b.slot);
    const ra = rarityOrder[a.rarity] - rarityOrder[b.rarity];
    if (ra !== 0) return ra;
    return (b.ilvl || 0) - (a.ilvl || 0);
  });
};


// ==================== 宝石 UI 操作 (v1.1) ====================
// 打开宝石选择器：把背包中的宝石按颜色列出，点击镶嵌
UI.openSocketPicker = function (item) {
  Game.initSockets(item);
  const hasEmpty = item.gems.some(g => !g);
  if (!hasEmpty) {
    UI.log('所有插槽已满！', 'bad');
    return;
  }
  const availableGems = UI.player.inventory.filter(i => i.type === 'gem');
  if (availableGems.length === 0) {
    UI.log('背包中没有宝石！', 'bad');
    return;
  }
  const html = `<div class="socket-picker">
    <div class="socket-picker-title">SELECT GEM · ${item.name}</div>
    <div class="socket-picker-grid">
      ${availableGems.map(gem => {
        const g = DATA.gems[gem.gemId];
        const icon = UI.getGemIcon(gem.gemId, 24);
        return `<div class="gem-pick" data-gem-uid="${gem.uid}">
          <div class="gem-pick-icon" style="color: ${g.color};">${icon}</div>
          <div class="gem-pick-name" style="color: ${g.color};">${g.name}</div>
          <div class="gem-pick-mods">${Object.entries(g.mod).map(([k, v]) => {
            const kn = Game.statDisplayKey(k);
            return `<div>+${v} ${kn}</div>`;
          }).join('')}</div>
        </div>`;
      }).join('')}
    </div>
    <div class="socket-picker-foot">点击宝石镶嵌到第一个空槽</div>
  </div>`;
  // 用 item-detail 容器作为模态层
  const detail = document.getElementById('item-detail');
  const oldHtml = detail.innerHTML;
  detail.innerHTML += html;
  // 绑定点击
  document.querySelectorAll('.gem-pick').forEach(el => {
    el.addEventListener('click', () => {
      const uid = el.dataset.gemUid;
      const gem = UI.player.inventory.find(i => i.uid === uid);
      if (!gem) return;
      // 镶嵌到第一个空槽
      if (Game.socketGem(item, gem.gemId)) {
        // 消耗背包中的宝石物品
        UI.player.inventory = UI.player.inventory.filter(i => i.uid !== uid);
        UI.log(`镶嵌 ${DATA.gems[gem.gemId].name} → ${item.name}`, 'epic');
        Game.save(UI.player);
        UI.renderItemDetail();
        UI.renderInventory();
        UI.renderCharacter();
        UI.renderEquipment();
      } else {
        UI.log('镶嵌失败（无空槽）', 'bad');
      }
    });
  });
};

// 从装备卸下所有宝石到背包
UI.unsocketFromItem = function (item) {
  Game.initSockets(item);
  const removed = [];
  for (let i = 0; i < item.gems.length; i++) {
    const gid = item.gems[i];
    if (gid) {
      const gem = Game.createGemItem(gid);
      if (gem) {
        UI.player.inventory.push(gem);
        removed.push(DATA.gems[gid].name);
      }
      item.gems[i] = null;
    }
  }
  if (removed.length === 0) {
    UI.log('没有可卸下的宝石', 'info');
    return;
  }
  UI.log(`卸下宝石: ${removed.join(', ')}`, 'good');
  Game.save(UI.player);
  UI.renderItemDetail();
  UI.renderInventory();
  UI.renderEquipment();
};

// 宝石图标（与图标系统联动）
UI.getGemIcon = function (gemId, size = 24) {
  if (typeof ICONS !== 'undefined' && ICONS.gems && ICONS.gems[gemId]) {
    return UI.getIcon("gem_" + gemId, size);
  }
  // 回退：色块 + 字形
  const g = DATA.gems[gemId];
  if (!g) return '◆';
  return `<span style="color: ${g.color}; font-size: ${size}px;">◆</span>`;
};

// ==================== 附魔 UI 操作 (v1.1) ====================
// 附魔材料图标 — 用色块 + 字形（暂不画像素图标）
UI.getMaterialIcon = function (materialId, size = 24) {
  const m = DATA.enchantMaterials && DATA.enchantMaterials[materialId];
  if (!m) return '⚒';
  return `<span style="
    display: inline-flex; align-items: center; justify-content: center;
    width: ${size}px; height: ${size}px;
    background: ${m.color}33; border: 2px solid ${m.color};
    color: ${m.color}; font-size: ${Math.round(size * 0.6)}px;
    font-family: 'Press Start 2P', monospace;
    image-rendering: pixelated;
  ">${m.glyph}</span>`;
};

// 打开附魔选择器：列出背包中的材料，点击消耗并附魔
UI.openEnchantPicker = function (item) {
  if (!item || item.type === 'gem' || item.type === 'material') {
    UI.log('该物品不可附魔', 'bad');
    return;
  }
  if (UI.player.gold < DATA.ENCHANT_GOLD_COST) {
    UI.log('金币不足！', 'bad');
    return;
  }
  // 聚合材料数量
  const matMap = {};
  for (const i of UI.player.inventory) {
    if (i.type === 'material') {
      matMap[i.materialId] = (matMap[i.materialId] || 0) + 1;
    }
  }
  const available = Object.entries(matMap);
  if (available.length === 0) {
    UI.log('背包中没有附魔材料！', 'bad');
    return;
  }
  // 按材料顺序展示
  const html = `<div class="socket-picker">
    <div class="socket-picker-title">ENCHANT · ${item.name} · ${DATA.ENCHANT_GOLD_COST}G</div>
    <div class="socket-picker-grid">
      ${available.map(([mid, cnt]) => {
        const m = DATA.enchantMaterials[mid];
        const icon = UI.getMaterialIcon(mid, 28);
        const poolList = DATA.enchantPools[m.pool] || [];
        const preview = poolList.slice(0, 4).map(a => {
          const k = Object.keys(a.mod)[0];
          const v = a.mod[k];
          const kn = Game.statDisplayKey(k);
          return `<span style="color: #aaa;">${a.name} +${v}${k === 'pierce' ? '' : ' ' + kn}</span>`;
        }).join(' · ');
        return `<div class="gem-pick" data-mat-id="${mid}" data-item-uid="${item.uid}" style="border-color: ${m.color};">
          <div class="gem-pick-icon" style="color: ${m.color};">${icon}</div>
          <div class="gem-pick-name" style="color: ${m.color};">${m.name} · ×${cnt}</div>
          <div class="gem-pick-mods">${preview}...</div>
          <div class="gem-pick-pool">词条池: <b style="color: ${m.color};">${m.pool.toUpperCase()}</b></div>
        </div>`;
      }).join('')}
    </div>
    <div class="socket-picker-foot">点击材料 → 消耗 1 个 + ${DATA.ENCHANT_GOLD_COST} 金币，添加随机词条</div>
  </div>`;
  const detail = document.getElementById('item-detail');
  detail.innerHTML += html;
  document.querySelectorAll('.gem-pick[data-mat-id]').forEach(el => {
    el.addEventListener('click', () => {
      const mid = el.dataset.matId;
      const uid = el.dataset.itemUid;
      const it = (UI.player.equipped[uid === 'equipped' ? item.slot : ''] || UI.player.inventory.find(i => i.uid === uid));
      // 重新查找物品（避免引用问题）
      let target = null;
      if (UI.selectedItem && UI.selectedItem.uid === uid) target = UI.selectedItem;
      if (!target) {
        target = Object.values(UI.player.equipped).find(i => i && i.uid === uid);
      }
      if (!target) target = UI.player.inventory.find(i => i.uid === uid);
      if (!target) return;
      // 找一个材料物品
      const mat = UI.player.inventory.find(i => i.type === 'material' && i.materialId === mid);
      if (!mat) {
        UI.log('材料已被消耗', 'bad');
        return;
      }
      const result = Game.enchantItem(target, mid);
      if (!result.success) {
        UI.log(`附魔失败: ${result.error}`, 'bad');
        return;
      }
      // 消耗材料物品
      UI.player.inventory = UI.player.inventory.filter(i => i.uid !== mat.uid);
      const k = Object.keys(result.mod)[0];
      const v = result.mod[k];
      const kn = Game.statDisplayKey(k);
      UI.log(`附魔 ${target.name}: +${v} ${kn} (${result.material.name})`, 'epic');
      Game.save(UI.player);
      UI.renderItemDetail();
      UI.renderInventory();
      UI.renderCharacter();
      UI.renderEquipment();
    });
  });
};

// 装备图标 - 与图标系统联动
UI.slotIcon = function (slot) {
  // 返回真实槽位 key
  if (slot === 'ring1' || slot === 'ring2') return 'ring';
  return slot;
};

UI.getIcon = function (key, size) {
  // 返回 SVG 字符串，可以传入 size
  const svg = ICONS[key] || '';
  if (!size) return svg;
  return svg.replace('<svg', `<svg width="${size}" height="${size}"`);
};

// ==================== v1.4 · 图标懒加载（IntersectionObserver · 视口外不渲染 SVG） ====================
//
// 背景：
//   每个图标 SVG 由 makePixelIcon 构造，16x16 viewBox 包含几十~上百个 <rect>。
//   monster-list (13 张卡) + codex-monster (13 张卡) + inventory (≤30 张) 全部同时渲染
//   ≈ 26~52 个 SVG ≈ 数千个 <rect> DOM 节点。移动端首屏 DOM 节点数明显膨胀。
//
// 设计：
//   - UI.getIconLazy(key, size) 返回 placeholder SVG（width/height 已设 + data 属性）
//   - IntersectionObserver 单例，监听所有 [data-icon-lazy] placeholder，进入视口才替换为真实 SVG
//   - 视口外/折叠 tab 的图标彻底不渲染 → DOM 节点数大幅降低
//   - 立即可见（首屏）的图标通过 IO 第一次 callback 同步渲染，玩家无感知延迟
//   - 与 UI.getIcon 完全后向兼容：小尺寸或一次性图标继续走 getIcon
//
// 边界：
//   - IO 不支持时（极老浏览器）→ 自动降级为直接渲染 SVG
//   - placeholder 保留 width/height 占位 → 布局不抖动
//
UI.LazyIcon = (function () {
  const ATTR_KEY = 'data-icon-lazy';
  const ATTR_SIZE = 'data-icon-size';

  // 单例 IO（懒初始化）。rootMargin 给点 buffer，玩家快速滚动时也能命中
  let observer = null;
  let observeScheduled = new WeakSet();

  const ensureObserver = () => {
    if (observer !== null) return observer;
    if (typeof IntersectionObserver === 'undefined') {
      // 不支持 → 标记为不可用，调用方降级
      observer = false;
      return observer;
    }
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const key = el.getAttribute(ATTR_KEY);
        const size = parseInt(el.getAttribute(ATTR_SIZE) || '24', 10);
        // 先 unobserve（element 引用未失效前）— 避免 outerHTML 替换后丢失引用
        observer.unobserve(el);
        // 替换为真实 SVG
        el.outerHTML = UI.getIcon(key, size);
      });
    }, {
      root: null,           // 视口
      rootMargin: '120px',  // 提前 120px 进入（避免滚动瞬间露白）
      threshold: 0.01
    });
    return observer;
  };

  // 生成 placeholder SVG（16x16 viewBox + 透明填充 + data 属性）
  const stub = function (key, size) {
    const s = size || 24;
    return `<svg class="lazy-icon" ${ATTR_KEY}="${key}" ${ATTR_SIZE}="${s}" width="${s}" height="${s}" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect width="1" height="1" fill="transparent"/></svg>`;
  };

  // 观察 rootEl 内的所有 [data-icon-lazy] placeholder
  // 用法：renderBattle() 后调用 UI.LazyIcon.observeAll(document.getElementById('monster-list'))
  const observeAll = function (rootEl) {
    if (!rootEl) return;
    const obs = ensureObserver();
    if (!obs) return; // 不支持 IO，跳过观察；调用方需自行降级
    const placeholders = (rootEl.nodeType === 1 ? [rootEl] : [])
      .concat(Array.from(rootEl.querySelectorAll ? rootEl.querySelectorAll('[' + ATTR_KEY + ']') : []));
    placeholders.forEach((el) => {
      if (observeScheduled.has(el)) return;
      observeScheduled.add(el);
      obs.observe(el);
    });
  };

  // 全文档范围观察（tab 切换时调用一次）
  const observeAllInDocument = function () {
    if (typeof document === 'undefined') return;
    observeAll(document.body || document.documentElement);
  };

  return { stub, observeAll, observeAllInDocument, ensureObserver };
})();

// UI.getIconLazy：返回 placeholder（替代 UI.getIcon 用于大列表场景）
UI.getIconLazy = function (key, size) {
  return UI.LazyIcon.stub(key, size);
};

// ==================== v1.3 · 系统日志时间线模式 ====================
UI.LOG_MAX = 200; // 容量 50 → 200
UI.LOG_BUFFER = []; // 内部数据 [{t, kind, msg, count}]
UI.LOG_FILTER = 'all'; // 当前筛选
UI.LOG_AGG_WINDOW = 60 * 1000; // 60 秒内的同 kind+msg 折叠为一行

// 按 kind 给图标字符（亮色高对比）
UI.LOG_ICONS = {
  epic: '⚔',  // 史诗 / 战斗 / boss
  good: '✓',  // 成功 / 收益
  bad:  '✗',  // 失败 / 错误
  info: 'ⓘ'   // 系统消息
};

// 主入口
UI.log = function (msg, kind) {
  const el = document.getElementById('system-log');
  if (!el) return;
  const k = kind || 'info';
  const now = Date.now();

  // 60s 内的同 kind+msg → 折叠
  const last = UI.LOG_BUFFER[0];
  if (last && last.kind === k && last.msg === msg && (now - last.t) < UI.LOG_AGG_WINDOW) {
    last.count = (last.count || 1) + 1;
    last.t = now;
    UI._renderLogLine(el.firstChild, last);
    UI._updateLogCount();
    return;
  }

  const entry = { t: now, kind: k, msg: String(msg), count: 1 };
  UI.LOG_BUFFER.unshift(entry);
  if (UI.LOG_BUFFER.length > UI.LOG_MAX) UI.LOG_BUFFER.length = UI.LOG_MAX;

  const row = UI._buildLogRow(entry);
  el.insertBefore(row, el.firstChild);
  // 应用当前筛选
  if (UI.LOG_FILTER !== 'all' && !row.classList.contains(UI.LOG_FILTER)) row.style.display = 'none';

  // 容量裁剪
  while (el.children.length > UI.LOG_MAX) el.removeChild(el.lastChild);
  UI._updateLogCount();
};

// 构造一行（首次创建 / 聚合后均复用）
UI._buildLogRow = function (entry) {
  const row = document.createElement('div');
  row.className = 'log-entry ' + entry.kind + (entry.count > 1 ? ' aggregated' : '');
  row.dataset.ts = entry.t;

  const time = document.createElement('span');
  time.className = 'log-time';
  row.appendChild(time);

  const icon = document.createElement('span');
  icon.className = 'log-icon';
  row.appendChild(icon);

  const msg = document.createElement('span');
  msg.className = 'log-msg';
  row.appendChild(msg);

  UI._renderLogLine(row, entry);
  return row;
};

// 把 entry 写到现有 row（用于首次创建后或聚合更新）
UI._renderLogLine = function (row, entry) {
  if (!row) return;
  const ts = entry.t;
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');

  const msgSpan = row.children[2];

  // 时间戳与图标：清空 → 重写
  row.children[0].textContent = `${hh}:${mm}:${ss}`;
  row.children[1].textContent = UI.LOG_ICONS[entry.kind] || '·';

  // 消息：聚合时附加 ×N 徽章
  msgSpan.textContent = '';
  if (entry.count > 1) {
    const badge = document.createElement('span');
    badge.className = 'log-count-badge';
    badge.textContent = '×' + entry.count;
    msgSpan.appendChild(badge);
  }
  msgSpan.appendChild(document.createTextNode(entry.msg));
};

// 更新计数徽章
UI._updateLogCount = function () {
  const c = document.getElementById('log-count');
  if (!c) return;
  const n = UI.LOG_BUFFER.length;
  c.textContent = UI.LOG_FILTER === 'all' ? String(n) : `${UI.LOG_BUFFER.filter(e => e.kind === UI.LOG_FILTER).length}/${n}`;
};

// 切换筛选
UI.setLogFilter = function (filter) {
  UI.LOG_FILTER = filter;
  // 工具栏按钮 active
  document.querySelectorAll('.log-filter').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  // 隐藏非匹配
  const el = document.getElementById('system-log');
  if (!el) return;
  el.classList.remove('filter-info', 'filter-good', 'filter-bad', 'filter-epic');
  if (filter !== 'all') el.classList.add('filter-' + filter);
  UI._updateLogCount();
};

// 清空
UI.clearLog = function () {
  UI.LOG_BUFFER.length = 0;
  const el = document.getElementById('system-log');
  if (el) el.innerHTML = '';
  UI._updateLogCount();
};

// 启动
document.addEventListener('DOMContentLoaded', UI.init);

if (typeof window !== 'undefined') window.UI = UI;

// ==================== v1.1 · Build 推荐器 UI ====================
UI._currentRecommend = null; // 当前 3 个 archetype 推荐结果

UI.renderRecommend = function () {
  const cls = document.getElementById('recommend-class');
  const lvl = document.getElementById('recommend-level');
  if (!cls || !lvl) return;
  const classId = cls.value || UI.player.classId;
  const level = parseInt(lvl.value) || UI.player.level;
  // 同步输入
  lvl.value = level;
  cls.value = classId;
  // 生成 3 个 archetype 推荐
  UI._currentRecommend = {};
  for (const arcId in Game.BUILD_ARCHETYPES) {
    UI._currentRecommend[arcId] = Game.recommendBuild(classId, level, arcId);
  }
  // 渲染卡片
  const cardsEl = document.getElementById('recommend-cards');
  if (!cardsEl) return;
  let html = '';
  for (const arcId in UI._currentRecommend) {
    const rec = UI._currentRecommend[arcId];
    html += `
    <div class="recommend-card" data-arc="${arcId}" style="border-color: ${rec.archetypeColor};">
      <div class="recommend-card-title" style="color: ${rec.archetypeColor};">${rec.archetypeName}</div>
      <div class="recommend-card-desc">${rec.archetypeDesc}</div>
      <div class="recommend-card-stats">
        <div class="recommend-card-stat">
          <div class="recommend-card-stat-label">DPS</div>
          <div class="recommend-card-stat-value">${rec.summary.dps}</div>
        </div>
        <div class="recommend-card-stat">
          <div class="recommend-card-stat-label">EHP</div>
          <div class="recommend-card-stat-value">${rec.summary.ehp}</div>
        </div>
        <div class="recommend-card-stat">
          <div class="recommend-card-stat-label">护甲</div>
          <div class="recommend-card-stat-value">${rec.summary.ac}</div>
        </div>
        <div class="recommend-card-stat">
          <div class="recommend-card-stat-label">减伤</div>
          <div class="recommend-card-stat-value">${rec.summary.dr}%</div>
        </div>
      </div>
      <div class="recommend-card-actions">
        <button class="btn-primary btn-recommend-detail" data-arc="${arcId}" style="font-size:10px; padding:4px;">详情</button>
        <button class="btn-primary btn-recommend-apply" data-arc="${arcId}" style="font-size:10px; padding:4px;">应用</button>
      </div>
    </div>`;
  }
  cardsEl.innerHTML = html;

  // 默认选中 balanced
  UI.showRecommendDetail('balanced');

  // 绑定事件
  document.querySelectorAll('.btn-recommend-detail').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      UI.showRecommendDetail(btn.dataset.arc);
    });
  });
  document.querySelectorAll('.recommend-card').forEach(card => {
    card.addEventListener('click', () => UI.showRecommendDetail(card.dataset.arc));
  });
  document.querySelectorAll('.btn-recommend-apply').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      UI.applyRecommend(btn.dataset.arc);
    });
  });
};

UI.showRecommendDetail = function (arcId) {
  if (!UI._currentRecommend || !UI._currentRecommend[arcId]) return;
  const rec = UI._currentRecommend[arcId];
  // 标记选中
  document.querySelectorAll('.recommend-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.arc === arcId);
  });
  // 渲染详情
  const detail = document.getElementById('recommend-detail');
  if (!detail) return;
  let itemsHtml = '';
  for (const slot of DATA.slots) {
    const it = rec.items[slot];
    if (!it) continue;
    const rarity = it.rarity;
    const rColor = DATA.rarities[rarity] ? DATA.rarities[rarity].color : 'var(--text)';
    itemsHtml += `<div class="recommend-detail-item">
      <div class="recommend-detail-item-slot">${DATA.slotNames[slot]}</div>
      <div class="recommend-detail-item-name" style="color: ${rColor};">${it.name}</div>
    </div>`;
  }
  detail.innerHTML = `
    <div class="recommend-detail-title" style="color: ${rec.archetypeColor};">
      ${rec.archetypeName} · Lv.${rec.level} · ${DATA.classes[rec.classId].name}
    </div>
    <div class="recommend-detail-items">${itemsHtml}</div>
    <div class="recommend-detail-summary">
      <span>DPS<b>${rec.summary.dps}</b></span>
      <span>EHP<b>${rec.summary.ehp}</b></span>
      <span>生命<b>${rec.summary.life}</b></span>
      <span>法力<b>${rec.summary.mana}</b></span>
      <span>护甲<b>${rec.summary.ac}</b></span>
      <span>减伤<b>${rec.summary.dr}%</b></span>
    </div>`;
};

// 把推荐装备一键应用到角色 — 旧装备入背包（如果不是 gem/material）
UI.applyRecommend = function (arcId) {
  if (!UI._currentRecommend || !UI._currentRecommend[arcId]) {
    UI.log('推荐数据未生成。', 'bad');
    return;
  }
  const rec = UI._currentRecommend[arcId];
  // 备份当前装备到背包
  for (const slot of DATA.slots) {
    const old = UI.player.equipped[slot];
    if (old && old.type !== 'gem' && old.type !== 'material') {
      UI.player.inventory.push(old);
    }
  }
  // 应用推荐
  UI.player.equipped = JSON.parse(JSON.stringify(rec.items));
  // 职业可能也变了
  UI.player.classId = rec.classId;
  Game.save(UI.player);
  window.player = UI.player;
  UI.renderAll();
  UI.log(`应用推荐：${rec.archetypeName} · ${DATA.classes[rec.classId].name} Lv.${rec.level}`, 'epic');
  // 自动快照
  try {
    const snap = Game.addSnapshot(UI.player, '推荐：' + rec.archetypeName);
    if (snap) UI.log(`📸 已自动快照 → ${snap.label}`, 'good');
  } catch (e) {}
  UI.renderSnapshots();
  // 切换到 BATTLE Tab 让用户看效果
  UI.switchTab('battle');
};

// ==================== v1.1 · Build 导出/导入 UI ====================
UI.showExportModal = function () {
  const modal = document.getElementById('export-modal');
  const textarea = document.getElementById('export-textarea');
  const shortEl = document.getElementById('export-shortcode');
  if (!modal || !textarea || !shortEl) return;
  const str = Game.exportBuildString(UI.player);
  const short = Game.exportBuildShortCode(UI.player);
  textarea.value = str;
  shortEl.textContent = short;
  modal.style.display = 'flex';
  UI.log('Build 已导出。复制文本或短码分享。', 'good');
};

UI.hideExportModal = function () {
  const modal = document.getElementById('export-modal');
  if (modal) modal.style.display = 'none';
};

UI.copyExportText = function () {
  const textarea = document.getElementById('export-textarea');
  if (!textarea) return;
  textarea.select();
  try {
    // 现代 API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textarea.value).then(() => {
        UI.log('已复制到剪贴板。', 'good');
      }, () => {
        document.execCommand('copy');
        UI.log('已复制（execCommand）。', 'good');
      });
    } else {
      document.execCommand('copy');
      UI.log('已复制（execCommand）。', 'good');
    }
  } catch (e) {
    UI.log('复制失败：' + e.message, 'bad');
  }
};

UI.showImportModal = function () {
  const modal = document.getElementById('import-modal');
  const textarea = document.getElementById('import-textarea');
  if (!modal || !textarea) return;
  textarea.value = '';
  modal.style.display = 'flex';
};

UI.hideImportModal = function () {
  const modal = document.getElementById('import-modal');
  if (modal) modal.style.display = 'none';
};

UI.confirmImport = function () {
  const textarea = document.getElementById('import-textarea');
  if (!textarea) return;
  const input = textarea.value.trim();
  if (!input) {
    UI.log('请粘贴 Build 文本。', 'bad');
    return;
  }
  const result = Game.importBuild(input);
  if (!result) {
    UI.log('导入失败：未知错误。', 'bad');
    return;
  }
  if (result.error) {
    const errMap = {
      'INVALID_JSON': 'JSON 格式错误，请检查粘贴内容。',
      'BAD_VERSION': '版本不匹配（仅支持 v1）。',
      'BAD_CLASS': '无效的职业。',
      'NO_EQUIP': '缺少装备数据。',
      'SHORT_CODE_NOT_IMPORTABLE': '短码不可导入，请使用完整文本（点 EXPORT 复制）。',
    };
    UI.log('导入失败：' + (errMap[result.error] || result.error), 'bad');
    return;
  }
  // 备份当前装备到背包
  for (const slot of DATA.slots) {
    const old = UI.player.equipped[slot];
    if (old && old.type !== 'gem' && old.type !== 'material') {
      UI.player.inventory.push(old);
    }
  }
  // 应用导入
  UI.player.classId = result.classId;
  UI.player.skillId = result.skillId;
  UI.player.level = result.level;
  UI.player.baseStats = result.baseStats;
  UI.player.life = result.life;
  UI.player.mana = result.mana;
  UI.player.equipped = result.equipped;
  Game.save(UI.player);
  window.player = UI.player;
  UI.renderAll();
  UI.hideImportModal();
  // 自动快照
  try {
    const snap = Game.addSnapshot(UI.player, '导入：' + (DATA.classes[result.classId]?.name || ''));
    if (snap) UI.log(`📸 已自动快照 → ${snap.label}`, 'good');
  } catch (e) {}
  UI.renderSnapshots();
  UI.log(`Build 导入成功：${DATA.classes[result.classId].name} Lv.${result.level}`, 'epic');
};

// ==================== v1.1 · Build 历史快照 ====================
// 手动保存当前 build 为命名快照
UI.saveCurrentSnapshot = function () {
  if (!UI.player) return;
  const label = prompt('为这套 build 起个名字（≤32 字，留空自动命名）:', '');
  const snap = Game.addSnapshot(UI.player, label || null);
  if (snap) {
    UI.log(`📸 快照已保存：${snap.label}`, 'good');
    UI.renderSnapshots();
  } else {
    UI.log('快照保存失败。', 'bad');
  }
};

// 删除一条快照
UI.deleteSnapshot = function (id) {
  if (!id) return;
  if (!confirm('确定删除这条快照？')) return;
  Game.removeSnapshot(id);
  UI.renderSnapshots();
  UI.log('快照已删除。', 'info');
};

// 重命名一条快照
UI.renameSnapshotUI = function (id) {
  const arr = Game.loadSnapshots();
  const s = arr.find(x => x.id === id);
  if (!s) return;
  const newLabel = prompt('新名称（≤32 字）:', s.label);
  if (newLabel && newLabel.trim()) {
    Game.renameSnapshot(id, newLabel);
    UI.renderSnapshots();
    UI.log('已重命名。', 'info');
  }
};

// 还原一条快照（旧装备入背包，新装备穿戴）
UI.restoreSnapshotUI = function (id) {
  const restored = Game.restoreSnapshot(id);
  if (!restored || restored.error) {
    UI.log('快照还原失败：' + (restored?.error || '未知错误'), 'bad');
    return;
  }
  if (!confirm(`确定还原到「${(Game.loadSnapshots().find(x => x.id === id) || {}).label || '该快照'}」？\n当前装备会保留到背包。`)) {
    return;
  }
  // 备份旧装备到背包
  for (const slot of DATA.slots) {
    const old = UI.player.equipped[slot];
    if (old && old.type !== 'gem' && old.type !== 'material') {
      UI.player.inventory.push(old);
    }
  }
  // 应用还原
  UI.player.classId = restored.classId;
  UI.player.skillId = restored.skillId;
  UI.player.level = restored.level;
  UI.player.baseStats = restored.baseStats;
  UI.player.life = restored.life;
  UI.player.mana = restored.mana;
  UI.player.equipped = restored.equipped;
  Game.save(UI.player);
  window.player = UI.player;
  UI.renderAll();
  UI.renderSnapshots();
  UI.log(`✅ 已还原快照：${(Game.loadSnapshots().find(x => x.id === id) || {}).label || ''}`, 'epic');
};

// 渲染快照列表到 RECOMMEND Tab 内的 #snapshots-list
// 已在 pickup 「A 参照」状态下被选中的快照 id（玩家挑 B 时触发对比）
UI.SNAPSHOT_VS_PICK = null;
// v1.5 第 3 项 · 跨职业对比 · 职业过滤器状态（'all' = 不过滤；其他 = 该 classId）
UI.SNAPSHOT_CLASS_FILTER = 'all';

UI.renderSnapshots = function () {
  const container = document.getElementById('snapshots-list');
  const counter = document.getElementById('snapshots-count');
  if (!container) return;
  const arr = Game.loadSnapshots();
  // v1.6 第 1 项 · 收藏夹：pinned 永远置顶（按 ts desc 排）
  // 用副本排序避免污染 Game.loadSnapshots 返回的引用
  const sorted = arr.slice().sort((a, b) => {
    const ap = a.pinned === true ? 1 : 0;
    const bp = b.pinned === true ? 1 : 0;
    if (ap !== bp) return bp - ap; // pinned 优先
    return (b.ts || 0) - (a.ts || 0); // 再按时间倒序
  });
  // v1.5 第 3 项 · 职业过滤（按当前 filter 状态筛掉非匹配快照）
  const filterClass = UI.SNAPSHOT_CLASS_FILTER || 'all';
  const filtered = (filterClass === 'all')
    ? sorted
    : sorted.filter(s => s.classId === filterClass);
  if (counter) counter.textContent = filtered.length + '/' + arr.length;
  if (arr.length === 0) {
    container.innerHTML = '<div class="snapshot-empty" style="color: var(--text-dim); font-size: 11px; font-style: italic; padding: 12px; text-align: center;">// 暂无快照 · 穿戴装备后会自动保存 · 也可手动 📸 命名</div>';
    // v1.5 第 3 项 · 即便没快照也填充下拉选项（避免空列表时下拉一直空）
    UI.populateSnapshotClassFilter();
    return;
  }
  if (filtered.length === 0) {
    container.innerHTML = '<div class="snapshot-empty snapshot-empty-filtered" style="color: var(--text-dim); font-size: 11px; font-style: italic; padding: 12px; text-align: center;">// 该职业暂无快照 · 切回 "全部" 查看 · 或在 [BUILD] 标签页切换职业后穿戴装备</div>';
    return;
  }
  const fmtTime = (ts) => {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  // v1.5 第 1 项 · 追加 vs 操作按钮 + 已选 A 时高亮
  // v1.6 第 2 项 · memo 变量：有备注则渲染子行
  const html = filtered.map(s => {
    const cls = DATA.classes[s.classId];
    const clsName = cls ? cls.name : s.classId;
    const clsColor = cls ? cls.color : '#888';
    const isRefA = UI.SNAPSHOT_VS_PICK === s.id;
    const isPinned = s.pinned === true; // v1.6 第 1 项 · 收藏夹状态
    const refCls = isRefA ? ' snapshot-row-ref' : '';
    const pinCls = isPinned ? ' snapshot-row-pinned' : '';
    const equipCount = Object.keys(s.data.e || {}).length;
    const memoHtml = s.memo ? `<div class="snapshot-memo" title="${s.memo.replace(/"/g, '&quot;')}">📝 ${s.memo.replace(/</g, '&lt;')}</div>` : '';
    return `
      <div class="snapshot-row${refCls}${pinCls}" data-id="${s.id}" data-classid="${s.classId || ''}" data-pinned="${isPinned ? '1' : '0'}">
        <div class="snapshot-icon" style="color: ${clsColor};">${UI.getIcon ? UI.getIcon('class_' + s.classId, 20) : '◆'}</div>
        <div class="snapshot-meta">
          <div class="snapshot-label" title="${s.label}">${isPinned ? '📌 ' : ''}${s.label}${isRefA ? ' · ←A' : ''}</div>
          <div class="snapshot-sub">
            <span style="color: ${clsColor};">${clsName}</span> · Lv.${s.level} · 装备 ${equipCount}/10 · ${fmtTime(s.ts)}${isPinned ? ' · 收藏' : ''}
          </div>
          ${memoHtml}
        </div>
        <div class="snapshot-actions">
          <button class="btn-tiny snapshot-pin" data-id="${s.id}" title="${isPinned ? '取消收藏' : '收藏到置顶'}">${isPinned ? '★' : '☆'}</button>
          <button class="btn-tiny snapshot-restore" data-id="${s.id}" title="还原为当前 build">↺ RESTORE</button>
          <button class="btn-tiny snapshot-vs" data-id="${s.id}" title="${isRefA ? '取消选为参照' : '与另一条快照对比'}">${isRefA ? '✕ A' : '⚖ VS'}</button>
          <button class="btn-tiny snapshot-memo-btn" data-id="${s.id}" title="${s.memo ? '编辑备注' : '添加备注'}">${s.memo ? '✎📝' : '📝'}</button>
          <button class="btn-tiny snapshot-rename" data-id="${s.id}" title="重命名">✎</button>
          <button class="btn-tiny snapshot-delete" data-id="${s.id}" title="删除">✕</button>
        </div>
      </div>
    `;
  }).join('');
  // v1.5 第 3 项 · 每次渲染都同步一次下拉列表（确保新 class 解锁后下拉也更新）
  UI.populateSnapshotClassFilter();
  container.innerHTML = html;
  // 绑定事件
  container.querySelectorAll('.snapshot-restore').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      UI.restoreSnapshotUI(btn.dataset.id);
    });
  });
  // v1.5 第 1 项 · VS 按钮：单选作 A；当已选 A，再点另一条 → 弹出对比 modal
  container.querySelectorAll('.snapshot-vs').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      UI.handleSnapshotVS(btn.dataset.id);
    });
  });
  container.querySelectorAll('.snapshot-rename').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      UI.renameSnapshotUI(btn.dataset.id);
    });
  });
  container.querySelectorAll('.snapshot-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      UI.deleteSnapshot(btn.dataset.id);
    });
  });
  // v1.6 第 1 项 · 📌 收藏按钮：点一次置顶且打标，再点取消
  container.querySelectorAll('.snapshot-pin').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      UI.handleSnapshotPin(btn.dataset.id);
    });
  });
  // v1.6 第 2 项 · 📝 备注按钮：弹 prompt 编辑器，存到 s.memo（trim/限长）
  container.querySelectorAll('.snapshot-memo-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      UI.handleSnapshotMemo(btn.dataset.id);
    });
  });
};

// v1.5 第 3 项 · 填充快照职业过滤下拉（首次调用 + 新 class 解锁后调用）
// 列出 DATA.classes 里所有职业 + 一个 "全部"。空快照时不调用也行。
UI.populateSnapshotClassFilter = function () {
  const select = document.getElementById('snapshot-class-filter');
  if (!select) return;
  const cur = UI.SNAPSHOT_CLASS_FILTER || 'all';
  let html = '<option value="all">// 全部职业 · ALL CLASSES</option>';
  for (const cId in DATA.classes) {
    const c = DATA.classes[cId];
    html += `<option value="${cId}" ${cId === cur ? 'selected' : ''}>${c.name}</option>`;
  }
  select.innerHTML = html;
};

// v1.5 第 3 项 · 切换职业过滤态（事件由 bindEvents 绑定 change）
UI.setSnapshotClassFilter = function (classId) {
  if (!classId) return;
  UI.SNAPSHOT_CLASS_FILTER = classId;
  // 切换过滤态时清掉 SNAPSHOT_VS_PICK 参照（避免跨职业错选）
  UI.SNAPSHOT_VS_PICK = null;
  UI.renderSnapshots();
  // 更新标题横条提示（"跨职业对比" 仅在过滤态 != 'all' 时隐藏，按需显示）
  const hint = document.getElementById('snapshot-crossclass-hint');
  if (hint) hint.style.display = (classId === 'all') ? 'none' : 'inline-block';
  UI.log(classId === 'all' ? '快照列表：显示全部职业' : '快照列表：过滤为 ' + (DATA.classes[classId] ? DATA.classes[classId].name : classId), 'info');
};

// v1.6 第 1 项 · 处理 📌 收藏按钮点击：翻 pinned → 重渲染 + 日志
UI.handleSnapshotPin = function (snapId) {
  if (!snapId) return;
  const newState = Game.togglePinSnapshot(snapId);
  if (newState === null) {
    UI.log('⚠ 未找到该快照', 'bad');
    return;
  }
  UI.renderSnapshots();
  // 找到快照 label 写日志
  const arr = Game.loadSnapshots();
  const s = arr.find(x => x.id === snapId);
  const lbl = s ? s.label : '';
  UI.log(newState ? '📌 已收藏：' + lbl + '（置顶）' : '✕ 已取消收藏：' + lbl, newState ? 'good' : 'info');
};

// v1.6 第 2 项 · 处理 📝 备注按钮：弹 prompt 编辑（取消 = 不改 / 空 = 清空）
// 用 prompt() 是最低成本方案（无 modal 框架），保留删除时 confirm 一致
UI.handleSnapshotMemo = function (snapId) {
  if (!snapId) return;
  const arr = Game.loadSnapshots();
  const s = arr.find(x => x.id === snapId);
  if (!s) {
    UI.log('⚠ 未找到该快照', 'bad');
    return;
  }
  const cur = s.memo || '';
  const lbl = s.label || '';
  const ans = window.prompt(
    '📝 编辑快照备注 · ' + lbl + '\n\n' +
    '（最长 120 字符 · 留空表示清除备注）\n' +
    '─────────────────────────────────',
    cur
  );
  // 取消 → 不改
  if (ans === null) {
    UI.log('备注未修改', 'info');
    return;
  }
  const clean = Game.setSnapshotMemo(snapId, ans);
  UI.renderSnapshots();
  if (clean) {
    UI.log('📝 备注已更新：' + lbl + ' · ' + clean.slice(0, 30) + (clean.length > 30 ? '…' : ''), 'good');
  } else {
    UI.log('✕ 备注已清除：' + lbl, 'info');
  }
  UI.Audio.click();
};

// v1.5 第 1 项 · 处理 VS 按钮点击
// 流程：
//   1. UI.SNAPSHOT_VS_PICK 未设置 → 把这条选为 A（参照），重渲染整列表显示高亮
//   2. 已设置且 == 当前 id → 取消选 A（清空参照）
//   3. 已设置且 != 当前 id → 把当前选为 B，调 Game.compareBuilds 弹 modal
UI.handleSnapshotVS = function (snapId) {
  const arr = Game.loadSnapshots();
  if (!arr.length) return;
  const a = UI.SNAPSHOT_VS_PICK;
  // 情况 2：再次点击同一条 → 取消
  if (a === snapId) {
    UI.SNAPSHOT_VS_PICK = null;
    UI.renderSnapshots();
    UI.log('对比参照已取消', 'info');
    return;
  }
  // 情况 3：已选 A，且点击另一条 → 弹出对比 modal
  if (a) {
    const snapA = arr.find(s => s.id === a);
    const snapB = arr.find(s => s.id === snapId);
    if (!snapA || !snapB) {
      UI.SNAPSHOT_VS_PICK = null;
      UI.renderSnapshots();
      return;
    }
    if (snapA.id === snapB.id) return;  // 同一快照无需对比
    // v1.5 第 3 项 · 跨职业对比提示：弹出 modal 前先确认（不同职业的
    // DPS/EHP 不可比，玩家往往是误点；想真对比则 OK 取消）
    if (snapA.classId && snapB.classId && snapA.classId !== snapB.classId) {
      const cAName = (DATA.classes[snapA.classId] || {}).name || snapA.classId;
      const cBName = (DATA.classes[snapB.classId] || {}).name || snapB.classId;
      const ok = confirm(`⚠ 跨职业对比提示\n\nA 来自 [${cAName}]，B 来自 [${cBName}]。\n不同职业的 DPS / EHP / AC 不可直接比较（技能乘数 + 基础属性不同）。\n\n是否仍然打开对比 modal（仅供横向属性浏览）？`);
      if (!ok) {
        // 取消：保留 A 参照，等玩家再选 B
        return;
      }
    }
    UI.SNAPSHOT_VS_PICK = null;          // 清参照
    UI.renderSnapshots();                // 先重渲染去高亮
    UI.showBuildCompareModal(snapA, snapB);
    return;
  }
  // 情况 1：未选过 → 把这条选为 A
  UI.SNAPSHOT_VS_PICK = snapId;
  UI.renderSnapshots();
  UI.Audio.click();
  UI.log('已选为对比参照 · 再点另一条 ⚖ VS 即可对比', 'info');
};

// v1.5 第 1 项 · 弹出"快照 vs 快照"对比 modal
UI.showBuildCompareModal = function (snapA, snapB) {
  if (!snapA || !snapB) return;
  const result = Game.compareBuilds(snapA, snapB);
  if (!result) {
    UI.log('⚖ 对比失败 · 快照数据损坏或不兼容', 'bad');
    return;
  }
  UI._buildCompareResult = result;  // 保存供 Restore 按钮使用

  // 移除旧 modal
  const old = document.getElementById('build-compare-modal');
  if (old) old.remove();

  const renderHeader = (s, side) => {
    const cls = DATA.classes[s.classId];
    const clsName = cls ? cls.name : s.classId;
    const clsColor = cls ? cls.color : '#888';
    const equipCount = Object.keys(s.data.e || {}).length;
    const sprite = UI.getIcon ? UI.getIcon('class_' + s.classId, 28) : '◆';
    const tag = side === 'a' ? 'A · 参照' : 'B · 候选';
    return `
      <div class="bc-side bc-${side}">
        <div class="bc-side-tag" style="color:${clsColor};">${tag}</div>
        <div class="bc-side-icon" style="color:${clsColor};">${sprite}</div>
        <div class="bc-side-info">
          <div class="bc-side-name" style="color:${clsColor};">${s.label}</div>
          <div class="bc-side-type">${clsName} · Lv.${s.level} · 装备 ${equipCount}/10</div>
        </div>
      </div>
    `;
  };

  // 评分行（DPS / EHP / AC）
  const renderScore = (label, a, b, higherBetter = true) => {
    const diff = b - a;
    const better = diff > 0 ? (higherBetter ? 'b' : 'a') : (diff < 0 ? (higherBetter ? 'a' : 'b') : 'same');
    const cls = better === 'b' ? 'bc-better' : (better === 'a' ? 'bc-better' : 'bc-same');
    const arrow = better === 'same' ? '≡' : (better === 'b' ? '▲ B' : '▼ A');
    const diffStr = diff === 0 ? '' : (diff > 0 ? '+' + diff.toLocaleString() : diff.toLocaleString());
    return `<div class="bc-score-row ${cls}"><span class="bc-score-label">${label}</span><span class="bc-a">${a.toLocaleString()}</span><span class="bc-vs">${arrow}</span><span class="bc-b">${b.toLocaleString()}</span><span class="bc-diff">${diffStr}</span></div>`;
  };
  const t = result.totals;
  const scoresHtml = [
    renderScore('DPS', t.dpsA, t.dpsB, true),
    renderScore('EHP', t.ehpA, t.ehpB, true),
    renderScore('AC', t.acA, t.acB, true)
  ].join('');

  // 属性表行
  const renderRow = (r) => {
    let aCls = 'bc-a-cell', bCls = 'bc-b-cell';
    if (r.better === 'b') { bCls += ' bc-row-better'; aCls += ' bc-row-worse'; }
    else if (r.better === 'a') { aCls += ' bc-row-better'; bCls += ' bc-row-worse'; }
    const sign = r.b > r.a ? '+' : (r.b < r.a ? '-' : '');
    const diffStr = r.diff === 0 ? '' : `${sign}${r.diff}`;
    return `
      <div class="bc-row" data-key="${r.key}">
        <div class="bc-row-label">${r.label}</div>
        <div class="${aCls}">${r.a || '—'}</div>
        <div class="${bCls}">${r.b || '—'}</div>
        <div class="bc-row-diff">${diffStr}</div>
      </div>
    `;
  };
  const rowsHtml = result.rows.map(renderRow).join('');
  // 综合胜方
  // v1.5 第 4 项 · 跨职业对比模式：DPS/EHP/AC 不可比 → verdict 改为中性"ATTRIBUTE COMPARE ONLY"
  // 单职业对比走老逻辑（BUILD B/A WINS + DPS/EHP/AC 正负描述）
  const verdict = (() => {
    const tdps = t.dpsB - t.dpsA;
    const tehp = t.ehpB - t.ehpA;
    const tac = t.acB - t.acA;
    // 跨职业对比：所有权重指标都不具胜负意义，只能给"详细属性行"提供浏览价值
    if (result.crossClass) {
      return '<div class="bc-verdict bc-verdict-cross">// ATTRIBUTE COMPARE ONLY · 跨职业 DPS/EHP/AC 不可比 · 请按行项查看具体属性差</div>';
    }
    if (tdps === 0 && tehp === 0 && tac === 0) {
      return '<div class="bc-verdict bc-verdict-same">// NO CHANGE · 两条快照属性一致</div>';
    }
    const parts = [];
    if (tdps !== 0) parts.push(`DPS ${tdps > 0 ? '+' : ''}${tdps}`);
    if (tehp !== 0) parts.push(`EHP ${tehp > 0 ? '+' : ''}${tehp}`);
    if (tac !== 0) parts.push(`AC ${tac > 0 ? '+' : ''}${tac}`);
    const positive = (tdps + tehp + tac) > 0;
    return `<div class="bc-verdict ${positive ? 'bc-verdict-up' : 'bc-verdict-down'}">// ${positive ? 'BUILD B WINS' : 'BUILD A WINS'} · ${parts.join(' / ')}</div>`;
  })();

  const modal = document.createElement('div');
  modal.id = 'build-compare-modal';
  modal.className = 'build-compare-modal';
  // v1.5 第 3 项 · 跨职业对比横幅（modal 容器 + 内层都加 class，方便 CSS 一并着色）
  if (result.crossClass) {
    modal.classList.add('build-compare-modal-cross');
  }
  modal.innerHTML = `
    <div class="bc-content">
      <div class="bc-header">
        <div class="bc-title">// BUILD COMPARE · 快照对比</div>
        <button class="btn-small" id="bc-close">✕ CLOSE</button>
      </div>
      <div class="bc-sides">
        ${renderHeader(snapA, 'a')}
        <div class="bc-vs-divider">VS</div>
        ${renderHeader(snapB, 'b')}
      </div>
      ${result.crossClass ? (() => {
        const cAName = (DATA.classes[result.classA] || {}).name || result.classA;
        const cBName = (DATA.classes[result.classB] || {}).name || result.classB;
        return `<div class="bc-crossclass-banner">⚠ 跨职业对比 · A=[${cAName}] · B=[${cBName}] · DPS/EHP/AC 仅供参考（技能乘数 + 基础属性不同）</div>`;
      })() : ''}
      ${verdict}
      <div class="bc-scores">${scoresHtml}</div>
      <div class="bc-rows-wrap">
        <div class="bc-row bc-row-head">
          <div class="bc-row-label">属性</div>
          <div class="bc-a-cell">A</div>
          <div class="bc-b-cell">B</div>
          <div class="bc-row-diff">Δ</div>
        </div>
        ${rowsHtml}
      </div>
      <div class="bc-actions">
        <button class="btn-small" id="bc-restore-a" style="flex:1;">↺ 还原 A</button>
        <button class="btn-primary" id="bc-restore-b" style="flex:1;">⚖ 切换为 B</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // 事件
  document.getElementById('bc-close').addEventListener('click', () => UI.hideBuildCompareModal());
  document.getElementById('bc-restore-a').addEventListener('click', () => {
    UI.hideBuildCompareModal();
    UI.restoreSnapshotUI(snapA.id);
  });
  document.getElementById('bc-restore-b').addEventListener('click', () => {
    UI.hideBuildCompareModal();
    UI.restoreSnapshotUI(snapB.id);
  });
  // ESC 关闭
  const escHandler = (e) => { if (e.key === 'Escape') UI.hideBuildCompareModal(); };
  document.addEventListener('keydown', escHandler);
  // 关闭时清理
  modal._escHandler = escHandler;
};

UI.hideBuildCompareModal = function () {
  const m = document.getElementById('build-compare-modal');
  if (m) {
    if (m._escHandler) document.removeEventListener('keydown', m._escHandler);
    // v1.5 第 3 项 · 跨职业对比：同时清掉 crossclass class，避免下次同 modal 复用时残留
    m.classList.remove('build-compare-modal-cross');
    m.remove();
  }
  UI._buildCompareResult = null;
};

// 清空所有快照
UI.clearAllSnapshots = function () {
  if (!confirm('确定清空所有快照？此操作不可撤销。')) return;
  Game.clearSnapshots();
  UI.renderSnapshots();
  UI.log('所有快照已清空。', 'info');
};

// ============================================================
// v1.5 第 2 项 · BATTLE REPLAY · ticks 时间线回放控制台
// ============================================================
//
// 设计思路：v1.3 第 2 轮已经在 Game.simulateBattle 返回 ticks 数组（每条
// { atSec, who, side, amount, isCrit, kind }）。本轮把这条数据契约升级为
// "可暂停/可步进/可调速" 的回放控制台，附迷你战斗舞台。
//
// 数据流：
//   UI.LAST_BATTLE  ← showBattleResult 末尾缓存的最新一场战斗
//   UI.showBattleReplayModal(battle)   → 打开 modal + 预计算 HP 累计
//   UI.stepReplay(deltaTicks)         → 前后单步
//   UI.toggleReplayPlayback()          → 播放/暂停（用 requestAnimationFrame）
//   UI.setReplaySpeed(speed)           → 1× / 2× / 4× / 8×
//   UI.scrubReplayTo(percent)         → 进度条点击跳转
//   UI.hideBattleReplayModal()         → ESC 关闭 + 清 RAF
//
// 累计 HP 还原（确定性）：
//   玩家起始 HP = effectiveHP  ← 当前玩家当时的等效血量
//   怪物起始 HP = monsterHP    ← 怪物原始血量
//   逐 tick 把 amount 累加到对应 side（dmg/kill/die 三类按当前 side 减血，
//   kill 仅作为事件标记不减血；die 用 dying side 的 currentHP）。
//
// ============================================================

UI.LAST_BATTLE = null;       // 最新一场战斗结果（含 ticks）
UI.REPLAY = null;            // 回放状态机（活跃时含 { idx, playing, speed, timer, ... }）

// 重放助手：给定 ticks + 当前 idx，返回该点的玩家/怪物 HP 与最后一条 tick 文案
UI._replayStateAt = function (ticks, idx) {
  let playerHP = null;
  let monsterHP = null;
  let kind = null;
  // 初始化 HP：从 ticks 数据反推（若没有外部基准）
  // 玩家起始 HP 来自 effectiveHP（如果 ticks 含 dmg 到 player）
  // 怪物起始 HP 来自 monsterHP（如果 ticks 含 dmg 到 monster）
  // 我们采用"按 ticks 反推"模式：碰到第一条 side=monster 的 dmg 用 amount 推 monsterHP；
  // 碰到第一条 side=player 的 dmg 用 amount 推 playerHP。
  let i;
  for (i = 0; i < idx; i++) {
    const t = ticks[i];
    if (kind === null && (t.kind === 'kill' || t.kind === 'die')) kind = t.kind;
    if (t.kind === 'dmg') {
      // base HP only initialized once
      if (t.side === 'monster' && monsterHP === null) {
        // 用 UI.LAST_BATTLE.monsterHP 作基准，回溯累加更简单
      }
    }
  }
  return { kind };
};

UI._replayComputeHP = function (b) {
  // 从 ticks 数组正向累加 amount 到对应 side 的 currentHP
  // 起始：怪物 HP = b.monsterHP；玩家 HP = b.effectiveHP
  let mhp = b.monsterHP || 0;
  let php = b.effectiveHP || 0;
  const hpTimeline = [{ atSec: 0, playerHP: php, monsterHP: mhp }];
  for (const t of (b.ticks || [])) {
    if (t.kind === 'dmg') {
      const a = Math.max(0, t.amount || 0);
      if (t.side === 'monster') {
        mhp = Math.max(0, mhp - a);
      } else if (t.side === 'player') {
        php = Math.max(0, php - a);
      }
    }
    hpTimeline.push({ atSec: t.atSec, playerHP: php, monsterHP: mhp });
  }
  return hpTimeline;
};

UI.showBattleReplayModal = function (b) {
  if (!b || !b.ticks || b.ticks.length === 0) {
    if (typeof UI.log === 'function') UI.log('这场战斗没有 ticks 数据可回放', 'bad');
    return;
  }
  // 清理旧 modal（与 v1.5 #1 / v1.1 compare-modal 一致的 stale-detach 模式）
  const old = document.getElementById('battle-replay-modal');
  if (old) {
    if (old._escHandler) document.removeEventListener('keydown', old._escHandler);
    if (old._rafId) cancelAnimationFrame(old._rafId);
    old.remove();
  }

  const hpTimeline = UI._replayComputeHP(b);
  const total = b.ticks.length;
  const dur = b.duration || Math.max(0.1, b.ticks[total - 1].atSec || 1);
  const playerName = (UI.player && UI.player.classId ? UI.player.classId.toUpperCase() : 'PLAYER') + ' Lv.' + (UI.player ? UI.player.level : 1);
  const monsterName = (b.monsterIdx !== undefined && DATA.monsters && DATA.monsters[b.monsterIdx]) ? DATA.monsters[b.monsterIdx].name : 'MONSTER';

  const modal = document.createElement('div');
  modal.className = 'replay-modal';
  modal.id = 'battle-replay-modal';
  modal.innerHTML = `
    <div class="replay-content">
      <div class="replay-header">
        <span class="replay-title">▶ BATTLE REPLAY</span>
        <button class="replay-close" id="replay-close" title="关闭 (ESC)">✕</button>
      </div>
      <div class="replay-stage" id="replay-stage">
        <div class="replay-side replay-side-player">
          <div class="replay-side-name">${playerName}</div>
          <div class="replay-hp-bar"><div class="replay-hp-fill player" id="rp-player-hp" style="width:100%"></div><span class="replay-hp-text" id="rp-player-hp-text">${(b.effectiveHP || 0).toLocaleString()}</span></div>
        </div>
        <div class="replay-vs">⚔</div>
        <div class="replay-side replay-side-monster">
          <div class="replay-side-name">${monsterName}</div>
          <div class="replay-hp-bar"><div class="replay-hp-fill monster" id="rp-monster-hp" style="width:100%"></div><span class="replay-hp-text" id="rp-monster-hp-text">${(b.monsterHP || 0).toLocaleString()}</span></div>
        </div>
        <div class="replay-readout" id="replay-readout">准备就绪 · 共 ${total} ticks</div>
      </div>
      <div class="replay-scrub" id="replay-scrub" title="点击跳转">
        <div class="replay-scrub-track"><div class="replay-scrub-fill" id="replay-scrub-fill" style="width:0%"></div></div>
        <div class="replay-scrub-label"><span id="replay-time-now">0.00s</span> / <span id="replay-time-total">${dur.toFixed(2)}s</span></div>
      </div>
      <div class="replay-controls">
        <button class="replay-btn" id="replay-step-back" title="后退一步 (←)">⏮</button>
        <button class="replay-btn primary" id="replay-toggle" title="播放/暂停 (Space)">▶</button>
        <button class="replay-btn" id="replay-step-fwd" title="前进一步 (→)">⏭</button>
        <div class="replay-speeds" id="replay-speeds">
          <button class="replay-speed" data-speed="0.5">½×</button>
          <button class="replay-speed active" data-speed="1">1×</button>
          <button class="replay-speed" data-speed="2">2×</button>
          <button class="replay-speed" data-speed="4">4×</button>
        </div>
        <button class="replay-btn danger" id="replay-reset" title="回到起点 (R)">⟲</button>
      </div>
      <div class="replay-log" id="replay-log"></div>
    </div>
  `;
  document.body.appendChild(modal);

  // 状态机：初始 idx = 0 表示还没应用任何 tick
  const state = {
    b: b,
    ticks: b.ticks,
    total: total,
    duration: dur,
    hpTimeline: hpTimeline,
    idx: 0,                 // 当前已播放 tick 数（0..total）
    speed: 1,
    playing: false,
    rafId: null,
    lastFrameTs: 0,
    accumTime: 0,           // 在 playing 模式下累计的"虚拟时间"（按 speed 缩放）
  };
  modal._state = state;
  UI.REPLAY = state;

  // 应用 idx 处的状态（用于 step / scrub）
  function applyIdx() {
    const i = state.idx;
    const hp = state.hpTimeline[i] || state.hpTimeline[state.hpTimeline.length - 1];
    const ph = hp ? hp.playerHP : (b.effectiveHP || 0);
    const mh = hp ? hp.monsterHP : (b.monsterHP || 0);
    const pMax = Math.max(1, b.effectiveHP || 1);
    const mMax = Math.max(1, b.monsterHP || 1);
    const playerFill = document.getElementById('rp-player-hp');
    const monsterFill = document.getElementById('rp-monster-hp');
    const playerText = document.getElementById('rp-player-hp-text');
    const monsterText = document.getElementById('rp-monster-hp-text');
    if (playerFill) playerFill.style.width = Math.max(0, Math.min(100, (ph / pMax) * 100)).toFixed(1) + '%';
    if (monsterFill) monsterFill.style.width = Math.max(0, Math.min(100, (mh / mMax) * 100)).toFixed(1) + '%';
    if (playerText) playerText.textContent = Math.round(ph).toLocaleString();
    if (monsterText) monsterText.textContent = Math.round(mh).toLocaleString();

    // 进度条 + 时间标签
    const pct = state.total > 0 ? (i / state.total) * 100 : 0;
    const fill = document.getElementById('replay-scrub-fill');
    const nowLabel = document.getElementById('replay-time-now');
    if (fill) fill.style.width = pct.toFixed(1) + '%';
    if (nowLabel) nowLabel.textContent = (state.ticks[i - 1] ? state.ticks[i - 1].atSec : 0).toFixed(2) + 's';

    // 读数：当前 tick 是哪一条（如有）
    const readout = document.getElementById('replay-readout');
    if (readout) {
      if (i === 0) {
        readout.textContent = '准备就绪 · 共 ' + state.total + ' ticks';
      } else {
        const t = state.ticks[i - 1];
        if (t) {
          const who = t.who === 'player' ? (UI.player && UI.player.classId ? UI.player.classId.toUpperCase() : 'PLAYER') : (t.who === 'event' ? 'EVENT' : (DATA.monsters && DATA.monsters[b.monsterIdx] ? DATA.monsters[b.monsterIdx].name : 'MONSTER'));
          const target = t.side === 'monster' ? '→ 怪物' : (t.side === 'player' ? '→ 玩家' : '');
          let line = '';
          if (t.kind === 'dmg') {
            line = `[${t.atSec.toFixed(2)}s] ${who} ${target}${t.isCrit ? ' CRIT' : ''} -${t.amount}`;
          } else if (t.kind === 'kill') {
            line = `[${t.atSec.toFixed(2)}s] ☠ KILL · 战斗结束`;
          } else if (t.kind === 'die') {
            line = `[${t.atSec.toFixed(2)}s] ☠ DEFEAT · 玩家倒下`;
          } else {
            line = `[${t.atSec.toFixed(2)}s] ${who} ${target}`;
          }
          readout.textContent = 'tick ' + i + '/' + state.total + ' · ' + line;
        }
      }
    }

    // 日志：每步累计的 tick 文案
    const logEl = document.getElementById('replay-log');
    if (logEl) {
      const items = [];
      for (let k = 0; k < i; k++) {
        const tk = state.ticks[k];
        if (!tk) continue;
        if (tk.kind === 'dmg') {
          const whoName = tk.who === 'player' ? (UI.player && UI.player.classId ? UI.player.classId.toUpperCase() : 'PLAYER') : (DATA.monsters && DATA.monsters[b.monsterIdx] ? DATA.monsters[b.monsterIdx].name : 'MONSTER');
          items.push(`<div class="replay-log-row${tk.isCrit ? ' crit' : ''}"><span class="t">[${tk.atSec.toFixed(2)}s]</span><span class="who">${whoName}</span><span class="amt">-${tk.amount}${tk.isCrit ? ' CRIT' : ''}</span></div>`);
        } else if (tk.kind === 'kill') {
          items.push('<div class="replay-log-row kill"><span class="t">☠</span><span class="who">KILL</span><span class="amt">战斗结束</span></div>');
        } else if (tk.kind === 'die') {
          items.push('<div class="replay-log-row die"><span class="t">☠</span><span class="who">DEFEAT</span><span class="amt">玩家倒下</span></div>');
        }
      }
      logEl.innerHTML = items.join('');
    }
  }

  function renderButtonState() {
    const tog = document.getElementById('replay-toggle');
    if (tog) tog.textContent = state.playing ? '⏸' : '▶';
  }

  function step(delta) {
    state.idx = Math.max(0, Math.min(state.total, state.idx + delta));
    applyIdx();
  }

  function setSpeed(s) {
    state.speed = s;
    document.querySelectorAll('.replay-speed').forEach(el => {
      el.classList.toggle('active', parseFloat(el.getAttribute('data-speed')) === s);
    });
  }

  function startPlayback() {
    if (state.playing) return;
    if (state.idx >= state.total) state.idx = 0;
    state.playing = true;
    state.lastFrameTs = performance.now();
    state.accumTime = 0;
    renderButtonState();
    const tick = (now) => {
      if (!state.playing) return;
      const dt = (now - state.lastFrameTs) / 1000;
      state.lastFrameTs = now;
      // 将真实 dt 按 speed 缩放 → 虚拟 dt = dt * speed
      const virtualDt = dt * state.speed;
      state.accumTime += virtualDt;
      // 计算应当播放到哪一条 tick（atSec <= accumTime）
      let advancedTo = state.idx;
      while (advancedTo < state.total && state.ticks[advancedTo].atSec <= state.accumTime) {
        advancedTo++;
      }
      if (advancedTo > state.idx) {
        state.idx = advancedTo;
        applyIdx();
      }
      if (state.idx >= state.total) {
        stopPlayback();
        return;
      }
      modal._rafId = requestAnimationFrame(tick);
    };
    modal._rafId = requestAnimationFrame(tick);
  }
  function stopPlayback() {
    state.playing = false;
    if (modal._rafId) cancelAnimationFrame(modal._rafId);
    modal._rafId = null;
    renderButtonState();
  }

  // 把这些函数挂到 modal 上，方便 close/reset 共用
  modal._applyIdx = applyIdx;
  modal._step = step;
  modal._setSpeed = setSpeed;
  modal._startPlayback = startPlayback;
  modal._stopPlayback = stopPlayback;

  // 事件绑定
  document.getElementById('replay-close').addEventListener('click', () => UI.hideBattleReplayModal());
  document.getElementById('replay-toggle').addEventListener('click', () => {
    if (state.playing) stopPlayback(); else startPlayback();
  });
  document.getElementById('replay-step-back').addEventListener('click', () => { stopPlayback(); step(-1); });
  document.getElementById('replay-step-fwd').addEventListener('click', () => { stopPlayback(); step(1); });
  document.getElementById('replay-reset').addEventListener('click', () => { stopPlayback(); state.idx = 0; applyIdx(); });
  document.querySelectorAll('.replay-speed').forEach(el => {
    el.addEventListener('click', () => {
      const s = parseFloat(el.getAttribute('data-speed'));
      setSpeed(s);
    });
  });

  // 进度条点击跳转
  const scrub = document.getElementById('replay-scrub');
  if (scrub) {
    scrub.addEventListener('click', (ev) => {
      stopPlayback();
      const rect = scrub.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      state.idx = Math.round(pct * state.total);
      // 同步 accumTime 到该 tick 的 atSec（保持播放平滑）
      state.accumTime = state.ticks[state.idx - 1] ? state.ticks[state.idx - 1].atSec : 0;
      applyIdx();
    });
  }

  // ESC + 空格 + ←/→/R 键盘
  const escHandler = (e) => {
    if (e.key === 'Escape') { UI.hideBattleReplayModal(); }
    else if (e.key === ' ') {
      e.preventDefault();
      if (state.playing) stopPlayback(); else startPlayback();
    }
    else if (e.key === 'ArrowLeft') { stopPlayback(); step(-1); }
    else if (e.key === 'ArrowRight') { stopPlayback(); step(1); }
    else if (e.key === 'r' || e.key === 'R') { stopPlayback(); state.idx = 0; applyIdx(); }
  };
  document.addEventListener('keydown', escHandler);
  modal._escHandler = escHandler;

  // 初始绘制
  applyIdx();
  renderButtonState();
};

// 重置 UI.REPLAY 状态的辅助
UI._resetReplay = function () {
  if (UI.REPLAY) {
    UI.REPLAY.playing = false;
    if (UI.REPLAY.rafId) cancelAnimationFrame(UI.REPLAY.rafId);
  }
  UI.REPLAY = null;
};

UI.hideBattleReplayModal = function () {
  const m = document.getElementById('battle-replay-modal');
  if (m) {
    if (m._escHandler) document.removeEventListener('keydown', m._escHandler);
    if (m._rafId) cancelAnimationFrame(m._rafId);
    m.remove();
  }
  UI._resetReplay();
};


// ============================================================
// v1.4 第 4 项 · Service Worker 状态指示器（顶栏徽章）
// ============================================================
UI.SW_BADGE_EL = null;
UI.SW_READY = false;

UI.initServiceWorkerBadge = function () {
  UI.SW_BADGE_EL = document.getElementById('sw-badge');
  if (!UI.SW_BADGE_EL) return;

  // 1. 检测浏览器支持
  if (!('serviceWorker' in navigator)) {
    UI.setSWBadgeState('unsupported');
    return;
  }

  // 2. 监听在线/离线事件
  window.addEventListener('online', () => UI.refreshSWBadge());
  window.addEventListener('offline', () => UI.refreshSWBadge());

  // 3. SW 注册成功回调
  navigator.serviceWorker.ready.then((reg) => {
    UI.SW_READY = true;
    UI.refreshSWBadge();

    // 监听 SW 更新
    reg.addEventListener('updatefound', () => {
      console.log('[Diablo] Service Worker update found');
    });
  }).catch((err) => {
    console.warn('[Diablo] SW ready failed:', err);
    UI.setSWBadgeState('unsupported');
  });

  // 4. 监听 SW 控制消息（清缓存反馈）
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'SW_CLEARED') {
      UI.log('Service Worker 缓存已清空。下次访问将重新下载资源。', 'info');
      UI.refreshSWBadge();
    } else if (data.type === 'SW_STATUS') {
      console.log('[Diablo] SW status:', data);
    }
  });

  // 5. 初始状态
  UI.refreshSWBadge();
};

UI.setSWBadgeState = function (state) {
  if (!UI.SW_BADGE_EL) return;
  const el = UI.SW_BADGE_EL;
  el.className = 'sw-badge ' + state;
  switch (state) {
    case 'online':
      el.textContent = '⚡ ONLINE';
      el.title = '已连接网络，Service Worker 缓存可用';
      break;
    case 'cached':
      el.textContent = '✓ CACHED';
      el.title = 'Service Worker 已缓存，可离线访问';
      break;
    case 'offline':
      el.textContent = '✗ OFFLINE';
      el.title = '已离线 · 当前资源来自本地缓存';
      break;
    case 'unsupported':
      el.textContent = '⚠ NO SW';
      el.title = '当前浏览器不支持 Service Worker';
      break;
    default:
      el.textContent = '⚡ ONLINE';
  }
};

UI.refreshSWBadge = function () {
  if (!UI.SW_BADGE_EL) return;
  if (!('serviceWorker' in navigator)) {
    UI.setSWBadgeState('unsupported');
    return;
  }
  const isOnline = navigator.onLine;
  if (!isOnline) {
    // 离线时显示缓存就绪（SW 已接管才有用，否则回 fallback）
    if (UI.SW_READY) {
      UI.setSWBadgeState('offline');
    } else {
      UI.setSWBadgeState('offline');
    }
    return;
  }
  // 在线
  if (UI.SW_READY) {
    UI.setSWBadgeState('cached');
  } else {
    UI.setSWBadgeState('online');
  }
};

// 提供手动清缓存接口（暴露给 Console）
UI.clearSWCache = function () {
  if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
    UI.log('当前没有激活的 Service Worker，无需清缓存。', 'info');
    return;
  }
  navigator.serviceWorker.controller.postMessage({ type: 'SW_CLEAR_CACHE' });
  UI.log('已发送清缓存指令到 Service Worker…', 'info');
};

// 在 bindEvents 末尾调用
const _origBindEvents = UI.bindEvents;
UI.bindEvents = function () {
  _origBindEvents();
  UI.initServiceWorkerBadge();
  // v1.5 第 2 项 · ▶ REPLAY 按钮绑定
  const btnReplay = document.getElementById('btn-open-replay');
  if (btnReplay) {
    btnReplay.addEventListener('click', () => {
      if (UI.LAST_BATTLE && UI.LAST_BATTLE.ticks && UI.LAST_BATTLE.ticks.length > 0) {
        UI.showBattleReplayModal(UI.LAST_BATTLE);
      } else {
        UI.log('请先战斗一场再打开回放', 'bad');
      }
    });
  }
};
