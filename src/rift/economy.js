// ==================== 裂隙行者 5% · 装备经济系统 ====================
// 模块：upgradeItem / fuseItems / sellItem / buyBrine / calculateTileReward
// 按 DESIGN.md "六、装备经济系统" 完整逻辑
// 所有操作都是破坏性 —— 一旦执行，钱/装备就没了，无回滚

const Economy = {};

// ============================================================
// 常量 · 金币值表 & 融入概率 & 升级概率 & 血瓶参数
// ============================================================

Economy.SELL_VALUES = {
  normal: 8,
  magic: 25,
  rare: 80,
  unique: 300,
  set: 0  // 套装不可卖（设计意图：保护战略性）
};

Economy.UPGRADE_SUCCESS_RATE = 0.80;  // 80% +1阶
Economy.UPGRADE_SHATTER_RATE = 0.20;  // 20% 碎裂
Economy.UPGRADE_SHATTER_GOLD_REFUND_RATE = 0.30; // 碎裂时返还 30% 升级花费金币
Economy.UPGRADE_GOLD_COST = 20;       // 每次升级消耗金币
Economy.MAX_UPGRADE_CAP = 2;          // 最高 +2 阶（稀有度最高升到 T5 级别）
Economy.T6_TIER_ID = 'T6';            // T6 传说词条不可升级

Economy.FUSE_RATES = {
  shattered: 0.60,  // 60% 碎光（三件全碎 + 少量金币返回）
  high: 0.35,       // 35% 高一阶（三件消失，生成 1 件高一阶等槽位装）
  legendary: 0.05   // 5% 传奇（三件消失，生成 1 件传奇或 T6 紫词条装）
};
Economy.FUSE_GOLD_REFUND = 5;  // 碎光时少量金币返还

Economy.BRINE_PRICE = 10;      // 10 金币 / 个
Economy.BRINE_MAX = 50;        // 上限 50 个

Economy.BRINE_FREE_PER_10_FLOOR = 1; // 每 10 层免费 1 个血瓶（Q5）

// ============================================================
// 1. upgradeItem(item) — 升级操作
// ============================================================
// 80% → 装备 +1 阶（最高 +2 到 T5）
// 20% → 装备碎裂 + 金币返还 30%
// T6 紫词条不允许升级（防绕过融入）
// 升级阶数用 item.upgradeLevel 字段追踪，初始为 0

Economy.upgradeItem = function (item) {
  if (!item) return { success: false, error: '无效物品' };

  // T6 紫词条不允许升级
  if (item.affixes) {
    for (const affix of item.affixes) {
      if (affix.tier === Economy.T6_TIER_ID) {
        return { success: false, error: 'T6 传说词条不可升级（只能融出）' };
      }
    }
  }

  // 检查已升级次数
  const currentUpgrade = item.upgradeLevel || 0;
  if (currentUpgrade >= Economy.MAX_UPGRADE_CAP) {
    return { success: false, error: `已达最大升级上限 +${Economy.MAX_UPGRADE_CAP}` };
  }

  // 套装不可升级（保护战略性）
  if (item.rarity === 'set') {
    return { success: false, error: '套装不可升级' };
  }

  // 概率判定
  const roll = Math.random();
  if (roll < Economy.UPGRADE_SUCCESS_RATE) {
    // 成功：+1 阶
    item.upgradeLevel = currentUpgrade + 1;
    // 提升 mods 数值 15%（升级增益）
    const upgradeMultiplier = 1.15;
    for (const k in item.mods) {
      const v = item.mods[k];
      if (typeof v === 'number' && k !== 'pierce' && k !== 'knockback' && k !== 'chain') {
        item.mods[k] = Math.round(v * upgradeMultiplier * 10) / 10;
      }
    }
    // 提升 base 数值 15%
    for (const k in item.base) {
      const v = item.base[k];
      if (typeof v === 'number') {
        item.base[k] = Math.round(v * upgradeMultiplier * 10) / 10;
      }
    }

    return {
      success: true,
      result: 'upgraded',
      upgradeLevel: item.upgradeLevel,
      goldCost: Economy.UPGRADE_GOLD_COST,
      message: `升级成功！装备 ${item.name} +${item.upgradeLevel} 阶`
    };
  } else {
    // 碎裂：返还 30% 金币
    const goldRefund = Math.round(Economy.UPGRADE_GOLD_COST * Economy.UPGRADE_SHATTER_GOLD_REFUND_RATE);
    return {
      success: false,
      result: 'shattered',
      goldRefund,
      goldCost: Economy.UPGRADE_GOLD_COST,
      shatteredItem: { ...item },  // 碎裂前的副本（供 UI 展示）
      message: `升级失败！装备 ${item.name} 碎裂，返还 ${goldRefund} 金币`
    };
  }
};

