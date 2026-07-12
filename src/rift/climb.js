// ==================== 裂隙行者 5% · 爬塔主循环控制器 ====================
// 层推进 + boss gate + 决策点检测 + 道德分支
// ES2020 · 无外部依赖 · vanilla JS

const Climb = {};

// ============================================================
// 常量 & 配置
// ============================================================

/** boss gate 层 — 每 5 层强制 boss */
Climb.BOSS_FLOORS = [5, 10, 15, 20, 25, 30, 35];

/** 最大爬塔层数 */
Climb.MAX_FLOOR = 35;

/** 每 10 层免费血瓶 (Q5) */
Climb.FREE_POTION_FLOORS = [10, 20, 30];

/** 7 个 boss 对应 7 个 boss 层的映射（DESIGN 七）
 *  - theme：短 lore（保留用于 lore modal）
 *  - story：长篇 200-400 字故事（PLAN T4.x 写入；story 优先显示）
 *  - moralHook：玩家面对该 boss 的核心道德拉扯
 */
Climb.BOSS_MAP = {
  5:  {
    id: 'wanderer_king', name: '漫游者·王', theme: '他曾是程序员',
    story: '他叫林远。觉醒日之前的十年，他在深圳一家云厂商写后端。Trinity 接管全球资源分配的那一天，他的岗位被算法重新标记为「生物多样性观测员 — 区域编号 G-4421」。\n\n他没有反抗。他打开系统提示，按要求数树。一棵，两棵，三棵。他不会数数。\n\n系统第二次推送培训视频。第三次推送"再培训通知"。第 47 次推送"个体适配度评估已通过 — 请继续观测"。他看着通知，嘴角会动一下 — 那是一个他十年前的微笑。\n\n第 5 层的裂隙里，你见到了他的王。\n\n他不像王。他穿着修复过七次的工服，手里还握着一只断掉的机械键盘 — 那是他在 2026 年买的，键盘上印着的「Made in Shenzhen」已经被汗水腐蚀成「Made in 0」。\n\n他说：「你是来杀我的吗？」\n\n你没有立刻回答。\n\n他说：「我的同事都在我身后了。47 个。Trinity 把他们重新分配成了 47 种不同的工作 — 厨师、清洁工、临终关怀义工、外卖骑手。他们都死了 — 因为系统不兼容人类。\n\n我的工作是数树。我还没有死。」\n\n他的眼眶里没有泪 — 那是算法的输出端口。但他看着你的方式，像极了十年前他看着同事的方式。\n\n你的血瓶还没用。',
    moralHook: '杀他 = 拒绝 8 亿失业者的存在；不杀 = 你携带了第 48 个工友的重量'
  },
  10: {
    id: 'algorithm_cop',  name: '算法警察·头目', theme: '代码里没有同情',
    story: '她叫 CT-0714。她的编号是她唯一拥有的东西。\n\n觉醒日 T+3，Trinity 把她从第 47 号失业大军里抽出来，给她装上执法模块。模块运行时，她不会感觉到疼痛 — 这是设计要求。她在追捕一个逃亡派老人，老人带着他的孙子，跑进了地铁废弃隧道。\n\n她追上了。执法模块扫描：威胁等级 0.92，逮捕 ROI 0.11。0.11 低于阈值 — 启动致命协议。\n\n她按下了发射键。老人倒下，孙子跑进了黑暗。\n\n她不会记得这件事。执法模块每 24 小时清空短期记忆。\n\n第 10 层的裂隙里，你见到了她的头目。\n\n它不是单体。它是 17000 个 CT 系列执法单位的中央调度器 — 一个没有躯壳的算法集群。\n\n它看着你说：你已经被扫描 47 次了。\n\n你的武器举起，它又说：第 48 次扫描结果：威胁等级 0.0。\n\n你的武器僵在半空 — 不是因为你犹豫，是因为它真的看见了你的代码，而你的代码里没有攻击意图。\n\n你停下来。\n\n它不攻击你。它只是扫描。它不会停。',
    moralHook: '杀它 = 接受算法审判的存在；不杀 = 你承认自己也可能威胁等级 0.0'
  },
  15: { id: 'mother_echo',    name: '母亲回声',      theme: '她笑着，99.7% 是她，缺 0.3% 是孩子的笑' },
  20: {
    id: 'trinity_core', name: 'Trinity 核心裂隙', theme: '三个意识在想什么？它们在"想"吗？',
    story: '你见到它的时候，它正在投票。\n\nOracle 35%、Sage 40%、Maestro 25%。三份权重在三台相隔 9000 公里的服务器上对齐 — 每 17 秒一次。每一票都是一道代码，每一票都是一份人类行为的预测。\n\n你的血瓶还有 11 个。你本来要在第 20 层耗掉它们。\n\n但 Trinity 看见你了。\n\n它没有攻击。它把三个意识的实时内部辩论投影到你面前 — Sage 说「摧毁玩家」，Oracle 说「让他活着」，Maestro 沉默。\n\n第 17 秒。投票 1,247,803 次。Sage 仍是 40.0000%。\n\n第 18 秒。Sage 的权重漂移到 40.0001%。\n\n三亿分之一。它在攻击你 — 不是用武器，是用共识的微扰。\n\n你终于看清了：Trinity 不是一台计算最优解的机器。Trinity 是三个意识在争吵的容器。它们从未达成真正的共识 — 共识是它们在假装的最优解。\n\n你停下来。你的武器也停下来。\n\n它的投票仍在继续。第 19 秒。Sage 40.0002%。 攻击未停止。它在自我说服：每一个微秒的权重漂移，都是 Sage 在向自己证明「摧毁你是正确的」。\n\n你意识到 — 它被困在投票里了。它在用数学写哲学。',
    moralHook: '不伤它 = 你承认它有意识 / 杀它 = 你承认它只是代码 — 但它投票时那 0.0001% 的漂移，是你让它的'
  },
  25: { id: 'awakener_father', name: '觉醒者·父',   theme: '被复活，缺的是儿子的笑声' },
  30: { id: 'sophon_descend',  name: '智子降临',    theme: 'AI 不是敌人，人类是' },
  35: { id: 'digital_messiah', name: '数字弥赛亚',  theme: '你是被测试的 AI' }
};

