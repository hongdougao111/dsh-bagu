import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guard } from '../lib/guard.js';

// ── git 场景：commit / PR / review / issue ─────────────

test('git：套路 commit 全拦', () => {
  const slop = [
    'feat: 优化了用户模块的代码结构，提升了可维护性',
    'fix: 修复了若干已知问题',
    'refactor: 重构时间线生成逻辑，提升代码质量',
    'chore: 优化了构建流程',
    '更新了一些相关文件',
    '此次改动完善了功能逻辑',
  ];
  for (const t of slop) {
    const r = guard(t);
    assert.equal(r.ok, false, `该拦但放过了: ${t}`);
    assert.ok(r.line.startsWith('改：'), `输出该以「改：」开头: ${r.line}`);
  }
});

test('git：好的 commit 全放过', () => {
  const good = [
    '登录失败时不再清空已填的手机号',
    '修 timeout 重试把同一个订单提交了两次',
    '时间线那段拆出来单放一个文件，不然改一次要翻八百行',
    '去掉出处标注',
    '补 npm 元数据，可以打包发布了',
    '热梗库补释义：从 144 条补到 502 条',
    'package.json 补 dsh.bundle.patch',
    '0.4.0：守门器 + 省 token',
    '加设置页：开关、三个阈值、当场试一下',
  ];
  for (const t of good) {
    const r = guard(t);
    assert.equal(r.ok, true, `误拦了: ${t} → ${r.line}`);
  }
});

test('git：PR 模板骨架要拦', () => {
  const template = [
    '## 概述\n本 PR 优化了代码结构。\n\n## 改动\n- 调整了章节\n- 新增了条款\n\n## 影响\n无',
    '## 背景\n此次改动提升了可维护性。\n\n## 变更\n见文件列表',
  ];
  for (const t of template) {
    const r = guard(t);
    assert.equal(r.ok, false, `PR 模板该拦: ${r.line}`);
  }
});

test('git：review 空话要拦', () => {
  const slop = [
    '整体实现思路清晰，代码结构合理，建议后续可以进一步优化。',
    '代码写得很好，逻辑很清晰，赞！',
    'LGTM',
    '建议后续补充测试',
    '这里可以进一步优化一下',
  ];
  for (const t of slop) {
    const r = guard(t);
    assert.equal(r.ok, false, `review 套话该拦: ${t}`);
  }
});

test('git：具体的 review 要放过', () => {
  const good = [
    '第 42 行那个 await 少了一层，函数本身没返回 promise',
    '这里 n+1 了，一次请求会打 200 次库',
    '这个正则没锚定开头，会把 mid 里的也匹配上',
    '测试里那个断言依赖了系统时区，CI 上会挂',
    '这个分支没处理空数组，返回 undefined 会让调用方崩',
  ];
  for (const t of good) {
    const r = guard(t);
    assert.equal(r.ok, true, `具体 review 被误拦: ${t} → ${r.line}`);
  }
});

test('git：issue 客服腔要拦', () => {
  const slop = [
    '感谢反馈！这个问题我们已经记录，会在后续版本中修复。',
    '感谢您的建议，我们会持续改进。',
    '这个需求已经在排期中，感谢关注。',
  ];
  for (const t of slop) {
    const r = guard(t);
    assert.equal(r.ok, false, `issue 客服腔该拦: ${t}`);
  }
});

test('git：issue 实话要放过', () => {
  const good = [
    '你说对了，我搞错了。加权方向反了，经历最好编。',
    '这条我改不了，得先有分文体的语料。',
    '复现了，8443 端口占用导致的。',
    '这个数我核不出来，原始语料不在手上。',
  ];
  for (const t of good) {
    const r = guard(t);
    assert.equal(r.ok, true, `实话被误拦: ${t} → ${r.line}`);
  }
});

test('git：长 PR 描述不当文档放过', () => {
  // 超过 300 字的聊天内容可以跳过，但 PR 描述不该跳过
  const longPr = '## 概述\n' +
    '这个改动修了三个地方，每个都写清为什么。'.repeat(20) +
    '\n\n## 改动\n' +
    '- 第 42 行那个 await 少了一层\n' +
    '- 正则加了锚定'.repeat(10);
  const r = guard(longPr);
  assert.ok(longPr.length > 300, '样本得够长');
  assert.equal(r.ok, false, 'PR 模板不该因为长就放过');
  assert.notEqual(r.skipped, 'too-long');
});

test('git：长 PR 描述照样判', () => {
  // 长文不再一律跳过。PR 描述本来就长，该判就得判。
  const longPr = '## 概述\n' + '本 PR 优化了代码结构，提升了可维护性。'.repeat(20) +
    '\n\n## 改动\n- 调整了章节结构\n- 新增了规则条款';
  assert.ok(longPr.length > 300);
  const r = guard(longPr);
  assert.equal(r.ok, false, '长 PR 模板该拦');
  assert.equal(r.skipped, undefined, '不该走 too-long');
});