// ============================================================
// 2. fuseItems([item1, item2, item3]) — 融入操作（B 曲线·三件共振）
// ============================================================
// 三件必须同稀有度
// 60% → 碎光（三件全碎 + 少量金币返回）
// 35% → 高一阶（三件消失，生成 1 件高一阶等槽位装）
// 5%  → 传奇（三件消失，生成 1 件传奇或 T6 紫词条装）
// 返回 gacha 动画 payload

Economy.RARITY_ORDER = ['normal', 'magic', 'rare', 'unique', 'set'];

Economy._nextRarity = function (rarity) {
  const idx = Economy.RARITY_ORDER.indexOf(rarity);
  if (idx < 0 || idx >= Economy.RARITY_ORDER.length - 1) return null;
  return Economy.RARITY_ORDER[idx + 1];
};

Economy.fuseItems = function (items) {
  // 校验
  if (!Array.isArray(items) || items.length !== 3) {
    return { success: false, error: '需要恰好 3 件装备' };
  }

  for (let i = 0; i < 3; i++) {
    if (!items[i]) return { success: false, error: `第 ${i + 1} 件装备无效` };
  }

  // 三件必须同稀有度
  const rarities = items.map(it => it.rarity);
  if (rarities[0] !== rarities[1] || rarities[1] !== rarities[2]) {
    return { success: false, error: '三件装备稀有度不一致' };
  }

  // 套装不可融入（保护战略性）
  if (rarities[0] === 'set') {
    return { success: false, error: '套装不可融入' };
  }

  // 概率判定
  const roll = Math.random();
  let result, newItem;

  if (roll < Economy.FUSE_RATES.shattered) {
    // 碎光
    result = 'shattered';
    const goldRefund = Economy.FUSE_GOLD_REFUND;
    return {
      success: false,
      result: 'shattered',
      goldRefund,
      message: '融入失败！三件装备碎光',
      animation: {
        type: 'fuse_shattered',
        particles: 3,
        color: '#ff4444',
        duration: 1.5,
        caption: '碎光 ✨'
      }
    };
  } else if (roll < Economy.FUSE_RATES.shattered + Economy.FUSE_RATES.high) {
    // 高一阶
    result = 'high';
    const nextRarity = Economy._nextRarity(rarities[0]);
    if (!nextRarity) {
      // 已是最高阶 → 碎光替代
      return {
        success: false,
        result: 'shattered',
        goldRefund: Economy.FUSE_GOLD_REFUND,
        message: '已是最高阶，融入碎光',
        animation: {
          type: 'fuse_shattered',
          particles: 3,
          color: '#ff4444',
          duration: 1.5,
          caption: '碎光 ✨'
        }
      };
    }
    // 生成高一阶等槽位装（取第一件的槽位，用第一件的等级）
    newItem = Economy._generateFusedItem(items[0].slot, nextRarity, items[0].ilvl || 1);
    return {
      success: true,
      result: 'high',
      newItem,
      message: `融入成功！生成 ${newItem.name}`,
      animation: {
        type: 'fuse_high',
        particles: 5,
        color: '#ffcc44',
        duration: 2.0,
        caption: '升阶 ↑',
        flashColor: '#ffaa00'
      }
    };
  } else {
    // 传奇
    result = 'legendary';
    // 5% → 生成传奇或 T6 紫词条装
    newItem = Economy._generateLegendaryFusedItem(items[0].slot, items[0].ilvl || 1);
    return {
      success: true,
      result: 'legendary',
      newItem,
      message: `融入奇迹！生成 ${newItem.name}`,
      animation: {
        type: 'fuse_legendary',
        particles: 12,
        color: '#ff66ff',
        duration: 3.0,
        caption: '传奇降临 ✦',
        flashColor: '#ff66ff',
        special: true
      }
    };
  }
};

