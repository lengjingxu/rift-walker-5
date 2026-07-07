// ==================== 暗黑出装系统 - 核心游戏逻辑 ====================
// 包含：装备生成、词条合成、套装识别、战斗模拟、Build 计算

const Game = {};

// ==================== 工具 ====================
Game.rand = (min, max) => Math.random() * (max - min) + min;
Game.randint = (min, max) => Math.floor(Game.rand(min, max + 1));
Game.pick = arr => arr[Game.randint(0, arr.length - 1)];
Game.weightedPick = (items, key = 'weight') => {
  const total = items.reduce((s, i) => s + (i[key] || 1), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= (item[key] || 1);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
};
Game.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
Game.clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));

// ==================== 装备生成 ====================
Game.generateItem = function (playerLevel = 1, forceRarity = null, forceSlot = null, forceClass = null) {
  // 选槽位
  const slot = forceSlot || Game.pick(DATA.slots.filter(s => s !== 'ring1' || Math.random() > 0.5));
  const realSlot = slot === 'ring2' ? 'ring2' : (slot === 'ring1' ? 'ring1' : slot);

  // 选稀有度
  let rarity = forceRarity;
  if (!rarity) {
    const pool = Object.entries(DATA.rarities).map(([k, v]) => ({ id: k, ...v }));
    rarity = Game.weightedPick(pool).id;
  }

  // 套装优先分配
  if (rarity === 'set') {
    const setPool = DATA.sets.filter(s => s.forClass === 'all' || s.forClass === (forceClass || 'barbarian'));
    if (setPool.length === 0) rarity = 'unique';
    else {
      const set = Game.weightedPick(setPool.map(s => ({ ...s, weight: 1 })));
      const piece = set.pieces.find(p => p.slot === realSlot) || Game.pick(set.pieces);
      return Game.makeSetItem(set, piece, playerLevel);
    }
  }

  // 传奇
  if (rarity === 'unique') {
    // 套装专属职业映射：resistor/conscious_awaken 等套装 id 对应的"职业 classId"
    // 让非套装传奇（如"圣索菲亚的婚戒"）能在对应职业掉落时出现
    const setToClass = {
      resistor: 'paladin',
      shadow_market: 'assassin',
      climate_sentinel: 'druid',
      conscious_awaken: 'necromancer'
    };
    const classId = forceClass || 'barbarian';
    const extraClass = Object.entries(setToClass)
      .filter(([setId, cid]) => cid === classId)
      .map(([setId]) => setId);
    const pool = [
      ...(DATA.legendaries[classId] || []),
      ...extraClass.flatMap(k => DATA.legendaries[k] || []),
      ...DATA.legendaries.shared
    ];
    const tmpl = Game.weightedPick(pool.map(p => ({ ...p, weight: 1 })));
    if (tmpl.slot !== realSlot) {
      // 槽位不匹配则改成稀有
      rarity = 'rare';
    } else {
      return Game.makeUnique(tmpl, playerLevel);
    }
  }

  // 普通/魔法/稀有：基于基础装备库
  const basePool = DATA.baseItems[realSlot] || [];
  if (basePool.length === 0) return null;

  // 按等级筛选
  const validBases = basePool.filter(b => b.level <= playerLevel + 5);
  const base = validBases.length > 0 ? Game.weightedPick(validBases.map(b => ({ ...b, weight: 1 }))) : basePool[0];

  return Game.makeRarityItem(base, realSlot, rarity, playerLevel);
};

Game.makeRarityItem = function (base, slot, rarity, playerLevel) {
  const config = DATA.rarities[rarity];
  const affixCount = config.affix_count;
  const affixes = [];

  // 选前缀和后缀（v1.2 · 词条等级 T1~T6 — tier 字段从 pool 自带）
  if (affixCount > 0) {
    const prefix = Game.weightedPick(DATA.prefixes);
    if (!affixes.find(a => a.kind === 'prefix')) affixes.push({ ...prefix, kind: 'prefix' });
  }
  if (affixCount > 1) {
    const suffix = Game.weightedPick(DATA.suffixes);
    if (!affixes.find(a => a.kind === 'suffix')) affixes.push({ ...suffix, kind: 'suffix' });
  }

  // 合并所有 mod（v1.2 · 先按 ilvl 缩放，再按 tier 乘数缩放）
  const mergedMods = {};
  for (const a of affixes) {
    const tierMult = (DATA.affixTiers && DATA.affixTiers[a.tier]) ? DATA.affixTiers[a.tier].multiplier : 1.0;
    for (const k in a.mod) {
      let v = a.mod[k];
      if (typeof v === 'number' && k !== 'pierce' && k !== 'knockback' && k !== 'chain') {
        // ilvl scale × tier multiplier
        const lvlScale = 1 + (playerLevel - base.level) * 0.05;
        v = v * lvlScale * tierMult;
        v = Math.round(v * 10) / 10;
      }
      mergedMods[k] = (mergedMods[k] || 0) + v;
    }
  }
  // 保留兼容：旧路径用的简单 lvlScale（防止其他代码依赖原结构）
  const lvlScale = 1 + (playerLevel - base.level) * 0.05;
  void lvlScale;

  // 名称组装
  const prefix = affixes.find(a => a.kind === 'prefix');
  const suffix = affixes.find(a => a.kind === 'suffix');
  let name = base.name;
  if (prefix) name = prefix.name + name;
  if (suffix) name = name + ' ' + suffix.name;
  if (!prefix && !suffix && rarity === 'magic') name = name + '（魔法）';

  return {
    uid: Game.uid(),
    name,
    slot,
    rarity,
    base: { ...base.base },
    mods: mergedMods,
    affixes,
    ilvl: playerLevel,
    socketCount: Game.calcSockets(slot, rarity),
    gems: [],
    type: 'generated'
  };
};

Game.makeUnique = function (tmpl, playerLevel) {
  // 传奇：固定词条，等级提升数值
  const lvlScale = 1 + (playerLevel - 30) * 0.02;
  const mods = {};
  for (const k in tmpl.mods) {
    if (typeof tmpl.mods[k] === 'number' && k !== 'pierce' && k !== 'knockback' && k !== 'chain') {
      mods[k] = Math.round(tmpl.mods[k] * lvlScale * 10) / 10;
    } else {
      mods[k] = tmpl.mods[k];
    }
  }
  return {
    uid: Game.uid(),
    name: tmpl.name,
    slot: tmpl.slot,
    rarity: 'unique',
    base: { ...tmpl.base },
    mods,
    affixes: [],
    flavor: tmpl.flavor,
    ilvl: playerLevel,
    socketCount: Game.calcSockets(tmpl.slot, 'unique'),
    gems: [],
    type: 'unique'
  };
};

Game.makeSetItem = function (set, piece, playerLevel) {
  const lvlScale = 1 + (playerLevel - 25) * 0.02;
  const mods = {};
  for (const k in piece.mods) {
    if (typeof piece.mods[k] === 'number' && k !== 'pierce' && k !== 'knockback' && k !== 'chain') {
      mods[k] = Math.round(piece.mods[k] * lvlScale * 10) / 10;
    } else {
      mods[k] = piece.mods[k];
    }
  }
  return {
    uid: Game.uid(),
    name: piece.name,
    slot: piece.slot,
    rarity: 'set',
    base: { ...piece.base },
    mods,
    affixes: [],
    setId: set.id,
    setName: set.name,
    setColor: set.color,
    ilvl: playerLevel,
    socketCount: Game.calcSockets(piece.slot, 'set'),
    gems: [],
    type: 'set'
  };
};


// ==================== 宝石镶嵌系统 (v1.1) ====================
// 根据槽位和稀有度计算孔数
// 普通/魔法 0-1 孔，稀有 1-2 孔，传奇/套装 2-3 孔
Game.calcSockets = function (slot, rarity) {
  const maxForSlot = (DATA.socketsMax && DATA.socketsMax[slot]) || 1;
  let range;
  if (rarity === 'unique' || rarity === 'set') range = [2, 3];
  else if (rarity === 'rare') range = [1, 2];
  else if (rarity === 'magic') range = [0, 1];
  else range = [0, 1];
  const lo = Math.min(range[0], maxForSlot);
  const hi = Math.min(range[1], maxForSlot);
  if (hi < lo) return Math.max(0, lo);
  // 25% 概率出最大孔数（鼓励打造）
  if (Math.random() < 0.25) return hi;
  return Game.randint(lo, hi);
};

// 初始化物品的 gems 字段（全是 null）
Game.initSockets = function (item) {
  if (!item) return;
  if (typeof item.socketCount !== 'number') item.socketCount = 0;
  if (!Array.isArray(item.gems)) {
    item.gems = new Array(item.socketCount).fill(null);
  } else {
    // 修正长度
    while (item.gems.length < item.socketCount) item.gems.push(null);
    item.gems.length = item.socketCount;
  }
};

// 镶嵌宝石。返回 true 成功，false 失败（无空槽/宝石无效）
Game.socketGem = function (item, gemId) {
  if (!item || !DATA.gems[gemId]) return false;
  Game.initSockets(item);
  const idx = item.gems.findIndex(g => !g);
  if (idx < 0) return false;
  item.gems[idx] = gemId;
  return true;
};

