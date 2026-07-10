# 过场插图 · 规格与 Prompt 骨架

> 配套 PLAN.md T3.5。7 张 boss 战前剧情插图 + 3 张终局真照片风格图。
> 配套 `docs/PROMPTS.md`（主角/怪物/boss 模板），本文件专注**场景级**插图——不是人物特写，是"事件发生的一刻"。

---

## 设计原则

1. **不是人物特写，是事件定格**。每个过场是一个"世界状态切换"前的最后一帧：怪物从地缝爬出、祭坛亮起、天空撕开。
2. **同一世界，不同视角**。7 张图共享同一套物理参数（雾色、岩石肌理、竖向裂纹），但镜头机位/景深完全不同。
3. **终局 3 张是例外**：放弃绘画风，用**真照片风格**（35mm 胶片质感、HDR 噪点、过曝高光），表示"叙事破第四面墙"。
4. **不做 UI 文字水印**。每张图右下角预留 5% 暗色 vignette，给游戏内 caption 留空间。

---

## 共享参数（全部 10 张图统一）

| 参数 | 值 |
|---|---|
| 基础风格前缀 | `Style: dark fantasy concept art, vertical 9:16 composition for in-game cutscene, painterly but grounded in physical textures (wet rock, torn fabric, real rust), muted desaturated palette dominated by deep indigo and bone white, single warm light source (torch / ember / distant glow) as the only chromatic accent` |
| 通用后缀 | `Composition: rule-of-thirds, foreground subject occupying bottom 2/3, vast negative space above to imply scale. No UI elements, no text, no logos, no watermarks. Aspect: cinematic 9:16 (mobile portrait). Lighting: single source, long shadow, deep contrast. Mood: ritual weight — something irreversible is about to happen.` |
| 禁止项 | `No anime, no chibi, no neon glow, no particle effects, no floating UI, no text overlays` |

---

## 7 张 Boss 战前过场插图

每张对应一个 boss 的"登场前最后一刻"。调性参考：H.R. Giger（生物机械）+ Caspar David Friedrich（人物背影面对自然伟力）+ Dark Souls 篝火旁那种"快轮到你上场了"的寒意。

### C1 · 裂缝张开（Floor 10 · The Wound）

```
A vertical crack in the earth, photographed from above at a 45-degree angle.
The crack runs north-south for hundreds of meters. Inside the crack, faint
red bioluminescence pulses like a slow heartbeat. At the crack's lip, a
single human hand — only the hand, no body — grips the edge. The hand wears
a glove that has clearly been repaired multiple times. Small pebbles fall
into the crack from the disturbed edge. The surrounding ground is cracked
dry mud with sparse dead grass. Time of day: indeterminate, light comes
only from the crack itself. The viewer is positioned as if they are the
next person to be pulled down.
```

### C2 · 祭坛点燃（Floor 20 · The Threshold）

```
A stone altar in the center of a circular chamber. The chamber walls are
lined with thousands of small clay masks, each unique, each watching
inward. On the altar: seven unlit candles arranged in a spiral. One candle
is already lit with a flame that does not flicker — the flame is the only
moving thing in the frame. Above the altar, hanging from a chain thick as
a wrist, a bronze bell is tilted as if it just finished ringing. Dust
particles are frozen mid-air. The chamber is lit only by the one candle.
The viewer sees this from the doorway, still half in shadow, not yet
committed to entering.
```

### C3 · 同类残骸（Floor 30 · The Mirror）

```
A corridor of mirrors, but every mirror reflects a different version of
the same person — a previous climber. Some mirrors show the person alive
and walking forward. Some show them collapsed. One mirror, in the
foreground, is cracked and the reflection is missing entirely — only
the empty frame remains. The viewer (implied by camera position at the
end of the corridor) walks toward this missing reflection. Floor:
polished black stone reflecting the dim torchlight from behind the
viewer. The torch is the only warm color; everything else is cold grey
and tarnished silver.
```

### C4 · 倒置的城市（Floor 40 · The Hanging City）

```
An entire city suspended upside down from the ceiling of an underground
cavern. The city is real, not ruins — windows are lit, laundry hangs
from balconies, a single bird flies between the inverted rooftops. From
the ground (the cavern floor), the viewer looks up through a thin
vertical shaft of mist. The mist makes the city look like a photograph
held underwater. Light comes from the city itself, filtered through the
mist into the cavern below. A stone staircase carved into the cavern wall
leads up toward the city. At the top of the visible staircase, a small
human figure pauses, looking down — not up.
```

### C5 · 沉默的军队（Floor 50 · The Bone Garden）

```
A field of thousands of standing bones arranged in military formation,
each bone held upright by being driven into the soft earth like a stake.
No skulls — only ribs, femurs, and clavicles. The bones all face the
same direction (toward the viewer's left). In the middle distance, a
single full skeleton kneels, helmet still on, sword still in hand,
frozen mid-prayer. Beyond the kneeling skeleton, more bones extend to
the horizon. Sky: overcast, color of an old bedsheet. Wind: visible in
the grass but not strong enough to move the bones. Mood: a funeral that
was never finished.
```

### C6 · 镜像自我（Floor 60 · The Twin）

```
Two figures standing face to face in a white room with no doors or
windows. One figure is the viewer (placeholder silhouette, no detail —
just posture and outline). The other figure is the same silhouette,
but slightly larger and slightly wrong — the head is tilted at an
angle human necks don't tilt, the arms are too long, the hands have
one finger too many. The two figures do not touch. Between them, on
the floor, a single mirror shard. Light source: indeterminate, no
shadows. The wrong figure is smiling. The viewer's silhouette is not.
```