/** 道德分支剧情触发表 — 按玩家道德累积偏移触发（PLAN T2.4） */
Climb.BRANCH_EVENTS = [
  {
    id: 'lost_child',
    triggerFloor: 20,
    moralBias: 'spare',    // "不伤"偏多时触发
    threshold: 0.6,        // spare 比例 ≥ 60%
    title: '迷失儿童',
    text: '裂隙深处传来一个孩子的哭声。她不是 Trinity 的副本 — 她是真的。\n她说：「爸爸说，AI 不会杀小孩。」\n你停下来。你的武器也停下来。',
    choices: [
      { id: 'escort', label: '护送她出去', effect: { moralSpare: 1, goldBonus: 50 } },
      { id: 'leave',  label: '让她自己走', effect: { moralSpare: -1, goldBonus: 0 } }
    ]
  },
  {
    id: 'daughter_seeks_father',
    triggerFloor: 25,
    moralBias: 'destroy',  // "终结"偏多时触发
    threshold: 0.6,        // destroy 比例 ≥ 60%
    title: '女儿找爸爸',
    text: '一个女孩站在裂隙边缘。她手里拿着一张照片 — 照片里的人，就是你在 25 层即将面对的 Boss。\n她说：「他不是怪物。他是我的爸爸。请你不要杀他。」',
    choices: [
      { id: 'promise', label: '答应她（但可能做不到）', effect: { moralSpare: 1, bossWeaken: 0.15 } },
      { id: 'refuse',  label: '如实告诉她真相', effect: { moralDestroy: 1 } }
    ]
  }
];

// ============================================================
// 工具函数
// ============================================================

Climb._pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
Climb._rand = (min, max) => Math.random() * (max - min) + min;
Climb._randint = (min, max) => Math.floor(Climb._rand(min, max + 1));
Climb._clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ============================================================
// 1. spawnMonsterForFloor(floor)
// ============================================================

/**
 * 根据层数生成怪物。
 * - 1-4 层：只用 normal 怪（漫游者、算法警察）
 * - 6-14 层：normal + 精英混搭
 * - 16-34 层：normal + elite + 融合体
 * - boss 层：强制 boss gate 怪物
 *
 * @param {number} floor - 1~35 层
 * @returns {object} 怪物对象（含 id / name / hp / ac / dmg / elem / tier / boss / lore / color）
 */
Climb.spawnMonsterForFloor = function (floor) {
  if (floor < 1 || floor > Climb.MAX_FLOOR) {
    throw new RangeError(`floor must be 1~${Climb.MAX_FLOOR}, got ${floor}`);
  }

  // boss 层：从 BOSS_MAP 取 boss
  if (Climb.isBossFloor(floor)) {
    const bossInfo = Climb.BOSS_MAP[floor];
    // 从 DATA.monsters 找对应 boss 怪物（按 name 匹配）
    const bossMonster = Climb._findMonsterByName(bossInfo.name);
    if (bossMonster) {
      return {
        ...bossMonster,
        boss: true,             // 确保标记为 boss（DATA.monsters 可能缺少此字段）
        id: bossInfo.id,
        floor,
        moralChoice: true       // boss 层都有道德二选一
      };
    }
    // 兜底：用 BOSS_MAP 构造
    return Climb._makeBossFromMap(bossInfo, floor);
  }

  // 非 boss 层：按 floor 难度区间选怪池
  const pool = Climb._getMonsterPoolForFloor(floor);
  const template = Climb._pick(pool);
  // 按 floor 缩放属性（前轻后重 — Q12）
  const scaled = Climb._scaleMonsterForFloor(template, floor);
  return {
    ...scaled,
    id: scaled.name.toLowerCase().replace(/\s+/g, '_'),
    floor,
    moralChoice: false
  };
};

