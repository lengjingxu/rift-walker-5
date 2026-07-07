# 裂隙行者 5% · Rift Walker 5%

> 一个关于 AI 时代命题的反思型爬塔游戏

## 简介

「裂隙行者 5%」是把 [DIABLO BUILD](https://bitools.retailaim.cn/ai/diablo-build/) 的工具型出装模拟器，改造为反思型放置爬塔游戏。

数据底座继承自 v1.6.2 的 60+ 怪 / 14 传奇 / 10 套 / 5 宝石 / 4 附魔 / 6 配方。新增：

- 🏔 **35 层爬塔** + 7 个 boss gate
- 🎲 **三件融入 gacha**（60% 碎光 / 35% 高一阶 / 5% 传奇）+ 安全升级
- ⏸ **决策点**（血瓶带入 / 继续-撤退 / 道德选择 / 技能时机）
- ❓ **终极翻转**：通关后揭示"你只是被测试的 AI"，界面从游戏风切换到真实照片风

## 文档

- **[DESIGN.md](DESIGN.md)** — Q1-Q14 锁定决策 + 完整机制规格 + 心流通道设计
- **[PLAN.md](PLAN.md)** — 5 阶段开发计划 + cron 任务
- **[STORY.md](STORY.md)** — 世界观与怪物档案
- **[ROADMAP.md](ROADMAP.md)** — 阶段路线图（保留 v1.6 历史 + 5% 改造新阶段）
- **[ITERATION_LOG.md](ITERATION_LOG.md)** — 迭代日志

## 部署

| 平台 | 地址 |
|---|---|
| FC（线上）| https://bitools.retailaim.cn/ai/diablo-build/ |
| GitHub | https://github.com/lengjingxu/rift-walker-5 |
| 排行榜（飞书 Bitable）| https://retailaim.feishu.cn/base/LPdqb0BZ3aUjyVsF3Yucb1WFnnc |

## 开发

```bash
# 同步源码到 FC 部署包
cp src/*.html src/*.css src/*.js fc/

# 上传 FC 函数
python3 -c "
import sys
sys.path.insert(0, '/root/.hermes/skills/deploy-fc')
from aliyun_fc_client import AliyunFCManager
m = AliyunFCManager()
m.upload_function_code('diablo-build', '/root/projects/diablo-build/fc')
"
```

## 角色

> "5% vs 95% 的反抗是否还有意义？"
>
> "AI 用 0.003 秒算出了 8000 万失业者的最优分配：你知道那'最优'吗？"
>
> "不完美，也值得存在。"

玩家不是英雄 — 是裂缝中求生的人。
