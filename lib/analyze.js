/**
 * 核心判断：这段话有多「可替换」。
 *
 * 「可替换」是这门判断的起点：
 *   八股的问题不是礼貌，是可替换。谁都能说的话，慢慢就没人想看了。
 *
 * 但「可替换」本身没法直接判。这里用四个可测的代理指标，各算各的，不合成一个漂亮总分：
 *
 *   1. 具体性  —— 数字、时间、经历、感官、原话、标识符。只有真的在说事的人才给得出。
 *   2. 抽象度  —— 意义、价值、本质、趋势…… 说得越多，越是在说事之外撑场面。
 *   3. 评价度  —— 重要、关键、深刻、全面。说得越满，越像评职称。
 *   4. 结构腔  —— 真人密度极低，超标 3 倍就报。
 *
 * 外加两条不占分但单独报的：
 *   5. 留白词 —— 一个都没有 = 句句在下断言。
 *   6. 扎堆   —— 同一百字里换了三种句式，是 AI 指纹；同一种来两次不算。
 *
 * 刻意不做的事：
 *   - 不给「人味分」这种单一数字。分数会让人只盯数字，不看句子。
 *   - 不自动改写。改要人改，工具只把材料摆出来。
 */

import {
  AI_WORDS,
  SUMMARY_OPENERS,
  FAKE_SIGNIFICANCE,
  ABSTRACT_NOUNS,
  EVAL_ADJECTIVES,
  HEDGE_WORDS,
  CONCRETE_MARKERS,
  STRUCTURE_FRAMES,
  REGISTERS,
  HEDGE_BASELINE,
  HEDGE_FLOOR,
} from './lexicon.js';

/** 去代码块和行内代码，只留正文。 */
export function stripCode(text) {
  return String(text ?? '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '')
    .replace(/^#{1,6}\s.*$/gm, '');
}

function countWords(text, list) {
  const hits = [];
  for (const w of list) {
    let from = 0;
    for (;;) {
      const at = text.indexOf(w, from);
      if (at < 0) break;
      hits.push({ word: w, at });
      from = at + w.length;
    }
  }
  return hits;
}

function countPattern(text, re) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  const hits = [];
  for (const m of text.matchAll(g)) hits.push({ word: m[0], at: m.index });
  return hits;
}

/** 猜文体。规则很土，但每条都能说清为什么。 */
export function registerOf(text) {
  const s = String(text ?? '');
  const n = s.length;
  const c = (re) => (s.match(re) || []).length;

  const casual = c(/哈哈|笑死|草|emmm|嗯嗯|诶|啊这|233|好耶|卧槽|靠/gu)
    + c(/[（(][^)）]{0,6}[)）]/g);
  const steps = c(/然后|接着|第一步|第二步|之后|再是|最后|先是/g);
  const argue = c(/但是|可是|其实|问题是|然而|不过|反而|恰恰|我觉得|我认为|说句|不是这样/g);
  const explain = c(/因为|所以|也就是说|相当于|意思是|本质上|原因|意味着|换句话说/g);

  if (casual >= 2) return 'chat';
  if (steps >= 3) return 'steps';
  if (n < 40) return 'chat';
  if (argue >= 2) return 'argue';
  if (explain >= 2) return 'explain';
  if (n < 150) return 'note';
  return 'explain';
}

/**
 * 具体性：每百字命中几个「只有当事人给得出的东西」。
 * @returns {{hits: Array<{kind:string,text:string,at:number}>, per100:number}}
 */
export function concreteness(text) {
  const src = String(text ?? '');
  const hits = [];
  for (const [kind, re] of Object.entries(CONCRETE_MARKERS)) {
    const g = new RegExp(re.source, 'g');
    for (const m of src.matchAll(g)) {
      hits.push({ kind, text: m[0], at: m.index });
    }
  }
  const per100 = src.length ? (hits.length / src.length) * 100 : 0;
  return { hits, per100: Math.round(per100 * 100) / 100 };
}

/** 结构腔扫描。 */
export function scanStructures(text) {
  const src = String(text ?? '');
  const rows = [];
  for (const f of STRUCTURE_FRAMES) {
    const g = new RegExp(f.re.source, 'g');
    const spans = [...src.matchAll(g)].map((m) => ({ text: m[0], at: m.index }));
    if (spans.length) {
      rows.push({ id: f.id, name: f.name, per1k: f.per1k, count: spans.length, spans });
    }
  }
  return rows;
}