// 卸下宝石。返回卸下的 gemId，失败返回 null
Game.unsocketGem = function (item, idx) {
  if (!item || !Array.isArray(item.gems)) return null;
  if (idx < 0 || idx >= item.gems.length) return null;
  const gem = item.gems[idx];
  if (!gem) return null;
  item.gems[idx] = null;
  return gem;
};

// 计算物品的宝石总加成（合并 mod）
Game.getGemMods = function (item) {
  if (!item || !Array.isArray(item.gems)) return {};
  const out = {};
  for (const gid of item.gems) {
    if (!gid || !DATA.gems[gid]) continue;
    const g = DATA.gems[gid];
    for (const k in g.mod) {
      out[k] = (out[k] || 0) + g.mod[k];
    }
  }
  return out;
};

// ==================== 装备信息 ====================
Game.getItemAC = function (item) {
  if (!item) return 0;
  return (item.base.ac || 0) + (item.mods.ac || 0);
};

Game.getItemDamage = function (item) {
  if (!item) return { min: 0, max: 0, elem: 0 };
  const min = (item.base.dmg_min || 0) + (item.mods.dmg_min || 0);
  const max = (item.base.dmg_max || 0) + (item.mods.dmg_max || 0);
  const elem = (item.base.elem || 0) + (item.mods.elem || 0);
  return { min, max, elem };
};

Game.getItemSummary = function (item) {
  if (!item) return [];
  const lines = [];
  for (const k in item.base) {
    if (item.base[k]) {
      const v = item.base[k];
      const kName = Game.statDisplayKey(k);
      lines.push({ kind: 'base', text: `${kName}: ${v}` });
    }
  }
  for (const k in item.mods) {
    const v = item.mods[k];
    if (v) {
      const kName = Game.statDisplayKey(k);
      const sign = v > 0 ? '+' : '';
      lines.push({ kind: 'mod', text: `${sign}${v} ${kName}` });
    }
  }
  // 宝石加成（v1.1）
  const gemMods = Game.getGemMods(item);
  for (const k in gemMods) {
    const v = gemMods[k];
    const kName = Game.statDisplayKey(k);
    const sign = v > 0 ? '+' : '';
    if (k === 'all') {
      lines.push({ kind: 'gem', text: `${sign}${v} 全属性` });
    } else {
      lines.push({ kind: 'gem', text: `${sign}${v} ${kName} ◆` });
    }
  }
  return lines;
};

// ==================== v1.1 · 装备对比 ====================
// 提取物品的全部数值（base + mods + 宝石）→ { key: number }
Game.collectItemStats = function (item) {
  const stats = {};
  if (!item) return stats;
  const merge = (src) => {
    for (const k in src) {
      const v = src[k];
      if (typeof v === 'number' && v !== 0) {
        stats[k] = (stats[k] || 0) + v;
      }
    }
  };
  merge(item.base || {});
  merge(item.mods || {});
  // 宝石加成
  const gemMods = Game.getGemMods(item);
  merge(gemMods);
  return stats;
};

// 比较两件装备（同一槽位）
// 返回 { rows: [{ key, label, a, b, diff, better }], totals: { dpsA, dpsB, ehpA, ehpB, acA, acB } }
Game.compareItems = function (itemA, itemB) {
  // itemA = 已装备, itemB = 背包候选
  const aStats = Game.collectItemStats(itemA);
  const bStats = Game.collectItemStats(itemB);
  // 合并所有 key
  const keys = new Set([...Object.keys(aStats), ...Object.keys(bStats)]);
  // 排序：先攻击属性 → 防御 → 资源 → 其他
  const order = [
    'dmg_min', 'dmg_max', 'elem', 'dmg_pct', 'elem_pct', 'fire_pct', 'cold_pct', 'light_pct', 'holy_pct',
    'crit', 'crit_dmg', 'atk_speed', 'pierce', 'chain', 'knockback', 'slow', 'burn', 'poison',
    'ac', 'life', 'mana', 'all_res', 'block', 'dodge', 'shield', 'hp_regen', 'mana_regen', 'life_steal',
    'str', 'dex', 'int', 'vit', 'fth',
    'movespeed', 'gold', 'mf',
    'curse', 'dmg_aura', 'def_aura', 'summon_atk', 'summon_count', 'holy',
    'on_hit_mana', 'on_kill_life'
  ];
  const rows = [];
  for (const k of order) {
    if (!keys.has(k)) continue;
    const a = aStats[k] || 0;
    const b = bStats[k] || 0;
    if (a === 0 && b === 0) continue;
    let better = 'same';
    const diff = b - a;
    if (diff > 0) better = 'b';      // b 更高 → B 更好
    else if (diff < 0) better = 'a'; // A 更高
    rows.push({
      key: k,
      label: Game.statDisplayKey(k),
      a,
      b,
      diff: Math.abs(diff),
      better
    });
  }
  // 其他未在 order 里的 key（兜底）
  for (const k of keys) {
    if (order.includes(k)) continue;
    const a = aStats[k] || 0;
    const b = bStats[k] || 0;
    if (a === 0 && b === 0) continue;
    const diff = b - a;
    rows.push({
      key: k,
      label: Game.statDisplayKey(k),
      a,
      b,
      diff: Math.abs(diff),
      better: diff > 0 ? 'b' : (diff < 0 ? 'a' : 'same')
    });
  }
  // 计算总 DPS / EHP / AC 差异（用模拟玩家 build 替换单件估算）
  const totals = Game.compareTotals(itemA, itemB);
  return { rows, totals };
};

// 用替换单件的方式估算两件装备的 DPS / EHP / AC
Game.compareTotals = function (itemA, itemB) {
  const makeSim = (item) => {
    // 用真实职业作为 base（用 UI.player 当前职业，或默认 barbarian）
    const classId = (typeof UI !== 'undefined' && UI.player && UI.player.classId) || 'barbarian';
    const sim = Game.createPlayer(classId);
    if (item && item.slot) sim.equipped[item.slot] = item;
    return sim;
  };
  const simA = makeSim(itemA);
  const simB = makeSim(itemB);
  const buildA = Game.aggregateBuild(simA);
  const buildB = Game.aggregateBuild(simB);
  const dpsA = Math.round(Game.calcDPS(buildA).dps);
  const dpsB = Math.round(Game.calcDPS(buildB).dps);
  const ehpA = Math.round(Game.calcEffectiveHP(buildA).effectiveHP);
  const ehpB = Math.round(Game.calcEffectiveHP(buildB).effectiveHP);
  const acA = buildA.mods.ac || 0;
  const acB = buildB.mods.ac || 0;
  return { dpsA, dpsB, ehpA, ehpB, acA, acB };
};

Game.statDisplayKey = function (k) {
  const map = {
    str: '力量', dex: '敏捷', int: '智力', vit: '体力', fth: '信仰',
    ac: '防御', life: '生命', mana: '法力',
    dmg_min: '最小伤害', dmg_max: '最大伤害', elem: '元素伤害',
    dmg_pct: '伤害%', elem_pct: '元素伤害%',
    fire_pct: '火伤%', cold_pct: '冰伤%', light_pct: '电伤%', holy_pct: '圣伤%',
    crit: '暴击%', crit_dmg: '暴击伤害%',
    atk_speed: '攻击速度%', movespeed: '移速',
    block: '格挡%',
    life_steal: '生命偷取%', hp_regen: '生命回复', mana_regen: '法力回复',
    all_res: '全元素抗性',
    pierce: '穿透', chain: '连锁', knockback: '击退',
    slow: '减速%', burn: '燃烧/秒', poison: '中毒/秒',
    shield: '护盾', dodge: '闪避%',
    on_hit_mana: '击中回蓝', on_kill_life: '击杀回血',
    summon_atk: '召唤物攻击', summon_def: '召唤物防御', summon_count: '召唤数量', curse: '诅咒效果%',
    dmg_aura: '伤害光环%', def_aura: '防御光环%',
    holy: '神圣伤害',
    all: '全属性',
    gold: '金币获得%', mf: '魔法发现%'
  };
  return map[k] || k;
};