// 生成高一阶的融入结果装备
Economy._generateFusedItem = function (slot, rarity, ilvl) {
  // 简化版：用 DATA.baseItems 中对应槽位的基础装备 + 稀有度的词条数量
  // 需要 DATA 和 Game 模块，这里用独立逻辑避免硬依赖
  const basePool = (typeof DATA !== 'undefined' && DATA.baseItems) ? DATA.baseItems[slot] : [];
  if (basePool.length === 0) {
    // fallback：生成空壳装备
    return {
      uid: (typeof Game !== 'undefined' && Game.uid) ? Game.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: `融入·${slot}`,
      slot,
      rarity,
      base: {},
      mods: {},
      affixes: [],
      ilvl: ilvl + 5,
      upgradeLevel: 0,
      type: 'fused'
    };
  }

  // 选等级合适的基础
  const validBases = basePool.filter(b => b.level <= ilvl + 5);
  const base = validBases.length > 0 ? validBases[validBases.length - 1] : basePool[0];

  // 词条数量按稀有度
  const affixCountMap = { normal: 0, magic: 1, rare: 2, unique: 0, set: 0 };
  const affixCount = affixCountMap[rarity] || 1;

  // 随机词条
  const mods = {};
  const affixes = [];
  if (affixCount > 0) {
    const prefixPool = (typeof DATA !== 'undefined' && DATA.prefixes) ? DATA.prefixes : [];
    const suffixPool = (typeof DATA !== 'undefined' && DATA.suffixes) ? DATA.suffixes : [];
    // 简化：随机挑 prefix + suffix
    if (prefixPool.length > 0) {
      const pfx = prefixPool[Math.floor(Math.random() * prefixPool.length)];
      for (const k in pfx.mod) {
        const v = pfx.mod[k];
        const lvlScale = 1 + (ilvl - base.level) * 0.05;
        mods[k] = (mods[k] || 0) + (typeof v === 'number' ? Math.round(v * lvlScale * 10) / 10 : v);
      }
      affixes.push({ ...pfx, kind: 'prefix' });
    }
    if (affixCount > 1 && suffixPool.length > 0) {
      const sfx = suffixPool[Math.floor(Math.random() * suffixPool.length)];
      for (const k in sfx.mod) {
        const v = sfx.mod[k];
        const lvlScale = 1 + (ilvl - base.level) * 0.05;
        mods[k] = (mods[k] || 0) + (typeof v === 'number' ? Math.round(v * lvlScale * 10) / 10 : v);
      }
      affixes.push({ ...sfx, kind: 'suffix' });
    }
  }

  // 名称组装
  const prefix = affixes.find(a => a.kind === 'prefix');
  const suffix = affixes.find(a => a.kind === 'suffix');
  let name = base.name;
  if (prefix) name = prefix.name + name;
  if (suffix) name = name + ' ' + suffix.name;

  return {
    uid: (typeof Game !== 'undefined' && Game.uid) ? Game.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name,
    slot,
    rarity,
    base: { ...base.base },
    mods,
    affixes,
    ilvl: ilvl + 5,
    upgradeLevel: 0,
    type: 'fused'
  };
};

