import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stats, findMemes, entry, search, bridge } from '../lib/memes.js';

test('库能打开，有 6792 条', () => {
  const st = stats();
  assert.equal(st.available, true, '库打不开');
  assert.ok(st.total > 6000, '条数不对：' + st.total);
  assert.ok(st.withUsage > 6000, 'usage 字段覆盖不够：' + st.withUsage);
});

test('能找到真实例子', () => {
  // 这几个是视频里用过的原话
  assert.ok(bridge('康神开播了').hits.length > 0, '康神开播了 该命中');
  assert.ok(bridge('我破防了').hits.length > 0, '破防 该命中');
  assert.ok(bridge('这叫内卷').hits.length > 0, '内卷 该命中');
  assert.ok(bridge('yyds').hits.length > 0, 'yyds 该命中');
});

test('闲聊不许误报', () => {
  // 6792 条里任何 2 字组合都能撞上东西，所以只允许精确匹配。
  // 这几条都是干活的话，不该触发。
  for (const t of [
    '帮我看看这个报错',
    '改完了，37 个测试全过',
    '这个函数返回 undefined',
    '端口 8080 被占了',
    '先跑一下 npm test',
  ]) {
    assert.equal(bridge(t).hits.length, 0, `误报了: ${t} → ${JSON.stringify(bridge(t).hits)}`);
  }
});

test('命中时带 usage', () => {
  const r = bridge('康神开播了');
  assert.ok(r.usage.length > 0, '该带 usage —— 那才是「怎么接」');
});

test('查词能拿到完整词条', () => {
  const e = entry('内卷');
  assert.ok(e, '内卷 查不到');
  assert.ok(e.summary, '该有 summary');
});

test('查不到时给候选', () => {
  assert.deepEqual(search('绝不存在的梗xyz'), []);
});

test('空输入不崩', () => {
  for (const t of ['', null, undefined, 0]) {
    assert.doesNotThrow(() => findMemes(t));
    assert.doesNotThrow(() => bridge(t));
    assert.deepEqual(findMemes(t), []);
  }
});

test('slug 大小写不敏感', () => {
  assert.ok(bridge('YYDS').hits.length > 0, '大写该命中');
  assert.ok(bridge('yyds').hits.length > 0, '小写该命中');
});
