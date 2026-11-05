import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { analyze, render, registerOf, stripCode, concreteness, scanStructures, cluster } from '../lib/analyze.js';

const here = dirname(fileURLToPath(import.meta.url));

test('典型八股判成 heavy', () => {
  const r = analyze(
    '本次修改已完成。首先调整了章节结构，其次新增了规则条款，最后优化了可读性。' +
    '综上所述，这次改动具有重要意义，希望对你有帮助。'
  );
  assert.ok(r.band === 'heavy' || r.band === 'mid', '实际 ' + r.band);
  assert.ok(r.scores.aiWords >= 1, '该认出「综上所述」这类词');
});

test('「首先/其次」单独不再算结构腔（lieflat δ+0.02 失效）', () => {
  const r = analyze('首先备份，其次改配置，最后重启。数据库密码记得先换掉，不然白改。');
  const hasRoadmap = r.hits.structures.some((x) => x.id === 'roadmap');
  assert.equal(hasRoadmap, false, 'roadmap 不该再出现在结构腔里');
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

// ── issue #1 的回归用例 ────────────────────────────────────

test('#1.1 英文普通单词不再算具体物', () => {
  const r = analyze('The build pipeline uses a cache layer and the worker reads a manifest before it starts.');
  assert.equal(r.hits.concrete.filter((h) => h.kind === 'ident' && /^[a-z]+$/.test(h.text)).length, 0);
  assert.ok(r.scores.concretePer100 < 2, '纯英文散文该接近 0，实际 ' + r.scores.concretePer100);
});

test('#1.1 真正的标识符仍然计入', () => {
  const r = analyze('把它放到 /usr/local/bin/node，然后设 EADDRINUSE 那个变量，路径是 C:/Users/x/y.js。');
  const ids = r.hits.concrete.filter((h) => h.kind === 'ident').map((h) => h.text);
  assert.ok(ids.some((t) => t.includes('/usr/local/bin/node')));
  assert.ok(ids.some((t) => t.includes('EADDRINUSE')));
});

test('#1.2 可核验的数字路径权重高于可编造的经历（方向修正）', () => {
  // 上一版把 experience/sense 给到 1.5，理由是「难伪造」。
  // 这是错的：经历最好编，三样凑齐就是模板。数字和路径可核验，反而该给分。
  const fabricated = concreteness('我昨天试着改了一下，折腾到凌晨两点半才跑通，手都酸了。');
  const real = concreteness('配置文件在 /etc/app/config.yml，端口 8080，版本 v1.4.2。');
  assert.ok(real.weighted > fabricated.weighted,
    `真实配置该比编造经历高: real=${real.weighted} fabricated=${fabricated.weighted}`);
});

test('#1.4 具体物充足时往回减一格', () => {
  const rich = analyze(
    '昨晚十一点半我第三次跑那个脚本，又卡在 8443 端口。日志里只有 EADDRINUSE。' +
    '我盯着看了半天才反应过来，后来把之前那个进程 kill 掉就好了，大概是我自己忘了关。'
  );
  const empty = analyze(
    '这个方案具有重要意义，是关键的转折点，体现了深刻的洞察，值得每个人认真思考和学习。'
  );
  assert.ok(rich.scores.replaceable < empty.scores.replaceable,
    `具体的那段不该比空话更可疑: rich=${rich.scores.replaceable} empty=${empty.scores.replaceable}`);
});

test('短句走绝对计数，不看密度', () => {
  const ai = analyze('这不是技术问题，而是认知问题。');
  const human = analyze('卖卡卖完了随便写了');
  assert.equal(ai.band, 'heavy', 'AI 对举应判可疑，实际 ' + ai.band);
  assert.equal(human.band, 'low', '真人短评应判正常，实际 ' + human.band);
});

test('短句：同义轮换能被抓到', () => {
  const r = analyze('我们使用了新方法，采用了更好的方式，通过提升效率来优化流程。');
  assert.ok(r.synonyms.length >= 2, '应抓到多组轮换，实际 ' + JSON.stringify(r.synonyms));
});

test('#1.8 六十字以上照常判档', () => {
  const r = analyze(
    '本次修改已完成。首先调整了章节结构，其次新增了规则条款，最后优化了可读性。' +
    '综上所述，这次改动具有重要意义，希望对你有帮助。'
  );
  assert.notEqual(r.band, 'too-short');
});

test('#1.6b 没有死代码留下的未使用变量', () => {
  const src = readFileSync(join(here, '..', 'lib', 'analyze.js'), 'utf8');
  assert.ok(!src.includes('const allowed ='), 'allowed 应该已经删掉');
});