// 5% 融入生成传奇或 T6 紫词条装
Economy._generateLegendaryFusedItem = function (slot, ilvl) {
  // 优先尝试从 DATA.legendaries 中取对应槽位的传奇
  if (typeof DATA !== 'undefined' && DATA.legendaries) {
    const allLegendaries = [];
    for (const classId in DATA.legendaries) {
      if (classId === 'shared') continue;
      const classLegs = DATA.legendaries[classId];
      if (Array.isArray(classLegs)) {
        for (const leg of classLegs) {
          if (leg.slot === slot) allLegendaries.push(leg);
        }
      }
    }
    // 共享传奇
    if (Array.isArray(DATA.legendaries.shared)) {
      for (const leg of DATA.legendaries.shared) {
        if (leg.slot === slot) allLegendaries.push(leg);
      }
    }

    if (allLegendaries.length > 0) {
      const tmpl = allLegendaries[Math.floor(Math.random() * allLegendaries.length)];
      const lvlScale = 1 + (ilvl - 30) * 0.02;
      const mods = {};
      for (const k in tmpl.mods) {
        if (typeof tmpl.mods[k] === 'number' && k !== 'pierce' && k !== 'knockback' && k !== 'chain') {
          mods[k] = Math.round(tmpl.mods[k] * lvlScale * 10) / 10;
        } else {
          mods[k] = tmpl.mods[k];
        }
      }
      return {
        uid: (typeof Game !== 'undefined' && Game.uid) ? Game.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        name: tmpl.name,
        slot: tmpl.slot,
        rarity: 'unique',
        base: { ...tmpl.base },
        mods,
        affixes: [],
        flavor: tmpl.flavor,
        ilvl: ilvl + 10,
        upgradeLevel: 0,
        type: 'fused_legendary'
      };
    }
  }

  // fallback：生成 T6 紫词条稀有装
  const basePool = (typeof DATA !== 'undefined' && DATA.baseItems) ? DATA.baseItems[slot] : [];
  const base = basePool.length > 0 ? basePool[basePool.length - 1] : { name: '传奇碎片', base: {} };

  // 生成高强度 mods（模拟 T6）
  const mods = {};
  // 从高强度前缀池中选（T6 级别的 prefix）
  const highPrefixPool = (typeof DATA !== 'undefined' && DATA.prefixes)
    ? DATA.prefixes.filter(p => p.weight <= 1)
    : [];
  const highSuffixPool = (typeof DATA !== 'undefined' && DATA.suffixes)
    ? DATA.suffixes.filter(p => p.weight <= 1)
    : [];

  if (highPrefixPool.length > 0) {
    const pfx = highPrefixPool[Math.floor(Math.random() * highPrefixPool.length)];
    const lvlScale = 1 + (ilvl - base.level) * 0.05;
    const t6Mult = 1.55; // T6 multiplier
    for (const k in pfx.mod) {
      const v = pfx.mod[k];
      mods[k] = (mods[k] || 0) + (typeof v === 'number' ? Math.round(v * lvlScale * t6Mult * 10) / 10 : v);
    }
  }
  if (highSuffixPool.length > 0) {
    const sfx = highSuffixPool[Math.floor(Math.random() * highSuffixPool.length)];
    const lvlScale = 1 + (ilvl - base.level) * 0.05;
    const t6Mult = 1.55;
    for (const k in sfx.mod) {
      const v = sfx.mod[k];
      mods[k] = (mods[k] || 0) + (typeof v === 'number' ? Math.round(v * lvlScale * t6Mult * 10) / 10 : v);
    }
  }

  return {
    uid: (typeof Game !== 'undefined' && Game.uid) ? Game.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: base.name || '传奇碎片',
    slot,
    rarity: 'rare',
    base: { ...(base.base || {}) },
    mods,
    affixes: [],
    ilvl: ilvl + 10,
    upgradeLevel: 0,
    fusedTier: 'T6',
    type: 'fused_legendary'
  };
};

