import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guard } from '../lib/guard.js';

// ── 边界与健壮性 ─────────────────────────────────

test('空输入都不崩', () => {
  for (const t of ['', '   ', '\n\n', '\t', null, undefined, 0, false]) {
    assert.doesNotThrow(() => guard(t), `崩在 ${JSON.stringify(t)}`);
    const r = guard(t);
    assert.equal(r.ok, true);
  }
});

test('纯符号 / 单字 / emoji', () => {
  for (const t of ['好', '？！。', '😀😀😀', '。。。', '——']) {
    const r = guard(t);
    assert.equal(r.ok, true, `「${t}」不该被拦: ${r.line}`);
  }
});

test('超长不崩，耗时可控', () => {
  const t = '这个地方需要改动一下，因为原来的实现有点问题。'.repeat(400);
  const start = Date.now();
  const r = guard(t);
  const ms = Date.now() - start;
  assert.ok(ms < 500, `超长输入耗时 ${ms}ms，超过 500ms`);
  assert.equal(typeof r.ok, 'boolean');
});

test('纯英文长文不崩', () => {
  const t = 'The quick brown fox jumps over the lazy dog. '.repeat(60);
  assert.doesNotThrow(() => guard(t));
});

test('纯代码不崩', () => {
  const t = 'const x = 1;\nlet y = 2;\nfunction f() { return x + y; }';
  assert.doesNotThrow(() => guard(t));
});

test('只有代码没有注释时不拦', () => {
  const t = 'const x = 1;\nlet y = 2;';
  const r = guard(t);
  assert.equal(r.ok, true, '没注释不该触发注释规则');
});

test('长文里同一个信号只出现一次不算', () => {
  // 300 字以上的文本，空转信号要出现两次以上才判。
  // 样本必须真的只有一处空转 —— 拿整段 repeat 会把那句一起复制。
  const body = [
    '昨晚十一点半我第三次跑那个脚本，卡在 8443 端口上了。',
    '日志里就一行 EADDRINUSE，我盯着看了半天才反应过来。',
    '后来把之前那个进程 kill 掉就好了，大概是我自己忘了关。',
    '今天又试了一次，端口换成 8445 就通了。',
    '配置改在 /etc/app/config.yml，第 12 行那个 listen 指令。',
    '备份留在 /tmp/app.bak，想退随时退。',
    '测试跑了 37 个，全过。抽了三帧看构图，没发现黑场。',
    '音频峰值在 -3.2 dB，没爆。字幕对齐到第 4 分 12 秒。',
    '文件放在 /Users/me/project/out/，命名是 day1.mp4。',
    '这次的改动其实很小，只是把 timeout 从 30 秒改成 60 秒。',
    '压测跑到 800 QPS 时 p99 超过 200ms，记在 issue #12 了。',
    '回滚的话 git reset --hard 到 a1b2c3d，别 push。',
    '这次优化了流程。',  // 全文唯一一处空转
  ];
  const padded = body.join('');
  assert.ok(padded.length > 300, '样本得够长，实际 ' + padded.length);
  assert.ok(padded.length > 300, '样本得够长，实际 ' + padded.length);
  const r = guard(padded);
  assert.equal(r.ok, true, '长文里一处空转不该拦，实际拦了: ' + r.line);
});

test('长文里信号反复出现要拦', () => {
  const slop = ('本周完成了以下工作：优化了系统架构，提升了运行效率，完善了相关文档。' +
    '同时，我们也会持续改进，为用户提供更好的服务。').repeat(6);
  assert.ok(slop.length > 300);
  const r = guard(slop);
  assert.equal(r.ok, false, '长文里反复空转该拦');
});

test('返回值结构稳定', () => {
  for (const t of ['', '好', '这不是技术问题，而是认知问题。']) {
    const r = guard(t);
    assert.equal(typeof r.ok, 'boolean');
    assert.equal(typeof r.line, 'string');
    if (!r.ok) {
      assert.equal(typeof r.why, 'string');
      assert.equal(typeof r.hint, 'string');
    }
  }
});

test('strict 模式只多拦，不少拦', () => {
  const t = '改完了——真的改完了。';
  const normal = guard(t);
  const strict = guard(t, { strict: true });
  assert.equal(normal.ok, true);
  assert.equal(strict.ok, false);
});
