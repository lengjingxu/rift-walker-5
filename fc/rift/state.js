// ==================== 裂隙行者 5% · 爬塔 State 模块 ====================
// 管理爬塔进度、玩家资源、道德选择累积、死亡结算
// 复用 Game.aggregateBuild / calcDPS / calcEffectiveHP（不重写）

const RiftState = {};

// ==================== 常量 ====================
RiftState.SAVE_KEY = 'rift_walker_save_v1';
RiftState.MAX_FLOOR = 35;          // Q4 锁定 35 层
RiftState.ITEM_SLOTS = 10;         // DATA.slots 长度
RiftState.STATUS = {
  NONE: 'idle',
  RUNNING: 'running',
  WON: 'won',
  DIED: 'died',
  RETREATED: 'retreated'
};
RiftState.CHOICE_KINDS = {
  DESTROYED: 'destroyed',
  SPARED: 'spared'
};

// ==================== State Shape ====================
RiftState.DEFAULT_STATE = function () {
  return {
    climb: {
      runId: null,
      floor: 0,
      maxFloor: 0,
      status: RiftState.STATUS.NONE || 'idle',
      startedAt: null,
      endedAt: null
    },
    player: {
      classId: null,
      hp: 0,
      hpMax: 0,
      level: 1,
      gold: 0,
      brines: [],         // [{id, amount}]  血瓶清单
      items: new Array(RiftState.ITEM_SLOTS).fill(null), // 10 装备槽（与 DATA.slots 对齐）
      backpack: [],       // 背包：未装备物品
      skills: []          // 已习得技能 id 列表
    },
    choices: {
      destroyed: 0,
      spared: 0
    },
    broughtOut: [],       // 死亡结算：带出的装备 uid 列表
    lostOnDeath: [],      // 死亡结算：失去的装备 uid 列表
    record: {
      wins: 0,
      losses: 0,
      retreats: 0,
      runs: 0
    }
  };
};

// ==================== 持久化 ====================
// load() — 从 localStorage 读，失败返回 DEFAULT_STATE
RiftState.load = function () {
  try {
    const raw = localStorage.getItem(RiftState.SAVE_KEY);
    if (!raw) return RiftState.DEFAULT_STATE();
    const state = JSON.parse(raw);
    // 校验基本结构
    if (!state.climb || !state.player || !state.choices || !state.record) {
      console.warn('[RiftState] save 结构不完整，回退默认');
      return RiftState.DEFAULT_STATE();
    }
    // items 可能被 JSON 序列化丢失 null → 补齐
    if (!Array.isArray(state.player.items)) {
      state.player.items = new Array(RiftState.ITEM_SLOTS).fill(null);
    }
    while (state.player.items.length < RiftState.ITEM_SLOTS) {
      state.player.items.push(null);
    }
    // backpack / brines 兜底
    if (!Array.isArray(state.player.backpack)) state.player.backpack = [];
    if (!Array.isArray(state.player.brines)) state.player.brines = [];
    if (!Array.isArray(state.player.skills)) state.player.skills = [];
    if (!Array.isArray(state.broughtOut)) state.broughtOut = [];
    if (!Array.isArray(state.lostOnDeath)) state.lostOnDeath = [];
    return state;
  } catch (e) {
    console.error('[RiftState] load 失败:', e);
    return RiftState.DEFAULT_STATE();
  }
};

// save() — 序列化到 localStorage（不含 backrefs / 函数）
RiftState.save = function (state) {
  try {
    // 深拷贝去掉不可序列化字段
    const serializable = JSON.parse(JSON.stringify(state));
    // 确保 items 数组长度正确
    while (serializable.player.items.length < RiftState.ITEM_SLOTS) {
      serializable.player.items.push(null);
    }
    localStorage.setItem(RiftState.SAVE_KEY, JSON.stringify(serializable));
    return true;
  } catch (e) {
    console.error('[RiftState] save 失败:', e);
    return false;
  }
};

// ==================== Lifecycle 函数 ====================
// 内部 state 引用（模块级单例，不暴露）
let _state = null;

// getState() — 获取当前 state（先 load）
RiftState.getState = function () {
  if (!_state) _state = RiftState.load();
  return _state;
};

