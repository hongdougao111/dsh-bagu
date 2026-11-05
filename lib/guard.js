/**
 * 守门器：agent 把要发出去的那句话递进来，只回「能发」或「改」。
 *
 * 跟 analyze() 的区别：
 *   analyze  给人看，多行报告，判断有余地
 *   guard    给 agent 用，一行，只有通过和不通过
 *
 * 这个文件的存在理由就一个：QQ 机器人、养鱼这类场景里，
 * 一条回复二三十字，人不会自己开脚本查，得让机器在发出前拦一道。
 *
 * 输出预算：通过两个字，打回一行（30 字以内）。每次调用都要烧 token，
 * 所以这里每一行都要挣来自己的位置。
 */

import { analyze } from './analyze.js';
import { STOCK_PHRASES, GIT_STOCK, GIT_TEMPLATE_ROWS, countTemplateRows, REVIEW_STOCK } from './lexicon.js';
import { HOLLOW_ACTIONS, HOLLOW_ADJECTIVES, LEARNED_TONE, CODE_COMMENT_NARRATION, MOTIVATIONAL_SLOP, UNIVERSAL_FILLER } from './layers.js';

/**
 * 打回原因按严重度排。谁先命中谁负责，只报一条 —— 报三条 agent 会挑最轻的改。
 *
 * 权重来自 lieflat 的 δ：
 *   同义轮换 +0.91  >  不是A而是B +0.88  >  顿号并列 +0.56
 * 聊天场景再叠一层：一条二十字的回复里出现模板三连，比长文里更假。
 */
const OPPOSITION_FRAMES = [
  // 不是A而是B 已经在 STRUCTURE_FRAMES 里，这里补同族的
  /不在于[^。！？\n]{1,20}(?:而在于|而在)/,          // 问题不在于A，而在于B
  /与其说[^。！？\n]{1,20}(?:不如说|不如)/,          // 与其说A，不如说B
  /与其([^。！？\n]{1,20})不如/,                      // 与其A不如B
  /看似[^。！？\n]{1,20}(?:实则|实际|其实)/,          // 看似A，实则B
  /不仅[^。！？\n]{1,24}(?:更|还|而且)/,             // 不仅A更B
  /不是[^。！？\n]{1,20}[。！]\s*[^。！？\n]{0,4}(?:这|那|而|就)?(?:才)?是/,  // 拆成两句：不是X。这是Y
];