// ==================== 玩家 Build 聚合 ====================
Game.aggregateBuild = function (player) {
  const totalMods = {
    str: player.baseStats.str, dex: player.baseStats.dex, int: player.baseStats.int,
    vit: player.baseStats.vit, fth: player.baseStats.fth,
    life: 50 + player.baseStats.vit * 5,
    mana: 30 + player.baseStats.int * 3,
    ac: 0, dmg_min: 0, dmg_max: 0, elem: 0,
    dmg_pct: 0, elem_pct: 0, fire_pct: 0, cold_pct: 0, light_pct: 0, holy_pct: 0,
    crit: 5, crit_dmg: 50, atk_speed: 0, movespeed: 0, block: 0,
    life_steal: 0, hp_regen: 1, mana_regen: 1, all_res: 0,
    pierce: 0, chain: 0, knockback: 0, slow: 0, burn: 0, poison: 0,
    shield: 0, dodge: 0, on_hit_mana: 0, on_kill_life: 0,
    summon_atk: 0, summon_def: 0, summon_count: 0, curse: 0,
    dmg_aura: 0, def_aura: 0, holy: 0, all: 0, gold: 0, mf: 0
  };
  let ac = 0, dmgMin = 0, dmgMax = 0, elem = 0;

  // 技能加成
  const skill = DATA.classes[player.classId].skills.find(s => s.id === player.skillId);
  if (skill && skill.mod) {
    for (const k in skill.mod) {
      if (typeof skill.mod[k] === 'number') {
        totalMods[k] = (totalMods[k] || 0) + skill.mod[k];
      }
    }
  }

  // 装备聚合
  for (const slot of DATA.slots) {
    const item = player.equipped[slot];
    if (!item) continue;
    ac += item.base.ac || 0;
    dmgMin += item.base.dmg_min || 0;
    dmgMax += item.base.dmg_max || 0;
    elem += item.base.elem || 0;
    for (const k in item.mods) {
      const v = item.mods[k];
      if (k === 'all') {
        for (const stat of ['str', 'dex', 'int', 'vit', 'fth']) {
          totalMods[stat] = (totalMods[stat] || 0) + v;
        }
      } else if (typeof v === 'number') {
        totalMods[k] = (totalMods[k] || 0) + v;
      }
    }
    // 宝石加成（v1.1）
    const gemMods = Game.getGemMods(item);
    for (const gk in gemMods) {
      const gv = gemMods[gk];
      if (gk === 'all') {
        for (const stat of ['str', 'dex', 'int', 'vit', 'fth']) {
          totalMods[stat] = (totalMods[stat] || 0) + gv;
        }
      } else if (typeof gv === 'number') {
        totalMods[gk] = (totalMods[gk] || 0) + gv;
      }
    }
  }

  // 套装加成
  const setCounts = {};
  for (const slot of DATA.slots) {
    const item = player.equipped[slot];
    if (item && item.setId) {
      setCounts[item.setId] = (setCounts[item.setId] || 0) + 1;
    }
  }
  for (const setId in setCounts) {
    const set = DATA.sets.find(s => s.id === setId);
    const count = setCounts[setId];
    const activeBonuses = [];
    for (const tKey of Object.keys(set.bonuses)) {
      const threshold = parseInt(tKey, 10);
      if (count >= threshold) {
        activeBonuses.push({ count: threshold, ...set.bonuses[threshold] });
      }
    }
    for (const b of activeBonuses) {
      for (const k in b.mod) {
        if (k === 'all') {
          for (const stat of ['str', 'dex', 'int', 'vit', 'fth']) {
            totalMods[stat] = (totalMods[stat] || 0) + b.mod[k];
          }
        } else if (typeof b.mod[k] === 'number') {
          totalMods[k] = (totalMods[k] || 0) + b.mod[k];
        }
      }
    }
  }

  totalMods.ac += ac;
  totalMods.dmg_min += dmgMin;
  totalMods.dmg_max += dmgMax;
  totalMods.elem += elem;

  // 基础属性派生
  totalMods.life = 50 + totalMods.vit * 5 + (totalMods.life || 0);
  totalMods.mana = 30 + totalMods.int * 3 + (totalMods.mana || 0);

  return { mods: totalMods, setCounts };
};

// ==================== 战斗模拟 ====================
Game.calcDPS = function (build) {
  const m = build.mods;
  // 基础伤害
  const baseMin = m.dmg_min || 0;
  const baseMax = m.dmg_max || 0;
  const physAvg = (baseMin + baseMax) / 2 || 10;
  const elemAvg = m.elem || 0;

  const physMult = 1 + (m.dmg_pct || 0) / 100;
  const elemMult = 1 + ((m.elem_pct || 0) + (m.fire_pct || 0) + (m.cold_pct || 0) + (m.light_pct || 0) + (m.holy_pct || 0)) / 100;
  const strMult = 1 + (m.str || 0) * 0.002;
  const intMult = 1 + (m.int || 0) * 0.002;

  const physDmg = physAvg * physMult * strMult;
  const elemDmg = elemAvg * elemMult * intMult;
  const totalDmgPerHit = physDmg + elemDmg;

  // 技能加成
  const skillMod = window.player && DATA.classes[window.player.classId].skills.find(s => s.id === window.player.skillId);
  let skillMult = 1;
  let hits = 1;
  if (skillMod && skillMod.mod) {
    if (skillMod.mod.phys_mult) skillMult = Math.max(skillMult, skillMod.mod.phys_mult);
    if (skillMod.mod.elem_mult) skillMult = Math.max(skillMult, skillMod.mod.elem_mult);
    if (skillMod.mod.hits) hits = skillMod.mod.hits;
  }

  // 暴击
  const critRate = Game.clamp((m.crit || 0) / 100, 0, 1);
  const critDmg = (m.crit_dmg || 50) / 100;
  const critMult = 1 + critRate * critDmg;

  // 攻击速度
  const atkSpeed = 1 + (m.atk_speed || 0) / 100;
  const atkPerSec = 1.2 * atkSpeed;

  // 召唤物
  const summonDmg = (m.summon_atk || 0) * (m.summon_count || 0) * 0.5;

  // v1.1 词条扩展：持续伤害 DoT（按 5 秒窗口折算，burn=2.5s, poison=3.5s）
  const burnDPS = (m.burn || 0) * 2.5 * (1 + (m.fire_pct || 0) / 100);
  const poisonDPS = (m.poison || 0) * 3.5;

  const dps = (totalDmgPerHit * skillMult * critMult * hits * atkPerSec) + (summonDmg * atkPerSec) + burnDPS + poisonDPS;

  return { dps, dmgPerHit: totalDmgPerHit * skillMult * critMult, hits, atkPerSec, physDmg, elemDmg, summonDmg, burnDPS, poisonDPS };
};

Game.calcEffectiveHP = function (build) {
  const m = build.mods;
  const ac = m.ac || 0;
  const hp = m.life || 100;
  const shield = m.shield || 0;
  // 防御减伤公式（Diablo 风）
  const dr = Game.clamp(ac / (ac + 50 * 30), 0, 0.85);
  const res = Game.clamp((m.all_res || 0) / 100, -0.5, 0.75);
  const elemDR = 1 - res;
  // v1.1 词条扩展：闪避按概率减少 incoming DPS
  const dodgeRate = Game.clamp((m.dodge || 0) / 100, 0, 0.75);
  const dodgeDR = 1 - dodgeRate;
  // 护盾按 30% 等价转化为额外 EHP（一次性吸收再除以伤害率折算）
  const shieldEHP = shield * 0.3 / Math.max(0.01, 1 - dr);
  const effectiveHP = (hp + shieldEHP) / (1 - dr) / elemDR / dodgeDR;
  return { hp, ac, dr, res, effectiveHP, shield, dodgeRate, shieldEHP };
};

