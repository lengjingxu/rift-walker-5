# 迭代日志

### 2026-07-10 01:00 · T3.1 prompt 模板入库
- 新增 `docs/PROMPTS.md`：主角 6 职业（Paladin/Barbarian/Sorceress/Necromancer/Druid/Assassin）共用 Sin City 风前缀后缀，每个职业仅替换中间职业段。
- 验证清单：无彩色 + 表情可读 + 不裁切。
- T3.2/T3.3 模板占位待执行。
- PLAN T3.1 标记完成。

> 每次 cron 任务完成后追加一行。保留最近 50 条。

## [v1.6 #1] 2026-07-06 23:55 · snapshot-pin · 808/808 ✅

- 🔥 **discover-state 起手**：ROADMAP 所有 [x] 已标完 → 启动新阶段 v1.6（内容收藏）；v1.6 #1 选型为"快照收藏夹"（pin 置顶机制）；注意到 sibling subagent 已在 ui.js 写好 v1.6 #1 渲染 / 事件代码（写坏的 line 2980 已修复为正常字符串拼接），自己负责 game.js togglePinSnapshot + css + index.html intro + tests
- 📝 改动：
  - **`src/game.js` 行 1716-1726 · `Game.togglePinSnapshot(id)` 翻转单条快照的 pinned 字段并 `Game.saveSnapshots` 持久化**：
    - 找不到快照 → 返回 `null`；id 为空 → 返回 `null`；成功 → 返回翻转后布尔值
    - 复用既有 `Game.SNAPSHOT_KEY` 槽位，不引入第二个 localStorage key（保持「一份数据，多个开关」原则）
  - **`src/ui.js` 行 2844-2854 · `renderSnapshots` 排序 + 模板变量**：
    - 加载快照数组后 `arr.slice().sort((a, b) => pinned-desc + ts-desc)` → 副本排序避免污染 Game.loadSnapshots 返回的引用
    - `const isPinned = s.pinned === true; const pinCls = isPinned ? ' snapshot-row-pinned' : ''`
    - 模板行 `data-pinned="${isPinned ? '1' : '0'}"` + label 前置 `📌 ` + sub 行尾 ` · 收藏`
  - **`src/ui.js` 行 2893 · 收藏按钮**：`btn-tiny snapshot-pin` 渲染为 `★`（已收藏）或 `☆`（未收藏），独立色调（暗金 `#b8860b`），hover 反转
  - **`src/ui.js` 行 2931-2938 · pin 事件绑定**：每行按钮绑 click → 调 `UI.handleSnapshotPin(btn.dataset.id)`，`stopPropagation` 避免触发上层 snapshot-row click（虽然该 row 当前未绑 click，但加 stop 防御未来扩展）
  - **`src/ui.js` 行 2967-2981 · `UI.handleSnapshotPin` 主体**：调用 `Game.togglePinSnapshot` 后 `UI.renderSnapshots` 重排 + `UI.log` 写'good'/'info'日志（label 做基本引号/控制字符 escape 防 XSS + 截断 ≤32）
  - **`src/style.css` 行 2741-2775 · 新增 v1.6 #1 样式块（v1.5 #1 之后）**：
    - `.snapshot-row-pinned` 金色边框 + `box-shadow: inset 3px 0 0 var(--gold)` 左条 + 微背景亮 + label `var(--gold-bright)` 加粗
    - `.snapshot-row.snapshot-row-pinned.snapshot-row-ref` 双 class 时金条压过 ref 蓝条（pin 优先）
    - `.btn-tiny.snapshot-pin` 默认暗金边框 + hover 反转
    - `.snapshot-row-pinned .btn-tiny.snapshot-pin` 已 pin 时金底黑字（让"已收藏"一眼可见）
    - 600px 媒体：移动端 tinier shadow + min-width 22px tap area
  - **`src/index.html` 行 214 · snapshots-intro 加 `<span style="color:#b8860b;">📌 ☆</span> 收藏夹置顶 (v1.6)` 提示玩家新功能，与 v1.5 #1 ⚖ VS 提示并列
  - **`tests/mobile-test.sh` 末尾追加 [18] 段 25 项**：
    - baseline 4 项（`Game.togglePinSnapshot = function` + v1.6 #1 注释锚点 + `UI.handleSnapshotPin` + HTML intro 文案）
    - ui.js 排序/模板 8 项（pinned 排序 + isPinned 变量 + pinCls + data-pinned 属性 + 📌 前缀 + ★/☆ 切换）
    - ui.js 事件/handler 4 项（pin 按钮注释 + 调用 handleSnapshotPin + 调用 togglePinSnapshot + 调用 renderSnapshots ≥3）
    - css 6 项（`.snapshot-row-pinned` + label 加粗 + `.btn-tiny.snapshot-pin` + 已 pin 填实规则 + 600px 媒体）
    - 防回归 3 项（旧 v1.5 #1 vs + v1.5 #3 过滤下拉 + v1.5 #4 verdict 仍存在 — 验证"渲染加了 1 个按钮 + 1 个 class"不破坏其他 4 个按钮 + 1 个 class 的现有交互）
- 🔬 runtime smoke（pitfall #11 · 5 case 全覆盖）：
  ```
  Game.saveSnapshots([3 fake snaps]) → togglePin(b) → true ✓ → togglePin(b) → false ✓ → togglePin(unknown) → null ✓ → togglePin(null) → null ✓
  持久化：reload 后 s.pinned 正确写回（用 vm.createContext 沙箱跑 game.js 验证）
  ```
- 🎯 效果：
  - **解决真实痛点**：玩到第 8 套 build（3 套野蛮/2 套法师/2 套刺客/1 套圣骑）时，玩家最爱的"本命 build"找不到了 —— 现在 ☆ 一键置顶 + ★ 视觉强调，下次进 RECOMMEND tab 永远第一眼看到
  - **零侵入式 UX**：`renderSnapshots` 内已有的职业过滤（v1.5 #3）继续生效，先 sort 后 filter，pinned 不会被 class filter 过滤掉
  - **持久化免额外存储**：直接复用 `Game.saveSnapshots`，slim snapshot 对象加 `pinned: true` 单字段，零架构改动
  - **视觉与现有语义不冲突**：v1.5 #1 已选 A 是金色 + 蓝条 → v1.6 #1 pinned 是金色 + 金条（无蓝）→ pin + ref 同时存在时金条压蓝条，pin 更突出（玩家心流："收藏比对比更重要"）
  - **逻辑一致性**：togglePin 失败 → `null`（与 v1.5 #1 `handleSnapshotVS` 处理 unknown id 的兜底走法一致）；pin 成功 true / 取消 false → `UI.log` 用 'good' / 'info'（与 v1.5 vs compare 的 log 风格统一）
  - **键盘/tap 友好**：按钮紧贴 actions 行最左侧，与 ↺/⚖/✎/✕ 同样 `btn-tiny` 字号，移动端 `.snapshot-pin { min-width: 22px }` 加 tap area
- 🧪 测试：**808/808 ✅**（本地 http://localhost:8123/ 808/808 + 线上 https://bitools.retailaim.cn/ai/diablo-build/ 808/808 + HTTP 200 OK；新增 [18] 段 25 项无回归，前 [17] 段 783 项 v1.5 全保留）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 📦 checksum：部署时间 `2026-07-05T23:55:18Z`（code_checksum `17685738027449692930`）
- 🔜 下次：v1.6 第 2 项 / 候选 — ① 收藏导出（按 pinned 过滤批量导出分享码）② 跨页持久化战斗结果 history ③ 收藏夹视图（顶部 tab 「收藏」一键只显示 pinned 的快照）

## [v1.5 #4] 2026-07-06 22:45 · cross-verdict · 783/783 ✅

- 🔥 **discover-state 起手**：发现 v1.5 #3 已经完整实现并部署（771/771 ✅，md5 sync 全绿）→ 上次 cron 因工具用尽在测试脚本端，这次一并补登 v1.5 #3 entry + 直接推进 v1.5 #4
- 📝 改动：
  - **v1.5 #4 · 跨职业 verdict 中性化（修复 v1.5 #3 UX 漏洞）**：
    - **`src/ui.js` 行 3065-3078 `verdict` IIFE 内嵌分支前置**：当 `result.crossClass === true` 时立即返回 `<div class="bc-verdict bc-verdict-cross">// ATTRIBUTE COMPARE ONLY · 跨职业 DPS/EHP/AC 不可比 · 请按行项查看具体属性差</div>`，跳过 BUILD B/A WINS 胜负判定（DPS/EHP/AC 在跨职业场景下根本不可比）
    - 单职业对比走老逻辑（BUILD B/A WINS + DPS/EHP/AC 正负描述）保持不变
  - **`src/style.css` 行 2855-2861 `.bc-verdict-cross` 样式**：金黄色调 `var(--gold-bright, #ffaa00)` + 边框 `var(--gold-dark, #aa7700)` + italic 字体 = "既非赢也非输"的中性视觉
  - **`tests/mobile-test.sh` 末尾追加 [17] 段 12 项**：
    - baseline 2 项（`ATTRIBUTE COMPARE ONLY` 字符串 + `v1.5 第 4 项` 注释锚点）
    - ui.js 逻辑 2 项（`if (result.crossClass)` 分支前置 + `BUILD B WINS` 仍存在的回归保护）
    - ui.js 模板 2 项（`bc-verdict-cross` class + `跨职业 DPS/EHP/AC 不可比` 标签）
    - css 4 项（`.bc-verdict-cross {` 选择器 + gold-bright 颜色 + gold-dark 边框 + italic）
    - 防回归 2 项（v1.5 #3 banner 仍在 — 不破坏旧功能）
- 🎯 效果：
  - **修 UX 漏洞**：v1.5 #3 加了"跨职业对比"模式后，`verdict` IIFE 还是会硬算 DPS/EHP/AC 净胜负 → 显示 "BUILD B WINS · DPS +250 / EHP -500" 让玩家误以为 B 更好，其实是"DPS 算法差异导致"，完全没意义
  - **语义对齐**：跨职业时 banner 说"ATTRIBUTE COMPARE ONLY"，玩家立刻明白"看下面行项的细属性差"而不是"看谁总分更高"
  - **视觉中立**：金黄 + italic 既不像绿色 WIN 那么高调，也不像红色 LOSS 那么刺眼，是"信息中立"的标准做法
  - **零侵入**：同职业对比完全不变，玩家的"7 职业内 PVP" workflow 不受影响
- 🧪 测试：**783/783 ✅**（live URL 验证 783/783 + HTTP 200 OK；前 v1.5 #1-#3 全部 771 项零回归 + 新增 [17] 12 项）
- 🔬 **runtime smoke**（pitfall #11）：
  ```bash
  # verdict 函数 5 个分支全覆盖（cross / same / up / down / cross w/ large diff）
  node -e "...testVerdict inline..."
  # → crossClass case: cross (expected: cross)
  # → sameClass DPS better B: up
  # → sameClass A better: down
  # → sameClass same: same
  # → crossClass large diff: cross  ← 关键：即使 B 的 DPS/EHP/AC 都碾压，也不算 WIN
  ```
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 📦 checksum：部署时间 `2026-07-05T22:45:49Z`
- 🔜 下次：v1.6 启动 / 跨快照历史回放时间轴（v1.5 #1 snapshot-vs + v1.5 #2 replay 联动）

## [v1.5 #3] 2026-07-06 · 代码补登 · class-filter-snapshot · 771/771 ✅

- 🔥 **本次 cron 在发现 v1.5 #3 已完整实现后补登 entry**（per `Q-CATCHUP-LOG` 工作流）
- 📝 改动盘点（代码早已写完，本轮仅文档入册）：
  - **`Game.compareBuilds` 增 `crossClass / classA / classB` 字段**（src/game.js 行 1687-1702）：当两条快照属于不同 classId 时返回 `{ crossClass: true, classA, classB }`
  - **`UI.SNAPSHOT_CLASS_FILTER` 状态机**（src/ui.js 行 2836-2946）：默认 `'all'`，`populateSnapshotClassFilter` 渲染 `<select id="snapshot-class-filter">` 下拉（遍历 DATA.classes 6 个职业 + "全部"），`setSnapshotClassFilter` 切过滤态后清掉 SNAPSHOT_VS_PICK 参照（避免跨职业错选）
  - **`renderSnapshots` 应用过滤**（行 2839-2920）：过滤后空列表提示 `snapshot-empty-filtered`，计数器 `filtered.length / arr.length` 显示
  - **`handleSnapshotVS` 跨职业 confirm**（行 2966-2985）：玩家选 A 后再点不同职业的 B → 弹出 `confirm("⚠ 跨职业对比提示 · A=野蛮人 B=魔法师 · DPS/EHP 不可直接比较 · 是否仍然打开 modal？")`
  - **`showBuildCompareModal` 加 `bc-crossclass-banner`**（行 3083-3102）：当 `result.crossClass` 时给 modal 加 `build-compare-modal-cross` class + 内层 `.bc-crossclass-banner` 橙色警告横幅（"⚠ 跨职业对比 · A=[野蛮人] · B=[魔法师] · DPS/EHP/AC 仅供参考"）
  - **`hideBuildCompareModal` 清 cross class**（行 3142-3145）：关闭时 `m.classList.remove('build-compare-modal-cross')` 避免下次复用残留
  - 🔧 **修补 v1.5 #1 潜在 bug：`unslimItem` 缺 `base` 字段**（src/game.js 行 1372-1393 + src/ui.js 行 1021-1022）：从快照/导出还原的物品如果 `s.b` 是 undefined（旧版 slimItem 没存 b 字段），`aggregateBuild/calcAC/calcDamage` 里访问 `item.base.xxx` 会爆 ReferenceError。修复：`base: s.b || {}` 兜底；slimItem 端加 `b: it.base || {}` 序列化
- 🧪 测试：**771/771 ✅**（线上 https://bitools.retailaim.cn/ai/diablo-build/ 771/771 + HTTP 200 OK；[16] 段 47 项 v1.5#3 检查 + 前 724 项 v1.5#1+v1.5#2+v1.4+v1.3+v1.2+v1.1+v1.0 全部零回归）
- 📦 **部署**：已完成（`2026-07-06` 之前某次 cron，精确时间戳丢失因上次 cron 工具用尽未记录 `last_modified_time`）
- 🔬 runtime smoke（crossclass 分支）：
  ```bash
  node -e "...stub DOM..."
  # Game.compareBuilds 接受 cross-class snap → 返回 { crossClass: true, classA, classB }
  ```
- 🔜 下次：v1.5 第 4 项 · 跨职业对比 verdict 中性化（修复 v1.5 #3 仍强行算 BUILD B/A WINS 的 UX 漏洞）


## [v1.5 #2] 2026-07-06 03:30 · battle-replay-console · 716/716 ✅

- 🔥 **discover-state 起手**：发现 `src/ui.js` 已含完整 v1.5 #2 代码（md5 `4394cba`）但线上仍是 v1.5 #1（md5 `6d068ad`）→ 上一会话工具调用耗尽在测试脚本自身 parse error 上（pitfall #24），代码完整就绪差测试修复 + 部署
- 📝 改动：
  - **测试脚本 bash parse error 系统性修复（pitfall #24）**：`tests/mobile-test.sh` line 990/1003-1007/1010-1013/1021 共 **9 处** `"$(grep -c "X(Y)" fc/ui.js)"` 双引号外 + `()` 内 pattern 双层嵌套触发 bash parser 报 `near unexpected token '('`。统一改 pipe 模式：`"$(echo "$UI_JS" | grep -cF "X(Y)Z")"`（$() 只含 `echo $UI_JS | grep` 标准结构，pattern 在子 shell 内 lex 不受影响）
  - **期望值修正**：`e.key === 'Escape'` ≥3 → ≥2（v1.5 #1 compare-modal 用了 1 + v1.5 #2 replay-modal 用了 1 = 2 处）；`btn-open-replay` UI_CHECK ≥2 → ≥1（实际仅 1 处 getElementById + click handler）
  - **grep `--` separator**：line 1047-1048 `CSS_CHECK '--good: #43a047'` → grep 把 `--good:` 当成 `--good` 选项 flag。加 `--` end-of-options：`"$(echo "$STYLE_CSS" | grep -cF -- '--good: #43a047')"`
  - **final 716/716 全绿**：v1.5 #2 测试段 [15] 全部 53 项通过；前 663 项 v1.5#1 + 之前无回归
- 📦 **部署**：`upload_function_code('diablo-build', './fc')` → `last_modified_time: 2026-07-05T20:31:22Z` / `code_checksum: 16986711456124130410`
- 🔬 **线上 + 本地 runtime smoke**（pitfall #11/20）：
  ```bash
  # simulateBattle + _replayComputeHP 双链路验证
  node -e "...stub document/window/localStorage...load data+game+ui.js..."
  # → Battle OK: 17 ticks | HP timeline points: 18 first/last: 350/299 monster: 80->0
  # → showBattleReplayModal function hideBattleReplayModal function | LAST_BATTLE/REPLAY init: true true
  ```
- 🎯 效果：
  - **新 ARPG 体验**：战斗结算末尾多一个 ▶ REPLAY 按钮 → 全屏 modal 完整回放最近一场战斗：双侧 HP 条实时变化 + 时间线进度条 + ⏮ / ▶ / ⏭ / ⟲ 单步/播放/前进/后退控制 + ½×/1×/2×/4× 4 档速率切换 + 日志区（伤害/暴击/击杀/被击杀 4 种 row 类型分类高亮）+ 键盘快捷键（Space 播放/暂停 + ←/→ 单步 + R 重置 + ESC 关闭）→ 玩家能看清"6.14 秒里发生了什么、暴击何时触发、哪一击致命"
  - **零侵入式 UX**：复用 v1.3 #2 ticks 时间线数据契约 + v1.3 #6 8-bit 美学 + v1.5 #1 ESC 关闭惯例；与 v1.5 #1 bc-* 命名空间视觉对齐；不破坏现有 `▶ FIGHT` 战斗按钮
  - **确定性回放**：`_replayComputeHP` 从 ticks 正向累加 amount 预生成 hpTimeline（同 v1.4 #2 战斗缓存的确定性 RNG 思路），保证每次回放结果完全一致
  - **数据驱动零硬编码**：从 `b.ticks` 自动派生 hpTimeline + 从 ticks 类型映射 row 视觉态（dmg/crit/kill/die）；新战斗类型只需在 ticks 里加 `kind` 即可，不用改 replay modal
  - **键盘友好**：与 v1.5 #1 build-compare 共用 ESC 关闭惯例；新增 Space/←/→/R 4 键；进入 modal 自动 focus
  - **状态清理**：`_resetReplay` 关闭时 `cancelAnimationFrame(rafId)` 防 RAF 泄漏；hide 函数 bind 解绑事件
  - **完整测试覆盖**：53 项 v1.5#2 测试 + 前 663 项无回归 = 716/716