### C7 · 裂缝的尽头（Floor 70 · The Mouth）

```
A circular pit, approximately 200 meters across, at the bottom of the
rift. The pit is not empty — it is filled with a single eye. Not a
metaphor: a literal eye the size of a stadium. The eye is half-closed,
as if in slow thought. Iris color: amber with black veins. Around the
pit, on the rim, seven previous climbers stand at the edge, each
frozen in a different posture of recognition (one kneeling, one
backing away, one already falling). The viewer is the eighth, at the
9 o'clock position, hand reaching out toward the eye. Time of day: the
eye IS the light source. Everything else is silhouetted.
```

---

## 3 张终局"真照片风格"图

风格转换提示：放弃 painterly 概念艺术，切换为 **35mm 胶片相机 + 过曝**——kodak portra 800 噪点、HDR 高光溢出、轻微 lens distortion。叙事理由：到达 Floor 100 后玩家发现"Rift"不是神话——它是一个真实发生过的工业事故，这 3 张"照片"是事后现场勘查的档案影像。

### E1 · 警戒线（Floor 100 · The Site）

```
35mm film photograph, Kodak Portra 800 grain visible. A yellow
police cordon tape stretches across the foreground, slightly out
of focus. Beyond the tape: a real-world construction site crater,
approximately 30 meters across, ringed with concrete jersey
barriers. The crater edges are raw, as if the collapse was recent.
A single hard hat lies on the asphalt near the tape, owner
nowhere visible. Background: suburban infrastructure — a strip
mall parking lot in soft focus. Time of day: late afternoon,
golden hour, harsh lens flare from the right. The photo has
slight motion blur in the upper left, as if the photographer
turned to run. No people visible. No text overlays. The image
must look like an actual photograph someone took with their
phone before they were told to stop.
```

### E2 · 监控画面（Floor 100 · The Feed）

```
CCTV still frame, 4:3 aspect, low resolution with characteristic
MPEG compression artifacts. Time stamp overlay in bottom right
reads "CAM 07 · 03:14:22 AM" in white monospace font. Content: a
maintenance corridor in an industrial facility, fluorescent
lighting overhead. The corridor extends into deep focus. In the
middle distance, a single figure in a high-visibility vest walks
away from the camera. The figure's left foot is visibly suspended
above the floor — they have started to fall but the frame froze
before completion. The walls are lined with pipes and electrical
conduits. A single emergency exit sign glows red above a door on
the right. No other people. The image must look exactly like a
security camera still that was subpoenaed in a lawsuit.
```

### E3 · 现场照片（Floor 100 · The Artifact）

```
Polaroid instant photo, white border at the bottom (intentionally
blank — no handwriting). The photo is overexposed on the right
side, slightly underexposed on the left. Subject: a single
object placed on a metal folding table in what appears to be a
conference room (drop ceiling tiles, fluorescent panel lights
visible in reflection on the table surface). The object: a
bronze coin, split exactly in half. One half of the coin is on
the table. The other half is not in frame. Next to the coin: a
clear evidence bag with a yellow tamper-evident seal, empty,
open. A single latex glove lies crumpled next to the bag. The
camera angle is slightly above table height, as if someone
leaned in to take the photo. The image must look like a
photograph taken by an investigator who set their personal
camera down on the table to photograph the evidence before it
was logged.
```

---

## 验证清单（生成后比对）

### 7 张过场共通
- [ ] 没有人物正面（最多背影/剪影/手部特写），保持叙事距离
- [ ] 单光源 + 长阴影
- [ ] 冷调主色 + 一个暖色焦点（火焰/眼睛/手电）
- [ ] 镜头角度暗示"下一个轮到的就是玩家"（不是客观记录）
- [ ] 物理细节真实（湿石、生锈、灰尘颗粒），非绘画装饰感

### 3 张终局照片共通
- [ ] 风格明显从 painterly 切换到 photographic（叙事破第四面墙）
- [ ] 时代错位但具体：1990s 工业现场 / 2010s 安防监控 / Polaroid 物证照
- [ ] 每张都有"被拍摄的真实瞬间"痕迹（motion blur、CCTV 压缩、Polaroid 过曝）
- [ ] 三张图共享同一案件的物证链（警戒线→监控→证物），但画面中**不出现任何解释性文字**

### 与 BOSS_PORTRAITS_SPEC.md 的风格一致性
- [ ] 同一世界：相同的雾色、岩石肌理、暖色冷色对比
- [ ] 但机位相反：boss portrait 是**静态肖像**，cutscene 是**动态事件的前一秒**
- [ ] boss portrait 让人想"对话"，cutscene 让人想"逃走"

---

## 阻塞说明

**当前状态**：spec 完成、prompt 骨架就绪。**实际生成 blocked by `GPT_IMAGE_API_KEY`**——同 T3.4。

**解决路径**：
1. 配置 key 后，按 `docs/PROMPTS.md` 模式调用 gpt-image-2（或人工触发 MidJourney / DALL-E 3）
2. 输出物存放约定：`assets/cutscenes/{c1-c7,e1-e3}.png`（目录待创建）
3. 集成点：`src/rift/climb.js` 的 `openFloor()` 在 boss 战前需读取 `assets/cutscenes/c{n}.png` 作为背景层 overlay，modal 弹出前 800ms 淡入

**预计工时**：spec 1h ✓（本文档）/ prompt 微调 0.5h / 10 张生成 3-5h（人工）/ 集成 1h