/** 同一百字窗口里，最多几种不同句式、最多个命中。 */
export function cluster(hits, width = 100) {
  if (!hits.length) return { width, maxHits: 0, maxDistinct: 0, at: -1 };
  let maxHits = 0;
  let maxDistinct = 0;
  let at = -1;
  for (const h of hits) {
    const win = hits.filter((x) => x.at >= h.at && x.at < h.at + width);
    if (win.length > maxHits) { maxHits = win.length; at = h.at; }
    const d = new Set(win.map((x) => x.id)).size;
    if (d > maxDistinct) { maxDistinct = d; at = h.at; }
  }
  return { width, maxHits, maxDistinct, at };
}

/**
 * 主入口。
 * @returns 结构化判断结果，不含任何改写建议的原句
 */
export function analyze(input) {
  const raw = String(input ?? '');
  const text = stripCode(raw);
  const chars = text.length;
  const per1k = (n) => (chars ? Math.round((n / chars) * 1000 * 10) / 10 : 0);

  const reg = registerOf(text);
  const baseline = REGISTERS[reg].per1k;

  // ── 四个代理指标 ──────────────────────────────
  const conc = concreteness(text);
  const abstractHits = countWords(text, ABSTRACT_NOUNS);
  const evalHits = countWords(text, EVAL_ADJECTIVES);
  const aiWordHits = countWords(text, AI_WORDS);
  const summaryHits = countWords(text, SUMMARY_OPENERS);
  const fakeHits = countWords(text, FAKE_SIGNIFICANCE);

  // ── 留白 ─────────────────────────────────────
  const hedgeHits = countWords(text, HEDGE_WORDS);
  const hedgePer1k = per1k(hedgeHits.length);

  // ── 结构腔 ────────────────────────────────────
  const structures = scanStructures(text);
  const totalStructures = structures.reduce((a, r) => a + r.count, 0);
  const structurePer1k = per1k(totalStructures);
  const allowed = Math.max(chars >= 200 ? 1 : 0, Math.round((baseline * chars) / 1000));
  const overTimes = baseline ? Math.round((structurePer1k / baseline) * 10) / 10 : 0;

  const flatHits = [];
  for (const row of structures) {
    for (const s of row.spans) flatHits.push({ id: row.id, name: row.name, at: s.at, span: s.text });
  }
  const cl = cluster(flatHits);

  // ── 判档 ─────────────────────────────────────
  // 可替换度：六个信号，各算一分。用密度不用绝对数 —— 五十个字里出一个「意义」，
  // 比五百字里出四个「意义」更能说明问题。
  const per100 = (n) => (chars ? Math.round((n / chars) * 100 * 10) / 10 : 0);
  const abstractPer100 = per100(abstractHits.length);
  const evalPer100 = per100(evalHits.length);
  const aiWordPer100 = per100(aiWordHits.length);

  const replaceable =
    (conc.per100 < 0.6 ? 1 : 0) +
    (abstractPer100 + evalPer100 >= 2 ? 1 : 0) +
    (aiWordPer100 >= 1 || aiWordHits.length >= 2 ? 1 : 0) +
    (structurePer1k > baseline * 3 ? 1 : 0) +
    (hedgePer1k < HEDGE_FLOOR && chars > 40 ? 1 : 0) +
    (summaryHits.length + fakeHits.length > 0 ? 1 : 0);

  let band;
  let bandLabel;
  let bandNote;
  if (replaceable >= 4) {
    band = 'heavy';
    bandLabel = '换谁都行';
    bandNote = '把这些句子搬到另一个人嘴里，读起来不会有差别。';
  } else if (replaceable >= 2) {
    band = 'mid';
    bandLabel = '有一半可以换人';
    bandNote = '有具体东西，但撑场面的那部分谁都能说。';
  } else {
    band = 'low';
    bandLabel = '换个人说会不一样';
    bandNote = '看得出是谁在说话。';
  }

  // ── 逐条问题：只给问句，不给答案 ────────────────
  const asks = [];
  if (aiWordHits.length) {
    asks.push(`「${aiWordHits.map((h) => h.word).join('」「')}」—— 这几个词，换成平时说话你会怎么讲？`);
  }
  if (summaryHits.length) {
    asks.push(`开头就在总结（${summaryHits.map((h) => h.word).join('、')}）。删掉这一句，下面的东西还站得住吗？`);
  }
  if (fakeHits.length) {
    asks.push(`「${fakeHits.map((h) => h.word).join('」「')}」—— 这是它是什么，还是它多重要？`);
  }
  if (abstractHits.length >= 4) {
    asks.push('抽象名词成片了。挑其中一个，说一件具体发生过的事代替它。');
  }
  if (evalHits.length >= 3) {
    asks.push(`评价词用了 ${evalHits.length} 个（${evalHits.map((h) => h.word).slice(0, 4).join('、')}…）。说清夸的是哪一句，比夸得满有用。`);
  }
  if (hedgePer1k < HEDGE_FLOOR && chars > 40) {
    asks.push('一个「好像 / 应该 / 大概」都没有。全篇没有一处不确定，是真的都想清楚了？');
  }
  if (cl.maxDistinct >= 3) {
    asks.push(`同一百字里换了 ${cl.maxDistinct} 种句式。挑一种留下，其余换成别的说法。`);
  }
  if (structurePer1k > baseline * 3) {
    asks.push(`结构腔 ${structurePer1k}/千字，真人同文体约 ${baseline}。那一处在说事，还是在给事分层？`);
  }
  if (conc.per100 < 0.6 && chars > 40) {
    asks.push('没有数字、时间、经历过的事、原话、具体名字。这段话是你看见的，还是你听说的？');
  }
  if (!asks.length) {
    asks.push('找不明显的毛病。剩下的那点别扭，得你自己读一遍才知道在哪。');
  }

  return {
    chars,
    register: reg,
    registerLabel: REGISTERS[reg].label,
    baseline,
    band,
    bandLabel,
    bandNote,
    scores: {
      replaceable,
      concretePer100: conc.per100,
      abstract: abstractHits.length,
      evaluation: evalHits.length,
      aiWords: aiWordHits.length,
      hedges: hedgeHits.length,
      hedgePer1k,
      structurePer1k,
      overTimes,
      clusterDistinct: cl.maxDistinct,
      clusterMax: cl.maxHits,
    },
    hits: {
      aiWords: aiWordHits,
      summary: summaryHits,
      fakeSignificance: fakeHits,
      abstract: abstractHits,
      evaluation: evalHits,
      hedges: hedgeHits,
      concrete: conc.hits,
      structures,
    },
    asks,
    baselineHedge: HEDGE_BASELINE,
    blind: '这一步只认字面和句式。同一件事换个说法又说一遍、每段都收个小结论、通篇一个调子 —— 这些它看不见，得你自己读。',
  };
}