Game.simulateBattle = function (build, monster, rounds = 200) {
  // v1.4 第 2 项 · build 未注入 sig → 改用 player 参数（向后兼容）
  if (!build || !build._sig) {
    // 旧调用约定：build 实际是 player → 自己算 sig
    if (build && build.equipped) {
      build = Game._aggregateBuildCached(build);
    } else {
      // 没有 player 信息 → 不走缓存
      build = build || { mods: {} };
    }
  }
  // v1.4 第 2 项 · 缓存命中（同一 build + monster → 直接返回）
  const cacheKey = (build && build._sig) ? (build._sig + '|' + (monster.id || monster.name || 'm')) : null;
  if (cacheKey && Game.BUILD_CACHE.battles.has(cacheKey)) {
    Game.BUILD_CACHE_STATS.hits++;
    // 浅拷贝避免外部突变；ticks 数组共享引用（只读用途）
    const cached = Game.BUILD_CACHE.battles.get(cacheKey);
    return Object.assign({}, cached, { _cached: true });
  }
  Game.BUILD_CACHE_STATS.miss++;

  // v1.4 第 2 项 · 种子化 RNG（保证飘字确定 — 同 build+monster 永远同飘字序列）
  const seed = cacheKey ? (parseInt((cacheKey || '0').replace(/[^0-9a-z]/g, '').slice(0, 8), 36) || 1) : 1;
  const rng = Game._seededRandom(seed);
  // 兼容旧调用：随机函数仍叫 Math.random 但本次循环用 rng 替换
  // 通过局部变量 _r 替代 Math.random 调用
  const _r = () => rng();

  const player = Game.calcDPS(build);
  const ehp = Game.calcEffectiveHP(build);

  // 玩家对怪物伤害
  let playerDPS = player.dps;
  // 暴击二次验证：boss 减伤
  if (monster.boss) playerDPS *= 0.7;

  // 怪物对玩家伤害
  const monsterDmg = monster.dmg;
  const monsterAS = 1.0;
  const monsterDPS = monsterDmg * monsterAS;
  const playerDR = ehp.dr;
  const playerRes = 1 - Game.clamp((build.mods.all_res || 0) / 100, -0.5, 0.75);
  const playerIncomingDPS = monsterDPS * (1 - playerDR) * playerRes;

  // 模拟
  let playerHP = ehp.effectiveHP;
  let monsterHP = monster.hp;
  let turn = 0;
  const log = [];

  // v1.3 · 飘字时间线：每 0.3s 一击，最多 12 条（避免太长）
  // 玩家→怪物 ticks（标记 crit，使用 build.crit 概率）
  const critRate = Game.clamp((build.mods.crit || 0) / 100, 0, 1);
  const monsterCritRate = Game.clamp((build.mods.crit_dmg || 50) / 100, 0, 5);
  const ticks = [];
  // 旧版代码在 win 变量定义前引用 win（潜在 bug）；现在缓存命中短路不执行这里
  let win;
  let totalSec;
  let duration;
  let tickCount;
  let interval;
  // 先用临时 win 计算 duration（playerDPS * tick > monster.hp 表示一击必杀 → duration≈1s）
  {
    const tmpDps = monster.boss ? player.dps * 0.7 : player.dps;
    const wouldKill = tmpDps >= monster.hp;
    totalSec = wouldKill ? 1 : Math.max(2, Math.min(8, monster.hp / tmpDps));
    duration = totalSec;
    tickCount = 8;
    interval = duration / tickCount;
    win = wouldKill;
  }
  const playerDmgPerTick = playerDPS * interval;
  // 第一击若怪物低于 playerDPS → 一次性结算
  const winByOneHit = playerDmgPerTick >= monster.hp;
  if (winByOneHit) {
    // 一击必杀 — 一条大伤害飘字 + 暴击概率走 5%
    const isCrit = _r() < 0.5; // 一击必杀有 50% 是暴击
    ticks.push({ atSec: 0, who: 'player', side: 'monster', amount: Math.round(monster.hp * (isCrit ? 1.8 + monsterCritRate : 1)), isCrit, kind: 'dmg' });
  } else {
    // 多 hit
    let mhp = monster.hp;
    let firstHit = true;
    for (let i = 0; i < tickCount && mhp > 0; i++) {
      mhp -= playerDmgPerTick;
      const isCrit = _r() < critRate;
      const dmg = Math.round(playerDmgPerTick * (isCrit ? 1 + monsterCritRate : 1));
      const at = i * interval;
      ticks.push({ atSec: at, who: 'player', side: 'monster', amount: Math.max(0, dmg), isCrit, kind: 'dmg' });
      if (firstHit) firstHit = false;
    }
  }
  // 击杀事件 — 若 win，ticks 末尾加一条 KILL 标记
  if (win) ticks.push({ atSec: duration, who: 'event', side: 'monster', amount: 0, isCrit: false, kind: 'kill' });
  // 怪物对玩家：每 tick 一次伤害（无 crit 系统但加伤害飘字）
  let php = ehp.effectiveHP;
  let playerFirstTick = 1;
  if (!win) {
    // 玩家会死亡 — 模拟死亡 tick
    for (let i = 0; i < tickCount && php > 0; i++) {
      php -= playerIncomingDPS * interval;
      const dmg = Math.max(0, Math.round(playerIncomingDPS * interval));
      // 模拟怪物暴击（怪物 crit 字段简化为固定 5%）
      const isCrit = _r() < 0.05;
      ticks.push({ atSec: i * interval, who: 'monster', side: 'player', amount: dmg * (isCrit ? 1.5 : 1), isCrit, kind: 'dmg' });
    }
    ticks.push({ atSec: duration, who: 'event', side: 'player', amount: 0, isCrit: false, kind: 'die' });
  } else {
    // 玩家赢：怪物攻击 ticks 较少（被玩家打断）
    const incomingTicks = Math.max(2, Math.min(6, Math.floor(tickCount * 0.6)));
    for (let i = 0; i < incomingTicks; i++) {
      const dmg = Math.max(0, Math.round(playerIncomingDPS * interval));
      const isCrit = _r() < 0.05;
      ticks.push({ atSec: i * interval, who: 'monster', side: 'player', amount: dmg * (isCrit ? 1.5 : 1), isCrit, kind: 'dmg' });
    }
  }

  while (turn < rounds && playerHP > 0 && monsterHP > 0) {
    monsterHP -= playerDPS;
    if (monsterHP <= 0) break;
    playerHP -= playerIncomingDPS;
    if (turn < 5 || turn % 20 === 0) {
      log.push(`回合 ${turn + 1}: 怪物HP ${Math.max(0, Math.round(monsterHP))} | 你的EHP ${Math.max(0, Math.round(playerHP))}`);
    }
    turn++;
  }

  win = monsterHP <= 0;
  const timeToKill = win ? (monster.hp / playerDPS).toFixed(1) : (rounds).toFixed(1);
  const survivalTime = win ? '∞' : ((ehp.effectiveHP / playerIncomingDPS) || 0).toFixed(1);

  const result = {
    win,
    dps: Math.round(playerDPS),
    incomingDPS: Math.round(playerIncomingDPS),
    effectiveHP: Math.round(ehp.effectiveHP),
    monsterHP: monster.hp,
    timeToKill,
    survivalTime,
    log,
    ticks,
    duration,
    score: win ? Math.round(playerDPS * 10 + ehp.effectiveHP) : 0
  };

  // v1.4 第 2 项 · 写入战斗缓存
  if (cacheKey) Game.BUILD_CACHE.battles.set(cacheKey, result);
  return result;
};

// ==================== 玩家状态 ====================
Game.createPlayer = function (classId) {
  const cls = DATA.classes[classId];
  return {
    classId,
    name: '圣教军',
    level: 1,
    exp: 0,
    gold: 0,
    baseStats: { ...cls.base },
    skillId: cls.skills[0].id,
    equipped: {},
    inventory: [],
    kills: 0,
    mf: 0
  };
};

Game.levelUp = function (player) {
  if (player.exp >= player.level * 100) {
    player.exp -= player.level * 100;
    player.level++;
    for (const k in player.baseStats) {
      player.baseStats[k] += 2;
    }
    return true;
  }
  return false;
};


// ==================== 宝石物品创建 (v1.1) ====================
// 把 DATA.gems 中的宝石包装成背包物品
Game.createGemItem = function (gemId) {
  const g = DATA.gems[gemId];
  if (!g) return null;
  return {
    uid: Game.uid(),
    name: g.name,
    type: 'gem',
    gemId: gemId,
    slot: 'gem',
    rarity: 'magic', // 视觉上按魔法品质（蓝色边框）
    base: {},
    mods: { ...g.mod },
    affixes: [],
    ilvl: 1
  };
};

// 随机生成宝石（怪物掉落 / 升级奖励）
Game.dropRandomGem = function (playerLevel) {
  const ids = Object.keys(DATA.gems);
  const gemId = ids[Game.randint(0, ids.length - 1)];
  return Game.createGemItem(gemId);
};

// ==================== 附魔系统 (v1.1) ====================
// 把 DATA.enchantMaterials 中的材料包装成背包物品
Game.createMaterialItem = function (materialId) {
  const m = DATA.enchantMaterials && DATA.enchantMaterials[materialId];
  if (!m) return null;
  return {
    uid: Game.uid(),
    name: m.name,
    type: 'material',
    materialId: materialId,
    slot: 'material',
    rarity: 'magic',
    base: {},
    mods: {},
    affixes: [],
    ilvl: 1
  };
};

// 随机生成附魔材料（怪物掉落 / 升级奖励）
Game.dropRandomMaterial = function (playerLevel) {
  const ids = Object.keys(DATA.enchantMaterials);
  const mid = ids[Game.randint(0, ids.length - 1)];
  return Game.createMaterialItem(mid);
};

// 给物品附魔：消耗 1 个材料 + 金币，随机添加 1 条来自该材料词条池的词条
// 返回 { success, affix, name, mod, error } 或 { success: false, error }
Game.enchantItem = function (item, materialId) {
  if (!item || item.type === 'gem' || item.type === 'material') {
    return { success: false, error: '该物品不可附魔' };
  }
  const mat = DATA.enchantMaterials && DATA.enchantMaterials[materialId];
  if (!mat) return { success: false, error: '无效材料' };
  if (UI.player && UI.player.gold < DATA.ENCHANT_GOLD_COST) {
    return { success: false, error: '金币不足' };
  }
  // 词条池
  const pool = (DATA.enchantPools && DATA.enchantPools[mat.pool]) || [];
  if (pool.length === 0) return { success: false, error: '材料词条池为空' };

  // 加权随机选词条
  const affixTpl = Game.weightedPick(pool);
  const kind = affixTpl.name.startsWith('·') ? 'suffix' : 'prefix';

  // 扣除金币
  if (UI.player) UI.player.gold -= DATA.ENCHANT_GOLD_COST;

  // 应用词条：合并到 mods / affixes，按 ilvl × tier 多重缩放（v1.2 · T1~T6）
  const lvlScale = 1 + (item.ilvl - 1) * 0.04;
  const tierMult = (DATA.affixTiers && DATA.affixTiers[affixTpl.tier]) ? DATA.affixTiers[affixTpl.tier].multiplier : 1.0;
  const scaledMod = {};
  for (const k in affixTpl.mod) {
    if (typeof affixTpl.mod[k] === 'number' && k !== 'pierce' && k !== 'knockback' && k !== 'chain') {
      scaledMod[k] = Math.round(affixTpl.mod[k] * lvlScale * tierMult * 10) / 10;
    } else {
      scaledMod[k] = affixTpl.mod[k];
    }
  }
  // 合并
  if (!item.mods) item.mods = {};
  if (!item.affixes) item.affixes = [];
  for (const k in scaledMod) {
    item.mods[k] = (item.mods[k] || 0) + scaledMod[k];
  }
  item.affixes.push({ ...affixTpl, mod: scaledMod, kind, fromMaterial: materialId });

  // 名字拼接 — 前缀加在 base.name 前，后缀加在 base.name 后
  // 先尝试找到原始 base.name（不带任何词条前缀）
  // 简单策略：用 affixes 里的 kind 重算 — 但同名 affix 会被去重，需要基于 item.affixes 重建
  // 这里采用追加策略：新前缀加在最前面，后缀加在最后面
  // 注：传奇 / 套装保留原 name 不重算（避免破坏品牌识别）
  if (item.rarity !== 'unique' && item.rarity !== 'set') {
    if (kind === 'prefix') {
      item.name = affixTpl.name + item.name;
    } else {
      item.name = item.name + ' ' + affixTpl.name;
    }
  }

  return { success: true, affix: affixTpl, mod: scaledMod, kind, material: mat };
};

