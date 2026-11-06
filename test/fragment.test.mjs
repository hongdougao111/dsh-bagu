import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bridge } from '../lib/memes.js';

// 片段匹配：用户只说简称（「码头」「破防」），标题整个不出现。
//
// 之前试过「把话切成 2-3 字碎片去 LIKE 查」，误报爆炸 ——
// 「帮我看看这个报错」撞出「让我看看你的战斗表情」。
// 现在靠三层过滤：只收纯中文、滤量词组合、滤动词短语、滤人称重叠，
// 外加「标题超 10 字是整句，不适用简称」。

bridge('预热');

test('句子里的简称能接住', () => {
  const cases = [
    ['整点薯条', '去码头整点薯条'],
    ['开播了', '康神开播了'],
    ['这波破防', '破防'],
    ['搁这搁这', '你搁这搁这呢'],
    ['灭建国是谁', '灭建国'],
    ['这个咕咕嘎嘎我笑了半天', '咕咕嘎嘎'],
  ];
  for (const [input, want] of cases) {
    const r = bridge(input);
    const titles = r.hits.map((h) => h.title);
    assert.ok(titles.some((t) => t.includes(want) || want.includes(t)),
      `「${input}」该接住 ${want}，实际 ${JSON.stringify(titles)}`);
  }
});

test('干活的话一句都不许误报', () => {
  const cases = [
    '帮我看下这个报错',
    '这个函数返回 undefined',
    '改完了，37 个测试全过',
    '端口 8080 被占了',
    '先跑一下 npm test',
    '这个配置有点问题',
    '数组长度为 0',
    '用户输入为空',
    '这条消息发一下',
    '下一版再加',
    '第 3 行报错',
    '两个文件都改了',
    '三个测试挂了',
    '先看一下日志',
    '帮忙改一下',
    '跑一下测试',
    '我看看这个',
    '你试试看',
  ];
  for (const t of cases) {
    assert.equal(bridge(t).hits.length, 0,
      `误报了: ${t} → ${JSON.stringify(bridge(t).hits.map((h) => h.title))}`);
  }
});

test('片段只收纯中文', () => {
  // 英文词、纯数字当片段会撞上一堆无关内容
  assert.equal(bridge('端口 8080 被占了').hits.length, 0);
  assert.equal(bridge('返回 undefined').hits.length, 0);
});

test('整句级标题不适用简称', () => {
  // 「这是一个测试」这种 7 字整句，用户不会只喊中间 3 个字
  assert.equal(bridge('改完了 37 个测试全过').hits.length, 0);
});

test('量词组合不当简称', () => {
  assert.equal(bridge('两个文件都改了').hits.length, 0);
  assert.equal(bridge('三个测试挂了').hits.length, 0);
});

test('动词短语不当简称', () => {
  assert.equal(bridge('先看一下日志').hits.length, 0);
  assert.equal(bridge('这条消息发一下').hits.length, 0);
});

test('人称 + 动词重叠不当简称', () => {
  assert.equal(bridge('我看看这个').hits.length, 0);
  assert.equal(bridge('你试试看').hits.length, 0);
});