// newRun(classId, gold, brinesAmount) → 初始化一场新爬塔
// gold / brinesAmount 是带入的初始资源
RiftState.newRun = function (classId, gold = 0, brinesAmount = 0) {
  const cls = DATA.classes[classId];
  if (!cls) {
    console.error('[RiftState] newRun: 无效 classId', classId);
    return null;
  }

  // 先 load 旧 state（保留 record）
  const prev = RiftState.getState();
  const state = RiftState.DEFAULT_STATE();

  // 保留历史记录
  state.record = {
    wins: prev.record.wins,
    losses: prev.record.losses,
    retreats: prev.record.retreats,
    runs: prev.record.runs + 1
  };

  // 初始化 climb
  state.climb = {
    runId: Game.uid(),
    floor: 1,
    maxFloor: 1,
    status: RiftState.STATUS.RUNNING,
    startedAt: Date.now(),
    endedAt: null
  };

  // 初始化 player（复用 Game.createPlayer 的结构但不含 equipped/inventory）
  const baseStats = cls.base;
  const hpBase = 50 + (baseStats.vit || 0) * 5;

  state.player = {
    classId,
    hp: hpBase,
    hpMax: hpBase,
    level: 1,
    gold: gold,
    brines: brinesAmount > 0 ? [{ id: 'standard', amount: brinesAmount }] : [],
    items: new Array(RiftState.ITEM_SLOTS).fill(null),
    backpack: [],
    skills: [cls.skills[0].id]  // 默认习得职业第一技能
  };

  _state = state;
  RiftState.save(_state);
  return _state;
};

// advanceFloor() → floor++
RiftState.advanceFloor = function () {
  const s = RiftState.getState();
  if (s.climb.status !== RiftState.STATUS.RUNNING) {
    console.warn('[RiftState] advanceFloor: 非运行状态', s.climb.status);
    return false;
  }
  s.climb.floor++;
  if (s.climb.floor > RiftState.MAX_FLOOR) {
    // 通关！
    s.climb.status = RiftState.STATUS.WON;
    s.climb.endedAt = Date.now();
    s.record.wins++;
    RiftState.save(s);
    return { won: true, floor: s.climb.floor };
  }
  s.climb.maxFloor = Math.max(s.climb.maxFloor, s.climb.floor);
  RiftState.save(s);
  return { won: false, floor: s.climb.floor };
};

// killMonster(monsterId, loot) → 加装备 + 加金币
// loot = { gold: number, items: [item, ...], brines?: [{id, amount}] }
RiftState.killMonster = function (monsterId, loot = {}) {
  const s = RiftState.getState();
  if (s.climb.status !== RiftState.STATUS.RUNNING) {
    console.warn('[RiftState] killMonster: 非运行状态');
    return false;
  }

  // 加金币
  if (loot.gold && loot.gold > 0) {
    s.player.gold += loot.gold;
  }

  // 加血瓶
  if (Array.isArray(loot.brines)) {
    for (const b of loot.brines) {
      const existing = s.player.brines.find(br => br.id === b.id);
      if (existing) {
        existing.amount += b.amount;
      } else {
        s.player.brines.push({ id: b.id, amount: b.amount });
      }
    }
  }

  // 加装备 → 尝试装备到空槽，否则进背包
  if (Array.isArray(loot.items)) {
    for (const item of loot.items) {
      if (!item || !item.slot) {
        s.player.backpack.push(item);
        continue;
      }
      // 查找 DATA.slots 中对应槽位的 index
      const slotIndex = DATA.slots.indexOf(item.slot);
      if (slotIndex >= 0 && slotIndex < RiftState.ITEM_SLOTS && !s.player.items[slotIndex]) {
        s.player.items[slotIndex] = item;
      } else {
        s.player.backpack.push(item);
      }
    }
  }

  RiftState.save(s);
  return true;
};

// takeResource(resourceType, amount) → 扣资源
// resourceType: 'gold' | 'brine'
RiftState.takeResource = function (resourceType, amount) {
  const s = RiftState.getState();
  if (amount <= 0) return false;

  if (resourceType === 'gold') {
    if (s.player.gold < amount) return false;
    s.player.gold -= amount;
  } else if (resourceType === 'brine') {
    // 扣血瓶：先找 standard 类型扣
    const brine = s.player.brines.find(b => b.amount >= amount);
    if (!brine) return false;
    brine.amount -= amount;
    if (brine.amount <= 0) {
      s.player.brines = s.player.brines.filter(b => b.amount > 0);
    }
  } else {
    console.warn('[RiftState] takeResource: 未知资源类型', resourceType);
    return false;
  }

  RiftState.save(s);
  return true;
};

// setChoice(choice) → 道德累积
// choice: 'spared' | 'destroyed'
RiftState.setChoice = function (choice) {
  const s = RiftState.getState();
  if (choice === RiftState.CHOICE_KINDS.SPARED) {
    s.choices.spared++;
  } else if (choice === RiftState.CHOICE_KINDS.DESTROYED) {
    s.choices.destroyed++;
  } else {
    console.warn('[RiftState] setChoice: 无效选择', choice);
    return false;
  }
  RiftState.save(s);
  return true;
};