// ==================== 打造配方 (v1.2) ====================
// 区别于 ENCHANT（消耗材料加随机词条）
// 区别于 FORGE 50G（纯 RNG 随机）
// RECIPE = 消耗指定材料 + 金币 → 必定产出 slot + rarity + 词条范围的物品（材料决定大类，词条仍带轻微 RNG 起伏）
// 让"打怪掉的材料"成为可预期的装备成长路径

// 聚合背包中的材料数量 → { materialId: count }
Game.countMaterials = function (player) {
  const map = {};
  if (!player || !player.inventory) return map;
  for (const it of player.inventory) {
    if (it && it.type === 'material' && it.materialId) {
      map[it.materialId] = (map[it.materialId] || 0) + 1;
    }
  }
  return map;
};

// 检查玩家能否打造某配方：金币 ≥ 配方 gold && 等级 ≥ minLevel && 每种材料数量都够
Game.canCraftRecipe = function (recipeId, player) {
  const recipe = (DATA.craftRecipes || {})[recipeId];
  if (!recipe) return { ok: false, error: '未知配方' };
  if (player.level < (recipe.minLevel || 1)) {
    return { ok: false, error: `需要等级 ${recipe.minLevel}` };
  }
  if (player.gold < (recipe.gold || 0)) {
    return { ok: false, error: `需要 ${recipe.gold} 金币` };
  }
  const matMap = Game.countMaterials(player);
  for (const need of (recipe.needs || [])) {
    if ((matMap[need.materialId] || 0) < need.count) {
      const m = (DATA.enchantMaterials || {})[need.materialId];
      return { ok: false, error: `需要 ${m ? m.name : need.materialId} ×${need.count}` };
    }
  }
  return { ok: true, recipe };
};

// 从配方 modPool 词条池中，按 modPool 候选 key 选 N 条 affix，返回 [{name, kind, mod}]
Game._pickAffixesFromPool = function (poolKeys, count) {
  // 优先级：优先从 modPool 内的 prefixes/suffixes 中抽；modPool 不存在则从全局 prefixes/suffixes 中抽且过滤 mod key 在 poolKeys 中
  const prefixesAll = DATA.prefixes || [];
  const suffixesAll = DATA.suffixes || [];
  // 过滤出 mod 内 key 命中 poolKeys 的 affix 模板（至少 1 个匹配）
  const filter = (list) => list.filter(a => {
    if (!a.mod) return false;
    return Object.keys(a.mod).some(k => poolKeys.indexOf(k) >= 0);
  });
  const prefixPool = filter(prefixesAll);
  const suffixPool = filter(suffixesAll);
  // fallback：poolKeys 中全部没匹配上时，回退到全局 prefixes/suffixes
  const pfxSrc = prefixPool.length > 0 ? prefixPool : prefixesAll;
  const sfxSrc = suffixPool.length > 0 ? suffixPool : suffixesAll;

  const out = [];
  if (count >= 1 && pfxSrc.length > 0) {
    out.push({ ...Game.weightedPick(pfxSrc), kind: 'prefix' });
  }
  if (count >= 2) {
    // 第 2 条起可以是 suffix，剩余的继续抽 prefix（避免重复同一 kind）
    for (let i = 1; i < count; i++) {
      const useSuffix = (i % 2 === 1) && sfxSrc.length > 0;
      const src = useSuffix ? sfxSrc : pfxSrc;
      if (src.length === 0) break;
      out.push({ ...Game.weightedPick(src), kind: useSuffix ? 'suffix' : 'prefix' });
    }
  }
  return out;
};

// 用配方铸造装备：消耗材料 + 金币 → 在 inventory 添加新装备
// 返回 { ok: true, item } 或 { ok: false, error }
Game.craftByRecipe = function (recipeId, player) {
  const check = Game.canCraftRecipe(recipeId, player);
  if (!check.ok) return check;

  const recipe = check.recipe;

  // 选定 slot（random → 随机非双戒指）
  const slot = recipe.slot === 'random'
    ? DATA.slots[Game.randint(0, DATA.slots.length - 1)]
    : recipe.slot;

  // 选 base item：来自 baseItems[slot]，按等级筛
  const basePool = DATA.baseItems[slot] || [];
  if (basePool.length === 0) return { ok: false, error: '无基础装备' };
  const validBases = basePool.filter(b => b.level <= Math.max(player.level, recipe.minLevel) + 5);
  const base = validBases.length > 0
    ? Game.weightedPick(validBases.map(b => ({ ...b, weight: 1 })))
    : basePool[0];

  // 词条：affixCount 优先取配方预设，否则按 rarity 默认
  const affixCount = recipe.affixCount != null
    ? recipe.affixCount
    : (DATA.rarities[recipe.rarity] || {}).affix_count || 2;
  const affixes = Game._pickAffixesFromPool(recipe.modPool || [], affixCount);

  // 合并 mods（v1.2 · T1~T6 tier 多重缩放）
  const mergedMods = {};
  for (const a of affixes) {
    const tierMult = (DATA.affixTiers && DATA.affixTiers[a.tier]) ? DATA.affixTiers[a.tier].multiplier : 1.0;
    for (const k in a.mod) {
      let v = a.mod[k];
      if (typeof v === 'number' && k !== 'pierce' && k !== 'knockback' && k !== 'chain') {
        const lvlScale = 1 + (Math.max(player.level, recipe.minLevel) - base.level) * 0.05;
        v = v * lvlScale * tierMult;
        v = Math.round(v * 10) / 10;
      }
      mergedMods[k] = (mergedMods[k] || 0) + v;
    }
  }

  // 名称组装
  const pfx = affixes.find(a => a.kind === 'prefix');
  const sfx = affixes.find(a => a.kind === 'suffix');
  let name = base.name;
  if (pfx) name = pfx.name + name;
  if (sfx) name = name + ' ' + sfx.name;

  // 构造物品
  const item = {
    uid: Game.uid(),
    name,
    type: 'equip',
    slot,
    rarity: recipe.rarity,
    base: { ...base.base },
    mods: mergedMods,
    affixes: affixes.map(a => ({ ...a, mod: { ...a.mod } })),
    ilvl: Math.max(player.level, recipe.minLevel),
    socketCount: Game.calcSockets(slot, recipe.rarity),
    gems: [],
    type: 'generated',
    fromRecipe: recipe.id
  };

  // 扣除金币
  player.gold -= recipe.gold;

  // 扣除材料：从背包中删去每种需要材料 ×count
  for (const need of recipe.needs) {
    let remaining = need.count;
    for (let i = player.inventory.length - 1; i >= 0 && remaining > 0; i--) {
      const it = player.inventory[i];
      if (it && it.type === 'material' && it.materialId === need.materialId) {
        player.inventory.splice(i, 1);
        remaining--;
      }
    }
  }

  // push 到背包
  player.inventory.push(item);

  return { ok: true, item, recipe };
};

