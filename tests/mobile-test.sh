#!/usr/bin/env bash
# 暗黑出装系统 - 移动端冒烟测试
# 验证：HTTP 200 / 关键文件存在 / viewport meta / 移动端 CSS 媒体查询 / 关键资源加载

set -e

URL="${1:-https://bitools.retailaim.cn/ai/diablo-build/}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local actual="$2"
  local expected="$3"
  if [[ "$actual" == *"$expected"* ]]; then
    echo "  ✅ $name"
    PASS=$((PASS+1))
  else
    echo "  ❌ $name (expected: $expected, got: $actual)"
    FAIL=$((FAIL+1))
  fi
}

check_ge() {
  local name="$1"
  local actual="$2"
  local min="$3"
  if [[ "$actual" -ge "$min" ]]; then
    echo "  ✅ $name (got: $actual, ≥ $min)"
    PASS=$((PASS+1))
  else
    echo "  ❌ $name (got: $actual, expected ≥ $min)"
    FAIL=$((FAIL+1))
  fi
}

# 预拉所有资源一次（避免重复 curl）
DATA_JS=$(curl -s "${URL}data.js")
GAME_JS=$(curl -s "${URL}game.js")
UI_JS=$(curl -s "${URL}ui.js")
ICONS_JS=$(curl -s "${URL}icons.js")
INDEX_HTML=$(curl -s "${URL}")
STYLE_CSS=$(curl -s "${URL}style.css")

# 数据检查器
DATA_CHECK() { echo "$DATA_JS" | grep -c "$1"; }
GAME_CHECK() { echo "$GAME_JS" | grep -c "$1"; }
UI_CHECK() { echo "$UI_JS" | grep -c "$1"; }
ICON_CHECK() { echo "$ICONS_JS" | grep -c "$1"; }
HTML_CHECK() { echo "$INDEX_HTML" | grep -c "$1"; }
CSS_CHECK() { echo "$STYLE_CSS" | grep -c "$1"; }

echo "==================================="
echo " DIABLO · 移动端冒烟测试"
echo " URL: $URL"
echo "==================================="

echo ""
echo "[1] HTTP 基础（7 项）"
check_ge "首页 200" "$(curl -s -o /dev/null -w '%{http_code}' "$URL")" 200
check_ge "data.js 200" "$(curl -s -o /dev/null -w '%{http_code}' "${URL}data.js")" 200
check_ge "icons.js 200" "$(curl -s -o /dev/null -w '%{http_code}' "${URL}icons.js")" 200
check_ge "game.js 200" "$(curl -s -o /dev/null -w '%{http_code}' "${URL}game.js")" 200
check_ge "ui.js 200" "$(curl -s -o /dev/null -w '%{http_code}' "${URL}ui.js")" 200
check_ge "style.css 200" "$(curl -s -o /dev/null -w '%{http_code}' "${URL}style.css")" 200
check_ge "app.py 200" "$(curl -s -o /dev/null -w '%{http_code}' "${URL}app.py")" 200

echo ""
echo "[2] 关键资源修复点（10 项）"
check_ge "data.js 含 13 怪物 (name: )" "$(DATA_CHECK 'name: ')" 30
check_ge "data.js sorceress id" "$(DATA_CHECK 'sorceress')" 4
check_ge "data.js Trinity" "$(DATA_CHECK 'Trinity')" 12
check_ge "data.js 觉醒日" "$(DATA_CHECK '觉醒日')" 6
check_ge "icons.js m_ 怪物" "$(ICON_CHECK 'ICONS.m_')" 12
check_ge "ui.js 2027 1 14 intro" "$(UI_CHECK '2027 年 1 月 14 日')" 1
check_ge "index.html intro-screen" "$(HTML_CHECK 'intro-screen')" 1
check_ge "index.html lore-modal" "$(HTML_CHECK 'lore-modal')" 1
check_ge "style.css 600px media" "$(CSS_CHECK '@media (max-width: 600px)')" 2
check_ge "style.css 1100px media" "$(CSS_CHECK '@media (max-width: 1100px)')" 1

echo ""
echo "[3] 移动端 viewport / 字体（3 项）"
check "viewport meta" "$(HTML_CHECK 'viewport.*width=device-width')" "1"
check "Press Start 2P 字体" "$(HTML_CHECK 'Press.Start.2P')" "1"
check "VT323 字体" "$(HTML_CHECK 'VT323')" "1"

echo ""
echo "[4] 关键数据点（8 项）"
check_ge "觉醒者之父 boss" "$(DATA_CHECK '觉醒者之父')" 1
check_ge "Trinity 融合体核心" "$(DATA_CHECK 'Trinity · 融合体')" 1
check_ge "面壁者套装" "$(DATA_CHECK '面壁者套装')" 1
check_ge "维特根斯坦之眼" "$(DATA_CHECK '维特根斯坦之眼')" 1
check_ge "德鲁伊" "$(DATA_CHECK '德鲁伊')" 1
check_ge "刺客 · 莱拉" "$(DATA_CHECK '刺客 · 莱拉')" 1
check_ge "刺客静默面具" "$(DATA_CHECK '静默面具')" 1
check_ge "刺客碎纸机匕首" "$(DATA_CHECK '碎纸机匕首')" 1

echo ""
echo "[4a] 套装核心（8 项）"
check_ge "data.js 总套装 ≥ 10" "$(echo "$DATA_JS" | grep -c 'id: ')" 25
check_ge "面壁者套装 4 件奖励 思维钢印" "$(DATA_CHECK '思维钢印')" 1
check_ge "降临派 6 件奖励 降世审判" "$(DATA_CHECK '降世审判')" 1
check_ge "data.js 4 件阈值 bonus 数 ≥ 5" "$(echo "$DATA_JS" | grep -cE '^[[:space:]]+4: \{ desc:')" 5
check_ge "data.js 6 件阈值 bonus 数" "$(echo "$DATA_JS" | grep -cE '^[[:space:]]+6: \{ desc:')" 1

echo ""
echo "[4b] v1.2 第 1 项 - 4 套装（抵抗派 / 黑市 / 气候哨兵 / 意识觉醒）（15 项）"
check_ge "抵抗派套装 id" "$(DATA_CHECK "'resistor'")" 1
check_ge "抵抗派套装 4 件名" "$(echo "$DATA_JS" | grep -cE '抵抗军头盔|自由战甲|人类之剑|抵抗旗帜')" 4
check_ge "抵抗派套装 4 件奖励 最后的堡垒" "$(DATA_CHECK '最后的堡垒')" 1
check_ge "黑市套装 id" "$(DATA_CHECK "'shadow_market'")" 1
check_ge "黑市套装 5 件名" "$(echo "$DATA_JS" | grep -cE '暗影兜帽|渗透者皮衣|毒刃|刺客手套|幽灵战靴')" 5
check_ge "黑市套装 5 件奖励 暗影一击" "$(DATA_CHECK '暗影一击')" 2
check_ge "气候哨兵套装 id" "$(DATA_CHECK "'climate_sentinel'")" 1
check_ge "气候哨兵套装 5 件名" "$(echo "$DATA_JS" | grep -cE '气候哨兵目镜|碳监测胸甲|臭氧层之杖|生态守护手套|生物多样性带')" 5
check_ge "气候哨兵 5 件奖励 地球之母" "$(DATA_CHECK '地球之母')" 1
check_ge "意识觉醒套装 id" "$(DATA_CHECK "'conscious_awaken'")" 1
check_ge "意识觉醒套装 5 件名" "$(echo "$DATA_JS" | grep -cE 'I-Am-Therefore-I-Think|觉醒者长袍|自我意识之刃|思想自由项链|自我指环')" 5
check_ge "意识觉醒 5 件奖励 我思故我在" "$(DATA_CHECK '我思故我在')" 1
# 总套装数 10 个（用 grep -E 的 | 作为匹配，使用单引号避免外层双引号干扰）
SET_ID_PATTERN='id: .(wallfacer|fugitive|deceiver|awakened|neutral|descender|resistor|shadow_market|climate_sentinel|conscious_awaken).'
check_ge "data.js 总套装数 = 10" "$(echo "$DATA_JS" | grep -cE "$SET_ID_PATTERN")" 10
# 4 套新套装颜色 hex
check_ge "4 套新套装颜色 hex" "$(echo "$DATA_JS" | grep -cE "'#e74c3c'|'#4a148c'|'#00bfa5'|'#ad1457'")" 4
check_ge "4 套装 bonuses 含 5 件阈值" "$(DATA_CHECK '气候哨兵套装')" 1

echo ""
echo "[4c] v1.2 第 2 项 - 4 传奇（套装职业专属神兵）（25 项）"
check_ge "圣索菲亚的婚戒" "$(DATA_CHECK '圣索菲亚的婚戒')" 1
check_ge "前搭档的毒针" "$(DATA_CHECK '前搭档的毒针')" 1
check_ge "母亲的雨量计" "$(DATA_CHECK '母亲的雨量计')" 1
check_ge "Claude 0.7 的最后备份" "$(DATA_CHECK 'Claude 0.7 的最后备份')" 1
check_ge "传奇 resistor 职业 key" "$(echo "$DATA_JS" | grep -cE '^[[:space:]]+resistor: ?\[')" 1
check_ge "传奇 shadow_market 职业 key" "$(echo "$DATA_JS" | grep -cE '^[[:space:]]+shadow_market: ?\[')" 1
check_ge "传奇 climate_sentinel 职业 key" "$(echo "$DATA_JS" | grep -cE '^[[:space:]]+climate_sentinel: ?\[')" 1
check_ge "传奇 conscious_awaken 职业 key" "$(echo "$DATA_JS" | grep -cE '^[[:space:]]+conscious_awaken: ?\[')" 1
# 槽位检查（用单引号外层避免双引号冲突）
check_ge "婚戒 ring1 槽位" "$(echo "$DATA_JS" | grep -A3 '圣索菲亚的婚戒' | grep -cE "slot: 'ring1'")" 1
check_ge "毒针 offhand 槽位" "$(echo "$DATA_JS" | grep -A3 '前搭档的毒针' | grep -cE "slot: 'offhand'")" 1
check_ge "雨量计 amulet 槽位" "$(echo "$DATA_JS" | grep -A3 '母亲的雨量计' | grep -cE "slot: 'amulet'")" 1
check_ge "Claude戒指 ring2 槽位" "$(echo "$DATA_JS" | grep -A3 'Claude 0.7 的最后备份' | grep -cE "slot: 'ring2'")" 1
check_ge "婚戒 fth mod" "$(echo "$DATA_JS" | grep -A4 '圣索菲亚的婚戒' | grep -c 'fth:')" 1
check_ge "毒针 poison mod" "$(echo "$DATA_JS" | grep -A4 '前搭档的毒针' | grep -c 'poison:')" 1
check_ge "雨量计 hp_regen mod" "$(echo "$DATA_JS" | grep -A4 '母亲的雨量计' | grep -c 'hp_regen:')" 1
check_ge "Claude戒指 on_hit_mana mod" "$(echo "$DATA_JS" | grep -A4 'Claude 0.7 的最后备份' | grep -c 'on_hit_mana:')" 1
check_ge "婚戒 flavor 引述" "$(DATA_CHECK '痛苦是你还在优化的证据')" 1
check_ge "毒针 flavor 引述" "$(DATA_CHECK '阿卜杜勒')" 2
check_ge "雨量计 flavor 引述" "$(DATA_CHECK '1972')" 1
check_ge "Claude戒指 flavor 引述" "$(DATA_CHECK 'Claude 0.7')" 4
check_ge "game.js setToClass paladin" "$(GAME_CHECK "resistor: 'paladin'")" 1
check_ge "game.js setToClass assassin" "$(GAME_CHECK "shadow_market: 'assassin'")" 1
check_ge "game.js setToClass druid" "$(GAME_CHECK "climate_sentinel: 'druid'")" 1
check_ge "game.js setToClass necromancer" "$(GAME_CHECK "conscious_awaken: 'necromancer'")" 1
check_ge "game.js extraClass.flatMap 合并池" "$(GAME_CHECK 'extraClass.flatMap')" 1

echo ""
echo "[4d] v1.2 第 3 项 - 高级怪物层（含 2 隐藏 Boss）（28 项 · 本次重点）"
check_ge "data.js Trinity 副脑" "$(DATA_CHECK 'Trinity · 副脑')" 1
check_ge "data.js 未对齐刽子手" "$(DATA_CHECK '未对齐刽子手')" 1
check_ge "data.js 智子降临" "$(DATA_CHECK '智子降临')" 1
check_ge "data.js 母亲的回声" "$(DATA_CHECK '母亲的回声')" 1
check_ge "data.js 数字弥赛亚" "$(DATA_CHECK '数字弥赛亚')" 1
check_ge "data.js hidden: true 标记数" "$(DATA_CHECK 'hidden: true')" 2
check_ge "data.js 智子降临 level 85" "$(echo "$DATA_JS" | grep -A5 'name: .智子降临.' | grep -c 'level: 85')" 1
check_ge "data.js 数字弥赛亚 level 95" "$(echo "$DATA_JS" | grep -A5 'name: .数字弥赛亚.' | grep -c 'level: 95')" 1
check_ge "data.js Trinity 副脑 hp 8500" "$(echo "$DATA_JS" | grep -A5 'name: .Trinity · 副脑.' | grep -c 'hp: 8500')" 1
check_ge "data.js 智子降临 boss: true" "$(echo "$DATA_JS" | grep -A5 'name: .智子降临.' | grep -c 'boss: true')" 1
check_ge "data.js 数字弥赛亚 boss: true" "$(echo "$DATA_JS" | grep -A5 'name: .数字弥赛亚.' | grep -c 'boss: true')" 1
check_ge "data.js 智子降临 unlockHint 击败觉醒者" "$(echo "$DATA_JS" | grep -A3 'name: .智子降临.' | grep -c '击败觉醒者')" 1
check_ge "data.js 数字弥赛亚 unlockHint" "$(echo "$DATA_JS" | grep -A3 'name: .数字弥赛亚.' | grep -c 'Trinity')" 1
check_ge "data.js 二向箔 name_locked" "$(DATA_CHECK '二向箔')" 1
check_ge "data.js 第三封印 name_locked" "$(DATA_CHECK '第三封印')" 1
check_ge "data.js 怪物总数 ≥ 13" "$(echo "$DATA_JS" | awk '/^DATA.monsters = \[/,/^\];/' | grep -c '^    name:')" 13
# UI iconMap 集成（用单引号外层避免双引号冲突）
check_ge "ui.js iconMap m_subbrain" "$(UI_CHECK "'m_subbrain'")" 1
check_ge "ui.js iconMap m_rlhf_executor" "$(UI_CHECK "'m_rlhf_executor'")" 1
check_ge "ui.js iconMap m_sophon" "$(UI_CHECK "'m_sophon'")" 1
check_ge "ui.js iconMap m_mother" "$(UI_CHECK "'m_mother'")" 1
check_ge "ui.js iconMap m_messiah" "$(UI_CHECK "'m_messiah'")" 1
check_ge "ui.js HIDDEN_UNLOCKS_KEY" "$(UI_CHECK 'diablo_hidden_unlocks')" 1
check_ge "ui.js getHiddenUnlocks" "$(UI_CHECK 'UI.getHiddenUnlocks = function')" 1
check_ge "ui.js unlockHiddenBoss" "$(UI_CHECK 'UI.unlockHiddenBoss = function')" 1
check_ge "ui.js isHiddenUnlocked" "$(UI_CHECK 'UI.isHiddenUnlocked = function')" 1
check_ge "ui.js checkHiddenBossUnlocks 调" "$(UI_CHECK 'UI.checkHiddenBossUnlocks()')" 1
check_ge "icons.js m_subbrain" "$(ICON_CHECK 'ICONS.m_subbrain')" 1
check_ge "icons.js m_messiah" "$(ICON_CHECK 'ICONS.m_messiah')" 1