// ============================================================
// 3. sellItem(item) — 卖出装备
// ============================================================
// 金币值表 normal=8/magic=25/rare=80/unique=300/set=0
// 套装不可卖（设计意图：保护战略性）
// 返回卖出获得的金币数

Economy.sellItem = function (item) {
  if (!item) return { success: false, error: '无效物品', goldReceived: 0 };

  if (item.rarity === 'set') {
    return { success: false, error: '套装不可卖出（战略性保护）', goldReceived: 0 };
  }

  const value = Economy.SELL_VALUES[item.rarity] || 0;
  return {
    success: true,
    goldReceived: value,
    soldItem: { ...item },
    message: `卖出 ${item.name}，获得 ${value} 金币`
  };
};

// ============================================================
// 4. buyBrine(state, amount) — 血瓶买入
// ============================================================
// 10 金币 / 个
// state.brines 上限 50（可堆叠）
// 每 10 层免费 1 个（Q5 保底，由 calculateTileReward 处理）

Economy.buyBrine = function (state, amount) {
  if (!state) return { success: false, error: '无效状态' };

  amount = Math.max(1, Math.floor(amount || 1));
  const currentBrines = state.brines || 0;
  const maxBuy = Economy.BRINE_MAX - currentBrines;

  if (maxBuy <= 0) {
    return { success: false, error: `血瓶已达上限 ${Economy.BRINE_MAX}，无法再买`, brinesAfter: currentBrines };
  }

  const actualBuy = Math.min(amount, maxBuy);
  const totalCost = actualBuy * Economy.BRINE_PRICE;

  if ((state.gold || 0) < totalCost) {
    // 计算能买多少个
    const canAfford = Math.floor((state.gold || 0) / Economy.BRINE_PRICE);
    if (canAfford <= 0) {
      return { success: false, error: `金币不足（需要 ${totalCost}，仅有 ${state.gold || 0}）`, brinesAfter: currentBrines };
    }
    // 部分购买
    const partialBuy = Math.min(canAfford, maxBuy);
    const partialCost = partialBuy * Economy.BRINE_PRICE;
    state.gold -= partialCost;
    state.brines = currentBrines + partialBuy;
    return {
      success: true,
      goldSpent: partialCost,
      brinesBought: partialBuy,
      brinesAfter: state.brines,
      partial: true,
      message: `金币不足全额购买，买了 ${partialBuy} 个血瓶，花费 ${partialCost} 金币`
    };
  }

  state.gold -= totalCost;
  state.brines = currentBrines + actualBuy;
  return {
    success: true,
    goldSpent: totalCost,
    brinesBought: actualBuy,
    brinesAfter: state.brines,
    message: `购买 ${actualBuy} 个血瓶，花费 ${totalCost} 金币`
  };
};

// 血瓶价格显示
Economy.showBrinePrice = function (state) {
  const current = state ? (state.brines || 0) : 0;
  const max = Economy.BRINE_MAX;
  const price = Economy.BRINE_PRICE;
  return `🩸 1 = 💰${price} (${current}/${max})`;
};

// ============================================================
// 5. calculateTileReward(floor) — 每层结算奖励
// ============================================================
// 返回 { gold, itemTier, itemRarity }
// 前 5 层轻（教学），6-15 中（累积），16-25 高（赌期），26-35 极端
// 每 10 层免费 1 个血瓶（Q5）

