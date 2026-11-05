import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, render, registerOf, stripCode, concreteness, scanStructures, cluster } from '../lib/analyze.js';

test('典型八股判成 heavy', () => {
  const r = analyze(
    '本次修改已完成。首先调整了章节结构，其次新增了规则条款，最后优化了可读性。' +
    '综上所述，这次改动具有重要意义，希望对你有帮助。'
  );
  assert.equal(r.band, 'heavy');
  assert.ok(r.scores.aiWords >= 1);
  assert.ok(r.scores.structurePer1k > r.baseline * 3);
});

test('具体的现场描述判成 low', () => {
  const r = analyze(
    '昨晚十一点半，我第三次跑那个脚本，又卡在 8443 端口上了。' +
    '日志里就一行 `EADDRINUSE`，我盯着看了半天才反应过来。' +
    '后来把之前那个进程 kill 掉就好了，大概是我自己忘了关。'
  );
  assert.equal(r.band, 'low');
  assert.ok(r.scores.concretePer100 > 1);
  assert.ok(r.scores.hedges > 0);
});

test('留白词为零时报警', () => {
  const r = analyze(
    '这个方案完全可以落地。架构清晰，思路正确，实施路径明确，' +
    '只要按计划推进就一定能达到预期效果。'
  );
  assert.ok(r.asks.some((a) => a.includes('好像')));
});

test('结构腔不同种扎堆才报，同种重复不报', () => {
  const same = analyze('不是甲而是乙。不是丙而是丁。不是戊而是己。');
  assert.equal(same.scores.clusterDistinct, 1);
  assert.ok(!same.asks.some((a) => a.includes('种句式')));

  const mixed = analyze('不是甲而是乙。最先看到的是丙。先做丁再做戊。');
  assert.ok(mixed.scores.clusterDistinct >= 3);
  assert.ok(mixed.asks.some((a) => a.includes('种句式')));
});

test('代码块原文不进统计', () => {
  const src = '看看这个：\n```js\nconst x = { a: 1, b: 2, c: 3 };\n```\n就这样。';
  const r = analyze(src);
  assert.equal(r.hits.structures.length, 0);
});

test('stripCode 去掉围栏和行内代码', () => {
  assert.equal(stripCode('前```\ncode here\n```后').includes('code here'), false);
  assert.equal(stripCode('前`x`后'), '前后');
});

test('空输入不炸', () => {
  const r = analyze('');
  assert.equal(r.chars, 0);
  assert.ok(Array.isArray(r.asks));
  assert.ok(render(r).length > 0);
});

test('全空白输入不炸', () => {
  const r = analyze('   \n\n  ');
  assert.ok(typeof r.band === 'string');
});

test('文体判定：步骤 vs 闲聊', () => {
  assert.equal(registerOf('第一步先备份，然后改端口，接着重启，之后再看日志。'), 'steps');
  assert.equal(registerOf('哈哈哈笑死我了，这也太离谱'), 'chat');
});

test('具体性检出数字、时间、经历', () => {
  const c = concreteness('我昨天试了 3 次，8443 端口一直占用，后来改配置文件才好。');
  assert.ok(c.hits.some((h) => h.kind === 'number'));
  assert.ok(c.hits.some((h) => h.kind === 'time'));
  assert.ok(c.hits.some((h) => h.kind === 'experience'));
});

test('cluster 空输入', () => {
  assert.deepEqual(cluster([]), { width: 100, maxHits: 0, maxDistinct: 0, at: -1 });
});

test('render 输出包含三项要你自己答', () => {
  const out = render(analyze('综上所述，这个方案具有重要意义，以上。'));
  assert.ok(out.includes('[要你自己答]'));
  assert.ok(out.includes('[看不见]'));
});

test('同一个输入跑两次结果一致', () => {
  const s = '首先这样，其次那样。总的来说，不是甲而是乙。';
  assert.deepEqual(analyze(s).scores, analyze(s).scores);
});