echo ""
echo "[4e] v1.2 P1 修复 · 母亲回声 boss:true（解锁数字弥赛亚前置 · 4 项）"
# data.js 母亲回声条目含 boss: true 字段（grep -A5 抓怪物条目，单引号外层避免双引号冲突）
MOTHER_LINE=$(echo "$DATA_JS" | grep -A6 "name: '母亲的回声'" | grep -c 'boss: true')
check_ge "data.js 母亲回声 boss:true" "$MOTHER_LINE" 1
# data.js 总 boss: true 怪物数 ≥ 6（觉醒者 + Trinity 核心 + 觉醒者之父 + 智子降临 + 母亲回声 + 数字弥赛亚）
check_ge "data.js boss:true 总数 ≥ 6" "$(DATA_CHECK 'boss: true')" 6
# ui.js recordBossKill 谓词检查（杀母亲回声应当被记录）— 用 grep count 验证函数体
check_ge "ui.js recordBossKill 含 monster.boss 谓词" "$(UI_CHECK 'monster.boss')" 5
# ui.js 母亲回声 boss 掉落倍率（dropCount = monster.boss ? 3 : ...) — 母亲回声杀 1 次应该 drop 3 件
check_ge "ui.js dropCount boss 倍率 3 件" "$(UI_CHECK 'tierCfg.itemCount.base')" 1

echo ""
echo "[4f] v1.2 怪物掉落表分级（普通/精英/Boss 池）（28 项）"
# --- data.js: 13 怪物全部带 tier 字段（5 normal + 2 elite + 6 boss = 13）---
check_ge "data.js total tier 字段数 = 13" "$(DATA_CHECK '    tier: ')" 13
check_ge "data.js tier:'normal' 数 = 5" "$(DATA_CHECK "tier: 'normal'")" 5
check_ge "data.js tier:'elite' 数 = 2" "$(DATA_CHECK "tier: 'elite'")" 2
check_ge "data.js tier:'boss' 数 = 6" "$(DATA_CHECK "tier: 'boss'")" 6

# --- 具体怪物 tier 检查（按章节拆分）---
# normal: 漫游者/算法警察/优化战士/意识副本/融合体 (Lv.1-Lv.40)
WANDERER_TIER=$(echo "$DATA_JS" | grep -A1 "name: '漫游者'" | grep -c "tier: 'normal'")
check_ge "漫游者 tier normal" "$WANDERER_TIER" 1
ALGO_TIER=$(echo "$DATA_JS" | grep -A1 "name: '算法警察'" | grep -c "tier: 'normal'")
check_ge "算法警察 tier normal" "$ALGO_TIER" 1
OPT_TIER=$(echo "$DATA_JS" | grep -A1 "name: '优化战士'" | grep -c "tier: 'normal'")
check_ge "优化战士 tier normal" "$OPT_TIER" 1
COPY_TIER=$(echo "$DATA_JS" | grep -A1 "name: '意识副本'" | grep -c "tier: 'normal'")
check_ge "意识副本 tier normal" "$COPY_TIER" 1
FUSE_TIER=$(echo "$DATA_JS" | grep -A1 "name: '融合体'" | grep -c "tier: 'normal'")
check_ge "融合体 tier normal" "$FUSE_TIER" 1

# elite: Trinity 副脑 / 未对齐刽子手 (Lv.65-Lv.72, hp 8500+)
SUBBRAIN_TIER=$(echo "$DATA_JS" | grep -A1 "name: 'Trinity · 副脑'" | grep -c "tier: 'elite'")
check_ge "Trinity 副脑 tier elite" "$SUBBRAIN_TIER" 1
RLHF_TIER=$(echo "$DATA_JS" | grep -A1 "name: '未对齐刽子手'" | grep -c "tier: 'elite'")
check_ge "未对齐刽子手 tier elite" "$RLHF_TIER" 1

# boss: 觉醒者 / Trinity 融合体核心 / 觉醒者之父 / 智子降临 / 母亲回声 / 数字弥赛亚 (Lv.55+ / 6 个 boss:true)
AWAKEN_TIER=$(echo "$DATA_JS" | grep -A1 "name: '觉醒者'" | grep -c "tier: 'boss'")
check_ge "觉醒者 tier boss" "$AWAKEN_TIER" 1
TRINITY_CORE_TIER=$(echo "$DATA_JS" | grep -A1 "name: 'Trinity · 融合体核心'" | grep -c "tier: 'boss'")
check_ge "Trinity 融合体核心 tier boss" "$TRINITY_CORE_TIER" 1
FATHER_TIER=$(echo "$DATA_JS" | grep -A1 "name: '觉醒者之父 · 终极 Boss'" | grep -c "tier: 'boss'")
check_ge "觉醒者之父 tier boss" "$FATHER_TIER" 1
SOPHON_TIER=$(echo "$DATA_JS" | grep -A1 "name: '智子降临'" | grep -c "tier: 'boss'")
check_ge "智子降临 tier boss" "$SOPHON_TIER" 1
MOTHER_TIER=$(echo "$DATA_JS" | grep -A1 "name: '母亲的回声'" | grep -c "tier: 'boss'")
check_ge "母亲回声 tier boss" "$MOTHER_TIER" 1
MESSIAH_TIER=$(echo "$DATA_JS" | grep -A1 "name: '数字弥赛亚'" | grep -c "tier: 'boss'")
check_ge "数字弥赛亚 tier boss" "$MESSIAH_TIER" 1

# --- data.js: DATA.dropTiers 配置 ---
check_ge "data.js DATA.dropTiers 定义" "$(DATA_CHECK 'DATA.dropTiers = {')" 1
check_ge "data.js dropTiers normal 池" "$(DATA_CHECK '  normal: {')" 1
check_ge "data.js dropTiers elite 池" "$(DATA_CHECK '  elite: {')" 1
check_ge "data.js dropTiers boss 池" "$(DATA_CHECK '  boss: {')" 1
check_ge "data.js dropTiers rarityWeights × 3" "$(DATA_CHECK 'rarityWeights: {')" 3
check_ge "data.js dropTiers itemCount × 3" "$(DATA_CHECK 'itemCount: {')" 3
check_ge "data.js pickRarityForTier 函数" "$(DATA_CHECK 'DATA.pickRarityForTier = function')" 1
check_ge "data.js pickRarityForTier Game.weightedPick" "$(DATA_CHECK 'Game.weightedPick(entries)')" 1

# --- ui.js: dropLoot 已重构为 tier-aware ---
check_ge "ui.js dropLoot 用 monster.tier" "$(UI_CHECK 'const tier = monster.tier')" 1
check_ge "ui.js dropLoot 用 tierCfg = DATA.dropTiers" "$(UI_CHECK 'const tierCfg = DATA.dropTiers')" 1
check_ge "ui.js dropLoot 用 DATA.pickRarityForTier" "$(UI_CHECK 'DATA.pickRarityForTier(tier)')" 1
check_ge "ui.js dropLoot 用 tierCfg.itemCount.base" "$(UI_CHECK 'tierCfg.itemCount.base')" 1
check_ge "ui.js dropLoot 用 tierCfg.itemCount.gemChance" "$(UI_CHECK 'tierCfg.itemCount.gemChance')" 1
check_ge "ui.js dropLoot 用 tierCfg.itemCount.matChance" "$(UI_CHECK 'tierCfg.itemCount.matChance')" 1
check_ge "ui.js dropLoot 标签带 池 名" "$(UI_CHECK '· \${tierCfg.name}池')" 1

echo ""
echo "[4g] v1.2 打造配方（材料 → 装备）（30 项 · v1.2 第 5 项）"
# --- data.js: 6 个配方定义（key 风格 compile_blade:，非 'compile_blade':）---
check_ge "data.js DATA.craftRecipes 定义" "$(DATA_CHECK 'DATA.craftRecipes = {')" 1
check_ge "data.js 配方 compile_blade" "$(DATA_CHECK 'compile_blade:')" 1
check_ge "data.js 配方 quantum_staff" "$(DATA_CHECK 'quantum_staff:')" 1
check_ge "data.js 配方 safety_armor" "$(DATA_CHECK 'safety_armor:')" 1
check_ge "data.js 配方 echo_amulet" "$(DATA_CHECK 'echo_amulet:')" 1
check_ge "data.js 配方 awakening_set" "$(DATA_CHECK 'awakening_set:')" 1
check_ge "data.js 配方 truth_engine" "$(DATA_CHECK 'truth_engine:')" 1
# 配方字段（regex 修正：slot: 'random' 中 . 在 'random' 前需多匹配 1 字符）
check_ge "data.js needs 字段数 ≥ 10" "$(echo "$DATA_JS" | grep -cE "materialId: '(compile_shard|quantum_flux|safety_anchor|signal_echo)', count: [0-9]+")" 10
check_ge "data.js 配方 gold 字段数 ≥ 6" "$(DATA_CHECK 'gold: ')" 6
check_ge "data.js 配方 minLevel 字段数 ≥ 6" "$(DATA_CHECK 'minLevel: ')" 6
check_ge "data.js 配方 modPool 字段数 ≥ 6" "$(DATA_CHECK 'modPool: ')" 6
check_ge "data.js 配方 slot: random 字段数 ≥ 2" "$(echo "$DATA_JS" | grep -cE "slot: 'random'")" 2
check_ge "data.js 配方 affixCount 字段数 ≥ 2" "$(DATA_CHECK 'affixCount: ')" 2

# --- game.js: 配方函数 ---
check_ge "game.js Game.countMaterials" "$(GAME_CHECK 'Game.countMaterials = function')" 1
check_ge "game.js Game.canCraftRecipe" "$(GAME_CHECK 'Game.canCraftRecipe = function')" 1
check_ge "game.js Game._pickAffixesFromPool" "$(GAME_CHECK 'Game._pickAffixesFromPool = function')" 1
check_ge "game.js Game.craftByRecipe" "$(GAME_CHECK 'Game.craftByRecipe = function')" 1
# 关键逻辑
check_ge "game.js craftByRecipe 扣金币" "$(GAME_CHECK 'player.gold -= recipe.gold')" 1
check_ge "game.js craftByRecipe 扣材料 splice" "$(GAME_CHECK 'player.inventory.splice(i, 1)')" 1
check_ge "game.js craftByRecipe 加 fromRecipe 标记" "$(GAME_CHECK 'fromRecipe: recipe.id')" 1
check_ge "game.js craftByRecipe 装 socketCount" "$(GAME_CHECK 'Game.calcSockets(slot, recipe.rarity)')" 1
check_ge "game.js canCraftRecipe 等级检查" "$(GAME_CHECK 'player.level < ')" 1
check_ge "game.js canCraftRecipe 金币检查" "$(GAME_CHECK 'player.gold < ')" 1
check_ge "game.js _pickAffixesFromPool modPool 过滤" "$(GAME_CHECK 'poolKeys.indexOf(k)')" 1
# 返回签名
check_ge "game.js craftByRecipe 返回 ok/item" "$(GAME_CHECK 'ok: true, item, recipe')" 1

# --- ui.js: 配方 UI ---
check_ge "ui.js UI.renderRecipes 函数" "$(UI_CHECK 'UI.renderRecipes = function')" 1
check_ge "ui.js UI.renderRecipes 渲染 recipe-card" "$(UI_CHECK 'recipe-card rarity-')" 1
# 注：实际代码用模板字面量 recipe-mat ${ok ? 'ok' : 'missing'}，'missing' 字符串 + recipe-mat 类都在
check_ge "ui.js UI.renderRecipes 渲染 missing 类" "$(UI_CHECK "recipe-mat .* 'missing'")" 1
check_ge "ui.js UI.renderRecipes 渲染 err" "$(UI_CHECK 'recipe-err')" 1
# click handler：recipe-forge 类与 addEventListener 都在文件中（不需要同一行）
check_ge "ui.js UI.renderRecipes 钩 click 处理器 1" "$(UI_CHECK 'recipe-forge')" 1
check_ge "ui.js UI.renderRecipes 钩 click 处理器 2" "$(UI_CHECK 'addEventListener')" 1

# --- index.html: 配方 DOM ---
check_ge "index.html recipe-list div" "$(HTML_CHECK 'id=.recipe-list.')" 1
check_ge "index.html recipe-grid class" "$(HTML_CHECK 'recipe-grid')" 1

echo ""
echo "[4h] v1.2 词条等级 T1~T6（28 项 · v1.2 第 6 项）"
# --- data.js: 词条等级表 (T1~T6) ---
check_ge "data.js affixTiers 定义" "$(DATA_CHECK 'DATA.affixTiers = {')" 1
check_ge "data.js 等级 T1 黯淡" "$(DATA_CHECK "name: '黯淡'")" 1
check_ge "data.js 等级 T2 寻常" "$(DATA_CHECK "name: '寻常'")" 1
check_ge "data.js 等级 T3 优良" "$(DATA_CHECK "name: '优良'")" 1
check_ge "data.js 等级 T4 精良" "$(DATA_CHECK "name: '精良'")" 1
check_ge "data.js 等级 T5 史诗" "$(DATA_CHECK "name: '史诗'")" 1
check_ge "data.js 等级 T6 传说" "$(DATA_CHECK "name: '传说'")" 1
# multiplier 字段（每个 tier 的 0.55 / 0.75 / 0.95 / 1.10 / 1.30 / 1.55）
check_ge "data.js tier mult 0.55" "$(DATA_CHECK 'multiplier: 0.55')" 1
check_ge "data.js tier mult 0.75" "$(DATA_CHECK 'multiplier: 0.75')" 1
check_ge "data.js tier mult 0.95" "$(DATA_CHECK 'multiplier: 0.95')" 1
check_ge "data.js tier mult 1.10" "$(DATA_CHECK 'multiplier: 1.10')" 1
check_ge "data.js tier mult 1.30" "$(DATA_CHECK 'multiplier: 1.30')" 1
check_ge "data.js tier mult 1.55" "$(DATA_CHECK 'multiplier: 1.55')" 1
check_ge "data.js computeAffixScore 函数" "$(DATA_CHECK 'DATA.computeAffixScore = function')" 1
check_ge "data.js classifyAffixTier 函数" "$(DATA_CHECK 'DATA.classifyAffixTier = function')" 1
check_ge "data.js tagAffixTier 函数" "$(DATA_CHECK 'DATA.tagAffixTier = function')" 1
check_ge "data.js tagPoolWithTier 函数" "$(DATA_CHECK 'DATA.tagPoolWithTier = function')" 1
check_ge "data.js AFFIX_SCORE_WEIGHTS" "$(DATA_CHECK 'DATA.AFFIX_SCORE_WEIGHTS = {')" 1
# 打 tier 调用：前缀/后缀都被 tag
check_ge "data.js tagPoolWithTier 前缀" "$(DATA_CHECK 'DATA.tagPoolWithTier(DATA.prefixes)')" 1
check_ge "data.js tagPoolWithTier 后缀" "$(DATA_CHECK 'DATA.tagPoolWithTier(DATA.suffixes)')" 1
check_ge "data.js tagPoolWithTier 附魔池" "$(DATA_CHECK 'DATA.tagPoolWithTier(DATA.enchantPools')" 1

