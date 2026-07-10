# Boss 立绘生成规格（T3.4）

> **任务**：T3.4 · 7 boss 立绘生成 + 每 5 张汇报
> **状态**：规格/脚本/汇报模板就位（done）；实际调 API 留冷景旭手动触发（blocked by `GPT_IMAGE_API_KEY`）
> **关联**：PROMPTS.md §T3.3（7 boss 戏剧肖像 prompt 已落地，共享 Lynch 通用前缀/后缀）

---

## 1. 目录约定

```
assets/boss/
├── README.md                 # 本文件
├── boss_05_wanderer_king.png     # Floor 5  · 漫游者·王
├── boss_10_algorithm_cop.png     # Floor 10 · 算法警察·头目
├── boss_15_mother_echo.png       # Floor 15 · 母亲回声
├── boss_20_trinity_core.png      # Floor 20 · Trinity 核心裂隙
├── boss_25_awakener_father.png   # Floor 25 · 觉醒者·父
├── boss_30_sophon_descend.png    # Floor 30 · 智子降临
├── boss_35_digital_messiah.png   # Floor 35 · 数字弥赛亚
├── generation_log.md         # 每张生成的时间/API/参数/重试记录
└── prompts/                  # 每张的完整 prompt 备份（便于重生成）
    ├── boss_05_wanderer_king.txt
    ├── boss_10_algorithm_cop.txt
    └── ...
```

**命名规则**：`boss_{floor:02d}_{snake_case_id}.{ext}`（floor 两位补零，id 与 `Climb.BOSS_MAP` 完全一致）

---

## 2. 文件用途映射（与代码层对齐）

| Floor | id                  | 中文名           | 对应 PROMPTS.md 段落    | 渲染点（src/rift/climb-ui.js）        |
|-------|---------------------|------------------|--------------------------|----------------------------------------|
| 5     | wanderer_king       | 漫游者·王        | §T3.3 Boss 5             | boss gate modal 顶部立绘               |
| 10    | algorithm_cop       | 算法警察·头目    | §T3.3 Boss 10            | boss gate modal 顶部立绘               |
| 15    | mother_echo         | 母亲回声         | §T3.3 Boss 15            | boss gate modal 顶部立绘               |
| 20    | trinity_core        | Trinity 核心裂隙 | §T3.3 Boss 20            | boss gate modal 顶部立绘               |
| 25    | awakener_father     | 觉醒者·父        | §T3.3 Boss 25            | boss gate modal 顶部立绘               |
| 30    | sophon_descend      | 智子降临         | §T3.3 Boss 30            | boss gate modal 顶部立绘               |
| 35    | digital_messiah     | 数字弥赛亚       | §T3.3 Boss 35            | boss gate modal 顶部立绘 + 终局翻转场景 |

`Climb.BOSS_MAP` 的 id 必须与文件名 snake_case 一致；改动 `BOSS_MAP` 时同步改本目录命名（不强制自动化，但人工 grep 兜底）。

---

## 3. 通用参数（7 张统一）

| 参数           | 值                                                    | 来源             |
|----------------|-------------------------------------------------------|------------------|
| 比例           | 4:5 portrait                                          | PROMPTS.md §T3.3 |
| 风格           | David Lynch（Twin Peaks / Mulholland Drive / FWWM）   | §T3.3 通用后缀   |
| 色调           | sodium-vapour warm tint，soft halation                | §T3.3 通用后缀   |
| 光照           | 单点 60W 顶光，无 fill / rim                          | §T3.3 通用后缀   |
| 构图           | bust / 三分之二，主体占 60%，眼线上 1/3              | §T3.3 通用后缀   |
| 输出尺寸       | 1024×1280（或 2048×2560 高清档，按 gpt-image 默认）   | skill 默认       |
| 模型           | `gpt-image-2`                                         | gpt-image skill  |
| 负面约束       | 无流血 / 无抽出武器 / 无特效粒子 / 无风 / 无动作模糊 | §T3.3 通用后缀   |

**必备元素**（每张都要有，§T3.3 验证清单）：
- 一件时代错位的小物（电话绳 / 过塑证书 / 半边硬币 / …）
- 主体完全静止，眼神直视镜头且空
- 单点顶光下脸一侧被阴影吃掉

---

## 4. 单张 prompt 组装规则

每张完整 prompt = **PROMPTS.md §T3.3 通用前缀** + **该 boss 的主体段** + **§T3.3 通用后缀**。

