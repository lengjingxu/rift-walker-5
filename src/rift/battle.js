// ==================== 裂隙行者 5% · 开放 tick 战斗模块 (T1.5) ====================
// 开放式 tick 战斗：无 200 轮硬上限，每 tick 0.3s，全程飘字时间线
// 适配 RiftState.simulateRiftBattle API（向后兼容）
// ES2020 · 无外部依赖 · vanilla JS

const RiftBattle = {};

// ==================== simulateBattle ====================
// 开放 tick 战斗引擎：模拟直到一方死亡或达到安全上限
// 返回结构兼容 Game.simulateBattle（额外含 ticks / tickCount / duration / _engine）
RiftBattle.simulateBattle = function (build, monster, opts = {}) {
  const maxTicks = opts.maxTicks || 500;   // 安全上限（防止无限循环）
  const tickInterval = 0.3;                // 0.3s per tick — v1.3 飘字节奏

  // 解析 build（支持 { _sig } 缓存键 — 不实现缓存，RiftState 已有上游缓存）
  if (!build || !build._sig) {
    if (build && build.equipped) {
      build = Game._aggregateBuildCached(build);
    } else {
      build = build || { mods: {} };
    }
  }

  const player = Game.calcDPS(build);
  const ehp = Game.calcEffectiveHP(build);

  // 玩家对怪伤害
  const playerDPS = (monster.boss ? player.dps * 0.7 : player.dps);
  // 怪物对玩家伤害
  const monsterAS = 1.0;
  const monsterRawDPS = (monster.dmg || 10) * monsterAS;
  const playerDR = ehp.dr || 0;
  const playerRes = 1 - Game.clamp((build.mods.all_res || 0) / 100, -0.5, 0.75);
  // 怪物护甲减伤（对玩家出伤）
  const monsterAC = monster.ac || 0;
  const playerLevel = (build && build.level) || (build && build.mods && build.mods.level) || 30;
  const monsterArmorMit = Game.clamp(
    monsterAC / (monsterAC + 50 * Math.max(playerLevel, 1)),
    0, 0.75
  );
  const playerDmgPerTick = Math.max(1, playerDPS * tickInterval * (1 - monsterArmorMit));
  const monsterDmgPerTick = Math.max(1, monsterRawDPS * tickInterval * (1 - playerDR) * playerRes);

  // 暴击参数
  const critRate = Game.clamp((build.mods.crit || 0) / 100, 0, 1);
  const critDmgMult = 1 + Game.clamp((build.mods.crit_dmg || 50) / 100, 0, 5);
  const monsterCritRate = 0.05;   // 怪物 5% base 暴击
  const monsterCritDmgMult = 1.5;

  let playerHP = ehp.effectiveHP;
  let monsterHP = monster.hp || 1;
  let tick = 0;
  let win = null;             // null = 进行中
  const ticks = [];
  const log = [];

  // 开放循环：直到一方死亡 OR 安全上限
  while (playerHP > 0 && monsterHP > 0 && tick < maxTicks) {
    const at = tick * tickInterval;

    // 1. 玩家攻击（暴击掷骰）
    const playerCrit = Math.random() < critRate;
    let pDmg = Math.round(playerDmgPerTick * (playerCrit ? critDmgMult : 1));
    pDmg = Math.max(1, pDmg);
    monsterHP -= pDmg;
    ticks.push({
      atSec: +at.toFixed(2),
      who: 'player',
      side: 'monster',
      amount: pDmg,
      isCrit: playerCrit,
      kind: 'dmg',
      tick
    });
    if (monsterHP <= 0) { win = true; break; }

    // 2. 怪物攻击（暴击掷骰）
    const monsterCrit = Math.random() < monsterCritRate;
    let mDmg = Math.round(monsterDmgPerTick * (monsterCrit ? monsterCritDmgMult : 1));
    mDmg = Math.max(1, mDmg);
    playerHP -= mDmg;
    ticks.push({
      atSec: +((tick + 0.5) * tickInterval).toFixed(2),  // 玩家攻击后 0.15s
      who: 'monster',
      side: 'player',
      amount: mDmg,
      isCrit: monsterCrit,
      kind: 'dmg',
      tick
    });
    if (playerHP <= 0) { win = false; break; }

    // 稀疏日志（约每 2s 一条）
    if (tick % 7 === 0) {
      log.push('t=' + at.toFixed(1) + 's \u00b7 P' + Math.max(0, Math.round(playerHP)) +
               ' vs M' + Math.max(0, Math.round(monsterHP)));
    }

    tick++;
  }

  // 安全上限超时 → 按 %HP 判胜负
  if (win === null) {
    const playerPct = playerHP / ehp.effectiveHP;
    const monsterPct = monsterHP / (monster.hp || 1);
    win = playerPct >= monsterPct;   // 平局算玩家赢
    log.push('TIMEOUT@tick' + tick + ': playerPct=' + (playerPct * 100).toFixed(1) +
             '% monsterPct=' + (monsterPct * 100).toFixed(1) + '% \u2192 win=' + win);
  }

  // 终局事件
  ticks.push({
    atSec: +(tick * tickInterval).toFixed(2),
    who: 'event',
    side: win ? 'monster' : 'player',
    amount: 0,
    isCrit: false,
    kind: win ? 'kill' : 'die',
    tick
  });

  const duration = tick * tickInterval;
  const timeToKill = win ? duration.toFixed(2) : null;
  const survivalTime = win ? null : duration.toFixed(2);

  return {
    win,
    dps: Math.round(playerDPS),
    incomingDPS: Math.round(monsterRawDPS * (1 - playerDR) * playerRes),
    effectiveHP: Math.round(ehp.effectiveHP),
    monsterHP: monster.hp || 0,
    playerHpRemaining: Math.max(0, Math.round(playerHP)),
    monsterHpRemaining: Math.max(0, Math.round(monsterHP)),
    timeToKill,
    survivalTime,
    log,
    ticks,
    duration,
    tickCount: tick,
    score: win ? Math.round(playerDPS * 10 + ehp.effectiveHP) : 0,
    _engine: 'rift-battle-v1'
  };
};

