/**
 * 梗库：选装模块，默认关。
 *
 * 守卫器本身判断的是「谁都能说」——空转、套话、模板。
 * 梗库判断的是另一件事：「这个词是不是过气了」「这个梗有没有人用」。
 * 两件事不该混在一起，所以这里单独一个模块，由 config.memes 开关。
 *
 * 数据来自梗Wiki（cnmeme.wiki）的公开 API，不需要凭证。
 * 抓到的是 slug / 标题 / 摘要 / 标签 / 关键词 / 别名。
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA = join(HERE, '..', 'data', 'memes.json');

let cache = null;
let cachePath = null;

/** 读梗库。找不到就返回空，不报错。 */
export function loadMemes(path = DEFAULT_DATA) {
  if (cache && cachePath === path) return cache;
  if (!existsSync(path)) return [];
  try {
    cache = JSON.parse(readFileSync(path, 'utf8'));
    cachePath = path;
    return cache;
  } catch {
    return [];
  }
}

/**
 * 建索引：slug / 标题 / 别名 / 关键词 → 条目。
 * 一个词可能对应多条，保留全部。
 */
export function buildIndex(memes) {
  const idx = new Map();
  for (const m of memes) {
    const keys = new Set([m.slug, m.title, ...(m.aliases || []), ...(m.keywords || [])].filter(Boolean));
    for (const k of keys) {
      const key = String(k).toLowerCase();
      if (!idx.has(key)) idx.set(key, []);
      idx.get(key).push(m);
    }
  }
  return idx;
}

/**
 * 在一段话里找梗。
 *
 * 只认完整词边界 —— 「鱼」这种单字会误命中太多，要求 2 字以上。
 * @returns {Array<{word:string, title:string, slug:string}>}
 */
export function findMemes(text, memes) {
  const src = String(text ?? '');
  if (!src) return [];
  const list = memes || loadMemes();
  if (!list.length) return [];

  const idx = buildIndex(list);
  const hits = [];
  const seen = new Set();

  // 长词优先：「神龙斗士」比「龙神号」更该先匹配，避免切碎
  const keys = [...idx.keys()].filter((k) => k.length >= 2).sort((a, b) => b.length - a.length);

  for (const k of keys) {
    if (src.toLowerCase().includes(k)) {
      for (const m of idx.get(k)) {
        if (seen.has(m.slug)) continue;
        seen.add(m.slug);
        hits.push({ word: k, title: m.title || m.slug, slug: m.slug });
      }
    }
  }
  return hits;
}

/** 查一个词是什么意思。 */
export function lookup(word, memes) {
  const list = memes || loadMemes();
  if (!list.length) return [];
  const idx = buildIndex(list);
  return idx.get(String(word).toLowerCase()) || [];
}

/** 统计。 */
export function stats(memes) {
  const list = memes || loadMemes();
  if (!list.length) return { total: 0 };
  const tags = {};
  for (const m of list) for (const t of (m.tags || [])) tags[t] = (tags[t] || 0) + 1;
  const top = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 10);
  return { total: list.length, tags: top };
}
