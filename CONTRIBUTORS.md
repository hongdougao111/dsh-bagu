# Contributors

按代码、测试、报告、词库任一贡献列。排名不分先后。

## 代码与缺陷

- **[@AlaIchhe](https://github.com/AlaIchhe)**
  PR [#2](https://github.com/hongdougao111/dsh-bagu/pull/2) —— 修 AI 接梗一开就崩。
  `bridge()` 从 `memes.js` 换成新实现后返回 `{hits, usage, tags}`，
  但 AI 分支还按旧版读 `r.same.length`，AI 接梗开着又命中梗时必炸 `TypeError`。
  真机上一天炸了 15 次，因为 `aiBridge` 默认关、条件短路，130 个测试全绿也没暴露。
  他复现、定位到行、给了 `aiHintOf()` 的修法，还顺手发现 `bagu_meme` 那条
  `ReferenceError: list is not defined`。

## 词库

- **[梗Wiki](https://cnmeme.wiki)** —— 词库全部来自这里。
  6800 多条词条的来源、用法、标签、别名、摘要，是那个站点一条一条攒出来的。
  最值钱的 `usage` 字段（这个梗怎么接）也是它整理的。

## 做法与判据

- **[thawline/dsh-memewiki](https://github.com/thawline/dsh-memewiki)** ——
  「不等模型来查，先把答案摆在它面前」这个做法是它先做的，词库内联分发也是跟它学的。
- **[beagle style-criteria](https://github.com/existential-birds/beagle)** ——
  代码注释判据（把代码念一遍的那类）。
- **[voku/code-slop](https://github.com/voku/agent-skills)** ——
  comments must explain why, never what the code already expresses.
- **[sloplint](https://github.com/DW-Studio/sloplint)** —— 评分公式。
- **[lieflat-less-ai-tone](https://github.com/larashero3-dotcom/lieflat-less-ai-tone)** ——
  两轮对照实验语料，1169 篇 / 520 万字。

## 语料

回归测试里的真人语料，都是从公开页面摘的：孙笑川吧、v吧、B 站评论区、
git 仓库的 commit message。这些说话的人不知道自己在帮一个插件做校准，
但没有他们那 200 多条原话，误拦率是量不出来的。

---

想加名字就提 PR。改了代码、补了测试、报了能复现的 bug、或者指出一条误拦，
都算。写清楚做了什么就行，不用客气。
