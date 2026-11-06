import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMemes, findMemes, lookup, buildIndex, stats } from '../lib/memes.js';

const list = loadMemes();

test('数据文件能载入', () => {
  assert.ok(Array.isArray(list));
  assert.ok(list.length > 0, '梗库不该是空的，实际 ' + list.length);
});

test('能查到具体梗', () => {
  assert.ok(lookup('社死', list).length > 0, '社死 该查得到');
  assert.ok(lookup('咕咕嘎嘎', list).length > 0, '咕咕嘎嘎 该查得到');
});

test('句子里的梗能识别', () => {
  const hits = findMemes('这就是传说中的咕咕嘎嘎', list);
  assert.ok(hits.some((h) => h.slug === '咕咕嘎嘎'));
});

test('单字不当梗匹配', () => {
  // 「鱼」「顺」这种单字会误命中太多，要求 >=2 字
  const hits = findMemes('我今天钓到一条鱼', list);
  assert.equal(hits.length, 0, '单字不该命中: ' + JSON.stringify(hits));
});

test('查不到时返回空，不崩', () => {
  assert.deepEqual(lookup('绝对不存在的梗词xyz', list), []);
  assert.doesNotThrow(() => findMemes('随便一句话', list));
  assert.doesNotThrow(() => findMemes('', list));
  assert.doesNotThrow(() => findMemes(null, list));
});

test('索引可重复构建', () => {
  const a = buildIndex(list);
  const b = buildIndex(list);
  assert.equal(a.size, b.size);
});

test('统计有内容', () => {
  const st = stats(list);
  assert.ok(st.total > 0);
  assert.ok(Array.isArray(st.tags));
});
