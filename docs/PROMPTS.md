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

**核心调性**：伊藤润二的人体螺旋/错位 + 谷崎/水鬼那种不该动的东西动了的惊吓感 + 监控屏 CCTV 噪点/扫描线 glitch。画面像故障监控屏抓拍到的不该存在的生物，但肢体细节要保留手绘水墨精度——五官、褶皱、汗珠都能数清。

### 通用前缀（每张怪物图复用）

```
A still frame from a malfunctioning body-cam worn by an investigator who
has already been killed. The footage is corrupted: horizontal scan lines
shift every few rows, sections of the frame are torn vertically as if the
signal glitched, color is bled out of the subject but the background
still has toxic magenta and infected green — except the subject itself
desaturates to dust and bone tones. Depth of field broken in the middle
of the figure — left half razor sharp, right half smeared like a wet
photograph. The subject stands at the wrong angle to gravity.
```

### 通用后缀（每张图复用）

```
Style: Junji Ito body-horror cross-bred with analog glitch — CCTV
artifact, scan-line tear, corrupted JPEG blocks. Hand-drawn precision on
the anatomy (you can count individual teeth, pore clusters, knuckle
creases) but rendered as if the file is half-decoded. Wet ink shadows,
no flat fills. The horror comes from ordinary anatomy placed one joint
in the wrong direction. Avoid gore; the terror is silent, anatomical,
slightly wet. No color saturation on the subject. No legible text or
glyphs. No background figures.
Composition: waist-up or knee-up portrait, subject takes 70% of frame,
space around feels contaminated not empty.
Aspect: cinematic 4:5 to suit combat card portrait.
```

### 9 怪物变体（按 tier 拆三档，每档一组）

#### Normal（lv 1-34 普通怪）—— 关键调：「不该动的东西动了」

**漫游者 · lv1**
```
A faceless hospital orderly in a stained gown standing at the foot of a
stairwell. The head is bowed correctly — but the neck has rotated 180
degrees so the face points upward at the ceiling, eyes wide and empty.
Hands are folded in front as if at prayer. A clipboard hangs from one
wrist by a frayed lanyard.
```

**算法警察 · lv8**
```
A municipal patrol officer in riot gear, helmet visor cracked. Where the
visor should reflect streetlights, it reflects a row of identical office
cubicles stretching to a vanishing point. The jaw is unhinged past 90
degrees, teeth still clenched, as if the order "stop talking" was given
at the moment of speaking. Hands hold a clipboard stamped REDACTED.
```

**优化战士 · lv18**
```
A tall figure in a tailored business suit tailored to a body that has
seven elbows per arm. Each joint is held at a slightly different angle,
as if multiple keyframes were layered in one photograph. Tie perfectly
knotted, perfectly still, perfectly wrong. A laminated badge clipped
to the lapel reads only a QR code, and the QR code is also a face.
```

**意识副本 · lv28**
```
A middle-aged woman in a floral blouse carrying a stack of identical
shopping bags. Except she has three right hands, all gripping a different
bag, and each hand has six fingers arranged in a slightly different
order — none of the finger arrangements match. The face smiles
correctly. The left eye is a thumbprint pressed into the socket.
```

**融合体 · lv34**
```
Two figures mid-merger: a young girl with pigtails has a second human
spine growing out of her right shoulder blade, ending in a second head
that is her own head's mirror image, except the mirror image is older,
tired, and looking left while the original looks right. Both wear the
same pink sweater. One backpack strap crosses both bodies at impossible
angles.
```

#### Elite（中等精英）—— 关键调：「监控屏抓到的」

**Trinity · 副脑 · lv65**
```
A bald man in a single-piece server-room cleanroom suit. His face is
correctly proportioned, correctly lit, and completely unremarkable —
except his skull has the silhouette of a CPU heat sink pressed through
the scalp, fins radiating outward like a crown. Eyes are open but the
pupils are pixel-perfect, mathematically round, the only curves in the
image. The clipboard in his hand lists IP addresses, not names.
```

**未对齐刽子手 · lv70**
```
A street sweeper in orange safety vest holding a push broom. Both hands
grip the broom correctly — but the broom continues downward past the
ground, extending into a black-and-white tiled floor that recedes into
a void, and along the broom's handle are tied seven knots, each at a
human throat, each knot still wet. The sweeper's head is bowed in
penance. The vest is zipped all the way to the throat.
```

#### Boss（lv 99+ 真·boss）—— 关键调：「不该存在的巨物」

**智子降临 · lv99**
```
A nine-meter humanoid figure kneeling where a corporate lobby used to
be — so tall the head disappears into fog above the frame. Knees are
placed correctly; the spine adds three unnecessary vertebrae, each
visibly dislocated, skin pulled thin over the misalignment. The hands
are proportioned for a child, clasped in front of the chest. The face,
if you could see it, would be smiling normally. Asbestos fibers drift
down through the still air like falling snow.
```

**母亲的回声 · lv99**
```
A woman in a checked housecoat sitting upright in an armchair that is
not in a room — it is in a flooded hallway, water at ankle height
perfectly still. She holds a porcelain teacup with both hands. The hands
each have eight fingers, all correctly arranged, but the pinkies on
both hands are growing out of the wrists, not the palm. She is looking
at the camera and the camera is already inside her mouth. A small
wooden chair sits empty behind her.
```

**觉醒者 · lv70 / 觉醒者之父 · lv99 / 终局 boss**
```
A naked man standing in a white-tiled shower stall, water running but
not wetting him. His skin has the texture of a CRT screen when it dies
— vertical hold rolled up into the corner, scan lines pressed into the
dermis like barcode scars. Eyes are closed but the lids are sewn shut
from the inside, threads trailing down the cheek. Both hands are placed
on the shower wall as if supporting weight that isn't there. A second
shadow on the wall does not match his pose.
```

### 验证清单（生成后人工 / AI 二次比对）

- [ ] 主体解剖学精度高（可数牙齿/毛孔/关节数）
- [ ] 错位 / 多余关节 / 旋转错乱至少存在 1 处，**不血腥**
- [ ] 主体区域轻度 desaturated / glitch 撕裂明显，背景保留少量毒彩
- [ ] 表情或姿态传达「不该存在」或「不该动」而非「愤怒」
- [ ] 主体未裁切，撑满画面 70%
- [ ] 没有可识别的真实文字或商标

---

## T3.3 · 7 Boss 戏剧肖像（David Lynch 风）

【模板将在 T3.3 任务执行时填入】  
关键差异：Lynch 的"日常中强行加一个荒谬存在"——光头白光、过曝天花板、地毯图案失焦、人物直视镜头但眼神空。