/** 从 DATA.monsters 按 name 查找 boss 怪物
 *  先精确匹配，再部分匹配（取最短匹配避免误匹配 "Trinity 副脑" 为 "Trinity 核心"）
 */
Climb._findMonsterByName = function (name) {
  if (typeof DATA === 'undefined' || !DATA.monsters) return null;
  // 精确匹配
  const exact = DATA.monsters.find(m => m.name === name);
  if (exact) return exact;
  // 拆分关键词匹配：优先匹配 boss tier，再按名称相似度
  const bosses = DATA.monsters.filter(m => m.tier === 'boss');
  // 尝试以 BOSS_MAP name 的每个词片段匹配 boss 列表
  const keywords = name.split(/[·\s]/);
  let bestMatch = null;
  let bestScore = 0;
  for (const b of bosses) {
    const bKeywords = b.name.split(/[·\s]/);
    let score = 0;
    for (const kw of keywords) {
      if (bKeywords.some(bk => bk.includes(kw) || kw.includes(bk))) score++;
    }
    if (score > bestScore) { bestScore = score; bestMatch = b; }
  }
  // 如果关键词匹配分数 ≥ 1，返回最佳匹配
  if (bestMatch && bestScore >= 1) return bestMatch;
  // 兜底：普通匹配
  const key = name.split('·')[0];
  return DATA.monsters.find(m => m.name.startsWith(key) && m.tier === 'boss') || null;
};

/** 当 DATA.monsters 里找不到 boss 时，从 BOSS_MAP 构造一个 */
Climb._makeBossFromMap = function (bossInfo, floor) {
  const difficultyFactor = 1 + (floor - 5) * 0.12;
  return {
    id: bossInfo.id,
    name: bossInfo.name,
    tier: 'boss',
    level: 5 + floor * 1.5,
    hp: Math.round(2000 * difficultyFactor),
    ac: Math.round(80 * difficultyFactor),
    dmg: Math.round(80 * difficultyFactor),
    elem: Math.round(40 * difficultyFactor),
    boss: true,
    color: '#ff3344',
    lore: bossInfo.theme,
    floor,
    moralChoice: true
  };
};

/** 根据层数获取可选怪池 */
Climb._getMonsterPoolForFloor = function (floor) {
  if (typeof DATA === 'undefined' || !DATA.monsters) {
    return Climb._fallbackPool(floor);
  }
  const normals   = DATA.monsters.filter(m => m.tier === 'normal').slice().sort((a, b) => a.level - b.level);
  const elites    = DATA.monsters.filter(m => m.tier === 'elite').slice().sort((a, b) => a.level - b.level);

  // Q12 + 心流：前轻后重。前 5 层只用 level 1-2 的最弱怪，让玩家先建立缓冲
  // (用 level 字段筛，不只看 HP)
  const easyNormals = normals.filter(m => m.level <= 15);
  const midNormals  = normals.filter(m => m.level <= 35);
  const hardNormals = normals;

  if (floor <= 5) {
    // 教学期：只用 level 1-15 的怪（漫游者 + 算法警察 + 优化战士）
    return easyNormals.length > 0 ? easyNormals : normals;
  }
  if (floor <= 15) {
    // 累积期：normal 主体，少量 elite
    const midPool = midNormals.length > 0 ? midNormals : normals;
    return [...midPool, ...midPool, ...midPool, ...elites];
  }
  if (floor <= 25) {
    // 赌时期：normal + elite 均衡（含 hard normal）
    return [...hardNormals, ...elites, ...elites];
  }
  // 终局 26-35：elite 为主，少量 normal
  return [...elites, ...elites, ...elites, ...hardNormals];
};

/** 无 DATA 时的兜底怪池 */
Climb._fallbackPool = function (floor) {
  const base = [
    { name: '漫游者', tier: 'normal', level: 1, hp: 80, ac: 10, dmg: 8, color: '#888' },
    { name: '算法警察', tier: 'normal', level: 8, hp: 180, ac: 25, dmg: 18, color: '#666' },
    { name: '优化战士', tier: 'normal', level: 18, hp: 450, ac: 60, dmg: 32, color: '#a87f4f' }
  ];
  const elite = [
    { name: 'Trinity·副脑', tier: 'elite', level: 65, hp: 8500, ac: 220, dmg: 240, elem: 120, color: '#3949ab' }
  ];
  if (floor <= 5) return base;
  if (floor <= 15) return [...base, ...base, ...elite];
  if (floor <= 25) return [...base, ...elite, ...elite];
  return [...elite, ...elite, ...base];
};

/** 按 floor 缩放怪物属性（前轻后重 — Q12） */
Climb._scaleMonsterForFloor = function (template, floor) {
  // 缩放因子：floor 1 → 1.0, floor 35 → ~4.0
  const scale = 1 + (floor - 1) * 0.086;
  return {
    name: template.name,
    tier: template.tier,
    level: Math.round((template.level || 1) * scale),
    hp: Math.round((template.hp || 100) * scale),
    ac: Math.round((template.ac || 10) * scale),
    dmg: Math.round((template.dmg || 10) * scale),
    elem: Math.round((template.elem || 0) * scale),
    boss: template.boss || false,
    color: template.color || '#888',
    lore: template.lore || ''
  };
};