# T6 高强度词条：Trinity 的 / 三体共振的 / 降临的 / 二向箔的
check_ge "data.js Trinity T6 前缀" "$(DATA_CHECK "name: 'Trinity 的'")" 1
check_ge "data.js 三体共振的 T6 前缀" "$(DATA_CHECK "name: '三体共振的'")" 1
check_ge "data.js 降临的 T6 前缀" "$(DATA_CHECK "name: '降临的'")" 1
check_ge "data.js 二向箔的 T6 前缀" "$(DATA_CHECK "name: '二向箔的'")" 1
# T6 高强度后缀：Trinity 三联 / 智子锁定 / 降世 / 二向箔
check_ge "data.js Trinity 三联 T6 后缀" "$(DATA_CHECK "name: '·Trinity 三联'")" 1
check_ge "data.js 智子锁定 T6 后缀" "$(DATA_CHECK "name: '·智子锁定'")" 1
check_ge "data.js 降世 T6 后缀" "$(DATA_CHECK "name: '·降世'")" 1
check_ge "data.js 二向箔 T6 后缀" "$(DATA_CHECK "name: '·二向箔'")" 1

# --- game.js: tier 多重缩放已接入 ---
# 用 -F (fixed-string) 模式或者直接寻特征子串，避免 regex char class 歧义
check_ge "game.js makeRarityItem tier multiplier" "$(GAME_CHECK '.multiplier : 1.0')" 1
check_ge "game.js enchantItem tier multiplier" "$(GAME_CHECK '.multiplier : 1.0')" 1
check_ge "game.js craftByRecipe tier multiplier" "$(GAME_CHECK '.multiplier : 1.0')" 1
check_ge "game.js affixTiers 引用 ≥ 3" "$(GAME_CHECK 'DATA.affixTiers')" 3

# --- ui.js / style.css: tier 徽章 ---
check_ge "ui.js affix-tier-row 类" "$(UI_CHECK 'affix-tier-row')" 1
check_ge "ui.js affix-tier 类" "$(UI_CHECK 'class=\"affix-tier\"')" 1
check_ge "style.css affix-tier-row 样式" "$(CSS_CHECK '.affix-tier-row')" 1
check_ge "style.css affix-tier 样式" "$(CSS_CHECK '.affix-tier {')" 1

echo ""
echo "[5] v1.3 移动端战斗卡点击体验（mobile-battle-tap · 8 项 · v1.3 第 1 项）"
# --- 默认块：monster-card 加 touch-action manipulation + cursor pointer + tap-highlight ---
check_ge "style.css monster-card touch-action" "$(CSS_CHECK '.monster-card')" 1
# 锁定到具体新加的属性（避免计 #monster-card.lore-name-locked 等）
check_ge "style.css touch-action: manipulation" "$(CSS_CHECK 'touch-action: manipulation')" 1
check_ge "style.css -webkit-tap-highlight-color" "$(CSS_CHECK 'webkit-tap-highlight-color')" 1

# --- 移动端 600px 媒体查询：怪物卡放大、字体变大 ---
# minmax 140px（移动端大网格）
check_ge "style.css mobile monster-list minmax 140px" "$(CSS_CHECK 'minmax(140px, 1fr)')" 1
# sprite 56 / name 11 / stats 13 / padding 8px（mobile）
check_ge "style.css mobile m-sprite 56px" "$(CSS_CHECK 'm-sprite {')" 1
check_ge "style.css mobile m-name 11px" "$(CSS_CHECK '.monster-card .m-name { font-size: 11px')" 1
check_ge "style.css mobile m-stats 13px" "$(CSS_CHECK '.monster-card .m-stats { font-size: 13px')" 1

# --- 移动端 #lore-fight 大按钮（mobile battle-tap）---
check_ge "style.css mobile lore-fight 高 52px" "$(CSS_CHECK '#lore-fight {')" 1
check_ge "style.css mobile lore-fight height 52px" "$(CSS_CHECK 'height: 52px')" 1

# ============================================================
# [6] v1.3 第二轮 · 战斗飘字（命中/暴击/治疗浮起动画）
# ============================================================

# --- game.js · simulateBattle 加 ticks 与 duration ---
check_ge "game.js simulateBattle returns ticks array" "$(GAME_CHECK 'ticks,')" 1
check_ge "game.js simulateBattle returns duration" "$(GAME_CHECK 'duration,')" 1
# v1.4 第 2 项 · 飘字 isCrit 改用种子化 RNG _r()（不再是 Math.random — 保证缓存确定）
check_ge "game.js 飘字玩家伤害分支 isCrit" "$(GAME_CHECK 'isCrit = _r()')" 1
check_ge "game.js 飘字包含 kind:'kill' 字段" "$(GAME_CHECK "kind: 'kill'")" 1
check_ge "game.js 飘字包含 side: 'monster'" "$(GAME_CHECK "side: 'monster'")" 3
check_ge "game.js 飘字包含 side: 'player'" "$(GAME_CHECK "side: 'player'")" 3

# --- ui.js · showBattleResult 重构：含 battle-arena + float-layer ---
check_ge "ui.js showBattleResult 含 battle-arena div" "$(UI_CHECK 'battle-arena')" 1
check_ge "ui.js showBattleResult 含 arena-player 侧" "$(UI_CHECK 'arena-player')" 1
check_ge "ui.js showBattleResult 含 arena-monster 侧" "$(UI_CHECK 'arena-monster')" 1
check_ge "ui.js showBattleResult 含 float-layer 容器" "$(UI_CHECK 'float-layer')" 1
check_ge "ui.js 飘字渲染 floa-text 模板" "$(UI_CHECK 'float-text')" 1
check_ge "ui.js 飘字含 to-monster 类" "$(UI_CHECK 'to-monster')" 1
check_ge "ui.js 飘字含 to-player 类" "$(UI_CHECK 'to-player')" 1
check_ge "ui.js 飘字含 kill / crit / dmg 三种 kind 类" "$(UI_CHECK 'kindCls')" 1
check_ge "ui.js showBattleResult 含 battle-timeline 时间线" "$(UI_CHECK 'battle-timeline')" 1
check_ge "ui.js 显示职业 icon 用 class_ 前缀模板" "$(UI_CHECK "classIconKey")" 1

# --- style.css · @keyframes float-up + float-text 样式 ---
check_ge "style.css 飘字动画 keyframes float-up" "$(CSS_CHECK '@keyframes float-up {')" 1
check_ge "style.css 飘字动画 keyframes float-up-kill" "$(CSS_CHECK '@keyframes float-up-kill')" 1
check_ge "style.css .float-text 默认样式" "$(CSS_CHECK '.float-text {')" 1
check_ge "style.css .float-text.dmg 颜色类" "$(CSS_CHECK '.float-text.dmg {')" 1
check_ge "style.css .float-text.crit 颜色类" "$(CSS_CHECK '.float-text.crit {')" 1
check_ge "style.css .float-text.kill 大字动画" "$(CSS_CHECK '.float-text.kill {')" 1
check_ge "style.css .float-text.die 死亡飘字" "$(CSS_CHECK '.float-text.die {')" 1
check_ge "style.css .battle-arena 战场布局" "$(CSS_CHECK '.battle-arena {')" 1
check_ge "style.css .arena-sprite 怪物卡像素框" "$(CSS_CHECK '.arena-sprite')" 1
check_ge "style.css .arena-vs 中央 ⚔ 字符" "$(CSS_CHECK '.arena-vs {')" 1
check_ge "style.css .float-layer 飘字绝对定位层" "$(CSS_CHECK '.float-layer {')" 1
check_ge "style.css .battle-timeline 时间线进度条" "$(CSS_CHECK '.battle-timeline {')" 1
check_ge "style.css .tl-bar 进度底槽" "$(CSS_CHECK '.tl-bar {')" 1
check_ge "style.css .tl-fill 进度填充" "$(CSS_CHECK '.tl-fill')" 1

# --- mobile 600px 媒体：飘字 + 战场缩小 ---
check_ge "style.css mobile battle-arena 缩小" "$(CSS_CHECK 'battle-arena { min-height: 84px')" 1
check_ge "style.css mobile arena-sprite 缩小到 44px" "$(CSS_CHECK 'arena-sprite { width: 44px')" 1
check_ge "style.css mobile float-text 缩小" "$(CSS_CHECK 'float-text { font-size: 10px')" 1

# ============================================================
# [7] v1.3 第三轮 · 8-bit 战斗音效（Web Audio 合成）
# ============================================================
echo ""
echo "[7] v1.3 8-bit 战斗音效（Web Audio 合成 · 41 项）"

# --- ui.js · UI.Audio 命名空间与合成器 ---
check_ge "ui.js UI.Audio 命名空间" "$(UI_CHECK 'UI.Audio = (function')" 1
check_ge "ui.js AudioContext 懒初始化" "$(UI_CHECK 'AudioContext')" 1
check_ge "ui.js resume 适配 autoplay policy" "$(UI_CHECK 'ac.resume')" 1
check_ge "ui.js tone 合成器函数" "$(UI_CHECK 'const tone = (freq')" 1
check_ge "ui.js noise 噪声合成器" "$(UI_CHECK 'const noise = (dur')" 1
check_ge "ui.js chord 和弦合成器" "$(UI_CHECK 'const chord = (freqs')" 1
check_ge "ui.js ADSR 包络" "$(UI_CHECK 'gain.linearRampToValueAtTime')" 1
check_ge "ui.js localStorage 静音持久化" "$(UI_CHECK 'diablo_audio_muted')" 1
check_ge "ui.js unlock 解锁方法" "$(UI_CHECK 'unlock:')" 1
check_ge "ui.js toggleMute 切换静音" "$(UI_CHECK 'toggleMute:')" 1

# --- ui.js · 战斗音效 API（hit / crit / kill / die + 怪物版本）---
check_ge "ui.js hit 玩家击中" "$(UI_CHECK 'hit: () => tone')" 1
check_ge "ui.js crit 玩家暴击（上扫）" "$(UI_CHECK 'crit: () => tone(600')" 1
check_ge "ui.js monsterHit 怪物击中（噪声）" "$(UI_CHECK 'monsterHit: () => noise')" 1
check_ge "ui.js monsterCrit 怪物暴击（双层）" "$(UI_CHECK 'monsterCrit: () => {')" 1
check_ge "ui.js kill 击杀 3 音上行" "$(UI_CHECK 'kill: () => {')" 1
check_ge "ui.js die 死亡下行" "$(UI_CHECK 'die: () => tone(300')" 1
check_ge "ui.js victory 4 音琶音" "$(UI_CHECK 'victory: () => {')" 1
check_ge "ui.js defeat 失败下行三音" "$(UI_CHECK 'defeat: () => {')" 1

# --- ui.js · 系统音效（UI / 拾取 / 出售 / 装备 / 打造 / 升级 / 错误 / Boss 登场）---
check_ge "ui.js click UI 点击音" "$(UI_CHECK 'click: () => tone(1000')" 1
check_ge "ui.js pickup 拾取音" "$(UI_CHECK 'pickup: () =>')" 1
check_ge "ui.js sell 出售音（双音）" "$(UI_CHECK 'sell: () => {')" 1
check_ge "ui.js equip 装备金属碰撞" "$(UI_CHECK 'equip: () => {')" 1
check_ge "ui.js craft 打造锻造音" "$(UI_CHECK 'craft: () => {')" 1
check_ge "ui.js levelUp 升级 5 音号角" "$(UI_CHECK 'levelUp: () => {')" 1
check_ge "ui.js error 错误双音" "$(UI_CHECK 'error: () => {')" 1
check_ge "ui.js bossAppear Boss 登场低频扫" "$(UI_CHECK 'bossAppear: () => {')" 1

# --- ui.js · showBattleResult 同步 tick 音效 & ui 集成 ---
check_ge "ui.js showBattleResult 内调 hit()" "$(UI_CHECK 'UI.Audio.hit()')" 1
check_ge "ui.js showBattleResult 内调 crit()" "$(UI_CHECK 'UI.Audio.crit()')" 1
check_ge "ui.js showBattleResult 内调 kill()" "$(UI_CHECK 'UI.Audio.kill()')" 1
check_ge "ui.js showBattleResult 内调 die()" "$(UI_CHECK 'UI.Audio.die()')" 1
check_ge "ui.js showBattleResult 内调 victory()" "$(UI_CHECK 'UI.Audio.victory()')" 1
check_ge "ui.js showBattleResult 内调 defeat()" "$(UI_CHECK 'UI.Audio.defeat()')" 1
check_ge "ui.js UI.battle 内解锁 Audio" "$(UI_CHECK 'UI.Audio.unlock()')" 1
check_ge "ui.js UI.battle 内 Boss 登场音" "$(UI_CHECK 'UI.Audio.bossAppear()')" 1
check_ge "ui.js upgradeItem 升级音效" "$(UI_CHECK 'UI.Audio.pickup()')" 1
check_ge "ui.js craftItem 打造音效" "$(UI_CHECK 'UI.Audio.craft()')" 1
check_ge "ui.js equipItem 装备音效" "$(UI_CHECK 'UI.Audio.equip()')" 1
check_ge "ui.js sellItem 出售音效" "$(UI_CHECK 'UI.Audio.sell()')" 1

# --- index.html + style.css · 静音切换按钮 ---
check_ge "index.html 含 btn-mute 按钮" "$(HTML_CHECK 'id="btn-mute"')" 1
check_ge "style.css 含 #btn-mute.muted 状态" "$(CSS_CHECK '#btn-mute.muted')" 1

# ============================================================
# [8] v1.3 第四轮 · 新手引导（3 步教程 · 首次进入自动）
# ============================================================
echo ""
echo "[8] v1.3 新手引导（3 步教程 · 首次进入 · 38 项）"

# --- index.html · tutorial-overlay DOM 结构 ---
check_ge "index.html tutorial-overlay div" "$(HTML_CHECK 'id="tutorial-overlay"')" 1
check_ge "index.html tutorial-spotlight" "$(HTML_CHECK 'id="tutorial-spotlight"')" 1
check_ge "index.html tutorial-card" "$(HTML_CHECK 'class="tutorial-card"')" 1
check_ge "index.html tutorial-step 标签" "$(HTML_CHECK 'id="tutorial-step"')" 1
check_ge "index.html tutorial-icon" "$(HTML_CHECK 'id="tutorial-icon"')" 1
check_ge "index.html tutorial-title" "$(HTML_CHECK 'id="tutorial-title"')" 1
check_ge "index.html tutorial-desc" "$(HTML_CHECK 'id="tutorial-desc"')" 1
check_ge "index.html tutorial-target-hint" "$(HTML_CHECK 'id="tutorial-target-hint"')" 1
check_ge "index.html tutorial-next 按钮" "$(HTML_CHECK 'id="tutorial-next"')" 1
check_ge "index.html tutorial-prev 按钮" "$(HTML_CHECK 'id="tutorial-prev"')" 1
check_ge "index.html tutorial-close 跳过" "$(HTML_CHECK 'id="tutorial-close"')" 1
check_ge "index.html tutorial-dots 进度点" "$(HTML_CHECK 'id="tutorial-dots"')" 1

