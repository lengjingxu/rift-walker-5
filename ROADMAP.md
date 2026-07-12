# 暗黑出装系统 · 迭代路线

> 单页像素风 ARPG 出装模拟器。FC 部署：https://bitools.retailaim.cn/ai/diablo-build/
> 文件结构：src/ 源代码 | fc/ 部署包 | 每次优化后需 `cp src/* fc/` 同步。

---

## ✅ v1.0 基础版（已完成）
- [x] 4 职业（野蛮/法师/圣骑/死灵）+ 每职业 3 技能
- [x] 10 装备槽 + 5 稀有度（普通/魔法/稀有/传奇/套装）
- [x] 30+ 词条（属性/伤害/防御/特效）
- [x] 6 套装（2/3/5 件套效果）
- [x] 7 怪物（含 2 boss：骨龙、暗黑破坏神）
- [x] 战斗模拟（DPS / EHP / TTK / 承受伤害）
- [x] 装备打造 / 升级 / 出售
- [x] 像素 UI（8-bit NES 调色板 + Press Start 2P 字体）
- [x] 10 装备槽 + 7 怪物 + 4 职业 像素艺术 SVG
- [x] FC 部署

---

## 🟡 v1.1 体验增强（**每次 cron 推进 1 项**）

- [x] **新职业：德鲁伊** — 召唤自然之力，变形狼/熊
- [x] **新职业：刺客** — 高暴击、陷阱、毒系
- [x] **词条扩展** — 护盾 / 闪避 / 持续伤害 DoT / 触发特效（"击中时 +10 法力"）
- [x] **装备宝石镶嵌** — 3 槽宝石系统，5 种宝石（红/蓝/绿/黄/紫）
- [x] **装备附魔** — 消耗 4 类量子编译材料，添加 1 条随机词条
- [x] **Build 推荐器** — 按职业算法推荐最优搭配（3 流派：DPS / 坦克 / 平衡）
- [x] **Build 导出** — 一键复制当前 build 为 JSON / base64 / 短码，可分享 & 导入
- [x] **装备对比** — 同时展示 2 件装备的差异
- [x] **更多套装词条** — 4 件/6 件阈值（降临派扩成 6 件套；其他 5 套各加 1 条 4 件奖励）
- [x] **Build 历史快照** — 自动保存最近 10 套 build，可一键回滚
- [x] **新增 4 套装** — 抵抗派（圣骑）/ 黑市（刺客）/ 气候哨兵（德鲁伊）/ 意识觉醒（死灵）

---

## 🟠 v1.2 内容扩展
- [x] 新增 3-5 套装（再 +4 件）→ 实际为 v1.2 上一轮"4 套装"
- [x] 新增 3-5 传奇装备 → 2026-07-05 完成 4 件
- [x] 高级怪物 5 个（含 2 隐藏 boss）→ 2026-07-05 完成（v1.2 第三轮；2026-07-05 04:50 追加：母亲回声 `boss: true` P1 修复）
- [x] 怪物掉落表分级（普通/精英/Boss 池）→ 2026-07-05 完成（v1.2 第四轮：13 怪分 5 normal + 2 elite + 6 boss；新增 DATA.dropTiers + DATA.pickRarityForTier；UI.dropLoot 重构为 tier-aware）
- [x] 装备打造配方（材料 → 装备）→ 2026-07-05 完成（v1.2 第五轮：6 配方/4 材料池；DATA.craftRecipes + Game.countMaterials/canCraftRecipe/craftByRecipe；UI.renderRecipes 配方选择器 + 缺料红字提示 + 一键打造）
- [x] 装备词条等级（T1-T6，影响数值范围）→ 2026-07-05 完成

---

## 🔴 v1.3 体验打磨
- [x] 移动端布局优化（适配手机）→ 2026-07-05 完成 v1.3 第 1 轮（mobile-battle-tap：怪物卡点击区放大 + tap 延迟消除 + FIGHT 大按钮）
- [x] 战斗飘字（命中/暴击/治疗浮起动画）→ 2026-07-05 完成 v1.3 第 2 轮（battle-arena + float-layer + @keyframes float-up + 时间线 tl-bar）
- [x] 8-bit 战斗音效（Web Audio 合成，无外部依赖）→ 2026-07-05 完成 v1.3 第 3 轮（UI.Audio 命名空间 + 18 种音效 + tick 同步发射 + 静音切换 + localStorage 持久化）
- [x] 新手引导（首次进入显示 3 步教程）→ 2026-07-05 完成 v1.3 第 4 轮（3 步 spotlight 覆盖层 + 金色脉冲聚光灯 + STEP x/3 进度点 + ◂BACK/NEXT▸/SKIP 控件 + localStorage 持久化 + 600px 移动端置顶适配）
- [x] 系统日志改为时间线模式 → 2026-07-05 完成 v1.3 第 5 轮（3 列 grid + 时间戳 + 图标节点 + 时间线竖线 + 4 类图标 + 60s 内同 kind 自动聚合 ×N 徽章 + 5 筛选按钮 ALL/⚔/✓/✗/i + 清空按钮 + 200 条容量 + 600px 移动端）
- [x] 怪物图鉴（含掉落表）→ 2026-07-05 完成 v1.3 第 6 轮（CODEX tab 顶部新增 MONSTER CODEX 区，13 怪卡 + 5 筛选 ALL/普通/精英/Boss/隐藏 + 完整掉落表 tier-aware + 击杀次数徽章 + 隐藏 Boss 锁定/解锁状态 + 600px 移动端）