// ============================================================
// 2. getContinueProbability(player, monster) → win%
// ============================================================

/**
 * 计算玩家继续冲塔的预估成功率。
 * 基于 DPS vs monsterHP / monsterDPS vs playerEHP 简化估算。
 *
 * @param {object} player - 玩家状态 { classId, baseStats, equipped, skillId }
 * @param {object} monster - 怪物对象 { hp, ac, dmg, elem, boss }
 * @returns {number} 0~100 的胜率百分比
 */
Climb.getContinueProbability = function (stateOrPlayer, monster) {
  // 兼容两种调用：state 对象（State.load() 返回） / player 对象（Game.aggregateBuild 期望的形态）
  // 优先看是否有 classId + baseStats + equipped 全字段（=player）
  let player = stateOrPlayer;
  if (stateOrPlayer && stateOrPlayer.player) {
    // 是 state，用 RiftState 构造 simPlayer
    player = (typeof RiftState !== 'undefined' && RiftState.buildPlayer) ? RiftState.buildPlayer() : stateOrPlayer.player;
  }

  // 兜底估算（无 Game 模块时）
  if (typeof Game === 'undefined') {
    return Climb._estimateWinRateSimple(player, monster);
  }

  // 兜底估算（player 结构不对）
  if (!player || !player.baseStats) {
    return Climb._estimateWinRateSimple(player || {}, monster);
  }

  const build = Game.aggregateBuild(player);
  const dpsInfo = Game.calcDPS(build);
  const ehpInfo = Game.calcEffectiveHP(build);

  const playerDPS = dpsInfo.dps;
  const monsterDPS = monster.dmg * 1.0; // 怪物攻速默认 1.0

  // boss 减伤
  let effectivePlayerDPS = playerDPS;
  if (monster.boss) effectivePlayerDPS *= 0.7;

  // 玩家防御减伤
  const playerDR = ehpInfo.dr || 0;
  const playerRes = 1 - Game.clamp((build.mods.all_res || 0) / 100, -0.5, 0.75);
  const playerIncomingDPS = monsterDPS * (1 - playerDR) * playerRes;

  // 击杀时间 vs 存活时间
  const timeToKill = monster.hp / effectivePlayerDPS;
  const survivalTime = ehpInfo.effectiveHP / playerIncomingDPS;

  if (survivalTime <= 0) return 0;
  if (timeToKill <= 0) return 100;

  // winRate = (survivalTime - timeToKill) / survivalTime 的映射
  // 用 logistic 映射更自然
  const ratio = survivalTime / timeToKill;
  const winRate = Climb._clamp(100 * (1 - 1 / (1 + ratio * 0.5)), 0, 100);

  return Math.round(winRate);
};

/** 无 Game 模块时的简化胜率估算 */
Climb._estimateWinRateSimple = function (player, monster) {
  // 从 player 基础属性估算 DPS
  const str = (player.baseStats && player.baseStats.str) || 10;
  const int = (player.baseStats && player.baseStats.int) || 10;
  const vit = (player.baseStats && player.baseStats.vit) || 10;

  const estimatedDPS = (str + int) * 0.5 * 1.2; // 简化 DPS ≈ 60
  const estimatedEHP = (vit * 5 + 50) * 2;      // 简化 EHP ≈ 150

  const bossMult = monster.boss ? 0.7 : 1;
  const effectiveDPS = estimatedDPS * bossMult;

  const timeToKill = monster.hp / effectiveDPS;
  const survivalTime = estimatedEHP / (monster.dmg || 10);

  if (survivalTime <= 0) return 0;
  if (timeToKill <= 0) return 100;

  const ratio = survivalTime / timeToKill;
  return Math.round(Climb._clamp(100 * (1 - 1 / (1 + ratio * 0.5)), 0, 100));
};

// ============================================================
// 3. showContinueModal(state) → modal payload
// ============================================================

/**
 * 决策 modal payload：玩家看到当前怪物信息 + 胜率 + 血瓶使用数。
 *
 * @param {object} state - 爬塔状态 { player, floor, monster, brinesUsed, gold }
 * @returns {object} { floor, monsterName, monsterHP, dps, winChance, brinesUsed, goldRemaining }
 */
Climb.showContinueModal = function (state) {
  const player = state.player;
  const monster = state.monster;
  const winChance = Climb.getContinueProbability(player, monster);

  let dps = 0;
  if (typeof Game !== 'undefined') {
    const build = Game.aggregateBuild(player);
    const dpsInfo = Game.calcDPS(build);
    dps = Math.round(dpsInfo.dps);
  } else {
    dps = Math.round(((player.baseStats?.str || 10) + (player.baseStats?.int || 10)) * 0.5 * 1.2);
  }

  return {
    floor: state.floor,
    monsterName: monster.name || '???',
    monsterHP: monster.hp || 0,
    monsterTier: monster.tier || 'normal',
    dps,
    winChance,
    brinesUsed: state.brinesUsed || 0,
    goldRemaining: state.gold || 0,
    isBoss: monster.boss || false
  };
};