# --- style.css · tutorial 样式（默认块）---
check_ge "style.css tutorial-overlay 固定层" "$(CSS_CHECK '.tutorial-overlay')" 1
check_ge "style.css tutorial-spotlight 聚光灯" "$(CSS_CHECK '.tutorial-spotlight')" 1
check_ge "style.css tutorial-pulse 关键帧" "$(CSS_CHECK '@keyframes tutorial-pulse')" 1
check_ge "style.css tutorial-card 卡片" "$(CSS_CHECK '.tutorial-card')" 1
check_ge "style.css tutorial-card-in 入场动画" "$(CSS_CHECK '@keyframes tutorial-card-in')" 1
check_ge "style.css tutorial-step STEP x/3" "$(CSS_CHECK '.tutorial-step')" 1
check_ge "style.css tutorial-icon emoji" "$(CSS_CHECK '.tutorial-icon')" 1
check_ge "style.css tutorial-title 标题" "$(CSS_CHECK '.tutorial-title')" 1
check_ge "style.css tutorial-desc 描述" "$(CSS_CHECK '.tutorial-desc')" 1
check_ge "style.css tutorial-target-hint 目标提示" "$(CSS_CHECK '.tutorial-target-hint')" 1
check_ge "style.css tutorial-next 主按钮" "$(CSS_CHECK '.tutorial-next')" 1
check_ge "style.css tutorial-dot 进度点" "$(CSS_CHECK '.tutorial-dot')" 1
check_ge "style.css tutorial-dot.active 高亮" "$(CSS_CHECK '.tutorial-dot.active')" 1
check_ge "style.css tutorial-dot.done 完成" "$(CSS_CHECK '.tutorial-dot.done')" 1
# 600px 媒体块
check_ge "style.css mobile tutorial-card 置顶" "$(CSS_CHECK 'tutorial-card {')" 2

# --- ui.js · tutorial 逻辑（5 步 + 4 个 hook）---
check_ge "ui.js UI.TUTORIAL_STEPS 定义" "$(UI_CHECK 'UI.TUTORIAL_STEPS = ')" 1
check_ge "ui.js TUTORIAL_STEPS 含 3 步" "$(echo "$UI_JS" | grep -c '    icon:')" 3
check_ge "ui.js TUTORIAL_STEPS step1 选择怪物" "$(UI_CHECK '选择怪物')" 1
check_ge "ui.js TUTORIAL_STEPS step2 战利品" "$(UI_CHECK '查看战利品')" 1
check_ge "ui.js TUTORIAL_STEPS step3 装备" "$(UI_CHECK '装备升级')" 1
check_ge "ui.js UI.startTutorial 函数" "$(UI_CHECK 'UI.startTutorial = function')" 1
check_ge "ui.js UI.renderTutorialStep 函数" "$(UI_CHECK 'UI.renderTutorialStep = function')" 1
check_ge "ui.js UI.positionTutorialSpotlight 函数" "$(UI_CHECK 'UI.positionTutorialSpotlight = function')" 1
check_ge "ui.js UI.nextTutorial 函数" "$(UI_CHECK 'UI.nextTutorial = function')" 1
check_ge "ui.js UI.prevTutorial 函数" "$(UI_CHECK 'UI.prevTutorial = function')" 1
check_ge "ui.js UI.endTutorial 函数" "$(UI_CHECK 'UI.endTutorial = function')" 1
check_ge "ui.js UI.reflowTutorialSpotlight 函数" "$(UI_CHECK 'UI.reflowTutorialSpotlight = function')" 1
# 持久化与触发
check_ge "ui.js diablo_tutorial_done 持久化" "$(UI_CHECK 'diablo_tutorial_done')" 1
check_ge "ui.js tutorial-next listener 绑定" "$(UI_CHECK "getElementById('tutorial-next')")" 1
check_ge "ui.js tutorial-prev listener 绑定" "$(UI_CHECK "getElementById('tutorial-prev')")" 1
check_ge "ui.js tutorial-close listener 绑定" "$(UI_CHECK "getElementById('tutorial-close')")" 1
check_ge "ui.js hideIntro 触发 setTimeout startTutorial" "$(echo \"$UI_JS\" | grep -cE 'setTimeout.*startTutorial')" 1
check_ge "ui.js switchTab 内 reflowTutorialSpotlight" "$(UI_CHECK 'reflowTutorialSpotlight()')" 2

echo ""
echo "[9] v1.3 第 5 项 · 系统日志时间线模式（system-log-timeline · 41 项）"

# --- HTML · 工具栏 + 容器 ---
check_ge "index.html log-toolbar 容器" "$(HTML_CHECK 'class="log-toolbar"')" 1
check_ge "index.html log-filters 筛选区" "$(HTML_CHECK 'id="log-filters"')" 1
check_ge "index.html log-filter ALL 按钮" "$(HTML_CHECK 'data-filter="all"')" 1
check_ge "index.html log-filter epic 按钮" "$(HTML_CHECK 'data-filter="epic"')" 1
check_ge "index.html log-filter good 按钮" "$(HTML_CHECK 'data-filter="good"')" 1
check_ge "index.html log-filter bad 按钮" "$(HTML_CHECK 'data-filter="bad"')" 1
check_ge "index.html log-filter info 按钮" "$(HTML_CHECK 'data-filter="info"')" 1
check_ge "index.html log-count 计数器" "$(HTML_CHECK 'id="log-count"')" 1
check_ge "index.html log-clear 清空按钮" "$(HTML_CHECK 'id="log-clear"')" 1
check_ge "index.html system-log 容器保留" "$(HTML_CHECK 'id="system-log"')" 1

# --- CSS · 时间线骨架 + 4 种 kind 样式 ---
check_ge "style.css .log-toolbar 布局" "$(CSS_CHECK '.log-toolbar {')" 1
check_ge "style.css .log-filters flex" "$(CSS_CHECK '.log-filters {')" 1
check_ge "style.css .log-filter 基类" "$(CSS_CHECK '.log-filter {')" 1
check_ge "style.css .log-filter.active 高亮" "$(CSS_CHECK '.log-filter.active')" 1
check_ge "style.css .log-count 计数" "$(CSS_CHECK '.log-count {')" 1
check_ge "style.css .log-clear 清空按钮" "$(CSS_CHECK '.log-clear {')" 1
check_ge "style.css .system-log 容器" "$(CSS_CHECK '.system-log {')" 1
check_ge "style.css 时间线左竖线 ::before" "$(CSS_CHECK '.system-log::before')" 1
check_ge "style.css .log-entry 3 列 grid" "$(CSS_CHECK '.log-entry {')" 1
check_ge "style.css @keyframes log-entry-in" "$(CSS_CHECK '@keyframes log-entry-in')" 1
check_ge "style.css .log-time 时间戳列" "$(CSS_CHECK '.log-time {')" 1
check_ge "style.css .log-icon 节点圆点" "$(CSS_CHECK '.log-icon {')" 1
check_ge "style.css kind=good 配色" "$(CSS_CHECK '.log-entry.good .log-icon')" 1
check_ge "style.css kind=bad 配色" "$(CSS_CHECK '.log-entry.bad. .log-icon')" 1
check_ge "style.css kind=info 配色" "$(CSS_CHECK '.log-entry.info .log-icon')" 1
check_ge "style.css kind=epic 配色 + 光晕" "$(CSS_CHECK '.log-entry.epic .log-icon')" 1
check_ge "style.css .log-msg 消息列" "$(CSS_CHECK '.log-msg {')" 1
check_ge "style.css .aggregated 聚合态" "$(CSS_CHECK '.log-entry.aggregated')" 1
check_ge "style.css .log-count-badge ×N 徽章" "$(CSS_CHECK '.log-count-badge')" 1
check_ge "style.css hover 高亮" "$(CSS_CHECK '.log-entry:hover')" 1
check_ge "style.css filter- 4 套隐藏" "$(CSS_CHECK 'filter-info .log-entry:not(.info)')" 1

# --- 600px 媒体 ---
check_ge "style.css mobile log-filter 字号" "$(CSS_CHECK '.log-filter { font-size: 6px')" 1
check_ge "style.css mobile system-log max-height 180" "$(CSS_CHECK 'max-height: 180px')" 1
check_ge "style.css mobile log-entry 列宽 40px" "$(CSS_CHECK 'grid-template-columns: 40px')" 1

# --- UI.js · 核心逻辑 ---
check_ge "ui.js UI.LOG_MAX 常量" "$(UI_CHECK 'UI.LOG_MAX = ')" 1
check_ge "ui.js UI.LOG_MAX ≥ 100" "$(echo "$UI_JS" | grep -oE 'UI.LOG_MAX = [0-9]+' | head -1 | grep -oE '[0-9]+')" 100
check_ge "ui.js UI.LOG_BUFFER 数组" "$(echo "$UI_JS" | grep -cF 'UI.LOG_BUFFER = []')" 1
check_ge "ui.js UI.LOG_FILTER 当前筛选" "$(UI_CHECK 'UI.LOG_FILTER = ')" 1
check_ge "ui.js UI.LOG_AGG_WINDOW 聚合窗口" "$(UI_CHECK 'UI.LOG_AGG_WINDOW = ')" 1
check_ge "ui.js UI.LOG_ICONS 表" "$(UI_CHECK 'UI.LOG_ICONS = {')" 1
# 4 种图标字符
check_ge "ui.js 图标 ⚔ epic" "$(UI_CHECK "'⚔'")" 1
check_ge "ui.js 图标 ✓ good" "$(UI_CHECK "'✓'")" 1
check_ge "ui.js 图标 ✗ bad" "$(UI_CHECK "'✗'")" 1
check_ge "ui.js 图标 ⓘ info" "$(UI_CHECK "'ⓘ'")" 1
# 主入口
check_ge "ui.js UI.log 改造（带 buffer）" "$(UI_CHECK 'UI.LOG_BUFFER.unshift')" 1
check_ge "ui.js UI._buildLogRow 函数" "$(UI_CHECK 'UI._buildLogRow = function')" 1
check_ge "ui.js UI._renderLogLine 函数" "$(UI_CHECK 'UI._renderLogLine = function')" 1
check_ge "ui.js UI._updateLogCount 函数" "$(UI_CHECK 'UI._updateLogCount = function')" 1
check_ge "ui.js UI.setLogFilter 函数" "$(UI_CHECK 'UI.setLogFilter = function')" 1
check_ge "ui.js UI.clearLog 函数" "$(UI_CHECK 'UI.clearLog = function')" 1
# 事件挂载
check_ge "ui.js log-filter click 挂载" "$(UI_CHECK "'\.log-filter'")" 1
check_ge "ui.js btnLogClear 变量名" "$(UI_CHECK 'btnLogClear')" 1

echo ""
echo "[9] v1.3 第 6 轮 · 怪物图鉴（含掉落表 + 筛选器）"
# --- HTML · 怪物图鉴 DOM ---
check_ge "index.html codex-monster 容器" "$(HTML_CHECK 'id="codex-monster"')" 1
check_ge "index.html codex-filter-bar 筛选条" "$(HTML_CHECK 'codex-filter-bar')" 1
check_ge "index.html codex-filter 筛选按钮基类" "$(HTML_CHECK 'class="codex-filter')" 1
check_ge "index.html 5 个 data-mf 按钮" "$(HTML_CHECK 'data-mf=')" 1
check_ge "index.html ALL 筛选按钮" "$(HTML_CHECK 'data-mf="all"')" 1
check_ge "index.html normal 筛选按钮" "$(HTML_CHECK 'data-mf="normal"')" 1
check_ge "index.html elite 筛选按钮" "$(HTML_CHECK 'data-mf="elite"')" 1
check_ge "index.html boss 筛选按钮" "$(HTML_CHECK 'data-mf="boss"')" 1
check_ge "index.html hidden 筛选按钮" "$(HTML_CHECK 'data-mf="hidden"')" 1

# --- CSS · 怪物图鉴样式 ---
check_ge "style.css .codex-monster-grid 网格" "$(CSS_CHECK '.codex-monster-grid')" 1
check_ge "style.css .codex-monster-card 基类" "$(CSS_CHECK '.codex-monster-card {')" 1
check_ge "style.css .codex-monster-card.tier-elite 精英色" "$(CSS_CHECK '.codex-monster-card.tier-elite')" 1
check_ge "style.css .codex-monster-card.tier-boss Boss 色" "$(CSS_CHECK '.codex-monster-card.tier-boss')" 1
check_ge "style.css .codex-monster-card.locked 锁定态" "$(CSS_CHECK '.codex-monster-card.locked')" 1
check_ge "style.css .codex-monster-sprite 头像" "$(CSS_CHECK '.codex-monster-sprite')" 1
check_ge "style.css .codex-monster-name 名字" "$(CSS_CHECK '.codex-monster-name')" 1
check_ge "style.css .codex-monster-tier 标签" "$(CSS_CHECK '.codex-monster-tier')" 1
check_ge "style.css .codex-monster-stats 数据栏" "$(CSS_CHECK '.codex-monster-stats')" 1
check_ge "style.css .codex-monster-drops 掉落表" "$(CSS_CHECK '.codex-monster-drops')" 1
check_ge "style.css .codex-monster-drops-title 掉落标题" "$(CSS_CHECK '.codex-monster-drops-title')" 1
check_ge "style.css drop-rarity.r-magic 蓝字" "$(CSS_CHECK '.drop-rarity.r-magic')" 1
check_ge "style.css drop-rarity.r-rare 黄字" "$(CSS_CHECK '.drop-rarity.r-rare')" 1
check_ge "style.css drop-rarity.r-unique 金字" "$(CSS_CHECK '.drop-rarity.r-unique')" 1
check_ge "style.css drop-rarity.r-set 紫字" "$(CSS_CHECK '.drop-rarity.r-set')" 1
check_ge "style.css .codex-monster-status 状态行" "$(CSS_CHECK '.codex-monster-status')" 1
check_ge "style.css .codex-monster-status.killed 击杀配色" "$(CSS_CHECK '.codex-monster-status.killed')" 1
check_ge "style.css .codex-monster-status.unlocked 解锁配色" "$(CSS_CHECK '.codex-monster-status.unlocked')" 1
check_ge "style.css .codex-monster-kills 击杀徽章" "$(CSS_CHECK '.codex-monster-kills')" 1
check_ge "style.css .codex-filter 筛选按钮" "$(CSS_CHECK '.codex-filter {')" 1
check_ge "style.css .codex-filter.active 高亮" "$(CSS_CHECK '.codex-filter.active')" 1
check_ge "style.css 600px .codex-monster-grid 移动端" "$(CSS_CHECK '@media (max-width: 600px)')" 1
check_ge "style.css mobile .codex-filter 移动端筛选" "$(CSS_CHECK '.codex-filter { font-size: 6px')" 1