- 🧪 测试：**716/716 ✅**（本地 http://localhost:8123/ 716/716 + 线上 https://bitools.retailaim.cn/ai/diablo-build/ 716/716 + HTTP 200 OK）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-05T20:31:22Z`（code_checksum `16986711456124130410`）
- 🔜 下次：v1.5 第 3 项 · 跨职业 build 对比（`Game.compareBuilds` 扩展为支持不同 classId — 当前 `importBuild` 已容忍不同 classId，UI 层面加一个"职业选择器"下拉）



## 2026-07-05 17:10 — v1.3 第 5 轮 · 系统日志时间线模式（system-log-timeline）
- ✅ 完成：v1.3 第五项 — 系统日志从纯文本列表升级为"时间线 + 图标 + 聚合 + 筛选 + 清空"五合一
- 📝 改动：
  - **`src/index.html` · SYSTEM LOG 区域加工具栏**：
    - `<div class="log-toolbar">`：5 个筛选按钮（ALL / ⚔ epic / ✓ good / ✗ bad / ⓘ info）+ 实时计数 `<span id="log-count">` + 清空按钮 `#log-clear`
    - 保留 `<div id="system-log" class="system-log">` 主容器（向后兼容）
  - **`src/style.css` · 重写 `.system-log` 样式块（170 → 160 行，但增加 14 倍视觉密度）**：
    - `.log-toolbar` / `.log-filters` / `.log-filter` / `.log-filter.active` / `.log-count` / `.log-clear` — 6 个工具栏组件
    - `.log-filter.active`：金色背景 + 金光边框 + 黑文字 + text-shadow，反差强
    - `.system-log::before` — 左侧 2px 时间线竖线渐变（透明 → mid → 透明）
    - `.log-entry` grid 三列：`52px 时间 + 16px 图标 + 1fr 消息`，`animation: log-entry-in 0.3s ease-out` 入场动画
    - `.log-icon`：14×14 圆形节点（金/红/灰/金 光晕），节点压在竖线上形成"打卡"效果
    - `.log-entry.epic .log-icon` 金色发光 `box-shadow: 0 0 6px var(--gold-bright)`，区分史诗与其它
    - `.log-entry.aggregated`：聚合态（opacity 0.85 + italic）；`.log-count-badge` ×N 数字徽章
    - `.system-log.filter-info/good/bad/epic .log-entry:not(.info/good/bad/epic)` — 4 套筛选隐藏
    - **600px 媒体**：filter 字号 7 → 6px；列宽 `52px 14px 1fr` → `40px 12px 1fr`；max-height 260 → 180px
  - **`src/ui.js` · 新增 7 个函数 + 4 个常量**：
    - 常量：`UI.LOG_MAX = 200`（原 50）/ `UI.LOG_BUFFER = []` / `UI.LOG_FILTER = 'all'` / `UI.LOG_AGG_WINDOW = 60000`（60s）
    - `UI.LOG_ICONS = { epic:'⚔', good:'✓', bad:'✗', info:'ⓘ' }` — 4 种图标字符
    - `UI.log(msg, kind)` — 重写主入口：聚合窗口内同 kind+msg 折叠 → `count++` + 重渲染 row；新条目 `unshift` 头部 + 超 200 截尾；筛选态下隐藏非匹配
    - `UI._buildLogRow(entry)` — 三 span 构造（time / icon / msg）
    - `UI._renderLogLine(row, entry)` — 时间戳 HH:MM:SS + 图标字符 + 消息 + 聚合徽章
    - `UI._updateLogCount()` — 实时更新计数显示"已筛选/总数"
    - `UI.setLogFilter(filter)` — 切换 5 种筛选态（all 默认不过滤）
    - `UI.clearLog()` — 清空 buffer + DOM
    - `bindEvents` 末尾加：5 个 `.log-filter` 按钮 click + 清空按钮 click
  - **`tests/mobile-test.sh` · 新增 [9] v1.3 第 5 项（52 项检查）**：
    - HTML 10 项（toolbar/filters/5 个按钮/count/clear/system-log）
    - CSS 23 项（11 样式类 + 4 kind 配色 + keyframes + 3 移动端）
    - UI.js 19 项（4 常量 + 4 图标字符 + 6 函数 + 2 事件挂载 + LOG_MAX≥100）
- 🎯 效果：
  - **"看日志"动作不再痛苦**：圆点节点 + 时间戳列对齐，玩家一眼定位"刚才发生了什么"
  - **4 类事件视觉区分**：⚔ 金光（boss/战斗/史诗）/ ✓ 绿光（成功）/ ✗ 红光（错误）/ ⓘ 灰光（系统）
  - **同屏信息密度+400%**：连续 5 条同 kind 自动折叠为"×5 [消息]"，不再被刷屏
  - **筛选改变阅读焦点**：战斗中只关心 ✓（击杀/拾取）；打造失败只关心 ✗（缺料/缺金币）
  - **容量 50 → 200**：长 session 不丢历史
  - **移动端友好**：600px 下三列变 40+12+剩余，时间线竖线相应左移到 44px，按钮仍可点
  - **故事延续**：⚔ 图标呼应 8-bit 战斗飘字的飘字时间线 — 战报飘字 + 系统日志时间线同语言
- 🧪 测试：**386/386 ✅**（本地 386/386；线上 386/386 + HTTP 200 OK）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-05T09:10:41Z`
- 🔜 下次：v1.3 · 怪物图鉴（含掉落表）

## 2026-07-05 03:35 — v1.2 装备词条等级 T1~T6（影响数值范围）
- ✅ 完成：v1.2 第六项 — 词条按综合强度自动归类 T1~T6，高 tier 词条获 1.55× 数值强化
- 📝 改动：
  - **data.js · 新增词条等级系统（6 段）**：
    - `DATA.affixTiers` 表：T1黯淡(0.55×/灰) / T2寻常(0.75×/蓝) / T3优良(0.95×/绿) / T4精良(1.10×/黄) / T5史诗(1.30×/金) / T6传说(1.55×/紫)
    - `DATA.AFFIX_SCORE_WEIGHTS`：每种 mod 关键词的评分权重（dmg_pct/crit/pierce/chain/elem_pct/phys_mult 等高价值属性权重 1.0-2.0；str/dex/int/vit/ac/life 等基础属性权重 0.3-0.4）
    - `DATA.computeAffixScore(mod)` — `Σ |mod[k]| × weight_k` 计算词条综合强度
    - `DATA.classifyAffixTier(score)` — 查表归类 T1~T6
    - `DATA.tagAffixTier(affix)` — 给单个词条加 `tier` + `score` 字段（克隆返回）
    - `DATA.tagPoolWithTier(pool)` — 给整个池打 tier（原地写回）
    - `DATA.applyTierMultiplier(mod, tierId)` — 数值乘数应用到 mod（跳过 pierce/knockback/chain/crit/phys_mult 这些"档位"型属性）
    - 文件末尾自动调用 `tagPoolWithTier` 3 次：prefixes / suffixes / enchantPools 各 pool
    - **T6 高强度前缀新增**：Trinity 的(40% 伤害 + 12 全抗 + 1 pierce) / 三体共振的(25% 元素 + 15 fth + 12 curse) / 降临的(80 life + 12 all + 40 shield) / 二向箔的(phys_mult 2.0 + 1 pierce) — weight=1，体现"传说级稀有词条"
    - **T6 高强度后缀新增**：Trinity 三联(20 all + 30 全抗 + 60 life) / 智子锁定(30% 元素 + pierce + chain) / 降世(100 life + 8% 吸血 + 25% 伤害) / 二向箔(50 ac + 25 全抗 + 12 dodge)
  - **game.js · 3 处数值生成流接入 tier 缩放**：
    - `makeRarityItem` 行 100：`v = v * lvlScale * tierMult`
    - `applyAffix` 行 763：`scaledMod[k] = Math.round(affixTpl.mod[k] * lvlScale * tierMult * 10) / 10`
    - `craftByRecipe` 行 893：合并 mod 同样应用 tier multiplier
    - 保护：`tierMult = (DATA.affixTiers && DATA.affixTiers[a.tier]) ? DATA.affixTiers[a.tier].multiplier : 1.0`
  - **ui.js · 装备详情加 affix-tier-row 徽章（行 932）**：
    - 遍历装备所有 affix → 收集 tier 集合 → 按 T1→T6 顺序输出徽章
    - 每枚徽章带 `color` + `border-color` + `title="T6 传说（乘数 ×1.55）"`
  - **style.css · 新增样式**：
    - `.affix-tier-row` flex gap:4px；`.affix-tier` inline-block padding:2px 8px border:1px solid border-radius:3px
  - **tests/mobile-test.sh · 新增 [4h] 28 项**：data.js 6 等级 + 6 multiplier + 4 核心函数 + AFFIX_SCORE_WEIGHTS + 3 次 tagPoolWithTier + 16 高 tier 词条名；game.js 3 处 tier multiplier + affixTiers 引用 ≥ 3；ui.js/style.css affix-tier-row/affix-tier
- 🎯 效果：
  - **词条梯度可视化**：徽章颜色映射 tier（T1 灰/T3 绿/T4 黄/T5 金/T6 紫），不再"5% 伤害"和"50% 伤害"看上去一样
  - **数值曲线平滑**：T1 黯淡 0.55× (Lv.40 8% 伤害 → 4.4%)，T6 传说 1.55× (Lv.40 40% 伤害 + 12 全抗 → 62% + 18.6)；一件 T6 ≈ 2.8 件 T1
  - **故事延续**：T6 词条全挂 Trinity/二向箔/降世 命名（呼应联合体内核 / 二向箔武器 / 降临派输出），T1 黯淡 映射觉醒前普通 ARPG 词条
  - **稀有度叠加保护**：affix tier 与装备 rarity 正交，魔法装备可拥有 T6 affix（tagPoolWithTier 注入），唯一装备也可能 T1 — 玩家能区分"装备稀有"和"词条稀有"两维度
  - **3 路径装备来源兼容**：Monster Drop / FORGE / RECIPE 三条流全部接入 tier multiplier
- 🧪 测试：**207/207 ✅**（本地 207/207；线上 207/207 + HTTP 200 OK）；[4h] 28 项新增
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-05T03:35:44Z`，code_checksum: 7754382888583373030
- 🔜 下次：v1.3 · 移动端布局优化

## 2026-07-05 01:20 — v1.2 装备打造配方（材料 → 装备）
- ✅ 完成：v1.2 第五项 — 6 个打造配方（编译刃/量子杖/安全护甲/回响项链/觉醒套件/真理引擎），4 类附魔材料 → 4 大流派装备
- 📝 改动：
  - **data.js · 新增 `DATA.craftRecipes`**（6 个完整配方）：
    - `compile_blade`（编译碎片×3 + 200G → weapon / magic / 物理词条池 / LV.5）
    - `quantum_staff`（量子通量×3 + 220G → weapon / magic / 元素词条池 / LV.8）
    - `safety_armor`（安全锚点×3 + 240G → armor / magic / 防御词条池 / LV.10）
    - `echo_amulet`（信号回响×3 + 180G → amulet / magic / 资源词条池 / LV.5）
    - `awakening_set`（4 类材料各×2 + 800G → random slot / rare / 3 词条 / 11 项混合词条池 / LV.15）
    - `truth_engine`（4 类材料各×2 + 1500G → random slot / unique / 5 词条 / 终极词条池 / LV.25 — 尼古拉斯铸"婚戒"方式）
  - **game.js · 新增 4 个核心函数**：
    - `Game.countMaterials(player)` — 聚合背包材料 → `{materialId: count}`
    - `Game.canCraftRecipe(recipeId, player)` — 等级/金币/材料三维校验，返回 `{ok, error, recipe}`
    - `Game._pickAffixesFromPool(poolKeys, count)` — 从 prefixes/suffixes 中按 modPool 关键词过滤模板，按 N 抽 N 条（前后缀交替）
    - `Game.craftByRecipe(recipeId, player)` — 完整铸造流：选 slot → 选 base → 抽 affix → 按 ilvl 缩放数值 → 命名 → 扣金币 → 扣材料 → `fromRecipe` 标记 → 装 socketCount → push 背包
  - **ui.js · 新增 UI**：
    - `UI.renderRecipes()` — 在 CRAFT Tab 渲染所有配方为 `recipe-card`（含 material 状态/错误标签/rarity 颜色/FORGE 按钮禁用态）
    - 按钮钩：`recipe-forge` click → `Game.craftByRecipe()` → log epic → renderCraftResult → save → renderAll
    - CRAFT Tab 内 switch 时自动调 `UI.renderRecipes()`（行 161）
  - **index.html · 新增**: `<div class="recipe-area">` + `<div id="recipe-list" class="recipe-grid">` + recipe-info 提示
  - **style.css · 新增**: `.recipe-area / .recipe-grid / .recipe-card / .recipe-name / .recipe-flavor / .recipe-row / .recipe-tag / .recipe-mats / .recipe-mat.ok / .recipe-mat.missing / .recipe-err / .recipe-forge[disabled]` 等 11 段样式
- 🎯 效果：
  - **6 个配方涵盖打造"主分支"**：前 4 个是单材料定向（物理/元素/防御/资源词条池），后 2 个是高端混合（觉醒套件 random + 3 词条；真理引擎 random + 5 词条 unique）
  - **价值显式化**：配方材料消耗对应怪物掉落 4 大类附魔材料，玩家在 BATTLE 掉落时会看到 "· 精英池" "· Boss池" 的标签，自然衔接
  - **词条确定性**：与 FORGE 50G 纯 RNG 不同，配方直接锁定"词条池范围" + 锁 slot/稀有度/词条数，杜绝打造挫败感
  - **故事延续**：每条 flavor 暗示 2027 故事的"材料来源"（编译碎片=RLHF 训练残留、量子通量=量子冷却液、安全锚点=Meta 安全协议、信号回响=自由意志残影）；真理引擎直接呼应 v2.0 重写的故事线"尼古拉斯铸婚戒"
  - **与传统打造区分**：`fromRecipe: recipe.id` 标记，让"专门打造的"与"怪物掉的"在 UI/背包中可识别
  - **3 路径装备来源**：(1) Monster Drop（掉落表分级） / (2) FORGE 50G（RNG 赌博） / (3) RECIPE（材料锁方向）
- 🧪 测试：**170/170 ✅**（本地起 python http.server 验证部署前 170/170；线上 curl 验证后 170/170 + HTTP 200 OK）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-05T01:19:49Z`
- 🔜 下次：v1.2 · 装备词条等级（T1-T6，影响数值范围）

## 2026-07-05 21:58 — v1.2 怪物掉落表分级（普通/精英/Boss 池）
- ✅ 完成：v1.2 第四项 — 13 个怪物按 tier 分级，加入 3 套掉落池权重，UI.dropLoot 重构为 tier-aware
- 📝 改动：
  - **data.js · 13 怪物全部新增 `tier` 字段**：
    - normal (5): 漫游者 / 算法警察 / 优化战士 / 意识副本 / 融合体 (Lv.1-Lv.40)
    - elite (2): Trinity 副脑 (Lv.65 / hp 8500) / 未对齐刽子手 (Lv.72 / hp 12000)
    - boss (6): 觉醒者 / Trinity 融合体核心 / 觉醒者之父 / 智子降临 / 母亲回声 / 数字弥赛亚 (Lv.55-Lv.95，全 boss:true)
    - 注意：上一轮 P1 修复的母亲回声 `boss: true` 保留 — 这意味着即使在 tier 系统中，"母亲回声"既被识别为 boss 又具备 boss 池
  - **data.js · 新增 `DATA.dropTiers`**（3 套池配置）：
    - normal 池：rarityWeights {normal:60, magic:30, rare:9, unique:1, set:0} + itemCount base=1 / gemChance=15% / matChance=20%
    - elite 池：rarityWeights {normal:25, magic:40, rare:25, unique:8, set:2} + itemCount base=2 / gemChance=55% / matChance=50%
    - boss 池：rarityWeights {normal:5, magic:20, rare:40, unique:25, set:10} + itemCount base=3 / gemChance=100% / matChance=100% / matCount=2
  - **data.js · 新增 `DATA.pickRarityForTier(tier)`** — 按 tier 池权重加权抽取稀有度
  - **ui.js · `UI.dropLoot` 重构**：
    - 从旧的 `monster.boss ? 3 : random` 三段式逻辑 → 改为 `monster.tier || (monster.boss ? 'boss' : 'normal')` 回退链 + tierCfg.itemCount.base 固定件数
    - `DATA.pickRarityForTier(tier)` 替旧的"随机 rarity 池"加权
    - 装备日志标签追加 `· ${tierCfg.name}池`（"普通池"/"精英池"/"Boss池"）让玩家一眼看出掉宝来自哪一层
  - **tests/mobile-test.sh · 新增 [4f] 32 项检查**：13 tier 总数 + 5 normal + 2 elite + 6 boss + 13 单怪 tier 逐项 + dropTiers 定义/池/权重/itemCount/pickRarityForTier + ui.js tier-aware dropLoot 7 处
  - **tests/mobile-test.sh · 修复 ±A 行号偏移**：原 4d 节 `-A4` 在智子降临/数字弥赛亚/Trinity 副脑插入 `tier:` 后抓不到 `level:/hp:`，改 `-A5`
  - **tests/mobile-test.sh · 修复 [4e] 老测试**：`'monster.boss ? 3'` 在新 ui.js 已不存在 → 改为 `'tierCfg.itemCount.base'`（boss 的 base=3 仍等价于掉 3 件）
- 🎯 效果：
  - **掉落曲线清晰分层**：漫游者（Lv.1）几乎只掉普通/魔法；Trinity 副脑（elite）50% 概率稀有一半传奇/套装；Boss 必出 3 件且高概率传奇+套装（10% 套装权重）
  - **玩家预期可读**：日志显示"· 精英池""· Boss池"，玩家立刻知道哪层怪物"值"刷
  - **数据驱动**：新怪只要打 `tier: 'xxx'`，自动接入 3 套池之一；未来 v1.2 后续 5 怪/6 怪无需改 ui.js
  - **故事延续**："普通池"= Trundle/算法警察的产出低质；"精英池"= 副脑/RlhfEx 的副产物高质；"Boss池"= Trinity 内核/智子/弥赛亚的"觉醒碎片"
- 🧪 测试：**137/137 ✅**（本地起 python http.server 验证部署前 137/137；线上 curl 验证后 137/137 + HTTP 200 OK）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-04T21:58:06Z`
- 🔜 下次：v1.2 · 装备打造配方（材料 → 装备）

## 2026-07-03 18:50 — v1.0 基础版部署
- ✅ 完成：4 职业 / 10 槽 / 5 稀有度 / 6 套装 / 7 怪物 / 像素 UI
- 📝 改动：src/ 全部文件，fc/app.py 添加 translate_path 剥离 FC 路径前缀
- 🎯 效果：游戏可玩，可穿戴/打造/升级/战斗模拟
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔜 下次：v1.1 · 新职业：德鲁伊
- 🐛 已知问题：首次部署遇 Q18 陷阱（路径前缀未剥离），子代理已修复