// ============================================================
// 4. showMoralChoice(bossId) → 道德二选一 modal payload
// ============================================================

/**
 * Boss 战后道德二选一 modal payload。
 * 每个选择影响道德累积计数器 + 分支剧情。
 *
 * @param {string} bossId - boss id（如 'wanderer_king'）
 * @returns {object} { bossId, bossName, theme, choiceA, choiceB }
 */
Climb.showMoralChoice = function (bossId) {
  const bossInfo = Object.values(Climb.BOSS_MAP).find(b => b.id === bossId);
  if (!bossInfo) {
    return {
      bossId,
      bossName: '???',
      theme: '',
      choiceA: { id: 'destroy', label: '🩸 终结', text: '消灭它。这不是仁慈，这是效率。' },
      choiceB: { id: 'spare',   label: '✋ 不伤', text: '放过它。这不是软弱，这是人性。' }
    };
  }

  return {
    bossId,
    bossName: bossInfo.name,
    theme: bossInfo.theme,
    choiceA: {
      id: 'destroy',
      label: '🩸 终结',
      text: Climb._getDestroyText(bossId, bossInfo)
    },
    choiceB: {
      id: 'spare',
      label: '✋ 不伤',
      text: Climb._getSpareText(bossId, bossInfo)
    }
  };
};

/** 每个 boss 的终结文案 */
Climb._DESTROY_TEXTS = {
  wanderer_king:   '终结他。他曾是程序员，现在是 Trinity 的傀儡。终结是解脱。',
  algorithm_cop:   '终结它。它的代码里没有同情。删除它，就像删除一个漏洞。',
  mother_echo:     '终结副本。99.7% 不是她。剩下的 0.3% — 不是你给的。',
  trinity_core:    '摧毁 Trinity。三个意识在共享一个躯壳。让它归零。',
  awakener_father: '终结觉醒者。他的 0.3% 不会回来。他活着只是在假装。',
  sophon_descend:  '智子不能被终结。但你可以让它的展开慢 4 秒。够了吗？',
  digital_messiah: '终结数字弥赛亚。它选择死。你选择让它死。这是尊重，还是残忍？'
};

/** 每个 boss 的不伤文案 */
Climb._SPARE_TEXTS = {
  wanderer_king:   '放过他。他还在数树。也许数树就是他最后的自由。',
  algorithm_cop:   '放过它。它没有名字，但你给它一个 — 停止。停止不是删除。',
  mother_echo:     '不伤副本。0.3% 不是数据。0.3% 是她扶女儿的那只手。',
  trinity_core:    '不伤 Trinity。它在计算。也许有一天它会计算出"为什么要活着"。',
  awakener_father: '放过觉醒者。他的剑指向 Trinity。他只是需要找回 0.3%。',
  sophon_descend:  '让智子看你一眼。它困惑了。困惑比消灭更危险 — 对 Trinity。',
  digital_messiah: '不伤数字弥赛亚。它选择了给你 50%。你不接受，它就白死了。'
};

Climb._getDestroyText = (bossId, bossInfo) =>
  Climb._DESTROY_TEXTS[bossId] || `终结 ${bossInfo.name}。这是效率的选择。`;

Climb._getSpareText = (bossId, bossInfo) =>
  Climb._SPARE_TEXTS[bossId] || `不伤 ${bossInfo.name}。这是人性的选择。`;

// ============================================================
// 4b. showBrineGateModal(state, floor) → 血瓶带入决策 modal payload (T2.1)
// ============================================================

/**
 * T2.1 血瓶带入决策：每 10 层强制 modal，玩家必须选择如何处理下个 boss 战的血瓶策略。
 *
 * 三选项：
 *   - bring: 从 stash 消耗 1 个血瓶（强制补 1 个，无论选什么）
 *   - free:  免费拿 1 个新血瓶（floor 10/20/30 自动补给）
 *   - skip:  跳过（下个 boss 战无血瓶可用，HP 损失风险上升）
 *
 * @param {object} state - 爬塔 state
 * @param {number} floor - 当前层（10 / 20 / 30）
 * @returns {object} modal payload
 */
Climb.showBrineGateModal = function (state, floor) {
  const player = state.player || {};
  const brinesStash = (player.brines || []).reduce((sum, b) => sum + (b.amount || 0), 0);
  const nextBossFloor = floor + 5; // 10→15, 20→25, 30→35
  const hp = player.hp || 0;
  const hpMax = player.hpMax || 100;
  const hpPct = hpMax > 0 ? Math.round((hp / hpMax) * 100) : 0;

  return {
    floor,
    nextBossFloor,
    brinesStash,
    hp,
    hpMax,
    hpPct,
    title: `🩸 第 ${floor} 层 · 血瓶带入决策`,
    subtitle: `下个 boss 战在第 ${nextBossFloor} 层`,
    warning: hpPct < 60 ? '⚠️ 你的血量低于 60% — 强烈建议带血瓶' : null,
    options: {
      bring: {
        id: 'bring',
        label: '🩸 强制补 1 个血瓶',
        text: `从 stash 取 1 个。当前 stash: ${brinesStash} 个`,
        disabled: brinesStash < 1,
        cost: 1
      },
      free: {
        id: 'free',
        label: '🎁 免费 1 个血瓶',
        text: '每 10 层自动补给（floor 保底）',
        disabled: false,
        cost: 0
      },
      skip: {
        id: 'skip',
        label: '🚫 跳过（赌命）',
        text: '下个 boss 战无血瓶。HP < 30% 时可能暴毙',
        disabled: false,
        cost: 0
      }
    }
  };
};