**拼接示例（boss_05_wanderer_king）**：

```
[§T3.3 通用前缀 — 40 行办公室场景描述]

A man in his mid-forties wearing an ill-fitting short-sleeve button-down
the colour of dental waiting-room walls. His badge reads a department
the viewer cannot quite parse. He holds a clipboard the way a priest
holds a hymnal. His face is entirely unremarkable — and that is the
horror: you have seen this face at the post office, at the DMV, at
your uncle's third wedding. He is smiling, but the smile is 8% too
wide, the result of a muscle that has been trained to perform
"pleasant" without knowing what pleasant means. Behind him, on a cork
board, are printouts of code he will never write again.

[§T3.3 通用后缀 — Style + Composition + Aspect + Lighting]
```

每张完整 prompt 落档到 `assets/boss/prompts/boss_{floor}_{id}.txt`，便于以后 re-roll。

---

## 5. 生成脚本（人工触发）

`scripts/generate_boss_portraits.sh`（一键串行生成 7 张 + 落档 prompt + 写入 generation_log.md）：

```bash
#!/usr/bin/env bash
# scripts/generate_boss_portraits.sh
# 调用 gpt-image-2 生成 7 张 boss 立绘 → assets/boss/
# 用法：bash scripts/generate_boss_portraits.sh [boss_id]
#   不带参数 = 生成全部 7 张
#   带参数   = 只生成指定 id（如 wanderer_king）
# 前置：GPT_IMAGE_API_KEY / GPT_IMAGE_BASE_URL 已 export

set -euo pipefail

OUT=assets/boss
PROMPTS_DIR=$OUT/prompts
LOG=$OUT/generation_log.md

# boss 列表：floor id  prompt_section
BOSSES=(
  "5:wanderer_king:Boss 5"
  "10:algorithm_cop:Boss 10"
  "15:mother_echo:Boss 15"
  "20:trinity_core:Boss 20"
  "25:awakener_father:Boss 25"
  "30:sophon_descend:Boss 30"
  "35:digital_messiah:Boss 35"
)

# 通用前缀（PROMPTS.md §T3.3 通用前缀段，从文档拷出来）
PREFIX=$(cat <<'EOF'
A still photograph that could be a corporate headshot, taken in a room
that pretends to be normal. Overhead: a single bare 60-watt bulb that
has bleached the ceiling plaster to the colour of old bone. The carpet
is the kind of patterned carpet found in 1994 motel lobbies — repeating
geometric florals — but every fifth petal refuses to focus. The walls
are off-white almond, half-stained by coffee steam over twenty years.
There is a desk in the frame edge, half cut off, with a ceramic mug and
a coiled telephone cord. One of those cords is slightly longer than it
should be, as if it remembered being unplugged. The subject sits in a
chair that is identical to every other chair in the building. Everything
in the room says: this place is ordinary. The subject says: I am not.
EOF
)

# 通用后缀
SUFFIX=$(cat <<'EOF'
Style: David Lynch — Twin Peaks / Mulholland Drive / Fire Walk With Me.
Soft halation on highlights, sodium-vapour warm tint creeping into the
shadows. The frame is dead-still, no motion blur, no wind, no breath
mist. The subject's posture is correct — shoulders square, hands on
knees or folded on the desk — but the eyes address the viewer directly
with a vacancy that is older than the room. A single anachronism must
exist in the frame (one object that does not belong to the decade the
room claims to be). No gore, no fire, no weapon drawn. The horror is
the composure.
Composition: bust or three-quarter portrait, subject fills 60% of frame,
eye-line at upper third, negative space around feels humid.
Aspect: 4:5 portrait, suitable for boss gate card.
Lighting: single overhead tungsten/LED bulb, no fill, no rim — let
shadow eat one whole side of the face.
EOF
)

# 主体段（按 id 切分 PROMPTS.md §T3.3 的 7 段）— 见 prompts/boss_XX_*.txt
# 实际生产时把每段主体单独存到 PROMPTS_BODY 数组
declare -A BODY=(
  [wanderer_king]="A man in his mid-forties wearing an ill-fitting short-sleeve button-down the colour of dental waiting-room walls. ..."
  # ... 其余 6 段从 PROMPTS.md 抽取
)

mkdir -p "$OUT" "$PROMPTS_DIR"

generate_one() {
  local floor=$1 id=$2 section=$3
  local file=$OUT/boss_${floor}_${id}.png
  local prompt_file=$PROMPTS_DIR/boss_${floor}_${id}.txt

  if [ -f "$file" ]; then
    echo "[skip] $file exists"
    return 0
  fi

  # 拼接 prompt 并落档
  printf '%s\n\n%s\n\n%s\n' "$PREFIX" "${BODY[$id]}" "$SUFFIX" > "$prompt_file"

  echo "[gen ] $file"
  python3 ~/.hermes/skills/gpt-image/scripts/generate.py \
    --prompt "$(cat "$prompt_file")" \
    --out "$file" \
    --model gpt-image-2 \
    --size 1024x1280

  # 记录
  printf '| %s | %s | %s | gpt-image-2 | 1024x1280 |\n' \
    "$(date -u +'%Y-%m-%d %H:%M:%S UTC')" "${floor}_${id}" "$file" >> "$LOG"
}

target="${1:-all}"

for entry in "${BOSSES[@]}"; do
  IFS=: read -r floor id section <<<"$entry"
  if [ "$target" = "all" ] || [ "$target" = "$id" ]; then
    generate_one "$floor" "$id" "$section"
  fi
done
```