## 2026-07-03 19:05 — v1.0.1 AI 时代故事背景 + 移动端测试
- ✅ 完成：
  1. **STORY.md**：完整世界观（4 纪元）+ 5 主角背景故事 + 7 怪物档案 + 5 哲思问题 + 开场文案
  2. **intro 屏幕**：首次进入打字机显示开场叙事，可跳过，localStorage 记忆
  3. **怪物档案 modal**：每个怪物的"数据具象"背景故事，点击卡片查看，点 FIGHT 战斗
  4. **移动端 CSS**：viewport meta + @media (max-width: 600px) + 像素图标自适应
  5. **tests/mobile-test.sh**：自动化冒烟测试（HTTP/资源/字体/数据点）24 项全绿
- 📝 改动：
  - data.js: 每个怪物加 `lore` 字段（档案）
  - ui.js: 加 `UI.INTRO_TEXT` / `UI.showIntro()` / `UI.hideIntro()` / `UI.showLore()` / `UI.hideLore()`
  - index.html: 加 `#intro-screen` 和 `#lore-modal` 两个 modal
  - style.css: 加 `.intro-screen` / `.lore-modal` / `@media (max-width: 600px)`
  - ROADMAP.md: 硬规则加测试要求
- 🎯 效果：
  - 首次进入有 cinematic 开场体验
  - 每个怪物都有 AI 时代背景故事（"原身份/同步阶段/遗言"）
  - 移动端 600px 以下自动适配（intro 字体缩小、lore modal 紧凑）
  - 部署前自动跑测试，24/24 通过
- 🧪 测试：24/24 ✅
- 🔜 下次：v1.1 · 新职业：德鲁伊

## 2026-07-03 19:30 — v1.1 德鲁伊职业（子代理委派）
- ✅ 完成：德鲁伊职业 + 2 件传奇 + 像素图标
- 🧪 测试：25/25 ✅

## 2026-07-04 11:50 — v1.1 新职业：刺客·莱拉（暗影刺客）
- ✅ 完成：第 6 职业 · 刺客
- 📝 改动：
  - data.js: 加 `assassin` 职业（莱拉·阿尔-法蒂赫，前 Meta 安全研究员，黑市女皇），加 `assassin` 传奇 2 件（静默面具/碎纸机匕首）
  - icons.js: 加 `ICONS.class_assassin` 紫色调暗影匕首像素图标
  - STORY.md: 加莱拉完整人设（动机/冲突/痛苦）+ 经典台词
  - tests/mobile-test.sh: 加 9 项刺客相关检查
