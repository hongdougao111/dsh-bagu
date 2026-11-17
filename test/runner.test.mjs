import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PKG = JSON.parse(readFileSync('package.json', 'utf8'));

/**
 * 测试必须串行跑。
 *
 * 踩过：node --test 默认并行跑文件，三个测试文件（ai-bridge-tools / prefetch /
 * tools-execute）都在写同一个 config.json，互相覆盖，单独跑全过、一起跑就挂。
 *
 * 这不是测试写得不好，是基础设施没配对 —— 改的是跑法，不是代码。
 */

test('test 脚本带 --test-concurrency=1', () => {
  assert.match(PKG.scripts.test, /--test-concurrency=1/,
    '并行跑会互相踩 config.json，实际: ' + PKG.scripts.test);
});

test('多个测试文件确实共用 config.json', () => {
  // 这条是解释为什么必须串行：只要有两个以上文件写同一个路径，就必须串。
  const files = ['test/ai-bridge-tools.test.mjs', 'test/prefetch.test.mjs', 'test/tools-execute.test.mjs'];
  let writers = 0;
  for (const f of files) {
    const s = readFileSync(f, 'utf8');
    if (s.includes("writeFileSync('./config.json'") || s.includes('writeFileSync(CONFIG_FILE')) writers++;
  }
  assert.ok(writers >= 2, '如果只剩一个文件在写，这条约束可以放宽；实际 ' + writers + ' 个');
});