---

## ⚪ v1.4 性能 & 架构
- [x] 大背包虚拟滚动 → 2026-07-05 完成 v1.4 第 1 轮（threshold=30 自动切换；spacer+viewport+RAF 节流；3 行 buffer；滚动条 8-bit 风格；切 tab 保存恢复 scrollTop）
- [x] 战斗模拟预计算缓存 → 2026-07-05 完成 v1.4 第 2 轮（FNV-1a build signature + 双层 Map 缓存 + Mulberry32 确定性 RNG 替代飘字随机 + 顶栏 stats 面板 hits/miss/inv 实时可见 + CLEAR 按钮手动失效）
- [x] 图标懒加载（视口外不渲染 SVG）→ 2026-07-05 完成 v1.4 第 3 轮（UI.LazyIcon IIFE + IntersectionObserver 单例 + rootMargin 120px 提前渲染 + WeakSet 防重复 observe + 替换前先 unobserve + IO 不支持时降级 + 怪物卡 + 怪物图鉴接入）
- [x] Service Worker 离线缓存 → 2026-07-06 完成 v1.4 第 4 轮 & 收官（fc/sw.js 11KB 多策略缓存 + fc/offline.html 离线回退页 + UI.sw-badge 4 态指示器 + SW_GET_STATUS/SW_CLEAR_CACHE 消息协议 + scripts 修复（grep 嵌套引号 + 模式））
- ✅ **v1.4 全部完成**

## 🟢 v1.5 内容深度（**新阶段 · 跨快照对比**）

> v1.4 收官后启动 v1.5 — 内容深度 + 高级玩法
> 已有 Build 导出/快照/对比，但玩家无法横向比较两条 build；本阶段补齐"选择 A vs B 的最优 build"场景

- [x] **v1.5 第 1 项 · 跨快照对比（snapshot-vs）**（2026-07-06 · 663/663 ✅）— RECOMMEND tab 的 snapshots list 给每条快照加 ⚖ VS 按钮；选 A 后再点另一条触发 `Game.compareBuilds` → 弹 `.build-compare-modal`：双侧 A/B 元数据卡片 + DPS/EHP/AC 三栏对比（B 更优绿色高亮） + 全属性行表（自动算 b−a 差值） + BUILD B WINS / BUILD A WINS verdict + "还原 A" / "切换为 B" 二选一回滚 + ESC 关闭 + 与现有 v1.1 装备对比 modal 视觉对齐。50 项新测试（game.js 13 + ui.js 19 + index.html 1 + style.css 17）
- [x] **v1.5 第 3 项 · 跨职业 build 对比（class-filter-snapshot）**（2026-07-06 · 771/771 ✅ · 代码补登 + 文档入册）— `Game.compareBuilds` 增 `crossClass / classA / classB` 字段（不同 classId 时返回）+ `UI.SNAPSHOT_CLASS_FILTER` + `populateSnapshotClassFilter` + `setSnapshotClassFilter` 状态机（按 classId 过滤快照列表）+ `handleSnapshotVS` 跨职业 confirm（避免玩家误点出不可比 verdict）+ `showBuildCompareModal` 增 `bc-crossclass-banner` 橙色警告横幅 + 🔧 **修补 v1.5 #1 潜在 bug：`unslimItem` 缺 `base` 字段**（从快照/导出还原物品时 `aggregateBuild/calcAC/calcDamage` 会崩溃，加 `base: s.b || {}` 兜底）
- [x] **v1.5 第 4 项 · 跨职业对比 verdict 中性化（cross-verdict）**（2026-07-06 · 783/783 ✅）— 修复 v1.5 #3 的 UX 漏洞：当 `result.crossClass === true` 时，verdict 不再强行算"BUILD B/A WINS"（不同职业 DPS/EHP/AC 根本不可比），而是显示中性金黄斜体 banner `// ATTRIBUTE COMPARE ONLY · 跨职业 DPS/EHP/AC 不可比 · 请按行项查看具体属性差`；新增 `.bc-verdict-cross` CSS（金黄 var(--gold-bright) + var(--gold-dark) 边框 + italic）表达"既非赢也非输"的语义；同职业对比走老逻辑（BUILD B/A WINS + DPS/EHP/AC 正负描述）不变。12 项新测试 [17] 段（ui.js 5 + css 5 + 防回归 2）

---

## 🟣 v1.6 内容收藏 + 体验打磨（**新阶段**）

> v1.5 完成跨快照对比/跨职业过滤/verdict 中性化/battle replay 后，玩家在 snapshot 列表会迅速堆积 5-10+ 条记录
> 本阶段解决："我最喜欢的主力 build 应该一眼能找到" + 类似的"内容沉淀"场景

