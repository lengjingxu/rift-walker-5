# 美术资产 · gpt-image Prompt 模板库

> 配套 PLAN.md T3.1-T3.5。每个模板可直接拷到 gpt-image 生成，复用参数：aspect 16:9 / size 1024 / quality high。

---

## T3.1 · 主角（黑白手绘 Sin City 风）

**核心调性**：弗兰克·米勒《Sin City》——高对比黑白、重墨阴影、刺白高光、雨夜霓虹反色。保留这种刺痛感但去掉女性裸体暗示，保持主角"伤痕累累的复仇者"调性。

### 通用前缀（每个职业复用）

```
A lone figure standing at the edge of a cliff overlooking a vast vertical crack
in the earth — the "Rift" — lit only by a cold white moon. Pure black sky,
no stars, no gradient. The character holds a worn weapon that has clearly seen
a hundred fights.
```

### 通用后缀（每张图复用）

```
Style: Frank Miller Sin City — high-contrast pure black-and-white noir.
Heavy black inks, sharp white highlights, no midtones. Rain-soaked, grim,
cigarette smoke frozen in air. Bold inking, graphic shapes, dramatic shadows
falling the wrong way. No manga, no anime, no color, no shading gradients.
Clothing has rips, bloodstains (rendered as pure black), scars, dust.
Composition: full body, ground at bottom 1/4, figure centered.
Aspect: cinematic vertical 2:3 to allow portrait framing in game UI.
```

### 6 职业变体（只换中间一段）

**Paladin · 圣骑士**
```
He wears cracked silver plate armor that has been repaired by a country
blacksmith. A dented kite shield on his back. His eyes, the only part not
in shadow, are tired but unblinking. The hilt of a long sword is wrapped
in prayer beads. He is the last of his order and he knows it.
```

**Barbarian · 野蛮人**
```
A huge man wrapped in layered hides and furs, axe heads hanging from his
belt. His arms and chest are wrapped in blood-stained bandages. He has
no helmet — half his skull is one solid black bruise. He grins because
pain is the only language he trusts.
```

**Sorceress · 女巫**
```
A gaunt woman in a torn robe covered in hand-drawn sigils. One hand holds
a cracked obsidian staff; the other hand is engulfed in white sparks that
escape the black-and-white palette as pure white scribbles. Her hair
floats as if underwater. She is not casting — she is trying not to.
```

**Necromancer · 死灵法师**
```
A skeletal-thin figure in layered black funeral robes, hood shadowing
every facial feature except two pinprick white eyes. Skeletal fingers
hold a mummified raven. Wisps of pure black smoke escape from the robe's
hem. The ground beneath is covered in chalk-drawn circles.
```

**Druid · 德鲁伊**
```
A wild-haired figure in layered wolf pelts, antlers lashed to a leather
headband. Claws instead of fingernails. Eyes are animal-yellow but here
rendered as light grey to stay on-palette. He carries no weapon — his
hands are the weapons. A pack of spectral wolves (rendered as white
outlines) circle him.
```

**Assassin · 刺客**
```
A lean, gender-ambiguous figure in layered dark cloth, face covered except
for two white eyes. Twin daggers, one blade pointing up (already drawn),
one blade pointing down. Smoke grenades clutter the belt. The pose is
mid-stride — about to vanish into shadow.
```

### 验证清单（生成后人工 / AI 二次比对）
- [ ] 无任何色彩（只有黑/白/灰）
- [ ] 没有可比 Sin City 更现代的"赛博义体零件"
- [ ] 主角不被裁切，背景不超过 30% 画面
- [ ] 表情可读（一眼里看出来"疲惫"或"愤怒"而非"中性"）

---

## T3.2 · 怪物（Junji Ito + glitch 风）

【模板将在 T3.2 任务执行时填入】  
关键差异：保留 Ito 的人体畸形 + 海报细节 + 一种"不该动的东西动了"的惊吓感，混入 glitch（局部像素撕裂、错位扫描线、CCTV 噪点）。

---

## T3.3 · 7 Boss 戏剧肖像（David Lynch 风）

【模板将在 T3.3 任务执行时填入】  
关键差异：Lynch 的"日常中强行加一个荒谬存在"——光头白光、过曝天花板、地毯图案失焦、人物直视镜头但眼神空。