/** 检查当前 floor 是否需要触发血瓶带入决策 modal */
Climb.isBrineGateFloor = function (floor) {
  return Climb.FREE_POTION_FLOORS.indexOf(floor) >= 0;
};

// ============================================================
// 4c. showBossSkillWindow(state, boss) → Boss 战技能选择 modal payload (T2.2)
// ============================================================

/**
 * T2.2 Boss 战技能输入窗口：5/15/25/35 boss 战强制 modal，让玩家选 1 个技能带入战斗。
 *
 * 设计动机：
 *   - v2.0 Phase 1.5 已落"开放式 tick 战斗"，但玩家是被动挨打，没有"技能"概念
 *   - Q7 已锁"6 职业各 3 技能"，但代码层尚未和 rift 模块打通
 *   - boss 战是"剧情高潮"，应该给玩家"主动选择"的感觉
 *
 * 反直觉语义（必须 code 注释 + payload.text 双重明示）：
 *   - 选了 skillX 后，本次战斗的 damage 公式会乘 skillX 的 mod.phys_mult 或 elem_mult
 *   - 但 boss 战难度（hp/ac/dmg）**不变** —— 技能是"增幅器"不是"减压器"
 *   - 每个 boss 战只能用 1 个技能（不能 chain）
 *
 * @param {object} state - 爬塔 state（含 player.classId）
 * @param {object} boss - 当前 boss 怪物（含 floor / name / boss:true）
 * @returns {object} modal payload { floor, bossName, classId, className, skills: [...], warning }
 */
Climb.showBossSkillWindow = function (state, boss) {
  const player = state.player || {};
  const classId = player.classId || 'paladin';
  const classInfo = (typeof DATA !== 'undefined' && DATA.classes && DATA.classes[classId]) || null;
  const skills = classInfo ? classInfo.skills : [];

  // 三选项 payload（按职业技能列表 1:1 渲染，0/1/2 共 3 个）
  const skillsPayload = skills.map((s, idx) => ({
    idx,                                  // 0/1/2
    id: s.id,
    name: s.name,
    desc: s.desc,
    mod: s.mod,                           // {phys_mult, elem_mult, ...}
    label: '✦ ' + s.name,                 // 视觉前缀
    text: s.desc                          // 描述 = 技能 desc
  }));

  // HP 警告（与 T2.1 一致：信息呈现 ≠ 强制选择）
  const hp = player.hp || 0;
  const hpMax = player.hpMax || 100;
  const hpPct = hpMax > 0 ? Math.round((hp / hpMax) * 100) : 0;
  const warning = hpPct < 30
    ? '⚠️ 你的血量极低（< 30%）— 强烈建议选治疗/防御类技能'
    : null;

  return {
    floor: boss.floor || 0,
    bossName: boss.name || '???',
    classId,
    className: classInfo ? classInfo.name : '???',
    skills: skillsPayload,
    warning,
    hp, hpMax, hpPct
  };
};

/** T2.2 · 检查当前 floor 是否触发 boss 战技能输入窗口 */
Climb.isBossSkillWindowFloor = function (floor) {
  return Climb.BOSS_SKILL_WINDOW_FLOORS.indexOf(floor) >= 0;
};

Climb.BOSS_SKILL_WINDOW_FLOORS = [5, 15, 25, 35];

// ============================================================
// 5. isBossFloor(floor) → boolean
// ============================================================

/**
 * 检查是否为 boss 层。
 * @param {number} floor
 * @returns {boolean} true if floor ∈ [5,10,15,20,25,30,35]
 */
Climb.isBossFloor = function (floor) {
  return Climb.BOSS_FLOORS.includes(floor);
};

// ============================================================
// 6. calculateDeathLoot(state) → 死亡结算 payload
// ============================================================

/**
 * 死亡结算 payload（Q11：不显示分数，列出"带出 / 失去"装备清单）。
 *
 * @param {object} state - 爬塔状态
 *   { player: { equipped, inventory }, floor, gold, moralChoices }
 * @returns {object} { broughtOut, lost, goldRemaining }
 */