// retreat() → 撤退结算
// 带出当前所有装备，写入 record
RiftState.retreat = function () {
  const s = RiftState.getState();
  if (s.climb.status !== RiftState.STATUS.RUNNING) {
    console.warn('[RiftState] retreat: 非运行状态');
    return false;
  }

  s.climb.status = RiftState.STATUS.RETREATED;
  s.climb.endedAt = Date.now();
  s.record.retreats++;

  // 撤退 = 带出全部装备（items + backpack）
  s.broughtOut = _collectAllItemUids(s);
  s.lostOnDeath = [];  // 撤退不损失

  RiftState.save(s);
  return _settlementSummary(s);
};

// die(reason) → 死亡结算
// reason: string（死亡原因描述）
// 按 Q11：不显示分数，列出"带出 / 失去"装备清单
// 死亡 → 装备全失去（broughtOut 为空），或按后续规则调整
RiftState.die = function (reason = 'unknown') {
  const s = RiftState.getState();
  if (s.climb.status !== RiftState.STATUS.RUNNING) {
    console.warn('[RiftState] die: 非运行状态');
    return false;
  }

  s.climb.status = RiftState.STATUS.DIED;
  s.climb.endedAt = Date.now();
  s.record.losses++;

  // 死亡结算：全部装备失去（Q11 / Q12 设计意图：死亡是硬惩罚）
  s.broughtOut = [];
  s.lostOnDeath = _collectAllItemUids(s);

  RiftState.save(s);
  return _settlementSummary(s);
};

// ==================== Reset / Continue ====================
// resetRun() → 清空 climb/player/choices/结算，保留 record
RiftState.resetRun = function () {
  const s = RiftState.getState();
  const record = { ...s.record };
  _state = RiftState.DEFAULT_STATE();
  _state.record = record;
  RiftState.save(_state);
  return _state;
};

// continueFromDeath() → 死亡后选择"保留记录重玩"
// 与 resetRun 相同效果（清空当前爬塔数据，保留累计统计）
RiftState.continueFromDeath = function () {
  return RiftState.resetRun();
};

// ==================== Build 计算（复用 Game） ====================
// buildPlayer() → 用当前 player.items 构建 Game.aggregateBuild 输入
// 返回 build 对象，可直接传给 Game.calcDPS / calcEffectiveHP / Game.simulateBattle
RiftState.buildPlayer = function () {
  const s = RiftState.getState();
  const classId = s.player.classId;
  const cls = DATA.classes[classId];
  if (!cls) return { mods: {} };

  // 构造 Game.aggregateBuild 需要的 player 结构
  const simPlayer = {
    classId,
    baseStats: { ...cls.base },
    skillId: s.player.skills[0] || cls.skills[0].id,
    equipped: {}
  };

  // items → equipped（按 DATA.slots 映射）
  for (let i = 0; i < DATA.slots.length; i++) {
    const item = s.player.items[i];
    if (item) {
      simPlayer.equipped[DATA.slots[i]] = item;
    }
  }

  return Game.aggregateBuild(simPlayer);
};

// calcPlayerDPS() → 调用 Game.calcDPS(buildPlayer)
RiftState.calcPlayerDPS = function () {
  const build = RiftState.buildPlayer();
  return Game.calcDPS(build);
};

// calcPlayerEHP() → 调用 Game.calcEffectiveHP(buildPlayer)
RiftState.calcPlayerEHP = function () {
  const build = RiftState.buildPlayer();
  return Game.calcEffectiveHP(build);
};

// simulateRiftBattle(monster) → 调用 Game.simulateBattle(buildPlayer, monster)
RiftState.simulateRiftBattle = function (monster) {
  const build = RiftState.buildPlayer();
  return Game.simulateBattle(build, monster);
};

// ==================== HP 管理 ====================
// healHp(amount) → 回血（不超过 hpMax）
RiftState.healHp = function (amount) {
  const s = RiftState.getState();
  s.player.hp = Math.min(s.player.hp + amount, s.player.hpMax);
  RiftState.save(s);
  return s.player.hp;
};

// takeDamage(amount) → 扣血（到 0 触发死亡检查）
RiftState.takeDamage = function (amount) {
  const s = RiftState.getState();
  s.player.hp = Math.max(0, s.player.hp - amount);
  RiftState.save(s);
  return s.player.hp;
};