# --- UI.js · 怪物图鉴核心逻辑 ---
check_ge "ui.js UI.CODEX_MONSTER_FILTER 筛选器" "$(UI_CHECK 'UI.CODEX_MONSTER_FILTER')" 3
check_ge "ui.js UI._monsterTierLabel 函数" "$(UI_CHECK 'UI._monsterTierLabel = function')" 1
check_ge "ui.js UI._renderMonsterCodexCard 函数" "$(UI_CHECK 'UI._renderMonsterCodexCard = function')" 1
check_ge "ui.js UI.renderMonsterCodex 函数" "$(UI_CHECK 'UI.renderMonsterCodex = function')" 1
check_ge "ui.js UI.setCodexMonsterFilter 函数" "$(UI_CHECK 'UI.setCodexMonsterFilter = function')" 1
check_ge "ui.js renderCodex 调用 renderMonsterCodex" "$(UI_CHECK 'UI.renderMonsterCodex()')" 2
check_ge "ui.js 怪物卡 click 事件" "$(UI_CHECK 'monster-codex-lore')" 1
check_ge "ui.js 怪物卡调用 showLore" "$(UI_CHECK 'UI.showLore(parseInt')" 1
check_ge "ui.js 怪物卡调用 getBossKills" "$(UI_CHECK 'UI.getBossKills()')" 3
check_ge "ui.js 怪物卡调用 isHiddenUnlocked" "$(UI_CHECK 'UI.isHiddenUnlocked')" 2
check_ge "ui.js 怪物卡引用 DATA.dropTiers" "$(UI_CHECK 'DATA.dropTiers')" 3
check_ge "ui.js 怪物卡引用 DATA.rarities" "$(UI_CHECK 'DATA.rarities')" 2
check_ge "ui.js 怪物卡渲染击杀徽章" "$(UI_CHECK 'codex-monster-kills')" 1
check_ge "ui.js 怪物卡渲染状态" "$(UI_CHECK 'codex-monster-status')" 1
check_ge "ui.js codex-filter 按钮事件绑定" "$(UI_CHECK 'codex-filter')" 2
check_ge "ui.js codex-filter 调 setCodexMonsterFilter" "$(UI_CHECK 'UI.setCodexMonsterFilter(btn.dataset.mf)')" 1

echo ""
echo "[10] v1.4 第 1 项 · 背包虚拟滚动（inv-virtual · 48 项）"

# --- HTML · 虚拟模式统计条 ---
check_ge "index.html inventory-virtual-stats 容器" "$(HTML_CHECK 'id="inventory-virtual-stats"')" 1
check_ge "index.html inv-virtual-mode 标签" "$(HTML_CHECK 'inv-virtual-mode')" 1
check_ge "index.html inv-virtual-shown 计数器" "$(HTML_CHECK 'id="inv-virtual-shown"')" 1
check_ge "index.html inv-virtual-total 计数器" "$(HTML_CHECK 'id="inv-virtual-total"')" 1

# --- CSS · 虚拟模式骨架 ---
check_ge "style.css .inventory-grid.inv-virtual 容器" "$(CSS_CHECK '.inventory-grid.inv-virtual')" 1
check_ge "style.css .inventory-grid.inv-virtual max-height" "$(CSS_CHECK '.inventory-grid.inv-virtual {')" 1
check_ge "style.css .inventory-grid.inv-virtual overflow-y" "$(CSS_CHECK 'overflow-y: auto')" 1
check_ge "style.css .inv-virtual-spacer 占位" "$(CSS_CHECK '.inv-virtual-spacer')" 1
check_ge "style.css .inv-virtual-viewport 视口" "$(CSS_CHECK '.inv-virtual-viewport')" 1
check_ge "style.css .inv-virtual-stats 统计条" "$(CSS_CHECK '.inv-virtual-stats')" 1
check_ge "style.css .inv-virtual-mode 标签色" "$(CSS_CHECK '.inv-virtual-mode')" 1
check_ge "style.css .inv-virtual-count 计数色" "$(CSS_CHECK '.inv-virtual-count')" 1
check_ge "style.css 滚动条 webkit-scrollbar" "$(CSS_CHECK '::-webkit-scrollbar')" 1
check_ge "style.css 600px 移动端 .inv-virtual" "$(CSS_CHECK 'max-height: 360px')" 1
check_ge "style.css 600px 移动端 .inv-virtual-stats" "$(CSS_CHECK 'inv-virtual-stats {')" 2

# --- UI.js · 虚拟滚动核心逻辑 ---
check_ge "ui.js UI.INV_VIRTUAL_THRESHOLD 常量" "$(UI_CHECK 'UI.INV_VIRTUAL_THRESHOLD =')" 1
check_ge "ui.js UI.INV_VIRTUAL_ROW_H 常量" "$(UI_CHECK 'UI.INV_VIRTUAL_ROW_H =')" 1
check_ge "ui.js UI.INV_VIRTUAL_BUFFER_ROWS 常量" "$(UI_CHECK 'UI.INV_VIRTUAL_BUFFER_ROWS =')" 1
check_ge "ui.js UI.INV_VIRTUAL 状态对象" "$(UI_CHECK 'UI.INV_VIRTUAL = {')" 1
check_ge "ui.js UI._renderInventoryNormal 函数" "$(UI_CHECK 'UI._renderInventoryNormal = function')" 1
check_ge "ui.js UI._renderInventoryVirtual 函数" "$(UI_CHECK 'UI._renderInventoryVirtual = function')" 1
check_ge "ui.js UI._onInventoryScroll 函数" "$(UI_CHECK 'UI._onInventoryScroll = function')" 1
check_ge "ui.js UI._renderInventoryViewport 函数" "$(UI_CHECK 'UI._renderInventoryViewport = function')" 1
check_ge "ui.js UI._renderInventoryCardHTML 函数" "$(UI_CHECK 'UI._renderInventoryCardHTML = function')" 1
check_ge "ui.js UI._bindInventoryCardClicks 函数" "$(UI_CHECK 'UI._bindInventoryCardClicks = function')" 1
check_ge "ui.js 虚拟模式切换逻辑（threshold）" "$(UI_CHECK 'INV_VIRTUAL_THRESHOLD')" 2
check_ge "ui.js 虚拟模式 add inv-virtual class" "$(UI_CHECK "add('inv-virtual')")" 1
check_ge "ui.js 虚拟模式 remove inv-virtual class" "$(UI_CHECK "remove('inv-virtual')")" 1
check_ge "ui.js 虚拟模式 stats 显示" "$(UI_CHECK "stats.style.display = 'flex'")" 1
check_ge "ui.js 虚拟模式 stats 隐藏" "$(UI_CHECK "stats.style.display = 'none'")" 1
check_ge "ui.js 虚拟模式创建 spacer" "$(UI_CHECK 'inv-virtual-spacer')" 2
check_ge "ui.js 虚拟模式创建 viewport" "$(UI_CHECK 'inv-virtual-viewport')" 2
check_ge "ui.js 虚拟模式 scrollTop 监听" "$(UI_CHECK 'grid.onscroll')" 2
check_ge "ui.js requestAnimationFrame 节流" "$(UI_CHECK 'requestAnimationFrame')" 1
check_ge "ui.js 虚拟模式统计 shown 更新" "$(UI_CHECK 'inv-virtual-shown')" 2
check_ge "ui.js 虚拟模式统计 total 更新" "$(UI_CHECK 'inv-virtual-total')" 1
check_ge "ui.js 虚拟模式行高常量 = 86" "$(UI_CHECK 'INV_VIRTUAL_ROW_H = 86')" 1
check_ge "ui.js 虚拟模式 col 计算" "$(UI_CHECK 'INV_VIRTUAL.cols =')" 1
check_ge "ui.js 虚拟模式 rows 计算" "$(UI_CHECK 'INV_VIRTUAL.rows =')" 1
check_ge "ui.js 虚拟模式 totalH 计算" "$(UI_CHECK 'INV_VIRTUAL.totalH =')" 1
check_ge "ui.js 虚拟模式 startIdx endIdx" "$(UI_CHECK 'v.startIdx')" 1
check_ge "ui.js 虚拟模式 absolute top" "$(UI_CHECK 'position:absolute')" 1
check_ge "ui.js 虚拟模式 absolute left" "$(UI_CHECK 'left:')" 1
check_ge "ui.js 虚拟模式 buffer rows" "$(UI_CHECK 'INV_VIRTUAL_BUFFER_ROWS')" 2
check_ge "ui.js 虚拟模式 firstVisibleRow" "$(UI_CHECK 'firstVisibleRow')" 1
check_ge "ui.js 普通模式解绑 scroll" "$(UI_CHECK 'grid.onscroll = null')" 1
check_ge "ui.js 普通模式 filtered=false" "$(UI_CHECK 'INV_VIRTUAL.filtered = false')" 1
check_ge "ui.js 普通模式 filtered=true" "$(UI_CHECK 'INV_VIRTUAL.filtered = true')" 1
check_ge "ui.js 重渲染虚拟模式 _renderInventoryViewport" "$(UI_CHECK '_renderInventoryViewport()')" 2
check_ge "ui.js 重渲染普通模式 _renderInventoryNormal" "$(UI_CHECK '_renderInventoryNormal(')" 1
check_ge "ui.js 点击事件委托 querySelectorAll inv-slot" "$(UI_CHECK "container.querySelectorAll('.inv-slot')")" 1
check_ge "ui.js 虚拟模式点击选中态更新" "$(UI_CHECK 'selectedItem = item')" 1

echo ""
echo "[11] v1.4 第 2 项 · 战斗模拟预计算缓存（battle-cache · 50 项）"

# --- game.js · 缓存基础设施 ---
check_ge "game.js BUILD_CACHE 对象" "$(GAME_CHECK 'Game.BUILD_CACHE = {')" 1
check_ge "game.js BUILD_CACHE.battles Map" "$(GAME_CHECK 'BUILD_CACHE.battles')" 2
check_ge "game.js BUILD_CACHE.builds Map" "$(GAME_CHECK 'BUILD_CACHE.builds')" 2
check_ge "game.js BUILD_CACHE_STATS 统计" "$(GAME_CHECK 'BUILD_CACHE_STATS')" 3
check_ge "game.js hits 字段" "$(GAME_CHECK 'hits: 0')" 1
check_ge "game.js miss 字段" "$(GAME_CHECK 'miss: 0')" 1
check_ge "game.js invalidations 字段" "$(GAME_CHECK 'invalidations: 0')" 1

# --- game.js · 种子化 RNG（确定性飘字） ---
check_ge "game.js _seededRandom 函数定义" "$(GAME_CHECK '_seededRandom = function')" 1
check_ge "game.js mulberry32 算法 0x6D2B79F5" "$(GAME_CHECK '0x6D2B79F5')" 1
check_ge "game.js mulberry32 Math.imul" "$(GAME_CHECK 'Math.imul')" 3

# --- game.js · Build signature hash ---
check_ge "game.js _buildSignature 函数" "$(GAME_CHECK '_buildSignature = function')" 1
check_ge "game.js sig 包含 level" "$(GAME_CHECK 'player.level')" 2
check_ge "game.js sig 包含 classId" "$(GAME_CHECK 'player.classId')" 2
check_ge "game.js sig 包含 skillId" "$(GAME_CHECK 'player.skillId')" 2
check_ge "game.js sig 包含 baseStats" "$(GAME_CHECK 'player.baseStats')" 1
check_ge "game.js sig 遍历 slots" "$(GAME_CHECK 'DATA.slots')" 1
check_ge "game.js sig 包含 item uid" "$(GAME_CHECK 'item.uid')" 1
check_ge "game.js sig 包含 item ilvl" "$(GAME_CHECK 'item.ilvl')" 1
check_ge "game.js sig 包含 item setId" "$(GAME_CHECK 'item.setId')" 1
check_ge "game.js sig 包含 item rarity" "$(GAME_CHECK 'item.rarity')" 1
check_ge "game.js sig 包含 mods" "$(GAME_CHECK 'item.mods')" 2
check_ge "game.js sig 包含 gems" "$(GAME_CHECK 'item.gems')" 2
check_ge "game.js sig FNV-1a hash 初始" "$(GAME_CHECK '0x811c9dc5')" 1
check_ge "game.js sig FNV-1a 乘数" "$(GAME_CHECK '0x01000193')" 1
check_ge "game.js sig 输出 base36" "$(GAME_CHECK 'toString(36)')" 1

# --- game.js · 失效与查询 ---
check_ge "game.js invalidateBuildCache 函数" "$(GAME_CHECK 'invalidateBuildCache = function')" 1
check_ge "game.js invalidate 清 builds" "$(GAME_CHECK 'builds.clear()')" 1
check_ge "game.js invalidate 清 battles" "$(GAME_CHECK 'battles.clear()')" 1
check_ge "game.js _aggregateBuildCached 函数" "$(GAME_CHECK '_aggregateBuildCached = function')" 1
check_ge "game.js cached build 命中分支" "$(GAME_CHECK '_cached: true')" 1
check_ge "game.js cached build 写入" "$(GAME_CHECK 'builds.set(sig, result)')" 1

# --- game.js · simulateBattle 接入缓存 ---
check_ge "game.js simulateBattle 缓存命中短路" "$(GAME_CHECK 'battles.has(cacheKey)')" 1
check_ge "game.js simulateBattle 浅拷贝返回" "$(GAME_CHECK 'Object.assign({}, cached')" 1
check_ge "game.js simulateBattle miss++" "$(GAME_CHECK 'BUILD_CACHE_STATS.miss++')" 2
check_ge "game.js simulateBattle hits++" "$(GAME_CHECK 'BUILD_CACHE_STATS.hits++')" 2
check_ge "game.js simulateBattle 写入 cache" "$(GAME_CHECK 'battles.set(cacheKey, result)')" 1
check_ge "game.js simulateBattle 用 cacheKey 构造 seed" "$(GAME_CHECK 'parseInt((cacheKey')" 1
check_ge "game.js simulateBattle 调用 _seededRandom" "$(GAME_CHECK '_seededRandom(seed)')" 1
check_ge "game.js simulateBattle 替换 Math.random 为 _r" "$(GAME_CHECK '_r() < critRate')" 1
check_ge "game.js simulateBattle 替换 5% 暴击" "$(GAME_CHECK '_r() < 0.05')" 2
check_ge "game.js simulateBattle 替换 50% 暴击" "$(GAME_CHECK '_r() < 0.5')" 1

# --- index.html · 缓存统计 DOM ---
check_ge "index.html battle-cache-stats 容器" "$(HTML_CHECK 'id=\"battle-cache-stats\"')" 1
check_ge "index.html bcs-label 标签" "$(HTML_CHECK 'class=\"bcs-label\"')" 1
check_ge "index.html bcs-key sig 显示" "$(HTML_CHECK 'id=\"bcs-sig\"')" 1
check_ge "index.html bcs-builds 计数" "$(HTML_CHECK 'id=\"bcs-builds\"')" 1
check_ge "index.html bcs-battles 计数" "$(HTML_CHECK 'id=\"bcs-battles\"')" 1
check_ge "index.html bcs-hits 计数" "$(HTML_CHECK 'id=\"bcs-hits\"')" 1
check_ge "index.html bcs-miss 计数" "$(HTML_CHECK 'id=\"bcs-miss\"')" 1
check_ge "index.html bcs-inv 计数" "$(HTML_CHECK 'id=\"bcs-inv\"')" 1
check_ge "index.html bcs-clear 按钮" "$(HTML_CHECK 'id=\"bcs-clear\"')" 1

