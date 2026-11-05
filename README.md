# dsh-bagu

> AI 要对外说话之前的一道门。过了就发，没过就打回。

## 这是什么

凡是 AI 写的、要被人看到的东西，都可以先过一遍：

| 场景 | 例子 |
|---|---|
| **聊天** | QQ 机器人、养鱼、DSH 会话 |
| **评论** | B站、贴吧、微博、论坛 |
| **工作沟通** | 邮件、客服回复、周报 |
| **代码托管** | commit、PR 描述、review 评论、issue 回复、变更日志 |
| **文档** | README、技术文档、API 说明 |
| **代码** | 注释 |

这些地方 AI 会写出同一种东西：

```
这条我认！首先态度要正，其次内容要实，最后要持续更新。
感谢分享！这个视频通过生动有趣的方式展示了相关内容，受益匪浅。
feat: 优化了用户模块的代码结构，提升了可维护性
整体实现思路清晰，代码结构合理，建议后续可以进一步优化。
// 初始化计数器
```

**这个插件在发出去之前拦一道。** 通过就发，没过就打回，附一句怎么改。

## 怎么判断

一句话：**换个人说，还成不成立？**

```text
「卖卡卖完了随便写了」              → 能发（编不出来）
「这个视频真的很不错」              → 打回（谁都能说）
「登录失败时不再清空已填的手机号」   → 能发（具体到一行）
「优化了代码结构，提升可维护性」     → 打回（改哪一行？没说）
```

## 三层规则

搭成三层，越往下越具体。前两层不分场景，第三层是各场景长出来的。

### 第一层 · 通用

**空转**——说了动作，没说做了什么。

```
优化了代码结构 / 提升了可维护性 / 修复了若干已知问题 / 进行了必要的处理
```

**空形容词**——能贴到任何产品上的词。

```
先进的技术架构 / 高性能、高可用 / 具备良好的扩展性 / 能够满足业务发展的需要
```

**万能话**——放到哪都通顺。

```
随着人工智能的发展 / 众所周知 / 值得注意的是 / 不仅…更…
```

### 第二层 · 套话

**模板整句**

```
这条我认 / 本鱼记下了 / 感谢分享 / 受益匪浅 / 说白了就是
```

**鸡汤口号**

```
愿你所行皆坦途 / 新的一天新的开始 / 努力不一定会成功，但不努力一定会失败
```

**学习腔**

```
学到了很多 / 涨知识了 / 非常实用 / 希望以后多发这类帖子
```

### 第三层 · 场景

**git**（commit / PR / review / issue / changelog）

```
feat: 优化了用户模块的代码结构          → 空转
## 概述 / ## 改动 / ## 影响            → PR 模板骨架
整体实现思路清晰，建议后续优化          → review 空话
感谢反馈！这个问题我们已经记录          → issue 客服腔
```

**代码注释**——把代码念一遍。

```js
// 初始化计数器            → 打回
let total = 0;
// 这里之所以要排序，是因为下游依赖顺序稳定的分页   → 能发
```

判据来自 [beagle style-criteria](https://github.com/existential-birds/beagle/blob/main/plugins/beagle-core/skills/llm-artifacts-detection/references/style-criteria.md)
和 [voku/code-slop](https://github.com/voku/agent-skills/blob/main/skills/code-slop/rules/comments-hygiene.md)：

> comments must explain **why**, never **what** the code already expresses.

## 实测六组数据

全部在 `tools/` 里可复现：

| 测试 | 样本 | 结果 |
|---|---|---|
| **全域场景**（18 个场景 × 2 条） | 36 条 | 漏 0，误拦 0 |
| **真人原话**（DSH + 贴吧 + 聊天） | 51 条 | 误拦 0 |
| **git 真人**（commit + PR + review） | 28 条 | 误拦 1（4%） |
| **AI 八股**（客服腔 + 对举 + 空夸 + 模板） | 35 条 | 拦住 35（100%） |
| **对抗绕过**（故意换皮） | 10 种 | 拦住 6（60%） |

```sh
node tools/all-scenes.mjs   # 18 个场景，36 条
node tools/falserate.mjs    # 真人 51 条
node tools/git-false.mjs    # git 真人 28 条
node tools/missrate.mjs     # AI 八股 35 条
node tools/evasion.mjs      # 对抗绕过
node tools/audit.mjs        # 真实场景 25 条
```

## 它拦不住什么

对抗测试里 10 种绕过手法拦住了 6 种。剩下 4 种是已知边界：

- **换同义词** —— 「功能多牛啊，用起来也顺手」，词换了形状没换
- **换成英文** —— 英文只做了留白词，句式没做
- **加脏话伪装** —— 「真他妈不错」，脏话把评价词淹了
- **去掉分组标记** —— 「目标是明确的，任务是拆过的」

**规则只能认形状，认不了「这句话是不是真的」。** 这是止血带，不是解药。

## 长文也判

300 字以上不跳过——长邮件、长周报、长 PR 一样会八股。

但长文的门槛不同：同一个信号要出现**两次以上**才算，一次不算。这样长文里偶尔一个「优化了」不会被打回，反复出现才被拦。

## 怎么用

```js
bagu_guard({ text: "这条我认！首先态度要正，其次内容要实，最后要持续更新。" })
→ "改：模板三连 · 直接说事，不用「首先其次最后」"

bagu_guard({ text: "登录失败时不再清空已填的手机号" })
→ "OK"
```

过了就回 `OK`，两个字。

**三种模式：**

```js
bagu_guard({ text })                    // 守门（默认）
bagu_guard({ text, mode: 'report' })    // 详细报告，给人看
bagu_guard({ text, mode: 'ask' })       // 只要问句
```

**输出预算：通过 2 字，打回一行 40 字内。** 按严重度排，只报第一条——报三条 agent 会挑最轻的改。

## 装

```sh
dsh plugin --profile web add dsh-bagu
```

装完重启一次 dsh。**设置 → 八股检测** 里能看到这一页。

## 设置页

- **挡不挡** —— 总开关
- **多严** —— 正常只拦硬信号；严格连破折号也拦
- **提示那一节** —— 关掉只留工具，不往系统提示里塞话
- **试一段** —— 五种样本，当场看能不能过

## 省 token

| 项 | 大小 |
|---|---|
| 系统提示注入 | **31 字** |
| 工具描述（1 个） | **54 字** |
| 守门器输出 | 2 字（通过）／40 字内（打回） |

固定开销合计 **85 字**。判断全在本地正则里跑完，**不调模型**。

系统提示只有一句：「要发出去的话，先过 bagu_guard。被打回就改，别硬发。」

## 短句也能查

聊天回复二三十字是常态，密度指标在这个长度上分母太小。六十字以下切换成**绝对计数**：不看密度，看命中了什么。

```text
「这不是技术问题，而是认知问题。」   → 打回
「卖卡卖完了随便写了」               → 能发
```

## 数据从哪来

- 两轮对照实验，1169 篇 / 520 万字（[lieflat-less-ai-tone](https://github.com/larashero3-dotcom/lieflat-less-ai-tone)）
- 10 万条真人评论 vs 2180 条 AI 评论的密度实测
- [sloplint](https://github.com/DW-Studio/sloplint) 的评分公式
- [beagle style-criteria](https://github.com/existential-birds/beagle/blob/main/plugins/beagle-core/skills/llm-artifacts-detection/references/style-criteria.md) 和 [voku/code-slop](https://github.com/voku/agent-skills/blob/main/skills/code-slop/rules/comments-hygiene.md) 的注释判据

## 开发

```sh
npm test    # 70 个单元测试
```

## 许可

MIT。