const REASONS = [
  {
    id: 'universal-filler',
    // 万能话：放到任何语境都通顺，等于什么都没说
    test: (r, text, o = {}) => {
      const bar = o.repeatBar || 1;
      const n = UNIVERSAL_FILLER.reduce((a, re) => {
        const m = text.match(new RegExp(re.source, 'g'));
        return a + (m ? m.length : 0);
      }, 0);
      return n >= bar;
    },
    why: (r, text) => {
      const re = UNIVERSAL_FILLER.map((x) => new RegExp(x.source)).find((x) => x.test(text));
      return re ? `万能话「${(text.match(re) || [''])[0].slice(0, 12)}」` : '万能话';
    },
    hint: '删掉这句，直接说事',
  },
  {
    id: 'hollow-action',
    // 动词 + 宏观名词：说了动作，没说改哪一行。不分场景。
    test: (r, text, o = {}) => {
      const bar = o.repeatBar || 1;
      const n = HOLLOW_ACTIONS.reduce((a, re) => {
        const m = text.match(new RegExp(re.source, 'g'));
        return a + (m ? m.length : 0);
      }, 0);
      return n >= bar;
    },
    why: (r, text) => {
      const re = HOLLOW_ACTIONS.map((x) => new RegExp(x.source)).find((x) => x.test(text));
      const hit = re ? (text.match(re) || [''])[0] : '';
      return hit ? `空转「${hit.slice(0, 14)}」` : '空转';
    },
    hint: '说清改了什么，比如具体到哪一行、哪一次',
  },

  {
    id: 'motivational',
    // 鸡汤/口号：不求证的句子
    test: (r, text) => MOTIVATIONAL_SLOP.some((re) => new RegExp(re.source).test(text)),
    why: (r, text) => {
      const re = MOTIVATIONAL_SLOP.map((x) => new RegExp(x.source)).find((x) => x.test(text));
      return re ? `鸡汤「${(text.match(re) || [''])[0].slice(0, 12)}」` : '鸡汤';
    },
    hint: '说一件具体的事',
  },
  {
    id: 'changelog-hollow',
    // 变更日志里的空转条目：一行说了个动作，但没说改了什么
    // 「性能大幅提升」「全新的用户界面」「修复了若干已知问题」
    test: (r, text) => {
      if (!/^#{1,4}\s*(?:新增|修复|变更|改进|移除|Added|Fixed|Changed|Removed)/im.test(text)) return false;
      // 逐条看 - 开头的行
      const lines = text.split('\n').filter((l) => /^-\s/.test(l));
      const hollow = lines.filter((l) =>
        /(?:全新|大幅|显著|全面|若干|多个|一些|相关|优化了|提升了|完善了)/.test(l)
      );
      return hollow.length >= 1 && hollow.length >= lines.length * 0.5;
    },
    why: '变更日志空转',
    hint: '每条说清改了什么，比如「登录失败时不再清空手机号」',
  },
  {
    id: 'comment-narration',
    // 代码注释把代码念一遍：「// 初始化计数器」「// 遍历每个商品」
    test: (r, text) => {
      if (!text.includes('//') && !text.includes('#')) return false;
      return CODE_COMMENT_NARRATION.some((re) => new RegExp(re.source, re.flags).test(text));
    },
    why: '注释念代码',
    hint: '写为什么这么做，不写代码在做什么',
  },
  {
    id: 'hollow-adjective',
    // 空形容词：能贴到任何产品上的词堆在一起
    test: (r, text, o = {}) => {
      const bar = o.repeatBar || 1;
      const n = HOLLOW_ADJECTIVES.reduce((a, re) => {
        const m = text.match(new RegExp(re.source, 'g'));
        return a + (m ? m.length : 0);
      }, 0);
      return n >= bar;
    },
    why: (r, text) => {
      const re = HOLLOW_ADJECTIVES.map((x) => new RegExp(x.source)).find((x) => x.test(text));
      return re ? `空形容词「${(text.match(re) || [''])[0].slice(0, 14)}」` : '空形容词';
    },
    hint: '说它具体做到了什么',
  },
  {
    id: 'learned-tone',
    // 学习腔：学到了 / 涨知识 / 希望多发。评论区特有，换到哪都是假学生
    test: (r, text) => LEARNED_TONE.some((re) => new RegExp(re.source).test(text)),
    why: (r, text) => {
      const re = LEARNED_TONE.map((x) => new RegExp(x.source)).find((x) => x.test(text));
      return re ? `学习腔「${(text.match(re) || [''])[0].slice(0, 12)}」` : '学习腔';
    },
    hint: '说你自己看到的具体东西，别说学到了',
  },
  {
    id: 'triple-template',
    // 逗号和分号都算。QQ 机器人一条回复通常不分号，写成「首先A，其次B，最后C」
    test: (r, text) => /首先[^。！？\n]{1,30}[，,；;][^。！？\n]{0,12}其次/.test(text),
    why: '模板三连',
    hint: '直接说事，不用「首先其次最后」',
  },
  {
    id: 'bare-first',
    // 单列的「首先/其次/最后」开头：没有后续的列举，直接是空转
    test: (r, text) => {
      const m = text.match(/^(首先|其次|最后|首先|其一|其二)[，,]/);
      return m !== null && text.length < 40;
    },
    why: '单列首先/其次',
    hint: '直接说正题',
  },
  {
    id: 'rhetorical',
    // 反问句里的对举：难道这不是A吗 / 这难道不是B吗
    test: (r, text) => /(?:难道|岂不|岂不是)[^。！？\n]{0,20}(?:不是|而是|才)/.test(text),
    why: '反问式对举',
    hint: '直接说结论，别用反问',
  },
  {
    id: 'git-stock',
    // commit / PR 里的「优化了结构、提升可维护性」—— 说了动作没说改哪一行
    test: (r, text, o = {}) => {
      const bar = o.repeatBar || 1;
      const n = GIT_STOCK.reduce((a, re) => {
        const m = text.match(new RegExp(re.source, 'g'));
        return a + (m ? m.length : 0);
      }, 0);
      return n >= bar;
    },
    why: (r, text) => {
      const re = GIT_STOCK.find((x) => x.test(text));
      return re ? `套话「${(text.match(re) || [''])[0]}」` : 'git 套话';
    },
    hint: '说改了什么，比如「登录失败时不再清空已填的手机号」',
  },
  {
    id: 'git-template',
    // PR 模板骨架：## 概述 / ## 改动 / ## 影响，两行以上就假
    test: (r, text) => countTemplateRows(text) >= 2,
    why: 'PR 模板骨架',
    hint: '一两句话说清为什么改，不要分节',
  },
  {
    id: 'review-stock',
    // review 里的「思路清晰、建议后续优化」—— 提了意见没指哪一行
    test: (r, text) => REVIEW_STOCK.some((re) => re.test(text)),
    why: (r, text) => {
      const re = REVIEW_STOCK.find((x) => x.test(text));
      return re ? `套话「${(text.match(re) || [''])[0]}」` : 'review 套话';
    },
    hint: '指出具体哪一行、什么问题',
  },
  {
    id: 'stock',
    test: (r, text) => {
      const hit = STOCK_PHRASES.find((re) => re.test(text));
      return hit !== undefined;
    },
    why: (r, text) => {
      const hit = STOCK_PHRASES.find((re) => re.test(text));
      return hit ? `套话「${(text.match(hit) || [''])[0]}」` : '套话';
    },
    hint: '这句是模板，换成自己会说的话',
  },
  {
    id: 'negation',
    test: (r, text) => {
      const hit = r.hits.structures.some((s) => s.id === 'negation') ||
        OPPOSITION_FRAMES.some((re) => re.test(text));
      if (!hit) return false;
      // 前半句已经种下一个可能被误解的说法 → 这个对立有活干，放过。
      // 判据抄 issue #1：前面出现过「以为/很多人/不是词表」这类，或者
      // 「不是X」里的 X 在前面真正被提过。
      const m = text.match(/不是([^，。！？\n]{1,20})[，]?(?:而是|，是)/);
      if (m) {
        const x = m[1].trim();
        const before = text.slice(0, text.indexOf(m[0]));
        if (before.includes(x)) return false;   // X 在前面被种下过
      }
      // 前面有「以为/很多人/都」这类误解标记
      if (/(?:以为|很多人|不少人|都说|总有人|别人说|以为)/.test(text.slice(0, text.indexOf(m ? m[0] : '')))) {
        return false;
      }
      return true;
    },
    why: (r, text) => {
      if (r.hits.structures.some((s) => s.id === 'negation')) return '不是A而是B';
      const re = OPPOSITION_FRAMES.find((x) => x.test(text));
      return re ? `对举「${(text.match(re) || [''])[0]}」` : '对举';
    },
    hint: '拆成两句话，或者直接说结论',
  },
  {
    id: 'synonym',
    // 两组以上，或者一组里挑了三个以上 —— 后者已经是明显在轮换
    test: (r) => r.synonyms.length >= 2 || r.synonyms.some((g) => g.length >= 3),
    why: (r) => `同义轮换${r.synonyms.map((g) => g.length).reduce((a, b) => a + b, 0)}个词`,
    hint: (r) => `「${r.synonyms[0].join('/')}」选一个，重复用没关系`,
  },
  {
    id: 'ai-words',
    test: (r) => r.hits.aiWords.length >= 1,
    why: (r) => r.hits.aiWords.map((h) => h.word).slice(0, 2).join('、'),
    hint: '换成平时会说的词',
  },
  {
    id: 'triple-list',
    // 列举真实存在的东西不算凑数。判据：并列项里能不能指认出具体的名词或数字。
    // 「开关、三个阈值、当场试一下」→ 能指认，放过
    // 「成本低、维护简单、扩展性好」→ 全是形容词，拦
    test: (r, text) => {
      const row = r.hits.structures.find((s) => s.id === 'triple');
      if (!row) return false;
      const span = row.spans[0]?.text || '';
      const items = span.split('、').filter(Boolean);
      // 每一项里有没有数字、英文、或者带量词的实词
      // 判据：这一项末尾是不是形容词/评价。
      // 「成本低」「维护简单」「扩展性好」—— 都以形容词收尾，是凑数。
      // 「三个阈值」「当场试一下」「开关」—— 是能指认的东西。
      const ADJ_TAIL = /(?:低|高|好|快|慢|强|弱|简单|复杂|清晰|合理|稳定|流畅|方便|优秀|完善|丰富|独特|重要|关键|核心)$/;
      const concrete = items.filter((it) => !ADJ_TAIL.test(it.trim()));
      return concrete.length < 2;
    },
    why: '三段并列',
    hint: '挑一个说透，别凑三个',
  },
  {
    id: 'summary',
    test: (r) => r.hits.summary.length > 0,
    why: (r) => r.hits.summary[0].word,
    hint: '删掉这句，前面已经说完了',
  },
  {
    id: 'fake-significance',
    test: (r) => r.hits.fakeSignificance.length > 0,
    why: (r) => r.hits.fakeSignificance[0].word,
    hint: '讲它是什么，不讲它多重要',
  },
  {
    id: 'emdash',
    test: (r) => r.hits.structures.some((s) => s.id === 'emdash'),
    why: '破折号',
    hint: '聊天里用逗号或句号',
  },
  {
    id: 'choppy-parallel',
    // 三个以上同构短句连着：很强。很方便。很实用。
    test: (r, text) => {
      const sents = text.split(/[。！？]/).map((s) => s.trim()).filter(Boolean);
      if (sents.length < 3) return false;
      // 前三个句子长度相近（±3 字）且都以同一个字开头
      const first3 = sents.slice(0, 3);
      const sameHead = first3.every((s) => s[0] === first3[0][0]);
      const similarLen = Math.max(...first3.map((s) => s.length)) - Math.min(...first3.map((s) => s.length)) <= 3;
      return sameHead && similarLen && r.scores.concretePer100 === 0;
    },
    why: '同构短句排比',
    hint: '合成一句，或者补一个具体的东西',
  },
  {
    id: 'hollow-praise',
    // 夸人不是问题，问题是整条回复只有夸、没有一个具体东西。
    // 「转场那里剪得挺流畅的」有具体位置，能过；
    // 「真的很不错，非常值得一看」只有空气，拦住。
    test: (r, text) => {
      if (text.length < 12) return false;
      if (r.scores.concretePer100 > 0) return false;
      // 评价词 + 程度词 + 感叹号，三样凑齐就是空夸
      // 只要两个以上评价词、且零具体物，就是空夸。
      // 不管带不带「很/非常」这些程度词。
      return r.scores.evaluation >= 2;
    },
    why: '只有夸，没有具体东西',
    hint: '说一句你具体看到的东西',
  },
  {
    id: 'no-concrete',
    // 长一点的回复里一个具体物都没有，说明在说空话
    // 聊天回复 20 字就是正常长度，门槛不该按长文的标准设
    test: (r, text) => text.length >= 12 && r.scores.concretePer100 === 0 && r.scores.evaluation >= 2,
    why: '全在评价，没有具体东西',
    hint: '说一件具体发生的事',
  },
];

/**
 * 过一遍。
 *
 * @param {string} text 准备发出去的那句话
 * @param {{strict?: boolean}} opts strict = 连轻微的信号也拦
 * @returns {{ok: boolean, why?: string, hint?: string, line: string}}
 */
export function guard(text, opts = {}) {
  const src = String(text ?? '').trim();
  if (!src) return { ok: true, line: 'OK' };

  // PR 描述、长 commit 也是对外文本，不该当文档放过。
  // 先判是不是 git 内容，再决定要不要跳过长文。
  // 判是不是 git 文本，用逐行的独立正则，不依赖 GIT_TEMPLATE_ROWS 的 m 标志
  // 长文本不跳过 —— 长邮件、长周报、长 PR 一样会像八股。
  // 但长文的判据要放宽：同一信号出现两三次才算，一次不算。
  const isLong = src.length > 300;
  const repeatBar = isLong ? 2 : 1;

  const r = analyze(src);
  const strict = opts.strict === true;

  for (const reason of REASONS) {
    let hit = false;
    try { hit = reason.test(r, src, { repeatBar }); } catch { hit = false; }
    if (!hit) continue;

    // 非 strict 时，最后两条（破折号、无具体物）只警告不打回
    if (!strict && (reason.id === 'emdash' || reason.id === 'no-concrete')) continue;

    const why = typeof reason.why === 'function' ? reason.why(r) : reason.why;
    const hint = typeof reason.hint === 'function' ? reason.hint(r) : reason.hint;
    return { ok: false, why, hint, line: `改：${why} · ${hint}` };
  }

  return { ok: true, line: 'OK' };
}

/** 只回一行，给最省的模式。 */
export function guardLine(text, opts) {
  return guard(text, opts).line;
}
