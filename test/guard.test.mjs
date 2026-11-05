import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guard, guardLine } from '../lib/guard.js';

// ── 机器人场景的真实样本 ──────────────────────────
const BLOCK = [
  ['模板三连', '这条我认！首先态度要正，其次内容要实，最后要持续更新。'],
  ['对举', '这不是技术问题，而是认知问题。'],
  ['同义轮换', '我们今天使用了新方法，采用了更好的方式。'],
  ['空夸', '这个视频真的很不错，非常值得一看！'],
  ['八股词', '综上所述，这次改动具有重要意义。'],
];

const PASS = [
  ['真人短评', '卖卡卖完了随便写了'],
  ['具体经历', '我上次也踩过，8443 端口被占了'],
  ['正常夸', '转场那里剪得挺流畅的，我看了一遍'],
  ['闲聊', '吃了，就一碗面，汤有点咸'],
  ['反问', '你没看明白我想说的。'],
];

test('该拦的都拦住', () => {
  for (const [name, text] of BLOCK) {
    const r = guard(text);
    assert.equal(r.ok, false, `${name} 该拦但放过了: ${text}`);
    assert.ok(r.line.startsWith('改：'), `${name} 的输出该以「改：」开头: ${r.line}`);
  }
});

test('该放的全放过', () => {
  for (const [name, text] of PASS) {
    const r = guard(text);
    assert.equal(r.ok, true, `${name} 被误拦了: ${text} → ${r.line}`);
  }
});

test('一行不超过 40 字，烧 token 要省', () => {
  for (const [name, text] of BLOCK) {
    const r = guard(text);
    assert.ok(r.line.length <= 40, `${name} 的输出太长（${r.line.length} 字）: ${r.line}`);
  }
});

test('空输入直接放过', () => {
  assert.equal(guard('').ok, true);
  assert.equal(guard('   ').ok, true);
});

test('长文不当聊天回复拦', () => {
  // 门槛是 300 字：QQ 机器人一条回复二三十字，超过这个量级的是文档不是聊天
  const long = '先说明一下背景。这个项目从去年开始，中间换过两次负责人，第一次是团队重组，第二次是预算砍掉了一半。现在剩下的人手只够维护，不够做新功能。'.repeat(6);
  assert.ok(long.length > 300, '样本得够长，实际 ' + long.length);
  const r = guard(long);
  assert.equal(r.ok, true);
  assert.equal(r.skipped, 'too-long');
});

test('严格模式多拦两条', () => {
  const dash = guard('改完了——真的改完了。');
  assert.equal(dash.ok, true, '正常模式不该为破折号打回');

  const strict = guard('改完了——真的改完了。', { strict: true });
  assert.equal(strict.ok, false, '严格模式该拦破折号');
});

test('只报一条原因，不堆', () => {
  const r = guard('首先这样，其次那样——这不是技术问题，而是认知问题。');
  assert.equal(r.ok, false);
  assert.equal(r.line.split(' · ').length, 2, '只有「为什么 + 怎么改」两段');
  assert.ok(!r.line.includes('|'), '不并列多条原因');
});

test('guardLine 只回一行', () => {
  assert.equal(guardLine('卖卡卖完了随便写了'), 'OK');
  assert.ok(guardLine('这不是技术问题，而是认知问题。').startsWith('改：'));
});

test('打回的原因按严重度排，三连优先于对举', () => {
  const both = '首先态度要正，其次内容要实——这不是技术问题，而是认知问题。';
  const r = guard(both);
  assert.ok(r.why.includes('三连'), `该先报三连，实际报了 ${r.why}`);
});