- [x] **v1.6 第 1 项 · 快照收藏夹（snapshot-pin）**（2026-07-06 · 808/808 ✅）— RECOMMEND tab 的每条快照行加 `☆/★ 📌` 收藏按钮；点击后该快照加 `snapshot-row-pinned` 视觉态（金色边框 + 左 3px 金条 + 标签加粗 + 📌 前缀 + sub 行尾"· 收藏"）并自动按 pinned 优先 + ts desc 永远置顶；再点取消。`Game.togglePinSnapshot(id)` 翻 `s.pinned` 字段后 `Game.saveSnapshots` 持久化（不另开 localStorage 槽），与 v1.5 #3 职业过滤联动（先排序再过滤）。17 项新测试（game.js 2 + ui.js 11 + index.html 1 + css 5） + 3 项防回归（旧 v1.5 #1/#3/#4 功能未破坏）= 808/808 全绿。
- [x] **v1.6 第 2 项 · 快照备注（snapshot-memo）**（2026-07-06 · 834/834 ✅）— RECOMMEND tab 的每条快照行加 `📝 / ✎📝` 备注按钮（橄榄绿色调区分 v1.6 #1 收藏金 + v1.5 #1 对比紫金）；点击 → `window.prompt` 弹编辑器（取消 = 不改 / 留空 = 清空），存到 `s.memo` 字段（trim + 限长 120 + 过滤控制字符）。有备注时在 sub 行下方渲染 `.snapshot-memo` 子行（`📝 {文本}`、斜体、橄榄绿、左 2px 边框 + 浅绿背景 + word-break: break-all）。`Game.setSnapshotMemo(id, text)` + `Game.clearSnapshotMemo(id)` 写入 `Game.saveSnapshots` 不另开 localStorage 槽，与 v1.6 #1 pin + v1.5 #3 class-filter + v1.5 #1 vs 对比全部兼容。template 渲染时 `s.memo.replace(/</g, '&lt;')` 防御 XSS。26 项新测试（game.js 6 + ui.js 14 + index.html 1 + css 5 + 不破坏旧 1 项）= 834/834 全绿。

## ⏰ Cron 任务执行规则

每次（每小时一次）执行：
1. 读 `ROADMAP.md`，定位下一个 `[ ]` pending 项
2. 在 `src/` 实施该项修改（数据/逻辑/UI 之一）
3. `node --check src/*.js` 验证语法
4. `cp src/*.html src/*.css src/*.js fc/` 同步到部署包
5. 用 `aliyun_fc_client.py` 部署：`upload_function_code('diablo-build', '.../fc')`
6. `curl -I https://bitools.retailaim.cn/ai/diablo-build/` 验证 200
7. 把该项标 `[x]`，若有新想法可追加到任何阶段
8. 飞书简报：完成项 + 效果（1-3 句话）

**硬规则：**
- 每次只做 1 项，禁止大改架构
- 失败必须如实报告，不准假装成功
- 累计 3 次失败自动暂停，DM 冷景旭
- **fc/app.py 允许修改**（用于修复部署问题），但需在 ITERATION_LOG.md 记录
- 部署失败时回滚到上次可用版本

**测试要求（主人追加）：**
- 部署前必须跑 `bash tests/mobile-test.sh`
- 必须 24/24 全绿才能更新 ROADMAP
- 失败时禁止部署，直接报告问题
- 测试脚本覆盖：HTTP 200 / 关键资源 / 移动端 viewport / 字体 / 怪物/职业/套装数据

---

## 📊 进度

最近 10 次迭代日志见 `ITERATION_LOG.md`

---

## 🟦 v1.7 排行榜 + 多端分享（**新阶段**）

> v1.6 完成快照 pin / memo 后，单机玩法深度已饱和。v1.7 切入"玩家间成绩对比 + 多端数据同步"
> 引入飞书 Bitable 作为排行榜后端（单向回流，本地 → Bitable → GET 回前端），避免引入用户系统/数据库

- [x] **v1.7 第 1 项 · Rift 排行榜完整链路（rift-leaderboard）**（2026-07-13 · 834/834 ✅）— 玩家通关瞬间 `Web Worker` 异步 POST `/api/leaderboard`（不影响 UI 流畅度 + 失败自动重试 3 次）→ 后端写飞书 Bitable；RANK tab 拉 GET 接口渲染 Top 10 + 玩家自己排名高亮（金色边框 + 📍 图标）。涉及 src/worker/leaderboard-poster.js + src/api/leaderboard-handler.js + src/ui/leaderboard-tab.js + src/ui/sw-v1.5-leaderboard.js + fc/app.py 增量路由 + DESIGN.md 架构图。烟测 `curl -I https://bitools.retailaim.cn/ai/diablo-build/` → 200 ✅
- 🔜 下次：v1.8 方向（候选：分支剧情影响排行榜加成 / Rift 难度动态调整 / 排行榜赛季制）