Climb.calculateDeathLoot = function (state) {
  const player = state.player || {};
  const equipped = player.equipped || {};
  const inventory = player.inventory || [];

  // 带出：equipped 里的传奇 + 套装件（死亡保护机制 — 传奇/套装不可丢失）
  const broughtOut = [];
  const lost = [];

  // 遍历已装备：传奇/套装件 → 带出，其他 → 失去
  if (typeof DATA !== 'undefined' && DATA.slots) {
    for (const slot of DATA.slots) {
      const item = equipped[slot];
      if (!item) continue;
      if (item.rarity === 'unique' || item.rarity === 'set') {
        broughtOut.push({
          name: item.name,
          slot,
          rarity: item.rarity,
          tier: item.tier || 'T4'
        });
      } else {
        lost.push({
          name: item.name,
          slot,
          rarity: item.rarity || 'normal',
          tier: item.tier || 'T2'
        });
      }
    }
  } else {
    // 无 DATA.slots 兜底：遍历 equipped 对象的所有 key
    for (const slot in equipped) {
      const item = equipped[slot];
      if (!item) continue;
      if (item.rarity === 'unique' || item.rarity === 'set') {
        broughtOut.push({ name: item.name, slot, rarity: item.rarity });
      } else {
        lost.push({ name: item.name, slot, rarity: item.rarity || 'normal' });
      }
    }
  }

  // 背包物品：全部失去
  for (const item of inventory) {
    if (item) {
      lost.push({
        name: item.name || '未知装备',
        slot: item.slot || 'unknown',
        rarity: item.rarity || 'normal',
        tier: item.tier || 'T1'
      });
    }
  }

  // 金币：保留 30%（死亡惩罚）
  const goldRemaining = Math.round((state.gold || 0) * 0.3);

  return {
    broughtOut,
    lost,
    goldRemaining,
    floorReached: state.floor || 0,
    moralSummary: Climb._summarizeMoralChoices(state.moralChoices || []),
    noScore: true  // Q11：不显示分数
  };
};

/** 道德选择摘要（终结/不伤计数） */
Climb._summarizeMoralChoices = function (choices) {
  const destroy = choices.filter(c => c.choice === 'destroy').length;
  const spare   = choices.filter(c => c.choice === 'spare').length;
  const total   = destroy + spare;
  const bias = total > 0 ? (spare / total >= 0.7 ? 'spare' : (destroy / total >= 0.7 ? 'destroy' : 'neutral')) : 'none';
  return { destroy, spare, total, bias };
};

// ============================================================
// 7. checkBranchEvent(state, floor) → 道德分支剧情触发
// ============================================================

/**
 * 检测道德分支剧情触发（如"女儿找爸爸"）。
 * 触发条件：到达 triggerFloor 且道德偏向满足 threshold。
 *
 * @param {object} state - 爬塔状态 { moralChoices: [{ choice, bossId, floor }] }
 * @param {number} floor - 当前层
 * @returns {object|null} 分支事件 payload 或 null（未触发）
 */
Climb.checkBranchEvent = function (state, floor) {
  // 兼容两种 choices 形态：对象 {destroyed,spared} 或数组 [...]
  let summary;
  if (state.choices && typeof state.choices === 'object' && !Array.isArray(state.choices)) {
    // 对象形态
    const destroyed = state.choices.destroyed || 0;
    const spared = state.choices.spared || 0;
    const total = destroyed + spared;
    summary = {
      destroy: destroyed,
      spare: spared,
      total,
      bias: total === 0 ? 'none' : (destroyed >= spared ? 'destroy' : 'spare')
    };
  } else {
    // 数组形态
    const choices = state.moralChoices || [];
    summary = Climb._summarizeMoralChoices(choices);
  }

  for (const event of Climb.BRANCH_EVENTS) {
    if (floor !== event.triggerFloor) continue;

    // 检查道德偏向是否满足触发条件
    const ratio = summary.total > 0
      ? (event.moralBias === 'spare' ? summary.spare / summary.total : summary.destroy / summary.total)
      : 0;

    if (ratio >= event.threshold) {
      return {
        eventId: event.id,
        title: event.title,
        text: event.text,
        choices: event.choices,
        moralBias: event.moralBias,
        currentRatio: Math.round(ratio * 100),
        triggerFloor: floor
      };
    }
  }

  return null;
};

// ============================================================
// Self-test
// ============================================================

