import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 真机反馈暴露的两个 bug：
//  1. bagu_meme 只在 apply 时按 live.memes 注册 → 设置页改了不生效，
//     提示里说有这个工具，实际函数列表里没有（模型原话：「没有 bagu_meme 工具在函数列表里」）
//  2. 预查注入从 session 翻消息 → 那时当轮 user/message 还没 append，
//     拿到的是上一轮的（模型原话：「对方提的是 67 —— 这是承接上一条 67 的」）
//
// 这两条都得锁住，不然下次改回去又静默失效。

const SRC = readFileSync('lib/index.js', 'utf8');

test('bagu_meme 必须无条件注册', () => {
  // 不允许出现 if (live.memes) { ctx.tools.register
  const pat = /if\s*\(\s*live\.memes\s*\)\s*\{\s*ctx\.tools\.register/;
  assert.doesNotMatch(SRC, pat, 'bagu_meme 又被条件包裹了，热更新会失效');
});

test('bagu_meme 的 execute 里有开关检查', () => {
  const i = SRC.indexOf("name: 'bagu_meme'");
  assert.ok(i > 0, '找不到 bagu_meme');
  const tail = SRC.slice(i, i + 600);
  assert.match(tail, /if \(!live\.memes\)/, 'execute 里得判 live.memes，否则关了还能用');
});

test('预查优先用当轮消息，不靠 session 翻', () => {
  assert.match(SRC, /currentUserText \|\| lastUserText/, '预查得优先用 pre-step 抓到的当轮消息');
});

test('注册了 agent/pre-step 钩子', () => {
  assert.match(SRC, /ctx\.on\('agent\/pre-step'/, '没挂 pre-step，当轮消息抓不到');
});

test('pre-step 里取的是 role === user', () => {
  const i = SRC.indexOf("ctx.on('agent/pre-step'");
  assert.ok(i > 0);
  const tail = SRC.slice(i, i + 400);
  assert.match(tail, /role !== 'user'/, '只取 user，别把 assistant 也算进去');
});

test('用完就清，不残留上一轮', () => {
  assert.match(SRC, /currentUserText = '';/, '取完得清掉，不然下一轮没新消息时会复用旧的');
});

test('payloadText 和 lastUserText 都有定义', () => {
  assert.match(SRC, /function payloadText\(/);
  assert.match(SRC, /function lastUserText\(/);
});