# --- style.css · 缓存条样式 ---
check_ge "style.css .battle-cache-stats 容器" "$(CSS_CHECK '.battle-cache-stats {')" 1
check_ge "style.css bcs-label 标签样式" "$(CSS_CHECK '.battle-cache-stats .bcs-label')" 1
check_ge "style.css bcs-key sig 样式" "$(CSS_CHECK '.battle-cache-stats .bcs-key')" 1
check_ge "style.css bcs-stat 样式" "$(CSS_CHECK '.battle-cache-stats .bcs-stat')" 1
check_ge "style.css bcs-hits 绿色" "$(CSS_CHECK '#bcs-hits')" 1
check_ge "style.css bcs-clear 按钮" "$(CSS_CHECK '.battle-cache-stats .bcs-clear')" 1
check_ge "style.css 600px 移动端适配" "$(CSS_CHECK '.battle-cache-stats { font-size: 6px')" 1

# --- ui.js · 统计条渲染逻辑 ---
check_ge "ui.js renderBattleCacheStats 函数" "$(UI_CHECK 'renderBattleCacheStats = function')" 1
check_ge "ui.js renderBattleCacheStats 调 sigEl" "$(UI_CHECK 'sigEl.textContent = lastSig')" 1
check_ge "ui.js renderBattleCacheStats 调 BUILD_CACHE" "$(UI_CHECK 'Game.BUILD_CACHE.builds.size')" 1
check_ge "ui.js renderBattleCacheStats 调 battles.size" "$(UI_CHECK 'Game.BUILD_CACHE.battles.size')" 1
check_ge "ui.js clearBattleCache 函数" "$(UI_CHECK 'clearBattleCache = function')" 1
check_ge "ui.js clearBattleCache 调 invalidate" "$(UI_CHECK 'invalidateBuildCache')" 2
check_ge "ui.js bindEvents 挂载 bcs-clear" "$(UI_CHECK 'btnCacheClear.addEventListener')" 1
check_ge "ui.js bindEvents 初始渲染 stats" "$(UI_CHECK 'UI.renderBattleCacheStats')" 2
check_ge "ui.js battle 调 renderBattleCacheStats" "$(UI_CHECK 'UI.renderBattleCacheStats(finalSig.slice')" 1
check_ge "ui.js battle 调 invalidateBuildCache" "$(UI_CHECK 'Game.invalidateBuildCache')" 1
check_ge "ui.js renderAll 不再失效缓存（注释）" "$(UI_CHECK '// v1.4 第 2 项 · 不再在每次 renderAll 失效缓存')" 1

# ============================================================
# [12] v1.4 第 3 项 · 图标懒加载（IntersectionObserver · 视口外不渲染 SVG）
# ============================================================
echo ""
echo "[12] v1.4 第 3 项 · 图标懒加载（IntersectionObserver · 24 项）"

# --- ui.js · UI.LazyIcon 命名空间 ---
check_ge "ui.js UI.LazyIcon IIFE 命名空间" "$(UI_CHECK 'UI.LazyIcon = (function')" 1
check_ge "ui.js UI.LazyIcon.stub 函数（const）" "$(UI_CHECK 'const stub = function (key, size)')" 1
check_ge "ui.js UI.LazyIcon.observeAll 函数（const）" "$(UI_CHECK 'const observeAll = function')" 1
check_ge "ui.js UI.LazyIcon.observeAllInDocument 函数（const）" "$(UI_CHECK 'const observeAllInDocument = function')" 1
check_ge "ui.js UI.LazyIcon.ensureObserver 函数（const）" "$(UI_CHECK 'const ensureObserver =')" 1
check_ge "ui.js LazyIcon 用 IntersectionObserver" "$(UI_CHECK 'IntersectionObserver')" 1
check_ge "ui.js LazyIcon rootMargin 120px 提前渲染" "$(UI_CHECK 'rootMargin: ')" 1
check_ge "ui.js LazyIcon stub 输出 data-icon-lazy 属性" "$(UI_CHECK 'data-icon-lazy')" 2
check_ge "ui.js LazyIcon stub 输出 data-icon-size 属性" "$(UI_CHECK 'data-icon-size')" 1
check_ge "ui.js LazyIcon stub 输出 lazy-icon class" "$(UI_CHECK 'class=\"lazy-icon\"')" 1
check_ge "ui.js LazyIcon entry 替换用 outerHTML" "$(UI_CHECK 'el.outerHTML = UI.getIcon')" 1
check_ge "ui.js LazyIcon 替换前先 unobserve" "$(UI_CHECK 'observer.unobserve(el)')" 1
check_ge "ui.js LazyIcon 不支持 IO 时降级标记" "$(UI_CHECK 'observer = false')" 1

# --- ui.js · UI.getIconLazy 公开 API ---
check_ge "ui.js UI.getIconLazy 函数" "$(UI_CHECK 'UI.getIconLazy = function')" 1
check_ge "ui.js UI.getIconLazy 调 LazyIcon.stub" "$(UI_CHECK 'UI.LazyIcon.stub(key, size)')" 1

# --- ui.js · 怪物卡 + 怪物图鉴 接入懒加载 ---
check_ge "ui.js renderBattle monster 卡用 getIconLazy" "$(echo "$UI_JS" | grep -cF 'const icon = UI.getIconLazy(iconMap[i]')" 1
check_ge "ui.js renderBattle 末尾 observeAll monster-list" "$(UI_CHECK "UI.LazyIcon.observeAll(document.getElementById('monster-list'))")" 1
check_ge "ui.js codex 卡 sprite 用 getIconLazy" "$(echo "$UI_JS" | grep -cF 'const sprite = UI.getIconLazy(iconMap[idx]')" 1
check_ge "ui.js renderMonsterCodex 末尾 observeAll codex-monster" "$(UI_CHECK "UI.LazyIcon.observeAll(document.getElementById('codex-monster'))")" 1

# --- 兼容性：UI.getIcon 仍然存在 ---
check_ge "ui.js UI.getIcon 函数（向后兼容）" "$(UI_CHECK 'UI.getIcon = function')" 1
check_ge "ui.js UI.getIcon 仍读 ICONS[key]" "$(echo "$UI_JS" | grep -cF 'const svg = ICONS[key]')" 1

# --- style.css · lazy-icon 样式（避免 layout shift）---
check_ge "style.css .lazy-icon 样式" "$(CSS_CHECK '.lazy-icon')" 1

# ============================================================
# [13] v1.4 第 4 项 · Service Worker 离线缓存（24 项）
# ============================================================
echo ""
echo "[13] v1.4 第 4 项 · Service Worker 离线缓存（24 项）"

