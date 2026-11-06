/**
 * 接梗：不是查「这是什么意思」，是找「顺着这个能接什么」。
 *
 * 数据里现成的结构是：keywords 在梗之间重叠。
 *   「瞎问虾猜」→ 反向空耳 / 握着我的抱枕 / 七岁舔地砖 / 第四种速度
 *   「福本伸行」→ 超智游戏 / 斗牌传说 / 末世路
 * 这就是族。对方提了一个，从族里挑别的接上去。
 */

/** 泛用词，不能当族锚点。和 memes.js 里那份同源。 */
const STOP = new Set([
  '感谢', '分享', '推荐', '喜欢', '支持', '关注', '点赞', '评论',
  '视频', '内容', '这个', '那个', '什么', '怎么', '可以', '不能',
  '我们', '你们', '他们', '自己', '现在', '以后', '之前', '后来',
  '开始', '结束', '问题', '东西', '时间', '地方', '时候',
  'b站', '网络', '二次创作', '文字梗', '游戏梗', '动画梗', '梗',
]);

/**
 * 找能接的梗。
 *
 * @param {string} text 对方说的话
 * @param {Array} memes 梗库
 * @param {{max?: number}} opts
 * @returns {{by: string[], same: string[], tags: string[]}}
 */
export function bridge(text, memes, opts = {}) {
  const src = String(text ?? '');
  const max = opts.max || 4;
  if (!src || !memes || !memes.length) return { by: [], same: [], tags: [] };

  // 1. 这段话里提到了哪些梗
  const idx = new Map();
  for (const m of memes) {
    for (const k of [m.slug, m.title, ...(m.aliases || []), ...(m.keywords || [])]) {
      if (!k) continue;
      const key = String(k).toLowerCase();
      if (STOP.has(key) || key.length < 2) continue;
      if (!idx.has(key)) idx.set(key, []);
      idx.get(key).push(m);
    }
  }

  const hitWords = [];
  for (const k of idx.keys()) {
    if (src.toLowerCase().includes(k)) hitWords.push(k);
  }

  // 2. 先算「真的提到了」—— 按 slug / title / alias 直接命中，不靠 keyword
  const same = new Set();
  for (const m of memes) {
    const names = [m.slug, m.title, ...(m.aliases || [])]
      .filter(Boolean)
      .map((x) => String(x).toLowerCase());
    if (names.some((n) => n.length >= 2 && src.toLowerCase().includes(n))) same.add(m.slug);
  }

  // 3. 再算「同族里还有什么」—— 顺着 hitWords 找别的梗，排除已提到的
  const by = new Set();
  for (const k of hitWords) {
    for (const m of idx.get(k) || []) {
      if (same.has(m.slug)) continue;
      by.add(m.slug);
    }
  }

  // 4. 标签也带上 —— 有时候接的不是具体梗，是同一类
  const tags = new Set();
  for (const slug of same) {
    const m = memes.find((x) => x.slug === slug);
    for (const t of (m && m.tags) || []) tags.add(t);
  }

  return {
    by: [...by].slice(0, max),
    same: [...same].slice(0, max),
    tags: [...tags].slice(0, max),
  };
}

/**
 * 给一句人看的接梗提示。
 *
 * 不是替人写回复 —— 是告诉他「对方在说这一族，可以往这个方向接」。
 */
export function bridgeHint(text, memes, opts = {}) {
  const r = bridge(text, memes, opts);
  if (!r.same.length && !r.by.length) return null;

  const parts = [];
  if (r.same.length) {
    parts.push(`对方提的是 ${r.same.join('、')}`);
    if (r.by.length) parts.push(`同族还有 ${r.by.join('、')}`);
  } else if (r.by.length) {
    // 正文没提梗名，但提到了同一族的东西（作者、作品、系列）
    parts.push(`没提具体梗名，但这一族有 ${r.by.join('、')}`);
  }
  if (r.tags.length && !parts.length) parts.push(`这一类是 ${r.tags.slice(0, 3).join('/')}`);

  return parts.length ? parts.join('；') : null;
}
