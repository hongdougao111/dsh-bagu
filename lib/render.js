/**
 * 输出渲染。默认紧凑，full 才给完整报告。
 *
 * 设计约束：这是要进上下文的文本，每一个字都在烧 token。
 * 默认输出压到三行以内；需要细节的人自己传 full。
 */

const BAND = {
  heavy: '可疑',
  mid: '有点',
  low: '正常',
  'too-short': '太短',
};

function pct(n) {
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {object} r analyze() 的结果
 * @param {{full?: boolean}} opts
 */
export function render(r, opts = {}) {
  const full = opts.full === true;

  // 三行紧凑模式
  if (!full) {
    const head = BAND[r.band] || r.bandLabel;
    const nums = `具体${pct(r.scores.concretePer100)} 抽象${r.scores.abstract} ` +
      `评价${r.scores.evaluation} 留白${pct(r.scores.hedgePer1k)} 结构${pct(r.scores.structurePer1k)}/千`;
    const hits = [];
    for (const row of r.hits.structures) {
      for (const s of row.spans.slice(0, 2)) hits.push(`「${s.text}」`);
      if (row.spans.length > 2) hits[hits.length - 1] += `×${row.spans.length}`;
    }
    for (const h of r.hits.aiWords.slice(0, 3)) hits.push(h.word);
    if (r.synonyms && r.synonyms.length) hits.push(`同义轮换${r.synonyms.length}组`);

    const lines = [head];
    if (nums.length > 4) lines[0] += `  ${nums}`;
    if (hits.length) lines.push('· ' + hits.slice(0, 6).join(' '));
    if (r.asks && r.asks.length) lines.push('问 ' + r.asks[0]);
    return lines.join('\n');
  }

  // 完整模式（原样保留详细版，供人看）
  const L = [];
  L.push(`[判断] ${r.bandLabel} · ${r.bandNote}`);
  L.push(`[文体] ${r.registerLabel} · 真人同文体结构腔基线 ${r.baseline}/千字`);
  L.push(
    `[具体] 每百字 ${r.scores.concretePer100} 个 · 抽象词 ${r.scores.abstract} · 评价词 ${r.scores.evaluation}`
  );
  L.push(
    `[留白] ${r.scores.hedges} 个（${r.scores.hedgePer1k}/千字）` +
    (r.scores.hedgePer1k < (r.thresholds?.hedgeFloor ?? 0.2) ? ' —— 句句在下断言' : '')
  );
  L.push(
    `[结构腔] ${r.scores.structurePer1k}/千字 · 基线的 ${r.scores.overTimes} 倍 · ` +
    `同百字最多 ${r.scores.clusterDistinct} 种句式`
  );
  if (r.synonyms && r.synonyms.length) {
    L.push(`[同义轮换] ${r.synonyms.map((g) => g.join('/')).join(' · ')}`);
  }
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

/** 只要一句结论，最省。 */
export function renderBrief(r) {
  const head = BAND[r.band] || r.bandLabel;
  const bits = [];
  if (r.hits.structures.length) bits.push(r.hits.structures[0].name);
  if (r.hits.aiWords.length) bits.push(r.hits.aiWords[0].word);
  return bits.length ? `${head}：${bits.join('、')}` : head;
}