// recalcHpMax() → 重算最大 HP（装备变动后）
RiftState.recalcHpMax = function () {
  const build = RiftState.buildPlayer();
  const ehp = Game.calcEffectiveHP(build);
  // 用 EHP 的 life 值作为 hpMax 基础，加上装备 life 加成
  const s = RiftState.getState();
  s.player.hpMax = Math.round(ehp.hp + (build.mods.life || 0) - 50);
  // 保守：不低于原始 base
  const cls = DATA.classes[s.player.classId];
  const baseHpMax = 50 + (cls.base.vit || 0) * 5;
  s.player.hpMax = Math.max(s.player.hpMax, baseHpMax);
  // 当前 hp 不超过新 hpMax
  s.player.hp = Math.min(s.player.hp, s.player.hpMax);
  RiftState.save(s);
  return s.player.hpMax;
};

// ==================== 装备管理 ====================
// equipItem(itemUid, slotIndex) → 从背包装备到指定槽位
RiftState.equipItem = function (itemUid, slotIndex) {
  const s = RiftState.getState();
  if (slotIndex < 0 || slotIndex >= RiftState.ITEM_SLOTS) return false;

  // 从 backpack 找到 item
  const bpIdx = s.player.backpack.findIndex(it => it && it.uid === itemUid);
  if (bpIdx < 0) return false;

  const item = s.player.backpack[bpIdx];

  // 检查 slot 是否匹配
  const targetSlot = DATA.slots[slotIndex];
  if (item.slot !== targetSlot) return false;

  // 如果目标槽已有装备 → 换下来进背包
  const existing = s.player.items[slotIndex];
  if (existing) {
    s.player.backpack.push(existing);
  }

  s.player.items[slotIndex] = item;
  s.player.backpack.splice(bpIdx, 1);

  RiftState.save(s);
  RiftState.recalcHpMax();
  return true;
};

// unequipItem(slotIndex) → 从槽位卸到背包
RiftState.unequipItem = function (slotIndex) {
  const s = RiftState.getState();
  if (slotIndex < 0 || slotIndex >= RiftState.ITEM_SLOTS) return false;
  const item = s.player.items[slotIndex];
  if (!item) return false;

  s.player.backpack.push(item);
  s.player.items[slotIndex] = null;

  RiftState.save(s);
  RiftState.recalcHpMax();
  return true;
};

// sellItem(itemUid) → 卖出背包物品得金币
RiftState.sellItem = function (itemUid) {
  const s = RiftState.getState();
  const idx = s.player.backpack.findIndex(it => it && it.uid === itemUid);
  if (idx < 0) return false;

  const item = s.player.backpack[idx];
  // 卖价 = 稀有度权重 × ilvl
  const rarityValues = { normal: 5, magic: 15, rare: 40, unique: 100, set: 80 };
  const value = (rarityValues[item.rarity] || 10) * (item.ilvl || 1);

  s.player.gold += value;
  s.player.backpack.splice(idx, 1);

  RiftState.save(s);
  return { sold: itemUid, gold: value };
};

// ==================== 内部辅助 ====================
// _collectAllItemUids(state) → 收集所有已装备 + 背包物品 uid
function _collectAllItemUids(s) {
  const uids = [];
  for (const item of s.player.items) {
    if (item && item.uid) uids.push(item.uid);
  }
  for (const item of s.player.backpack) {
    if (item && item.uid) uids.push(item.uid);
  }
  return uids;
}

// _settlementSummary(state) → 结算摘要（Q11: 不显示分数）
function _settlementSummary(s) {
  const itemsEquipped = s.player.items.filter(i => i !== null).length;
  const itemsInBackpack = s.player.backpack.length;
  const totalItems = itemsEquipped + itemsInBackpack;

  return {
    runId: s.climb.runId,
    classId: s.player.classId,
    floor: s.climb.floor,
    maxFloor: s.climb.maxFloor,
    status: s.climb.status,
    gold: s.player.gold,
    broughtOut: s.broughtOut,
    lostOnDeath: s.lostOnDeath,
    choices: { ...s.choices },
    totalItems,
    itemsEquipped,
    itemsInBackpack,
    durationMs: s.climb.endedAt && s.climb.startedAt
      ? s.climb.endedAt - s.climb.startedAt
      : 0
  };
}

// ==================== JSON.config 配置结构 ====================
// RiftState.CONFIG 用于外部模块读取常量 / 默认值
RiftState.CONFIG = {
  saveKey: RiftState.SAVE_KEY,
  maxFloor: RiftState.MAX_FLOOR,
  itemSlots: RiftState.ITEM_SLOTS,
  statusValues: RiftState.STATUS,
  choiceKinds: RiftState.CHOICE_KINDS,
  slots: DATA.slots,
  slotNames: DATA.slotNames,
  classIds: Object.keys(DATA.classes),
  raritySellValues: { normal: 5, magic: 15, rare: 40, unique: 100, set: 80 }
};