// ==================== Build 推荐器 (v1.1) ====================
// 按职业 + 等级 + 玩法流派（dps/tank/balanced）算法推荐一套装备
// 算法：对每个槽位，从 legendaries → set pieces → base pool 中按 score 选取最佳
// score = Σ( mod[k] × weight[k] ) + base_score(slot, item)
//
// 流派定义：每个 mod 的权重，数值越大越偏重该属性
Game.BUILD_ARCHETYPES = {
  dps: {
    id: 'dps',
    name: '⚔ DPS 极限',
    desc: '最大化伤害输出。暴击 / 攻击速度 / 元素 / 穿透优先，生存次要。',
    color: '#ff5252',
    // 属性权重（数值=推荐评分时每点属性的贡献）
    weights: {
      // 攻击
      dmg_pct: 3, elem_pct: 3, fire_pct: 3, cold_pct: 3, light_pct: 3, holy_pct: 3,
      crit: 2.5, crit_dmg: 2, atk_speed: 2, pierce: 4, chain: 4,
      burn: 1.5, poison: 1.5,
      // 召唤
      summon_atk: 1.5, summon_count: 1,
      // 主属性（仅算 str/int 高权，因为直接影响伤害倍率）
      str: 0.5, int: 0.5, dex: 0.2,
      // 资源
      mana: 0.3, mana_regen: 0.2,
      // 防御（少量保留，保证能站稳）
      ac: 0.1, life: 0.1, vit: 0.1, all_res: 0.3, block: 0.2,
      shield: 0.1, dodge: 0.3,
      hp_regen: 0.2,
      // 杂项
      mf: 0.2, gold: 0.1, life_steal: 0.8, knockback: 0.3, slow: 0.2,
      fth: 0.2, curse: 0.5, dmg_aura: 1, def_aura: 0.2,
      movespeed: 0.1, on_hit_mana: 0.2, on_kill_life: 0.3,
      holy: 0.8
    },
    baseScore: { helm: 1, armor: 1, weapon: 2, offhand: 0.5, gloves: 0.5, boots: 0.3, belt: 0.2, amulet: 1, ring1: 0.8, ring2: 0.8 }
  },
  tank: {
    id: 'tank',
    name: '🛡 钢铁堡垒',
    desc: '最大化生存。护甲 / 生命 / 全抗 / 闪避 / 护盾优先。',
    color: '#4fc3f7',
    weights: {
      // 防御优先
      ac: 2.5, life: 2, vit: 1.5, all_res: 2.5, block: 2, dodge: 2, shield: 2,
      hp_regen: 1.5, def_aura: 1.5,
      // 闪避 / 移速（机动生存）
      movespeed: 0.5,
      // 基础属性
      str: 0.3, int: 0.2, dex: 0.3, fth: 0.3,
      // 攻击（少量保留，保证能磨死怪）
      dmg_pct: 0.4, elem_pct: 0.4, crit: 0.3, life_steal: 1,
      // 资源
      mana: 0.3, mana_regen: 0.4,
      // 杂项
      mf: 0.1, gold: 0.1, knockback: 0.8, slow: 0.5,
      pierce: 0.2, chain: 0.2, burn: 0.3, poison: 0.3,
      summon_atk: 0.5, summon_count: 0.3, curse: 0.2, dmg_aura: 0.3,
      on_hit_mana: 0.3, on_kill_life: 0.5, holy: 0.3,
      fire_pct: 0.2, cold_pct: 0.2, light_pct: 0.2, holy_pct: 0.2,
      crit_dmg: 0.3, atk_speed: 0.2
    },
    baseScore: { helm: 1.5, armor: 2.5, weapon: 0.5, offhand: 1.5, gloves: 0.8, boots: 0.8, belt: 0.8, amulet: 1, ring1: 1, ring2: 1 }
  },
  balanced: {
    id: 'balanced',
    name: '⚖ 平衡之道',
    desc: '攻防兼顾。伤害与生存均衡发展。',
    color: '#ffb74d',
    weights: {
      // 攻击
      dmg_pct: 1.5, elem_pct: 1.5, fire_pct: 1.5, cold_pct: 1.5, light_pct: 1.5, holy_pct: 1.5,
      crit: 1, crit_dmg: 1, atk_speed: 1, pierce: 1.5, chain: 1.5,
      burn: 0.8, poison: 0.8, life_steal: 0.8, summon_atk: 0.8, summon_count: 0.5,
      // 防御
      ac: 1, life: 1, vit: 0.8, all_res: 1.2, block: 1, dodge: 1, shield: 1,
      hp_regen: 0.8, def_aura: 0.8,
      // 基础属性
      str: 0.4, int: 0.4, dex: 0.3, fth: 0.3,
      // 资源
      mana: 0.5, mana_regen: 0.4,
      // 杂项
      mf: 0.3, gold: 0.2, knockback: 0.4, slow: 0.3,
      curse: 0.5, dmg_aura: 0.6, movespeed: 0.3,
      on_hit_mana: 0.3, on_kill_life: 0.4, holy: 0.5
    },
    baseScore: { helm: 1, armor: 1.2, weapon: 1.2, offhand: 0.8, gloves: 0.6, boots: 0.5, belt: 0.4, amulet: 1, ring1: 0.9, ring2: 0.9 }
  }
};

// 给一个物品打分（按 archetype 权重）
Game.scoreItem = function (item, archetype) {
  if (!item) return -Infinity;
  const w = archetype.weights;
  let score = 0;
  // base 字段也计分
  const base = item.base || {};
  if (typeof base.ac === 'number') score += base.ac * (w.ac * 0.3);
  if (typeof base.dmg_min === 'number' && typeof base.dmg_max === 'number') {
    score += ((base.dmg_min + base.dmg_max) / 2) * (w.dmg_pct * 0.2 + w.str * 0.3);
  }
  if (typeof base.elem === 'number') score += base.elem * (w.elem_pct * 0.2);
  // mods
  const mods = item.mods || {};
  for (const k in mods) {
    const v = mods[k];
    if (typeof v !== 'number') continue;
    const weight = w[k] !== undefined ? w[k] : 0;
    score += v * weight;
  }
  // 基础项加成（武器/胸甲略加权）
  score += (archetype.baseScore && archetype.baseScore[item.slot] || 0) * 10;
  return score;
};

// 对一个槽位生成"最优"物品 — 候选集：legendary → set piece → rare with optimized affixes
Game.generateOptimalItem = function (slot, classId, level, archetype) {
  const candidates = [];

  // 1) 传奇（class-specific + shared）— 槽位匹配的加入候选
  const classLegs = DATA.legendaries[classId] || [];
  const sharedLegs = DATA.legendaries.shared || [];
  for (const tmpl of [...classLegs, ...sharedLegs]) {
    if (tmpl.slot !== slot) continue;
    const item = Game.makeUnique(tmpl, level);
    candidates.push(item);
  }

  // 2) 套装件 — 槽位匹配的加入候选
  const classSets = DATA.sets.filter(s => s.forClass === 'all' || s.forClass === classId);
  for (const set of classSets) {
    const piece = set.pieces.find(p => p.slot === slot);
    if (!piece) continue;
    const item = Game.makeSetItem(set, piece, level);
    candidates.push(item);
  }

  // 3) Rare 装备 — 多次采样 affix 组合，挑最优
  const basePool = DATA.baseItems[slot] || [];
  const validBases = basePool.filter(b => b.level <= level + 5);
  if (validBases.length > 0) {
    // 选等级最接近的 base（不一定最高，更接近能保证 affix 不溢出）
    validBases.sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level));
    const base = validBases[0];
    // 采样 5 次 affix 组合
    for (let attempt = 0; attempt < 5; attempt++) {
      const it = Game.makeRarityItem(base, slot, 'rare', level);
      if (it) candidates.push(it);
    }
  }

  if (candidates.length === 0) return null;

  // 4) 按 score 排序，取最高
  candidates.sort((a, b) => Game.scoreItem(b, archetype) - Game.scoreItem(a, archetype));
  return candidates[0];
};

// 推荐一整套 build
Game.recommendBuild = function (classId, level, archetypeId) {
  level = Math.max(1, Math.min(80, level || UI?.player?.level || 1));
  const archetype = Game.BUILD_ARCHETYPES[archetypeId] || Game.BUILD_ARCHETYPES.balanced;
  const items = {};
  for (const slot of DATA.slots) {
    const it = Game.generateOptimalItem(slot, classId, level, archetype);
    if (it) items[slot] = it;
  }
  // 模拟玩家用这套装备
  const simPlayer = {
    classId,
    level,
    baseStats: { ...DATA.classes[classId].base },
    skillId: DATA.classes[classId].skills[0].id,
    equipped: items,
    inventory: []
  };
  const build = Game.aggregateBuild(simPlayer);
  const dpsResult = Game.calcDPS(build);
  const ehpResult = Game.calcEffectiveHP(build);
  return {
    classId,
    level,
    archetype: archetype.id,
    archetypeName: archetype.name,
    archetypeDesc: archetype.desc,
    archetypeColor: archetype.color,
    items,
    summary: {
      dps: Math.round(dpsResult.dps),
      physDps: Math.round(dpsResult.physDmg * dpsResult.atkPerSec * (1 + (dpsResult.critDmg || 0)) + (dpsResult.summonDmg || 0) * dpsResult.atkPerSec),
      ehp: Math.round(ehpResult.effectiveHP),
      hp: Math.round(ehpResult.hp),
      ac: Math.round(ehpResult.ac),
      dr: (ehpResult.dr * 100).toFixed(1),
      life: Math.round(build.mods.life || 0),
      mana: Math.round(build.mods.mana || 0)
    }
  };
};

// ==================== 存档 ====================
Game.save = function (player) {
  try {
    localStorage.setItem('diablo_build_save', JSON.stringify(player));
  } catch (e) { console.error('save fail', e); }
};

Game.load = function () {
  try {
    const raw = localStorage.getItem('diablo_build_save');
    if (!raw) return null;
    const player = JSON.parse(raw);
    // v1.1 · 迁移老存档：给所有物品补 socketCount + gems
    const fixItem = (it) => {
      if (!it || it.type === 'gem') return;
      if (typeof it.socketCount !== 'number') {
        // 老物品：按 30% 概率补 1 孔
        it.socketCount = Math.random() < 0.3 ? 1 : 0;
      }
      if (!Array.isArray(it.gems)) {
        it.gems = new Array(it.socketCount).fill(null);
      }
    };
    if (player.equipped) {
      for (const s in player.equipped) fixItem(player.equipped[s]);
    }
    if (player.inventory) {
      player.inventory.forEach(fixItem);
    }
    return player;
  } catch (e) { return null; }
};