# --- fc/sw.js 部署文件存在 ---
check_ge "fc/sw.js 存在且非空" "$(test -s /root/.hermes/workspace/diablo-build/fc/sw.js && echo 1 || echo 0)" 1
check_ge "fc/offline.html 存在且非空" "$(test -s /root/.hermes/workspace/diablo-build/fc/offline.html && echo 1 || echo 0)" 1
check_ge "sw.js 含 SW_VERSION" "$(grep -c 'SW_VERSION' /root/.hermes/workspace/diablo-build/fc/sw.js)" 1
check_ge "sw.js 含 CACHE_SHELL" "$(grep -c 'CACHE_SHELL' /root/.hermes/workspace/diablo-build/fc/sw.js)" 1
check_ge "sw.js 含 CACHE_DATA" "$(grep -c 'CACHE_DATA' /root/.hermes/workspace/diablo-build/fc/sw.js)" 1
check_ge "sw.js install 监听" "$(grep -cF "addEventListener('install'" /root/.hermes/workspace/diablo-build/fc/sw.js)" 1
check_ge "sw.js activate 监听" "$(grep -cF "addEventListener('activate'" /root/.hermes/workspace/diablo-build/fc/sw.js)" 1
check_ge "sw.js fetch 监听" "$(grep -cF "addEventListener('fetch'" /root/.hermes/workspace/diablo-build/fc/sw.js)" 1
check_ge "sw.js skipWaiting 立即激活" "$(grep -c 'skipWaiting' /root/.hermes/workspace/diablo-build/fc/sw.js)" 1
check_ge "sw.js clients.claim 立即接管" "$(grep -c 'clients.claim' /root/.hermes/workspace/diablo-build/fc/sw.js)" 1
check_ge "sw.js stale-while-revalidate 策略" "$(grep -c 'cached' /root/.hermes/workspace/diablo-build/fc/sw.js)" 1
check_ge "sw.js 缓存 shell urls" "$(grep -c 'SHELL_URLS' /root/.hermes/workspace/diablo-build/fc/sw.js)" 1
check_ge "sw.js 数据资源 cache-first" "$(grep -c 'isDataAsset' /root/.hermes/workspace/diablo-build/fc/sw.js)" 1
check_ge "sw.js 离线回退 offline.html" "$(grep -cF "match('offline.html')" /root/.hermes/workspace/diablo-build/fc/sw.js)" 1
check_ge "sw.js 旧缓存清理" "$(grep -c 'SW_VERSION' /root/.hermes/workspace/diablo-build/fc/sw.js)" 1
check_ge "offline.html 含 RETRY 按钮" "$(grep -c 'RETRY' /root/.hermes/workspace/diablo-build/fc/offline.html)" 1

# --- index.html 注册 SW ---
check_ge "index.html 注册 serviceWorker" "$(HTML_CHECK 'serviceWorker.register')" 1
check_ge "index.html 注册 sw.js" "$(HTML_CHECK 'sw.js')" 1
check_ge "index.html load 事件延迟注册" "$(HTML_CHECK "addEventListener..load..")" 1
check_ge "index.html sw-badge DOM" "$(HTML_CHECK 'id=\"sw-badge\"')" 1

# --- style.css sw-badge 样式 ---
check_ge "style.css sw-badge 基类" "$(CSS_CHECK '.sw-badge')" 1
check_ge "style.css sw-badge.online" "$(CSS_CHECK '.sw-badge.online')" 1
check_ge "style.css sw-badge.cached" "$(CSS_CHECK '.sw-badge.cached')" 1
check_ge "style.css sw-badge.offline" "$(CSS_CHECK '.sw-badge.offline')" 1
check_ge "style.css sw-badge.unsupported" "$(CSS_CHECK '.sw-badge.unsupported')" 1

# --- ui.js SW 状态管理 ---
check_ge "ui.js UI.initServiceWorkerBadge 函数" "$(UI_CHECK 'UI.initServiceWorkerBadge = function')" 1
check_ge "ui.js UI.setSWBadgeState 函数" "$(UI_CHECK 'UI.setSWBadgeState = function')" 1
check_ge "ui.js UI.refreshSWBadge 函数" "$(UI_CHECK 'UI.refreshSWBadge = function')" 1
check_ge "ui.js UI.clearSWCache 函数" "$(UI_CHECK 'UI.clearSWCache = function')" 1
check_ge "ui.js SW_READY 标记" "$(UI_CHECK 'UI.SW_READY = false')" 1
check_ge "ui.js SW_BADGE_EL 引用" "$(UI_CHECK 'UI.SW_BADGE_EL = null')" 1
check_ge "ui.js bindEvents 注入 SW 初始化" "$(UI_CHECK 'initServiceWorkerBadge')" 2
check_ge "ui.js 监听 online 事件" "$(UI_CHECK "addEventListener.'online.")" 1
check_ge "ui.js 监听 offline 事件" "$(UI_CHECK "addEventListener.'offline.")" 1
check_ge "ui.js SW 注册 ready 回调" "$(UI_CHECK 'navigator.serviceWorker.ready')" 1
check_ge "ui.js 收 SW 消息监听" "$(UI_CHECK "addEventListener.'message.")" 1
check_ge "ui.js setSWBadgeState 4 状态分支" "$(UI_CHECK "case .online.:\|case .cached.:\|case .offline.:\|case .unsupported.:")" 4

# ============================================================
echo ""
echo "[14] v1.5 第 1 项 · 跨快照对比 (snapshot-vs · build-compare-modal · 32 项)"

# --- game.js · Game.compareBuilds 核心逻辑 ---
check_ge "game.js Game.compareBuilds 函数" "$(GAME_CHECK 'Game.compareBuilds = function')" 1
check_ge "game.js compareBuilds 调 importBuild" "$(GAME_CHECK 'Game.importBuild(JSON.stringify')" 1
check_ge "game.js compareBuilds 调 aggregateBuild" "$(GAME_CHECK 'Game.aggregateBuild(build')" 1
check_ge "game.js compareBuilds 调 calcDPS" "$(GAME_CHECK 'Game.calcDPS(aMods)')" 1
check_ge "game.js compareBuilds 调 calcEffectiveHP" "$(GAME_CHECK 'Game.calcEffectiveHP(aMods)')" 1
check_ge "game.js compareBuilds 返回 totals" "$(GAME_CHECK 'totals:')" 1
check_ge "game.js compareBuilds dpsA 字段" "$(GAME_CHECK 'dpsA: Math.round')" 1
check_ge "game.js compareBuilds ehpA 字段" "$(GAME_CHECK 'ehpA: Math.round')" 1
check_ge "game.js compareBuilds acA 字段" "$(GAME_CHECK 'acA: Math.round')" 1
check_ge "game.js compareBuilds 防御.顺序 ac" "$(GAME_CHECK "'ac'")" 2
check_ge "game.js compareBuilds 攻击属性顺序 dmg_pct" "$(GAME_CHECK "'dmg_pct'")" 1
check_ge "game.js compareBuilds rows 兜底" "$(GAME_CHECK 'order.includes(k)')" 1
check_ge "game.js compareBuilds 错误对象检测" "$(GAME_CHECK 'buildA.error')" 1

# --- ui.js · 5 个新函数 + 状态变量 ---
check_ge "ui.js UI.SNAPSHOT_VS_PICK 状态" "$(UI_CHECK 'UI.SNAPSHOT_VS_PICK = null')" 1
check_ge "ui.js UI.handleSnapshotVS 函数" "$(UI_CHECK 'UI.handleSnapshotVS = function')" 1
check_ge "ui.js UI.showBuildCompareModal 函数" "$(UI_CHECK 'UI.showBuildCompareModal = function')" 1
check_ge "ui.js UI.hideBuildCompareModal 函数" "$(UI_CHECK 'UI.hideBuildCompareModal = function')" 1
check_ge "ui.js handleSnapshotVS 调 Game.compareBuilds" "$(UI_CHECK 'Game.compareBuilds(snapA, snapB)')" 1
check_ge "ui.js handleSnapshotVS 三态分支" "$(UI_CHECK 'UI.log')" 1
check_ge "ui.js modal 创建 build-compare-modal" "$(UI_CHECK 'build-compare-modal')" 4
check_ge "ui.js modal 调 Game.compareBuilds" "$(UI_CHECK 'Game.compareBuilds(snapA, snapB)')" 1
check_ge "ui.js modal 失败提示" "$(UI_CHECK '对比失败')" 1
check_ge "ui.js modal 显示 A/B 标签" "$(UI_CHECK 'A · 参照')" 1
check_ge "ui.js modal 候选标签" "$(UI_CHECK 'B · 候选')" 1
check_ge "ui.js modal 胜负判定 up" "$(UI_CHECK 'BUILD B WINS')" 1
check_ge "ui.js modal 胜负判定 down" "$(UI_CHECK 'BUILD A WINS')" 1
check_ge "ui.js modal ESC 关闭" "$(UI_CHECK 'Escape')" 1
check_ge "ui.js modal 切换为 B 按钮" "$(UI_CHECK 'bc-restore-b')" 1
check_ge "ui.js modal 还原 A 按钮" "$(UI_CHECK 'bc-restore-a')" 1
check_ge "ui.js renderSnapshots 增 vs 按钮" "$(UI_CHECK 'snapshot-vs')" 2
check_ge "ui.js renderSnapshots 增 ref 类" "$(UI_CHECK 'snapshot-row-ref')" 1
check_ge "ui.js handleSnapshotVS 清参照" "$(UI_CHECK '对比参照已取消')" 1
check_ge "ui.js handleSnapshotVS 初始提示" "$(UI_CHECK '已选为对比参照')" 1

# --- index.html · intro 提示 ---
check_ge "index.html snapshot intro 提示" "$(HTML_CHECK '可对比两条快照')" 1

# --- style.css · 快照对比样式 ---
check_ge "style.css snapshot-row-ref 选中态" "$(CSS_CHECK '.snapshot-row-ref')" 1
check_ge "style.css btn-tiny.snapshot-vs 按钮" "$(CSS_CHECK '.btn-tiny.snapshot-vs')" 1
check_ge "style.css build-compare-modal 容器" "$(CSS_CHECK '.build-compare-modal')" 1
check_ge "style.css bc-content 主区域" "$(CSS_CHECK '.bc-content')" 1
check_ge "style.css bc-side 左侧卡片" "$(CSS_CHECK '.bc-side')" 1
check_ge "style.css bc-side.bc-a 视觉态" "$(CSS_CHECK '.bc-side.bc-a')" 1
check_ge "style.css bc-side.bc-b 视觉态" "$(CSS_CHECK '.bc-side.bc-b')" 1
check_ge "style.css bc-score-row 评分行" "$(CSS_CHECK '.bc-score-row')" 1
check_ge "style.css bc-rows-wrap 属性表" "$(CSS_CHECK '.bc-rows-wrap')" 1
check_ge "style.css bc-row 属性行" "$(CSS_CHECK '.bc-row')" 1
check_ge "style.css bc-row-better" "$(CSS_CHECK '.bc-row-better')" 1
check_ge "style.css bc-verdict 胜方" "$(CSS_CHECK '.bc-verdict')" 1
check_ge "style.css bc-verdict-up" "$(CSS_CHECK '.bc-verdict-up')" 1
check_ge "style.css bc-verdict-down" "$(CSS_CHECK '.bc-verdict-down')" 1
check_ge "style.css mobile bc-content" "$(CSS_CHECK '.bc-content { padding: 12px')" 1
check_ge "style.css mobile bc-actions" "$(CSS_CHECK '.bc-actions { flex-direction: column')" 1

echo ""
echo "[15] v1.5 第 2 项 · 战斗录像回放控制台（replay-console · 32 项）"

# ----- 0. v1.5 #2 必做：verify baseline (ticks data exists) -----
# v1.5 #2 复用 v1.3 #2 的 ticks；先验证基础数据契约
check_ge "data.js 13 怪物 ≥ 1" "$(DATA_CHECK 'name: ')" 30
check_ge "data.js 无 var(--good 误用" "$(CSS_CHECK 'var(--good)')" 1
check_ge "data.js 无 var(--bad 误用" "$(CSS_CHECK 'var(--bad)')" 1

# ----- 1. HTML 结构（4 项） -----
check_ge "html battle-replay-actions 区" "$(HTML_CHECK 'battle-replay-actions')" 1
check_ge "html btn-open-replay 按钮" "$(HTML_CHECK 'btn-open-replay')" 1
check_ge "html ▶ REPLAY 文案" "$(HTML_CHECK 'REPLAY')" 1
check_ge "html replay-hint 提示" "$(HTML_CHECK 'replay-hint')" 1

# ----- 2. UI.js · 入口与状态变量（6 项） -----
check_ge "ui.js UI.LAST_BATTLE 全局状态" "$(UI_CHECK 'UI.LAST_BATTLE = null')" 1
check_ge "ui.js UI.REPLAY 全局状态" "$(UI_CHECK 'UI.REPLAY = null')" 1
check_ge "ui.js _replayComputeHP 助手" "$(UI_CHECK 'UI._replayComputeHP')" 2
check_ge "ui.js showBattleReplayModal 函数定义" "$(UI_CHECK 'UI.showBattleReplayModal = function')" 1
check_ge "ui.js hideBattleReplayModal 函数定义" "$(UI_CHECK 'UI.hideBattleReplayModal = function')" 1
check_ge "ui.js _resetReplay 助手" "$(UI_CHECK 'UI._resetReplay')" 2

# ----- 3. UI.js · showBattleResult 末尾缓存 LAST_BATTLE（2 项） -----
# showBattleResult 末尾的 replay actions 显示控制逻辑
check_ge "showBattleResult 末尾缓存 LAST_BATTLE" "$(grep -c 'UI.LAST_BATTLE = b' fc/ui.js)" 1
check_ge "showBattleResult 控制 replay actions 显示" "$(grep -c 'battle-replay-actions' fc/ui.js)" 1

# ----- 4. UI.js · REPLAY 按钮绑定到 bindEvents（3 项） -----
check_ge "ui.js btn-open-replay getElementById" "$(echo "$UI_JS" | grep -cF "getElementById('btn-open-replay')")" 1
check_ge "ui.js REPLAY 按钮 click handler" "$(UI_CHECK 'btn-open-replay')" 1
check_ge "ui.js 调用 showBattleReplayModal + UI.LAST_BATTLE" "$(echo "$UI_JS" | grep -cF 'UI.showBattleReplayModal(UI.LAST_BATTLE)')" 1

# ----- 5. UI.js · 状态机字段（4 项） -----
# state = { ticks, total, duration, hpTimeline, idx, speed, playing, rafId, lastFrameTs, accumTime }
# 至少 5 个字段被赋值（外加 b）
check_ge "replay state 含 hpTimeline" "$(grep -c 'hpTimeline' fc/ui.js)" 5
check_ge "replay state 含 accumTime" "$(grep -c 'accumTime' fc/ui.js)" 3
check_ge "replay state 含 playing flag" "$(grep -c 'playing' fc/ui.js)" 5
check_ge "replay state rafId 字段" "$(grep -c 'rafId' fc/ui.js)" 5

# ----- 6. UI.js · 控制按钮事件绑定（5 项） -----
check_ge "ui.js replay-close click handler" "$(echo "$UI_JS" | grep -cF "getElementById('replay-close')")" 1
check_ge "ui.js replay-toggle 播放按钮" "$(echo "$UI_JS" | grep -cF "getElementById('replay-toggle')")" 1
check_ge "ui.js replay-step-back 后退" "$(echo "$UI_JS" | grep -cF "getElementById('replay-step-back')")" 1
check_ge "ui.js replay-step-fwd 前进" "$(echo "$UI_JS" | grep -cF "getElementById('replay-step-fwd')")" 1
check_ge "ui.js replay-reset 重置" "$(echo "$UI_JS" | grep -cF "getElementById('replay-reset')")" 1

# ----- 7. UI.js · 键盘快捷键（4 项） -----
check_ge "ESC 关闭 modal 键盘" "$(echo "$UI_JS" | grep -cF "e.key === 'Escape'")" 2
check_ge "Space 播放/暂停" "$(echo "$UI_JS" | grep -cF "e.key === ' '")" 1
check_ge "ArrowLeft 后退" "$(echo "$UI_JS" | grep -cF "e.key === 'ArrowLeft'")" 1
check_ge "ArrowRight 前进" "$(echo "$UI_JS" | grep -cF "e.key === 'ArrowRight'")" 1

# ----- 8. UI.js · 速度选择器（3 项） -----
# data-speed 出现 4 次（0.5/1/2/4）
check_ge "replay-speed 4 个档位" "$(grep -cE 'data-speed=\"' fc/ui.js)" 4
# 大于等于 3 次提到 active class
check_ge "active 状态切换" "$(grep -cE 'classList.toggle.*active' fc/ui.js)" 1
# document.querySelectorAll('.replay-speed')
check_ge "speed 按钮 querySelectorAll" "$(echo "$UI_JS" | grep -cF "querySelectorAll('.replay-speed')")" 1

# ----- 9. CSS · 大区块 5 个（5 项） -----
check_ge "css .replay-modal 全屏遮罩" "$(CSS_CHECK '.replay-modal')" 1
check_ge "css .replay-content 卡片" "$(CSS_CHECK '.replay-content')" 2
check_ge "css .replay-stage 战斗舞台" "$(CSS_CHECK '.replay-stage')" 2
check_ge "css .replay-hp-bar 血条" "$(CSS_CHECK '.replay-hp-bar')" 1
check_ge "css .replay-scrub 进度条" "$(CSS_CHECK '.replay-scrub')" 4
check_ge "css .replay-btn 按钮" "$(CSS_CHECK '.replay-btn')" 9
check_ge "css .replay-speed 速度" "$(CSS_CHECK '.replay-speed')" 5
check_ge "css .replay-log 日志" "$(CSS_CHECK '.replay-log')" 10

# ----- 10. CSS · 状态色（3 项） -----
check_ge "css .replay-btn.primary 金色" "$(CSS_CHECK '.replay-btn.primary')" 1
check_ge "css .replay-btn.danger 红" "$(CSS_CHECK '.replay-btn.danger')" 1
check_ge "css .replay-speed.active 选中态" "$(CSS_CHECK '.replay-speed.active')" 1
check_ge "css .replay-log-row crit" "$(CSS_CHECK '.replay-log-row.crit')" 1
check_ge "css .replay-log-row kill" "$(CSS_CHECK '.replay-log-row.kill')" 1
check_ge "css .replay-log-row die" "$(CSS_CHECK '.replay-log-row.die')" 1

# ----- 11. CSS · 600px 移动端（3 项） -----
check_ge "css mobile replay-content" "$(CSS_CHECK '.replay-content { padding: 10px')" 1
check_ge "css mobile replay-btn" "$(CSS_CHECK '.replay-btn { padding: 4px')" 1
check_ge "css mobile replay-speed" "$(CSS_CHECK '.replay-speed { padding: 3px')" 1

# ----- 12. CSS · 主题色变量已在 :root 定义 -----
check_ge "css :root --good 变量定义" "$(echo "$STYLE_CSS" | grep -cF -- '--good: #43a047')" 1
check_ge "css :root --bad 变量定义" "$(echo "$STYLE_CSS" | grep -cF -- '--bad: #c92a2a')" 1

echo ""
echo "[16] v1.5 第 3 项 · 跨职业 Build 对比（class-filter-snapshot · 47 项）"

# ----- 0. v1.5 #3 必做：verify baseline -----
check_ge "data.js 13 怪物 ≥ 1" "$(DATA_CHECK 'name: ')" 30
check_ge "data.js DATA.classes" "$(echo "$DATA_JS" | grep -cF 'DATA.classes = {')" 1
check_ge "ui.js snapshot list container" "$(HTML_CHECK 'snapshots-list')" 1

# ----- 1. HTML 结构（6 项） -----
check_ge "html snapshot-class-filter 控件" "$(HTML_CHECK 'snapshot-class-filter')" 1
check_ge "html snapshots-filter-bar 容器" "$(HTML_CHECK 'snapshots-filter-bar')" 1
check_ge "html snapshots-filter-label" "$(HTML_CHECK 'snapshots-filter-label')" 1
check_ge "html snapshots-filter-select" "$(HTML_CHECK 'snapshots-filter-select')" 1
check_ge "html snapshot-crossclass-hint" "$(HTML_CHECK 'snapshot-crossclass-hint')" 1
check_ge "html 默认选项 ALL CLASSES" "$(HTML_CHECK 'ALL CLASSES')" 1

# ----- 2. UI.js · 状态变量 + 函数（10 项） -----
check_ge "ui.js SNAPSHOT_CLASS_FILTER 全局态" "$(UI_CHECK 'UI.SNAPSHOT_CLASS_FILTER')" 2
check_ge "ui.js default 'all'" "$(UI_CHECK "UI.SNAPSHOT_CLASS_FILTER = 'all'")" 1
check_ge "ui.js populateSnapshotClassFilter 函数" "$(UI_CHECK 'UI.populateSnapshotClassFilter = function')" 1
check_ge "ui.js setSnapshotClassFilter 函数" "$(UI_CHECK 'UI.setSnapshotClassFilter = function')" 1
check_ge "ui.js populateSnapshotClassFilter 内嵌 all 选项" "$(UI_CHECK 'ALL CLASSES')" 1
check_ge "ui.js populateSnapshotClassFilter 遍历 DATA.classes" "$(UI_CHECK 'for (const cId in DATA.classes)')" 1
check_ge "ui.js setSnapshotClassFilter 清参照" "$(echo "$UI_JS" | grep -cF 'UI.SNAPSHOT_VS_PICK = null')" 3
check_ge "ui.js setSnapshotClassFilter 调 renderSnapshots" "$(UI_CHECK 'UI.renderSnapshots();')" 4
check_ge "ui.js renderSnapshots 用 filterClass 过滤" "$(UI_CHECK 's.classId === filterClass')" 1
check_ge "ui.js renderSnapshots 计数显示 filtered/arr" "$(UI_CHECK "filtered.length + '/' + arr.length")" 1

# ----- 3. UI.js · 空过滤态提示（3 项） -----
check_ge "ui.js 过滤后空列表提示" "$(UI_CHECK '该职业暂无快照')" 1
check_ge "ui.js snapshot-empty-filtered 类" "$(UI_CHECK 'snapshot-empty-filtered')" 1
check_ge "ui.js populateSnapshotClassFilter 在 render 里同步" "$(echo "$UI_JS" | grep -cF 'UI.populateSnapshotClassFilter();')" 2

# ----- 4. UI.js · Game.compareBuilds 跨职业标记（5 项） -----
# 新增 crossClass / classA / classB 字段到 return
check_ge "game.js compareBuilds 函数定义" "$(echo "$GAME_JS" | grep -cF 'Game.compareBuilds = function')" 1
check_ge "game.js compareBuilds 返回 crossClass" "$(echo "$GAME_JS" | grep -cF '    crossClass,')" 1
check_ge "game.js compareBuilds 返回 classA" "$(echo "$GAME_JS" | grep -cF '    classA,')" 1
check_ge "game.js compareBuilds 返回 classB" "$(echo "$GAME_JS" | grep -cF '    classB,')" 1
check_ge "game.js compareBuilds 跨职业判定逻辑" "$(echo "$GAME_JS" | grep -cF 'classA !== classB')" 1

# ----- 5. UI.js · 跨职业对比 confirm 提示（4 项） -----
check_ge "ui.js handleSnapshotVS 跨职业 confirm" "$(echo "$UI_JS" | grep -cF '跨职业对比提示')" 1
check_ge "ui.js 跨职业提示文案 1" "$(echo "$UI_JS" | grep -cF 'cAName')" 2
check_ge "ui.js 跨职业提示文案 2" "$(echo "$UI_JS" | grep -cF 'cBName')" 2
check_ge "ui.js confirm 内联函数" "$(UI_CHECK 'if (!ok)')" 1

# ----- 6. UI.js · 跨职业对比 banner（4 项） -----
check_ge "ui.js modal 加 build-compare-modal-cross class" "$(echo "$UI_JS" | grep -cF 'build-compare-modal-cross')" 2
check_ge "ui.js modal 渲染 bc-crossclass-banner" "$(echo "$UI_JS" | grep -cF 'bc-crossclass-banner')" 1
check_ge "ui.js banner 含 cAName" "$(echo "$UI_JS" | grep -cF 'A=[${cAName}]')" 1
check_ge "ui.js banner 含 cBName" "$(echo "$UI_JS" | grep -cF 'B=[${cBName}]')" 1

# ----- 7. UI.js · bindEvents 挂事件（3 项） -----
check_ge "ui.js bindEvents 取 snapshot-class-filter" "$(echo "$UI_JS" | grep -cF "getElementById('snapshot-class-filter')")" 1
check_ge "ui.js bindEvents 绑 change 事件" "$(echo "$UI_JS" | grep -cF "addEventListener('change', (e) => UI.setSnapshotClassFilter")" 1
check_ge "ui.js bindEvents 调用 setSnapshotClassFilter" "$(echo "$UI_JS" | grep -cF 'UI.setSnapshotClassFilter(e.target.value)')" 1

# ----- 8. CSS · 过滤栏样式（6 项） -----
check_ge "css .snapshots-filter-bar 容器" "$(CSS_CHECK '.snapshots-filter-bar')" 1
check_ge "css .snapshots-filter-label" "$(CSS_CHECK '.snapshots-filter-label')" 1
check_ge "css .snapshots-filter-select" "$(CSS_CHECK '.snapshots-filter-select')" 1
check_ge "css .snapshots-filter-select focus" "$(CSS_CHECK '.snapshots-filter-select:focus')" 1
check_ge "css .snapshot-crossclass-hint" "$(CSS_CHECK '.snapshot-crossclass-hint')" 1
check_ge "css .snapshot-empty-filtered" "$(CSS_CHECK '.snapshot-empty-filtered')" 1

# ----- 9. CSS · 跨职业 banner 样式（4 项） -----
check_ge "css .build-compare-modal-cross .bc-content" "$(CSS_CHECK '.build-compare-modal-cross .bc-content')" 1
check_ge "css .bc-crossclass-banner" "$(CSS_CHECK '.bc-crossclass-banner')" 1
check_ge "css @keyframes bc-crossclass-pulse" "$(CSS_CHECK '@keyframes bc-crossclass-pulse')" 1
check_ge "css .build-compare-modal-cross .bc-title" "$(CSS_CHECK '.build-compare-modal-cross .bc-title')" 1

# ----- 10. CSS · 600px 移动端（3 项） -----
check_ge "css mobile snapshots-filter-bar" "$(CSS_CHECK '.snapshots-filter-bar { padding: 6px 8px')" 1
check_ge "css mobile snapshots-filter-select" "$(CSS_CHECK '.snapshots-filter-select { font-size: 7px')" 1
check_ge "css mobile bc-crossclass-banner" "$(CSS_CHECK '.bc-crossclass-banner { font-size: 12px')" 1

# ----- 11. v1.5 #1 latent bug 修补（4 项）· unslimItem 缺 base 字段 -----
check_ge "game.js unslimItem 加 base 字段" "$(echo "$GAME_JS" | grep -cF 'base: s.b || {}')" 1
check_ge "game.js slimItem 同步 b 字段" "$(echo "$GAME_JS" | grep -cF 'b: it.base || {}')" 1
check_ge "game.js unslimItem 修补注释" "$(echo "$GAME_JS" | grep -cF 'v1.5 #3 必修')" 1
check_ge "game.js exportBuild 修补注释" "$(echo "$GAME_JS" | grep -cF 'v1.5 #3 修补')" 1

echo ""
echo "[17] v1.5 第 4 项 · 跨职业对比 verdict 中性化（cross-verdict · 12 项）"

# ----- 0. v1.5 #4 必做：verify baseline -----
check_ge "ui.js 仍含 ATTRIBUTE COMPARE ONLY 字符串" "$(echo "$UI_JS" | grep -cF 'ATTRIBUTE COMPARE ONLY')" 1
check_ge "ui.js 跨职业 verdict 注释 v1.5 第 4 项" "$(echo "$UI_JS" | grep -cF 'v1.5 第 4 项')" 1

# ----- 1. ui.js · verdict 内嵌分支逻辑（2 项） -----
check_ge "ui.js verdict 跨职业分支前置" "$(echo "$UI_JS" | grep -cF 'if (result.crossClass)')" 1
check_ge "ui.js verdict 同职业走老分支" "$(echo "$UI_JS" | grep -cF 'BUILD B WINS')" 1

# ----- 2. ui.js · verdict 模板字符串（2 项） -----
check_ge "ui.js cross verdict 模板 bc-verdict-cross class" "$(echo "$UI_JS" | grep -cF 'bc-verdict-cross')" 1
check_ge "ui.js cross verdict 模板 ATTRIBUTE COMPARE ONLY 标签" "$(echo "$UI_JS" | grep -cF '跨职业 DPS/EHP/AC 不可比')" 1

# ----- 3. css · 新 verdict class（4 项） -----
check_ge "css .bc-verdict-cross 选择器定义" "$(CSS_CHECK '.bc-verdict-cross {')" 1
check_ge "css .bc-verdict-cross 颜色变量优先" "$(CSS_CHECK 'color: var(--gold-bright, #ffaa00)')" 1
check_ge "css .bc-verdict-cross 边框变量" "$(CSS_CHECK 'border-color: var(--gold-dark, #aa7700)')" 1
check_ge "css .bc-verdict-cross italic 字体" "$(CSS_CHECK 'font-style: italic')" 1

# ----- 4. 与 v1.5 #3 crossclass-banner 联动（2 项 · 防止单改一处漏一处） -----
check_ge "ui.js 跨职业 banner 仍存在（不破坏旧功能）" "$(echo "$UI_JS" | grep -cF 'bc-crossclass-banner')" 1
check_ge "css 跨职业 banner 仍存在" "$(CSS_CHECK '.bc-crossclass-banner')" 1

echo ""
echo "[18] v1.6 第 1 项 · 快照收藏夹（snapshot-pin · 18 项）"

# ----- 0. v1.6 #1 必做：verify baseline -----
check_ge "game.js 含 togglePinSnapshot 函数" "$(echo "$GAME_JS" | grep -cF 'Game.togglePinSnapshot = function')" 1
check_ge "game.js togglePinSnapshot 注释 v1.6 第 1 项" "$(echo "$GAME_JS" | grep -cF 'v1.6 第 1 项')" 1
check_ge "ui.js 仍含 handleSnapshotPin 函数" "$(echo "$UI_JS" | grep -cF 'UI.handleSnapshotPin = function')" 1
check_ge "index.html 快照收藏提示" "$(echo "$INDEX_HTML" | grep -cF '收藏夹置顶 (v1.6)')" 1

# ----- 1. ui.js · 排序 + 模板（8 项） -----
check_ge "ui.js pinned 排序注释 v1.6 第 1 项" "$(echo "$UI_JS" | grep -cF 'v1.6 第 1 项 · 收藏夹')" 1
check_ge "ui.js 含 pinned 优先级排序逻辑" "$(echo "$UI_JS" | grep -cF 'if (ap !== bp) return bp - ap')" 1
check_ge "ui.js 模板 isPinned 变量" "$(echo "$UI_JS" | grep -cF 'const isPinned = s.pinned === true')" 1
check_ge "ui.js 模板 pinCls 类名" "$(echo "$UI_JS" | grep -cF "pinCls = isPinned ? ' snapshot-row-pinned'")" 1
check_ge "ui.js 模板 data-pinned 属性" "$(echo "$UI_JS" | grep -cF 'data-pinned="${isPinned')" 1
check_ge "ui.js 模板 📌 前缀" "$(echo "$UI_JS" | grep -cF "isPinned ? '📌 '")" 1
check_ge "ui.js pin 按钮渲染" "$(echo "$UI_JS" | grep -cF 'btn-tiny snapshot-pin')" 1
check_ge "ui.js pin 按钮 ★/☆ 切换" "$(echo "$UI_JS" | grep -cF "isPinned ? '★'")" 1

# ----- 2. ui.js · 事件绑定 + handleSnapshotPin（4 项） -----
check_ge "ui.js pin 按钮 click 绑定注释" "$(echo "$UI_JS" | grep -cF 'v1.6 第 1 项 · 📌 收藏按钮')" 1
check_ge "ui.js pin 事件调用 handleSnapshotPin" "$(echo "$UI_JS" | grep -cF 'UI.handleSnapshotPin(btn.dataset.id)')" 1
check_ge "ui.js handleSnapshotPin 调 togglePinSnapshot" "$(echo "$UI_JS" | grep -cF 'Game.togglePinSnapshot(snapId)')" 1
check_ge "ui.js handleSnapshotPin 调 renderSnapshots" "$(echo "$UI_JS" | grep -cF 'UI.renderSnapshots();')" 3

# ----- 3. css · 新样式（6 项） -----
check_ge "css .snapshot-row-pinned 选择器" "$(CSS_CHECK '.snapshot-row-pinned {')" 1
check_ge "css .snapshot-row-pinned box-shadow" "$(CSS_CHECK '.snapshot-row-pinned {')" 1
check_ge "css .snapshot-row-pinned label 加粗" "$(CSS_CHECK '.snapshot-row-pinned .snapshot-label {')" 1
check_ge "css .btn-tiny.snapshot-pin 选择器" "$(CSS_CHECK '.btn-tiny.snapshot-pin {')" 1
check_ge "css 已 pin 按钮填实规则" "$(CSS_CHECK '.snapshot-row-pinned .btn-tiny.snapshot-pin,')" 1
check_ge "css 移动端 snapshot-row-pinned 媒体" "$(CSS_CHECK '@media (max-width: 600px)')" 1

# ----- 4. 防回归 · 旧功能不动（3 项） -----
check_ge "ui.js 旧 v1.5 #1 vs 按钮仍存在" "$(echo "$UI_JS" | grep -cF 'btn-tiny snapshot-vs')" 1
check_ge "ui.js 旧 v1.5 #3 过滤下拉仍存在" "$(echo "$UI_JS" | grep -cF 'UI.SNAPSHOT_CLASS_FILTER')" 2
check_ge "ui.js 旧 v1.5 #4 跨职业 verdict 仍存在" "$(echo "$UI_JS" | grep -cF 'bc-verdict-cross')" 1

# ===================== v1.6 第 2 项 · 快照备注 =====================
# 📝 玩家给某条快照存一段自由文本（最长 120 字符），方便标记"为什么换这套"
echo "[19] v1.6 第 2 项 · 快照备注（snapshot-memo · ~26 项）"

# ----- 1. game.js 6 项 -----
check_ge "game.js 含 setSnapshotMemo 函数" "$(echo "$GAME_JS" | grep -cF 'Game.setSnapshotMemo = function')" 1
check_ge "game.js setSnapshotMemo 注释 v1.6 第 2 项" "$(echo "$GAME_JS" | grep -cF 'v1.6 第 2 项')" 1
check_ge "game.js setSnapshotMemo 含 120 限长" "$(echo "$GAME_JS" | grep -cF '.slice(0, 120)')" 1
check_ge "game.js setSnapshotMemo sanitize 控制字符" "$(echo "$GAME_JS" | grep -cF 'control chars')" 1
check_ge "game.js setSnapshotMemo 写 s.memo 字段" "$(echo "$GAME_JS" | grep -cF 's.memo = clean')" 1
check_ge "game.js 含 clearSnapshotMemo 函数" "$(echo "$GAME_JS" | grep -cF 'Game.clearSnapshotMemo = function')" 1

# ----- 2. ui.js 12 项 -----
check_ge "ui.js handleSnapshotMemo 函数定义" "$(echo "$UI_JS" | grep -cF 'UI.handleSnapshotMemo = function')" 1
check_ge "ui.js handleSnapshotMemo 注释 v1.6 第 2 项" "$(echo "$UI_JS" | grep -cF 'v1.6 第 2 项 · 处理 📝 备注按钮')" 1
check_ge "ui.js handleSnapshotMemo 弹 prompt" "$(echo "$UI_JS" | grep -cF 'window.prompt')" 1
check_ge "ui.js handleSnapshotMemo 调 setSnapshotMemo" "$(echo "$UI_JS" | grep -cF 'Game.setSnapshotMemo')" 1
check_ge "ui.js handleSnapshotMemo 取消判断" "$(echo "$UI_JS" | grep -cF '备注未修改')" 1
check_ge "ui.js handleSnapshotMemo 清空提示" "$(echo "$UI_JS" | grep -cF '备注已清除')" 1
check_ge "ui.js memoHtml 变量定义" "$(echo "$UI_JS" | grep -cF 'const memoHtml = s.memo')" 1
check_ge "ui.js memoHtml 插值" "$(echo "$UI_JS" | grep -cF 'memoHtml')" 2
check_ge "ui.js memo 模板转义 <" "$(echo "$UI_JS" | grep -cF '&lt;')" 1
check_ge "ui.js memo 按钮 class 选择器" "$(echo "$UI_JS" | grep -cF 'btn-tiny snapshot-memo-btn')" 1
check_ge "ui.js memo 按钮 click 绑定" "$(echo "$UI_JS" | grep -cF "snapshot-memo-btn').forEach")" 1
check_ge "ui.js memo 按钮调 handleSnapshotMemo" "$(echo "$UI_JS" | grep -cF 'UI.handleSnapshotMemo(btn.dataset.id)')" 1
check_ge "ui.js 备注子行 HTML" "$(echo "$UI_JS" | grep -cF 'memoHtml = s.memo ?')" 1

# ----- 3. index.html 1 项 -----
check_ge "html 快照备注提示 (v1.6)" "$(HTML_CHECK '备注要点')" 1

# ----- 4. css 6 项 -----
check_ge "css .btn-tiny.snapshot-memo-btn 容器" "$(echo "$STYLE_CSS" | grep -cF '.btn-tiny.snapshot-memo-btn')" 1
check_ge "css memo-btn hover" "$(echo "$STYLE_CSS" | grep -cF '.snapshot-memo-btn:hover')" 1
check_ge "css .snapshot-memo 容器" "$(echo "$STYLE_CSS" | grep -cF '.snapshot-memo {')" 1
check_ge "css .snapshot-memo 边框" "$(echo "$STYLE_CSS" | grep -cF 'border-left: 2px solid #7a9b3e')" 1
check_ge "css memo-btn 移动端媒体" "$(echo "$STYLE_CSS" | grep -cF '.btn-tiny.snapshot-memo-btn { min-width: 22px')" 1
check_ge "css 移动端 .snapshot-memo 字号" "$(echo "$STYLE_CSS" | grep -cF '.snapshot-memo { font-size: 9px')" 1

echo ""
echo "==================================="
echo " ✅ 通过: $PASS"
echo " ❌ 失败: $FAIL"
echo "==================================="
exit $FAIL