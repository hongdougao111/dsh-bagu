import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const INDEX = readFileSync('lib/index.js', 'utf8');

/**
 * 定时更新的判据。
 *
 * 原来写的是「当前小时 === 配置的小时」，DSH 那一刻不在就永远错过。
 * 实测九天一次没跑过（库里 last_check 停在 11-08，今天是 11-17）。
 */

test('不许死等整点', () => {
  // hour !== target 这种判法，错过那一小时就整天跳过。
  assert.doesNotMatch(INDEX, /hour !== target/, '又改回死等整点了');
});

test('按「距上次超过 20 小时」判', () => {
  assert.match(INDEX, /20 \* 60 \* 60 \* 1000/, '得有 20 小时的时间闸');
  assert.match(INDEX, /stale/, '得算过不过期');
});

test('不看几点，到点就补', () => {
  // 原来是「当前小时 === 配置的小时」，DSH 那一刻不在就整天跳过 —— 实测九天没跑成。
  // 现在是距上次超过 20 小时就补，跟几点无关。
  assert.doesNotMatch(INDEX, /hour < target/, '不该再卡小时');
  assert.doesNotMatch(INDEX, /getHours\(\)/, '不该再看当前小时');
});

test('定时器要 unref，不能挂住进程', () => {
  // 踩过：加了 setInterval 之后测试从 2.4 秒变卡死 90 秒。
  assert.match(INDEX, /\.unref\(\)/);
});

test('autoUpdate 关掉就一次都不跑', () => {
  assert.match(INDEX, /if \(!live\.autoUpdate\) return/);
});

test('首查留出开机缓冲', () => {
  // 开机瞬间一堆东西抢网络，别第一秒就去翻 229 页。
  const m = INDEX.match(/setTimeout\(tick,\s*(\d+)\)/);
  assert.ok(m, '找不到首次 tick');
  const ms = Number(m[1]);
  assert.ok(ms >= 30000, `首查 ${ms}ms 太急，开机时网络还没稳`);
});
