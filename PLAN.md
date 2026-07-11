# 裂隙行者 5% · 开发计划

> 总周期估算：**5 阶段 × 1 周 = 5 周**（其中 Phase 1-2 必须先，Phase 3-5 可并行到不同 cron 任务）

---

## Phase 1 · 骨架（Day 1-2）

**目标**：跑通基础循环，无美术、无叙事、无嵌入

### 任务清单
- [x] **T1.1** `src/rift/state.js` —— 新 state 模块（爬塔进度 / 资源池 / 带入清单）
- [x] **T1.2** `src/rift/climb.js` —— 主循环（层 → 战斗 → 决策 → 继续/撤退 modal）
- [x] **T1.3** `src/rift/rest.js` —— 休息站 UI（换装 / 升级 / 融入三个 tab）
- [x] **T1.4** `src/rift/economy.js` —— 金币 / 血瓶 / 卖出 / 兑换
- [x] **T1.5** `src/rift/battle.js` —— `simulateBattle` 改开放式 tick 战斗
- [x] **T1.6** 60 怪列表扩展（13→60，覆盖 lv 1-34，tier normal:35 / boss:10 / elite:15）
- [x] **T1.7** 7 boss 列表 + boss gate 检测

### 验收
- 能起手进入爬塔，第 1 层战斗可见飘字
- 决策 modal 三选一可点
- 死亡结算不显示分数，显示"带出 X / 失去 Y"

---

## Phase 2 · 决策点 + 道德分支（Day 3-4）

**目标**：玩家有真实选择，每个选择影响游戏流

### 任务清单
- [x] **T2.1** 血瓶带入决策（每 10 层强制 modal，强制补 1 个）
- [x] **T2.2** 战斗技能输入窗口（5/15/25/35 boss 战）
- [x] **T2.3** 道德选择 modal（"终结"vs "不伤"，双选累积计数器）
- [x] **T2.4** 道德分支剧情事件：
  - 选"不伤"偏多 → 20 层遇到"迷失儿童"
  - 选"终结"偏多 → 25 层遇到"觉醒者的女儿找爸爸"
- [x] **T2.5** 融入 gacha（B 曲线）+ 升级线性（A 曲线）

### 验收
- Boss 5 / 10 / 15 / 20 / 25 / 30 / 35 都有道德选择
- 选择回流到后续剧情层事件
- 装备融入 UI 跑通（3 件 → 概率显示动画 + 结果）

---

## Phase 3 · 美术资产（Day 5-7，并行）

**目标**：7 boss 立绘 + 7 过场插图 + 真照片终局

### 任务清单
- [x] **T3.1** gpt-image prompt 模板：主角（黑白手绘 Sin City 风）→ docs/PROMPTS.md
- [x] **T3.2** gpt-image prompt 模板：怪物（Junji Ito + glitch 风）→ docs/PROMPTS.md（9 变体：5 normal + 2 elite + 3 boss，三档调性梯度）
- [x] **T3.3** gpt-image prompt 模板：boss 戏剧肖像（David Lynch 风）→ docs/PROMPTS.md（7 boss 变体：共享 Lynch 通用前缀/后缀，每张含单件时代错位物，眼神直视镜头且空）
- [x] **T3.4** 7 boss 立绘生成 + 每 5 张汇报（设计/规格/脚本/汇报模板已落 `docs/BOSS_PORTRAITS_SPEC.md` + `assets/boss/{README,generation_log}`；实际 gpt-image-2 调用 blocked by `GPT_IMAGE_API_KEY`，留冷景旭手动触发；详见 spec §7）
- [x] **T3.6** 取消 8-bit 像素感，但保留骨架（按 Q8；移除 18 处 `image-rendering: pixelated` + `image-rendering: crisp-edges`，font-smoothing 改 antialiased；sprite 尺寸/边框/调色板/像素字体骨架保留）

> T3.5 / T3.7 因无 `GPT_IMAGE_API_KEY` 凭证无法由 cron 自动执行，已移至本文末「Deferred Tasks」区段，等冷景旭手动触发

### 验收
- 每个 boss 有 4 帧攻击动画 sprite sheet
- 过场插图能在 div 切换时显出震撼落差
- 终局切换从游戏风到真实照片风（视觉冲击）

---

## Phase 4 · 叙事 + 悲剧故事（Day 8-9）

**目标**：7 段悲剧文案 + 终局元层揭示

