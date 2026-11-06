/**
 * 梗库：内置 SQLite，6792 条。
 *
 * 数据来源 thawline/dsh-memewiki（MIT），它的库又是从 cnmeme.wiki 攒的。
 * 用它而不是自己抓，是因为它整理了 usage 字段 —— 「这个梗怎么用」，
 * 那正是接梗最需要的东西，cnmeme 的接口里只有摘要。
 *
 * 只用 Node 自带的 node:sqlite，零依赖。
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(HERE, '..', 'data', 'memes.db');

let db = null;
let ready = false;

/** 泛用词，不能当梗锚点。 */
const STOP = new Set([
  '感谢', '分享', '推荐', '喜欢', '支持', '关注', '点赞', '评论',
  '视频', '内容', '这个', '那个', '什么', '怎么', '可以', '不能',
  '我们', '你们', '他们', '自己', '现在', '以后', '之前', '后来',
  '开始', '结束', '问题', '东西', '时间', '地方', '时候',
]);

function open() {
  if (ready) return db;
  ready = true;
  if (!existsSync(DB_PATH)) return null;
  try {
    db = new DatabaseSync(DB_PATH, { readOnly: true });
    return db;
  } catch {
    return null;
  }
}

/** 库在不在、多少条。 */
export function stats() {
  const d = open();
  if (!d) return { total: 0, available: false };
  try {
    const n = d.prepare('SELECT COUNT(*) c FROM memes').get().c;
    const uso = d.prepare("SELECT COUNT(*) c FROM memes WHERE usage != ''").get().c;
    return { total: n, withUsage: uso, available: true };
  } catch {
    return { total: 0, available: false };
  }
}

/**
 * 在一段话里找梗。
 *
 * 三种匹配，越长越优先：
 *   1. 标题完全出现（「去码头整点薯条」）
 *   2. 标题的一部分出现（「码头」「康神」）
 *   3. 别名出现
 */
/**
 * 常用词黑名单：这些词出现在话里不算梗，不能拿去反查标题。
 *
 * 之前误报的根因就是拿「帮我」「看看」「这个」去 LIKE 查，什么都能撞上。
 */
const COMMON = new Set([
  '这个', '那个', '什么', '怎么', '可以', '不能', '我们', '你们', '他们',
  '自己', '现在', '以后', '之前', '后来', '开始', '结束', '问题', '东西',
  '时候', '因为', '所以', '但是', '如果', '还是', '就是', '不是', '表示',
  '帮我', '看看', '一下', '一个', '没有', '已经', '需要', '应该', '可能',
  '这里', '那里', '哪里', '为什么', '怎么办', '是不是', '会不会', '能不能',
  '测试', '报错', '函数', '返回', '代码', '文件', '修改', '添加', '删除',
  '更新', '处理', '逻辑', '实现', '功能', '方法', '配置', '端口', '运行',
]);

/** 内存索引。库是只读的，建一次就够。 */
let INDEX = null;

function buildIndex() {
  if (INDEX) return INDEX;
  const d = open();
  if (!d) return null;
  const entries = [];
  try {
    const rows = d.prepare('SELECT title, slug, aliases, usage, origin, tags, summary FROM memes').all();
    for (const r of rows) {
      const keys = new Set();
      const t = String(r.title || '').trim();
      const sl = String(r.slug || '').trim();
      if (t.length >= 2 && !STOP.has(t.toLowerCase())) keys.add(t.toLowerCase());
      if (sl.length >= 2 && !STOP.has(sl.toLowerCase())) keys.add(sl.toLowerCase());
      for (const a of String(r.aliases || '').split(/[、,，;；\s]+/).filter(Boolean)) {
        if (a.length >= 2 && !STOP.has(a.toLowerCase())) keys.add(a.toLowerCase());
      }
      if (keys.size) {
        // 标题的片段：3 字以上才算锚点。「码头」这种 2 字太泛，只能靠 exact 命中
        const frags = [];
        if (t.length >= 4) {
          for (let n3 = 3; n3 <= Math.min(5, t.length - 1); n3++) {
            for (let i = 0; i + n3 <= t.length; i++) {
              const fr = t.slice(i, i + n3);
              if (COMMON.has(fr)) continue;
              // 只收纯中文片段 —— 英文词和纯数字会撞上一堆无关内容
              if (!/^[\u4e00-\u9fa5]+$/.test(fr)) continue;
              // 量词 + 名词（「个测试」「条消息」「次更新」）不是简称，是语法
              if (/^(?:这个|那个|一个|个|条|次|份|张|段|句|行|位|只|件|种|些|批)(?:[\u4e00-\u9fa5]{1,2})?$/.test(fr)) continue;
              // 动词短语（「发一下」「看一下」）是日常话，不是简称
              if (/^(?:发|看|试|来|去|做|搞|弄|说|讲|走|跑|改|写|读|查|问|给|拿|放|加|减|要|想|能|会|用|有|是)(?:一下|一点|一回|个|过)$/.test(fr)) continue;
              if (/^(?:我|你|他|她|它|咱)(?:看看|试试|来说|讲讲|想想|查查|找找|问问|聊聊|说说|走走|弄弄|搞搞|改改|写写)$/.test(fr)) continue;
              frags.push(fr);
            }
          }
        }
        entries.push({
          title: r.title, slug: r.slug, keys: [...keys], frags,
          usage: String(r.usage || '').replace(/\s+/g, ' '),
          origin: String(r.origin || '').replace(/\s+/g, ' '),
          tags: String(r.tags || '').split(/[、,，]+/).filter(Boolean),
          summary: String(r.summary || '').replace(/\s+/g, ' '),
        });
      }
    }
  } catch { /* 忽略 */ }

  // 长的排前面 —— 匹配时先撞长的
  for (const e of entries) e.keys.sort((a, b) => b.length - a.length);
  entries.sort((a, b) => (b.keys[0] || '').length - (a.keys[0] || '').length);

  INDEX = entries;
  return INDEX;
}