/** 渲染成人看的文本。 */
export function render(result) {
  const r = result;
  const L = [];
  L.push(`[判断] ${r.bandLabel} · ${r.bandNote}`);
  L.push(`[文体] ${r.registerLabel} · 真人同文体结构腔基线 ${r.baseline}/千字`);
  L.push(
    `[具体] 每百字 ${r.scores.concretePer100} 个具体物（数字/时间/经历/原话/名字）· ` +
    `抽象词 ${r.scores.abstract} · 评价词 ${r.scores.evaluation}`
  );
  L.push(
    `[留白] ${r.scores.hedges} 个（${r.scores.hedgePer1k}/千字，真人约 ${r.baselineHedge}）` +
    (r.scores.hedgePer1k < HEDGE_FLOOR ? ' —— 一个都没有，等于句句在下断言' : '')
  );
  L.push(
    `[结构腔] ${r.scores.structurePer1k}/千字 · 真人基线的 ${r.scores.overTimes} 倍 · ` +
    `同百字最多 ${r.scores.clusterDistinct} 种句式`
  );
  if (r.hits.structures.length) {
    L.push('[逐处]');
    for (const row of r.hits.structures) {
      L.push(`  · ${row.name} ×${row.count}：${row.spans.map((s) => `「${s.text}」`).join(' ')}`);
    }
  }
  L.push('[要你自己答]');
  for (const a of r.asks) L.push(`  - ${a}`);
  L.push(`[看不见] ${r.blind}`);
  return L.join('\n');
}