Game.reset = function () {
  localStorage.removeItem('diablo_build_save');
};

// ==================== v1.1 · Build 导出/导入 ====================
// 导出只保留 build 关键信息（职业/技能/装备/宝石/附魔词条），不含 inventory/gold/exp 等临时数据
Game.exportBuild = function (player) {
  if (!player) return null;
  // 装备只保留 slot/uid/name/rarity/type/mods/socketCount/gems（去除 uid 等无关字段，体积更小）
  const slimItem = (it) => {
    if (!it) return null;
    return {
      s: it.slot,                       // slot
      n: it.name,                       // name
      r: it.rarity,                     // rarity
      t: it.type || 'generated',        // type
      i: it.ilvl || 0,                  // ilvl
      sk: it.setKey || null,            // set key
      // v1.5 #3 修补 · 同步 base 字段（即便空也保留 key，未来扩展用；老快照无此字段 import 时走 s.b || {} 兜底）
      b: it.base || {},                 // base（词条之前的物品基础属性）
      m: it.mods || {},                 // mods（词条）
      g: (it.gems || []).map(g => g ? g.id : null),  // gems (只保留 id)
      sc: it.socketCount || 0,          // socketCount
    };
  };
  const equipped = {};
  if (player.equipped) {
    for (const slot in player.equipped) {
      const v = slimItem(player.equipped[slot]);
      if (v) equipped[slot] = v;
    }
  }
  return {
    v: 1,                              // version
    c: player.classId,                  // class
    sk: player.skillId,                // skill
    lv: player.level,                  // level
    e: equipped,                       // equipped (slim)
    bs: player.baseStats || {},        // baseStats
  };
};

Game.exportBuildString = function (player) {
  const obj = Game.exportBuild(player);
  if (!obj) return '';
  const json = JSON.stringify(obj);
  // base64 编码：避免特殊字符问题，也支持分享
  try {
    return btoa(unescape(encodeURIComponent(json)));
  } catch (e) {
    return json;
  }
};

// 生成一个 ~10 字符的短码（取 base64 前缀 + 校验位）
Game.exportBuildShortCode = function (player) {
  const full = Game.exportBuildString(player);
  if (!full) return '';
  // 取前 16 字符 + 末 4 字符，拼接成短码
  const head = full.slice(0, 16);
  const tail = full.slice(-4);
  return 'DB:' + head + '...' + tail;
};

Game.importBuild = function (input) {
  if (!input) return null;
  let json = input.trim();
  // 尝试 base64 解码
  if (json.startsWith('DB:')) {
    // 短码不是完整数据，不能导入
    return { error: 'SHORT_CODE_NOT_IMPORTABLE' };
  }
  try {
    json = decodeURIComponent(escape(atob(json)));
  } catch (e) {
    // 不是 base64，按原始 JSON 处理
  }
  let obj;
  try {
    obj = JSON.parse(json);
  } catch (e) {
    return { error: 'INVALID_JSON' };
  }
  if (!obj || obj.v !== 1) return { error: 'BAD_VERSION' };
  if (!obj.c || !DATA.classes[obj.c]) return { error: 'BAD_CLASS' };
  // 校验：至少要有 equipped 字段
  if (typeof obj.e !== 'object') return { error: 'NO_EQUIP' };
  // 反序列化 slimItem → 完整物品
  const unslimItem = (s) => {
    if (!s) return null;
    return {
      slot: s.s,
      name: s.n,
      rarity: s.r,
      type: s.t,
      ilvl: s.i,
      setKey: s.sk,
      // v1.5 #3 必修 · v1.5 #1 引入的潜在 bug：原 unslimItem 没有还原 base 字段，
      // 导致从快照/导出还原的物品在 aggregateBuild/calcAC/calcDamage 里访问 item.base.xxx 时崩溃。
      // 修复：补上 base: {}（就算只用来防御性兜底也能跑通路径）
      base: s.b || {},
      mods: s.m || {},
      gems: (s.g || []).map(gid => {
        if (!gid) return null;
        return Game.createGemItem(gid);
      }).filter(Boolean),
      socketCount: s.sc || 0,
      uid: 'imp_' + Math.random().toString(36).slice(2, 10),
    };
  };
  const equipped = {};
  for (const slot in obj.e) {
    const it = unslimItem(obj.e[slot]);
    if (it) equipped[slot] = it;
  }
  // 应用到 player 模板
  const newPlayer = Game.createPlayer(obj.c);
  newPlayer.level = obj.lv || 1;
  newPlayer.skillId = obj.sk || DATA.classes[obj.c].skills[0].id;
  newPlayer.baseStats = obj.bs || newPlayer.baseStats;
  newPlayer.equipped = equipped;
  // 派生 stats
  newPlayer.life = 50 + (newPlayer.baseStats.vit || 0) * 5;
  newPlayer.mana = 30 + (newPlayer.baseStats.int || 0) * 3;
  return newPlayer;
};

// ==================== v1.1 · Build 历史快照 ====================
// 自动保存最近 N 套 build，可一键回滚
// 存储位置：localStorage 'diablo_build_snapshots'
// 每条快照：{ id, ts, label, player (slim) }
Game.SNAPSHOT_MAX = 10;
Game.SNAPSHOT_KEY = 'diablo_build_snapshots';