> 注：脚本里 `BODY[xx]` 的 7 段主体需要人工从 PROMPTS.md §T3.3 抽出来填入（不写死在 cron 里，避免文档/脚本双向不一致）。

---

## 6. 汇报模板（每 5 张汇总一次，按 T3.4 要求）

**汇报触发**：第 5 张、第 7 张（终局）生成完毕时。

**汇报渠道**：飞书群 `DIABLO BUILD` + DM 冷景旭

**汇报格式**：

```
📊 T3.4 boss 立绘进度 [HH:MM]
▸ 已生成：5/7
  - boss_05_wanderer_king.png      ✅ 一次过 / 重试 0 次
  - boss_10_algorithm_cop.png      ✅ 一次过
  - boss_15_mother_echo.png        ✅ 一次过
  - boss_20_trinity_core.png       ✅ 一次过
  - boss_25_awakener_father.png    ✅ 一次过
▸ 下一批（2 张）：
  - boss_30_sophon_descend.png
  - boss_35_digital_messiah.png
▸ API：gpt-image-2 · 1024×1280
▸ 单张耗时：~{avg}s · 总耗时：~{total}s
▸ generation_log.md 已更新
```

---

## 7. 阻塞与人工触发路径

**当前阻塞**（持续追踪，SKILL.md references/hourly-cron-brief.md 已记录）：
- 缺 `GPT_IMAGE_API_KEY` 环境变量
- fallback 路径 `/root/.hermes/skills/openclaw-imports/minimax-image/scripts/image_gen.py` 不存在
- cron 无 shell 调用权限（背景任务限制）

**冷景旭手动触发路径**：

```bash
# 1. export 凭证（一次性）
export GPT_IMAGE_API_KEY=sk-...
export GPT_IMAGE_BASE_URL=http://35.212.168.91:8080/v1

# 2. 跑脚本（建议先单张试）
cd ~/projects/diablo-build
bash scripts/generate_boss_portraits.sh wanderer_king   # 单张试
bash scripts/generate_boss_portraits.sh                  # 全部 7 张

# 3. 每 5 张汇总到飞书群（按 §6 模板）
```

**解除阻塞条件**：环境变量 `GPT_IMAGE_API_KEY` 设置后，cron 自动跑该脚本即可（脚本幂等，已存在文件会 skip）。

---

## 8. 验收 checklist（T3.4 完结时人工核对）

- [ ] 7 张 PNG 全部存在 `assets/boss/`，文件名与 `Climb.BOSS_MAP` id 一致
- [ ] 7 张尺寸 1024×1280（4:5 portrait）
- [ ] 7 张通过 §T3.3 验证清单（顶光、错位小物、空眼神、无流血/武器/特效）
- [ ] 7 张完整 prompt 落档 `assets/boss/prompts/`
- [ ] `generation_log.md` 含 7 行记录（每张 1 行：时间/id/路径/模型/尺寸）
- [ ] 飞书群按 §6 模板汇报过 2 次（第 5 张 + 第 7 张）
- [ ] `src/rift/climb-ui.js` 接入 `assets/boss/` 图（之前是占位文字）— 属 T3.6 范围，标记关联但不在 T3.4 内
- [ ] PLAN.md §T3.4 行 `- [ ]` → `- [x]`
- [ ] commit + push（一次，避开 hourly-commit :00）