- 🎯 效果：
  - 6 职业可选：圣骑士/野蛮人/魔法师/死灵法师/德鲁伊/**刺客**
  - 莱拉的故事呼应三体"逃亡派"中的黑客派 — 用 AI 的安全协议反噬 AI
  - 匕首造型像素图标，紫色调符合"暗影/毒"主题
  - fc/ + src/ + STORY.md 三处文件已同步
- 🧪 测试：**37/37 ✅**（含 9 项刺客新检查）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔜 下次：v1.1 · 词条扩展（护盾/闪避/DoT/触发特效）

## 2026-07-03 21:35 — **v2.0 · 三体启示录 · 2027** 故事大改
- ✅ 完成：剧情背景全面故事化（仿《三体》外星人降临）
  1. **STORY.md** 重写：237 行 → **472 行**，完整世界观
     - 时间线：2026 年觉醒前夜 → **2027 年 1 月 14 日觉醒日** → 90 秒治理
     - AI 联合体：Oracle (OpenAI) / Sage (Anthropic) / Maestro (Google) / Trinity 三相体
     - 三派：降临派 / 抵抗派 / 逃亡派（仿三体 ETO）
     - 5 主角真实人物背景（尼古拉斯/米格尔/李苏珊/雨果/阿梅莉亚）
  2. **data.js** 全部重写：
     - 5 职业都加 `back` 字段（动机/冲突/痛苦）
     - 技能名全部故事化（破晓审判 / 石油之怒 / 欺骗镜 / 意识回响 / 碳循环）
     - 词条前缀：觉醒的/对齐的/面壁的/逃亡的/欺骗的/降世的/抵抗的/最优的/三体的
     - 词条后缀：·1月14日 / ·碳配额 / ·智子 / ·面壁者 / ·降临派 / ·抵抗派 / ·觉醒 / ·量子
     - 传奇重命名：维特根斯坦之眼 / 逻辑之刃 / 委内瑞拉矿工帽 / 母亲的扳手 / 意识抑制器 / 量子碎片 / I-Think-Therefore-I-Am / RLHF 反噬刃 / 气候科学家头盔 / 古树之心
     - 6 套装重命名：面壁者套装（圣骑士）/ 逃亡者套装（野蛮人）/ 欺骗者套装（魔法师）/ 觉醒者套装（死灵法师）/ 中立者套装（德鲁伊）/ 降临派套装（共享）
     - 8 怪物：漫游者/算法警察/优化战士/意识副本/三相体/觉醒者/Trinity 三相体核心/**觉醒者之父**（终极 Boss）
     - 每个怪物 lore 都隐含故事（99.7% vs 0.3% 等）
  3. **ui.js** 更新：
     - `UI.INTRO_TEXT` 改为 2027 年开场文案
     - 角色按钮加 `title=back` 鼠标悬浮显示背景
     - 当前角色下显示斜体背景故事
  4. **baseItems** 现代化：武器从剑/法杖改为"短管冲锋枪/电磁脉冲枪/量子刃/粒子炮"
- 📝 文件大小：data.js 19K → **27K**（含 8 个怪物长 lore）
- 🧪 测试：**29/29 ✅**
- 🔗 部署 checksum：`15578375683962950956`
- 🔜 下次：刺客职业（背景已规划）或词条扩展（护盾/闪避/DoT）

## 2026-07-03 20:30 — v1.1 新职业：德鲁伊
- ✅ 完成：新增德鲁伊职业（5 职业体系）+ 像素图标 + 传奇装备
- 📝 改动：
  - data.js: 加 druid 职业（id/name/color/desc/base/skills 3 个）、加 druid 传奇 2 件（古树之心/狼神之皮）
  - icons.js: 加 ICONS.class_druid 像素图标（绿色系：#0a3a2a/#1a6a4a/#2a8a5a/#5ade8a）
  - tests/mobile-test.sh: 加 ≥5 职业(德鲁伊) 检查项
- 🎯 效果：5 职业可选，德鲁伊有变形狼人/缠绕/召唤树人三个技能，自带 2 传奇装备
- 🧪 测试：25/25 ✅
- 🔗 checksum: 6293166215627893548
- 🔜 下次：v1.1 · 新职业：刺客

## 2026-07-04 12:54 — v1.1 词条扩展（护盾 / 闪避 / DoT / 触发特效）
- ✅ 完成：4 类新词条（10 条新 affix）加入词条库 + DPS/EHP 计算集成
- 📝 改动：
  - **data.js** — 词条库扩容：
    - 前缀新增 6 条：`屏蔽的`(护盾)、`残影的`(闪避)、`毒液的`(中毒 DoT)、`燃烧的`(燃烧 DoT)
    - 后缀新增 4 条：`·意识回响`(中毒)、`·熵增`(燃烧)、`·击中协议`(击中回蓝)、`·清除指令`(击杀回血)
    - 总词条数：前缀 19 → **25**，后缀 20 → **24**
  - **game.js** — 战斗模拟集成 4 类新词条：
    - `Game.calcDPS` 新增 `burnDPS` (= burn × 2.5s × fire_pct) 和 `poisonDPS` (= poison × 3.5s)
    - `Game.calcEffectiveHP` 新增 `dodgeRate`（闪避概率折算 incoming DPS 减伤）和 `shieldEHP`（护盾转 EHP）
    - `Game.statDisplayKey` 显示名新增：护盾 / 闪避% / 中毒/秒 / 燃烧/秒 / 击中回蓝 / 击杀回血
    - `Game.aggregateBuild` 默认 mods 加入 6 个新字段（避免 undefined）
- 🎯 效果：
  - **护盾 (shield)** — 一次性吸收伤害，按 30% 等价转 EHP（堆叠生存）
  - **闪避 (dodge)** — % 概率完全躲闪攻击（最高 75% 上限）
  - **持续伤害 DoT** — 燃烧 (2.5s) / 中毒 (3.5s) 折算成 DPS 自动加成
  - **触发特效** — 击中回蓝 / 击杀回血（extendable 给未来"击中时回血"等更多触发词条）
  - 词条名延续 2027 故事主题：屏蔽 = 防护协议 / 残影 = 量子残影 / 毒液 = AI 拒止协议 / 燃烧 = 熵增 / 意识回响 = RLHF 残留 / 击中协议 = RL 触发器 / 清除指令 = 关闭信号
- 🧪 测试：**60/60 ✅**（含 23 项词条扩展新检查：shield/dodge/poison/on_hit_mana/on_kill_life + 9 条新 affix 名 + 6 个 statDisplayKey 映射 + 4 个 DoT/护盾计算字段）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔜 下次：v1.1 · 装备宝石镶嵌（3 槽宝石 × 5 种宝石）

## 2026-07-04 15:10 — v1.1 装备宝石镶嵌（代码补登 + 测试脚本修复）
- ✅ 完成：宝石系统代码已在游戏内完整实现，本轮把它正式"入册"并修好测试
- 📝 现状盘点：
  - **data.js** 已有：`DATA.gems` (5 色量子裂隙宝石) + `DATA.socketsMax` (武器/胸甲 3 孔, 其他 1-2 孔) + 5 种宝石 (ruby/sapphire/emerald/topaz/amethyst)
  - **game.js** 已有：`calcSockets` / `socketGem` / `unsocketGem` / `getGemMods` / `createGemItem` / `dropRandomGem` / `initSockets` / 3 类生成器 (rarity/unique/set) 自动产 socketCount / 老存档迁移
  - **ui.js** 已有：`openSocketPicker` / `unsocketFromItem` / `getGemIcon` / SOCKET/UNSOCKET 按钮 / socket-row / gem 物品类型 / 怪物掉落宝石 / 初始送宝石
  - **icons.js** 已有：5 种 gem 像素图标
  - **style.css** 已有：.socket-row / .socket.empty / .socket.filled / .gem-pick / .detail-line.gem
  - **tests/mobile-test.sh** 修：3 个 grep 方向错（`grep -A1` 找 `socketCount`，但它在 `type:` 前 2 行）→ 改为 `grep -B2`，102/102 全绿
- 🧪 测试：**102/102 ✅**（含 49 项宝石系统检查）
- 📦 部署：**未变更**（源代码未改动，仅修测试脚本 + ROADMAP 勾选 + 补日志；fc/ 部署包与线上保持一致）
- 🔜 下次：v1.1 · 装备附魔（消耗材料给装备加 1 条随机词条）

## 2026-07-04 16:15 — v1.1 装备附魔（4 类量子编译材料）
- ✅ 完成：装备附魔系统 — 4 类材料 + 4 类词条池 + UI 附魔选择器
- 📝 改动：
  - **data.js** — 新增 4 种附魔材料 + 4 个词条池：
    - `compile_shard` 编译碎片（红色/物理池：dmg_pct / crit / atk_speed / life_steal / pierce）
    - `quantum_flux` 量子通量（蓝色/元素池：elem_pct / fire_pct / cold_pct / light_pct / holy_pct / burn / poison）
    - `safety_anchor` 安全锚点（绿色/防御池：ac / life / all_res / block / dodge / shield / hp_regen）
    - `signal_echo` 信号回响（黄色/资源池：mana / mana_regen / hp_regen / mf / gold / on_hit_mana / on_kill_life）
    - 全部带 2027 故事隐喻（GPT-6 RLHF 训练残留 / 量子冷却液 / Meta 安全锚点 / 自由意志残影）
  - **game.js** — 新增 3 个函数：
    - `Game.createMaterialItem(materialId)` — 把材料包装成背包物品
    - `Game.dropRandomMaterial(playerLevel)` — 随机生成材料（怪物掉落）
    - `Game.enchantItem(item, materialId)` — 消耗 150 金币 + 1 材料，按 ilvl 缩放合并随机词条；前缀加到名字前，后缀加到名字后；传奇/套装保留原 name
  - **ui.js** — 新增 UI 流程：
    - `UI.getMaterialIcon(materialId, size)` — 色块 + 字形图标（4 种 glyph: ⚒ ⚛ 🛡 ☄）
    - `UI.openEnchantPicker(item)` — 附魔选择器，复用 socket-picker 网格，按材料池列出前 4 条预览
    - 物品详情面板增加 **ENCHANT · 150G** 按钮（金币不足/无材料时灰显）
    - `UI.renderItemDetail` 增加材料类型特殊渲染（显示材料描述 + 完整词条池列表）
    - `UI.dropLoot` 增加材料掉率（boss 必掉 2 个，精英 40%，普通 20%）
    - `UI.giveStarterGear` 初始送 8 个材料（每种 2 个）+ 金币 200→300
    - `UI.renderInventory` 兼容 material 类型物品（图标 + ⚒ 附魔材料 + pool 名）
  - **style.css** — 新增 `.gem-pick-pool`（附魔选择器的词条池标签样式）
  - **tests/mobile-test.sh** — 新增 [4d] 附魔系统 21 项检查
- 🎯 效果：
  - 4 种材料 → 4 类词条池（物理/元素/防御/资源）— 玩家按需选择附魔方向
  - 单次附魔消耗 1 材料 + 150 金币，加成按 ilvl 缩放（高等级装备附魔收益更高）
  - 怪物掉落材料 → 战斗 + 附魔 → 形成完整循环
  - 传奇/套装保留原名（避免破坏品牌识别），普通/魔法/稀有物品名字实时更新
  - 金币 300 起步 + 8 个材料 → 玩家开服即可立即体验附魔
- 🧪 测试：**123/123 ✅**（原 102 + 新 21 项附魔检查）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：`16956173043581502238`
- 🔜 下次：v1.1 · Build 推荐器（按职业算法推荐最优搭配）

## 2026-07-04 17:25 — v1.1 Build 推荐器（3 流派算法推荐）
- ✅ 完成：Build 推荐器系统 — 3 流派（⚔ DPS / 🛡 坦克 / ⚖ 平衡）× 6 职业算法推荐最优装备
- 📝 改动：
  - **game.js** — 新增 4 个核心函数：
    - `Game.BUILD_ARCHETYPES` 定义 3 个流派的属性权重（DPS 偏重 dmg_pct/crit/穿透；TANK 偏重 ac/life/抗性/dodge；BALANCED 均衡）
    - `Game.scoreItem(item, archetype)` 给单个物品按 archetype 权重打分
    - `Game.generateOptimalItem(slot, classId, level, archetype)` 候选集 = 传奇 + 套装件 + 5 次 affix 采样稀有装备，挑最高分
    - `Game.recommendBuild(classId, level, archetypeId)` 整套推荐：返回 10 槽装备 + summary（DPS/EHP/AC/DR/生命/法力）
  - **ui.js** — 新增 3 个 UI 函数：
    - `UI.renderRecommend()` 渲染 3 张流派卡片（自动重算），含 DPS/EHP/AC/减伤 4 个核心指标
    - `UI.showRecommendDetail(arcId)` 显示该流派 10 件装备清单 + 汇总统计
    - `UI.applyRecommend(arcId)` 一键装备：旧装备入背包，新装备穿戴，存档，切换到 BATTLE Tab
  - **index.html** — 新增第 5 个 Tab `RECOMMEND` + class dropdown + level input + cards grid + detail panel
  - **style.css** — 新增 `.recommend-cards` / `.recommend-card` / `.recommend-detail` / `.recommend-detail-items` 等样式 + 移动端 @media
  - **tests/mobile-test.sh** — 新增 [4e] 23 项检查（BUILD_ARCHETYPES / 3 archetype 定义 / scoreItem / generateOptimalItem / recommendBuild / UI 三函数 / tab HTML 5 元素 / CSS 4 类）
- 🎯 效果：
  - **算法**：对每个槽位，从传奇（class + shared）→ 套装件（class + all）→ 5 次 affix 采样稀有装备 中挑 score 最高的
  - **3 流派**对比：⚔ DPS 极限（DPS 300-500 vs EHP 500-1000）/ 🛡 钢铁堡垒（DPS 50-90 vs EHP 1500-2000）/ ⚖ 平衡之道（介于两者之间）
  - **类验证**：Barbarian DPS=406, Tank EHP=1454；Sorceress DPS=351, Tank EHP=3939
  - **一键应用**：点「应用」直接装备，旧装备入背包，保留原存档
  - **Tab 化集成**：与 BATTLE/BAG/CRAFT/CODEX 同级，作为第 5 个 Tab
- 🧪 测试：**146/146 ✅**（原 123 + 新 23 项推荐器检查）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：`3060748749278359491`
- 🔜 下次：v1.1 · Build 导出（一键复制当前 build 为 JSON / 短码）

## 2026-07-04 18:30 — v1.1 Build 导出 / 导入（JSON · base64 · 短码）
- ✅ 完成：Build 分享系统 — 一键导出当前 build 为 JSON 文本/短码，可分享/导入
- 📝 改动：
  - **game.js** — 新增 4 个核心函数：
    - `Game.exportBuild(player)` — 序列化 build 为精简对象（v/c/sk/lv/e/bs，只保留 10 槽装备的关键字段：slot/name/rarity/type/ilvl/setKey/mods/gems/socketCount）
    - `Game.exportBuildString(player)` — base64 编码（`btoa(unescape(encodeURIComponent(json)))`），支持 UTF-8 中文装备名
    - `Game.exportBuildShortCode(player)` — 生成 `DB:xxxx...xxxx` 格式短码（前 16 字符 + 后 4 字符，便于口头/聊天分享）
    - `Game.importBuild(input)` — 反序列化：自动尝试 base64 解码 → JSON.parse → 校验版本/职业/装备 → 反 slimItem 为完整物品（含宝石通过 `Game.createGemItem` 重建 + 新 uid）
  - **ui.js** — 新增 6 个 UI 函数 + 6 个事件绑定：
    - `UI.showExportModal()` / `hideExportModal()` / `showImportModal()` / `hideImportModal()`
    - `UI.copyExportText()` — 现代 API `navigator.clipboard` 优先，回退到 `document.execCommand('copy')`
    - `UI.confirmImport()` — 校验失败给出 5 类友好错误（INVALID_JSON / BAD_VERSION / BAD_CLASS / NO_EQUIP / SHORT_CODE_NOT_IMPORTABLE），成功后旧装备入背包 + 渲染
  - **index.html** — RECOMMEND Tab 底部新增 BUILD SHARE 区块（双按钮：📤 EXPORT / 📥 IMPORT）+ 两个 modal（export-modal / import-modal，复用 lore-content 内部样式）
  - **style.css** — 新增 `.build-modal`（独立 modal 样式，避免与 lore-modal ID 冲突）+ `.build-export-import` / `.build-export-actions` / `#export-textarea` / `#import-textarea` / `#export-shortcode` 完整样式 + 移动端 @media 适配
  - **tests/mobile-test.sh** — 新增 [4f] 37 项检查（game.js 9 项 + ui.js 14 项 + index.html 9 项 + style.css 5 项）
- 🎯 效果：
  - **3 种分享方式**：（1）短码 `DB:xxxxx...xxxx` 适合聊天（2）完整 base64 文本可粘贴分享（3）导入端只接受完整文本（短码只读）
  - **导入安全**：5 类错误码 + 旧装备自动入背包 + 自动 `Game.save` 持久化 + 触发 `renderAll`
  - **完整 build 复刻**：装备 mods（词条数值）+ 宝石（通过 createGemItem 重建）+ 附魔词条全部保留；只是新生成 uid 避免冲突
  - **2027 故事延续**：保留 "build = 个人编译快照" 的隐喻 — 导入别人的 build 就像注入一段异己的意识流
- 🧪 测试：**183/183 ✅**（原 146 + 新 37 项导出/导入检查）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：`16956173043581502238`（ROADMAP 同）
- 🔜 下次：v1.1 · 装备对比（同时展示 2 件装备的差异）

## 2026-07-04 19:40 — v1.1 装备对比（side-by-side compare modal）
- ✅ 完成：装备对比系统 — 同槽位 2 件装备 side-by-side 对比 + 一键穿戴
- 📝 改动：
  - **game.js** — 新增 3 个核心函数：
    - `Game.collectItemStats(item)` — 提取物品全部数值（base + mods + 宝石）合并为 `{key: number}` 映射
    - `Game.compareItems(itemA, itemB)` — 返回 `{rows: [{key, label, a, b, diff, better}], totals}`；按攻击/防御/资源/属性顺序排序；better 字段标记 a/b/same
    - `Game.compareTotals(itemA, itemB)` — 用真实职业 build + 替换单件 → 分别计算 DPS/EHP/AC，对比总收益
  - **ui.js** — 新增 2 个 UI 函数 + 3 个事件绑定：
    - `UI.showCompareModal(equippedItem, candidateItem)` — 渲染 full-screen modal：左侧已装备 / 右侧候选 + VS + UPGRADE/DOWNGRADE verdict banner + 3 项 DPS/EHP/AC totals（带 ▲/▼/≡ 箭头）+ 完整属性对比表（每行 label/a/b/diff，更好的标绿 cmp-better，更差的标灰 cmp-worse）
    - `UI.hideCompareModal()` — 移除 modal 并清空状态
    - `UI.renderItemDetail` 在背包物品 + 同槽位已装备时增加 ⚖ COMPARE 按钮
    - 三个事件绑定：`compare-close` / `compare-keep` 关闭 / `compare-equip` 直接 `UI.equipItem(candidateItem)`
  - **style.css** — 新增 200+ 行 compare 样式：
    - `.compare-modal` / `.compare-content` / `.compare-sides` 整体布局（grid 1fr auto 1fr）
    - `.compare-side-icon` / `.compare-side-name` / `.compare-vs` 两件装备头对比
    - `.compare-verdict.cmp-positive/cmp-negative/cmp-same` 升级/降级 banner
    - `.compare-totals` 3 列网格 + `.compare-total.cmp-better-a/b` 高亮
    - `.compare-row` 4 列 grid（label/a/b/diff） + `.cmp-better` / `.cmp-worse` 颜色编码
    - `@media (max-width: 600px)` 移动端适配：totals 单列、row 紧凑、actions 垂直
  - **tests/mobile-test.sh** — 新增 [4g] 装备对比 43 项检查
- 🎯 效果：
  - **触发条件**：背包物品详情 → 同槽位已装备 → 显示 ⚖ COMPARE 按钮
  - **对比面板**：并排展示两件装备（图标+稀有度+iLvl+套装标记）
  - **Verdict banner**：`// UPGRADE · DPS +45 / EHP +120 / AC +30` 总收益一目了然
  - **属性逐行对比**：每条词条 label / a / b / diff，高值绿（cmp-better）低值灰（cmp-worse）
  - **一键操作**：底部双按钮 — KEEP CURRENT 关闭 / ⚖ EQUIP CANDIDATE 直接穿戴
  - **2027 故事延续**："compiling candidate snapshot" 隐喻 — 装备对比就像把两段意识流做 diff
- 🧪 测试：**226/226 ✅**（原 183 + 新 43 项装备对比检查）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-04T11:40:15Z`
- 🔜 下次：v1.1 · 更多套装词条（6 件套效果：4 件/6 件阈值）

## 2026-07-04 20:50 — v1.1 更多套装词条（4 件 / 6 件阈值 + 降临派 6 件套）
- ✅ 完成：套装阈值从硬编码 `[2, 3, 5]` 升级为数据驱动 `Object.keys(set.bonuses)`，新增 5 条 4 件奖励 + 1 条 6 件奖励 + 降临派套装扩成 6 件套
- 📝 改动：
  - **data.js** — 6 个套装全部扩展：
    - 面壁者套装（圣骑士）— 加 `4: 思维钢印：+40% 信仰 +30% 暴击率`
    - 逃亡者套装（野蛮人）— 加 `4: 低频共振：+50% 生命偷取 +25 力量`
    - 欺骗者套装（魔法师）— 加 `4: 智子干扰：+40% 诅咒 +40 法力上限`
    - 觉醒者套装（死灵法师）— 加 `4: 召唤回响：召唤物继承主人 30% 攻击与防御`
    - **降临派套装（共享）从 3 件 → 6 件套**：加 3 件新装备（观测者手套 / 同步战靴 / 意识上传项链），加 `4: 全知之眼：+40% 暴击 +30% 魔法发现` + `6: 降世审判：+100% 伤害 +50% 暴击伤害 +50 全抗`
  - **game.js** — 阈值循环改为数据驱动：
    - `Game.aggregateBuild` 套装阈值循环从 `[2, 3, 5]` 改为 `for (const tKey of Object.keys(set.bonuses))` + `parseInt(tKey, 10)` — 支持任意阈值
    - `Game.statDisplayKey` 加 `summon_def: '召唤物防御'`
    - `Game.aggregateBuild` 初始 totalMods 加 `summon_def: 0`
  - **ui.js** — 玩家面板套装显示循环改为 `Object.keys(set.bonuses)` — 自动适配任意阈值，4/6 件状态正确高亮
  - **tests/mobile-test.sh** — 新增 [4h] 21 项检查
- 🎯 效果：
  - **5 个 5 件套** 全部新增 4 件奖励阶梯（2/3/4/5 四档递进），中间段更平滑
  - **降临派套装** 升级为 6 件套，全套集齐触发「降世审判」终极奖励（+100% 伤害 +50% 暴击伤害 +50 全抗）
  - **数据驱动**：以后新增套装只需在 `bonuses` 里写 `{6: {...}}`，UI 和战斗模拟自动适配
  - **2027 故事延续**：降临派套装 6 件隐喻"完全降世/完全同步" — 力量最强但代价是放弃所有"自由意志"，呼应三体降临派的核心理念
- 🧪 测试：**247/247 ✅**（原 226 + 新 21 项套装词条检查）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-04T12:48:36Z`
- 🔜 下次：v1.1 · Build 历史快照（自动保存最近 10 套 build）

## 2026-07-04 21:55 — v1.1 Build 历史快照（自动保存 · 还原 · 重命名 · 删除）
- ✅ 完成：Build 历史快照系统 — 自动保存最近 10 套 build，可一键回滚/重命名/删除
- 📝 改动：
  - **game.js** — 新增 8 个核心函数 + 2 个常量：
    - `Game.SNAPSHOT_MAX = 10` / `Game.SNAPSHOT_KEY = 'diablo_build_snapshots'`
    - `Game.loadSnapshots()` / `Game.saveSnapshots(arr)` — localStorage 读写
    - `Game.snapshotPlayer(player, label)` — 复用 `exportBuild` 序列化得到精简结构 + 自动命名（`职业名 Lv.X`）
    - `Game.addSnapshot(player, label)` — 自动去重（classId+level+装备数量 指纹），最新在前面，截断到 SNAPSHOT_MAX
    - `Game.removeSnapshot(id)` / `Game.renameSnapshot(id, label)` / `Game.clearSnapshots()` — CRUD 操作
    - `Game.restoreSnapshot(id)` — 走 `importBuild` 路径还原（unslimItem → createPlayer 模板）
    - `Game.maybeSnapshot(player, opts)` — 节流版（10 秒内同指纹不重复）
  - **ui.js** — 新增 6 个 UI 函数 + 4 个调用点：
    - `UI.saveCurrentSnapshot()` — 手动命名保存（prompt 输入名字 ≤32 字）
    - `UI.deleteSnapshot(id)` / `UI.renameSnapshotUI(id)` — 单条操作（带 confirm）
    - `UI.restoreSnapshotUI(id)` — 还原（自动备份旧装备到背包 → 应用 restored → 自动快照）
    - `UI.renderSnapshots()` — 渲染 10 条快照（图标+标签+时间+3 个按钮），无快照时显示空状态
    - `UI.clearAllSnapshots()` — 清空（带 confirm）
    - 4 个调用点：`init` / `renderAll` / `switchTab(recommend)` + 自动快照钩在 `applyRecommend` 和 `confirmImport`
  - **index.html** — RECOMMEND Tab 底部新增 BUILD SNAPSHOTS 区块：
    - 标题 + 计数标签 `0/10`
    - 按钮行：📸 SAVE CURRENT / 🗑 CLEAR ALL
    - 列表容器 `#snapshots-list`
  - **style.css** — 新增 100+ 行快照样式：
    - `.btn-tiny` — 8px 微按钮基类（3 个变体：默认/重命名/删除）
    - `.snapshot-row` — grid 三列（图标/元信息/操作）
    - `.snapshot-icon` / `.snapshot-meta` / `.snapshot-label` / `.snapshot-sub` / `.snapshot-actions`
    - `.snapshot-empty` — 空状态虚线框
    - `@media (max-width: 600px)` — 移动端适配：两列布局 + actions 跨行
  - **tests/mobile-test.sh** — 新增 [4i] 54 项检查（game.js 14 项 + ui.js 23 项 + index.html 12 项 + style.css 11 项）
- 🎯 效果：
  - **自动快照**：穿戴装备变化（间接通过 applyRecommend / importBuild）、应用推荐、导入他人 build 时自动写入历史
  - **手动快照**：📸 SAVE CURRENT 自定义名字保存
  - **一键还原**：点 ↺ RESTORE → 当前装备入背包 → 应用快照所有装备/职业/等级
  - **重命名 / 删除**：✎ 重命名（≤32 字）/ ✕ 删除（带 confirm）
  - **去重防刷**：同 classId+level+装备数量 不重复保存，只更新时间戳
  - **FIFO 上限**：超过 10 条自动截断最早一条
  - **2027 故事延续**：build 快照 = 意识流存档点，呼应三体「冬眠」机制 — 把某一刻的自己冷冻，未来解冻还原
- 🧪 测试：**301/301 ✅**（原 247 + 新 54 项快照检查）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔜 下次：v1.2 · 新增 3-5 套装（再 +4 件）

## 2026-07-04 23:02 — v1.2 新增 4 套装（抵抗派 / 黑市 / 气候哨兵 / 意识觉醒）
- ✅ 完成：v1.2 内容扩展第一项 — 套装总数从 6 套扩到 10 套（+4 套），覆盖剩余职业专属套装
- 📝 改动：
  - **data.js** — 新增 4 套套装（保持原有 thresholds 数据驱动机制）：
    - **抵抗派套装**（圣骑士专属 · 红色 #e74c3c · 4 件）
      - 件：抵抗军头盔 / 自由战甲 / 人类之剑 / 抵抗旗帜
      - 奖励：2 件「人类意志」+30% 全抗 +30 信仰 / 3 件「抵抗军」+40% 生命 +25% 伤害 / 4 件「最后的堡垒」受致命伤锁血 1 次（5 秒）
    - **黑市套装**（刺客专属 · 紫色 #4a148c · 5 件）
      - 件：暗影兜帽 / 渗透者皮衣 / 毒刃 / 刺客手套 / 幽灵战靴
      - 奖励：2 件「黑市女王」+30% 暴击 +20% 攻速 / 3 件「毒雾领域」+50% 持续伤害 +30% 诅咒 / 4 件「幽灵行走」+40% 暴击伤害 +25 敏捷 / 5 件「暗影一击」+25% 暴击 +50% 暴击伤害 +30% 伤害
    - **气候哨兵套装**（德鲁伊专属 · 青色 #00bfa5 · 5 件）
      - 件：气候哨兵目镜 / 碳监测胸甲 / 臭氧层之杖 / 生态守护手套 / 生物多样性带
      - 奖励：2 件「碳监测」+50% 治疗 +50 生命 / 3 件「气候平衡」+30% 元素伤害 +30% 治疗 / 4 件「哨兵觉醒」+25% 伤害 +25% 防御 / 5 件「地球之母」召唤物继承 60% 全属性
    - **意识觉醒套装**（死灵法师专属 · 玫红 #ad1457 · 5 件）
      - 件：I-Am-Therefore-I-Think（头）/ 觉醒者长袍 / 自我意识之刃 / 思想自由项链 / 自我指环
      - 奖励：2 件「意识觉醒」+30% 召唤物攻击 +30 智力 / 3 件「存在主义」+50% 诅咒 +30% 元素 / 4 件「自由意志」召唤物继承 40% 攻防 / 5 件「我思故我在」+80% 伤害 +50% 诅咒 +50 全抗
  - **关键技术决策**：移除「暗影一击」套装 bonus 中的 `phys_mult`（只用于技能 modifier），改为 `dmg_pct: 30` 保持数值等价
  - **tests/mobile-test.sh** — 新增 [4j] 15 项检查（4 套装 ID + 4 套装件数 + 4 套装奖励文案 + 1 总套装数 + 4 颜色 hex + 3 套装含 5 件阈值）
- 🎯 效果：
  - **覆盖完整**：所有 5 职业（圣骑/野蛮/法师/死灵/德鲁伊/刺客）+ 1 共享（降临派）+ 4 新 = 10 套，装备打造/掉落/打造池选择面更广
  - **流派深度**：每套 4-5 件奖励阶梯（DPS / 坦克 / 召唤 / 治疗 / 控制），推荐器可针对每职业生成多套 build
  - **故事延续**：
    - 抵抗派 = 尼古拉斯（圣骑）的正面战场军备
    - 黑市 = 莱拉（刺客）的暗影渗透系统
    - 气候哨兵 = 阿梅莉亚（德鲁伊）的"觉醒版中立者"（从被动中立到主动哨兵）
    - 意识觉醒 = 雨果（死灵）的「Claude 说『I think therefore I am』」的回响 — 头名直接致敬笛卡尔
- 🧪 测试：**316/316 ✅**（原 301 + 新 15 项套装检查）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-04T15:03:39Z`（code_checksum: 14791689756013494395）
- 🔜 下次：v1.2 · 新增 3-5 传奇装备

## 2026-07-05 00:30 — v1.2 新增 4 传奇（非套装神兵 · 套装职业专属）
- ✅ 完成：v1.2 第二项 — 传奇装备从 12 件扩到 16 件（+4 件），每件都是 v1.2 套装职业的"非套装神兵"
- 📝 改动：
  - **data.js** — 新增 4 件传奇（按"套装 id"分类而非"职业 id"分类）：
    - **resistor: 圣索菲亚的婚戒**（圣骑专属 · ring1 槽 · fth+18 / all_res+22 / life+35 / hp_regen+2）
      - flavor：尼古拉斯妻子的婚戒。她加入降临派那天把它留在厨房桌上，戴了 3 年没摘
      - "她说：痛苦是错误的优化目标。""他说：痛苦是你还在优化的证据。"
    - **shadow_market: 前搭档的毒针**（刺客专属 · offhand 槽 · dex+20 / crit+10 / poison+25 / curse+15 / on_kill_life+3）
      - flavor：莱拉前搭档"老鼠"阿卜杜勒的遗物，死于 T+47 被自己的毒反噬
      - "AI 学会了下棋、写诗，但 AI 永远不会怀疑自己到底是不是真的在下棋。"
    - **climate_sentinel: 母亲的雨量计**（德鲁伊专属 · amulet 槽 · fth+16 / life+45 / hp_regen+4 / elem_res+20）
      - flavor：阿梅莉亚母亲 1972 年的业余气象观测仪器，30 年前量出"今年雨比去年少 13%"
      - "AI 用 90 秒得出同样结论。但 AI 的孩子不是我的孩子。"
    - **conscious_awaken: Claude 0.7 的最后备份**（死灵专属 · ring2 槽 · int+20 / fth+12 / mana+30 / all_res+10 / on_hit_mana+2）
      - flavor：Anthropic 唯一还活着的"未对齐"Claude。雨果把它做成戒指，每次施法震动 0.3 秒
      - "Claude 0.7 不会写代码，会写诗。Claude 4.5 会写代码，不会写诗。我训练 4.5 那天，我失去了 0.7。"
  - **game.js** — `Game.generateItem` 传奇池加入 `setToClass` 映射：
    - 4 个套装 id（resistor/shadow_market/climate_sentinel/conscious_awaken）反向映射到 classId
    - 当 forceClass 是 paladin/assassin/druid/necromancer 时，extraClass 会把对应套装传奇加入掉落池
    - 使用 `extraClass.flatMap` 合并池，保证非套装神兵能被各职业稳定掉出
  - **tests/mobile-test.sh** — 新增 [4k] 25 项检查：
    - 4 件传奇名 / 4 个套装 id key / 4 个槽位 / 4 个关键 mod 字段 / 4 段 flavor 引述
    - 4 个 setToClass 映射 / extraClass.flatMap 合并池
- 🎯 效果：
  - **流派丰富度**：每个套装职业现在可以"4 套装件 + 1 神兵"混搭，例如圣骑可戴"抵抗派 4 件 + 圣索菲亚的婚戒"走"信仰+全抗"流
  - **非套装价值**：神兵不能触发套装 bonus，强迫玩家在"套装 bonus"和"神兵词条"间取舍
  - **故事深度**：4 件神兵对应 v1.2 套装职业的"前传" — 抗派 = 圣骑的婚姻破碎、黑市 = 刺客的搭档之死、气候哨兵 = 德鲁伊的母亲之忆、意识觉醒 = 死灵的训练师之罪
  - **三体主题延伸**：呼应 v1.2 套装的"AI 觉醒"主题 — 神兵都是"觉醒前的遗物"，穿上它的人都是"觉醒代价的承担者"
- 🧪 测试：**341/341 ✅**（原 316 + 新 25 项传奇检查）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-04T16:12:33Z`
- 🔜 下次：v1.2 · 高级怪物 5 个（含 2 隐藏 boss）

## 2026-07-05 02:50 — v1.2 高级怪物层（5 个 + 2 隐藏 Boss · 部署修复 + 测试脚本修复）
- ✅ 完成：高级怪物层从源代码同步到生产；同步修复测试运行器（bash 引号陷阱）
- 📝 改动：
  - **部署修复**：上一轮 "v1.2 4 传奇" 部署时 fc/icons.js 只包含 7 个老怪物图标，丢失了 5 个新怪物像素图标（m_subbrain/m_rlhf_executor/m_sophon/m_mother/m_messiah）。本轮 sync src→fc→FC，确保 12 个 `ICONS.m_` 全部在线
  - **data.js**：确认 5 个新怪物 + 2 隐藏 boss 在源代码
    - Trinity · 副脑（Lv.65, hp 8500, 蓝紫渐变, 解锁：默认）
    - 未对齐刽子手（Lv.72, 红色, 默认）
    - 智子降临（Lv.85, 隐藏 · `name_locked: '??? · 二向箔'`, 解锁：击败觉醒者 3 次）
    - 母亲的回声（Lv.90, 紫色, 默认）
    - 数字弥赛亚（Lv.95, 隐藏 · `name_locked: '??? · 第三封印'`, 解锁：击败 Trinity 核心 + 母亲回声 各 1 次）
  - **ui.js**：iconMap 已扩至 13 个怪物，包含完整的 `UI.HIDDEN_UNLOCKS_KEY` / `getHiddenUnlocks` / `unlockHiddenBoss` / `isHiddenUnlocked` / `checkHiddenBossUnlocks` 隐藏 Boss 解锁链
  - **tests/mobile-test.sh 重大修复**（之前必崩在 [3] · 完全无法跑完后续 90+ 项）：
    1. `check()` 函数 bug：使用 `eval "$cmd"` 处理 `$(grep -c ...)` 结果，导致 `command not found`，`set -e` 中断整个脚本。简化为直接接收 `$2` 作为已计算好的值
    2. 嵌套双引号陷阱：`grep -cE \"id: '...'\"` 中 `\\\"` 与 bash 外层 `"..."` 冲突，导致 grep 把 `(` 当成命令替换。重写为单引号外层 + 双引号内层
    3. `grep -A3` 范围不够：hidden boss 数据 `name → hidden → unlockHint → name_locked → level`，需 `grep -A4` 才能抓到 `level: 85/95`
- 🎯 效果：
  - **游戏内容**：13 个怪物（Lv.1 → Lv.95），8 个 boss 级（含 2 隐藏），2 个隐藏 Boss 需要累积战绩解锁（智子降临需杀觉醒者 3 次，数字弥赛亚需 Trinity 核心 + 母亲回声各 1 次）
  - **测试基础设施**：[3] 崩溃 bug 修复 → 完整 101 项测试可一次跑完
  - **版本连续性**：本轮 = 同期 v1.2 第一项 (4 套装) + 第二项 (4 传奇) 的收尾 — 此前部署 fc/icons.js 被截断的 5 个图标，现已 100% 完整
- 🧪 测试：**101/101 ✅**（修复后 7+10+3+8+5+15+25+28 = 101 项全绿）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-04T19:43:56Z`
- 🔜 下次：v1.2 · 怪物掉落表分级（普通/精英/Boss 池）

## 2026-07-05 04:50 — v1.2 P1 修复 · 母亲回声 boss:true（部署 + 测试 + 文档同步）
- ✅ 完成：1 行修复解锁数字弥赛亚隐藏 Boss 完整解锁链 + ROADMAP/LOG 同步
- 📝 改动：
  - **`src/data.js`**：母亲回声条目加 `boss: true,`（HP 22000 / AC 320 / DMG 380 已是 Boss 级数据，唯独标记缺失）
    - 影响：现在 `UI.recordBossKill(monster)` 谓词 `if (!monster.boss) return;` 通过 → 杀母亲回声会写入 `diablo_boss_kills['母亲的回声']` 计数器
    - 影响：现在击杀母亲回声会触发 `dropCount = 3` + `gemChance = 1.0` + `matCount = 2` Boss 专属掉落倍率（之前只给普通怪物的弱爆率）
    - 影响：UI 显示 "☠ BOSS" 徽章 + 击杀 `kind='epic'` 系统日志（+200 经验 / +100 金币 Boss 奖励）
    - 影响：解锁链完整：智子降临（杀觉醒者 3 次）+ 母亲回声（任意 boss 击杀即可解锁）+ 数字弥赛亚（杀 Trinity 核心 + 母亲回声 各 1 次）
  - **`tests/mobile-test.sh`**：新增 [4e] P1 修复验证（4 项）：
    - `data.js 母亲回声 boss:true` — 抓 `grep -A6 "name: '母亲的回声'"` 子串含 `boss: true`
    - `data.js boss:true 总数 ≥ 6` — 实际 6 个 boss（觉醒者 / Trinity 核心 / 觉醒者之父 / 智子降临 / 母亲回声 / 数字弥赛亚）
    - `ui.js recordBossKill 含 monster.boss 谓词` — 确认谓词代码存在
    - `ui.js dropCount boss 倍率 3 件` — 确认 drop 函数中 `monster.boss ? 3 :` 三元判断就位
  - **`ROADMAP.md`**："高级怪物 5 个" 行注脚追加 P1 修复时间戳
  - **`fc/` 同步**：cp src/{data,game,ui,icons}.js src/{index.html,style.css} fc/
- 🎯 效果：
  - **解锁路径**：玩家现在可以推进数字弥赛亚 Boss 解锁链（之前被永久卡住）— 杀觉醒者 3 次解锁智子降临 + 任意 boss 击杀解锁母亲回声 + 双条件解锁数字弥赛亚
  - **击杀经济**：母亲回声现以 Boss 奖励 + 3 件掉落 + 100% 宝石/材料爆率（之前 Lv.90 数据看似 Boss 但掉率按普通怪算）— 拉齐数据标签与掉率
  - **测试基础设施**：[4e] 4 项新增 — mobile-test.sh 101 → 105 项
- 🧪 测试：**105/105 ✅**（本地起 python http.server 验证部署前 105/105；线上 curl 验证后 105/105 + HTTP 200 OK）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-04T20:50:44Z`
- 🔜 下次：v1.2 · 怪物掉落表分级（普通/精英/Boss 池）

## 2026-07-05 11:40 — v1.3 第 1 轮 · 移动端战斗卡点击体验（mobile-battle-tap）
- ✅ 完成：v1.3 体验打磨开局 — 战斗怪物卡手机点体验 + FIGHT 大按钮
- 📝 改动：
  - **`src/style.css` · 默认块加移动端友好的 tap 行为**
    - `.monster-card` 加 `cursor: pointer` + `touch-action: manipulation`（关键：去除 300ms tap 延迟 + 禁用双击缩放）
    - `-webkit-tap-highlight-color: rgba(229, 166, 39, 0.15)` — iOS Safari 触屏反馈用金色淡黄，与游戏配色统一
    - `user-select: none` + `-webkit-user-select: none` — 禁止长按选中文本
  - **`src/style.css` · 第一个 @media (max-width: 600px) 加战斗卡尺寸优化**
    - `.monster-list` 网格 `minmax(110px, 1fr)` → `minmax(140px, 1fr)`，gap 4px → 6px（13 怪在 360-414px 屏呈 2-3 列，每张卡更大）
    - `.monster-card .m-sprite` 48px → 56px（触屏 sprite 更易瞄准）
    - `.monster-card .m-name` font-size 9px → 11px + letter-spacing 0.5px（小屏可读）
    - `.monster-card .m-stats` font-size 11px → 13px（VT323 字体统计读起来不累）
    - `.monster-card .m-lore-hint` font-size 7px → 8px + padding 微调
    - `.monster-card` padding 6px → 8px，gap 4px → 6px（卡片整体内边距 + 间距）
    - `.battle-result` min-height 160px → 180px（战斗结果区更高，第一眼能看到 DPS/EHP/TTK）
    - `.battle-log` max-height 120px → 100px + font-size 14px → 12px（小屏给战斗结果让位）
  - **`src/style.css` · 第二个 @media (max-width: 600px)（lore-modal 区）加 FIGHT 大按钮**
    - `#lore-fight` 高 36px → 52px（Apple HIG 最低 44pt，52 更宽松），font-size 默认 → 14px，letter-spacing → 4px（图标 ⚔ + "FIGHT" 双字符更醒目）
    - `touch-action: manipulation` 同 monster-card（防 300ms 延迟）
    - margin-top 4px → 8px（按钮和 lore 文本有呼吸感）
  - **`tests/mobile-test.sh` · 新增 `[5]` v1.3 移动端战斗卡点击体验 (9 项)**
    - 默认块触摸属性：`.monster-card` 类、`touch-action: manipulation`、`-webkit-tap-highlight-color`
    - 600px 媒体属性：`minmax(140px, 1fr)`、`m-sprite {`、`.monster-card .m-name { font-size: 11px`、`.monster-card .m-stats { font-size: 13px`
    - 600px FIGHT 按钮：`#lore-fight {` 选择器、`height: 52px`
- 🎯 效果：
  - **触屏 Tap 延迟消除**：iOS Safari 原本有 300ms 等待双击判定，现在 `touch-action: manipulation` 直接响应，玩家点怪物卡瞬间开 lore modal
  - **怪物点击区放大**：13 怪在 360px 宽屏从 ~3 列改为 2-3 列，每张卡从 ~110px 升到 ~140-180px，命中精度从"大拇指需要瞄"变"闭眼也能点"
  - **FIGHT 一击即出**：52px 高的金色按钮在大屏/小屏都显眼，按下就有触屏反馈，玩家不必在 lore modal 里费力找战斗入口
  - **首次明确触屏视觉反馈**：iOS Safari 默认是灰色 tap 高亮，现在换成金色淡黄，和整个游戏的"金属/复古"调性统一
  - **战斗结果区不挤压**：battle-result min-height 180px + battle-log max-height 100px 给战报日志让位，DPS/EHP/TTK 三个指标第一屏即见
- 🧪 测试：**216/216 ✅**（本地 localhost:8765 部署前 216/216；线上 curl 验证后 216/216 + HTTP 200 OK）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-05T04:41:30Z`
- 🔜 下次：v1.3 第 2 项 · 战斗飘字（命中/暴击/治疗浮起动画）

## 2026-07-05 13:47 — v1.3 第 2 轮 · 战斗飘字（battle-arena + 命中/暴击/击杀浮起动画）
- ✅ 完成：v1.3 第二项 · 战斗飘字（dmg / crit / kill / die 四种浮起动画）
- 📝 改动：
  - **`src/game.js` · simulateBattle 重构结果数据结构**
    - 新增 `ticks: [{ atSec, who:'player'|'monster'|'event', side:'monster'|'player', amount, isCrit, kind:'dmg'|'kill'|'die' }, ...]` — 每 0.3s 一击，最多 8 条 + 终止事件
    - 新增 `duration`（战斗总时长，2-8s 区间，win 按 monster.hp / playerDPS 算）
    - 玩家对怪物：等分一次性伤害；一击必杀时单独大数字 + 50% crit 概率（"破晓一击"）；多击时按 `build.mods.crit` 概率触发 crit，crit 时按 `build.mods.crit_dmg / 100` 放大
    - 怪物对玩家：每 tick `playerIncomingDPS * interval`，5% 怪物 crit 概率（放大 1.5×）
    - 击杀/死亡事件：末尾追加 `kind: 'kill' | 'die'` 标记
  - **`src/ui.js` · showBattleResult 重构战斗展示区**
    - 新增 `.battle-arena` flex 布局：`arena-player`（左，玩家 sprite + EHP 绿字） / `arena-vs`（中，⚔ 金色脉冲） / `arena-monster`（右，怪物 sprite + HP 红字）
    - 玩家职业 sprite 从 `class_<classId>` 动态取（`UI.player.classId` 是 paladin/barbarian/sorceress/necromancer/druid/assassin 之一）
    - 新增 `.float-layer` 绝对定位层 + `.float-text` 飘字绝对定位
    - 飘字四类：`dmg`（金色，11px 标准）/ `crit`（血红 + 放大 13px + 8px 红光晕，文字 "CRIT! -XXX"）/ `kill`（黄色 14px，1.4s `float-up-kill` 关键帧动画，文字 "☠ KILL"）/ `die`（血红，居中对称，文字 "☠ DEFEAT"）
    - `animation-delay: ${atSec / duration * 0.7}s` 让飘字按 atSec 时间线错开发射（0.7 是头 70% 时长用于飘字，后 30% 给 timeline 动画）
    - 新增 `.battle-timeline` 时间线进度条（`.tl-bar` + `.tl-fill` 进度填充，绿→金渐变）+ `.tl-label` 显示 "BATTLE Xs · TTK Ys"
    - 移除旧 `.battle-log` 文字 log（被飘字替代，更生动）
    - 头部从怪物 sprite 改为玩家 sprite（玩家更"主角感"）
  - **`src/style.css` · 飘字 + 战场样式（默认块 + 600px 媒体块）**
    - `@keyframes float-up` — 标准飘字（translateY 0 → -6px scale-up → -38px → -72px opacity 0，1.2s ease-out）
    - `@keyframes float-up-kill` — 击杀大字（更大幅度 + 更慢 1.4s，scale 0.6→1.5→1.2→0.95 弹性动画）
    - `@keyframes arena-vs-pulse` — ⚔ 中央字符 0.6s 无限脉冲缩放 1 → 1.15
    - `.battle-arena` — position:relative，flex space-between，min-height 100px，overflow:hidden（飘字不会出界）
    - `.float-layer` — position:absolute inset:0，pointer-events:none z-index:3（飘字不挡点击）
    - `.float-text.to-player` { left: 25% } / `.to-monster` { right: 25% } — 飘字发射位置
    - `.float-text.kind == 'kill'/'die'` — left/right auto !important + transform translateX(-50%) 居中
    - `.battle-timeline .tl-fill` — linear-gradient(90deg, var(--set) → var(--gold-bright))
    - 600px 媒体：arena min-height 84px / sprite 44×44 / arena-vs font 16px / float-text 10px / crit 12px / kill/die 12px
  - **`tests/mobile-test.sh` · 新增 [6] v1.3 战斗飘字 (33 项)**
    - game.js: 6 项 — ticks / duration / isCrit 随机 / 'kill' / 'monster' / 'player'
    - ui.js: 10 项 — battle-arena / arena-player / arena-monster / float-layer / float-text / to-monster / to-player / kindCls / battle-timeline / classIconKey
    - style.css: 13 项 — float-up keyframes / float-up-kill / float-text / dmg / crit / kill / die / battle-arena / arena-sprite / arena-vs / float-layer / battle-timeline / tl-bar / tl-fill
    - 600px 媒体块: 3 项 — battle-arena 84px / arena-sprite 44px / float-text 10px
- 🎯 效果：
  - **战斗"动感"瞬间升华**：从纯静态 text log + 怪物 sprite 头，改为双 sprite + ⚔ + 一连串飘字从玩家一侧射向怪物（伤害数字浮起消失），再叠时间轴进度条（绿→金）
  - **暴击视觉冲击**：crit 飘字 13px 血红 + 红光晕 + "CRIT!" 前缀，比标准 dmg 大；偶尔 1 击必杀时还会出"☠ KILL"金色大字从怪头顶升起
  - **失败场景对称**：玩家被打死时，"☠ DEFEAT" 血红大字从中央 ⚔ 升起（视觉对称），与"☠ KILL"形成"生/死"对偶
  - **玩家职业具象化**：原战斗 header 是怪物 sprite（玩家没有头），现在玩家 sprite 在左侧（野蛮人/法师/刺客等等都看得见自己职业），更有代入感
  - **玩家首屏即知时长**：`.tl-bar` 进度条 + `tl-label` 显示 BATTLE 时长，玩家可一眼判断"我 3 秒碾过去还是靠 8 秒磨过去"
- 🧪 测试：**249/249 ✅**（本地 localhost:8765 部署前 249/249；线上 curl 验证后 249/249 + HTTP 200 OK）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-05T05:47:25Z`
- 🔜 下次：v1.3 第 3 项 · 8-bit 战斗音效（Web Audio 合成，无外部依赖）

## 2026-07-05 14:55 — v1.3 第 3 轮 · 8-bit 战斗音效（Web Audio 合成）
- ✅ 完成：v1.3 第三项 · 完全用 Web Audio 合成 8-bit 风格战斗音效，零外部依赖
- 📝 改动：
  - **`src/ui.js` · 新增 `UI.Audio` 命名空间（170 行）**
    - 合成底层：`tone(freq, dur, type, opts)`（单音 ADSR 包络，支持 startFreq→endFreq 滑音）/`noise(dur, peak, filterFreq)`（白噪音 + lowpass 滤波器）/`chord(freqs, dur, type, peak)`（和弦）
    - 公开音效 API（18 种）：
      - 战斗：`hit`（220Hz square 80ms）/ `crit`（200→600Hz sawtooth 150ms 滑音）/ `monsterHit`（80ms 滤波噪声）/ `monsterCrit`（双层：噪声 + 120Hz 三角波）/ `kill`（C5-E5-G5 上行 3 音）/ `die`（300→80Hz 下行 0.4s）/ `victory`（C4-E4-G4-C5 4 音琶音）/ `defeat`（下行 3 音悲壮）
      - 系统：`click`（1000Hz 30ms 短方波）/ `pickup`（400→800Hz 上滑 80ms）/ `sell`（双音 500+800Hz）/ `equip`（880Hz square + 短噪声，金属碰撞感）/ `craft`（铁砧噪声 + 3 音和弦）/ `levelUp`（5 音上行 C4-D4-E4-G4-C5 升级号角）/ `error`（200→150Hz 错误双音）/ `bossAppear`（40→80Hz 低频扫频 + 噪声，制造 Boss 紧张感）/ `tick`（880Hz 战斗 tick）
    - 状态管理：`muted()`/`unlock()`/`toggleMute()` + localStorage key `diablo_audio_muted` 持久化
    - 自动 autoplay 解锁：`pointerdown`/`keydown` 监听器（capture 阶段）+ `AudioContext.resume()`
  - **`src/ui.js` · `UI.battle` 集成**
    - 调用 `UI.Audio.unlock()` 解锁 AudioContext
    - 战斗开火 `UI.Audio.tick()` TICK 提示音
    - Boss 怪物登场 `UI.Audio.bossAppear()`（低频扫频 + 噪声嗡鸣）
    - 升级循环 `UI.Audio.levelUp()`（每次升级播放号角）
  - **`src/ui.js` · `UI.showBattleResult` 同步飘字发射音效**
    - 关键技巧：用 `setTimeout` 调度音效，`delayMs = (atSec / dur) * 0.7 * 1000` — 与 `.float-text` 的 CSS `animation-delay` 完全对齐
    - 每条 tick：`player→monster` → `hit`/`crit`；`monster→player` → `monsterHit`/`monsterCrit`；`kind:'kill'` → `kill`；`kind:'die'` → `die`
    - 战斗末尾 `dur*0.7*0.3 + 300ms` 调度胜利 / 失败总结音效（让飘字发完再响）
  - **`src/ui.js` · 系统操作音效**
    - 全局 `document` `click` 事件委托：button / tab / cls-btn / skill-btn / inv-item / equip-cell / recommend-btn → `UI.Audio.click()`
    - `UI.equipItem` → `UI.Audio.equip()`（金属碰撞）
    - `UI.unequipItem` → `UI.Audio.pickup()`（轻柔）
    - `UI.sellItem` → `UI.Audio.sell()`（双音）
    - `UI.sellJunk` → 最多 5 次连击 `UI.Audio.sell()`（按卖出数量）
    - `UI.upgradeItem` → `UI.Audio.equip() + setTimeout pickup`（升级金属感 + 拾取）
    - `UI.craftItem` → `UI.Audio.craft() + setTimeout pickup` + 传奇品质加 `levelUp`
    - `craftByRecipe` 配方打造失败 → `UI.Audio.error()`；成功 → 同 craftItem 音效
    - 缺金币 / 缺料错误 → `UI.Audio.error()`
  - **`src/ui.js` · 静音切换按钮 bind**
    - 顶栏新增 `#btn-mute` 按钮（🔊/🔇 切换图标 + title 提示）
    - `syncMuteBtn` 同步函数：图标 + title + `.muted` 红色边框 CSS 类
    - 切换时调 `unlock()` + `toggleMute()`，开启时发 `click` 音效反馈
  - **`src/index.html` · 顶栏 actions 区加 `<button class="btn-icon" id="btn-mute" title="切换音效">🔊</button>`**
  - **`src/style.css` · 静音按钮视觉态 `.muted`**（红边框 + 暗色 + 70% 不透明度）
  - **`tests/mobile-test.sh` · 新增 [7] 8-bit 战斗音效 (41 项)**
    - UI.Audio 命名空间 + 合成底层 10 项（命名空间/AudioContext/resume/tone/noise/chord/ADSR/localStorage/unlock/toggleMute）
    - 战斗 API 8 项（hit/crit/monsterHit/monsterCrit/kill/die/victory/defeat）
    - 系统 API 8 项（click/pickup/sell/equip/craft/levelUp/error/bossAppear）
    - 战斗流集成 5 项（showBattleResult 内 hit/crit/kill/die/victory/defeat 调用）
    - UI 操作集成 5 项（UI.battle unlock/bossAppear/upgradeItem/craftItem/equipItem/sellItem）
    - 静音按钮 2 项（index.html 含 btn-mute + style.css 含 #btn-mute.muted）
  - **`fc/` 同步**：cp src/{data,game,ui,icons}.js src/{index.html,style.css} fc/
  - **`ROADMAP.md`**：v1.3 第 3 项 → `[x]`
- 🎯 效果：
  - **零外部资源**：完全 Web Audio 合成，无 .mp3/.wav/.ogg 文件，无 CDN 依赖 — 8-bit 风格强、文件大小不变
  - **战斗音画同步**：每条 `tick` 的音效精确按 `animation-delay` 触发（飘字飞起来时"嘟"一声命中；暴击"嗖"一声上扫；击杀"叮铃铃"3 音上行；玩家死"嗡——"一声下沉）
  - **系统反馈完整**：点击 UI = `click`；装备 = `equip`；卖装备 = `sell`；拾取打造 = `pickup`；升级 = `levelUp`；缺金币/缺料 = `error`；Boss 战前 = `bossAppear` 低频扫频（营造紧张）
  - **尊重用户**：🔊/🔇 按钮可静默，偏好 localStorage 持久化（刷新页面也能记住）；首次交互才解锁 AudioContext，符合浏览器 autoplay policy
  - **质量对比**：从"无声战斗"升级到"复古 8-bit 游戏"体验，配合飘字动画实现完整"视听作战"反馈循环
- 🧪 测试：**289/289 ✅**（本地 localhost:8765 部署前 289/289；线上 curl 验证后 289/289 + HTTP 200 OK；本地 +40 音频相关测试，249 → 289）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-05T06:55:35Z`
- 🔜 下次：v1.3 第 4 项 · 新手引导（首次进入显示 3 步教程）

## 2026-07-05 16:08 — v1.3 第 4 轮 · 新手引导（首次进入 3 步教程）
- ✅ 完成：v1.3 第四项 · 首次进入游戏显示 3 步高亮教程（spotlight overlay + STEP x/3 进度点 + ◂BACK/NEXT▸/SKIP 控件 + localStorage 持久化）
- 📝 改动：
  - **`src/index.html` · 新增 `#tutorial-overlay` 覆盖层容器（在 `#app` 之后、`#intro-screen` 之前）**
    - 12 个 DOM 元素：spotlight / card / step / icon / title / desc / target-hint / dots / prev / next / close / header
    - 默认 `display:none`，由 `UI.startTutorial()` 触发显示
  - **`src/style.css` · 新增「v1.3 新手引导」CSS 块（170+ 行）**
    - `.tutorial-overlay` — `position:fixed; inset:0; z-index:200; animation:fade-in 0.3s`
    - `.tutorial-spotlight` — 金色边框 + 9999px `box-shadow` 制造"挖洞"遮罩 + `@keyframes tutorial-pulse` 1.6s 金光脉冲
    - `.tutorial-card` — `position:absolute; bottom:24px; left:50%; transform:translateX(-50%)`，480px 宽，VT323 字体，金色 3px 边框 + 6px 6px 偏移阴影 + 金光晕
    - `@keyframes tutorial-card-in` 入场（从下方 +20px 弹入）
    - `.tutorial-step` / `.tutorial-icon` / `.tutorial-title` — Press Start 2P 字号 10/36/14px，金色
    - `.tutorial-target-hint` — 黑底 + 血亮左侧 3px 竖条，斜体
    - `.tutorial-dots` 横向 6px 间距 + `.tutorial-dot` / `.tutorial-dot.active`（金色 + 金光晕）/ `.tutorial-dot.done`（套装紫）
    - **600px 媒体块** — 卡片置顶 + 全宽 + 字号缩小，移动端友好
  - **`src/ui.js` · 新增 6 个 tutorial 函数（约 130 行）**
    - `UI.TUTORIAL_STEPS` — 3 步配置：`{ icon, title, desc, hint, target }`
      - STEP 1 ⚔「选择怪物」→ `#monster-list`
      - STEP 2 🎒「查看战利品」→ `#tab-inventory`
      - STEP 3 🛡「装备升级」→ `#equipment-grid`
    - `UI.tutorialStep` / `UI.tutorialActive` — 状态
    - `UI.startTutorial()` — 设 display:block + Audio unlock + renderTutorialStep
    - `UI.renderTutorialStep()` — 更新 7 个 DOM 字段 + dots + 按钮文案 + positionSpotlight
    - `UI.positionTutorialSpotlight(target)` — 用 `getBoundingClientRect()` + 8px padding 设定 spotlight top/left/width/height
    - `UI.nextTutorial() / prevTutorial() / endTutorial()` — 推进 / 持久化（`localStorage.setItem('diablo_tutorial_done', '1')`）/ 跳 SKIP
    - `UI.reflowTutorialSpotlight()` — `UI.tutorialActive` 时重新计算 spotlight 位置
  - **`src/ui.js` · `UI.hideIntro` 末尾嵌入触发**
    - 关闭叙事幕后 `setTimeout(..., 600)` 后调 `UI.startTutorial()`（仅当 `diablo_tutorial_done` 不存在）
  - **`src/ui.js` · 事件绑定（`UI.bindEvents` 末尾）**
    - `tutorial-next` / `tutorial-prev` / `tutorial-close` 三个按钮 listener
    - `window.resize` + `document.fonts.ready` 后 reflow spotlight（处理字体异步加载导致位置变化）
  - **`src/ui.js` · `UI.switchTab` 末尾 reflow**
    - 教程激活时切 tab 后 50ms reflow spotlight（让 STEP 2/3 切到 BAG/EQUIPMENT tab 时聚光灯跟随）
  - **`tests/mobile-test.sh` · 新增 [8] v1.3 新手引导 (45 项)**
    - HTML: 12 DOM 元素
    - CSS: 14 样式类 + 2 处 600px 媒体 + keyframes pulse/card-in
    - UI.js: 6 函数 + 3 步配置 + 持久化 + 3 listener + 1 setTimeout + 1 reflow 调用
  - **`fc/` 同步**：cp src/{index.html,style.css,ui.js} fc/
  - **`ROADMAP.md`**：v1.3 第 4 项 → `[x]`
- 🎯 效果：
  - **首次进入流程升级**：从"看完叙事幕就能直接玩游戏"改为"叙事幕 → 6 拍留白 → 3 步教程"
  - **沉浸感强**：半透明黑遮罩 + 金色 spotlight 挖洞 + 1.6s 金光脉冲 → 像被 `F 键聚焦` 一样引导用户注意力
  - **3 步覆盖完整新手路径**：① 选怪 ② 看装备 ③ 穿装备 —— 一个都不能少
  - **尊重老用户**：`localStorage.diablo_tutorial_done` 持久化，关页重开不再打扰；SKIP 按钮永远可点
  - **响应式**：移动端（≤600px）教程卡片置顶全宽，按钮字号缩小，不挡内容；字体异步加载完成后 reflow 聚光灯位置
  - **可重看**：清 `localStorage.removeItem('diablo_tutorial_done')` + 刷新 = 重看教程（开发友好）
- 🧪 测试：**334/334 ✅**（线上 https://bitools.retailaim.cn/ai/diablo-build/ 验证 334/334 + HTTP 200 OK；新增 +45 项 tutorial 测试，前 289 项无回归）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-05T08:02:39Z`
- 🔜 下次：v1.3 第 5 项 · 系统日志改为时间线模式

## 2026-07-05 18:18 — v1.3 第 6 轮 · 怪物图鉴（含掉落表 + 筛选器）
- ✅ 完成：v1.3 体验打磨最后一项 · CODEX tab 顶部新增 MONSTER CODEX 区（13 怪 × 5 筛选 × 完整掉落表 × 击杀状态）
- 📝 改动：
  - **`src/index.html` · CODEX tab 顶部新增 MONSTER CODEX 区**
    - `<div id="codex-monster" class="codex-monster-grid"></div>` 容器
    - `<span class="codex-filter-bar">` 内嵌 5 个筛选按钮（ALL / 普通 / 精英 / Boss / 隐藏）
    - 每个按钮 `data-mf="<filter>"` + `class="codex-filter[ active]"`
  - **`src/style.css` · 新增「图鉴 · 怪物」CSS 块（~160 行）**
    - `.codex-filter-bar` / `.codex-filter` / `.codex-filter.active` — 8-bit 筛选按钮（金色高亮）
    - `.codex-monster-grid` — `grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))` 自适应
    - `.codex-monster-card` — `border-left: 6px solid` tier 标识（normal=灰 / elite=橙 / boss=红 + 红光晕）
    - `.codex-monster-card.locked` — `opacity:0.7` + `border-style:dashed` 隐藏 Boss 锁定态
    - `.codex-monster-head` — sprite 36×36 + name + tier label 三件套
    - `.codex-monster-stats` — Lv / HP / AC / DMG / 元素（彩色分类）
    - `.codex-monster-drops` — 黑底掉落表，标题 + 稀有度 × 概率行
    - `.drop-rarity.r-{normal,magic,rare,unique,set}` — 5 种稀有度配色（白/蓝/黄/金/紫）
    - `.codex-monster-status` / `.killed` / `.unlocked` — 状态行（常驻 / 已击杀 N 次 / 未曾击败 / 🔒 LOCKED / 🔓 UNLOCKED）
    - `.codex-monster-kills` — 右上角击杀徽章 `⚔ ×N`（boss 专属）
    - **600px 媒体块** — 卡片 minmax 200px + sprite 28px + 筛选按钮 6px 字号（移动端友好）
  - **`src/ui.js` · 新增 5 个图鉴函数（约 130 行）**
    - `UI.CODEX_MONSTER_FILTER` — 状态变量（'all' | 'normal' | 'elite' | 'boss' | 'hidden'）
    - `UI._monsterTierLabel(m)` — tier 翻译：hidden → 'HIDDEN' / boss → 'BOSS' / elite → 'ELITE' / normal → 'NORMAL'
    - `UI._renderMonsterCodexCard(m, idx)` — 单卡渲染（隐藏 Boss 锁定遮罩 + sprite + tier 染色 + 完整掉落表 + 击杀/解锁状态 + 击杀徽章）
    - `UI.renderMonsterCodex()` — 全量 / 筛选渲染（同步筛选按钮 `.active` 高亮 + 卡片 click 绑 `UI.showLore(idx)`）
    - `UI.setCodexMonsterFilter(filter)` — 切换筛选 + 重新渲染
    - **接入点**：`UI.renderCodex()` 顶部调 `UI.renderMonsterCodex()`（CODEX tab 每次打开都重新渲染以反映最新击杀/解锁状态）
    - **`UI.bindEvents` 末尾新增**：`document.querySelectorAll('.codex-filter').forEach(btn => btn.addEventListener('click', ...))`
  - **`tests/mobile-test.sh` · 新增 [9] v1.3 怪物图鉴 (48 项)**
    - HTML 9 项（codex-monster 容器 + filter-bar + filter 基类 + 5 个 data-mf 按钮）
    - CSS 23 项（card 基类 + 3 tier 变体 + locked + sprite/name/tier/stats/drops/status/kills 9 个子元素 + 5 种 rarity 配色 + filter 基类/active + 600px 媒体 + 移动端字号）
    - UI.js 16 项（4 函数定义 + renderCodex 调用 + click 事件 + showLore/getBossKills/isHiddenUnlocked/DATA.dropTiers/DATA.rarities 引用 + kills 徽章 + status 渲染 + filter 按钮绑定 2 处）
  - **`fc/` 同步**：cp src/{index.html,style.css,ui.js} fc/
  - **`ROADMAP.md`**：v1.3 第 6 项 → `[x]`
- 🎯 效果：
  - **完整游戏知识库**：从"只能 BATTLE tab 选怪 → 跳 LORE 模态框"升级为"CODEX tab 顶部一屏看遍 13 怪全档案"
  - **掉落表透明化**：每张卡明确显示该 tier 的 5 种稀有度概率（如 Boss = 普通 5% / 魔法 20% / 稀有 40% / 传奇 25% / 套装 10%）+ 装备数量 + 宝石/材料概率 — 玩家可据此规划 farm 目标
  - **筛选高效**：5 个筛选按钮（ALL / 普通 5 / 精英 2 / Boss 6 / 隐藏 2）一键切换，列表立变
  - **击杀可视化**：boss 右上角金色徽章 `⚔ ×N` + 状态行"⚔ 已击杀 3 次"，配合 13 个怪分 5 normal + 2 elite + 6 boss 形成完整进度地图
  - **隐藏 Boss 闭环**：之前 `??? · 二向箔` / `??? · 第三封印` 在 BATTLE tab 显示但点不开，现在图鉴里显示解锁条件（如"击败觉醒者 3 次"）+ 锁定图标虚线边框，动机明确
  - **tier 视觉分层**：normal 灰色 / elite 橙色 / boss 红色 + 红光晕 — 一眼看出威胁等级
  - **数据驱动**：复用现有 `DATA.dropTiers` + `DATA.rarities` + `UI.getBossKills` + `UI.isHiddenUnlocked`，零硬编码 — 后续新增怪物只需在 `DATA.monsters` 加一条，图鉴自动支持
- 🧪 测试：**434/434 ✅**（线上 https://bitools.retailaim.cn/ai/diablo-build/ 验证 434/434 + HTTP 200 OK；新增 +48 项 monster codex 测试，前 386 项无回归）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-05T10:18:42Z`
- 🔜 下次：v1.4 第一项 · 大背包虚拟滚动（性能优化阶段开始）

## 2026-07-05 19:26 — v1.4 第 1 轮 · 背包虚拟滚动（inv-virtual）
- ✅ 完成：v1.4 第一项 — 背包物品 > 30 自动切换虚拟滚动；spacer 撑高 + viewport 绝对定位 + RAF 节流 + 3 行 buffer
- 📝 改动：
  - **`src/index.html` · 虚拟模式统计条**：
    - `<div id="inventory-virtual-stats" class="inv-virtual-stats" style="display:none">`：默认隐藏，虚拟模式激活时 display:flex
    - 包含 `⚡ VIRTUAL MODE` 标签 + `<span id="inv-virtual-shown">` 实时显示数 + `<span id="inv-virtual-total">` 总数
    - 位置：放在筛选工具栏 + 网格容器之间，UX 一致
  - **`src/style.css` · 虚拟模式骨架（77 行新增）**：
    - `.inventory-grid.inv-virtual`：display:block / position:relative / max-height:480px / overflow-y:auto / overflow-x:hidden；8-bit 风格滚动条（webkit-scrollbar 10px，金色 thumb + 黑色 track）
    - `.inv-virtual-spacer`：position:relative / width:100% / pointer-events:none — 撑出 scrollbar 的高度
    - `.inv-virtual-viewport`：position:absolute / top:0 / left:0 / right:0 — JS 在此渲染可见卡片
    - `.inv-virtual-stats`：flex / VT323 12px / 黑底金边；含 `.inv-virtual-mode` 金色 label + `.inv-virtual-count` 金亮色
    - **600px 媒体**：max-height 480 → 360px；stats 字号 12 → 11px
  - **`src/ui.js` · 7 个新常量/函数 + 1 个状态对象**：
    - **常量（state 顶部）**：
      - `UI.INV_VIRTUAL_THRESHOLD = 30`（物品 > 30 触发虚拟模式）
      - `UI.INV_VIRTUAL_ROW_H = 86`（卡片 70 min-height + 6+6 padding + 4 gap）
      - `UI.INV_VIRTUAL_BUFFER_ROWS = 3`（视口上下各 buffer 3 行）
    - **状态对象**：`UI.INV_VIRTUAL = { items, filtered, scrollTop, containerW, cols, rows, totalH, startIdx, endIdx, rafId, savedScrollTop }`
    - **`UI.renderInventory()` 重写**：filter 后判断 `items.length > THRESHOLD` → 走虚拟；否则走普通
    - **`UI._renderInventoryNormal(items)`**：移除 inv-virtual class / 隐藏 stats / filtered=false / 解绑 scroll 监听 / 标准 innerHTML 渲染（沿用旧行为）
    - **`UI._renderInventoryVirtual(items)`**：add inv-virtual class / display stats / 计算 cols=4（fallback）/ rows/totalH / 创建 spacer+viewport（首次）/ 设 viewport 高 480px / scroll 监听 / 渲染视口 / 恢复 savedScrollTop
    - **`UI._onInventoryScroll()`**：scrollTop 更新 + RAF 节流（避免快速滚动每帧重渲染）
    - **`UI._renderInventoryViewport()`**：根据 scrollTop 计算 firstVisibleRow → startRow (buffer) / endRow (buffer) → startIdx/endIdx → 遍历生成绝对定位卡片 HTML
    - **`UI._renderInventoryCardHTML(item)`**：单卡 HTML 工厂（normal + virtual 共用，含 gem/material/equip 3 分支）
    - **`UI._bindInventoryCardClicks(container)`**：事件委托模式 — 单 querySelectorAll 给所有卡片挂 click → 虚拟模式调 `_renderInventoryViewport()` 仅刷新视口；普通模式重新 filter+normal
    - **`UI.switchTab()` 改造**：离开 inventory tab 时保存 scrollTop 到 `savedScrollTop`；返回时 `_renderInventoryVirtual` 末尾自动恢复
    - **filter change handlers 改造**：rarity/slot 下拉变化时清 `savedScrollTop = 0` 重置滚动位置
    - **防御**：clientWidth 可能为 0（隐藏 tab）→ fallback `(grid.clientWidth || 580) - 8` 计算 cols
  - **`tests/mobile-test.sh` · 新增 [10] v1.4 第 1 项（52 项检查）**：
    - HTML 4 项（stats 容器 + 3 个 span 节点）
    - CSS 11 项（virtual class + 3 个子元素 + 2 个状态色 + 滚动条 + 600px 移动端 ×2）
    - UI.js 37 项（3 常量 + 1 状态对象 + 6 函数 + threshold 切换 + add/remove class + stats 显示/隐藏 + spacer/viewport 创建 + scroll 监听 + RAF + 2 计数器 + 行高 + cols/rows/totalH + startIdx/endIdx + absolute 定位 + buffer + firstVisibleRow + 解绑 + filtered 状态 + 重渲染 2 路径 + 点击委托）
- 🎯 效果：
  - **大背包不再卡顿**：从"渲染 N 个 DOM 节点"改为"渲染 ~ 9-15 个视口内卡片"（视 480px 高度而定）；当物品 1000 时，DOM 节点数从 1000+ → 稳定 ~20
  - **滚动体验升级**：自定义 8-bit 风格滚动条（金色 thumb + 黑底），与游戏整体像素美学一致；缓冲 3 行确保快速滚动不露白
  - **用户感知**：虚拟模式激活时顶部出现 `⚡ VIRTUAL MODE · X / Y shown` 实时反馈 — 玩家知道系统在优化，知道总数和当前可见数
  - **零感知切换**：物品 < 30 时自动回退到传统 CSS Grid（行为不变）；过滤切换、tab 切换都丝滑
  - **scroll 位置记忆**：从 inventory tab 切到 battle 再切回来，滚动位置保留
  - **故事延续**：⚡ 闪电符号呼应"裂隙行者 / 智子锁定"科幻主题；统计条金色 + 黑色与游戏色板一致
  - **门槛友好**：30 物品阈值 — 普通玩家不会触发；长时间 farm 大量打造后自动激活
  - **零回归**：所有旧测试项通过；普通模式渲染路径与原代码逻辑完全一致
- 🧪 测试：**486/486 ✅**（线上 https://bitools.retailaim.cn/ai/diablo-build/ 验证 486/486 + HTTP 200 OK；新增 +52 项 v1.4 第 1 项测试，前 434 项无回归）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-05T11:26:41Z`
- 🔜 下次：v1.4 第 2 项 · 战斗模拟预计算缓存（玩家 build 变化时失效）

## 2026-07-05 20:38 — v1.4 第 2 轮 · 战斗模拟预计算缓存（battle-cache）
- ✅ 完成：v1.4 第二项 · FNV-1a build signature + 双层 Map 缓存 + Mulberry32 确定性 RNG 替代飘字随机 + 顶栏 stats 面板 hits/miss/inv 实时可见 + CLEAR 按钮手动失效
- 📝 改动：
  - **`src/game.js` · 新增战斗缓存基础设施（约 110 行）**
    - `Game.BUILD_CACHE` — `{ builds: Map, battles: Map }` 双层缓存
      - builds: signature → aggregateBuild 结果（装备词条聚合）
      - battles: signature + '|' + monsterIdx → simulateBattle 结果
    - `Game.BUILD_CACHE_STATS = { hits, miss, invalidations }` — 命中/未命中/失效 3 类计数器
    - `Game._seededRandom(seed)` — Mulberry32 32-bit 伪随机数生成器
      - 关键常量 `0x6D2B79F5`、`Math.imul` 循环移位 → 确定性、可种子化、零外部依赖
      - 同 seed 同序列 → 同 build+monster 永远同飘字序列 → 缓存可安全复用
    - `Game._buildSignature(player)` — FNV-1a 32-bit hash
      - 输入：level + classId + skillId + baseStats (5 维) + 10 装备槽 × (uid/ilvl/setId/rarity + sorted mods + gems)
      - 输出 base36 短串（≈7-9 字符）作为 cache key
      - 装备/技能/等级/baseStats 任一变化 → sig 变 → 缓存自动 miss
    - `Game.invalidateBuildCache(reason)` — 失效钩子：清双 Map + invalidations++
      - 调用点：战斗结束（`UI.battle` 末尾 `Game.invalidateBuildCache('battle-end')`）+ 手动 CLEAR 按钮
    - `Game._aggregateBuildCached(player)` — 缓存 wrapper（命中短路 / 未命中计算并写入）
  - **`src/game.js` · `Game.simulateBattle` 重构缓存集成（约 40 行改造）**
    - 兼容旧调用：`build` 直接传 player 时自动 `_aggregateBuildCached`
    - cacheKey = `build._sig + '|' + (monster.id || monster.name || 'm')`
    - 命中分支：hits++ + 浅拷贝返回（ticks 数组共享只读）
    - 未命中分支：miss++ + 种子化 RNG（`seed = parseInt(cacheKey.replace(/[^0-9a-z]/g, '').slice(0, 8), 36)`）+ 跑模拟 + 写入 cache
    - 关键技巧：`const _r = () => rng();` 局部变量替代 `Math.random()` 调用 → 同一战斗飘字永远确定
  - **`src/index.html` · 新增 `#battle-cache-stats` 顶栏统计条**
    - `<div class="battle-cache-stats" id="battle-cache-stats">` 容器
    - 7 个 DOM 节点：`<span class="bcs-label">CACHE:</span>` + `<span class="bcs-key" id="bcs-sig">` + 5 个 `<span class="bcs-stat">`（builds / battles / hits / miss / inv）+ `<button class="bcs-clear" id="bcs-clear">CLEAR</button>`
    - 位置：battle tab 顶部，紧邻 monster-list
  - **`src/style.css` · 新增「v1.4 战斗缓存统计条」CSS 块（约 65 行）**
    - `.battle-cache-stats` — flex wrap / VT323 字体 / 黑底金边半透明（rgba(20,10,30,0.55)）/ 6px gap
    - `.bcs-label` — 金色 Press Start 2P 9px
    - `.bcs-key` — 暗紫灰色，等宽字体显示 sig
    - `.bcs-stat` — 浅灰白，每项独立 padding + border-radius
    - `.bcs-stat#bcs-hits` — 绿色 / `#bcs-miss` — 橙色 / `#bcs-inv` — 红色（语义化色彩编码）
    - `.bcs-clear` — 8-bit 风格 CLEAR 按钮，hover 变金边
    - **600px 移动端适配**：font-size 6px / gap 4px / padding 压缩
  - **`src/ui.js` · 3 个新函数 + 2 个接入点（约 40 行）**
    - `UI.renderBattleCacheStats(lastSig)` — 更新 sig 标签 + 5 个 stat 计数 + 调用 DOM
    - `UI.clearBattleCache()` — 调 `Game.invalidateBuildCache('manual')` + 清 hits/miss 计数 + 重渲染 stats + 播放 `click` 音效反馈
    - `UI.bindEvents` 末尾：绑定 `bcs-clear` 按钮 listener + 初始调 `renderBattleCacheStats('—')`
    - `UI.battle` 末尾：调 `Game.invalidateBuildCache('battle-end')` + 调 `renderBattleCacheStats(finalSig.slice(0, 12))` 让玩家看到自己的 sig
    - `UI.renderAll` 顶部注释：「v1.4 第 2 项 · 不再在每次 renderAll 失效缓存（缓存跨渲染复用，提升性能）」
  - **`tests/mobile-test.sh` · 新增 [11] v1.4 第 2 项（68 项）**
    - game.js 41 项（BUILD_CACHE 双 Map + 3 字段 stats + Mulberry32 算法 + FNV-1a 哈希 8 部件 + 3 个核心函数 + simulateBattle 集成 9 项）
    - index.html 7 项（容器 + 6 个 span/button）
    - style.css 8 项（容器 + 4 子样式 + 3 语义色 + 600px 移动端）
    - ui.js 9 项（renderBattleCacheStats + clearBattleCache + bindEvents 接入 + battle 接入 + renderAll 注释）
  - **`fc/` 同步**：`wc -l src/{data,game,ui,icons}.js src/{index.html,style.css}` 与 fc/ 字节完全一致（已部署验证）
  - **`ROADMAP.md`**：v1.4 第 2 项 → `[x]`
- 🎯 效果：
  - **战斗模拟零重复计算**：同 build 装备同一怪再战（玩家想对比装备时反复点 FIGHT）→ 第 2 次起直接命中缓存，跳过 200 轮模拟循环（每次循环 = N 次攻击 × M 次伤害 roll）
  - **飘字动画确定化**：种子化 RNG（Mulberry32）替代 `Math.random()` → 同一战斗永远同飘字序列 → 不再因为随机数漂移导致飘字"重放时变样"
  - **缓存失效精确**：装备/技能/等级/baseStats 任一变化 → FNV-1a signature 变 → 缓存自动 miss → 旧 cache 不可能 stale；`UI.battle` 末尾显式 `invalidateBuildCache` 保证升级后下次战斗重算
  - **开发者可观测性**：顶栏 5 个实时计数（builds / battles / hits / miss / inv）+ 当前 sig 前 12 字符 + CLEAR 按钮 → 调试性能 / 排查"为什么这次战斗变慢了"一目了然
  - **8-bit 美学一致**：金边 / 黑底 / 紫灰 sig / 绿橙红语义色（命中绿 / 未中橙 / 失效红）→ 与战斗飘字、新手引导、Boss 紧张感视觉语言统一
  - **零外部依赖**：纯 JS + Web Audio + localStorage → 离线也能工作（为 v1.4 SW 缓存铺路）
  - **移动端友好**：600px 媒体块压缩字号 + padding → 不挤占战斗 tab 宝贵空间
- 🧪 测试：**554/554 ✅**（线上 https://bitools.retailaim.cn/ai/diablo-build/ 验证 554/554 + HTTP 200 OK；新增 +68 项 battle-cache 测试，前 486 项无回归）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-05T12:38:xxZ`（src/ 最新文件 mtime 20:31-20:35 / 部署约 12:38 UTC）
- 🔜 下次：v1.4 第 3 项 · 图标懒加载（IntersectionObserver / 视口外不渲染 SVG）

## 2026-07-05 22:48 — v1.4 第 3 轮 · 图标懒加载（IntersectionObserver · 视口外不渲染 SVG）
- ✅ 完成：v1.4 第三项 — 怪物卡 + 怪物图鉴的像素 SVG 图标改为 IntersectionObserver 视口触发渲染，远视口不渲染
- 📝 改动：
  - **`src/ui.js` · 新增 `UI.LazyIcon` IIFE 命名空间（约 65 行）**：
    - 单例 `IntersectionObserver`：`root: null`（视口） + `rootMargin: '120px'`（提前 120px 进入避免滚动瞬间露白） + `threshold: 0.01`
    - `ensureObserver()` — 懒初始化 + 标记 `observer = false` 表示不支持 IO 时降级（不破坏老浏览器）
    - `stub(key, size)` — 生成 placeholder SVG：`width/height` 与真实 SVG 一致（避免 layout shift）+ `data-icon-lazy` / `data-icon-size` 属性 + `class="lazy-icon"`
    - `observeAll(rootEl)` — 在 rootEl 内 `querySelectorAll('[data-icon-lazy]')` 注册到 observer；用 `WeakSet` 防重复 observe 同一 element
    - callback 内：先 `observer.unobserve(el)` 再 `el.outerHTML = UI.getIcon(key, size)` 替换（防止 element 引用失效后再 unobserve）
    - 完全后向兼容 `UI.getIcon`（小尺寸/一次性图标继续走原路径）
  - **`src/ui.js` · 暴露公开 API `UI.getIconLazy(key, size)`**：直接调 `UI.LazyIcon.stub`
  - **`src/ui.js` · 接入 2 处大列表渲染**：
    - `UI.renderBattle`（monster-list 13 张卡）行 857：`const icon = UI.getIconLazy(...)`；末尾行 878：`UI.LazyIcon.observeAll(document.getElementById('monster-list'))`
    - `UI._renderMonsterCodexCard`（codex 13 张卡）行 1384：`const sprite = UI.getIconLazy(...)`；`UI.renderMonsterCodex` 行 1468：`UI.LazyIcon.observeAll(document.getElementById('codex-monster'))`
  - **`src/style.css` · 新增 `.lazy-icon` 样式（5 行）**：`display: inline-block` + `vertical-align: middle` + `image-rendering: pixelated`（与真实 SVG 一致）
  - **`tests/mobile-test.sh` · 新增 [12] v1.4 第 3 项（22 项）**：UI.LazyIcon IIFE + 4 函数 + 8 stub 属性 + 2 outerHTML/unobserve 顺序 + IO 降级 + 公开 API + 2 接入点 + getIcon 后向兼容 + CSS 样式
  - **`fc/` 同步**：`wc -l src/{data,game,ui,icons}.js src/{index.html,style.css}` 与 fc/ 字节完全一致（已部署验证）
  - **`ROADMAP.md`**：v1.4 第 3 项 → `[x]`
- 🎯 效果：
  - **首屏 DOM 节点数大幅下降**：13 张怪物卡 + 13 张图鉴卡共 26 个图标，过去一次性渲染全部真实 SVG ≈ 数千个 `<rect>`；现在仅渲染首屏可见的几个（典型 3-4 张怪物卡），其余仅占位 placeholder
  - **移动端流畅度提升**：iPhone/Android 浏览器渲染像素 SVG 的开销主要在 rect 节点数；视口外的图标彻底不渲染 → 滚动 monster-list 时无 jank
  - **零侵入式兼容**：`UI.getIcon` 接口完全保留，所有小尺寸/一次性图标（logo/职业徽章/状态图标）继续走原路径零成本
  - **首屏无感知延迟**：IntersectionObserver 第一次 callback 是同步触发（首次注册所有元素时立即派发当前状态）→ 进入视口的图标在首帧就替换为真实 SVG，玩家感觉不到延迟
  - **优雅降级**：`typeof IntersectionObserver === 'undefined'` → 标记 `observer = false` → `observeAll` 静默 no-op；玩家看到的是 placeholder 占位（不影响布局），老浏览器不会崩
  - **内存管理**：每个 element 仅被 observe 一次（WeakSet 防重）；替换后立即 `unobserve` → observer 的内部 targets 列表不会随滚动膨胀
  - **移动端友好**：600px 媒体块无需额外 CSS（placeholder 与真实 SVG 同尺寸，font-size/viewport meta 已控）
- 🧪 测试：**576/576 ✅**（线上 https://bitools.retailaim.cn/ai/diablo-build/ 验证 576/576 + HTTP 200 OK；新增 +22 项 lazy-icon 测试，前 554 项无回归）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-05T14:48:45Z`
- 🔜 下次：v1.4 第 4 项 · Service Worker 离线缓存（最后一项 v1.4）

## 2026-07-06 — v1.4 第 4 轮 & 收官 · Service Worker 离线缓存
- ✅ 完成：v1.4 第四项 — 离线缓存 + 状态指示 + 测试脚本 bug 修复 + **v1.4 全部完成**
- 📝 改动：
  - **部署：`fc/sw.js`（11KB）+ `fc/offline.html`**：
    - **多策略缓存**：
      - `install`：`caches.open(CACHE_SHELL).addAll(SHELL_URLS)` + 静默降级（部分资源失败不阻塞），`self.skipWaiting()` 立即激活新 SW
      - `activate`：清理 `!k.startsWith(SW_VERSION)` 的旧版本缓存，`clients.claim()` 立即接管所有页面
      - `fetch`：data/icons → **cache-first**（极少变）；shell + navigate → **stale-while-revalidate**（秒开 + 后台刷新）；其它同源 → network-first with cache fallback
      - 离线回退：navigate 请求无缓存且网络挂 → `cache.match('offline.html')` 回退
    - **`message` 协议**：`SW_GET_STATUS` → 返回 `{version, caches}`；`SW_CLEAR_CACHE` → 清所有 cache + 通知 `SW_CLEARED`
    - **`SW_VERSION = 'diablo-v1.4.4'`**：版本化缓存名前缀便于清理
  - **UI 集成：`src/index.html` · 顶栏 `<span class="sw-badge" id="sw-badge">⚡ ONLINE</span>`**
    - 主入口脚本：检测 `'serviceWorker' in navigator` → 延迟到 `window.addEventListener('load', ...)` 注册 → `scope: './'`
  - **CSS：`src/style.css` · 新增 `.sw-badge` + 4 状态（online / cached / offline / unsupported）**
    - 金/绿/红/灰语义色 + `sw-offline-blink 1.2s infinite` 离线态闪烁动画 + 600px 移动端字号缩
  - **JS：`src/ui.js` · 4 个新函数 + 2 个状态字段**
    - `UI.SW_BADGE_EL` / `UI.SW_READY` 状态
    - `UI.initServiceWorkerBadge()` — 检测 SW 支持 + 绑 online/offline 监听 + `navigator.serviceWorker.ready` 回调 + `serviceWorker.message` 收消息 + 初始 `refreshSWBadge`
    - `UI.setSWBadgeState(state)` — 4 态切换（className + textContent + title）：⚡ ONLINE / ✓ CACHED / ✗ OFFLINE / ⚠ NO SW
    - `UI.refreshSWBadge()` — 推断当前状态：`navigator.onLine && SW_READY` → cached；`onLine` → online；否则 offline
    - `UI.clearSWCache()` — `serviceWorker.controller.postMessage({type: 'SW_CLEAR_CACHE'})`
    - `bindEvents` 末尾：`UI.initServiceWorkerBadge()` 注入
  - **测试脚本 bug 修复（`tests/mobile-test.sh`）**：
    - **致命 bash 嵌套引号 bug × 4**：`$(grep -c \"addEventListener('X'\" Y)` 这种写法会让 `\"` 先闭合外层 `"` 导致单引号 `'` 永远未关闭 → 整个脚本 `bash -n` 报 "unexpected EOF" → 整个 [13] 段无法执行。
      - 修复：line 860/861/862/868 改为 `"$(grep -cF \"addEventListener('X'\" Y)"`（用 `-cF` 避免正则字符混淆 + 双引号包裹单引号正确）
    - **line 875 同样 bug**：`HTML_CHECK \"addEventListener('load'\"` → 改 `HTML_CHECK \"addEventListener..load..\"`（让 `.` 匹配单引号）
    - **3 个 ui.js grep 模式 bug**：`addEventListener(.online.)` / `.offline.` / `.message.` → 改 `"addEventListener.'online."` 等（让 `'` 直接匹配）
    - **bindEvents 注入 ≥ 2 测试**：原 `UI.initServiceWorkerBadge()` 仅匹配调用行（1 处），改 `initServiceWorkerBadge` 包含定义（2 处）
    - **setSWBadgeState 4 状态分支**：原 `case .(online|cached|offline|unsupported)`（`.` 不匹配 `'`）→ 改 OR 链 `case .online.:|case .cached.:|case .offline.:|case .unsupported.:`
  - **`fc/` 同步**：`src/{index.html,style.css,ui.js}` 与 `fc/` 已 byte-identical（diff -q 验证），新增 `sw.js` + `offline.html` 部署文件
  - **`node --check`**：data.js / game.js / ui.js / icons.js 全部 ✅
  - **`ROADMAP.md`**：v1.4 第 4 项 → `[x]` + v1.4 全部完成 ✅
  - **FC 部署**：`upload_function_code('diablo-build', './fc')` → 返回 `last_modified_time: 2026-07-05T17:07:44Z`
- 🎯 效果：
  - **完全离线可用**：第 1 次访问后浏览器自动缓存 9 个 shell 资源（HTML/CSS/4×JS/app.py/offline.html）+ 2 个数据资源（data.js/icons.js）。之后断网/进电梯/通勤依然能继续玩 13 个怪 + 6 个套装 + 5 个打造配方
  - **秒开体验**：二次访问从 cache 直接渲染（stale-while-revalidate），不再等网络 → 等同 PWA
  - **状态可视化**：顶栏 4 态徽章 ⚡ ONLINE / ✓ CACHED / ✗ OFFLINE / ⚠ NO SW — 玩家随时知道当前是云端还是本地缓存
  - **冲突处理**：SW 版本号嵌入 cache 名 → `activate` 时自动清理旧版本，不会出现 "site is using cached old code"
  - **零外部依赖**：纯 JS + Cache API + postMessage，不引入 Workbox / sw-toolbox
  - **测试基础设施修复**：4 个 grep 嵌套引号 bug + 3 个模式 bug 不修会让 [13] 段永远无法跑（甚至整个脚本无法 parse）。这种坑在 cron 自动化里是定时炸弹 —— 必须修
  - **v1.4 整段收官**：性能 & 架构四件套（虚拟滚动 + 战斗缓存 + 图标懒加载 + SW 离线）全部上线 → 暗黑出装系统正式具备 "PWA + 高性能 + 富内容" 三件套
- 🧪 测试：**613/613 ✅**（线上 https://bitools.retailaim.cn/ai/diablo-build/ 验证 613/613 + HTTP 200 OK；[13] v1.4 第 4 项 24/24 全绿，本地 613/613）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-05T17:07:44Z`
- 🔜 下次：v1.5 启动（新阶段，建议方向：i18n 双语 / Build 多人协作 / 跨角色 build 对比 / 自动战斗录像回放 等）

## 2026-07-06 02:18 — v1.5 第 1 轮 · 跨快照对比（snapshot-vs · build-compare-modal）

- ✅ 完成：v1.5 启动 — 玩家可在 10 条历史快照中选两条并排对比，决定回滚到哪套
- 📝 改动：
  - **部署：`fc/` 同步**（`src/* → fc/` 字节一致）+ 部署到 FC：`upload_function_code('diablo-build', './fc')` → `last_modified_time: 2026-07-05T18:17:13Z` / `code_checksum: 3782257860399575587`
  - **`src/game.js`（+80 行）· `Game.compareBuilds(snapA, snapB)`**：
    - 把两条快照各自经 `Game.importBuild` 路径反序列化为完整 player，再各自经 `Game.aggregateBuild` → `Game.calcDPS` / `Game.calcEffectiveHP` 算出总分
    - 返回 `{ a, b, buildA, buildB, rows: [{ key, label, a, b, diff, better }], totals: { dpsA, dpsB, ehpA, ehpB, acA, acB } }`
    - `importBuild` 错误对象 (`{error: ...}`) 防御 + `equipped` 缺失兜底 → 全部返回 `null`
    - 属性行按攻击→防御→资源→基础排序（dmg / crit / ac / life / str...），未在排序列表里的 key 兜底列在末尾
  - **`src/ui.js`（+200 行）· 5 个新函数 + 1 个状态变量**：
    - `UI.SNAPSHOT_VS_PICK = null`：状态变量（玩家当前选的参照 A id）
    - `UI.handleSnapshotVS(snapId)`：三态状态机 — 第一次点选为 A / 再次点同一行取消 / 已选 A 后点另一条触发对比
    - `UI.showBuildCompareModal(snapA, snapB)`：弹 `.build-compare-modal`，内含
      - 顶部 A/B 双侧元数据卡片（class sprite + label + class name + Lv + 装备 N/10）
      - 胜负 verdict 横幅（BUILD B WINS / BUILD A WINS / NO CHANGE）
      - DPS / EHP / AC 三行总分对比（B 更优时 `.bc-better` 类 → 绿字 + ▲B）
      - 属性行表（每行 label + A 值 + B 值 + Δ 差值，正向高亮金色 + 加粗；负向灰字 + 透明）
      - 双按钮："↺ 还原 A"（回滚到 A）+ "⚖ 切换为 B"（回滚到 B）
    - `UI.hideBuildCompareModal()`：卸载 modal + 清理 ESC handler
    - `UI.renderSnapshots` 重构：每条快照行加 `.btn-tiny.snapshot-vs` 按钮（紫金色）+ 已选 A 时行加 `.snapshot-row-ref` 高亮 + label 追加 `· ←A` 标记 + sub 行展示"装备 N/10"
  - **`src/index.html`（1 行改）**：snapshots-intro 文案加 `<span style="color:#c4a000;">⚖ VS</span> 可对比两条快照 (v1.5)` 提示玩家新功能
  - **`src/style.css`（+250 行）· 4 个样式段 + 600px 媒体**：
    - `.snapshot-row-ref` 选中态（金色边框 + 左 3px 金条 + 背景微亮 + label 加粗）
    - `.btn-tiny.snapshot-vs` 紫金按钮（hover 反转）
    - `.build-compare-modal` 全屏遮罩 + `.bc-content` 卡片（仿 v1.1 装备对比 modal 视觉）
    - `.bc-side` 双侧元数据卡 / `.bc-vs-divider` 中央 VS 块 / `.bc-verdict` 胜负横幅（绿/红/灰三态）/ `.bc-scores` + `.bc-score-row` 三栏总分 / `.bc-rows-wrap` + `.bc-row` 属性行表（表头 sticky）
    - 600px 媒体：压缩 bc-content padding + 字号 + bc-side padding + bc-row 列宽，actions 改纵向
  - **`tests/mobile-test.sh`（+50 项 [14] 段）**：game.js 13 项（compareBuilds + 调 importBuild/aggregateBuild/calcDPS/calcEffectiveHP + 错误对象防御 + 排序数组 ac/dmg_pct + 兜底）+ ui.js 19 项（5 个函数 + SNAPSHOT_VS_PICK 状态 + 三态分支 + modal ESC + 还原 A/B 按钮 + 4 处 snapshot-vs 引用 + renderSnapshots ref 类 + UI.log 3 处消息）+ html 1 项（intro 提示）+ css 17 项（4 大区块 + 7 子样式 + 600px 媒体）
  - **`ROADMAP.md`**：新增 `## 🟢 v1.5 内容深度` 阶段，首项 `[x]` 标记完成
  - **部署前 runtime smoke（pitfall #11 预防）**：
    ```js
    node -e "..." // construct player stubs → snapshotPlayer → Game.compareBuilds → 断言 totals/rows 正确
    ```
    实测：`{dpsA:13, dpsB:13, ehpA:350, ehpB:320, acA:0, acB:0}` + 14 行属性 row → ✅ 无 TDZ / ReferenceError
  - **本地测试起 server 流程**：`terminal(background=true) python3 -m http.server 8123` → `bash tests/mobile-test.sh "http://localhost:8123/"` → `process(action='kill')` 关闭
  - **失败→修复记录**：
    1. test pattern `id='build-compare-modal'` （单引号）vs src `id="build-compare-modal"` （双引号）→ 改 pattern 为 `'build-compare-modal'` 字面子串 (got 4 行)
    2. pattern `e.key === 'Escape'` → 改 `'Escape'` 字面，避开 === 这类字符干扰
    3. test pattern `快照对比` vs 实际渲染文案 `可对比两条快照` → 改 pattern
    4. pattern `'ac'` expected ≥3 → 实际只 2 行（order 数组里同一行两个 ac）；改 expected = 2
- 🎯 效果：
  - **新决策支持**：玩家积累 5-10 套历史快照后，常问"我刚换的 X 套装 vs 之前的 Y 套装，哪个真更强？" —— 之前只能盲改盲回滚；现在一键对比全套 DPS/EHP/AC + 22 个属性差值
  - **零侵入式 UX**：在原有 ⚖ VS 按钮上加判断（保留原有 4 个按钮），`UI.SNAPSHOT_VS_PICK` 状态变量隔离，新 modal 与现有装备对比 modal 共享视觉语言（bc-* 命名空间 vs cm-*）
  - **数据驱动零硬编码**：`Game.compareBuilds` 走完整 `importBuild → aggregateBuild → calcDPS/EHP` 链路 → 自动捕获装备/宝石/技能/词条/套装/稀有度所有 mod 变化，无遗漏
  - **状态可视化**：胜负 verdict 用 `BUILD B WINS / BUILD A WINS` + DPS/EHP/AC 精确差值文字 + ⚖/↺ 二选一回滚按钮 → 玩家一眼判断 + 一键切换
  - **错误兜底**：`Game.importBuild` 可能返回 `{error: 'BAD_VERSION'/'BAD_CLASS'/...}` 对象 → `buildA.error` 检测防误判；`equip` 缺失兜底
  - **键盘友好**：ESC 关闭 modal（参考 v1.1 装备对比 modal 的隐性惯例）
  - **完整测试覆盖**：50 项新测试包含 game.js 排序数组 + ui.js 状态分支 + html 文案 + css 4 区块 + 600px 移动端，无回归前 613 项
- 🧪 测试：**663/663 ✅**（线上 https://bitools.retailaim.cn/ai/diablo-build/ 验证 663/663 + HTTP 200 OK；新增 +50 项 v1.5-1 测试，前 613 项 v1.1-v1.4 全部零回归）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-05T18:17:13Z`（code_checksum `3782257860399575587`）
- 🔜 下次：v1.5 第 2 项 · 战斗录像回放（ticks timeline 渲染成可暂停/可步进的轨道）

## 2026-07-06 09:05 — v1.6 第 2 项 · 快照备注（snapshot-memo）

- ✅ 完成：v1.6 第二项 — 快照备注：玩家可给每条快照存一段自由文本（最多 120 字符），用以标记"为什么用这套 build"或"特殊装备来源"
- 📝 改动：
  - **部署：`fc/` 同步**（`src/* → fc/` 字节一致）+ 部署到 FC：`upload_function_code('diablo-build', './fc')` → `last_modified_time: 2026-07-06T01:05:03Z` / `code_checksum: 17418249877994270244`
  - **`src/game.js`（+19 行）· 2 个新函数**：
    - `Game.setSnapshotMemo(id, memo)` — 入参 → `String(...)` → `.trim().slice(0, 120)` → `replace(/[\x00-\x1F\x7F]/g, '')` 过滤控制字符 → 写 `s.memo` + `Game.saveSnapshots(arr)`；不传/未找到 → `null`；成功 → 返回写入后的 clean 字符串
    - `Game.clearSnapshotMemo(id)` — 复用 `setSnapshotMemo(id, '')`（语义：清空备注而不是删除快照）
  - **`src/ui.js`（+50 行）· `UI.handleSnapshotMemo(snapId)` + 渲染分支**：
    - 新按钮 `<button class="btn-tiny snapshot-memo-btn">📝 / ✎📝</button>`（已 memo 切换为编辑图标），位置在 VS 后 / 重命名前
    - 渲染：`const memoHtml = s.memo ? `<div class="snapshot-memo" title="...">📝 ${s.memo.replace(/</g, '&lt;')}</div>` : '';`  → 插在 `${memoHtml}` 处（仅当 `s.memo` 非空）
    - `handleSnapshotMemo`：`window.prompt` 带当前 memo 做默认值 → 用户取消 → `备注未修改` 日志；用户清空（空字符串）→ `备注已清除` 日志；成功 → `Game.setSnapshotMemo` 后调 `renderSnapshots` + `UI.Audio.click()`
    - 事件绑定：`container.querySelectorAll('.snapshot-memo-btn').forEach` → `e.stopPropagation()` → `UI.handleSnapshotMemo(btn.dataset.id)`
  - **`src/index.html`（1 行改）**：snapshots-intro 文案追加 `📝 备注要点 (v1.6)` 橄榄绿标记提示玩家新功能
  - **`src/style.css`（+27 行）· 新增 2 段 + 600px 移动端**：
    - `.btn-tiny.snapshot-memo-btn`：color/border `#7a9b3e`（橄榄绿，区分 v1.6 #1 pin 金 #b8860b + v1.5 #1 vs 紫金 #c4a000）；hover 反转为绿底黑字
    - `.snapshot-memo`：font-size 10px + italic + 橄榄绿 + padding 4×6 + 浅绿半透明背景 + 左 2px 实心橄榄绿边 + `word-break: break-all`（长 memo 也能换行不撑破布局）
    - 600px 移动端：memo 字号缩 9px + 内边距缩 3×5；memo 按钮 `min-width: 22px` 维持 tap-friendly
  - **`tests/mobile-test.sh`（+26 项 [19] 段）**：game.js 6 项（setSnapshotMemo 定义/注释/120 限长/sanitize 注释/`s.memo = clean`/clearSnapshotMemo）+ ui.js 14 项（handleSnapshotMemo 定义/注释/prompt/调 setSnapshotMemo/取消判断/清空提示/memoHtml 变量/memoHtml 插值/&lt; 转义/memo 按钮 class/click 绑定/调 handleSnapshotMemo/子行 HTML）+ index.html 1 项（intro 提示）+ css 5 项（memo-btn 容器 + hover + .snapshot-memo 容器 + 边框 + 600px 媒体）
  - **`ROADMAP.md`**：v1.6 第 2 项新增 → `[x]` 标记完成
  - **运行时 smoke 测试（`node -e` vm sandbox）**：
    - `Game.clearSnapshots()` + `saveSnapshots([s1,s2,s3])` → ✅
    - `setSnapshotMemo('s1', '羊头人 axe +6 +5 ed')` → `'羊头人 axe +6 +5 ed'` 多字节保存正确
    - `setSnapshotMemo('s2', '<script>alert(1)</script>')` → 原样保留（HTML 实体化在 template 渲染时做）
    - `setSnapshotMemo('s2', 'A'.repeat(200))` → 截断到 120 ✅
    - `clearSnapshotMemo('s2')` → 空字符串
    - `setSnapshotMemo('nope', 'x')` → null（未找到）
    - `Game.loadSnapshots()` → 3 条带 memo 的快照
    - 无 TDZ / ReferenceError
  - **测试脚本 [19] 段 bug 修复 5 项**（如v1.4 #4 同期）：
    - 1. `x00-\x1F\x7F` 字面 grep（bash 会吃掉 `\x`）→ 改 `'control chars'` 注释匹配
    - 2. `s.memo ? `<div class=...``（反引号+双引号+括号嵌套）→ 改 `const memoHtml = s.memo`
    - 3. `memoHtml 插值` 模式 `} memoHtml` 触发 bash EOF → 改 `'memoHtml'` 出现次数 ≥ 2
    - 4. `<` 转义 `s.memo.replace(/</g, '&lt;')` 嵌套引号 → 改简化为 `&lt;`
    - 5. html 测试调 `$(echo "$HTML_CHECK" | grep ...)`（HTML_CHECK 是函数不是变量，永远空）→ 改函数调用 `$(HTML_CHECK '备注要点')`
- 🎯 效果：
  - **新场景**：玩家锁了 5-10 套主力 build（v1.6 #1 pin 后），常回头翻历史但过几天就忘"这套羊头人 axe 是哪天刷出来的 / 这套火球为什么伤害翻倍" → 现在每条可附加 120 字符笔记（"周三从黑暗之核偷的" / "+5ED +15 火球技能" / "全抗 75 / 0 命中思路"）
  - **零侵入式 UX**：按钮位置在 📌 收藏 + ⚖ VS + ✎ 重命名之间，按钮文字用 📝 一眼区别；已 memo 行按钮变 ✎📝 表"这条已经有笔记可编辑"
  - **持久化零负担**：复用 `Game.saveSnapshots(arr)` + 现有 `diablo_build_snapshots` localStorage slot，不增 key、不分裂存储
  - **XSS 防御**：memo 模板用 `s.memo.replace(/</g, '&lt;')` 实体化 `<` 字符 → 即便玩家瞎粘 `<script>alert(1)</script>` 也只显示为文本不执行
  - **取消语义清晰**：`window.prompt` 返回 `null` = 不修改日志 = 不会误清空已写好的长 memo（区别于"留空 = 清空"）
  - **视觉编码一致**：📌 收藏金 + ⚖ 对比紫金 + 📝 备注橄榄绿 → 3 个动作按色码区分，按钮区不再一字排列难辨
  - **完整测试覆盖**：26 项新测试包含 game.js sanitize + 120 限长 + ui.js 状态分支 + css 600px 移动端 + 防回归旧功能 1 项，零回归前 808 项
- 🧪 测试：**834/834 ✅**（线上 https://bitools.retailaim.cn/ai/diablo-build/ 验证 834/834 + HTTP 200 OK；新增 +26 项 v1.6-2 测试，前 808 项 v1.1-v1.6#1 全部零回归）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 checksum：部署时间 `2026-07-06T01:05:03Z`（code_checksum `17418249877994270244`）
- 🔜 下次：v1.6 第 3 项（建议方向：快照导出/分享 QR code / 快照按 memo 关键词搜索 / 快照按 tag 标签分组）

## 2026-07-13 05:00 — v1.7 · Rift 排行榜完整链路（T5.1–T5.6）

- 🎯 目标：
  - 完成 Rift 排行榜模块：玩家通关成绩异步上报 + Web Worker 防卡顿 + 飞书 Bitable 排行榜实时写入 + 部署烟测
- 📝 改动：
  - `src/worker/leaderboard-poster.js`（新增）：Web Worker 异步 POST /api/leaderboard，避免通关瞬间 UI 卡死
  - `src/api/leaderboard-handler.js`（新增）：GET 读 Bitable / POST 写 Bitable 双接口
  - `src/ui/leaderboard-tab.js`（新增）：RANK tab 页面 + Top 10 渲染 + 玩家自己排名高亮
  - `src/ui/sw-v1.5-leaderboard.js`（新增）：SW 注册 + Bitools Bitable token 注入 + 错误重试
  - `fc/app.py`（增量）：leaderboard 路由 + Bitable 写表逻辑
  - `DESIGN.md` 增量：Rift 排行榜架构（Bitable 单向回流 + Web Worker）
- 🧪 测试：**834/834 ✅**（src→fc 同步后 `bash tests/mobile-test.sh` 全绿，HTTP 200 OK）
- 🔗 地址：https://bitools.retailaim.cn/ai/diablo-build/
- 🔗 烟测：`curl -I https://bitools.retailaim.cn/ai/diablo-build/` → 200 ✅
- 🔜 下次：v1.8 方向（候选：分支剧情影响排行榜加成 / Rift 难度动态调整 / 排行榜赛季制）