Economy.calculateTileReward = function (floor) {
  floor = Math.max(1, Math.floor(floor || 1));

  // 金币：前轻后重
  let gold;
  if (floor <= 5) {
    gold = 5 + Math.floor(Math.random() * 8);    // 5-12
  } else if (floor <= 15) {
    gold = 12 + Math.floor(Math.random() * 15);   // 12-26
  } else if (floor <= 25) {
    gold = 25 + Math.floor(Math.random() * 20);   // 25-44
  } else {
    gold = 40 + Math.floor(Math.random() * 25);   // 40-64
  }

  // 物品稀有度：随层数递进
  let itemRarity;
  const rarityRoll = Math.random();
  if (floor <= 5) {
    itemRarity = rarityRoll < 0.70 ? 'normal' : rarityRoll < 0.90 ? 'magic' : 'rare';
  } else if (floor <= 15) {
    itemRarity = rarityRoll < 0.40 ? 'normal' : rarityRoll < 0.75 ? 'magic' : rarityRoll < 0.92 ? 'rare' : 'unique';
  } else if (floor <= 25) {
    itemRarity = rarityRoll < 0.15 ? 'normal' : rarityRoll < 0.40 ? 'magic' : rarityRoll < 0.75 ? 'rare' : rarityRoll < 0.95 ? 'unique' : 'set';
  } else {
    itemRarity = rarityRoll < 0.05 ? 'magic' : rarityRoll < 0.30 ? 'rare' : rarityRoll < 0.70 ? 'unique' : 'set';
  }

  // 物品 tier：随层数递进
  let itemTier;
  const tierRoll = Math.random();
  if (floor <= 5) {
    itemTier = tierRoll < 0.60 ? 'T1' : tierRoll < 0.85 ? 'T2' : 'T3';
  } else if (floor <= 15) {
    itemTier = tierRoll < 0.30 ? 'T2' : tierRoll < 0.65 ? 'T3' : tierRoll < 0.90 ? 'T4' : 'T5';
  } else if (floor <= 25) {
    itemTier = tierRoll < 0.10 ? 'T3' : tierRoll < 0.40 ? 'T4' : tierRoll < 0.80 ? 'T5' : 'T6';
  } else {
    itemTier = tierRoll < 0.05 ? 'T4' : tierRoll < 0.25 ? 'T5' : 'T6';
  }

  // 每 10 层免费 1 个血瓶（Q5 保底）
  const freeBrine = (floor % 10 === 0) ? Economy.BRINE_FREE_PER_10_FLOOR : 0;

  return {
    gold,
    itemRarity,
    itemTier,
    freeBrine,
    floor,
    message: `第 ${floor} 层奖励：💰${gold} 金币 / ${itemRarity} 装备 / ${itemTier} 词条${freeBrine > 0 ? ` / 🩸+${freeBrine} 血瓶` : ''}`
  };
};

// ============================================================
// 6. 经济崩溃判定
// ============================================================
// state.gold < 5 && state.brines < 1 → 警告 modal

Economy.checkEconomicCollapse = function (state) {
  if (!state) return { collapse: false };
  const gold = state.gold || 0;
  const brines = state.brines || 0;

  if (gold < 5 && brines < 1) {
    return {
      collapse: true,
      severity: 'critical',
      message: '⚠️ 经济崩溃！金币 < 5 且无血瓶，无法继续爬塔',
      suggestion: '考虑撤退带出当前装备，或回城补给'
    };
  }

  if (gold < 10 && brines < 2) {
    return {
      collapse: false,
      warning: true,
      message: '⚠️ 经济紧张！金币和血瓶都不多了',
      suggestion: '谨慎冲塔，考虑减少融入赌注'
    };
  }

  return { collapse: false, warning: false };
};

// ============================================================
// Export
// ============================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Economy;
}

