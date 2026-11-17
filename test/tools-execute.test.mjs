import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, existsSync, readFileSync, unlinkSync } from 'node:fs';
import { apply } from '../lib/index.js';

/**
 * 真跑两个工具的 execute。
 *
 * 这块之前是测试盲区：130 个测试，没一条调过 bagu_guard.execute / bagu_meme.execute，
 * 所以「AI 接梗一开就 TypeError」这种线上炸 15 次的问题，测试全绿。
 *
 * 教训：测注册、测底层函数，不等于测工具真的能跑。
 */

function mount(config) {
  const bak = existsSync('./config.json') ? readFileSync('./config.json', 'utf8') : null;
  writeFileSync('./config.json', JSON.stringify(config));
  const tools = {};
  apply({
    inject(deps, fn) {
      if (deps.includes('llm')) return;
      fn({
        systemPrompt: { section() { return () => {} }, context() { return () => {} } },
        tools: { register(t) { tools[t.name] = t } },
        webServer: { register() { return () => {} } },
        effect(fn) { return fn() },
        on() {},
      });
    },
  }, {});
  return {
    tools,
    done() {
      if (bak !== null) writeFileSync('./config.json', bak);
      else if (existsSync('./config.json')) unlinkSync('./config.json');
    },
  };
}

const BASE = { enabled: true, memes: true, autoMeme: true };

test('aiBridge 关着：命中梗也不崩', async () => {
  const m = mount({ ...BASE, aiBridge: false });
  try {
    const r = await m.tools.bagu_guard.execute({ text: '康神开播了' });
    assert.equal(typeof r.text, 'string');
    assert.ok(r.text.length > 0);
  } finally { m.done(); }
});

test('aiBridge 开着：命中梗不崩（线上炸的就是这条）', async () => {
  // 根因：bridge() 来自 memes.js，返回 {hits, usage, tags}；
  // AI 分支按 bridge.js 的 {same, by} 去读，r.same 是 undefined，
  // 读 .length 就是 TypeError。真机一天炸 15 次。
  const m = mount({ ...BASE, aiBridge: true });
  try {
    const r = await m.tools.bagu_guard.execute({ text: '康神开播了' });
    assert.equal(typeof r.text, 'string', '不该抛，实际: ' + JSON.stringify(r));
    assert.ok(r.text.length > 0);
  } finally { m.done(); }
});

test('aiBridge 开着：bagu_meme 命中梗不崩', async () => {
  // 伴生问题：那段引用了未定义的 list → ReferenceError
  const m = mount({ ...BASE, aiBridge: true });
  try {
    const r = await m.tools.bagu_meme.execute({ text: '康神开播了' });
    assert.equal(typeof r.text, 'string');
    assert.ok(r.text.length > 0);
  } finally { m.done(); }
});

test('aiBridge 开着：未命中梗走正常路径', async () => {
  const m = mount({ ...BASE, aiBridge: true });
  try {
    const r = await m.tools.bagu_guard.execute({ text: '帮我看看这个报错' });
    assert.equal(r.text, 'OK');
    const r2 = await m.tools.bagu_meme.execute({ text: '帮我看看这个报错' });
    assert.ok(r2.text.length > 0);
  } finally { m.done(); }
});

test('q 查词路径不受 AI 分支影响', async () => {
  const m = mount({ ...BASE, aiBridge: true });
  try {
    const r = await m.tools.bagu_meme.execute({ q: '内卷' });
    assert.match(r.text, /内卷/);
    assert.ok(!r.text.includes('undefined'), '输出里不该出现 undefined: ' + r.text.slice(0, 80));
  } finally { m.done(); }
});

test('梗库关着时 bagu_meme 明确拒绝', async () => {
  const m = mount({ ...BASE, memes: false });
  try {
    const r = await m.tools.bagu_meme.execute({ text: '康神开播了' });
    assert.equal(r.ok, false);
    assert.match(r.text, /梗库没开/);
  } finally { m.done(); }
});

test('空参数不崩', async () => {
  const m = mount({ ...BASE, aiBridge: true });
  try {
    for (const args of [{}, { text: '' }, { text: null }]) {
      await assert.doesNotReject(() => m.tools.bagu_guard.execute(args), JSON.stringify(args));
      await assert.doesNotReject(() => m.tools.bagu_meme.execute(args), JSON.stringify(args));
    }
  } finally { m.done(); }
});

test('守门判定本身不受 AI 接梗影响', async () => {
  // 开不开 AI 接梗，能不能发出去这件事必须一样。
  const off = mount({ ...BASE, aiBridge: false });
  const a = await off.tools.bagu_guard.execute({ text: '这话我记下了。' });
  off.done();

  const on = mount({ ...BASE, aiBridge: true });
  const b = await on.tools.bagu_guard.execute({ text: '这话我记下了。' });
  on.done();

  assert.equal(a.text.split('｜')[0], b.text.split('｜')[0], '判定该一致');
});