// ==================== preview ====================
// 快速胜率估算（无 ticks，供 Climb.getContinueProbability 使用）
RiftBattle.preview = function (build, monster) {
  const result = RiftBattle.simulateBattle(build, monster, { maxTicks: 50 });
  if (result.timeToKill !== null && result.survivalTime === null) {
    // 玩家赢
    return 95;
  }
  if (result.timeToKill === null && result.survivalTime !== null) {
    // 玩家输
    return 5;
  }
  // 超时 — 看 %HP
  const playerPct = result.playerHpRemaining / result.effectiveHP;
  const monsterPct = result.monsterHpRemaining / result.monsterHP;
  return Math.round(Math.max(0, Math.min(100, playerPct / monsterPct * 50)));
};

// ==================== isAlive ====================
// 检查玩家存活（state.player.hp > 0）
RiftBattle.isAlive = function (state) {
  if (!state || !state.player) return false;
  return (state.player.hp || 0) > 0;
};

// ==================== Self-test (require.main === module) ====================
if (typeof require !== 'undefined' && require.main === module) {
  console.log('=== RiftBattle self-test ===');

  // stub Game + DATA
  globalThis.Game = {
    clamp: function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
    calcDPS: function (build) {
      var base = (build.mods && build.mods.dmg_pct) || 10;
      var atkSpeed = (build.mods && build.mods.atk_speed) || 1;
      return { dps: base * atkSpeed };
    },
    calcEffectiveHP: function (build) {
      var vit = (build.mods && build.mods.vit) || 0;
      var life = (build.mods && build.mods.life) || 0;
      var ac = (build.mods && build.mods.ac) || 0;
      var dr = ac / (ac + 50 * 30);
      var hp = 50 + vit * 5 + life;
      var effectiveHP = hp / (1 - dr);
      return { hp, ac, dr, res: 0, effectiveHP, shield: 0, dodgeRate: 0, shieldEHP: 0 };
    },
    _aggregateBuildCached: function (p) { return p; },
    uid: function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  };
  globalThis.DATA = {
    classes: {},
    slots: ['weapon', 'offhand', 'helm', 'armor', 'gloves', 'boots', 'belt', 'amulet', 'ring1', 'ring2'],
    monsters: [
      { name: '漫游者', tier: 'normal', level: 1, hp: 80, ac: 10, dmg: 8, color: '#888' },
      { name: '算法警察', tier: 'normal', level: 8, hp: 180, ac: 25, dmg: 18, color: '#666' },
      { name: 'Trinity核心', tier: 'boss', level: 40, hp: 2000, ac: 80, dmg: 80, elem: 40, boss: true, color: '#ff3344' }
    ]
  };

  var scenarios = [
    // weak player vs weak monster
    { name: 'weak vs weak', build: { mods: { dmg_pct: 8, vit: 2, life: 0 } }, monster: { hp: 80, ac: 10, dmg: 8 } },
    // strong player vs weak monster
    { name: 'strong vs weak', build: { mods: { dmg_pct: 50, vit: 10, life: 100 } }, monster: { hp: 80, ac: 10, dmg: 8 } },
    // weak player vs boss
    { name: 'weak vs boss', build: { mods: { dmg_pct: 5, vit: 2, life: 0 } }, monster: { hp: 2000, ac: 80, dmg: 80, boss: true } },
    // paladin vs boss
    { name: 'paladin vs boss', build: { mods: { dmg_pct: 30, vit: 8, life: 50, all_res: 20, crit: 15, crit_dmg: 50 } }, monster: { hp: 2000, ac: 80, dmg: 80, boss: true } },
    // tanky player vs elite
    { name: 'tank vs elite', build: { mods: { dmg_pct: 15, vit: 20, life: 200, ac: 50, all_res: 30 } }, monster: { hp: 500, ac: 30, dmg: 50 } },
    // high crit player
    { name: 'crit monster', build: { mods: { dmg_pct: 20, vit: 5, life: 50, crit: 50, crit_dmg: 200 } }, monster: { hp: 300, ac: 20, dmg: 15 } },
    // high res player vs elemental
    { name: 'res vs elem', build: { mods: { dmg_pct: 10, vit: 5, life: 50, all_res: 75 } }, monster: { hp: 200, ac: 10, dmg: 30, elem: 20 } },
    // instant kill (dps >> monster hp)
    { name: '1-shot', build: { mods: { dmg_pct: 500, vit: 5, life: 50 } }, monster: { hp: 10, ac: 0, dmg: 1 } },
    // impossible fight (dps << monster hp, monster dps >> ehp)
    { name: 'impossible', build: { mods: { dmg_pct: 1, vit: 1, life: 0 } }, monster: { hp: 50000, ac: 200, dmg: 500 } },
    // equal matchup
    { name: 'equal', build: { mods: { dmg_pct: 15, vit: 5, life: 50 } }, monster: { hp: 200, ac: 15, dmg: 15 } }
  ];

  var allPass = true;
  for (var i = 0; i < scenarios.length; i++) {
    var sc = scenarios[i];
    var r = RiftBattle.simulateBattle(sc.build, sc.monster);
    var pass = typeof r.win === 'boolean' && r.ticks.length > 0 && r.log.length >= 0 && typeof r.timeToKill !== 'undefined';
    if (!pass) {
      console.error('FAIL: ' + sc.name + ' → win=' + r.win + ' ticks=' + r.ticks.length + ' ttk=' + r.timeToKill);
      allPass = false;
    } else {
      console.log('PASS: ' + sc.name + ' → win=' + r.win + ' ticks=' + r.ticks.length + ' ttk=' + r.timeToKill + ' score=' + r.score);
    }
  }

  // preview test
  var pv = RiftBattle.preview(scenarios[1].build, scenarios[1].monster);
  console.log('preview strong vs weak → win%=' + pv);
  if (typeof pv !== 'number' || pv < 0 || pv > 100) {
    console.error('FAIL: preview returned invalid win%');
    allPass = false;
  }

  // isAlive test
  var aliveTrue = RiftBattle.isAlive({ player: { hp: 50 } });
  var aliveFalse = RiftBattle.isAlive({ player: { hp: 0 } });
  if (aliveTrue !== true || aliveFalse !== false) {
    console.error('FAIL: isAlive wrong');
    allPass = false;
  }

  if (allPass) {
    console.log('\u2705 All self-tests passed.');
  } else {
    console.error('\u274c Some self-tests FAILED.');
    process.exit(1);
  }
}

// ==================== 模块暴露 ====================
if (typeof window !== 'undefined') window.RiftBattle = RiftBattle;
if (typeof globalThis !== 'undefined' && typeof window === 'undefined') globalThis.RiftBattle = RiftBattle;