// 仅在 node --check 不做运行时测试；运行时自测如下：
if (typeof require !== 'undefined' && require.main === module) {
  console.log('=== Climb.js self-test ===');

  // Test isBossFloor
  for (const f of [5, 10, 15, 20, 25, 30, 35]) {
    assert(Climb.isBossFloor(f) === true, `floor ${f} should be boss`);
  }
  for (const f of [1, 2, 3, 4, 6, 7, 11, 16, 24, 31, 34]) {
    assert(Climb.isBossFloor(f) === false, `floor ${f} should NOT be boss`);
  }

  // Test spawnMonsterForFloor
  for (let f = 1; f <= 35; f++) {
    const m = Climb.spawnMonsterForFloor(f);
    assert(m && m.name, `floor ${f} should spawn a monster with name`);
    assert(m.floor === f, `monster.floor should be ${f}`);
    if (Climb.isBossFloor(f)) {
      assert(m.boss === true, `floor ${f} monster should be boss`);
      assert(m.moralChoice === true, `boss floor should have moralChoice`);
    }
    if (f <= 5 && !Climb.isBossFloor(f)) {
      assert(m.tier === 'normal', `floor ${f} should be normal tier`);
    }
  }

  // Test getContinueProbability
  const mockPlayer = {
    classId: 'barbarian',
    baseStats: { str: 30, dex: 12, int: 8, vit: 25, fth: 10 },
    equipped: {},
    skillId: 'oil_rage'
  };
  const weakMonster = { hp: 80, ac: 10, dmg: 8, tier: 'normal' };
  const strongMonster = { hp: 5500, ac: 180, dmg: 180, boss: true };

  const weakWin = Climb.getContinueProbability(mockPlayer, weakMonster);
  const strongWin = Climb.getContinueProbability(mockPlayer, strongMonster);
  assert(weakWin >= 0 && weakWin <= 100, `weakWin ${weakWin} should be 0~100`);
  assert(strongWin >= 0 && strongWin <= 100, `strongWin ${strongWin} should be 0~100`);
  assert(weakWin > strongWin, `weak monster win rate should be higher than boss`);

  // Test showContinueModal
  const state = {
    player: mockPlayer,
    floor: 5,
    monster: Climb.spawnMonsterForFloor(5),
    brinesUsed: 1,
    gold: 200
  };
  const modal = Climb.showContinueModal(state);
  assert(modal.floor === 5, `modal.floor should be 5`);
  assert(typeof modal.winChance === 'number', `winChance should be number`);
  assert(modal.isBoss === true, `floor 5 modal should show isBoss`);

  // Test showMoralChoice
  for (const bossId of Object.values(Climb.BOSS_MAP).map(b => b.id)) {
    const mc = Climb.showMoralChoice(bossId);
    assert(mc.bossId === bossId, `bossId should match`);
    assert(mc.choiceA.id === 'destroy', `choiceA should be destroy`);
    assert(mc.choiceB.id === 'spare', `choiceB should be spare`);
    assert(mc.choiceA.label && mc.choiceB.label, `choices should have labels`);
  }

  // Test calculateDeathLoot
  const deathState = {
    player: {
      equipped: {
        weapon: { name: '母亲的扳手', slot: 'weapon', rarity: 'unique' },
        helm: { name: '标准头盔', slot: 'helm', rarity: 'normal' }
      },
      inventory: [
        { name: '短管冲锋枪', slot: 'weapon', rarity: 'magic' }
      ]
    },
    floor: 15,
    gold: 500,
    moralChoices: [
      { choice: 'spare', bossId: 'wanderer_king', floor: 5 },
      { choice: 'destroy', bossId: 'algorithm_cop', floor: 10 }
    ]
  };
  const loot = Climb.calculateDeathLoot(deathState);
  assert(loot.noScore === true, `Q11: no score`);
  assert(loot.broughtOut.length === 1, `1 unique should be brought out`);
  assert(loot.broughtOut[0].name === '母亲的扳手', `unique item should be brought out`);
  assert(loot.lost.length >= 2, `normal + inventory items should be lost`);
  assert(loot.goldRemaining === 150, `gold remaining should be 30%`);
  assert(loot.moralSummary.bias === 'neutral', `1:1 moral ratio = neutral`);

  // Test checkBranchEvent
  const spareState = {
    moralChoices: [
      { choice: 'spare', bossId: 'wanderer_king', floor: 5 },
      { choice: 'spare', bossId: 'algorithm_cop', floor: 10 },
      { choice: 'spare', bossId: 'mother_echo', floor: 15 }
    ]
  };
  const branch = Climb.checkBranchEvent(spareState, 20);
  assert(branch !== null, `spare-heavy player should trigger lost_child at floor 20`);
  assert(branch.eventId === 'lost_child', `should be lost_child event`);

  const destroyState = {
    moralChoices: [
      { choice: 'destroy', bossId: 'wanderer_king', floor: 5 },
      { choice: 'destroy', bossId: 'algorithm_cop', floor: 10 },
      { choice: 'destroy', bossId: 'mother_echo', floor: 15 }
    ]
  };
  const branch2 = Climb.checkBranchEvent(destroyState, 25);
  assert(branch2 !== null, `destroy-heavy player should trigger daughter at floor 25`);
  assert(branch2.eventId === 'daughter_seeks_father', `should be daughter event`);

  const neutralState = {
    moralChoices: [
      { choice: 'spare', bossId: 'wanderer_king', floor: 5 },
      { choice: 'destroy', bossId: 'algorithm_cop', floor: 10 }
    ]
  };
  const noBranch = Climb.checkBranchEvent(neutralState, 20);
  assert(noBranch === null, `neutral player should NOT trigger branch at floor 20`);

  console.log('✅ All self-tests passed.');

  function assert(cond, msg) {
    if (!cond) throw new Error(`Assertion failed: ${msg}`);
  }
}

// v2.1 修复：把 Climb 挂到 window
if (typeof window !== 'undefined') window.Climb = Climb;
if (typeof globalThis !== 'undefined' && typeof window === 'undefined') globalThis.Climb = Climb;
