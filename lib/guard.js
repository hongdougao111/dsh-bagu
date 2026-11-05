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
import { STOCK_PHRASES } from './lexicon.js';

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
    test: (r, text) =>
      r.hits.structures.some((s) => s.id === 'negation') ||
      OPPOSITION_FRAMES.some((re) => re.test(text)),
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
    test: (r) => r.hits.structures.some((s) => s.id === 'triple'),
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

  // 太长的不拦 —— 那是长文，不是聊天回复，判断标准不一样
  if (src.length > 300) return { ok: true, line: 'OK', skipped: 'too-long' };

  const r = analyze(src);
  const strict = opts.strict === true;

  for (const reason of REASONS) {
    let hit = false;
    try { hit = reason.test(r, src); } catch { hit = false; }
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