export function findMemes(text, limit = 5) {
  const src = String(text ?? '');
  if (!src) return [];
  const idx = buildIndex();
  if (!idx) return [];

  const low = src.toLowerCase();
  const hits = [];

  // 1. 精确命中：标题 / slug / 别名整个出现（最可靠）
  for (const e of idx) {
    for (const k of e.keys) {
      if (low.includes(k)) {
        hits.push({ title: e.title, slug: e.slug, by: 'exact', len: k.length, key: k });
        break;
      }
    }
  }

  // 2. 片段命中：用户只说简称（「码头」「康神」），标题整个不出现。
  //    判据是「这话里的字，反过来是某条标题的连续片段」。
  //    限制：片段 >= 3 字，不是常用词，且这条必须没被精确命中过。
  const exactTitles = new Set(hits.map((h) => h.title));
  const clean = src.replace(/[，。！？、,.!?\s（）()【】「」"'’‘]/g, ' ');
  const chunks = clean.split(' ').filter(Boolean);
  const probes = [];
  for (const c of chunks) {
    if (c.length < 3) continue;
    // 整段，以及 3-4 字的滑窗
    probes.push(c);
    for (let n = 4; n >= 3; n--) {
      for (let i = 0; i + n <= c.length; i++) {
        const w = c.slice(i, i + n);
        if (COMMON.has(w)) continue;
        if (!/^[\u4e00-\u9fa5]+$/.test(w)) continue;   // 只探中文
        if (/^(?:这个|那个|一个|个|条|次|份|张|段|句|行|位|只|件|种|些|批)(?:[\u4e00-\u9fa5]{1,2})?$/.test(w)) continue;
        if (/^(?:发|看|试|来|去|做|搞|弄|说|讲|走|跑|改|写|读|查|问|给|拿|放|加|减|要|想|能|会|用|有|是)(?:一下|一点|一回|个|过)$/.test(w)) continue;
        if (/^(?:我|你|他|她|它|咱)(?:看看|试试|来说|讲讲|想想|查查|找找|问问|聊聊|说说|走走|弄弄|搞搞|改改|写写)$/.test(w)) continue;
        probes.push(w);
      }
    }
  }
  const probeSet = new Set(probes);
  for (const e of idx) {
    if (exactTitles.has(e.title)) continue;
    if (!e.frags || !e.frags.length) continue;
    // 标题本身超过 10 字是整句，简称匹配不适用
    if (String(e.title).length > 10) continue;
    for (const fr of e.frags) {
      if (probeSet.has(fr)) {
        hits.push({ title: e.title, slug: e.slug, by: 'fragment', len: fr.length, key: fr });
        break;
      }
    }
  }

  // 去重，长的优先
  const seen = new Set();
  const out = [];
  for (const h of hits.sort((a, b) => b.len - a.len)) {
    if (seen.has(h.slug)) continue;
    seen.add(h.slug);
    out.push(h);
  }
  return out.slice(0, limit);
}

/** 取一条完整词条。 */
export function entry(slugOrTitle) {
  const q = String(slugOrTitle ?? '').trim();
  if (!q) return null;
  const idx = buildIndex();
  if (!idx) return null;
  const low = q.toLowerCase();
  // 先按 title / slug 精确，再退到 key 里找
  for (const e of idx) {
    if (e.title === q || e.slug === q) return e;
  }
  for (const e of idx) {
    if (e.keys.some((k) => k === low)) return e;
  }
  return null;
}

/** 模糊查：拿不到完全匹配时给候选。 */
export function search(q, limit = 5) {
  const d = open();
  if (!d) return [];
  const s = String(q ?? '').trim();
  if (!s) return [];
  try {
    return d.prepare('SELECT title, slug FROM memes WHERE title LIKE ? OR slug LIKE ? LIMIT ?')
      .all('%' + s + '%', '%' + s + '%', limit);
  } catch {
    return [];
  }
}

/**
 * 接梗：给一句话，返回「提到了什么」+「能怎么用」。
 *
 * usage 字段是现成的 —— 它直接写着「怎么接」，
 * 不用我再拿摘要去猜。
 */
export function bridge(text, opts = {}) {
  const hits = findMemes(text, opts.max || 3);
  if (!hits.length) return { hits: [], usage: '', origin: '', tags: [] };

  const idx = buildIndex() || [];
  const top = idx.find((e) => e.title === hits[0].title) || {};
  return {
    hits,
    usage: String(top.usage || '').slice(0, 200),
    origin: String(top.origin || '').slice(0, 120),
    tags: top.tags || [],
  };
}