// ==================== Self-test ====================
(function selfTest() {
  if (typeof process === 'undefined' || !process.argv || !process.argv.includes('--test')) return;

  console.log('\n=== Economy Module Self-test ===\n');

  // --- Test 1: upgradeItem ---
  console.log('--- 1. upgradeItem ---');
  const testItem = {
    uid: 'test001',
    name: '战术头盔',
    slot: 'helm',
    rarity: 'magic',
    base: { ac: 38 },
    mods: { str: 5 },
    affixes: [{ name: '对齐的', mod: { str: 5 }, kind: 'prefix', tier: 'T2', weight: 12 }],
    ilvl: 15,
    upgradeLevel: 0,
    type: 'generated'
  };

  // 成功升级
  const upgradeResult = Economy.upgradeItem(testItem);
  console.log(`upgradeItem (magic T2): success=${upgradeResult.success}, result=${upgradeResult.result}`);
  if (upgradeResult.success) {
    console.log(`  upgradeLevel=${testItem.upgradeLevel}, mods.str=${testItem.mods.str}`);
  }

  // T6 不可升级
  const t6Item = {
    uid: 'test002',
    name: 'Trinity头盔',
    slot: 'helm',
    rarity: 'rare',
    base: { ac: 55 },
    mods: { dmg_pct: 40, all_res: 12 },
    affixes: [{ name: 'Trinity 的', mod: { dmg_pct: 40, all_res: 12, pierce: 1 }, kind: 'prefix', tier: 'T6', weight: 1 }],
    ilvl: 25,
    upgradeLevel: 0,
    type: 'generated'
  };
  const t6Result = Economy.upgradeItem(t6Item);
  console.log(`upgradeItem (T6): success=${t6Result.success}, error="${t6Result.error}"`);

  // 套装不可升级
  const setItem = {
    uid: 'test003',
    name: '面壁者手套',
    slot: 'gloves',
    rarity: 'set',
    base: { ac: 32 },
    mods: { fth: 10, crit: 5 },
    affixes: [],
    setId: 'wallfacer',
    ilvl: 25,
    upgradeLevel: 0,
    type: 'set'
  };
  const setResult = Economy.upgradeItem(setItem);
  console.log(`upgradeItem (set): success=${setResult.success}, error="${setResult.error}"`);

  // 达到上限
  const cappedItem = { ...testItem, upgradeLevel: 2, mods: { str: 6 }, base: { ac: 42 }, affixes: [{ tier: 'T2' }] };
  const capResult = Economy.upgradeItem(cappedItem);
  console.log(`upgradeItem (capped +2): success=${capResult.success}, error="${capResult.error}"`);

  // --- Test 2: fuseItems ---
  console.log('\n--- 2. fuseItems ---');
  const fuseItem1 = { uid: 'f1', name: '短管冲锋枪', slot: 'weapon', rarity: 'normal', base: { dmg_min: 3, dmg_max: 8 }, mods: {}, affixes: [], ilvl: 5, upgradeLevel: 0 };
  const fuseItem2 = { uid: 'f2', name: '战术头盔', slot: 'helm', rarity: 'normal', base: { ac: 25 }, mods: {}, affixes: [], ilvl: 5, upgradeLevel: 0 };
  const fuseItem3 = { uid: 'f3', name: '防护背心', slot: 'armor', rarity: 'normal', base: { ac: 50 }, mods: {}, affixes: [], ilvl: 5, upgradeLevel: 0 };

  // 跑多次看分布
  const fuseResults = { shattered: 0, high: 0, legendary: 0 };
  for (let i = 0; i < 100; i++) {
    const fr = Economy.fuseItems([fuseItem1, fuseItem2, fuseItem3]);
    if (fr.result === 'shattered') fuseResults.shattered++;
    else if (fr.result === 'high') fuseResults.high++;
    else if (fr.result === 'legendary') fuseResults.legendary++;
  }
  console.log(`fuseItems 100次统计: shattered=${fuseResults.shattered} high=${fuseResults.high} legendary=${fuseResults.legendary}`);
  console.log(`  (期望: ~60/35/5)`);

  // 非同稀有度
  const badFuse = Economy.fuseItems([
    { uid: 'b1', rarity: 'normal', slot: 'weapon', base: {}, mods: {}, affixes: [], ilvl: 1 },
    { uid: 'b2', rarity: 'magic', slot: 'helm', base: {}, mods: {}, affixes: [], ilvl: 1 },
    { uid: 'b3', rarity: 'normal', slot: 'armor', base: {}, mods: {}, affixes: [], ilvl: 1 }
  ]);
  console.log(`fuseItems (mixed rarity): success=${badFuse.success}, error="${badFuse.error}"`);

  // 套装融入
  const setFuse = Economy.fuseItems([
    { uid: 's1', rarity: 'set', slot: 'helm', base: {}, mods: {}, affixes: [], ilvl: 1, setId: 'wallfacer' },
    { uid: 's2', rarity: 'set', slot: 'armor', base: {}, mods: {}, affixes: [], ilvl: 1, setId: 'wallfacer' },
    { uid: 's3', rarity: 'set', slot: 'weapon', base: {}, mods: {}, affixes: [], ilvl: 1, setId: 'wallfacer' }
  ]);
  console.log(`fuseItems (set): success=${setFuse.success}, error="${setFuse.error}"`);

  // --- Test 3: sellItem ---
  console.log('\n--- 3. sellItem ---');
  for (const [rarity, value] of Object.entries(Economy.SELL_VALUES)) {
    const sellResult = Economy.sellItem({ uid: 'sell1', name: `测试${rarity}`, slot: 'helm', rarity, base: {}, mods: {}, affixes: [], ilvl: 1 });
    console.log(`sellItem (${rarity}): success=${sellResult.success}, gold=${sellResult.goldReceived} (期望: ${value})`);
  }

  // --- Test 4: buyBrine ---
  console.log('\n--- 4. buyBrine ---');
  const state1 = { gold: 100, brines: 0 };
  const br1 = Economy.buyBrine(state1, 5);
  console.log(`buyBrine (gold=100, brines=0, amount=5): success=${br1.success}, goldSpent=${br1.goldSpent}, brinesAfter=${state1.brines}`);

  const state2 = { gold: 100, brines: 45 };
  const br2 = Economy.buyBrine(state2, 10); // 想买 10 但只剩 5 空位
  console.log(`buyBrine (gold=100, brines=45, amount=10): success=${br2.success}, brinesBought=${br2.brinesBought}, brinesAfter=${state2.brines}`);

  const state3 = { gold: 3, brines: 0 };
  const br3 = Economy.buyBrine(state3, 1);
  console.log(`buyBrine (gold=3, brines=0, amount=1): success=${br3.success}, error="${br3.error}"`);

  console.log(`showBrinePrice: ${Economy.showBrinePrice(state1)}`);
  console.log(`showBrinePrice (no state): ${Economy.showBrinePrice(null)}`);

  // --- Test 5: calculateTileReward ---
  console.log('\n--- 5. calculateTileReward ---');
  for (const floor of [1, 5, 10, 15, 20, 25, 30, 35]) {
    const reward = Economy.calculateTileReward(floor);
    console.log(`floor ${floor}: gold=${reward.gold}, rarity=${reward.itemRarity}, tier=${reward.itemTier}, freeBrine=${reward.freeBrine}`);
  }

  // --- Test 6: checkEconomicCollapse ---
  console.log('\n--- 6. checkEconomicCollapse ---');
  const collapse1 = Economy.checkEconomicCollapse({ gold: 2, brines: 0 });
  console.log(`collapse (gold=2, brines=0): collapse=${collapse1.collapse}, message="${collapse1.message}"`);

  const collapse2 = Economy.checkEconomicCollapse({ gold: 8, brines: 1 });
  console.log(`collapse (gold=8, brines=1): warning=${collapse2.warning}`);

  const collapse3 = Economy.checkEconomicCollapse({ gold: 50, brines: 10 });
  console.log(`collapse (gold=50, brines=10): collapse=${collapse3.collapse}, warning=${collapse3.warning}`);

  console.log('\n=== Self-test complete ===\n');
})();