### 任务清单
- [x] **T4.1** Boss 5 "漫游者·王" 故事 200 字 *(344 中文字；写入 `docs/BOSS_STORIES/T4.1_漫游者王.md` + 嵌入 `src/rift/climb.js` BOSS_MAP.5.story/moralHook + `climb-ui.js` 渲染管线支持长篇；240705 commit)*
- [x] **T4.2** Boss 10 "算法警察" 故事 200 字 *(219 中文字；写入 `docs/BOSS_STORIES/T4.2_算法警察.md` + 嵌入 `src/rift/climb.js` BOSS_MAP.10.story/moralHook；smoke PASS)*
- [x] **T4.3** Boss 15 "母亲回声" 故事 250 字（呼应"女儿找爸爸"分支）· docs/BOSS_STORIES/T4.3_母亲回声.md，246 中文字，CT-0714 父亲镜像 + 99.7% 母亲重写 + 47 段声纹
- [ ] **T4.4** Boss 20 "Trinity 核心" 故事 250 字
- [ ] **T4.5** Boss 25 "觉醒者·父" 故事 300 字
- [ ] **T4.6** Boss 30 "智子降临" 故事 300 字
- [ ] **T4.7** Boss 35 "终局翻转为玩家" 故事 400 字（最重）
- [ ] **T4.8** A_Rebel / B_Inheritor / C_Glitched 三套结局文案
- [ ] **T4.9** Q1-Q6 哲学命题定制（按结局出现不同答案）

### 验收
- 每段悲剧故事 200-400 字，符合已有 STORY.md 世界观
- 3 结局分支 + 1 终局翻转文案精雕

---

## Phase 5 · 排行榜 + 收尾（Day 10）

**目标**：上线 + 提交首次 commit + push

### 任务清单
- [ ] **T5.1** 排行榜前端 POST 异步逻辑（worker 避免阻塞游戏）
- [ ] **T5.2** 飞书 Bitable 写入：player / buildHash / score / floor / goldRemaining / itemsBroughtOut / itemsLost / ending / classId / submittedAt
- [ ] **T5.3** 排行榜页面（前端 + GET 接口）
- [ ] **T5.4** Service Worker 缓存更新策略
- [ ] **T5.5** `cp src/* fc/` 同步 + FC 部署（`aliyun_fc_client.py upload_function_code`）
- [ ] **T5.6** 烟测：`curl -I https://bitools.retailaim.cn/ai/diablo-build/` → 200
- [ ] **T5.7** GitHub commit + push
- [ ] **T5.8** ROADMAP + ITERATION_LOG 更新

### 验收
- 玩家结束游戏 → 飞书表多 1 条记录
- 排行榜页面能 GET 列 top 20
- FC URL 健康
- GitHub main 分支 commit 含所有 source

---

## 自动化与 cron

按主人要求：「每次功能更新后 commit + 小时级别提交 + 跟踪未完成任务」：

### 维护型 cron 任务 1：每 1 小时 commit 1 次
- **时间表**：`0 * * * *`
- **触发**：git diff 有未 commit 改动 → 自动 add + commit "chore: hourly checkpoint"
- **防呆**：连续 3 次 commit 失败 → DM 主人

### 维护型 cron 任务 2：每 30 分钟检查"未完成"任务
- **时间表**：`*/30 * * * *`
- **检查项**：
  - DESIGN.md 的设计原则是否被违反
  - PLAN.md 当前 Phase 任务清单 [ ] 进度
  - ITERATION_LOG.md 最近一次改动时间
- **汇报**：每 4 小时出 1 次"未完成"摘要到飞书

### 工作型 cron 任务 3：每天凌晨 2 点批量推 Phase 任务
- **时间表**：`0 2 * * *`
- **行为**：从 PLAN.md 取下一 [ ] 任务 → 自动开发 → 测试 → commit → 飞书简报

---

## 不做的事（明确范围）

- ❌ 不做后端持久化（除飞书 Bitable 排行榜）
- ❌ 不做账号系统（玩家昵称手填）
- ❌ 不做美术大改（保留 Q8 风格基线，不破世界）
- ❌ 不做新职业（6 职业锁死）
- ❌ 不做取消机制（融入 → 真碎，升级 → 真碎，无回滚）

---

## Deferred Tasks · 等凭证/等出图

> 这些任务被自动 cron 跳过（grep `- [ ]` 不会抓到，因为它们已从 Phase 清单移出）。冷景旭提供凭证或前置条件满足后，手动移回对应 Phase。

- **T3.5** 7 过场插图生成 + 终局真照片 3 张 — *blocked by `GPT_IMAGE_API_KEY`；spec + prompts 已落 `docs/CUTSCENES_SPEC.md`*
- **T3.7** sprite animation loop（4-8 帧 sprite sheet） — *blocked by `GPT_IMAGE_API_KEY`；依赖 T3.4 boss 立绘生成出图*