// 从 localStorage 读取所有快照（按 ts 倒序）
Game.loadSnapshots = function () {
  try {
    const raw = localStorage.getItem(Game.SNAPSHOT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr;
  } catch (e) {
    return [];
  }
};

// 写回 localStorage
Game.saveSnapshots = function (snapshots) {
  try {
    localStorage.setItem(Game.SNAPSHOT_KEY, JSON.stringify(snapshots));
  } catch (e) {
    console.error('save snapshots fail', e);
  }
};

// 创建一条新快照（返回 player 的精简结构，与 exportBuild 类似但更小）
Game.snapshotPlayer = function (player, label) {
  if (!player) return null;
  // 用 exportBuild 序列化得到最精简的对象（v/c/sk/lv/e/bs）
  const slim = Game.exportBuild(player);
  if (!slim) return null;
  const cls = DATA.classes[player.classId];
  const autoLabel = label || (cls ? cls.name : player.classId) + ' Lv.' + (player.level || 1);
  return {
    id: 'snap_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    ts: Date.now(),
    label: autoLabel,
    classId: player.classId,
    level: player.level || 1,
    data: slim,
  };
};

// 添加一条快照（自动去重：相同 classId+level+装备指纹 视为重复，跳过）
Game.addSnapshot = function (player, label) {
  if (!player) return null;
  const snap = Game.snapshotPlayer(player, label);
  if (!snap) return null;
  const arr = Game.loadSnapshots();
  // 简单指纹：classId + level + 装备数量
  const fp = snap.classId + '|' + snap.level + '|' + Object.keys(snap.data.e || {}).length;
  const dup = arr.find(s => {
    const sfp = s.classId + '|' + s.level + '|' + Object.keys(s.data.e || {}).length;
    return sfp === fp;
  });
  if (dup) {
    // 同指纹视为重复 → 不新增，但更新时间戳和 label
    dup.ts = snap.ts;
    if (label) dup.label = label;
    Game.saveSnapshots(arr);
    return dup;
  }
  arr.unshift(snap); // 最新在前面
  // 保留最多 SNAPSHOT_MAX 条
  if (arr.length > Game.SNAPSHOT_MAX) {
    arr.length = Game.SNAPSHOT_MAX;
  }
  Game.saveSnapshots(arr);
  return snap;
};

// 删除一条快照（按 id）
Game.removeSnapshot = function (id) {
  const arr = Game.loadSnapshots();
  const idx = arr.findIndex(s => s.id === id);
  if (idx >= 0) {
    arr.splice(idx, 1);
    Game.saveSnapshots(arr);
    return true;
  }
  return false;
};

// 重命名一条快照
Game.renameSnapshot = function (id, newLabel) {
  if (!newLabel || !newLabel.trim()) return false;
  const arr = Game.loadSnapshots();
  const s = arr.find(x => x.id === id);
  if (s) {
    s.label = newLabel.trim().slice(0, 32);
    Game.saveSnapshots(arr);
    return true;
  }
  return false;
};

// 清空所有快照
Game.clearSnapshots = function () {
  Game.saveSnapshots([]);
};

// 把快照还原为完整 player（复用 importBuild 逻辑 → unslimItem → createPlayer 模板）
Game.restoreSnapshot = function (id) {
  const arr = Game.loadSnapshots();
  const s = arr.find(x => x.id === id);
  if (!s) return null;
  // 走 importBuild 路径（用 JSON 重新构造完整 player）
  const obj = s.data;
  const json = JSON.stringify(obj);
  return Game.importBuild(json);
};

// 触发点：装备变化时自动保存快照（UI 在穿戴/卸下/导入/应用推荐后调用）
Game.maybeSnapshot = function (player, opts = {}) {
  if (!player) return null;
  // 节流：10 秒内相同指纹不重复保存
  const fp = (player.classId || '') + '|' + (player.level || 0) + '|' + Object.keys(player.equipped || {}).length;
  const now = Date.now();
  const last = Game._lastSnapshotFP || { fp: '', ts: 0 };
  if (last.fp === fp && now - last.ts < 10000 && !opts.force) {
    return null;
  }
  Game._lastSnapshotFP = { fp, ts: now };
  return Game.addSnapshot(player, opts.label);
};

// ==================== 战斗模拟预计算缓存 (v1.4 第 2 项) ====================
// 按 build signature + monster idx 缓存 simulateBattle 结果
// 失效时机：装备/技能/等级/baseStats 变化（UI.renderAll 前调用 invalidateBuildCache）
//
// 飘字用 mulberry32(seed) 替代 Math.random() — 同一战斗保证确定性，可安全缓存
Game.BUILD_CACHE = {
  builds: new Map(),      // signature -> { mods, setCounts }
  battles: new Map()      // signature+'|'+monIdx -> result
};
Game.BUILD_CACHE_STATS = { hits: 0, miss: 0, invalidations: 0 };

// Mulberry32 — 32 位种子伪随机数生成器（确定性、快、可种子化）
Game._seededRandom = function (seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// 计算 player 的 build signature（短字符串 hash）
Game._buildSignature = function (player) {
  if (!player) return '';
  const parts = [];
  // 等级 + 职业 + 技能
  parts.push('l' + (player.level || 1));
  parts.push('c' + (player.classId || ''));
  parts.push('s' + (player.skillId || ''));
  // baseStats（str/dex/int/vit/fth）
  const bs = player.baseStats || {};
  parts.push('b' + (bs.str|0) + ',' + (bs.dex|0) + ',' + (bs.int|0) + ',' + (bs.vit|0) + ',' + (bs.fth|0));
  // 装备槽位（按 slot 顺序）— uid + mods + ilvl + setId + slot sigs + gems
  for (const slot of (window.DATA && DATA.slots ? DATA.slots : [])) {
    const item = player.equipped && player.equipped[slot];
    if (!item) { parts.push(slot + ':_'); continue; }
    parts.push(slot + ':' + (item.uid || '') + ',' + (item.ilvl || 0) + ',' + (item.setId || '') + ',' + (item.rarity || ''));
    // 词条签名（按 key 排序的 mod 值）
    const mkeys = Object.keys(item.mods || {}).sort();
    parts.push(mkeys.map(k => k + '=' + item.mods[k]).join(';'));
    // 宝石签名
    if (item.gems && item.gems.length) {
      parts.push('g:' + item.gems.map(g => (g && g.gemId) || '_').join(','));
    }
  }
  // FNV-1a 32-bit hash
  const str = parts.join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
};

// 失效 build 缓存（装备/技能/等级变化时调用）
Game.invalidateBuildCache = function (reason) {
  Game.BUILD_CACHE.builds.clear();
  Game.BUILD_CACHE.battles.clear();
  Game.BUILD_CACHE_STATS.invalidations++;
};

// 获取缓存的 aggregateBuild 结果（命中则直接返回，未命中计算并写入）
Game._aggregateBuildCached = function (player) {
  const sig = Game._buildSignature(player);
  if (sig && Game.BUILD_CACHE.builds.has(sig)) {
    Game.BUILD_CACHE_STATS.hits++;
    return { ...Game.BUILD_CACHE.builds.get(sig), _sig: sig, _cached: true };
  }
  Game.BUILD_CACHE_STATS.miss++;
  const result = Game.aggregateBuild(player);
  if (sig) Game.BUILD_CACHE.builds.set(sig, result);
  return { ...result, _sig: sig, _cached: false };
};

// ============================================================
// v1.5 第 1 项 · 跨快照对比 (compareBuilds)
// 比较两条 Snapshot 对象，返回逐项差异 + DPS/EHP/AC 总分对比
//
// 输入：snap = { id, ts, label, classId, level, data: <exportBuild 风格的精简对象> }
// 输出：{
//   a, b,                              // input refs
//   buildA, buildB,                    // 还原后的完整 player 对象（用于装备回滚）
//   rows: [{ key, label, a, b, diff, better }],   // 属性表
//   totals: { dpsA, dpsB, ehpA, ehpB, acA, acB }   // 总分
// }
// ============================================================
Game.compareBuilds = function (snapA, snapB) {
  if (!snapA || !snapB || !snapA.data || !snapB.data) return null;
  // 1. 把两条快照各自反序列化为完整 player（沿用 importBuild 路径）
  //    importBuild 可能返回错误对象 {error:'...'}；用 .error 字段判断
  const buildA = Game.importBuild(JSON.stringify(snapA.data));
  const buildB = Game.importBuild(JSON.stringify(snapB.data));
  if (!buildA || !buildB || buildA.error || buildB.error) return null;
  if (!buildA.equipped || !buildB.equipped) return null;
  // 2. 各自聚合构建（set bonus / equip mods / gems / skill mod 全部加总）
  const aMods = Game.aggregateBuild(buildA);
  const bMods = Game.aggregateBuild(buildB);
  // 3. DPS / EHP / AC 对比
  const aDPS = Game.calcDPS(aMods);
  const aEHP = Game.calcEffectiveHP(aMods);
  const bDPS = Game.calcDPS(bMods);
  const bEHP = Game.calcEffectiveHP(bMods);
  // 4. 属性行（聚合 mods 的每个 stat key，含 0）
  const aFlat = aMods.mods || {};
  const bFlat = bMods.mods || {};
  const keys = new Set([...Object.keys(aFlat), ...Object.keys(bFlat)]);
  // 排序：先攻击属性 → 防御 → 资源 → 其他
  const order = [
    'dmg_min', 'dmg_max', 'dmg_pct', 'elem_pct', 'crit', 'crit_dmg', 'atk_speed',
    'ac', 'life', 'mana', 'all_res', 'block', 'dodge', 'shield', 'hp_regen', 'mana_regen', 'life_steal',
    'str', 'dex', 'int', 'vit', 'fth',
    'gold', 'mf'
  ];
  const rows = [];
  for (const k of order) {
    if (!keys.has(k)) continue;
    const a = aFlat[k] || 0;
    const b = bFlat[k] || 0;
    if (a === 0 && b === 0) continue;
    const diff = b - a;
    rows.push({
      key: k,
      label: Game.statDisplayKey(k),
      a, b,
      diff: Math.abs(diff),
      better: diff > 0 ? 'b' : (diff < 0 ? 'a' : 'same')
    });
  }
  // 兜底：未在 order 列表里的 stat（如 on_hit_mana 等未来扩展）
  for (const k of keys) {
    if (order.includes(k)) continue;
    const a = aFlat[k] || 0;
    const b = bFlat[k] || 0;
    if (a === 0 && b === 0) continue;
    const diff = b - a;
    rows.push({
      key: k,
      label: Game.statDisplayKey(k),
      a, b,
      diff: Math.abs(diff),
      better: diff > 0 ? 'b' : (diff < 0 ? 'a' : 'same')
    });
  }
  // v1.5 第 3 项 · 跨职业对比标记
  // 当两条快照属于不同 classId 时返回 { crossClass: true, classA, classB }，
  // 让 UI 弹对比 modal 时显示 "CROSS-CLASS COMPARISON" 横幅 + 警告玩家
  // DPS/EHP/AC 跨职业不可比（技能乘数 / 基础属性 完全不同）。
  const classA = snapA.classId || (buildA && buildA.classId) || null;
  const classB = snapB.classId || (buildB && buildB.classId) || null;
  const crossClass = !!(classA && classB && classA !== classB);
  return {
    a: snapA,
    b: snapB,
    buildA,
    buildB,
    rows,
    crossClass,
    classA,
    classB,
    totals: {
      dpsA: Math.round(aDPS.dps),
      dpsB: Math.round(bDPS.dps),
      ehpA: Math.round(aEHP.effectiveHP),
      ehpB: Math.round(bEHP.effectiveHP),
      acA: Math.round(aFlat.ac || 0),
      acB: Math.round(bFlat.ac || 0)
    }
  };
};

// 切换单条快照的 pinned 状态（v1.6 第 1 项 · 快照收藏夹）
// 返回切换后的 pinned 值（true/false），找不到快照返回 null
Game.togglePinSnapshot = function (id) {
  if (!id) return null;
  const arr = Game.loadSnapshots();
  const s = arr.find(x => x.id === id);
  if (!s) return null;
  s.pinned = !s.pinned;
  Game.saveSnapshots(arr);
  return s.pinned === true;
};

// v1.6 第 2 项 · 给快照存一段自由备注（最长 120 字符，trim/sanitize）
// 返回写入的最终 memo 字符串（成功）／null（未找到）
Game.setSnapshotMemo = function (id, memo) {
  if (!id) return null;
  const arr = Game.loadSnapshots();
  const s = arr.find(x => x.id === id);
  if (!s) return null;
  // sanitize: trim + 限长 + 过滤控制字符
  let clean = (memo == null ? '' : String(memo)).trim().slice(0, 120);
  clean = clean.replace(/[\x00-\x1F\x7F]/g, ''); // strip control chars
  s.memo = clean;
  Game.saveSnapshots(arr);
  return clean;
};

// v1.6 第 2 项 · 清空快照备注（同 setSnapshotMemo(id, '')）
Game.clearSnapshotMemo = function (id) {
  return Game.setSnapshotMemo(id, '');
};

if (typeof window !== 'undefined') window.Game = Game;
